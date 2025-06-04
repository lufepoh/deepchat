# 다중 창/다중 탭 구조 설계 및 리팩터링 계획

## 목표
- DeepChat을 다중 창 + 각 창 내 다중 탭 구조로 리팩터링
- 각 창은 독립적, 탭은 자유롭게 이동/전환

## 새로운 설계
- WindowPresenter: 창 생성/제어
- TabPresenter: WebContentsView 기반 탭 제어
- tray/contextmenu에서도 창/탭 정보 접근
- 다중 entry (shell + content) 구조로 Renderer 분리

## TabPresenter 구조
- tabs: tabId ↔ { view, state, windowId }
- windowTabs: windowId ↔ tabId[]
- 핵심 메서드: createTab, destroyTab, moveTab, detachTab, attachTab

## Renderer 구조
- shell: 탭 바 UI 및 드래그 처리 (Vue)
- content: 실제 탭 내용 (ChatView, Settings 등)
- IPC: 요청/갱신 통신 체계 마련

## 실행 계획 요약
1. TabPresenter 구현
2. WindowPresenter 확장
3. WebContentsView 뷰 계층 구성
4. IPC 구현
5. Renderer 탭 UI 작성
6. 탭 드래그 처리
7. 상태 동기화
8. Tray/ContextMenu 대응
9. 수명주기 정리
10. 전체 테스트