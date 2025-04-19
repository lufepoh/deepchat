import { renderMermaidDiagram } from '@/lib/mermaid.helper'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { perl } from '@codemirror/legacy-modes/mode/perl'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { haskell } from '@codemirror/legacy-modes/mode/haskell'
import { erlang } from '@codemirror/legacy-modes/mode/erlang'
import { clojure } from '@codemirror/legacy-modes/mode/clojure'
import { StreamLanguage } from '@codemirror/language'
import { php } from '@codemirror/lang-php'
import { yaml } from '@codemirror/lang-yaml'
import { EditorState, Extension } from '@codemirror/state'
import { anysphereThemeDark, anysphereThemeLight } from '@/lib/code.theme'
import { useDark } from '@vueuse/core'
import { watch } from 'vue'
import { useArtifactStore } from '@/stores/artifact'
import { useI18n } from 'vue-i18n'
import { nanoid } from 'nanoid'

export const editorInstances: Map<string, EditorView> = new Map()
// 收集当前可见的编辑器ID
const currentEditorIds = new Set<string>()
// 存储代码内容和语言信息的映射，保持稳定性
const codeCache: Map<string, { code: string; lang: string }> = new Map()

// 获取语言扩展
const getLanguageExtension = (lang: string): Extension => {
  switch (lang.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'ts':
    case 'typescript':
      return javascript()
    case 'react':
    case 'vue':
    case 'html':
      return html()
    case 'css':
      return css()
    case 'json':
      return json()
    case 'python':
    case 'py':
      return python()
    case 'kotlin':
    case 'kt':
    case 'java':
      return java()
    case 'go':
    case 'golang':
      return go()
    case 'markdown':
    case 'md':
      return markdown()
    case 'sql':
      return sql()
    case 'xml':
      return xml()
    case 'cpp':
    case 'c++':
    case 'c':
      return cpp()
    case 'rust':
    case 'rs':
      return rust()
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return StreamLanguage.define(shell)
    case 'php':
      return php()
    case 'yaml':
    case 'yml':
      return yaml()
    case 'swift':
      return StreamLanguage.define(swift)
    case 'ruby':
      return StreamLanguage.define(ruby)
    case 'perl':
      return StreamLanguage.define(perl)
    case 'lua':
      return StreamLanguage.define(lua)
    case 'haskell':
      return StreamLanguage.define(haskell)
    case 'erlang':
      return StreamLanguage.define(erlang)
    case 'clojure':
      return StreamLanguage.define(clojure)
    default:
      return markdown() // 默认使用markdown作为fallback
  }
}

