# usePageCapture 사용 예제 (한글 번역)

## 기본 사용법
- 특정 요소 영역을 캡처하고 클립보드에 복사

## 프리셋 사용법
- captureFullConversation
- captureMessageRange
- captureCustomElement

## 고급 사용법
- 커스텀 스크롤 영역, 타겟 계산 함수, 워터마크 포함 설정
- scrollBehavior, delay, maxIterations, offset 조정

## Vue 컴포넌트 내 사용 예
- 버튼 클릭 시 특정 요소를 캡처

## 설정 파라미터 설명

| 파라미터 | 설명 |
|----------|------|
| container | 스크롤 컨테이너 |
| getTargetRect | 캡처 대상 rect 반환 함수 |
| watermark | 워터마크 옵션 |
| captureDelay | 딜레이 시간 |
| scrollBehavior | 스크롤 방식 등 |

## 반환값 설명
- CaptureResult: { success, imageData?, error? }
- 메서드: captureArea / captureAndCopy / isCapturing (로딩 상태)