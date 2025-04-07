<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 p-4 space-y-4">
      <!-- 상단 헤더 -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">음성 채팅</h2>
        <div class="flex items-center space-x-2">
          <Button
            :variant="isListening ? 'destructive' : 'default'"
            @click="toggleListening"
            :disabled="!isMicAvailable || !isServerReady"
          >
            <Icon
              :icon="isListening ? 'lucide:mic-off' : 'lucide:mic'"
              class="w-4 h-4 mr-2"
            />
            {{ isListening ? '음성 인식 중지' : '음성 인식 시작' }}
          </Button>
        </div>
      </div>

      <!-- 서버 상태 표시 -->
      <div v-if="!isServerReady" class="bg-warning/10 text-warning rounded-lg p-4">
        <div class="flex items-center">
          <Icon icon="lucide:alert-triangle" class="w-5 h-5 mr-2" />
          <p>음성 인식 서버가 준비되지 않았습니다. 서버 상태를 확인해주세요.</p>
        </div>
      </div>

      <!-- 마이크 상태 표시 -->
      <div v-if="!isMicAvailable" class="bg-destructive/10 text-destructive rounded-lg p-4">
        <div class="flex items-center">
          <Icon icon="lucide:alert-circle" class="w-5 h-5 mr-2" />
          <p>마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.</p>
        </div>
      </div>

      <!-- 오디오 시각화 -->
      <div class="bg-muted rounded-lg p-4">
        <canvas
          ref="canvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
          class="w-full"
        ></canvas>
      </div>

      <!-- 음성 인식 결과 -->
      <div v-if="transcription" class="bg-muted rounded-lg p-4">
        <p class="text-sm">{{ transcription }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/button/Button.vue'
import { useMcpStore } from '@/stores/mcp'

const isListening = ref(false)
const isMicAvailable = ref(false)
const isServerReady = ref(false)
const transcription = ref('')

// 오디오 처리 관련 변수
const audioContext = ref<AudioContext | null>(null)
const audioSource = ref<MediaStreamAudioSourceNode | null>(null)
const audioWorkletNode = ref<AudioWorkletNode | null>(null)
const audioStream = ref<MediaStream | null>(null)

// 오디오 시각화를 위한 캔버스 관련 변수
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasCtx = ref<CanvasRenderingContext2D | null>(null)
const canvasWidth = 600
const canvasHeight = 200

const mcpStore = useMcpStore()

// MCP 서버 상태 감시
watch(() => mcpStore.serverStatuses['voice-server'], (status) => {
  isServerReady.value = !!status
})

const checkMicrophonePermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    isMicAvailable.value = true
  } catch (error) {
    console.error('마이크 권한 오류:', error)
    isMicAvailable.value = false
  }
}

const initAudioContext = async () => {
  try {
    audioContext.value = new AudioContext()
    
    // AudioWorklet 코드를 Blob으로 변환하여 URL 생성
    const workletCode = `
      class AudioProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0]
          if (!input || !input[0]) return true
      
          // 입력 데이터를 16비트 PCM으로 변환
          const pcmData = new Int16Array(input[0].length)
          for (let i = 0; i < input[0].length; i++) {
            const s = Math.max(-1, Math.min(1, input[0][i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
      
          // 메인 스레드로 PCM 데이터 전송
          this.port.postMessage({
            pcmData: pcmData,
            timeStamp: currentFrame
          })
      
          return true
        }
      }
      
      registerProcessor('audio-processor', AudioProcessor)
    `
    const blob = new Blob([workletCode], { type: 'application/javascript' })
    const workletUrl = URL.createObjectURL(blob)

    // AudioWorklet 프로세서 로드
    await audioContext.value.audioWorklet.addModule(workletUrl)
    
    // Blob URL 정리
    URL.revokeObjectURL(workletUrl)
    
    return true
  } catch (error) {
    console.error('AudioContext 초기화 오류:', error)
    return false
  }
}

