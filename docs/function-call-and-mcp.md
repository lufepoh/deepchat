# MCP에서 Tool Use까지

## MCP 도구 매핑 및 정의

MCP (Model Context Protocol)는 다양한 모델과의 상호작용을 표준화하기 위한 프로토콜입니다. 이 프로젝트에서는 MCP 도구 정의가 `McpClient` 클래스를 통해 통합 관리되며, 다양한 LLM 공급자에 대해 일관된 도구 호출 인터페이스를 제공합니다.

MCP 도구의 기본 구조 정의는 다음과 같습니다 (공식적으로는 몇 가지 주석 필드도 있지만, 현재는 사용되지 않습니다):

```typescript

{

  name: string;          // 도구의 고유 식별자

  description?:string;  // 사람이 읽을 수 있는 설명

  inputSchema: {         // 도구 파라미터의 JSON Schema

    type: "object",

    properties: { ... }  // 도구별 고유 파라미터

  }

}

```

`mcpClient.ts`의 `callTool` 메서드를 사용하여 서로 다른 공급자의 도구 호출을 수행할 수 있습니다:

```typescript

asynccallTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>

```

도구 호출 결과는 다음과 같은 통일된 형식을 따릅니다:

```typescript

interfaceToolCallResult {

  isError?: boolean;

  content: Array<{

    type: string;

    text: string;

  }>;

}

```

MCP 도구를 다른 공급자 포맷으로 매핑해야 할 경우 다음과 같은 과정을 거칩니다:

1.`presenter.mcpPresenter.mcpToolsToOpenAITools`, `mcpToolsToAnthropicTools`, `mcpToolsToGeminiTools` 등의 메서드를 사용하여 변환

2. 이러한 메서드들은 MCP 도구의 `inputSchema`를 각 공급자가 기대하는 파라미터 형식으로 변환
3. 도구 이름과 설명은 변환 중에도 일관되게 유지됨

---

## Anthropic Tool API 및 컨텍스트 구성 형식

Anthropic의 Tool API는 `AnthropicProvider` 클래스를 통해 구현되며, tool use 기능이 있는 Claude 3 시리즈 모델을 지원합니다.

### 형식 변환

Anthropic은 도구 정의를 `tools` 파라미터를 통해 전달하며, 형식은 다음과 같습니다:

```typescript

{

  tools: [

    {

      name:string;

      description: string;

      input_schema: object; // JSON Schema 형식

    }

  ]

}

```

### 컨텍스트 구성

Anthropic은 메시지 형식에 대해 특별한 요구 사항이 있으며, 특히 도구 호출 관련 메시지 구조가 그렇습니다:

1. 시스템 메시지 (`system`): 대화 메시지와 분리되며 `system` 파라미터를 통해 전달
2. 사용자 메시지 (`user`): `content` 배열을 포함하며, 텍스트 및 이미지 가능
3. 어시스턴트 메시지 (`assistant`): 도구 호출 포함 가능, `tool_use` 타입의 콘텐츠 블록 사용
4. 도구 응답 (`tool_result`): 사용자 메시지의 일부로 포함됨

`formatMessages` 메서드는 표준 채팅 메시지를 Anthropic 포맷으로 변환합니다:

```typescript

privateformatMessages(messages: ChatMessage[]): {

  system?:string;

  messages: Anthropic.MessageParam[];

}

```

### 스트리밍 처리

Claude API는 도구 호출 이벤트를 다음과 같이 반환합니다:

-`content_block_start` (타입 `tool_use`): 도구 호출 시작

-`content_block_delta` (`input_json_delta` 포함): 도구 인자 스트리밍 업데이트

-`content_block_stop`: 도구 호출 종료

-`message_delta` (`stop_reason: 'tool_use'` 포함): 도구 호출로 인해 응답 생성이 중단됨

이러한 이벤트는 다음과 같은 표준화된 `LLMCoreStreamEvent` 이벤트로 변환됩니다:

