
# EventBus 사용 가이드

## 개요

EventBus 클래스는 주 프로세스와 렌더러 프로세스 간의 정밀한 이벤트 통신 메커니즘을 제공합니다. 이 클래스는 EventEmitter를 상속 받아 명시적인 이벤트 전송 제어에 집중하며, 주 프로세스, 렌더러 프로세스, 특정 창으로 이벤트를 보낼 수 있도록 설계되었습니다.

## 핵심 철학

* **정밀한 제어** ：특정 메서드를 사용하여 이벤트의 대상을 명확히 지정합니다.
* **명시적 전송** ：모든 크로스 프로세스 통신은 명확히 호출해야 합니다.
* **타입 안전** ：완벽한 TypeScript 지원으로 모든 매개변수의 타입을 검사합니다.
* **간결한 아키텍처** ：자동 전송 메커니즘이 없어 코드가 더욱 간결하고 예측 가능합니다.

## 주요 메서드

### 1. 오로지 주 프로세스로 이벤트 보내기

```typescript
import { eventBus } from '@/main/eventbus'

// 창 관리 및 탭 작업 등 주 프로세스 내부 이벤트
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('shortcut:create-new-tab', windowId)
```

### 2. 특정 창으로 이벤트 보내기

```typescript
import { eventBus } from '@/main/eventbus'

// 지정된 창 ID의 렌더러 프로세스에 이벤트 전송
eventBus.sendToWindow('custom-event', windowId, data)
```

### 3. 렌더러 프로세스로 이벤트 보내기

```typescript
import { eventBus, SendTarget } from '@/main/eventbus'

// 모든 창(기본값)으로 전송
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)

// 기본 탭으로 전송 (특수 시나리오)
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, data)
```

### 4. 주 프로세스와 렌더러 프로세스 모두에 이벤트 보내기 (추천)

```typescript
// 가장 일반적인 메서드: 주 프로세스와 렌더러 프로세스 모두가 이벤트를 받을 수 있도록 합니다.
eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, providers)
eventBus.send('sync:backup-completed', SendTarget.ALL_WINDOWS, timestamp)
```

## 이벤트 분류 가이드

### 오로지 주 프로세스 내부

창 관리 및 탭 작업 등 렌더러 프로세스에 알 필요가 없는 이벤트:

```typescript
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('window:focused', windowId)
eventBus.sendToMain('shortcut:create-new-window')
```

### 오로지 렌더러 프로세스

UI 업데이트 전용, 주 프로세스에서 처리하지 않아도 되는 이벤트:

```typescript
eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, error)
eventBus.sendToRenderer('ui:theme-changed', SendTarget.ALL_WINDOWS, theme)
```

### 주 프로세스 및 렌더러 프로세스

구성 변경, 상태 동기화 등 모든 측이 알아야 하는 이벤트:

```typescript
eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS)
```

### 특정 창 간의 통신

특정 창과 통신해야 하는 시나리오:

```typescript
eventBus.sendToWindow('window:specific-action', targetWindowId, actionData)
```

## SendTarget 옵션

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 모든 창에 브로드캐스트 (기본값, 추천)
  DEFAULT_TAB = 'default_tab'     // 기본 탭으로 전송 (특수 시나리오)
}
```

## 초기화 및 구성

### WindowPresenter 설정

```typescript
import { eventBus } from '@/main/eventbus'
import { WindowPresenter } from '@/main/windowPresenter'

