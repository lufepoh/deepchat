
# DeepChat 개발자 가이드

이 가이드는 DeepChat 프로젝트를 이해하고, 빌드하며, 기여하고자 하는 개발자를 위한 안내서입니다.

## 📑 목차

- [DeepChat 개발자 가이드](#deepchat-개발자-가이드)
  - [📑 목차](#-목차)
  - [프로젝트 구조](#프로젝트-구조)
  - [아키텍처 개요](#아키텍처-개요)
    - [Electron 아키텍처](#electron-아키텍처)
    - [기술 스택](#기술-스택)
    - [설계 문서](#설계-문서)
  - [API 문서](#api-문서)
  - [모델 컨트롤러 플랫폼 (MCP)](#모델-컨트롤러-플랫폼-mcp)
  - [개발 환경 설정](#개발-환경-설정)
  - [애플리케이션 빌드](#애플리케이션-빌드)
  - [기여 가이드라인](#기여-가이드라인)

## 프로젝트 구조

DeepChat 저장소는 다음과 같은 주요 디렉토리로 구성되어 있습니다:

- **`src/`**: 애플리케이션의 핵심 소스 코드
  - **`src/main/`**: Electron 메인 프로세스 코드 (창 관리, 시스템 이벤트, 백엔드 로직)
  - **`src/renderer/`**: Electron 렌더러 프로세스 코드 (UI 및 프론트엔드 로직)
  - **`src/preload/`**: 렌더러 로드 전 실행되는 스크립트로 메인 ↔ 렌더러 IPC 브리지 역할
  - **`src/shared/`**: 메인과 렌더러 간에 공유되는 타입 정의 및 인터페이스
- **`docs/`**: 설계 문서, 사용자 가이드, 개발자 가이드 포함
- **`scripts/`**: 빌드, 패키징, 개발 관련 스크립트
- **`build/`**: 빌드 설정 파일 및 아이콘 등 애셋
- **`resources/`**: 런타임에서 사용되는 정적 리소스
- **`runtime/`**: MCP 관련 Node.js 런타임 등 실행 환경 포함
- **`.github/`**: 이슈 템플릿, PR 템플릿, CI/CD 워크플로우 설정

자세한 내용은 [../CONTRIBUTING.md](../CONTRIBUTING.md)의 "Project Structure" 섹션을 참고하세요.

## 아키텍처 개요

### Electron 아키텍처

DeepChat은 Electron 기반 애플리케이션입니다:

- **메인 프로세스**: 앱의 진입점으로 Node.js를 실행하며 시스템 수준 작업 담당 (`src/main/`)
- **렌더러 프로세스**: 각 창마다 별도로 실행되며 HTML/CSS/JS 기반 UI 처리 (`src/renderer/`)
- **프리로드 스크립트**: Node.js API를 렌더러에 노출하는 안전한 IPC 브리지 역할 (`src/preload/`)
- **IPC 통신**: `ipcMain`, `ipcRenderer` 또는 context bridge를 통해 프로세스 간 통신 수행

### 기술 스택

- **백엔드 (메인 프로세스)**: TypeScript
- **프론트엔드 (렌더러 프로세스)**: Vue 3, TypeScript, Pinia, Vue Router
- **스타일링**: Tailwind CSS, Shadcn/ui 컴포넌트 (예상)
- **빌드 도구**: Electron Vite (`electron.vite.config.ts`)
- **패키징**: Electron Builder (`electron-builder.yml`)

### 설계 문서

`docs/` 디렉토리 내 주요 문서:

- [다중 창 아키텍처](./multi-window-architecture.md)
- [이벤트 시스템 설계](./event-system-design.md)
- [Config Presenter 아키텍처](./config-presenter-architecture.md)
- [MCP Presenter 설계](./mcp-presenter-design.md)

DeepChat의 구조를 깊이 이해하기 위해 이 문서들을 참고하세요.

## API 문서

별도의 API 문서 사이트는 없을 수 있지만, IPC와 presenter 인터페이스를 이해하려면 다음을 참고하세요:

- **`shared/presenter.d.ts`**: 메인 ↔ 렌더러 간 기능 계약 정의
- **`src/preload/index.d.ts`**: 프리로드 스크립트가 렌더러에 노출하는 API 정의

이 정의 파일들을 참고하여 모듈 간 상호작용을 이해하는 것이 중요합니다.

## 모델 컨트롤러 플랫폼 (MCP)

MCP는 DeepChat의 핵심 기능 중 하나로 도구 호출, 검색 강화 등의 고급 기능을 지원합니다.

- LLM이 리소스, 프롬프트, 도구를 사용할 수 있도록 지원
- 코드 실행, 웹 정보 수집, 파일 조작 가능
- 시각적 도구 설정 UI 및 디버깅 창 제공
- 다양한 통신 프로토콜(StreamableHTTP, SSE, stdio 등) 및 메모리 내 서비스 지원

자세한 내용은 다음 문서를 참고하세요:

- [Function Call and MCP](./function-call-and-mcp.md)
- [MCP Presenter Architecture](./mcp-presenter-architecture.md)
- [MCP Presenter Design](./mcp-presenter-design.md)
- [../README.md](../README.md)의 "Excellent MCP Support" 섹션

## 개발 환경 설정

로컬 개발 환경 설정 절차:

1. 저장소 클론
2. Node.js (최신 LTS 권장) 설치
3. OS별 의존성 (예: C++ 빌드 툴, Git) 설치
4. 프로젝트 의존성 설치 (`npm install` 또는 `yarn install`)

자세한 가이드는 다음에서 확인할 수 있습니다:

- [README.md 개발 가이드](https://github.com/ThinkInAIXYZ/deepchat#%EF%B8%8F-development-guide)
- [../CONTRIBUTING.md](../CONTRIBUTING.md)의 "Local Development Setup" 섹션

설정 후 `npm run dev` 또는 `yarn dev` 명령으로 개발 서버를 시작할 수 있습니다.

## 애플리케이션 빌드

Windows, macOS, Linux 각각에 대한 빌드 명령은 `README.md`의 다음 섹션에서 확인할 수 있습니다:

- [Build](https://github.com/ThinkInAIXYZ/deepchat#build)

또한 Windows/Linux는 GitHub Actions를 통해 패키징되며, macOS는 별도 [Mac 릴리스 가이드](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-Release-Guide)를 따릅니다.

## 기여 가이드라인

DeepChat에 기여하고 싶으시면 기여 지침을 검토해 주세요. 여기에는 다음이 포함됩니다:

- 내부 및 외부 기여자를 위한 개발 프로세스.
- 코딩 스타일 (ESLint, 더 예뻐짐).
- 요청 가져오기 프로세스.

전체 지침은 다음에서 찾을 수 있습니다:
- [CONTRIBUTING.md ](/CONTRIBUTING.md )
- 메인 'README.md ' 파일의 "[커뮤니티 및 기여](https://github.com/ThinkInAIXYZ/deepchat#community--contribution) " 섹션.

---

이 가이드는 개발자에게 좋은 출발점을 제공할 것입니다. 구체적인 질문이나 심층 분석에 대해서는 링크된 문서와 소스 코드를 참조하세요. 'docs/developer-guide.md '의 콘텐츠 초안이 작성되었습니다. 여기에는 다음이 포함됩니다:
- 프로젝트 구조: 'ls ()' 출력과 'CONTRIBUTING.md '을 기반으로 합니다.
- 아키텍처 개요: Electron의 주요/렌더러 아키텍처인 기술 스택(Vue.js, TypeScript)을 설명하고, 앞서 확인한 'docs/'의 관련 문서로 연결합니다.
- API 문서: 'shared/present.d.ts'와 'src/preload/index.d.ts'를 가리킵니다.
- 모델 컨트롤러 플랫폼(MCP): 'README.md '을 기반으로 목적을 설명하고 'docs/function-call-and-mcp.md ' 및 기타 MCP 관련 아키텍처 문서에 링크합니다.
- 개발 설정: 'README.md ' 및 'CONTRIBUTING.md '의 관련 섹션으로 연결합니다.
- 애플리케이션 구축: 'README.md '의 관련 섹션으로 연결하기.
- 기여 지침: 'CONTRIBUTING.md ' 링크.

'README.md ' 섹션에 대한 링크 경로는 'developer-guide.md '이 'docs/' 디렉토리에 있다고 가정하여 구성됩니다. 'CONTRIBUTING.md '의 경우 루트 'CONTRIBUTING.md '을 가리키기 위해 조정이 필요할 수 있는 상대 링크 '//CONTRIBUTING.md '을 사용했습니다('../CONTRIBUTING.md '이어야 함). 루트 디렉토리의 파일에는 '..../CONTRIBUTING.md '과 '..../README.md '을, 'docs/' 디렉토리 자체의 파일에는 '.filename.md '을 사용하겠습니다. 이를 반영하여 초안을 업데이트했습니다.

이제 파일을 만들겠습니다.
