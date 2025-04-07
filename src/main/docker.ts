import { exec } from 'child_process'
import { promisify } from 'util'
import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// Docker 관련 이벤트
export const DOCKER_EVENTS = {
  LIST_IMAGES: 'docker:list-images',
  LIST_CONTAINERS: 'docker:list-containers',
  RUN_CONTAINER: 'docker:run-container',
  STOP_CONTAINER: 'docker:stop-container',
  REMOVE_CONTAINER: 'docker:remove-container',
  SAVE_CONFIG: 'docker:save-config',
  LOAD_CONFIG: 'docker:load-config',
  PULL_IMAGE: 'docker:pull-image'
}

// Docker 설정 타입
export interface DockerConfig {
  containers: DockerContainerConfig[]
  enabledByDefault: boolean
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

// 기본 Docker 설정
const defaultConfig: DockerConfig = {
  containers: [],
  enabledByDefault: false
}

// Docker 설정 파일 경로
let configPath = ''

// Docker 설정 초기화
export function initDocker() {
  configPath = path.join(app.getPath('userData'), 'docker-config.json')
  
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
  
  // Docker 설정 저장
  ipcMain.handle(DOCKER_EVENTS.SAVE_CONFIG, async (_, config: DockerConfig) => {
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      return { success: true }
    } catch (error) {
      console.error('Docker 설정 저장 실패:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // Docker 설정 불러오기
  ipcMain.handle(DOCKER_EVENTS.LOAD_CONFIG, async () => {
    try {
      if (!fs.existsSync(configPath)) {
        return { success: true, config: defaultConfig }
      }
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return { success: true, config }
    } catch (error) {
      console.error('Docker 설정 불러오기 실패:', error)
      return { success: true, config: defaultConfig }
    }
  })
} 