```typescript

{

  type: 'tool_call_start'|'tool_call_chunk'|'tool_call_end';

  tool_call_id?:string;

  tool_call_name?:string;

  tool_call_arguments_chunk?:string;

  tool_call_arguments_complete?:string;

}

```


## Anthropic Tool Use 구현 예시

### 도구 정의

먼저, getTime 도구를 정의합니다:

```json

{

  "name": "getTime",

  "description": "특정 시간 오프셋의 타임스탬프(밀리초)를 가져옵니다. 과거 또는 미래의 시간을 얻는 데 사용할 수 있습니다. 양수는 미래를, 음수는 과거를 나타냅니다. 예를 들어, 어제의 타임스탬프를 얻으려면 오프셋으로 -86400000을 사용하세요(하루의 밀리초 수).",

  "input_schema": {

    "type": "object",

    "properties": {

      "offset_ms": {

        "type": "number",

        "description": "현재 시간 기준의 밀리초 오프셋입니다. 음수는 과거, 양수는 미래를 의미합니다."

      }

    },

    "required": ["offset_ms"]

  }

}

```

### 사용자 요청 예시

```json

{

  "role": "user",

  "content": [

    {

      "type": "text",

      "text": "어제가 언제였는지 알려줘."

    }

  ]

}

```

### 대형 모델 응답

```json

{

  "role": "assistant",

  "content": [

    {

      "type": "text",

      "text": "어제가 언제인지 알려면 어제의 타임스탬프를 가져와야 해요."

    },

    {

      "type": "tool_use",

      "id": "toolu_01ABCDEFGHIJKLMNOPQRST",

      "name": "getTime",

      "input": {"offset_ms": -86400000}

    }

  ]

}

```

### MCP 모듈 실행 명령

```json

{

  "role": "user",

  "content": [

    {

      "type": "tool_result",

      "tool_use_id": "toolu_01ABCDEFGHIJKLMNOPQRST",

      "result": "1684713600000"

    }

  ]

}

```

### 최종 모델 응답

```json

{

  "role": "assistant",

  "content": [

    {

      "type": "text",

      "text": "얻은 타임스탬프 1684713600000에 따르면 어제는 2023년 5월 22일입니다. 이 타임스탬프는 1970년 1월 1일부터 어제까지의 밀리초 수를 의미합니다."

    }

  ]

}

```

## Gemini Tool API 및 컨텍스트 구성 형식

Gemini는 `GeminiProvider` 클래스를 통해 도구 호출 기능을 구현하며, Gemini Pro 이상 모델을 지원합니다.

### 형식 변환

Gemini는 도구 정의를 다음 형식으로 전달해야 합니다:

```typescript

{

  tools: [

    {

      functionDeclarations: [

        {

          name:string,

          description:string,

          parameters:object// OpenAPI 형식의 JSON Schema

        }

      ]

    }

  ]

}

```

### 컨텍스트 구성

Gemini의 메시지 구조는 비교적 간단하지만 특별한 처리 방식이 있습니다:

1. systemInstruction: 시스템 지침은 별도 파라미터로 전달
2. contents 배열: 사용자 및 모델 메시지를 포함
3. 도구 호출: `functionCall` 객체로 표시
4. 도구 응답: `functionResponse` 객체로 표시

### 스트리밍 처리

Gemini의 스트리밍 응답에서는 다음과 같은 특별 이벤트를 처리해야 합니다:

-`functionCall`: 도구 호출 시작을 의미

- 함수 인자는 `functionCall.args`로 전달됨

-`functionCallResult` 이벤트는 도구 응답을 나타냄

이러한 이벤트는 모두 표준화된 `LLMCoreStreamEvent` 형식으로 변환되어 통합 처리됩니다.

## 예시: Gemini의 Tool Use 구현

### 도구 정의

