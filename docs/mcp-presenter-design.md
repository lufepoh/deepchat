# MCP Presenter 설계 문서

## 1. 핵심 클래스 설계

### 1.1 McpPresenter
- IMCPPresenter 인터페이스 구현.
- MCP 서버 시작/종료, 도구 호출 변환, 이벤트 발생 처리.
- LLM ↔ MCP 도구 포맷 상호 변환 지원.

### 1.2 ServerManager
- MCP 서버 클라이언트(McpClient) 수명 관리.
- NPM registry 속도 테스트 및 선택.
- CLIENT_LIST_UPDATED 이벤트 트리거.

### 1.3 ToolManager
- MCP 도구 목록 수집, 캐싱, 충돌 해결.
- 도구 호출 → 적절한 McpClient 라우팅.
- 권한 검사 및 결과 이벤트 발행.

### 1.4 McpClient
- MCP 서버와 통신 (stdio/SSE/http/inmemory).
- callTool, listTools, readResource 지원.
- proxy/env/header 관리, SERVER_STATUS_CHANGED 이벤트 발행.

## 2. 도구 호출 시퀀스
- LLM이 도구 목록 요청 → MCP Presenter → ToolManager → McpClient → 목록 반환 및 변환.
- 호출 요청 → 포맷 변환 → 권한 확인 → MCP 서버 호출 → 결과 포맷 후 반환.

## 3. 이벤트 시스템

| 이벤트 명 | 설명 |
|----------|------|
| SERVER_STARTED | 서버 시작됨 |
| SERVER_STOPPED | 서버 중단됨 |
| TOOL_CALL_RESULT | 도구 호출 결과 |
| CONFIG_CHANGED | MCP 설정 변경 |
| SERVER_STATUS_CHANGED | 서버 상태 변경 |
| CLIENT_LIST_UPDATED | 실행 중인 클라이언트 목록 갱신 |

## 4. 설정 구조
- `mcpServers`, `defaultServers`, `mcpEnabled`
- MCPServerConfig: command/url/type/env/headers/icons 등 구성 요소 포함

## 5. 확장 가이드
- 새 서버 타입/도구 포맷/권한 체계 추가 시 필요한 클래스 및 인터페이스 확장 지침 포함