// 애플리케이션 초기화 시 WindowPresenter를 설정합니다.
const windowPresenter = new WindowPresenter()
eventBus.setWindowPresenter(windowPresenter)
```

## 최선의 실천 방법

### 1. 구성 변경 이벤트

```typescript
// 구성을 업데이트할 때 모든 탭에 알림을 전송합니다.
setLanguage(language: string) {
  this.setSetting('language', language)
  eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
}
```

### 2. 창 관리 이벤트

```typescript
// 창 관련 이벤트는 주 프로세스만 알면 되므로 오로지 주 프로세스에 전송합니다.
onWindowCreated(windowId: number) {
  eventBus.sendToMain('window:created', windowId)
}
```

### 3. 사용자 상호작용 이벤트

```typescript
// 단축키 등의 사용자 작업은 특정 대상으로 전송할 수 있으나, 여기서는 모든 창에 이벤트를 전송합니다.
onZoomIn() {
  // 확대 작업은 모든 창에서 처리되어야 합니다.
  eventBus.send('shortcut:zoom-in', SendTarget.ALL_WINDOWS)
}
```

### 4. 오류 처리 이벤트

```typescript
// 오류 이벤트의 대상을 명시적으로 지정합니다.
onStreamError(error: Error) {
  // 주 프로세스에서 오류를 기록합니다.
  eventBus.sendToMain('stream:error-logged', error)
  // 렌더러 프로세스에서 오류를 표시합니다.
  eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error)
}
```

### 5. 스트림 이벤트 처리

```typescript
// 다양한 스트림 이벤트를 처리하며 명확히 이벤트의 대상을 지정합니다.
handleConversationEvents() {
  // 대화 시작: 모든 창의 UI 업데이트 알림 전송
  eventBus.send('conversation:activated', SendTarget.ALL_WINDOWS, conversationId)

  // 메시지 수정: 모든 창에 알림 전송
  eventBus.send('conversation:message-edited', SendTarget.ALL_WINDOWS, messageData)
}

// MCP 서버 이벤트 처리
handleMCPEvents() {
  // MCP 서버 시작: 주 프로세스와 모든 창에 알림 전송
  eventBus.send('mcp:server-started', SendTarget.ALL_WINDOWS, serverInfo)

  // 구성 변경: 모든 창에 알림 전송
  eventBus.send('mcp:config-changed', SendTarget.ALL_WINDOWS, newConfig)
}
```

## 타입 안전

EventBus는 완벽한 TypeScript 지원을 통해 포괄적인 타입 검사를 제공합니다.

```typescript
// 명확히 정의된 매개변수 타입 사용 예시
eventBus.send('config:changed', SendTarget.ALL_WINDOWS, {
  key: 'language',
  value: 'zh-CN'
})

// 안전한 열거형 사용 예시
eventBus.sendToRenderer('ui:update', SendTarget.DEFAULT_TAB, data)
```

## 주의 사항

1. **WindowPresenter 종속성** ：렌더러 프로세스에 이벤트를 보내기 위해서는 먼저 WindowPresenter가 설정되어 있어야 합니다.
2. **명시적 전송** ：모든 크로스 프로세스 통신은 명확히 호출해야 합니다.
3. **이벤트 이름 규칙** ：'모듈:작업' 형식을 사용하는 것이 좋습니다.
4. **매개변수 타입** ：전달되는 객체가 serialize 가능하도록 확인해야 합니다.
5. **오류 처리** ：콘솔 경고를 모니터링하여 WindowPresenter가 올바르게 설정되었는지 확인합니다.
6. **성능 고려사항** ：큰 객체를 자주 렌더러 프로세스에 보내는 것을 피하여 성능 저하를 방지해야 합니다.

## 일반적인 사용 사례 예시

### 구성 시스템

```typescript
class ConfigManager {
  updateLanguage(language: string) {
    this.saveConfig('language', language)
    // 모든 창에 언어 변경 알림을 명시적으로 전송합니다.
    eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
  }
}
```

### 알림 시스템

```typescript
class NotificationManager {
  showError(message: string) {
    // 오로지 렌더러 프로세스에 알림 표시 이벤트를 전송합니다.
    eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, message)
  }
}
```

### 단축키 처리

```typescript
class ShortcutManager {
  handleGoSettings() {
    // 렌더러 프로세스에 설정 페이지로 이동하라는 알림 전송
    eventBus.sendToRenderer('shortcut:go-settings', SendTarget.ALL_WINDOWS)
  }

  handleCleanHistory() {
    // 주 프로세스에서 클린 역사 작업 후 렌더러 프로세스에 UI 갱신 알림 전송
    this.cleanHistoryInMain()
    eventBus.sendToRenderer('shortcut:clean-chat-history', SendTarget.ALL_WINDOWS)
  }
}
```

## 디버깅 팁

```typescript
// 주 프로세스 이벤트를 감시하여 디버깅
eventBus.on('*', (eventName, ...args) => {
  console.log(`Main process event: ${eventName}`, args)
})

// WindowPresenter 상태 확인
if (!eventBus.windowPresenter) {
  console.warn('WindowPresenter not set, renderer events will not work')
}
```
