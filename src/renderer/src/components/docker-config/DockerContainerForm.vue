<template>
  <div class="flex-1 overflow-y-auto p-4">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="grid gap-4">
        <!-- 이름 -->
        <div class="grid gap-2">
          <Label for="name">{{ t('settings.docker.containerName') }}</Label>
          <Input
            id="name"
            v-model="formData.name"
            :placeholder="t('settings.docker.containerNamePlaceholder')"
            required
          />
        </div>

        <!-- 이미지 -->
        <div class="grid gap-2">
          <Label for="image">{{ t('settings.docker.containerImage') }}</Label>
          <Input
            id="image"
            v-model="formData.image"
            :placeholder="t('settings.docker.containerImagePlaceholder')"
            required
          />
        </div>

        <!-- 포트 매핑 -->
        <div class="grid gap-2">
          <Label>{{ t('settings.docker.containerPorts') }}</Label>
          <div v-for="(port, index) in formData.ports" :key="`port-${index}`" class="flex gap-2">
            <Input
              v-model="formData.ports[index]"
              :placeholder="t('settings.docker.containerPortsPlaceholder')"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              @click="removePort(index)"
              class="h-9 w-9 shrink-0"
            >
              <Icon icon="lucide:x" class="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            @click="addPort"
            class="mt-2"
          >
            <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t('settings.docker.addPort') }}
          </Button>
        </div>

        <!-- 볼륨 마운트 -->
        <div class="grid gap-2">
          <Label>{{ t('settings.docker.containerVolumes') }}</Label>
          <div
            v-for="(volume, index) in formData.volumes"
            :key="`volume-${index}`"
            class="flex gap-2"
          >
            <Input
              v-model="formData.volumes[index]"
              :placeholder="t('settings.docker.containerVolumesPlaceholder')"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              @click="removeVolume(index)"
              class="h-9 w-9 shrink-0"
            >
              <Icon icon="lucide:x" class="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" @click="addVolume" class="mt-2">
            <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t('settings.docker.addVolume') }}
          </Button>
        </div>

        <!-- 환경 변수 -->
        <div class="grid gap-2">
          <Label>{{ t('settings.docker.containerEnv') }}</Label>
          <div v-for="(env, index) in formData.env" :key="`env-${index}`" class="flex gap-2">
            <Input
              v-model="formData.env[index]"
              :placeholder="t('settings.docker.containerEnvPlaceholder')"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              @click="removeEnv(index)"
              class="h-9 w-9 shrink-0"
            >
              <Icon icon="lucide:x" class="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" @click="addEnv" class="mt-2">
            <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t('settings.docker.addEnv') }}
          </Button>
        </div>

        <!-- 명령어 인자 -->
        <div class="grid gap-2">
          <Label>{{ t('settings.docker.containerArgs') }}</Label>
          <div v-for="(arg, index) in formData.args" :key="`arg-${index}`" class="flex gap-2">
            <Input
              v-model="formData.args[index]"
              :placeholder="t('settings.docker.containerArgsPlaceholder')"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              @click="removeArg(index)"
              class="h-9 w-9 shrink-0"
            >
              <Icon icon="lucide:x" class="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" @click="addArg" class="mt-2">
            <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t('settings.docker.addArg') }}
          </Button>
        </div>

        <!-- 작업 디렉토리 -->
        <div class="grid gap-2">
          <Label for="workingDir">{{ t('settings.docker.containerWorkingDir') }}</Label>
          <Input
            id="workingDir"
            v-model="formData.workingDir"
            :placeholder="t('settings.docker.containerWorkingDirPlaceholder')"
          />
        </div>

        <!-- 자동 시작 설정 -->
        <div class="flex items-center space-x-2">
          <Checkbox id="autoStart" v-model:checked="formData.autoStart" />
          <Label for="autoStart">{{ t('settings.docker.containerAutoStart') }}</Label>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="$emit('cancel')">
          {{ t('common.cancel') }}
        </Button>
        <Button type="submit">{{ t('common.save') }}</Button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { type DockerContainerConfig } from '@/stores/dockerStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

const { t } = useI18n()

const props = defineProps<{
  containerConfig?: DockerContainerConfig
}>()

const emit = defineEmits<{
  (e: 'submit', config: Omit<DockerContainerConfig, 'id'>): void
  (e: 'cancel'): void
}>()

// 폼 데이터 초기화
const formData = ref<Omit<DockerContainerConfig, 'id'>>({
  name: '',
  image: '',
  args: [],
  ports: [],
  volumes: [],
  env: [],
  enabled: true,
  autoStart: false,
  workingDir: ''
})

onMounted(() => {
  // 기존 설정이 있으면 로드
  if (props.containerConfig) {
    formData.value = {
      name: props.containerConfig.name,
      image: props.containerConfig.image,
      args: [...props.containerConfig.args],
      ports: [...props.containerConfig.ports],
      volumes: [...props.containerConfig.volumes],
      env: [...props.containerConfig.env],
      enabled: props.containerConfig.enabled,
      autoStart: props.containerConfig.autoStart,
      workingDir: props.containerConfig.workingDir || ''
    }
  }
})

// 포트 추가
const addPort = () => {
  formData.value.ports.push('')
}

// 포트 제거
const removePort = (index: number) => {
  formData.value.ports.splice(index, 1)
}

// 볼륨 추가
const addVolume = () => {
  formData.value.volumes.push('')
}

// 볼륨 제거
const removeVolume = (index: number) => {
  formData.value.volumes.splice(index, 1)
}

// 환경 변수 추가
const addEnv = () => {
  formData.value.env.push('')
}

// 환경 변수 제거
const removeEnv = (index: number) => {
  formData.value.env.splice(index, 1)
}

// 인자 추가
const addArg = () => {
  formData.value.args.push('')
}

// 인자 제거
const removeArg = (index: number) => {
  formData.value.args.splice(index, 1)
}

// 폼 제출 처리
const handleSubmit = () => {
  // 빈 항목 필터링
  const config = {
    ...formData.value,
    args: formData.value.args.filter(Boolean),
    ports: formData.value.ports.filter(Boolean),
    volumes: formData.value.volumes.filter(Boolean),
    env: formData.value.env.filter(Boolean)
  }
  
  emit('submit', config)
}
</script> 