export const useCodeEditor = (
  id: string,
  messageId: string | undefined,
  threadId: string | undefined
) => {
  const isDark = useDark()
  const artifactStore = useArtifactStore()
  const { t } = useI18n()

  // 创建编辑器实例的函数
  const createEditor = (
    editorContainer: HTMLElement,
    decodedCode: string,
    lang: string,
    editorId: string
  ) => {
    const extensions = [
      basicSetup,
      isDark.value ? anysphereThemeDark : anysphereThemeLight,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      getLanguageExtension(lang),
      EditorState.readOnly.of(true)
    ]

    try {
      const editorView = new EditorView({
        state: EditorState.create({
          doc: decodedCode,
          extensions
        }),
        parent: editorContainer
      })
      editorInstances.set(editorId, editorView)
    } catch (error) {
      console.error('Failed to initialize editor:', error)
      // Fallback方法：使用简单的pre标签
      const escapedCode = decodedCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
      editorContainer.innerHTML = `<pre style="white-space: pre-wrap; color: ${
        isDark.value ? '#ffffff' : '#000000'
      }; margin: 0;">${escapedCode}</pre>`
    }
  }

  const initCodeEditors = (status?: 'loading' | 'success' | 'error') => {
    // Clear current editor IDs at the beginning of initialization
    currentEditorIds.clear()
    const codeBlocks = document.querySelectorAll(`#${id} .code-block`)

    codeBlocks.forEach((block) => {
      const editorId = block.getAttribute('id')
      const editorContainer = block.querySelector('.code-editor')
      const code = block.getAttribute('data-code')
      const lang = block.getAttribute('data-lang')
      const codeHeader = block.querySelector<HTMLElement>('.code-header')

      if (!editorId || !editorContainer || !code || !lang || !codeHeader) {
        return
      }

      // 记录当前ID
      currentEditorIds.add(editorId)

      const decodedCode = decodeURIComponent(escape(atob(code)))

      // 如果是 mermaid 代码块，渲染图表
      if (lang.toLowerCase() === 'mermaid' && status === 'success') {
        renderMermaidDiagram(editorContainer as HTMLElement, decodedCode, editorId)
        // Clean up potential preview buttons if language changed to mermaid
        const existingPreviewButton = codeHeader.querySelector(
          'button.html-preview-btn, button.svg-preview-btn'
        )
        if (existingPreviewButton) {
          removePreviewButtonAndCleanupWrapper(existingPreviewButton, codeHeader)
        }
        return
      }

      // --- Artifact Preview Button (HTML/SVG) ---
      // Check if it's an HTML or SVG block and rendering is complete
      const lowerLang = lang.toLowerCase()
      const isPreviewable = lowerLang === 'html' || lowerLang === 'svg'

      if (isPreviewable && status === 'success') {
        if (codeHeader) {
          // Check if *any* preview button already exists
          const existingPreviewButton = codeHeader.querySelector(
            'button.html-preview-btn, button.svg-preview-btn'
          )
          if (!existingPreviewButton) {
            // Find or create the button wrapper span
            let buttonWrapper = codeHeader.querySelector<HTMLElement>('span.code-header-buttons')
            if (!buttonWrapper) {
              buttonWrapper = document.createElement('span')
              buttonWrapper.className = 'code-header-buttons'
              buttonWrapper.style.display = 'flex'
              buttonWrapper.style.alignItems = 'center'
              buttonWrapper.style.gap = '0.5rem' // 8px gap

              // Move existing copy button (if direct child) into the wrapper
              const existingCopyButton = codeHeader.querySelector<HTMLElement>(
                ':scope > button.copy-button:not(.html-preview-btn)'
              )
              if (existingCopyButton) {
                buttonWrapper.appendChild(existingCopyButton)
              }
              codeHeader.appendChild(buttonWrapper)
            }

            // Determine artifact type, button class, and title based on language
            let artifactType: 'text/html' | 'image/svg+xml'
            let buttonClass: string
            let artifactTitle: string

            if (lowerLang === 'html') {
              artifactType = 'text/html'
              buttonClass = 'html-preview-btn copy-button'
              artifactTitle = t('artifacts.htmlPreviewTitle') || 'HTML Preview'
            } else {
              // svg
              artifactType = 'image/svg+xml'
              buttonClass = 'svg-preview-btn copy-button'
              artifactTitle = t('artifacts.svgPreviewTitle') || 'SVG Preview'
            }

            // Create the preview button
            const previewButton = document.createElement('button')
            previewButton.className = buttonClass
            previewButton.textContent = t('artifacts.preview')

            // Add click listener
            previewButton.onclick = () => {
              if (messageId && threadId) {
                artifactStore.showArtifact(
                  {
                    id: `temp-${lowerLang}-${nanoid()}`,
                    type: artifactType,
                    title: artifactTitle,
                    content: decodedCode,
                    status: 'loaded'
                  },
                  messageId,
                  threadId
                )
              } else {
                console.warn('Cannot open HTML artifact preview: messageId or threadId is missing.')
              }
            }

            // Append the preview button to the wrapper
            buttonWrapper.appendChild(previewButton)
          }
        } else {
          console.warn('Could not find .code-header to append preview button.')
        }
      } else {
        // Remove preview button if language is not previewable or status is not success
        if (codeHeader) {
          const existingButton = codeHeader.querySelector(
            'button.html-preview-btn, button.svg-preview-btn'
          )
          if (existingButton) {
            removePreviewButtonAndCleanupWrapper(existingButton, codeHeader)
          }
        }
      }

      // 检查是否内容与缓存相同
      const cachedInfo = codeCache.get(editorId)
      const isSameContent =
        cachedInfo && cachedInfo.code === decodedCode && cachedInfo.lang === lang

      // 更新缓存
      codeCache.set(editorId, { code: decodedCode, lang })

      // 关键检查：DOM元素是否包含CodeMirror编辑器
      // 即使ID相同，但如果DOM被替换了，我们需要创建新的编辑器
      const existingEditor = editorInstances.get(editorId)
      const domContainsEditor =
        existingEditor &&
        editorContainer instanceof HTMLElement &&
        editorContainer.contains(existingEditor.dom)

      // 如果内容相同且DOM元素包含编辑器实例，不需要重新创建
      if (isSameContent && domContainsEditor) {
        return
      }

      // 如果有旧的编辑器实例，先销毁
      if (existingEditor) {
        existingEditor.destroy()
      }

      if (editorContainer instanceof HTMLElement) {
        createEditor(editorContainer, decodedCode, lang, editorId)
      }
    })

    // 清理不再显示的编辑器实例
    editorInstances.forEach((editor, editorId) => {
      if (!currentEditorIds.has(editorId)) {
        editor.destroy()
        editorInstances.delete(editorId)
        codeCache.delete(editorId)
      }
    })
  }

  const cleanupEditors = () => {
    editorInstances.forEach((editor) => {
      editor.destroy()
    })
    editorInstances.clear()
    codeCache.clear()
    // Also clean up any remaining preview buttons (though should be handled by initCodeEditors)
    document
      .querySelectorAll(
        `#${id} .code-header button.html-preview-btn, #${id} .code-header button.svg-preview-btn`
      )
      .forEach((btn) => {
        const codeHeader = btn.closest('.code-header')
        if (codeHeader instanceof HTMLElement) {
          removePreviewButtonAndCleanupWrapper(btn, codeHeader)
        }
      })
  }

  // Helper function to remove preview button and clean up wrapper
  const removePreviewButtonAndCleanupWrapper = (
    buttonElement: Element,
    headerElement: HTMLElement
  ) => {
    const wrapper = buttonElement.parentElement
    buttonElement.remove()
    if (wrapper && wrapper.classList.contains('code-header-buttons')) {
      const remainingButtons = wrapper.querySelectorAll('button')
      if (remainingButtons.length === 1 && remainingButtons[0].classList.contains('copy-button')) {
        // Move copy button back and remove wrapper
        headerElement.appendChild(remainingButtons[0])
        wrapper.remove()
      } else if (remainingButtons.length === 0) {
        // Remove empty wrapper
        wrapper.remove()
      }
    }
  }

  // 监听主题变化
  watch(isDark, () => {
    // 遍历所有编辑器实例，重新创建以应用新主题
    editorInstances.forEach((editor, editorId) => {
      const cachedInfo = codeCache.get(editorId)
      if (cachedInfo && editor.dom.parentElement) {
        const parentElement = editor.dom.parentElement
        editor.destroy() // 销毁旧的编辑器实例
        createEditor(parentElement, cachedInfo.code, cachedInfo.lang, editorId)
      }
    })
  })

  return {
    initCodeEditors,
    cleanupEditors
  }
}
