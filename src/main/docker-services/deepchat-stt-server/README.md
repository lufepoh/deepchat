# Real-time Speech-to-Text MCP Server

실시간 음성 인식을 위한 MCP 서버입니다. WebSocket을 통해 오디오 데이터를 받아 실시간으로 텍스트로 변환합니다.

## 기능

- 실시간 음성 인식
- WebSocket 기반 통신
- 환경 변수를 통한 설정 관리
- 리소스 사용량 모니터링
- Docker 지원

## 설치

### 요구사항

- Python 3.8 이상
- CUDA 지원 GPU (선택사항)
- Docker (선택사항)

### Docker를 통한 설치

```bash
docker build -t stt-server .
docker run -d --gpus all -p 8011:8011 -p 8012:8012 stt-server
```

### 직접 설치

```bash
pip install -r requirements.txt
python stt_server.py
```

## 설정

### 환경 변수

다음 환경 변수를 통해 서버를 설정할 수 있습니다:

- `CONTROL_PORT`: 제어 WebSocket 포트 (기본값: 8011)
- `DATA_PORT`: 데이터 WebSocket 포트 (기본값: 8012)
- `MODEL`: 사용할 STT 모델 (기본값: large-v2)
- `REALTIME_MODEL`: 실시간 변환용 모델 (기본값: tiny.en)
- `LANGUAGE`: 음성 인식 언어 (기본값: en)
- `BATCH_SIZE`: 배치 크기 (기본값: 16)
- `DEBUG`: 디버그 모드 (기본값: False)
- `LOG_LEVEL`: 로그 레벨 (기본값: WARNING)
- `MEMORY_LIMIT`: 메모리 제한 (기본값: 4g)
- `CPU_LIMIT`: CPU 제한 (기본값: 2)

## API

### WebSocket 연결

- 제어 WebSocket: `ws://localhost:8011`
- 데이터 WebSocket: `ws://localhost:8012`

### MCP API

#### processAudio

오디오 데이터를 처리하고 텍스트로 변환합니다.

**요청:**
```json
{
    "id": "request-id",
    "function": {
        "name": "processAudio",
        "arguments": {
            "pcmData": [0, 1, 2, ...],
            "sampleRate": 16000
        }
    }
}
```

**응답:**
```json
{
    "toolCallId": "request-id",
    "content": {
        "type": "realtime",
        "text": "인식된 텍스트"
    }
}
```

## 모니터링

서버는 다음 메트릭을 수집합니다:

- CPU 사용률
- 메모리 사용률
- 오디오 큐 크기

## 라이선스

MIT License 