export interface ContainerConfig {
  id: string
  name: string
  image: string
  args?: string[]
  ports?: string[]
  volumes?: string[]
  env?: string[]
  enabled?: boolean
  autoStart?: boolean
  autoRemove?: boolean
  restart?: string
  workingDir?: string
  isBuiltIn?: boolean
  buildPath?: string
  description?: string
} 