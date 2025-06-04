# ConfigPresenter 아키텍처 다이어그램

## 클래스 관계도

```mermaid
classDiagram
    class IConfigPresenter {
        <<interface>>
        +getSetting()
        +setSetting()
        +getProviders()
        +setProviders()
        +getModelStatus()
        +setModelStatus()
        +getMcpServers()
        +setMcpServers()
    }

    class ConfigPresenter {
        -store: ElectronStore~IAppSettings~
        -providersModelStores: Map~string, ElectronStore~IModelStore~~
        -mcpConfHelper: McpConfHelper
        +constructor()
        +migrateModelData()
    }

    class ElectronStore~T~ {
        +get()
        +set()
        +delete()
    }

    class McpConfHelper {
        +getMcpServers()
        +setMcpServers()
        +onUpgrade()
    }

    class eventBus {
        +emit()
        +on()
    }

    IConfigPresenter <|.. ConfigPresenter
    ConfigPresenter *-- ElectronStore~IAppSettings~
    ConfigPresenter *-- "1" McpConfHelper
    ConfigPresenter *-- "*" ElectronStore~IModelStore~
    ConfigPresenter ..> eventBus
```

## 데이터 흐름도

```mermaid
sequenceDiagram
    participant Renderer
    participant ConfigPresenter
    participant ElectronStore
    participant McpConfHelper

    Renderer->>ConfigPresenter: getSetting('language')
    ConfigPresenter->>ElectronStore: get('language')
    ElectronStore-->>ConfigPresenter: 'en-US'
    ConfigPresenter-->>Renderer: 'en-US'

    Renderer->>ConfigPresenter: setMcpEnabled(true)
    ConfigPresenter->>McpConfHelper: setMcpEnabled(true)
    McpConfHelper-->>ConfigPresenter: Promise~void~
    ConfigPresenter->>eventBus: emit('mcp-enabled-changed', true)
    ConfigPresenter-->>Renderer: Promise~void~
```

## 저장 구조

### 주 설정 저장소 (app-settings.json)

```json
{
  "language": "en-US",
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "apiKey": "sk-...",
      "enable": true
    }
  ],
  "model_status_openai_gpt-4": true,
  "proxyMode": "system",
  "syncEnabled": false
}
```

### 모델 저장소 (models_openai.json)

```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "maxTokens": 8192,
      "vision": false,
      "functionCall": true
    }
  ],
  "custom_models": [
    {
      "id": "gpt-4-custom",
      "name": "GPT-4 Custom",
      "maxTokens": 8192
    }
  ]
}
```

## 컴포넌트 상호작용

```mermaid
flowchart TD
    A[Renderer] -->|호출| B[ConfigPresenter]
    B -->|읽기/쓰기| C[주 설정 저장소]
    B -->|관리| D[모델 저장소]
    B -->|위임| E[McpConfHelper]
    B -->|트리거| F[이벤트 버스]
    F -->|알림| G[다른 Presenter]
    F -->|알림| A
```

## 핵심 설계 포인트

1. **인터페이스 분리**: IConfigPresenter 인터페이스를 통해 공통 API 정의
2. **단일 책임 원칙**: McpConfHelper는 MCP 관련 로직만 처리
3. **이벤트 기반 설계**: 이벤트 버스를 통해 설정 변경 사항을 알림
4. **버전 호환성 고려**: 내장 데이터 마이그레이션 메커니즘 포함
5. **타입 안전성 확보**: 제네릭 인터페이스 사용으로 타입 안정성 보장
