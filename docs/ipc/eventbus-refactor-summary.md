
# 이벤트 버스 리팩토링 요약

## 🎯 리팩토링 목표

간결하고 명확한 이벤트 통신 메커니즘을 구축하여 주 프로세스와 렌더러 프로세스 간의 정밀한 이벤트 전달을 지원합니다. EventEmitter를 상속함으로써 기본 기능을 유지하고, 명시적인 이벤트 전송 메서드 제공에 집중하며, 복잡한 자동 전송 메커니즘을 피합니다.

## 🚀 주요 기능

### 1. 이벤트 버스 핵심 아키텍처

* **EventEmitter 상속** : 기본 이벤트 시스템의 기능을 유지합니다.
* **정밀한 전송 메서드** :
* `sendToMain(eventName, ...args)`: 메인 프로세스에만 전송
* `sendToWindow(eventName, windowId, ...args)`: 특정 창에 전송
* `sendToRenderer(eventName, target, ...args)`: 렌더러 프로세스에 전송
* `send(eventName, target, ...args)`: 메인 및 렌더러 프로세스 모두에 동시에 전송
* **명시적 통신** : 크로스 프로세스 통신은 항상 명시적으로 호출되어야 합니다.
* **WindowPresenter 통합** : 렌더러 프로세스 통신을 표준 인터페이스를 통해 관리합니다.

### 2. SendTarget 열거형 정의

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 모든 창으로 브로드캐스트 (기본 추천)
  DEFAULT_TAB = 'default_tab'     // 기본 탭으로 전송 (특수 시나리오)
}
```

## 📊 이벤트 통신 패턴

### 메인 프로세스 내부 통신

창 관리 및 시스템 수준 작업 등에 사용됩니다.

```typescript
// 창의 생명 주기 관리
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('window:focused', windowId)
eventBus.sendToMain('window:blurred', windowId)

// 단축키로 인한 메인 프로세스 작업
eventBus.sendToMain('shortcut:create-new-window')
eventBus.sendToMain('shortcut:create-new-tab', windowId)
eventBus.sendToMain('shortcut:close-current-tab', windowId)
```

### 렌더러 프로세스 통신

UI 업데이트 및 사용자 인터페이스 응답 등에 사용됩니다.

```typescript
// 구성 변경 알림
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.sendToRenderer('config:theme-changed', SendTarget.ALL_WINDOWS, theme)

// 특정 창 작업
eventBus.sendToWindow('window:specific-update', targetWindowId, data)

// 기본 탭 작업
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, installData)
```

### 양방향 통신 (추천)

메인 프로세스와 렌더러 프로세스가 모두 동일하게 반응해야 하는 시나리오에 사용됩니다.

```typescript
// 구성 시스템 이벤트
eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, providerConfig)
eventBus.send('config:model-list-updated', SendTarget.ALL_WINDOWS, modelList)

// 동기화 시스템 이벤트
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS, backupInfo)
eventBus.send('sync:backup-completed', SendTarget.ALL_WINDOWS, result)

// 사용자 인터페이스 확대/축소
eventBus.send('shortcut:zoom-in', SendTarget.ALL_WINDOWS)
eventBus.send('shortcut:zoom-out', SendTarget.ALL_WINDOWS)
```

### 스트림 이벤트 및 비즈니스 이벤트 처리

각 이벤트의 전송 대상을 명시적으로 지정해야 합니다.

```typescript
// 스트림 이벤트 처리
class StreamEventHandler {
  handleError(error: Error) {
    // 메인 프로세스에서 오류를 기록
    eventBus.sendToMain('stream:error-logged', error)
    // 렌더러 프로세스가 오류를 표시
    eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error)
  }
}

// 대화 이벤트 처리
class ConversationHandler {
  activateConversation(conversationId: string) {
    // 모든 창에 UI 업데이트 알림 전송
    eventBus.send('conversation:activated', SendTarget.ALL_WINDOWS, conversationId)
  }

