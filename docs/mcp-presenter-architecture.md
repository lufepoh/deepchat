# MCP Presenter 아키텍처 문서

## 개요
MCP Presenter는 DeepChat에서 MCP 서버 및 도구 관리를 담당하는 핵심 모듈입니다.

### 주요 역할
- MCP 서버 제어 (시작/종료/설정)
- MCP 도구 관리 (정의/충돌 해결/캐시/호출 권한)
- LLM 도구 포맷 변환 (OpenAI, Anthropic, Gemini)
- 서버 상태 모니터링 및 이벤트 발행

## 계층 구조
- 인터페이스(IMCPPresenter)
- 프리젠터(McpPresenter)
- 서버 관리(ServerManager)
- 도구 관리(ToolManager)
- 설정 저장소(McpConfHelper, IConfigPresenter)
- 서버 클라이언트(McpClient)

## 시퀀스
1. 앱 시작 시 초기화 → 기본 서버 목록 가져오기 → 서버 연결 및 상태 이벤트 처리
2. LLM에서 도구 정의 요청 → MCP에서 변환 → 실행 요청 → 결과 회신

## 설계 특징
- 다양한 프로토콜 지원 (stdio/SSE/HTTP/InMemory)
- 도구 충돌 해결 및 이름 매핑
- 설정 기반 동작 및 지속성 저장
- eventBus 기반 상태 전파
- NPM 레지스트리 속도 테스트 및 최적 선택