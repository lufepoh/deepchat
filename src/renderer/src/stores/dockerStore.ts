import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
}

export const useDockerStore = defineStore('docker', () => {
  // 상태 관리
  const isEnabled = ref(false)
  const isLoading = ref(false)
  const images = ref<DockerImage[]>([])
  const containers = ref<DockerContainer[]>([])
  const containerConfigs = ref<DockerContainerConfig[]>([])
  const loadingStates = ref<Record<string, boolean>>({})
  const errorMessage = ref('')

  // Computed 속성
  const runningContainers = computed(() => 
    containers.value.filter(container => container.isRunning)
  )
  
  const stoppedContainers = computed(() => 
    containers.value.filter(container => !container.isRunning)
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
      const response = await window.electron.ipcRenderer.invoke('docker:load-config')
      
      if (response.success) {
        containerConfigs.value = response.config.containers || []
        isEnabled.value = response.config.enabledByDefault || false
      }
    } catch (error) {
      errorMessage.value = String(error)
    }
  }

  // Docker 설정 저장하기
  const saveConfig = async () => {
    try {
      await window.electron.ipcRenderer.invoke('docker:save-config', {
        containers: containerConfigs.value,
        enabledByDefault: isEnabled.value
      })
    } catch (error) {
      errorMessage.value = String(error)
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
    const index = containerConfigs.value.findIndex(c => c.id === id)
    
    if (index !== -1) {
      containerConfigs.value[index] = {
        ...containerConfigs.value[index],
        ...config
      }
      
      saveConfig()
    }
  }

  // 컨테이너 설정 삭제
  const removeContainerConfig = (id: string) => {
    containerConfigs.value = containerConfigs.value.filter(c => c.id !== id)
    saveConfig()
  }

  // 컨테이너 실행
  const runContainer = async (configId: string) => {
    const config = containerConfigs.value.find(c => c.id === configId)
    
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

  // Docker 사용 설정 변경
  const setEnabled = (value: boolean) => {
    isEnabled.value = value
    saveConfig()
  }

  // 초기화
  const init = async () => {
    await loadConfig()
    
    if (isEnabled.value) {
      await fetchImages()
      await fetchContainers()
    }
  }

  return {
    // 상태
    isEnabled,
    isLoading,
    images,
    containers,
    containerConfigs,
    loadingStates,
    errorMessage,
    
    // Computed
    runningContainers,
    stoppedContainers,
    
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
    setEnabled,
    init
  }
}) 