import { ipcMain, shell } from 'electron'

// 외부 링크를 여는 IPC 핸들러 등록
export function registerExternalLinkHandler() {
  // Open external link
  ipcMain.handle('open-external-link', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('외부 링크 열기 실패:', error)
      return { success: false, error: String(error) }
    }
  })
} 