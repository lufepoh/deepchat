<template>
  <div class="p-4">
    <!-- 새로고침 버튼 -->
    <div class="flex justify-end mb-4">
      <Button variant="outline" :disabled="isLoading" @click="refreshData">
        <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        {{ t('docker.refresh') }}
      </Button>
    </div>

    <!-- 내장 컨테이너 섹션 -->
    <div v-if="dockerStore.enabledBuiltInContainers.length > 0" class="mb-6">
      <h3 class="text-lg font-medium mb-2">내장 컨테이너</h3>
      <div class="grid grid-cols-1 gap-4">
        <div 
          v-for="container in dockerStore.enabledBuiltInContainers" 
          :key="container.id"
          class="border rounded-lg p-4 bg-card"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <span class="text-lg font-medium">{{ container.name }}</span>
              <span 
                v-if="getContainerStatus(container)" 
                class="ml-2 px-2 py-0.5 text-xs rounded-full"
                :class="getContainerStatus(container) === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'"
              >
                {{ getContainerStatus(container) === 'running' ? t('docker.running') : t('docker.stopped') }}
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <!-- 실행 중이면 STOP 버튼 -->
              <Button 
                v-if="getContainerStatus(container) === 'running'" 
                variant="destructive" 
                size="sm"
                :disabled="dockerStore.loadingStates[container.id]"
                @click="stopContainerById(getContainerId(container), container.id)"
              >
                <Icon icon="lucide:stop-circle" class="h-4 w-4 mr-1" />
                {{ t('docker.stopContainer') }}
              </Button>
              
              <!-- 실행 중이 아닐 때: 빌드 or 실행 버튼 + 작은 프로그레스바 -->
              <div class="flex items-center space-x-2">
                <!-- 실시간 로그 텍스트 표시 -->
                <p
                  v-if="dockerStore.loadingStates[container.id] && buildLogMap[container.id]"
                  class="text-xs text-muted-foreground truncate max-w-[200px]"
                >
                  {{ buildLogMap[container.id] }}
                </p>
                <Button 
                  v-if="!isRunning(container)"
                  variant="default" 
                  size="sm"
                  :disabled="dockerStore.loadingStates[container.id]"
                  @click="handleContainerAction(container)"
                >
                  <Icon v-if="shouldBuildImage(container)" icon="lucide:tool" class="h-4 w-4 mr-1" />
                  <Icon v-else icon="lucide:play" class="h-4 w-4 mr-1" />
                  <span v-if="dockerStore.loadingStates[container.id]" class="flex items-center">
                    <Icon icon="lucide:loader-2" class="h-4 w-4 mr-1 animate-spin" />
                    {{ t('docker.buildingImage') }}
                  </span>
                  <span v-else>
                    {{ shouldBuildImage(container) ? t('docker.buildImage') : t('docker.startContainer') }}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <p class="text-sm text-muted-foreground mb-2">{{ container.description || '내장 컨테이너' }}</p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="font-semibold">이미지:</span> {{ container.image }}
            </div>
            <div>
              <span class="font-semibold">포트:</span> {{ container.ports.join(', ') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 사용자 정의 컨테이너 목록 -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-medium">{{ t('docker.containerList') }}</h3>
        <Button @click="openAddDialog" variant="default" size="sm">
          <Icon icon="lucide:plus" class="h-4 w-4 mr-1" />
          {{ t('docker.addContainer') }}
        </Button>
      </div>
      <div v-if="isLoading" class="flex justify-center items-center p-8">
        <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin text-primary" />
      </div>
      <div v-else-if="dockerStore.containerConfigs.length === 0" class="text-center py-8 text-muted-foreground">
        {{ t('docker.noContainersFound') }}
      </div>
      <div v-else class="grid grid-cols-1 gap-4">
        <div 
          v-for="container in dockerStore.containerConfigs" 
          :key="container.id"
          class="border rounded-lg p-4 bg-card"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <span class="text-lg font-medium">{{ container.name }}</span>
              <span 
                v-if="getContainerStatus(container)" 
                class="ml-2 px-2 py-0.5 text-xs rounded-full"
                :class="getContainerStatus(container) === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'"
              >
                {{ getContainerStatus(container) === 'running' ? t('docker.running') : t('docker.stopped') }}
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <!-- 실행 중이면 중지, 아니면 빌드/실행 버튼 -->
              <Button 
                v-if="isRunning(container)" 
                variant="destructive" 
                size="sm"
                :disabled="dockerStore.loadingStates[container.id]"
                @click="stopContainerById(getContainerId(container), container.id)"
              >
                <Icon icon="lucide:stop-circle" class="h-4 w-4 mr-1" />
                {{ t('docker.stopContainer') }}
              </Button>
              <div v-else class="flex items-center space-x-2">
                <Button
                  variant="default"
                  size="sm"
                  :disabled="dockerStore.loadingStates[container.id]"
                  @click="handleContainerAction(container)"
                >
                  <Icon v-if="shouldBuildImage(container)" icon="lucide:tool" class="h-4 w-4 mr-1" />
                  <Icon v-else icon="lucide:play" class="h-4 w-4 mr-1" />
                  <span v-if="dockerStore.loadingStates[container.id]" class="flex items-center">
                    <Icon icon="lucide:loader-2" class="h-4 w-4 mr-1 animate-spin" />
                    {{ t('docker.buildingImage') }}
                  </span>
                  <span v-else>
                    {{ shouldBuildImage(container) ? t('docker.buildImage') : t('docker.startContainer') }}
                  </span>
                </Button>
              </div>
              <!-- 편집/삭제 버튼 -->
              <Button variant="outline" size="sm" @click="openEditDialog(container)">
                <Icon icon="lucide:edit" class="h-4 w-4 mr-1" />
              </Button>
              <Button variant="outline" size="sm" @click="confirmRemoveContainer(container)">
                <Icon icon="lucide:trash" class="h-4 w-4 mr-1" />
              </Button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="font-semibold">이미지:</span> {{ container.image }}
            </div>
            <div>
              <span class="font-semibold">포트:</span> {{ container.ports.join(', ') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 실행 중인 컨테이너 목록 -->
    <div class="mb-6">
      <h3 class="text-lg font-medium mb-2">{{ t('docker.runningContainers') }}</h3>
      <div v-if="isLoading" class="flex justify-center items-center p-8">
        <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin text-primary" />
      </div>
      <div v-else-if="dockerStore.runningContainers.length === 0" class="text-center py-4 text-muted-foreground">
        {{ t('docker.noRunningContainers') }}
      </div>
      <div v-else class="overflow-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4">{{ t('docker.containerName') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.containerImage') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.containerStatus') }}</th>
              <th class="text-left py-2 px-4 w-48">{{ t('docker.containerPorts') }}</th>
              <th class="text-right py-2 px-4 w-32">{{ t('docker.containerActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="container in dockerStore.runningContainers" :key="container.id" class="border-b">
              <td class="py-2 px-4 font-medium">{{ container.name }}</td>
              <td class="py-2 px-4">{{ container.image }}</td>
              <td class="py-2 px-4">
                <span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                  {{ container.status }}
                </span>
              </td>
              <td class="py-2 px-4 text-xs truncate max-w-xs">{{ container.ports }}</td>
              <td class="py-2 px-4 text-right">
                <Button 
                  variant="destructive" 
                  size="sm"
                  @click="stopContainer(container.id)"
                >
                  <Icon icon="lucide:stop-circle" class="h-4 w-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 이미지 목록 -->
    <div>
      <h3 class="text-lg font-medium mb-2">{{ t('docker.imageList') }}</h3>
      <div v-if="isLoading" class="flex justify-center items-center p-8">
        <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin text-primary" />
      </div>
      <div v-else-if="dockerStore.images.length === 0" class="text-center py-4 text-muted-foreground">
        {{ t('docker.noImagesFound') }}
      </div>
      <div v-else class="overflow-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4">{{ t('docker.imageName') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.imageTag') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.imageId') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.imageSize') }}</th>
              <th class="text-left py-2 px-4">{{ t('docker.imageCreatedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="image in dockerStore.images" :key="image.id" class="border-b">
              <td class="py-2 px-4 font-medium">{{ image.name }}</td>
              <td class="py-2 px-4">{{ image.tag }}</td>
              <td class="py-2 px-4">{{ image.id }}</td>
              <td class="py-2 px-4">{{ image.size }}</td>
              <td class="py-2 px-4">{{ image.createdAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 컨테이너 추가 다이얼로그 -->
    <Dialog v-model:open="isAddContainerDialogOpen">
      <DialogContent class="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{{ t('docker.addContainerDialog.title') }}</DialogTitle>
        </DialogHeader>
        <DockerContainerForm @submit="handleAddComplete" @cancel="isAddContainerDialogOpen = false" />
      </DialogContent>
    </Dialog>

    <!-- 컨테이너 편집 다이얼로그 -->
    <Dialog v-model:open="isEditContainerDialogOpen">
      <DialogContent class="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{{ t('docker.editContainerDialog.title') }}</DialogTitle>
        </DialogHeader>
        <DockerContainerForm 
          v-if="editingContainerId"
          :container-config="getContainerConfig(editingContainerId)"
          @submit="handleEditComplete" 
          @cancel="isEditContainerDialogOpen = false" 
        />
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useDockerStore, type DockerContainerConfig } from '@/stores/dockerStore'
import DockerContainerForm from './DockerContainerForm.vue'

const { t } = useI18n()
const dockerStore = useDockerStore()
const { toast } = useToast()

// 다이얼로그 상태
const isAddContainerDialogOpen = ref(false)
const isEditContainerDialogOpen = ref(false)
const editingContainerId = ref<string | null>(null)
const isLoading = ref(false)

// 빌드 진행률: containerId -> 0~100
const buildLogMap = ref<Record<string, string>>({})

// 빌드 작업 중인 컨테이너 ID
const lastBuildingContainerId = ref<string | null>(null)

onMounted(async () => {
  await refreshData()
  initIpcListeners()
})

// IPC 이벤트 리스너 (spawn stdout/stderr)
function initIpcListeners() {
  window.electron.ipcRenderer.on('docker:build-progress', (_, data: string) => {
    const line = data.trim().split('\n').pop() ?? ''
    const id = lastBuildingContainerId.value
    if (id) {
      buildLogMap.value[id] = line
    }
  })

  window.electron.ipcRenderer.on('docker:build-complete', (_, result) => {
    const id = lastBuildingContainerId.value
    if (id) {
      delete buildLogMap.value[id]
    }
  })
}

// 새로고침
async function refreshData() {
  isLoading.value = true
  await Promise.all([
    dockerStore.fetchImages(),
    dockerStore.fetchContainers(),
    dockerStore.loadConfig()
  ])
  isLoading.value = false
}

// 다이얼로그 열기
function openAddDialog() {
  isAddContainerDialogOpen.value = true
}
function openEditDialog(container: DockerContainerConfig) {
  editingContainerId.value = container.id
  isEditContainerDialogOpen.value = true
}

// 컨테이너 설정 가져오기
function getContainerConfig(id: string | null) {
  if (!id) return undefined
  return dockerStore.containerConfigs.find(c => c.id === id)
}
function confirmRemoveContainer(container: DockerContainerConfig) {
  if (confirm(t('docker.confirmRemoveContainer'))) {
    dockerStore.removeContainerConfig(container.id)
  }
}

// 상태 helpers
function getContainerStatus(config: DockerContainerConfig) {
  const c = dockerStore.containers.find(cc => cc.name === config.name)
  return c ? (c.isRunning ? 'running' : 'stopped') : null
}
function isRunning(config: DockerContainerConfig) {
  return getContainerStatus(config) === 'running'
}
function getContainerId(config: DockerContainerConfig) {
  const c = dockerStore.containers.find(cc => cc.name === config.name)
  return c?.id
}

// 컨테이너 run / stop
async function runContainer(configId: string) {
  await dockerStore.runContainer(configId)
}
async function stopContainerById(containerId: string | undefined, configId: string) {
  if (containerId) {
    await dockerStore.stopContainer(containerId, configId)
  }
}
async function stopContainer(containerId: string) {
  const running = dockerStore.containers.find(c => c.id === containerId)
  if (running) {
    const conf = dockerStore.allContainerConfigs.find(cc => cc.name === running.name)
    if (conf) {
      await dockerStore.stopContainer(containerId, conf.id)
    }
  }
}

// 편집/추가 완료
async function handleEditComplete() {
  isEditContainerDialogOpen.value = false
  editingContainerId.value = null
  await dockerStore.fetchContainers()
}
async function handleAddComplete() {
  isAddContainerDialogOpen.value = false
  await dockerStore.fetchContainers()
}

// 빌드 필요 여부
function shouldBuildImage(container: DockerContainerConfig) {
  if (container.image.startsWith('deepchat-stt-server:')) {
    const baseName = container.image.split(':')[0]
    return !dockerStore.images.some(img => img.name === baseName || img.name.startsWith(`${baseName}:`))
  }
  return false
}

// 빌드 or 실행
function handleContainerAction(container: DockerContainerConfig) {
  if (shouldBuildImage(container)) {
    buildImage(container)
  } else {
    runContainer(container.id)
  }
}

// 빌드 실행
async function buildImage(container: DockerContainerConfig) {
  if (!container.buildPath) {
    toast({ title: t('docker.buildFail'), description: '빌드 경로가 지정되지 않았습니다.', variant: 'destructive' })
    return
  }
  try {
    dockerStore.loadingStates[container.id] = true
    lastBuildingContainerId.value = container.id
    // buildProgressMap.value[container.id] = 0

    const imageName = container.image
    const resp = await dockerStore.buildImage(container.buildPath, imageName)
    if (resp && resp.success) {
      // 빌드 완료 후 이미지 목록 갱신
      dockerStore.updateContainerConfig(container.id, { image: imageName })
      await dockerStore.fetchImages()
    } else {
      toast({
        title: t('docker.buildFail'),
        description: resp?.error || '이미지 빌드에 실패했습니다.',
        variant: 'destructive'
      })
      dockerStore.loadingStates[container.id] = false
      lastBuildingContainerId.value = null
      // delete buildProgressMap.value[container.id]
    }
  } catch (err) {
    console.error(err)
    toast({ title: t('docker.buildFail'), description: String(err), variant: 'destructive' })
    dockerStore.loadingStates[container.id] = false
    lastBuildingContainerId.value = null
    // delete buildProgressMap.value[container.id]
  }
}
</script>

<style scoped>
/* 필요에 따라 스타일을 추가하거나 조정하세요. */
</style>