const startListening = async () => {
  try {
    if (!audioContext.value) {
      if (!await initAudioContext()) return
    }

    if (!audioContext.value) {
      throw new Error('AudioContext 초기화 실패')
    }

    await checkMicrophonePermission()
    if (!isMicAvailable.value) {
      console.error('마이크를 사용할 수 없습니다')
      return
    }

    audioStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioSource.value = audioContext.value.createMediaStreamSource(audioStream.value)
    
    // AudioWorkletNode 생성
    audioWorkletNode.value = new AudioWorkletNode(audioContext.value, 'audio-processor')

    // PCM 데이터 수신 처리
    audioWorkletNode.value.port.onmessage = (event) => {
      const { pcmData: newPcmData } = event.data
      
      // 시각화
      drawWaveform(newPcmData)
      
      // MCP 서버로 전송
      if (mcpStore.mcpEnabled) {
        sendAudioToMCP()
      }
    }

    // 오디오 노드 연결
    audioSource.value
      .connect(audioWorkletNode.value)
      .connect(audioContext.value.destination)

    isListening.value = true
  } catch (error) {
    console.error('오디오 스트림 시작 오류:', error)
    stopListening()
  }
}

const stopListening = () => {
  try {
    audioWorkletNode.value?.disconnect()
    audioSource.value?.disconnect()
    audioStream.value?.getTracks().forEach(track => track.stop())
    
    audioWorkletNode.value = null
    audioSource.value = null
    audioStream.value = null
    
    isListening.value = false
    
    // 캔버스 초기화
    if (canvasCtx.value) {
      canvasCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
    }
  } catch (error) {
    console.error('오디오 스트림 중지 오류:', error)
  }
}

const toggleListening = async () => {
  if (isListening.value) {
    stopListening()
  } else {
    await startListening()
  }
}

const drawWaveform = (audioBuffer: Int16Array) => {
  if (!canvasCtx.value || !canvasRef.value) return

  canvasCtx.value.fillStyle = 'rgb(200, 200, 200)'
  canvasCtx.value.fillRect(0, 0, canvasWidth, canvasHeight)

  canvasCtx.value.lineWidth = 2
  canvasCtx.value.strokeStyle = 'rgb(0, 0, 0)'
  canvasCtx.value.beginPath()

  const sliceWidth = canvasWidth / audioBuffer.length
  let x = 0

  for (let i = 0; i < audioBuffer.length; i++) {
    // PCM 값을 -1 ~ 1 범위로 정규화
    const v = audioBuffer[i] / 0x8000
    const y = (v * canvasHeight / 2) + canvasHeight / 2

    if (i === 0) {
      canvasCtx.value.moveTo(x, y)
    } else {
      canvasCtx.value.lineTo(x, y)
    }

    x += sliceWidth
  }

  canvasCtx.value.lineTo(canvasWidth, canvasHeight / 2)
  canvasCtx.value.stroke()
}

const sendAudioToMCP = async () => {
  if (!mcpStore.mcpEnabled || !isServerReady.value) return

  try {
    const result = await mcpStore.callTool('processAudio')
    if (result && typeof result === 'object' && 'content' in result) {
      try {
        const response = JSON.parse(result.content)
        if (response.type === 'realtime') {
          transcription.value = response.text
        }
      } catch (e) {
        console.error('음성 인식 결과 파싱 실패:', e)
      }
    }
  } catch (error) {
    console.error('MCP 도구 호출 실패:', error)
  }
}

onMounted(async () => {
  checkMicrophonePermission()
  
  // 캔버스 초기화
  if (canvasRef.value) {
    canvasCtx.value = canvasRef.value.getContext('2d')
    if (canvasCtx.value) {
      canvasCtx.value.fillStyle = 'rgb(200, 200, 200)'
      canvasCtx.value.fillRect(0, 0, canvasWidth, canvasHeight)
    }
  }

  // MCP 서버 상태 초기화
  isServerReady.value = !!mcpStore.serverStatuses['voice-server']
})

onUnmounted(() => {
  stopListening()
  audioContext.value?.close()
})
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style> 