  editMessage(messageData: any) {
    // 모든 창에서 메시지 수정 알림 전송
    eventBus.send('conversation:message-edited', SendTarget.ALL_WINDOWS, messageData)
  }
}

// MCP 서버 이벤트 처리
class MCPHandler {
  startServer(serverInfo: any) {
    // 메인 프로세스와 렌더러 프로세스 모두가 서버 시작 정보를 받아야 함
    eventBus.send('mcp:server-started', SendTarget.ALL_WINDOWS, serverInfo)
  }

  updateConfig(newConfig: any) {
    // 구성 변경 알림을 모든 창에 전송
    eventBus.send('mcp:config-changed', SendTarget.ALL_WINDOWS, newConfig)
  }
}
```

## 아키텍처의 장점

### 간편한 초기화

```typescript
// 생성자가 복잡한 매개변수를 필요로 하지 않습니다.
export const eventBus = new EventBus()

// 런타임에 WindowPresenter 설정
eventBus.setWindowPresenter(windowPresenter)
```

### 명시적 통신 보장

* 크로스 프로세스 통신은 항상 명시적으로 호출되어야 하며, 의도치 않은 이벤트 누락을 방지합니다.
* 코드 로직이 보다 명확하고 예측 가능해져 디버깅 및 유지보수가 용이합니다.

### 타입 안전 보장

* `any` 타입 사용을 완전히 제거하였습니다.
* 모든 매개변수는 명확히 정의되어 있으며 (`...args: unknown[]`) 열거형은 컴파일 타임 검사를 제공합니다.
* TypeScript 스마트 힌트 지원

### 오류 처리 메커니즘

```typescript
sendToRenderer(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
  if (!this.windowPresenter) {
    console.warn('WindowPresenter not available, cannot send to renderer')
    return
  }
  // ... 전송 로직
}
```

## 실제 응용 시나리오

### 구성 관리 시스템

```typescript
class ConfigManager {
  updateLanguage(language: string) {
    this.saveConfig('language', language)
    // 명시적으로 모든 UI에 언어 변경 알림 전송
    eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
  }

  updateProvider(provider: ProviderConfig) {
    this.saveConfig('provider', provider)
    // 메인 프로세스와 모든 UI에 변경 사항 알림 전송
    eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, provider)
  }
}
```

### 창 관리 시스템

```typescript
class WindowManager {
  createWindow() {
    const windowId = this.doCreateWindow()
    // 메인 프로세스에만 알림 전송
    eventBus.sendToMain('window:created', windowId)
  }

  focusWindow(windowId: number) {
    this.doFocusWindow(windowId)
    // 메인 프로세스에만 알림 전송
    eventBus.sendToMain('window:focused', windowId)
  }

  notifySpecificWindow(windowId: number, data: any) {
    // 특정 창에 메시지를 전송
    eventBus.sendToWindow('window:notification', windowId, data)
  }
}
```

### 알림 시스템

```typescript
class NotificationManager {
  showError(message: string) {
    // 명시적으로 모든 렌더러 프로세스에 오류 표시 메시지 전송
    eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, message)
  }

  handleSystemNotificationClick() {
    // 시스템 알림 클릭 시 모든 창에 알림 전송
    eventBus.send('notification:sys-notify-clicked', SendTarget.ALL_WINDOWS)
  }
}
```

### 단축키 처리 시스템

```typescript
class ShortcutManager {
  handleGoSettings() {
    // 렌더러 프로세스에 설정 페이지 이동 알림 전송
    eventBus.sendToRenderer('shortcut:go-settings', SendTarget.ALL_WINDOWS)
  }

  handleCleanHistory() {
    // 메인 프로세스에서 클린 역사 작업 수행
    this.cleanHistoryInMain()
    // 렌더러 프로세스에 UI 업데이트 알림 전송
    eventBus.sendToRenderer('shortcut:clean-chat-history', SendTarget.ALL_WINDOWS)
  }