```json

{

  "tools": [

    {

      "functionDeclarations": [

        {

          "name": "getTime",

          "description": "특정 시간 오프셋의 타임스탬프(밀리초)를 가져옵니다.",

          "parameters": {

            "type": "object",

            "properties": {

              "offset_ms": {

                "type": "number",

                "description": "현재 시간 기준의 밀리초 오프셋입니다. 음수는 과거, 양수는 미래입니다."

              }

            },

            "required": ["offset_ms"]

          }

        }

      ]

    }

  ]

}

```

### 사용자 요청 예시

```json

{

  "role": "user",

  "parts": [

    {

      "text": "어제가 언제였는지 알려줘."

    }

  ]

}

```

### 모델 응답 (도구 호출)

```json

{

  "role": "model",

  "parts": [

    {

      "functionCall": {

        "name": "getTime",

        "args": {

          "offset_ms": -86400000

        }

      }

    }

  ]

}

```

### MCP 모듈 실행 명령

```json

{

  "role": "user",

  "parts": [

    {

      "functionResponse": {

        "name": "getTime",

        "response": 1684713600000

      }

    }

  ]

}

```


### 최종 모델 응답

```json

{

  "role": "model",

  "parts": [

    {

      "text": "얻은 타임스탬프 1684713600000에 따르면 어제는 2023년 5월 22일입니다."

    }

  ]

}

```

## OpenAI Tool API 및 컨텍스트 구성 형식

OpenAI의 도구 호출 기능은 `OpenAICompatibleProvider` 클래스에서 구현되며, GPT-3.5-Turbo 및 GPT-4 시리즈 모델을 지원합니다.

### 형식 변환

OpenAI의 함수 호출 형식은 가장 널리 사용되는 방식입니다:

```typescript

{

  tools: [

    {

      type:"function",

      function: {

        name:string,

        description:string,

        parameters:object// JSON Schema 형식

      }

    }

  ]

}

```

### 컨텍스트 구성

OpenAI의 메시지 형식은 비교적 표준화되어 있습니다:

1. 메시지 배열 (`messages`): `role`과 `content`를 포함
2. 도구 호출: `assistant` 메시지의 `tool_calls` 배열에 기록됨
3. 도구 응답: `tool` 역할 메시지로 별도로 추가되며 `tool_call_id` 참조 포함

### 스트리밍 처리

OpenAI의 스트리밍 이벤트는 다음을 포함합니다:

-`tool_calls` 배열: 도구 호출을 나타냄

- 스트리밍 API의 `delta.tool_calls`: 도구 호출의 점진적 업데이트
- 도구 인자는 `tool_calls[i].function.arguments`를 통해 전달

이러한 이벤트는 모두 표준 `LLMCoreStreamEvent` 형식으로 변환됩니다.

## 예시: OpenAI의 Tool Use 구현

### 도구 정의

```json

{

  "tools": [

    {

      "type": "function",

      "function": {

        "name": "getTime",

        "description": "특정 시간 오프셋의 타임스탬프(밀리초)를 가져옵니다.",

        "parameters": {

          "type": "object",

          "properties": {

            "offset_ms": {

              "type": "number",

              "description": "현재 시간 기준의 밀리초 오프셋입니다. 음수는 과거, 양수는 미래를 의미합니다."

            }

          },

          "required": ["offset_ms"]

        }

      }

    }

  ]

}

```

### 사용자 요청 예시

```json

[

  {

    "role": "user",

    "content": "어제가 언제였는지 알려줘."

  }

]

```

### 모델 응답 (도구 호출)

```json

[

  {

    "role": "assistant",

    "content": null,

    "tool_calls": [

      {

        "id": "call_abc123",

        "type": "function",

        "function": {

          "name": "getTime",

          "arguments": "{ \"offset_ms\": -86400000 }"

        }

      }

    ]

  }

]

```

### MCP 모듈 실행 명령

```json

[

  {

    "role": "tool",

    "tool_call_id": "call_abc123",

    "content": "1684713600000"

  }

]

```

