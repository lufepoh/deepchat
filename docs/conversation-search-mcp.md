
# DeepChat 대화 기록 검색 MCP 서버

## 개요

`deepchat-inmemory/conversation-search-server`는 DeepChat의 대화 기록을 검색하고 분석하기 위한 내장 MCP 서버입니다. 대화 제목과 메시지 내용에서 키워드를 검색할 수 있으며, 대화 통계도 제공합니다.

## 주요 기능

### 1. 대화 검색 (`search_conversations`)

- 대화 제목 및 메시지 내용 검색
- 페이지네이션 지원
- 검색 스니펫과 함께 일치하는 대화 목록 반환
- 결과 자동 병합 및 중복 제거

### 2. 메시지 검색 (`search_messages`)

- 메시지 본문에서 키워드 검색
- 대화 ID로 필터링 가능
- 메시지 역할(user/assistant/system/function) 필터링 지원
- 컨텍스트 포함하여 일치 메시지 반환

### 3. 대화 이력 조회 (`get_conversation_history`)

- 특정 대화의 전체 메시지 이력 조회
- 시스템 메시지 포함 여부 선택 가능
- 대화 정보 및 전체 메시지 목록 반환

### 4. 통계 정보 (`get_conversation_stats`)

- 지정한 기간 내 대화 통계 제공
- 전체 대화 수, 메시지 수 계산
- 메시지 역할별 분포 통계
- 가장 활발한 대화 목록 제공

## 도구 상세 설명

### search_conversations

과거 대화 제목 및 메시지를 검색합니다.

**파라미터:**

- `query` (string): 검색 키워드 (제목 및 메시지에서 검색)
- `limit` (number, 선택): 결과 수 제한 (1–50, 기본값 10)
- `offset` (number, 선택): 페이지네이션 오프셋 (기본값 0)

**반환 예시:**

```json
{
  "conversations": [
    {
      "id": "conv_123",
      "title": "Python Programming Questions",
      "createdAt": 1698765432000,
      "updatedAt": 1698765500000,
      "messageCount": 15,
      "snippet": "제목 일치: Python Programming Questions"
    }
  ],
  "total": 1
}
```

### search_messages

조건에 따라 메시지를 검색합니다.

**파라미터:**

- `query` (string): 메시지 본문에서 검색할 키워드
- `conversationId` (string, 선택): 특정 대화 ID로 범위 제한
- `role` (string, 선택): 메시지 역할 필터 (user/assistant/system/function)
- `limit` (number, 선택): 결과 수 제한 (1–100, 기본값 20)
- `offset` (number, 선택): 페이지네이션 오프셋 (기본값 0)

**반환 예시:**

```json
{
  "messages": [
    {
      "id": "msg_456",
      "conversationId": "conv_123",
      "conversationTitle": "Python Programming Questions",
      "role": "user",
      "content": "How to use Python to process JSON data?",
      "createdAt": 1698765450000,
      "snippet": "How to use **Python** to process JSON data?"
    }
  ],
  "total": 1
}
```

### get_conversation_history

지정된 대화 ID의 전체 이력을 조회합니다.

**파라미터:**

- `conversationId` (string): 대화 ID
- `includeSystem` (boolean, 선택): 시스템 메시지 포함 여부 (기본값 false)

**반환 예시:**

```json
{
  "conversation": {
    "id": "conv_123",
    "title": "Python Programming Questions",
    "createdAt": 1698765432000,
    "updatedAt": 1698765500000,
    "settings": { ... }
  },
  "messages": [
    {
      "id": "msg_456",
      "role": "user",
      "content": "How to use Python to process JSON data?",
      "createdAt": 1698765450000,
      "tokenCount": 12,
      "status": "sent"
    }
  ]
}
```

### get_conversation_stats

대화 통계 정보를 조회합니다.

**파라미터:**

- `days` (number, 선택): 통계 대상 기간 (기본값 30일)

**반환 예시:**

```json
{
  "period": "30 days",
  "total": {
    "conversations": 150,
    "messages": 2500
  },
  "recent": {
    "conversations": 25,
    "messages": 380
  },
  "messagesByRole": {
    "user": 190,
    "assistant": 185,
    "system": 5
  },
  "activeConversations": [
    {
      "id": "conv_123",
      "title": "Python Programming Questions",
      "messageCount": 15,
      "lastActivity": "2023-10-31T10:30:00.000Z"
    }
  ]
}
```

## 활용 사례

1. **과거 대화 빠른 검색**: 키워드를 통해 관련 대화 탐색
2. **콘텐츠 리뷰**: 특정 주제나 기술 문제에 대한 메시지 검색
3. **데이터 분석**: 대화 활동 통계 및 사용 패턴 분석
4. **대화 관리**: 백업 또는 분석을 위한 전체 이력 조회

## 검색 기능

- **지능형 스니펫 생성**: 키워드가 포함된 부분 자동 생성, `**` 강조 표시
- **중복 제거**: 제목 일치 및 본문 일치 자동 병합
- **페이지네이션**: 대용량 결과를 위한 페이지 쿼리 지원
- **역할 필터링**: 사용자 메시지, 어시스턴트 응답 등 역할별 검색
- **기간 필터**: 통계 기능은 커스텀 기간 설정 가능

## 권한 설정

이 MCP 서버는 데이터 수정 없이 읽기 전용 작업만 수행하므로 `autoApprove: ['all']` 설정이 적용되어 있습니다.

## 기술 구현

- SQLite 기반 효율적 전문 검색
- LIKE 연산자를 활용한 유사 매칭
- JOIN 쿼리로 대화/메시지 테이블 연결
- DB 연결 및 오류 복구 자동 처리
