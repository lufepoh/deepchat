import { defineStore } from 'pinia'
import { ref, computed, onMounted } from 'vue'
import { DOCKER_EVENTS } from '@/events'

// 간단한 UUID 생성 함수
function createId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export interface DockerImage {
  name: string
  tag: string
  id: string
  size: string
  createdAt: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string
  isRunning: boolean
}

export interface DockerContainerConfig {
  id: string
  name: string
  image: string
  args: string[]
  ports: string[]
  volumes: string[]
  env: string[]
  enabled: boolean
  autoStart: boolean
  workingDir?: string
  isBuiltIn?: boolean
  buildPath?: string
  description?: string
}

export const useDockerStore = defineStore('docker', () => {
  // 상태 관리
  const isEnabled = ref(false)
  const isLoading = ref(false)
  const images = ref<DockerImage[]>([])
  const containers = ref<DockerContainer[]>([])
  const containerConfigs = ref<DockerContainerConfig[]>([])
  const builtInContainers = ref<Record<string, DockerContainerConfig>>({})
  const loadingStates = ref<Record<string, boolean>>({})
  const errorMessage = ref('')

  // Computed 속성
  const runningContainers = computed(() => 
    containers.value.filter(container => container.isRunning)
  )
  
  const stoppedContainers = computed(() => 
    containers.value.filter(container => !container.isRunning)
  )
  
  // 모든 컨테이너 구성 (사용자 정의 + 내장)
  const allContainerConfigs = computed(() => {
    return [
      ...containerConfigs.value,
      ...Object.values(builtInContainers.value).filter(c => c.enabled)
    ]
  })
  
  // 내장 컨테이너 목록
  const enabledBuiltInContainers = computed(() => 
    Object.values(builtInContainers.value).filter(c => c.enabled)
  )

  // Docker 이미지 목록 불러오기
  const fetchImages = async () => {
    isLoading.value = true
    errorMessage.value = ''
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:list-images')
      
      if (response.success) {
        images.value = response.images
      } else {
        errorMessage.value = response.error || '이미지 목록을 가져오는데 실패했습니다.'
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      isLoading.value = false
    }
  }

  // Docker 컨테이너 목록 불러오기
  const fetchContainers = async () => {
    isLoading.value = true
    errorMessage.value = ''
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:list-containers')
      
      if (response.success) {
        containers.value = response.containers
      } else {
        errorMessage.value = response.error || '컨테이너 목록을 가져오는데 실패했습니다.'
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      isLoading.value = false
    }
  }

  // Docker 설정 불러오기
  const loadConfig = async () => {
    try {
      isLoading.value = true
      const response = await window.electron.ipcRenderer.invoke('docker:load-config')
      
      if (response.success) {
        containerConfigs.value = response.config.containers || []
        builtInContainers.value = response.config.builtInContainers || {}
        isEnabled.value = response.config.enabledByDefault || false
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      isLoading.value = false
    }
  }

  // Docker 설정 저장하기
  const saveConfig = async () => {
    try {
      isLoading.value = true
      await window.electron.ipcRenderer.invoke('docker:save-config', {
        containers: containerConfigs.value,
        enabledByDefault: isEnabled.value,
        builtInContainers: builtInContainers.value
      })
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      isLoading.value = false
    }
  }

  // 컨테이너 설정 추가
  const addContainerConfig = (config: Omit<DockerContainerConfig, 'id'>) => {
    const newConfig: DockerContainerConfig = {
      ...config,
      id: createId()
    }
    
    containerConfigs.value.push(newConfig)
    saveConfig()
    
    return newConfig
  }

  // 컨테이너 설정 업데이트
  const updateContainerConfig = (id: string, config: Partial<DockerContainerConfig>) => {
    // 사용자 정의 컨테이너인지 확인
    const index = containerConfigs.value.findIndex(c => c.id === id)
    
    if (index !== -1) {
      containerConfigs.value[index] = {
        ...containerConfigs.value[index],
        ...config
      }
      saveConfig()
      return
    }
    
    // 내장 컨테이너인지 확인
    for (const key in builtInContainers.value) {
      if (builtInContainers.value[key].id === id) {
        builtInContainers.value[key] = {
          ...builtInContainers.value[key],
          ...config,
          // 내장 컨테이너의 중요 속성은 변경되지 않도록 보호
          isBuiltIn: true,
          id: builtInContainers.value[key].id,
          buildPath: builtInContainers.value[key].buildPath
        }
        saveConfig()
        return
      }
    }
  }

  // 컨테이너 설정 삭제
  const removeContainerConfig = (id: string) => {
    containerConfigs.value = containerConfigs.value.filter(c => c.id !== id)
    saveConfig()
  }

  // 컨테이너 실행
  const runContainer = async (configId: string) => {
    // 사용자 정의 또는 내장 컨테이너 찾기
    let config = containerConfigs.value.find(c => c.id === configId)
    
    if (!config) {
      // 내장 컨테이너에서 찾기
      for (const key in builtInContainers.value) {
        if (builtInContainers.value[key].id === configId) {
          config = builtInContainers.value[key]
          break
        }
      }
    }
    
    if (!config) {
      errorMessage.value = '컨테이너 설정을 찾을 수 없습니다.'
      return
    }
    
    loadingStates.value[configId] = true
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:run-container', config)
      
      if (!response.success) {
        errorMessage.value = response.error || '컨테이너 실행에 실패했습니다.'
      } else {
        // 컨테이너 목록 갱신
        await fetchContainers()
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      loadingStates.value[configId] = false
    }
  }

  // 컨테이너 중지
  const stopContainer = async (containerId: string, configId: string) => {
    loadingStates.value[configId] = true
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:stop-container', containerId)
      
      if (!response.success) {
        errorMessage.value = response.error || '컨테이너 중지에 실패했습니다.'
      } else {
        // 컨테이너 목록 갱신
        await fetchContainers()
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      loadingStates.value[configId] = false
    }
  }

  // 컨테이너 삭제
  const removeContainer = async (containerId: string) => {
    isLoading.value = true
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:remove-container', containerId)
      
      if (!response.success) {
        errorMessage.value = response.error || '컨테이너 삭제에 실패했습니다.'
      } else {
        // 컨테이너 목록 갱신
        await fetchContainers()
      }
    } catch (error) {
      errorMessage.value = String(error)
    } finally {
      isLoading.value = false
    }
  }
  
  // 이미지 빌드
  const buildImage = async (buildPath: string, imageName: string) => {
    isLoading.value = true
    
    try {
      const response = await window.electron.ipcRenderer.invoke('docker:build-image', {
        buildPath,
        imageName
      })
      
      if (!response.success) {
        errorMessage.value = response.error || '이미지 빌드에 실패했습니다.'
        return false
      }
      
      // 이미지 목록 갱신
      await fetchImages()
      return true
    } catch (error) {
      errorMessage.value = String(error)
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  // 내장 컨테이너 활성화 설정
  const toggleBuiltInContainer = async (key: string, enabled: boolean) => {
    if (builtInContainers.value[key]) {
      builtInContainers.value[key].enabled = enabled
      await saveConfig()
    }
  }

  // Docker 사용 설정 변경
  const setEnabled = async (value: boolean) => {
    try {
      // 로딩 상태 표시
      isLoading.value = true
      
      // 먼저 store 상태 변경 (UI를 즉시 반영하기 위함)
      isEnabled.value = value
      
      // 서버 호출
      const response = await window.electron.ipcRenderer.invoke('docker:set-enabled', value)
      
      if (response.success) {
        // Docker가 활성화되었으면 컨테이너와 이미지 목록 불러오기
        if (value) {
          await Promise.all([
            fetchImages(),
            fetchContainers()
          ])
        }
      } else {
        // 실패 시 이전 상태로 복원
        isEnabled.value = !value
        errorMessage.value = response.error || 'Docker 활성화 상태 설정에 실패했습니다.'
      }
      
      return response.success
    } catch (error) {
      // 예외 처리
      isEnabled.value = !value
      errorMessage.value = String(error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 이벤트 리스너 초기화
  const initEvents = () => {
    // 설정 변경 이벤트 리스너 등록
    window.electron.ipcRenderer.on(DOCKER_EVENTS.CONFIG_CHANGED, (_, config) => {
      console.log('Docker config changed:', config)
      containerConfigs.value = config.containers || []
      builtInContainers.value = config.builtInContainers || {}
      isEnabled.value = config.enabledByDefault || false
    })
  }

  // 초기화
  const init = async () => {
    // 이벤트 리스너 초기화
    initEvents()
    
    // 설정 불러오기
    await loadConfig()
    
    // Docker가 활성화되어 있으면 컨테이너와 이미지 목록 불러오기
    if (isEnabled.value) {
      await Promise.all([
        fetchImages(),
        fetchContainers()
      ])
    }
  }
  
  // 컴포넌트 마운트 시 초기화 실행
  onMounted(async () => {
    await init()
  })

  return {
    // 상태
    isEnabled,
    isLoading,
    images,
    containers,
    containerConfigs,
    builtInContainers,
    loadingStates,
    errorMessage,
    
    // Computed
    runningContainers,
    stoppedContainers,
    allContainerConfigs,
    enabledBuiltInContainers,
    
    // 액션
    fetchImages,
    fetchContainers,
    loadConfig,
    saveConfig,
    addContainerConfig,
    updateContainerConfig,
    removeContainerConfig,
    runContainer,
    stopContainer,
    removeContainer,
    buildImage,
    toggleBuiltInContainer,
    setEnabled,
    init
  }
}) 