### 최종 모델 응답

```json

[

  {

    "role": "assistant",

    "content": "얻은 타임스탬프 1684713600000에 따르면 어제는 2023년 5월 22일입니다."

  }

]

```

## Tool Use 미지원 모델에서의 프롬프트 엔지니어링 기반 구현 및 스트리밍 함수 정보 파싱

도구 호출을 원래 지원하지 않는 모델에 대해, 본 프로젝트는 프롬프트 엔지니어링을 기반으로 한 대체 방식을 제공합니다.

### 프롬프트 래핑

`OpenAICompatibleProvider`의 `prepareFunctionCallPrompt` 메서드에 의해 구현됩니다:

```typescript

privateprepareFunctionCallPrompt(

  messages: ChatCompletionMessageParam[],

  mcpTools: MCPToolDefinition[]

): ChatCompletionMessageParam[]

```

이 메서드는 도구 정의를 시스템 메시지에 지침으로 추가합니다. 포함 내용:

1. 도구 호출 포맷 설명 (보통 `<function_call>`과 같은 XML 스타일 태그 사용)
2. 도구 정의의 JSON Schema
3. 사용 예시와 포맷 요구사항

### 스트리밍 응답 파싱

스트리밍된 텍스트에서 함수 호출을 파싱하기 위해 정규식과 상태 머신 사용:

```typescript

protectedparseFunctionCalls(

  response: string,

  fallbackIdPrefix: string = 'tool-call'

): Array<{ id: string; type: string; function: { name: string; arguments: string } }>

```

처리 도전 과제:

1. 함수 호출의 시작과 끝 태그 탐지
2. 중첩된 JSON 구조 처리
3. 불완전하거나 잘못된 함수 호출 처리
4. 함수 호출에 고유 ID 부여

상태 머신 (`TagState`)을 사용하여 태그 상태 추적:

```typescript

typeTagState = 'none' | 'start' | 'inside' | 'end'

```

복잡한 스트리밍 생성 중에도 함수 호출 정보를 정확히 식별하고 추출 가능

### 동일한 getTime 예시로 본 프롬프트 기반 처리 흐름

1. 시스템 프롬프트에 함수 설명 추가:

```

당신은 유용한 AI 어시스턴트입니다. 필요한 경우 다음 도구를 사용해 문제를 해결할 수 있습니다:


function getTime(offset_ms: number): number

설명: 현재 시간 기준으로 오프셋된 타임스탬프(밀리초)를 반환합니다.

매개변수:

  - offset_ms: 시간 오프셋 (밀리초)


도구를 사용할 때는 다음과 같은 형식을 사용하세요:

<function_call>

{

  "name": "getTime",

  "arguments": {

    "offset_ms": -86400000

  }

}

</function_call>

```

2. 모델이 함수 호출 태그 포함 응답 생성:

```

어제 날짜를 얻기 위해 getTime 함수를 호출하겠습니다.


<function_call>

{

  "name": "getTime",

  "arguments": {

    "offset_ms": -86400000

  }

}

</function_call>

```

3. 정규 표현식을 사용해 함수 호출 파싱:

```typescript

// 상태기반 파서와 정규식으로 <function_call> 내용 추출

constfunctionCallMatch = response.match(/<function_call>([\s\S]*?)<\/function_call>/);

if (functionCallMatch) {

  try {

    constparsedCall = JSON.parse(functionCallMatch[1]);

    // 함수 호출 실행 및 결과 획득

  } catch (error) {

    // 파싱 오류 처리

  }

}

```

4. 함수 결과를 컨텍스트에 추가:

```

함수 결과: 1684713600000


얻은 타임스탬프에 따르면 어제는 5월 22일입니다.

```

이 방법은 정교한 프롬프트 구성과 텍스트 파싱을 통해 원래 Tool Use 기능이 없는 모델에서도 도구 호출 시뮬레이션을 가능하게 합니다.
