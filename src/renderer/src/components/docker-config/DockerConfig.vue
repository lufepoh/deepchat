<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium">{{ t('settings.docker.title') }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t('settings.docker.description') }}
        </p>
      </div>
      <Switch
        :checked="dockerStore.isEnabled"
        @update:checked="toggleEnabled"
      />
    </div>

    <div class="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg">
      <p class="text-yellow-800 dark:text-yellow-200">
        Docker 기능이 아직 준비 중입니다. 다음 업데이트에서 사용 가능해질 예정입니다.
      </p>
    </div>

    <template v-if="dockerStore.isEnabled">
      <div class="flex items-center justify-between mt-4">
        <h4 class="text-md font-medium">{{ t('settings.docker.containerList') }}</h4>
        <Button variant="outline" size="sm" @click="openAddContainerDialog">
          <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
          {{ t('settings.docker.addContainer') }}
        </Button>
      </div>

      <div v-if="dockerStore.isLoading" class="flex justify-center py-8">
        <Icon icon="lucide:loader" class="h-8 w-8 animate-spin" />
      </div>

      <div
        v-else-if="dockerStore.containerConfigs.length === 0"
        class="text-center py-8 text-muted-foreground text-lg"
      >
        {{ t('settings.docker.noContainersFound') }}
      </div>

      <div v-else class="grid gap-4">
        <div
          v-for="config in dockerStore.containerConfigs"
          :key="config.id"
          class="border rounded-lg overflow-hidden"
        >
          <div class="bg-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-medium flex items-center">
                  <span
                    class="w-2 h-2 rounded-full mr-2"
                    :class="getContainerStatusColor(config.id)"
                  ></span>
                  {{ config.name }}
                </h4>
                <p class="text-sm text-muted-foreground">{{ config.image }}</p>
              </div>
              <div class="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="dockerStore.isLoading"
                        @click="toggleContainer(config.id)"
                      >
                        <Icon
                          v-if="dockerStore.loadingStates[config.id]"
                          icon="lucide:loader"
                          class="h-4 w-4 animate-spin"
                        />
                        <Icon
                          v-else
                          :icon="isContainerRunning(config.id) ? 'lucide:square' : 'lucide:play'"
                          class="h-4 w-4"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {{
                          isContainerRunning(config.id)
                            ? t('settings.docker.stopContainer')
                            : t('settings.docker.startContainer')
                        }}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="dockerStore.isLoading"
                        @click="openEditContainerDialog(config.id)"
                      >
                        <Icon icon="lucide:edit" class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t('settings.docker.editContainer') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="dockerStore.isLoading"
                        @click="removeContainerConfig(config.id)"
                      >
                        <Icon icon="lucide:trash" class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t('settings.docker.removeContainer') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          <div class="bg-muted dark:bg-zinc-800 px-4 py-2">
            <div class="flex justify-between items-center">
              <div class="text-xs font-mono overflow-x-auto whitespace-nowrap">
                {{ getContainerCommand(config) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 이미지 섹션 -->
      <div class="flex items-center justify-between mt-6">
        <h4 class="text-md font-medium">{{ t('settings.docker.imageList') }}</h4>
        <Button variant="outline" size="sm" @click="dockerStore.fetchImages">
          <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          {{ t('settings.docker.refresh') }}
        </Button>
      </div>

      <div v-if="dockerStore.isLoading" class="flex justify-center py-8">
        <Icon icon="lucide:loader" class="h-8 w-8 animate-spin" />
      </div>

      <div
        v-else-if="dockerStore.images.length === 0"
        class="text-center py-8 text-muted-foreground text-lg"
      >
        {{ t('settings.docker.noImagesFound') }}
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4">{{ t('settings.docker.imageName') }}</th>
              <th class="text-left py-2 px-4">{{ t('settings.docker.imageTag') }}</th>
              <th class="text-left py-2 px-4">{{ t('settings.docker.imageId') }}</th>
              <th class="text-left py-2 px-4">{{ t('settings.docker.imageSize') }}</th>
              <th class="text-left py-2 px-4">{{ t('settings.docker.imageCreatedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="image in dockerStore.images" :key="image.id" class="border-b">
              <td class="py-2 px-4">{{ image.name }}</td>
              <td class="py-2 px-4">{{ image.tag }}</td>
              <td class="py-2 px-4">{{ image.id }}</td>
              <td class="py-2 px-4">{{ image.size }}</td>
              <td class="py-2 px-4">{{ image.createdAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <!-- 컨테이너 추가 다이얼로그 -->
  <Dialog v-model:open="isAddContainerDialogOpen">
    <DialogContent class="w-[640px] px-0 h-[80vh] flex flex-col">
      <DialogHeader class="px-4 flex-shrink-0">
        <DialogTitle>{{ t('settings.docker.addContainerDialog.title') }}</DialogTitle>
      </DialogHeader>
      <DockerContainerForm @submit="handleAddContainer" />
    </DialogContent>
  </Dialog>

  <!-- 컨테이너 편집 다이얼로그 -->
  <Dialog v-model:open="isEditContainerDialogOpen">
    <DialogContent class="w-[640px] px-0 h-[80vh] flex flex-col">
      <DialogHeader class="px-4 flex-shrink-0">
        <DialogTitle>{{ t('settings.docker.editContainerDialog.title') }}</DialogTitle>
      </DialogHeader>
      <DockerContainerForm
        v-if="editingContainerId"
        :container-config="getConfigById(editingContainerId)"
        @submit="handleEditContainer"
      />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useDockerStore, type DockerContainerConfig } from '@/stores/dockerStore'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import DockerContainerForm from './DockerContainerForm.vue'

const { t } = useI18n()
const dockerStore = useDockerStore()

// 다이얼로그 상태
const isAddContainerDialogOpen = ref(false)
const isEditContainerDialogOpen = ref(false)
const editingContainerId = ref<string | null>(null)

onMounted(async () => {
  await dockerStore.init()
})

// Docker 활성화 토글
const toggleEnabled = (value: boolean) => {
  dockerStore.setEnabled(value)
  
  if (value) {
    dockerStore.fetchImages()
    dockerStore.fetchContainers()
  }
}

// 컨테이너 추가 다이얼로그 열기
const openAddContainerDialog = () => {
  isAddContainerDialogOpen.value = true
}

// 컨테이너 편집 다이얼로그 열기
const openEditContainerDialog = (id: string) => {
  editingContainerId.value = id
  isEditContainerDialogOpen.value = true
}

// 컨테이너 추가 처리
const handleAddContainer = (config: Omit<DockerContainerConfig, 'id'>) => {
  dockerStore.addContainerConfig(config)
  isAddContainerDialogOpen.value = false
}

// 컨테이너 편집 처리
const handleEditContainer = (config: Partial<DockerContainerConfig>) => {
  if (editingContainerId.value) {
    dockerStore.updateContainerConfig(editingContainerId.value, config)
    isEditContainerDialogOpen.value = false
    editingContainerId.value = null
  }
}

// 컨테이너 설정 제거
const removeContainerConfig = (id: string) => {
  if (confirm(t('settings.docker.confirmRemoveContainer'))) {
    dockerStore.removeContainerConfig(id)
  }
}

// ID로 컨테이너 설정 가져오기
const getConfigById = (id: string) => {
  return dockerStore.containerConfigs.find(c => c.id === id)
}

// 컨테이너 실행 상태 확인
const isContainerRunning = (configId: string) => {
  const config = dockerStore.containerConfigs.find(c => c.id === configId)
  if (!config) return false
  
  return dockerStore.containers.some(
    c => c.name === config.name && c.isRunning
  )
}

// 컨테이너 상태 색상 가져오기
const getContainerStatusColor = (configId: string) => {
  if (isContainerRunning(configId)) {
    return 'bg-green-500'
  }
  return 'bg-red-500'
}

// 컨테이너 토글 (실행/중지)
const toggleContainer = async (configId: string) => {
  const config = dockerStore.containerConfigs.find(c => c.id === configId)
  if (!config) return
  
  const runningContainer = dockerStore.containers.find(
    c => c.name === config.name && c.isRunning
  )
  
  if (runningContainer) {
    // 컨테이너 중지
    await dockerStore.stopContainer(runningContainer.id, configId)
  } else {
    // 컨테이너 실행
    await dockerStore.runContainer(configId)
  }
}

// 컨테이너 명령어 생성
const getContainerCommand = (config: DockerContainerConfig) => {
  let command = 'docker run -d'
  
  if (config.name) {
    command += ` --name ${config.name}`
  }
  
  if (config.ports.length > 0) {
    config.ports.forEach(port => {
      command += ` -p ${port}`
    })
  }
  
  if (config.volumes.length > 0) {
    config.volumes.forEach(volume => {
      command += ` -v ${volume}`
    })
  }
  
  if (config.env.length > 0) {
    config.env.forEach(env => {
      command += ` -e ${env}`
    })
  }
  
  if (config.workingDir) {
    command += ` -w ${config.workingDir}`
  }
  
  command += ` ${config.image}`
  
  if (config.args.length > 0) {
    command += ` ${config.args.join(' ')}`
  }
  
  return command
}
</script> 