<template>
  <div class="w-full h-full overflow-y-auto flex flex-col">
    <!-- Docker 설치되지 않은 경우 안내 메시지 -->
    <div v-if="!isDockerInstalled && !isCheckingDocker" class="p-4 text-center flex flex-col items-center justify-center">
      <div class="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-6 max-w-xl mx-auto">
        <Icon icon="lucide:alert-triangle" class="h-10 w-10 text-yellow-500 mx-auto mb-4" />
        <h3 class="text-lg font-medium mb-2">{{ t('docker.notInstalled') }}</h3>
        <p class="text-sm text-muted-foreground mb-4">
          {{ t('docker.installDescription') }}
        </p>
        <div class="flex gap-2 justify-center">
          <Button @click="openDockerWebsite">
            <Icon icon="lucide:download" class="mr-2 h-4 w-4" />
            {{ t('docker.downloadDocker') }}
          </Button>
          <Button variant="outline" @click="checkDockerInstallation">
            <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" />
            {{ t('docker.checkAgain') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Docker 설치 확인 중인 경우 로딩 표시 -->
    <div v-else-if="isCheckingDocker" class="p-4 text-center">
      <div class="flex flex-col items-center justify-center p-6">
        <Icon icon="lucide:loader-2" class="h-10 w-10 animate-spin mb-4" />
        <p class="text-sm text-muted-foreground">
          {{ t('docker.checkingInstallation') }}
        </p>
      </div>
    </div>

    <!-- Docker 설치된 경우 설정 표시 -->
    <template v-else>
      <!-- Docker 전역 설정 -->
      <div class="p-4 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-medium">{{ t('docker.enabledTitle') }}</h3>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('docker.enabledDescription') }}
            </p>
          </div>
          <div class="flex items-center">
            <div v-if="isToggling" class="mr-2">
              <Icon icon="lucide:loader-2" class="h-4 w-4 animate-spin" />
            </div>
            <Switch 
              :checked="dockerEnabled" 
              :disabled="isToggling || dockerStore.isLoading"
              @update:checked="handleDockerEnabledChange" 
            />
          </div>
        </div>
      </div>

      <!-- Docker 설정 -->
      <div v-if="dockerEnabled" class="border-t flex-grow">
        <DockerConfig />
      </div>
      <div v-else class="p-4 text-center text-secondary-foreground text-sm">
        {{ t('docker.enableToAccess') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref, onMounted } from 'vue'
import DockerConfig from '@/components/docker-config/DockerConfig.vue'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useDockerStore } from '@/stores/dockerStore'
import { Icon } from '@iconify/vue'
import { useToast } from '@/components/ui/toast'

const { t } = useI18n()
const dockerStore = useDockerStore()
const { toast } = useToast()
const isToggling = ref(false)
const isDockerInstalled = ref(true)
const isCheckingDocker = ref(true)

// 계산 속성
const dockerEnabled = computed(() => dockerStore.isEnabled)

// 컴포넌트 마운트 시 Docker 설치 확인
onMounted(async () => {
  await checkDockerInstallation()
})

// Docker 설치 여부 확인
const checkDockerInstallation = async () => {
  try {
    isCheckingDocker.value = true
    const response = await window.electron.ipcRenderer.invoke('docker:check')
    isDockerInstalled.value = response.success && response.isInstalled
  } catch (error) {
    isDockerInstalled.value = false
    console.error('Docker 설치 확인 실패:', error)
  } finally {
    isCheckingDocker.value = false
  }
}

// Docker Desktop 웹사이트 열기
const openDockerWebsite = () => {
  window.electron.ipcRenderer.invoke('open-external-link', 'https://www.docker.com/products/docker-desktop')
}

// Docker 활성화 변경 핸들러
const handleDockerEnabledChange = async (enabled: boolean) => {
  try {
    isToggling.value = true
    const success = await dockerStore.setEnabled(enabled)
    
    if (!success) {
      toast({
        title: t('common.error.operationFailed'),
        description: dockerStore.errorMessage || t('docker.enableToggleError'),
        variant: 'destructive'
      })
    }
  } catch (error) {
    toast({
      title: t('common.error.operationFailed'),
      description: String(error),
      variant: 'destructive'
    })
  } finally {
    isToggling.value = false
  }
}
</script> 