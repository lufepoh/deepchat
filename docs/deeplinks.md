
# DeepChat 딥링크 문서

DeepChat은 딥링크(DeepLinks)를 통해 외부에서 호출할 수 있는 기능을 지원합니다. 이 문서는 DeepChat에서 지원하는 딥링크 유형, 파라미터 및 사용 방법을 설명합니다.

## 채팅 시작

이 링크를 통해 새로운 채팅 세션을 빠르게 시작할 수 있으며, 선택적으로 모델과 초기 메시지를 지정할 수 있습니다.

### URL 형식

```
deepchat://start?msg={query}&system={systemPrompt}&model={modelId|modelName}
```

### 파라미터 설명

| 파라미터 이름 | 타입   | 필수 여부 | 설명                                                                 |
| ------------- | ------ | -------- | -------------------------------------------------------------------- |
| msg           | string | 아니오    | 초기 채팅 메시지                                                     |
| system        | string | 아니오    | 시스템 프롬프트                                                      |
| model         | string | 아니오    | 모델 ID 또는 이름 (예: "gpt-3.5-turbo", "deepseek-chat")             |

### 동작

1. 현재 채팅 페이지가 아니라면 자동으로 해당 페이지로 이동합니다.
2. 모델이 지정된 경우, 해당 모델을 정확히 또는 유사하게 찾아 자동 선택합니다.
3. 초기 메시지가 있는 경우 입력창에 자동으로 입력됩니다.

### 예시

GPT-3.5로 대화 열기:

```
deepchat://start?model=gpt-3.5-turbo
```

초기 메시지 지정:

```
deepchat://start?msg=인공지능에 대한 글을 써줘
```

모델, 메시지, 시스템 프롬프트를 모두 지정:

```
deepchat://start?msg=이 코드 분석해줘&model=deepseek-coder&system=당신은 코드 분석 전문가입니다
```

## MCP 설치

이 딥링크를 통해 MCP(Model Control Protocol) 서비스 구성을 설치할 수 있습니다.

### URL 형식

```
deepchat://mcp/install?code={base64Encode(JSON.stringify(jsonConfig))}
```

### 파라미터 설명

| 파라미터 이름 | 타입           | 필수 여부 | 설명                                                      |
| ------------- | -------------- | -------- | --------------------------------------------------------- |
| code          | string (JSON)  | 예       | MCP 서비스 설정을 담은 JSON 문자열(Base64 인코딩 필요)    |

### 동작

1. MCP 기능이 비활성화 상태라면 자동으로 활성화됩니다.
2. 설정 페이지의 MCP 설정 영역으로 이동합니다.
3. 서버 추가 다이얼로그가 열리고 설정 데이터가 자동으로 채워집니다.

### 구성 JSON 예시

#### `command` 포함, `url` 없음 → stdio 방식으로 인식됨

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "mcp-filesystem-server",
      "args": [
        "/Users/username/Desktop"
      ]
    }
  }
}
```

#### `url` 포함, `command` 없음 → sse 방식으로 인식됨

```json
{
  "mcpServers": {
    "browser-use-mcp-server": {
      "url": "http://localhost:8000/sse"
    }
  }
}
```

#### 전체 예시 - stdio

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "mcp-filesystem-server",
      "args": ["/Users/username/Desktop"],
      "env": {},
      "descriptions": "filesystem mcp server",
      "icons": "📁",
      "type": "stdio",
      "autoApprove": ["all"]
    }
  }
}
```

#### 전체 예시 - sse

```json
{
  "mcpServers": {
    "browser-use-mcp-server": {
      "url": "http://localhost:8000/sse",
      "type": "sse",
      "icons": "🏠",
      "autoApprove": ["all"]
    }
  }
}
```

## MCP 설치용 code 파라미터 생성 방법

```javascript
import { encode } from 'js-base64';

const config = {
  "mcpServers": {
    "browser-use-mcp-server": {
      "url": "http://localhost:8000/sse"
    }
  }
}
const code = encode(JSON.stringify(config));
```

## 채팅 예시

```
deepchat://start?msg=%E5%A4%A9%E6%B0%94%E4%B8%8D%E9%94%99&system=%E4%BD%A0%E6%98%AF%E4%B8%80%E4%B8%AA%E9%A2%84%E6%8A%A5%E5%91%98%2C%E8%AF%B7%E4%BD%A0%E7%A4%BC%E8%B2%8C%E8%80%8C%E4%B8%93%E4%B8%9A%E5%9B%9E%E7%AD%94%E7%94%A8%E6%88%B7%E9%97%AE%E9%A2%98&model=deepseek-chat
```

## STDIO 설치 예시

```
deepchat://mcp/install?code=eyJtY3BTZXJ2ZXJzIjp7ImZpbGVzeXN0ZW0iOnsiY29tbWFuZCI6Im1jcC1maWxlc3lzdGVtLXNlcnZlciIsImFyZ3MiOlsiL1VzZXJzL3VzZXJuYW1lL0Rlc2t0b3AiXX19fQ==
```

## SSE 설치 예시

```
deepchat://mcp/install?code=eyJtY3BTZXJ2ZXJzIjp7ImJyb3dzZXItdXNlLW1jcC1zZXJ2ZXIiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo4MDAwL3NzZSJ9fX0=
```

