# 이벤트 시스템 설계 문서

## 문제 배경

현재 프로젝트에서 `provider-models-updated` 이벤트가 혼란스럽게 사용되고 있습니다. 이 이벤트는 서로 다른 두 소스에서 동시에 트리거됩니다:

1. **BaseLLMProvider**: 모델을 처리할 때 트리거됨 (예: `addCustomModel`, `removeCustomModel` 등의 메서드)
2. **ConfigPresenter**: 설정 변경 시 트리거됨 (예: `addCustomModel`, `removeCustomModel` 등의 메서드)

이러한 설계는 여러 문제를 유발합니다:

- 이벤트의 순환 트리거 (무한 루프 문제 발생)
- 이벤트 의미가 불명확함 (동일 이벤트가 다른 비즈니스 의미를 가짐)
- 코드 간 결합도가 높고 유지보수가 어려움

## 이벤트 분류 및 명명 규칙

기능 영역별로 이벤트를 분류하고, 통일된 명명 규칙을 적용합니다:

1. **설정 관련 이벤트**:

   - `config:provider-changed`：제공자 설정 변경
   - `config:system-changed`：시스템 설정 변경
   - `config:model-list-changed`：설정 내 모델 목록 변경
2. **모델 관련 이벤트**:
   모두 제거. 모델 상태 및 이름 관련 이벤트는 config에서만 발행하며, 상위 settings와 의미를 일치시킴
3. **대화 관련 이벤트**:

   - `conversation:created`
   - `conversation:activated`
   - `conversation:cleared`
4. **통신 관련 이벤트**:

   - `stream:response`
   - `stream:end`
   - `stream:error`
5. **앱 업데이트 관련 이벤트**:

   - `update:status-changed`
   - `update:progress`
   - `update:error`
   - `update:will-restart`
6. **동기화 관련 이벤트**:

   - `sync:backup-started`：백업 시작
   - `sync:backup-completed`：백업 완료
   - `sync:backup-error`：백업 오류
   - `sync:import-started`：가져오기 시작
   - `sync:import-completed`：가져오기 완료
   - `sync:import-error`：가져오기 오류

## 책임 분리

각 컴포넌트가 담당하는 이벤트 트리거 책임을 명확히 정의합니다:

- **ConfigPresenter**：설정 관련 이벤트만 담당
- **BaseLLMProvider**：모델 조작만 담당, 이벤트는 트리거하지 않음
- **ThreadPresenter**：대화 관련 이벤트만 담당
- **UpgradePresenter**：앱 업데이트 관련 이벤트만 담당

## 이벤트 흐름 시퀀스 다이어그램

### 현재 이벤트 흐름

```
BaseLLMProvider                ConfigPresenter                  Presenter(Main)                  Settings(Renderer)
     |                              |                                 |                                |
     |--- provider-models-updated-->|                                 |                                |
     |                              |--- provider-models-updated----->|                                |
     |                              |                                 |--- provider-models-updated---->|
     |                              |                                 |                                |--- refreshProviderModels()
     |                              |                                 |                                |
     |--- model-status-changed----->|                                 |                                |
     |                              |--- model-status-changed-------->|                                |
     |                              |                                 |--- model-status-changed------->|
     |                              |                                 |                                |--- updateLocalModelStatus()
     |                              |                                 |                                |
     |                              |--- provider-setting-changed---->|                                |
     |                              |                                 |--- provider-setting-changed--->|
     |                              |                                 |                                |--- refreshAllModels()
```

### 리팩토링 후 이벤트 흐름

```
ConfigPresenter                  Presenter(Main)                  Settings(Renderer)
     |                                 |                                |
     |                                |
     |--- config:model-list-changed--->|                                |
     |                                 |--- config:model-list-changed-->|
     |                                 |                                |--- refreshProviderModels()
     |                                 |                                |
     |                                 |                                |
     |--- model:status-changed-------->|                                |
     |                                 |--- model:status-changed------->|
     |                                 |                                |--- updateLocalModelStatus()
     |                                 |                                |
     |--- config:provider-changed----->|                                |
     |                                 |--- config:provider-changed---->|
     |                                 |                                |--- refreshAllModels()
```
