declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor
  new (): AudioWorkletProcessor
}
declare var registerProcessor: (name: string, processorCtor: typeof AudioWorkletProcessor) => void

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
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