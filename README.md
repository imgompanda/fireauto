<p align="center">
  <img src="fireauto.png" alt="fireauto" width="400" />
</p>

<h1 align="center">fireauto</h1>

<p align="center">
  1년간 Claude Code를 쓰면서 쌓인 기억을 플러그인으로 만들었어요.<br/>
  AI 서비스 40개를 만들면서 매일 반복한 작업들,<br/>
  이제 커맨드 하나로 누구나 쓸 수 있어요.
</p>

<p align="center">
  <a href="#설치하기">설치하기</a> · <a href="#어떤-기능이-있나요">기능</a> · <a href="#하나씩-알아볼게요">사용법</a> · <a href="#자주-묻는-질문">FAQ</a>
</p>

---

## 이게 뭔가요?

**fireauto**는 Claude Code에서 쓸 수 있는 자동화 플러그인이에요.

터미널에서 `/fireauto-seo`라고 입력하면 AI가 알아서 SEO를 점검하고,
`/fireauto-secure`라고 입력하면 보안 취약점을 찾아줘요.

사람이 하면 반나절 걸리는 일을, 커맨드 하나로 끝낼 수 있어요.

> Claude Code가 처음이라면 [아래 설명](#claude-code가-뭔가요)부터 읽어주세요.

## 어떤 기능이 있나요?

| 커맨드 | 한 줄 설명 |
|--------|-----------|
| `/fireauto-prd` | 아이디어 한 줄로 PRD 문서 만들기 |
| `/fireauto-research` | 레딧에서 내 고객 찾기 |
| `/fireauto-team` | 여러 AI가 동시에 일하게 하기 |
| `/fireauto-team-chat` | AI끼리 대화하며 협업하기 |
| `/fireauto-team-status` | 지금 AI가 뭐 하고 있는지 확인하기 |
| `/fireauto-seo` | 내 사이트 SEO 자동 점검 |
| `/fireauto-secure` | 내 코드 보안 취약점 자동 점검 |
| `/fireauto-ui` | DaisyUI로 예쁜 UI 만들기 |

## 먼저 준비할 것

### 1. Claude Code 설치

fireauto는 Claude Code 안에서 돌아가요. 먼저 Claude Code를 설치해주세요.

```bash
npm install -g @anthropic-ai/claude-code
```

설치가 됐는지 확인해볼게요.

```bash
claude --version
```

버전 번호가 나오면 성공이에요.

> Claude Code는 Anthropic이 만든 공식 AI 코딩 도구예요.
> 터미널에서 AI랑 대화하면서 코드를 읽고, 수정하고, 실행할 수 있어요.
> 더 자세한 설명: https://docs.anthropic.com/en/docs/claude-code

### 2. Anthropic 계정

Claude Code를 쓰려면 다음 중 하나가 필요해요.
- **Claude Max/Pro 구독** (가장 편해요)
- **Anthropic API 크레딧**

## 설치하기

### GitHub에서 설치하기 (추천)

```bash
# 1. 터미널에서 Claude Code를 실행해요
claude

# 2. 아래 명령어를 그대로 입력해요
/plugin marketplace add imgompanda/fireauto

# 3. 플러그인을 설치해요
/plugin install fireauto@fireauto
```

끝이에요. 이제 `/fireauto-seo` 같은 커맨드를 바로 쓸 수 있어요.

### 직접 다운로드해서 설치하기

GitHub에서 설치가 안 되면 이 방법을 써보세요.

```bash
# 1. 저장소를 다운로드해요
git clone https://github.com/imgompanda/fireauto.git

# 2. Claude Code를 실행해요
claude

# 3. 다운받은 폴더를 마켓플레이스로 등록해요
/plugin marketplace add ./fireauto

# 4. 플러그인을 설치해요
/plugin install fireauto@fireauto
```

### 설치됐는지 확인하기

Claude Code 안에서 이렇게 입력해보세요.

```
/plugin
```

플러그인 목록에 fireauto가 보이면 성공이에요.

### 팀이랑 같이 쓰고 싶다면

```bash
# 나만 쓸래요 (기본값)
/plugin install fireauto@fireauto

# 팀 전체가 쓸 수 있게 (프로젝트 git에 포함돼요)
/plugin install fireauto@fireauto --scope project
```

## 하나씩 알아볼게요

### `/fireauto-prd` — 아이디어 한 줄로 PRD 만들기

"이런 서비스 만들고 싶은데..." 한 줄만 적으면, 상세한 기획서가 나와요.

```
/fireauto-prd
```

이렇게 물어볼 거예요:
- **어떤 서비스를 만들고 싶으세요?** (한 줄이면 충분해요)
- 타겟 사용자는요? (안 적어도 돼요)
- 비슷한 서비스 알고 있나요? (안 적어도 돼요)

예를 들어 "화학물질 SDS 자동 생성 서비스"라고만 적으면, 이런 걸 만들어줘요:

- **프로젝트 개요** — 서비스명, 해결하는 문제, 타겟 사용자
- **핵심 기능** — MVP 필수 기능(P0), 있으면 좋은 기능(P1), 확장 기능(P2)
- **실현 가능성 조사** — 기술적 난이도, 위험 요소, 대안 접근법
- **필요한 API/서비스** — 실제로 쓸 수 있는 API를 찾아서 가격, 제한사항까지 정리
- **경쟁사 분석** — 비슷한 서비스 찾아서 가격, 기능, 차별점 비교
- **기술 스택 제안** — 프론트/백/DB/인프라 추천 + 예상 월 비용
- **수익 모델** — 가격 전략, 시장 규모 추정
- **구현 로드맵** — Phase 1(MVP) → Phase 2(성장) → Phase 3(확장)

`docs/prd/` 폴더에 마크다운 문서로 저장돼요.

### `/fireauto-research` — 레딧에서 내 고객 찾기

새로운 서비스를 만들기 전에, 진짜 이걸 원하는 사람이 있는지 확인하고 싶잖아요.

레딧에서 관련 게시글을 찾아서, 누가 진짜 고객인지 점수를 매겨줘요.

```
/fireauto-research
```

이렇게 물어볼 거예요:
- **키워드**: 뭘 찾을까요? (예: "SDS authoring", "화장품 성분 분석")
- **서브레딧**: 어디서 찾을까요? (기본값이 있어서 그냥 엔터 쳐도 돼요)
- **고객 정의**: 어떤 사람을 찾고 있나요? (예: "화학물질 규제가 힘든 소규모 제조사")

결과로 이런 걸 받아요:
- **리드 점수표** (CSV) — 누가 가장 유망한 고객인지 1~10점으로 스코어링
- **고충 분류** — 비용 문제? 시간 문제? 규제 문제? 카테고리별로 정리
- **요약 리포트** — 한눈에 볼 수 있는 마크다운 문서

### `/fireauto-team` — 여러 AI가 동시에 일하게 하기

혼자서 할 수 있지만, 여러 AI가 나눠서 하면 훨씬 빨라요.

```
/fireauto-team
```

예를 들어 "랜딩페이지 전체를 리뉴얼해줘"라고 하면:
- **AI 1번**: 헤더랑 푸터 담당
- **AI 2번**: 히어로 섹션이랑 가격 섹션 담당
- **AI 3번**: 반응형 + 접근성 담당

각자 맡은 부분을 동시에 작업하고, 끝나면 자동으로 합쳐줘요.

### `/fireauto-team-chat` — AI끼리 대화하며 협업하기

여러 AI가 일할 때, 서로 물어볼 게 생기잖아요.

```
/fireauto-team-chat
```

실제 대화 예시:
```
[14:35] @프론트엔드 → @백엔드: UserProfile에 avatarUrl 추가해줄 수 있어요?
[14:40] @백엔드 → @프론트엔드: 추가했어요. null일 수 있으니 fallback 처리 부탁해요.
[14:45] @코디네이터 → @전체: 공유 타입은 src/types/shared.ts에서만 수정해주세요.
```

메시지 보드를 확인하고, 직접 메시지를 보낼 수도 있어요.

### `/fireauto-seo` — 내 사이트 SEO 자동 점검

검색엔진에 잘 노출되고 있는지, 7개 영역을 자동으로 점검해요.

```
/fireauto-seo
```

점검하는 것들:
- robots.txt, sitemap.xml이 제대로 되어 있는지
- JSON-LD 구조화 데이터가 올바른지
- 메타 태그 (title, description, OG 이미지)
- 페이지 중복이나 빈 콘텐츠는 없는지
- 리다이렉트가 꼬여 있지 않은지
- 로딩 속도에 영향주는 요소

결과는 심각도별로 정리돼요: P0(지금 당장 고쳐야 함) ~ P3(나중에 해도 됨)

### `/fireauto-secure` — 내 코드 보안 점검

"혹시 내 코드에 보안 구멍이 있진 않을까?" 싶을 때 써보세요.

```
/fireauto-secure
```

이런 걸 찾아줘요:
- **.env 파일**이 코드에 들어가 있진 않은지
- **인증 없는 API**가 열려 있지 않은지
- AI 엔드포인트에 **rate limit**이 걸려 있는지
- 파일 업로드할 때 **위험한 파일**을 막고 있는지
- 사용자 입력이 AI 프롬프트에 **그대로 들어가진** 않는지
- npm 패키지에 **알려진 취약점**이 있는지

CRITICAL/HIGH/MEDIUM/LOW로 나눠서 보여주고, 어떻게 고치면 되는지도 알려줘요.

### `/fireauto-ui` — DaisyUI로 예쁜 UI 만들기

DaisyUI v5 컴포넌트를 최대한 활용해서 UI를 만들어줘요.

```
/fireauto-ui
```

3가지 모드가 있어요:
- **build** — 처음부터 DaisyUI로 UI 만들기
- **migrate** — 기존 shadcn/ui를 DaisyUI로 바꾸기
- **theme** — DaisyUI 테마 색상 설정하기

## 플러그인 관리하기

```bash
# 최신 버전으로 업데이트
/plugin update fireauto

# 잠깐 끄기
/plugin disable fireauto

# 다시 켜기
/plugin enable fireauto

# 완전히 삭제
/plugin uninstall fireauto
```

## 폴더 구조

```
fireauto/
├── .claude-plugin/
│   └── plugin.json          # 플러그인 설정 파일
├── commands/                # 슬래시 커맨드 (8개)
│   ├── fireauto-prd.md
│   ├── fireauto-research.md
│   ├── fireauto-team.md
│   ├── fireauto-team-status.md
│   ├── fireauto-team-chat.md
│   ├── fireauto-seo.md
│   ├── fireauto-secure.md
│   └── fireauto-ui.md
├── agents/                  # AI 에이전트 (6개)
│   ├── prd-researcher.md
│   ├── research-analyzer.md
│   ├── team-coordinator.md
│   ├── seo-auditor.md
│   ├── security-auditor.md
│   └── ui-builder.md
├── skills/                  # 자동 트리거 스킬 (7개)
│   ├── fireauto-prd/SKILL.md
│   ├── fireauto-research/SKILL.md + references/
│   ├── fireauto-team/SKILL.md
│   ├── fireauto-seo/SKILL.md + references/
│   ├── fireauto-secure/SKILL.md + references/
│   ├── fireauto-ui/SKILL.md + references/
│   └── fireauto-mem/SKILL.md
├── fireauto.png
└── README.md
```

### Commands, Skills, Agents가 뭐가 다른 건가요?

| 종류 | 설명 |
|------|------|
| **Commands** | `/fireauto-seo`처럼 직접 입력해서 실행하는 거예요 |
| **Skills** | "SEO 점검해줘"처럼 말하면 알아서 켜지는 거예요 |
| **Agents** | 실제로 분석하고 작업하는 AI 일꾼이에요 |

커맨드를 실행하면 → 스킬이 맥락을 잡고 → 에이전트가 일하는 구조예요.

## 자주 묻는 질문

### Claude Code가 뭔가요?

Anthropic이 만든 공식 AI 코딩 도구예요. 터미널에서 실행하면 AI랑 대화하면서 코딩할 수 있어요.

```bash
# 설치
npm install -g @anthropic-ai/claude-code

# 내 프로젝트에서 실행
cd my-project
claude
```

VS Code 같은 에디터 없이, 터미널에서 바로 "이 버그 고쳐줘", "테스트 만들어줘" 같은 걸 할 수 있어요.

### 돈이 드나요?

fireauto 자체는 무료예요. MIT 라이선스라 마음대로 쓰시면 돼요.

다만 Claude Code를 쓰려면 아래 중 하나가 필요해요:
- **Claude Max 구독** ($100/월 또는 $200/월) — 가장 추천
- **Claude Pro 구독** ($20/월) — 사용량 제한 있음
- **Anthropic API 크레딧** — 쓴 만큼 과금

### 어떤 프로젝트에서 쓸 수 있어요?

| 커맨드 | 이런 프로젝트에 딱이에요 |
|--------|----------------------|
| `/fireauto-prd` | 아이디어를 구체적인 기획서로 만들 때 |
| `/fireauto-research` | 뭐든 새로 만들기 전에 시장 조사할 때 |
| `/fireauto-team` | 규모 큰 작업을 빨리 끝내고 싶을 때 |
| `/fireauto-seo` | 웹사이트 검색 노출을 개선하고 싶을 때 |
| `/fireauto-secure` | 서비스 런칭 전 보안 점검할 때 |
| `/fireauto-ui` | Tailwind CSS + DaisyUI 쓰는 프로젝트 |

### 에러가 나면 어떻게 하나요?

1. Claude Code가 최신 버전인지 확인해보세요
   ```bash
   npm update -g @anthropic-ai/claude-code
   ```

2. 플러그인을 다시 설치해보세요
   ```
   /plugin uninstall fireauto
   /plugin install fireauto@fireauto
   ```

3. 그래도 안 되면 [이슈를 남겨주세요](https://github.com/imgompanda/fireauto/issues)

---

---

## FireShip 부트캠프

> **수익화 바이브 코딩 부트캠프** — 5일 만에 AI 서비스 기획부터 배포까지

fireauto를 만든 사람이 직접 가르치는 부트캠프예요.

### 이런 분에게 추천해요

- 유튜브 강의 따라 해봤는데 결국 내 서비스는 하나도 못 만든 분
- Claude Code + AI SDK로 직접 서비스를 만들고 싶은 분
- 만드는 것뿐 아니라 수익화까지 하고 싶은 분

### 5일 커리큘럼

| 날짜 | 내용 |
|------|------|
| Day 1 (월) | Claude Code 세팅 + AI SDK + MCP 활용 |
| Day 2 (화) | AI 이미지 생성 서비스, RAG 챗봇 구축 실습 |
| Day 3 (수) | 결제 연동 + 수익화 + 레딧 수요조사 + 아이디어 확정 |
| Day 4 (목) | 내 서비스 만들기 + 1:1 코칭 |
| Day 5 (금) | 완성 + 배포 + 런칭 준비 |

### 포함 내용

- 40개 서비스를 만들며 다듬은 **보일러플레이트 평생 제공** + 업데이트
- 기수별 단톡방 + **수료생 전용 커뮤니티** (전 기수 통합)
- 수요 검증, 고객 찾기, 세일즈, 비용 관리, 운영까지 전부

> S전자 강의 수강생 만족도 **4.8점** · 누적 수강생 **200명+** · **10명 한정** 소수 정예

**[부트캠프 자세히 보기 →](https://fireship.me/ko/bootcamp)**

---

## 기업 AX (AI Transformation)

> 강의에서 끝나지 않습니다. 실제로 돌아가는 시스템을 만들어드립니다.

### 제공 서비스

| 서비스 | 설명 | 성과 |
|--------|------|------|
| **임직원 교육** | 클로드 코드 기초부터 실무 활용. 비개발자도 참여 가능 | 업무 생산성 40%↑ |
| **맞춤형 자동화 구축** | 반복 업무를 AI 기반 자동화 시스템으로 전환 | 반복 업무 70% 절감 |
| **사내 툴 개발** | 외부 SaaS 대체하는 맞춤형 AI 툴 구축 | SaaS 비용 60% 절감 |

### 케이스 스터디

- **S전자** — MX·VD 사업부 대상 바이브 코딩 실무 교육 (만족도 4.8점)
- **SDS** — 도메인 지식 기반 니치 B2B SaaS 기획~해외 런칭 ($8K MRR 달성)
- **기업 맞춤 자동화** — 주간 보고서 자동 생성, 데이터 수집 파이프라인, 이메일 자동 분류

**[기업 문의하기 →](https://fireship.me/ko/enterprise)**

---

## About

Made by [FreAiner](https://fireship.me)

1년간 AI 서비스 40개를 만들고, 그 중 3개를 수익화한 1인 개발자예요.
매일 반복하던 작업을 자동화한 도구들을 모아서 공개합니다.

- Web: [fireship.me](https://fireship.me)
- Threads: [@freainer](https://www.threads.net/@freainer)

## License

MIT