  handleZoom(direction: 'in' | 'out' | 'reset') {
    // 확대/축소 작업은 메인 프로세스와 렌더러 프로세스 모두에 동시에 알림 전송
    eventBus.send(`shortcut:zoom-${direction}`, SendTarget.ALL_WINDOWS)
  }
}
```

## 성능 최적화

### 정밀한 대상 제어

* 특정 창으로 선택적 전송하여 브로드캐스트를 줄입니다.
* 기본 탭을 선택할 수 있습니다.
* 불필요한 이벤트 전파와 크로스 프로세스 통신을 방지하여 성능 개선에 도움을 줍니다.

### 명시적 제어의 장점

* 개발자는 각 이벤트의 대상을 명시적으로 지정해야 하며, 예기치 않은 성능 오버헤드를 방지합니다.
* 코드 가독성 및 유지보수성이 향상됩니다.
* 성능 분석과 최적화가 용이해집니다.

### 오류 예방 메커니즘

* WindowPresenter의 상태를 확인합니다.
* 콘솔 경고 메시지를 출력하여 문제점을 신속히 파악할 수 있습니다.
* 부드러운 에러 처리와 저하 대처로 안정성을 유지합니다.

## 호환성 및 마이그레이션

### 후진 호환

* 기본 EventEmitter의 모든 기능을 그대로 유지합니다.
* 메인 프로세스 내부 이벤트 리스너는 변경되지 않으며, 기존 이벤트 리스너 수정이 필요 없습니다.

### 마이그레이션 가이드

이전에 자동 전송 방식을 사용하던 코드는 다음과 같이 명시적으로 변경해야 합니다.

```typescript
// ❌ 이전의 자동 전송 방식
eventBus.emit('stream:error', error)  // 렌더러 프로세스에 자동으로 전송

// ✅ 현재는 다음과 같이 명시적으로 지정해야 합니다.
eventBus.sendToMain('stream:error-logged', error)  // 메인 프로세스에서 오류 기록
eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error)  // 렌더러 프로세스에서 오류 표시

// 또는 양방향 전송을 사용할 수 있습니다.
eventBus.send('stream:error', SendTarget.ALL_WINDOWS, error)
```

## 리팩토링 결과 요약

이번 리팩터링 작업으로 다음과 같은 개선 사항을 도모하였습니다.

1. **아키텍처 간소화** : 자동 전송 메커니즘이 제거되어 명시적 통신에 집중할 수 있게 되었습니다.
2. **명료한 로직** : 각 이벤트의 대상이 명확하게 정해져 코드의 예측 가능성이 향상되었습니다.
3. **성능 최적화** : 불필요한 이벤트 전달 및 처리로 인한 오버헤드를 줄여 성능을 개선했습니다.
4. **유지보수성 향상** : 코드 흐름이 명확해져 디버깅과 유지보수가 용이합니다.
5. **호환성 보장** : 기본 EventEmitter의 모든 기능은 그대로 유지되어 기존 코드와의 호환성을 확보하였습니다.

특히 중요한 개선 사항들은 다음과 같습니다:

* **명시적 통신** : 크로스 프로세스 통신은 항상 명확하게 지정되어야 하여 예기치 않은 이벤트 누락을 방지합니다.
* **정밀한 제어** : 모든 창, 특정 창, 기본 탭으로 선택적 전송이 가능하여 성능 최적화를 돕습니다.
* **간결한 아키텍처** : 자동 전송 로직이 제거되면서 코드가 더욱 단순해져 유지보수성이 크게 향상되었습니다.
* **더 나은 성능 및 안정성** : 각 이벤트 처리 로직의 명확성과 예측 가능성 덕분에 애플리케이션의 안정적인 실행을 위한 견고한 기반을 마련하였습니다.

현재의 EventBus는 보다 간결하고 명확해지면서, 개발자가 이벤트 대상을 명시적으로 지정해야 하더라도 코드 가독성, 유지보수성 및 성능 향상이 크게 개선되었습니다. 각 이벤트 처리 로직의 예측 가능성 덕분에 애플리케이션은 안정적으로 실행됩니다.
