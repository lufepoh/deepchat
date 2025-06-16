
# IPC Tab 컨텍스트 기능 테스트

## 테스트 목표

멀티 탭 환경에서 IPC 호출이 올바른 호출 출처를 인식하고 정밀한 이벤트 라우팅을 제공하는지 확인합니다.

## 테스트 시나리오

### 1. 기본 탭 컨텍스트 인식

* **목표:** 메인 프로세스가 WebContents ID를 통해 탭을 올바르게 식별할 수 있는지 확인합니다.
* **단계** :

1. 여러 개의 탭 생성
2. 다른 탭에서 presenter 메서드 호출
3. 로그에 표시된 탭 ID가 올바른지 확인

### 2. 이벤트 정밀한 라우팅

* **목표:** EventBus가 이벤트를 올바른 탭으로 전송할 수 있는지 확인합니다.
* **단계** :

1. 탭 A에서 호출이 필요한 작업을 트리거합니다.
2. 콜백 이벤트가 탭 A에만 전송되고 다른 탭에는 영향을 미치지 않는지 확인합니다.

### 3. 오류 처리 강화

* **목표:** 에러 로그가 올바른 탭 컨텍스트를 포함하고 있는지 확인합니다.
* **단계** :

1. 다양한 탭에서 오류 상황을 발생시킵니다.
2. 에러 로그가 올바른 탭 ID 정보를 포함하고 있는지 확인합니다.

## 검증 항목

### 메인 프로세스 로그 형식

```javascript
[IPC Call] Tab:123 Window:456 -> presenterName.methodName
[IPC Warning] Tab:123 calling wrong presenter: invalidName
[IPC Error] Tab:123 presenterName.methodName: Error message
```

### 렌더링 프로세스 로그 형식

```javascript
[Renderer IPC] WebContents:789 -> presenterName.methodName
[Renderer IPC Error] WebContents:789 presenterName.methodName: Error message
```

### EventBus 신규 기능 검증

* `eventBus.sendToTab(tabId, eventName, ...args)` - 지정된 탭으로 이벤트 전송
* `eventBus.sendToActiveTab(windowId, eventName, ...args)` - 활성 탭으로 이벤트 전송
* `eventBus.broadcastToTabs(tabIds, eventName, ...args)` - 여러 탭에 이벤트 브로드캐스트

## 예상 결과

1. 모든 IPC 호출 로그에 올바른 탭 식별 정보가 포함되어 있어야 합니다.
2. 이벤트가 목표 탭으로 정확하게 라우팅됩니다.
3. 탭 간 이벤트 혼동이 발생하지 않습니다.
4. 오류 추적이 더욱 정밀해집니다.

## 회귀 테스트

다음 기능은 변경되지 않아야 합니다:

* 단일 탭 환경에서의 정상 작동
* 기존의 브로드캐스트 이벤트 메커니즘
* WindowPresenter 기능
* 모든 presenter의 기존 API 인터페이스

## 성능 검증

1. IPC 호출의 지연 시간이 크게 증가하지 않아야 합니다.
2. 메모리 사용량은 안정적이어야 합니다.
3. 탭 생성/소멸 성능에 영향을 주지 않아야 합니다.
