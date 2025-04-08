import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { ipcMain, shell, dialog } from 'electron'
import ElectronStore from 'electron-store'
import { eventBus } from './eventbus'
import path from 'path'
import { app } from 'electron'

// Docker 관련 이벤트
export const DOCKER_EVENTS = {
  LIST_IMAGES: 'docker:list-images',
  LIST_CONTAINERS: 'docker:list-containers',
  RUN_CONTAINER: 'docker:run-container',
  STOP_CONTAINER: 'docker:stop-container',
  REMOVE_CONTAINER: 'docker:remove-container',
  SAVE_CONFIG: 'docker:save-config',
  LOAD_CONFIG: 'docker:load-config',
  PULL_IMAGE: 'docker:pull-image',
  CONFIG_CHANGED: 'docker:config-changed',
  SET_ENABLED: 'docker:set-enabled',
  BUILD_IMAGE: 'docker:build-image',
  CHECK_DOCKER: 'docker:check'
}

// Docker 설정 타입
export interface DockerConfig {
  containers: DockerContainerConfig[]
  enabledByDefault: boolean
  builtInContainers: Record<string, DockerContainerConfig>
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

// 내장 Docker 컨테이너 설정
const DEFAULT_BUILTIN_CONTAINERS: Record<string, DockerContainerConfig> = {
  sttServer: {
    id: 'builtin-stt-server',
    name: 'deepchat-stt-server',
    image: 'deepchat-stt-server:0.0.1',
    args: [],
    ports: ['8011:8011', '8012:8012'],
    volumes: [`${path.join(app.getPath('userData'), 'models')}:/app/models`],
    env: ['CUDA_VISIBLE_DEVICES=0'],
    enabled: true,
    autoStart: false,
    isBuiltIn: true,
    buildPath: path.join(process.cwd(), 'src', 'main', 'docker-services', 'deepchat-stt-server'),
    description: '실시간 음성 인식 STT 서버'
  }
}

// 기본 Docker 설정
const defaultConfig: DockerConfig = {
  containers: [],
  enabledByDefault: false,
  builtInContainers: DEFAULT_BUILTIN_CONTAINERS
}

// Docker 설정 저장소 인스턴스
let dockerStore: ElectronStore<DockerConfig>

// Docker 설정 초기화
export async function initDocker() {
  // ElectronStore 초기화
  dockerStore = new ElectronStore<DockerConfig>({
    name: 'docker-settings',
    defaults: defaultConfig,
    beforeEachMigration: (store) => {
      // 마이그레이션 전에 buildPath 재설정
      const builtInContainers = store.get('builtInContainers')
      if (builtInContainers && builtInContainers.sttServer) {
        builtInContainers.sttServer.buildPath = DEFAULT_BUILTIN_CONTAINERS.sttServer.buildPath
        store.set('builtInContainers', builtInContainers)
      }
    }
  })
  
  // 내장 컨테이너 설정 확인 및 업데이트
  await updateBuiltInContainers()
  
  // Docker 설치 확인
  ipcMain.handle(DOCKER_EVENTS.CHECK_DOCKER, async () => {
    try {
      const isInstalled = await checkDockerInstalled()
      return { success: true, isInstalled }
    } catch (error) {
      console.error('Docker 설치 확인 실패:', error)
      return { success: false, error: String(error), isInstalled: false }
    }
  })
  
  // Docker 이미지 목록 가져오기
  ipcMain.handle(DOCKER_EVENTS.LIST_IMAGES, async () => {
    try {
      const execPromise = promisify(exec)
      const { stdout } = await execPromise('docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}} {{.CreatedAt}}"')
      
      const images = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [nameTag, id, size, ...createdAtParts] = line.split(' ')
        const [name, tag] = nameTag.split(':')
        const createdAt = createdAtParts.join(' ')
        
        return {
          name,
          tag: tag || 'latest',
          id,
          size,
          createdAt
        }
      })
      
      return { success: true, images }
    } catch (error) {
      console.error('Docker 이미지 목록 가져오기 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 컨테이너 목록 가져오기
  ipcMain.handle(DOCKER_EVENTS.LIST_CONTAINERS, async () => {
    try {
      const execPromise = promisify(exec)
      const { stdout } = await execPromise('docker ps -a --format "{{.ID}} {{.Image}} {{.Names}} {{.Status}} {{.Ports}}"')
      
      const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [id, image, name, ...rest] = line.split(' ')
        const statusAndPorts = rest.join(' ')
        
        // Status와 Ports 분리
        const statusMatch = statusAndPorts.match(/(Up|Exited|Created).+?(?=\s\d+\.\d+\.\d+\.\d+|\s*$)/)
        const status = statusMatch ? statusMatch[0] : 'Unknown'
        
        const portsMatch = statusAndPorts.match(/\d+\.\d+\.\d+\.\d+.+/g)
        const ports = portsMatch ? portsMatch[0] : ''
        
        return {
          id,
          image,
          name,
          status,
          ports,
          isRunning: status.startsWith('Up')
        }
      })
      
      return { success: true, containers }
    } catch (error) {
      console.error('Docker 컨테이너 목록 가져오기 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 컨테이너 실행
  ipcMain.handle(DOCKER_EVENTS.RUN_CONTAINER, async (_, config: DockerContainerConfig) => {
    try {
      // 내장 이미지인 경우 이미지 확인 및 빌드
      if (config.isBuiltIn && config.buildPath) {
        await ensureBuiltInImage(config)
      }
      
      const execPromise = promisify(exec)
      
      // 명령어 구성
      let command = 'docker run -d'
      
      // 이름 설정
      if (config.name) {
        command += ` --name ${config.name}`
      }
      
      // 포트 매핑
      if (config.ports && config.ports.length > 0) {
        config.ports.forEach(port => {
          command += ` -p ${port}`
        })
      }
      
      // 볼륨 마운트
      if (config.volumes && config.volumes.length > 0) {
        config.volumes.forEach(volume => {
          command += ` -v ${volume}`
        })
      }
      
      // 환경 변수
      if (config.env && config.env.length > 0) {
        config.env.forEach(env => {
          command += ` -e ${env}`
        })
      }
      
      // 작업 디렉토리
      if (config.workingDir) {
        command += ` -w ${config.workingDir}`
      }
      
      // 이미지 이름
      command += ` ${config.image}`
      
      // 추가 인자
      if (config.args && config.args.length > 0) {
        command += ` ${config.args.join(' ')}`
      }
      
      const { stdout } = await execPromise(command)
      const containerId = stdout.trim()
      
      return { success: true, containerId }
    } catch (error) {
      console.error('Docker 컨테이너 실행 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 컨테이너 중지
  ipcMain.handle(DOCKER_EVENTS.STOP_CONTAINER, async (_, containerId: string) => {
    try {
      const execPromise = promisify(exec)
      await execPromise(`docker stop ${containerId}`)
      return { success: true }
    } catch (error) {
      console.error('Docker 컨테이너 중지 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 컨테이너 삭제
  ipcMain.handle(DOCKER_EVENTS.REMOVE_CONTAINER, async (_, containerId: string) => {
    try {
      const execPromise = promisify(exec)
      await execPromise(`docker rm ${containerId}`)
      return { success: true }
    } catch (error) {
      console.error('Docker 컨테이너 삭제 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 이미지 가져오기
  ipcMain.handle(DOCKER_EVENTS.PULL_IMAGE, async (_, image: string) => {
    try {
      const execPromise = promisify(exec)
      await execPromise(`docker pull ${image}`)
      return { success: true }
    } catch (error) {
      console.error('Docker 이미지 가져오기 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 이미지 빌드
  ipcMain.handle(DOCKER_EVENTS.BUILD_IMAGE, async (event, { buildPath, imageName }: { buildPath: string, imageName: string }) => {
    return new Promise((resolve) => {
      try {
        console.log(`Docker 이미지 빌드 시작: ${imageName}, 경로: ${buildPath}`)
        const buildProcess = spawn('docker', ['build', '-t', imageName, buildPath])

        buildProcess.stdout.on('data', (data) => {
          event.sender.send('docker:build-progress', data.toString())
        })

        buildProcess.stderr.on('data', (data) => {
          console.log('빌드 진행:', data.toString())
          event.sender.send('docker:build-progress', data.toString())
        })

        buildProcess.on('close', (code) => {
          if (code === 0) {
            event.sender.send('docker:build-complete', { success: true })
            resolve({ success: true })
          } else {
            event.sender.send('docker:build-complete', { success: false, error: `Build exited with code ${code}` })
            resolve({ success: false, error: `Build exited with code ${code}` })
          }
        })

        buildProcess.on('error', (error) => {
          console.error('Docker build spawn error:', error)
          event.sender.send('docker:build-complete', { success: false, error: String(error) })
          resolve({ success: false, error: String(error) })
        })
      } catch (error) {
        console.error('Docker 이미지 빌드 실패:', error)
        event.sender.send('docker:build-complete', { success: false, error: String(error) })
        resolve({ success: false, error: String(error) })
      }
    })
  })
  
  // Docker 설정 저장
  ipcMain.handle(DOCKER_EVENTS.SAVE_CONFIG, async (_, config: DockerConfig) => {
    try {
      dockerStore.set('containers', config.containers)
      dockerStore.set('enabledByDefault', config.enabledByDefault)
      
      // 내장 컨테이너 설정 업데이트
      if (config.builtInContainers) {
        const currentBuiltIn = dockerStore.get('builtInContainers', DEFAULT_BUILTIN_CONTAINERS)
        for (const [key, value] of Object.entries(config.builtInContainers)) {
          currentBuiltIn[key] = { 
            ...currentBuiltIn[key], 
            ...value,
            // buildPath는 항상 기본값 유지
            buildPath: DEFAULT_BUILTIN_CONTAINERS[key].buildPath
          }
        }
        dockerStore.set('builtInContainers', currentBuiltIn)
      }
      
      // 이벤트 발생
      eventBus.emit(DOCKER_EVENTS.CONFIG_CHANGED, {
        containers: config.containers,
        enabledByDefault: config.enabledByDefault,
        builtInContainers: dockerStore.get('builtInContainers', DEFAULT_BUILTIN_CONTAINERS)
      })
      
      return { success: true }
    } catch (error) {
      console.error('Docker 설정 저장 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 설정 불러오기
  ipcMain.handle(DOCKER_EVENTS.LOAD_CONFIG, async () => {
    try {
      const config = {
        containers: dockerStore.get('containers', []),
        enabledByDefault: dockerStore.get('enabledByDefault', false),
        builtInContainers: dockerStore.get('builtInContainers', DEFAULT_BUILTIN_CONTAINERS)
      }
      
      return { success: true, config }
    } catch (error) {
      console.error('Docker 설정 불러오기 실패:', error)
      return { success: true, config: defaultConfig }
    }
  })
  
  // Docker 활성화 상태 설정
  ipcMain.handle(DOCKER_EVENTS.SET_ENABLED, async (_, enabled: boolean) => {
    try {
      // Docker 설치 여부 확인
      const isInstalled = await checkDockerInstalled()
      
      if (enabled && !isInstalled) {
        // Docker가 설치되어 있지 않다면 설치 안내 메시지 표시
        const result = await dialog.showMessageBox({
          type: 'info',
          title: 'Docker 설치 필요',
          message: 'Docker가 설치되어 있지 않습니다.',
          detail: 'Docker 기능을 사용하기 위해서는 Docker Desktop을 설치해야 합니다.\n설치 페이지로 이동하시겠습니까?',
          buttons: ['예', '아니오'],
          defaultId: 0
        })
        
        if (result.response === 0) {
          // Docker Desktop 설치 페이지로 이동
          await shell.openExternal('https://www.docker.com/products/docker-desktop')
        }
        
        return { success: false, error: 'Docker가 설치되어 있지 않습니다.' }
      }
      
      dockerStore.set('enabledByDefault', enabled)
      
      // 이벤트 발생
      eventBus.emit(DOCKER_EVENTS.CONFIG_CHANGED, {
        containers: dockerStore.get('containers', []),
        enabledByDefault: enabled,
        builtInContainers: dockerStore.get('builtInContainers', DEFAULT_BUILTIN_CONTAINERS)
      })
      
      return { success: true }
    } catch (error) {
      console.error('Docker 활성화 상태 설정 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 앱 시작 시 자동 시작 설정된 컨테이너 실행
  startAutoStartContainers()
}

// 내장 컨테이너 설정 업데이트
async function updateBuiltInContainers() {
  try {
    const storedBuiltIn = dockerStore.get('builtInContainers', {})
    const updatedBuiltIn = { ...storedBuiltIn }
    
    // 기본 내장 컨테이너 설정 추가 또는 업데이트
    for (const [key, value] of Object.entries(DEFAULT_BUILTIN_CONTAINERS)) {
      if (!updatedBuiltIn[key]) {
        updatedBuiltIn[key] = value
      } else {
        // ID와 isBuiltIn 속성은 항상 유지
        updatedBuiltIn[key].id = value.id
        updatedBuiltIn[key].isBuiltIn = true
        
        updatedBuiltIn[key].buildPath = DEFAULT_BUILTIN_CONTAINERS[key].buildPath
      }
    }
    
    // 변경 사항이 있으면 저장
    if (JSON.stringify(updatedBuiltIn) !== JSON.stringify(storedBuiltIn)) {
      dockerStore.set('builtInContainers', updatedBuiltIn)
    }
  } catch (error) {
    console.error('내장 컨테이너 설정 업데이트 실패:', error)
  }
}

// 내장 이미지 확인 및 빌드
async function ensureBuiltInImage(config: DockerContainerConfig): Promise<boolean> {
  if (!config.buildPath) return false
  
  try {
    // 이미지 존재 여부 확인
    const execPromise = promisify(exec)
    const { stdout } = await execPromise('docker images --format "{{.Repository}}:{{.Tag}}"')
    const images = stdout.trim().split('\n')
    
    if (!images.includes(config.image)) {
      console.log(`내장 이미지 빌드 필요: ${config.image}`)
      
      // 이미지가 없으면 빌드
      const result = await execPromise(`docker build -t ${config.image} ${config.buildPath}`)
      console.log('이미지 빌드 결과:', result.stdout)
      if (result.stderr) {
        console.warn('이미지 빌드 경고:', result.stderr)
      }
      return true
    } else {
      console.log(`이미지가 이미 존재함: ${config.image}`)
      return true
    }
  } catch (error) {
    console.error('내장 이미지 확인/빌드 실패:', error)
    return false
  }
}

// 자동 시작 설정된 컨테이너 실행
async function startAutoStartContainers() {
  try {
    const enabled = dockerStore.get('enabledByDefault', false)
    if (!enabled) return
    
    // 사용자 정의 컨테이너
    const containers = dockerStore.get('containers', []).filter(c => c.autoStart && c.enabled)
    
    // 내장 컨테이너
    const builtInContainers = Object.values(dockerStore.get('builtInContainers', {}))
      .filter(c => c.autoStart && c.enabled)
    
    // 모든 컨테이너 합치기
    const allContainers = [...containers, ...builtInContainers]
    
    for (const container of allContainers) {
      try {
        const execPromise = promisify(exec)
        
        // 이미 실행 중인 컨테이너인지 확인
        const { stdout: containerList } = await execPromise(`docker ps -a --format "{{.Names}}"`)
        const containerNames = containerList.trim().split('\n')
        
        if (containerNames.includes(container.name)) {
          // 컨테이너가 이미 존재하면 상태 확인
          const { stdout: containerStatus } = await execPromise(`docker ps -a --filter "name=${container.name}" --format "{{.Status}}"`)
          
          if (containerStatus.trim().startsWith('Up')) {
            console.log(`컨테이너 ${container.name}이(가) 이미 실행 중입니다.`)
            continue
          } else {
            // 중지된 컨테이너 제거
            await execPromise(`docker rm ${container.name}`)
          }
        }
        
        // 내장 컨테이너인 경우 이미지 확인 및 빌드
        if (container.isBuiltIn && container.buildPath) {
          await ensureBuiltInImage(container)
        }
        
        // 컨테이너 실행
        let command = 'docker run -d'
        
        // 이름 설정
        if (container.name) {
          command += ` --name ${container.name}`
        }
        
        // 포트 매핑
        if (container.ports && container.ports.length > 0) {
          container.ports.forEach(port => {
            command += ` -p ${port}`
          })
        }
        
        // 볼륨 마운트
        if (container.volumes && container.volumes.length > 0) {
          container.volumes.forEach(volume => {
            command += ` -v ${volume}`
          })
        }
        
        // 환경 변수
        if (container.env && container.env.length > 0) {
          container.env.forEach(env => {
            command += ` -e ${env}`
          })
        }
        
        // 작업 디렉토리
        if (container.workingDir) {
          command += ` -w ${container.workingDir}`
        }
        
        // 이미지 이름
        command += ` ${container.image}`
        
        // 추가 인자
        if (container.args && container.args.length > 0) {
          command += ` ${container.args.join(' ')}`
        }
        
        await execPromise(command)
        console.log(`컨테이너 ${container.name}이(가) 자동으로 시작되었습니다.`)
      } catch (error) {
        console.error(`컨테이너 ${container.name} 자동 시작 실패:`, error)
      }
    }
  } catch (error) {
    console.error('자동 시작 컨테이너 실행 실패:', error)
  }
}

// Docker 설치 여부 확인
async function checkDockerInstalled(): Promise<boolean> {
  try {
    const execPromise = promisify(exec)
    await execPromise('docker --version')
    return true
  } catch (error) {
    console.error('Docker 설치 확인 실패:', error)
    return false
  }
}

const buildImage = async (container: DockerContainerConfig) => {
  if (!container.buildPath) {
    toast({
      title: t('docker.buildFail'),
      description: '빌드 경로가 지정되지 않았습니다',
      variant: 'destructive'
    })
    return
  }
  
  try {
    dockerStore.loadingStates[container.id] = true
    isBuildInProgress.value = true
    buildProgress.value = [] // 진행 상태 초기화
    
    const imageName = 'deepchat-stt-server:0.0.1'
    const success = await dockerStore.buildImage(container.buildPath, imageName)
    
    if (success) {
      dockerStore.updateContainerConfig(container.id, { image: imageName })
      await refreshData()
    }
  } catch (error) {
    toast({
      title: t('docker.buildFail'),
      description: String(error),
      variant: 'destructive'
    })
  } finally {
    dockerStore.loadingStates[container.id] = false
  }
} 