# 개발 가이드라인 (Dev Guidelines)

> 이 문서는 **'민국이의 꿈' 프로젝트에서 실전 검증된 코딩 패턴과 구조적 규칙**을 정리한다.
> 새 기능을 추가하거나 기존 코드를 수정할 때 이 문서를 먼저 읽고 패턴을 따른다.
> `project_context.md`의 섹션 5와 함께 읽는다.

최초 작성: 2026-05-05

---

## 목차
1. [Zustand 스토어 패턴](#1-zustand-스토어-패턴)
2. [RTDB 구독 패턴](#2-rtdb-구독-패턴)
3. [SSOT 원칙](#3-ssot-단일-진실-공급원-원칙)
4. [React 훅 작성 규칙](#4-react-훅-작성-규칙)
5. [모듈화 패턴 (ROUNDS / RoundTabShell)](#5-모듈화-패턴--rounds--roundtabshell)
6. [컴포넌트 Props 규칙](#6-컴포넌트-props-규칙)
7. [Dead Code 관리](#7-dead-code-관리)
8. [Tailwind 색상 패턴](#8-tailwind-색상-패턴)
9. [배포 워크플로](#9-배포-워크플로)
10. [문서 업데이트 규칙](#10-문서-업데이트-규칙)

---

## 1. Zustand 스토어 패턴

### ✅ 올바른 셀렉터 — 항상 개별 값 선택

```js
// ✅ 올바름
const roomCode   = useGameStore((s) => s.roomCode)
const role       = useGameStore((s) => s.role)
const myStudentId = useGameStore((s) => s.myStudentId)
```

### ❌ 절대 금지 — getState() 를 렌더 흐름에서 사용

```js
// ❌ 금지: useEffect 안에서 getState() 로 roomCode 읽기
useEffect(() => {
  const rc = useGameStore.getState().roomCode  // ← 리렌더 안 됨!
  subscribe(rc, 'bills', ...)
}, [])  // 의존성도 빠진 이중 위반
```

`getState()`는 React 렌더 사이클 밖(이벤트 핸들러 즉시 실행, 모달 닫기 후 cleanup 등)에서만 허용한다. `useEffect` 내부와 JSX 렌더에서는 **반드시 셀렉터**를 사용한다.

### ❌ 절대 금지 — 셀렉터 안에서 `|| []` / `|| {}` 폴백

```js
// ❌ 금지: 매 렌더마다 새 [] 참조 생성 → React Error #185 무한 루프
const roles = useGameStore((s) => s.config?.roles?.executive || [])
```

```js
// ✅ 올바름: 모듈 레벨 상수로 안정적 참조 보장
const EMPTY_ROLES = []
const rolesRaw = useGameStore((s) => s.config?.roles?.executive)
const roles = rolesRaw || EMPTY_ROLES
```

폴백이 필요한 경우 반드시 **모듈 최상단에 상수로** 선언하고 셀렉터 밖에서 병합한다.

---

## 2. RTDB 구독 패턴

### ✅ 표준 구독 템플릿

```js
const roomCode = useGameStore((s) => s.roomCode)
const [dataMap, setDataMap] = useState({})

useEffect(() => {
  if (!roomCode) return                      // 가드 먼저
  const u = subscribe(roomCode, 'path', (d) => setDataMap(d || {}))
  return () => u?.()                         // 반드시 cleanup
}, [roomCode])                               // roomCode 의존성 필수
```

### 의존성 배열에 구독 경로가 변수이면 포함

```js
useEffect(() => {
  if (!roomCode || !groupId) return
  const u = subscribe(roomCode, `policies/${groupId}`, (d) => setData(d || null))
  return () => u?.()
}, [roomCode, groupId])  // groupId도 배열에 포함
```

`dataPath` 같은 prop이 경로에 포함되면 그것도 의존성에 추가한다:
```js
}, [roomCode, groupId, dataPath])
```

### 구독 소유 원칙 (Phase C에서 검증)

**데이터를 화면에 표시하는 컴포넌트가 직접 구독한다.** 페이지에서 구독해 props로 내려보내지 않는다.

```
// ❌ 중간 관리자 패턴 — Phase3Page 가 bills 를 구독해서 LegislativeProgressGuide 에 전달
Phase3Page → subscribe(bills) → props로 bills → LegislativeProgressGuide

// ✅ 자체 구독 패턴 — LegislativeProgressGuide 가 직접 구독
LegislativeProgressGuide → subscribe(bills) 자체 처리
```

단, 여러 자식이 같은 경로를 동시에 구독하면 Firebase 연결이 중복된다. 이때는 Zustand 스토어나 Context로 공유하는 것이 낫다. 현재 프로젝트에서는 **각 컴포넌트가 독립적으로 사용하는 데이터는 자체 구독**이 원칙이다.

---

## 3. SSOT (단일 진실 공급원) 원칙

같은 데이터에서 파생된 값은 **한 곳에서만 정의**하고 나머지는 참조한다.

### 예시: PHASE_STEPS.stage

잘못된 과거 패턴 — 4곳에 동일한 매핑 테이블이 존재:
```js
// ❌ LegislativeProgressGuide, ExecutiveProgressGuide,
//    Phase3LegislativeQuickPanel, Phase3ExecutiveQuickPanel 각각에 동일한 객체
const STEP_ID_TO_STAGE = {
  'legislative-draft': 0,
  'legislative-discuss': 1,
  // ...
}
```

올바른 패턴 — `PhaseWorkflow.jsx`의 `PHASE_STEPS` 배열에 `stage` 필드 한 번만 정의:
```js
// ✅ PhaseWorkflow.jsx
{ id: 'legislative-draft',   label: '...', stage: 0 },
{ id: 'legislative-discuss', label: '...', stage: 1 },

// ✅ 사용처에서는 한 줄
const stage = wf.currentStep?.stage
```

**새로운 파생 데이터가 필요하면:** 원본 데이터 정의 위치에 필드를 추가하고, 사용처는 그 필드를 참조하도록 한다. 별도 매핑 테이블을 만들지 않는다.

### 역할 스키마 SSOT — Phase 3 부서 역할

Phase 3 입법·행정·사법 역할은 `app/src/lib/scaffolding-data.js`가 기준 원본이다.

- `DEFAULT_ROLES`: 학생 화면에 기본으로 노출되는 활성 역할.
- `DEFAULT_ROLE_EXAMPLES`: 교사가 학급설정의 `역할 예시 자료`에서 필요할 때 추가하는 확장 역할.
- `normalizeRoleForKind`, `normalizeRoleList`: 교사 편집기나 오래된 방 데이터가 `id/name/desc` 중심으로 저장되어도 `key/label/assignedSection/isRepresentative`를 복구하는 런타임 정규화 계층.

역할 관련 화면에서는 직접 `config.roles`나 `config.branchConfig.*.roles`를 그대로 쓰지 말고 반드시 `normalizeRoleList(kind, roles)`를 거친다. 이 규칙을 어기면 역할 이름 수정 후 섹션 배정(`assignedSection`)이 사라져 학생 작성 화면이 깨질 수 있다.

행정부 역할 정책:
- 기본 4역할은 `총괄 검토원`, `시행령 작성원`, `근거 조사원`, `효과 예측원`.
- 네 역할 모두 정책 문단과 예산 항목을 함께 작성한다.
- `의견 수렴원`, `부작용 예측원`, `예산 조율원`은 기본 역할이 아니라 확장 예시 역할이다.
- 역할중심 학생 화면은 `BranchUnitWorkspace`, 공동작업 학생 화면은 `ExecutivePolicyBudgetDraft`를 사용한다. 두 화면을 한 단계에서 동시에 노출하지 않는다.

행정부 작성 모드 정책:
- `collaborative`: 최종 정책·시행령·예산 템플릿을 학생에게 바로 보여주고 함께 직접 작성한다. 이 모드에서는 역할별 초안 조립 UI를 학생에게 보여주지 않는다.
- `role-based`: 역할별 섹션 초안을 먼저 작성하고, 섹션 저장본을 최종 템플릿으로 조립·검토한다. 이 모드에서는 공동작업용 큰 최종 폼을 학생에게 동시에 보여주지 않는다.
- 기존 데이터 호환을 위해 `ExecutivePolicyBudgetDraft`는 `branchDrafts/{unitId}/finalDoc.content`가 의미 있는 내용일 때만 우선 사용한다. 내용이 비어 있고 `policies/{groupId}`에 저장본이 있으면 `policies`를 읽어 폼에 복구한다.
- `finalDoc.status === 'locked'`라도 실제 내용이 없으면 제출완료 뷰로 막지 않는다. 빈 잠금 문서가 기존 정책 저장본을 가리는 버그가 재발하지 않도록 `hasMeaningfulPolicyContent` 같은 의미 검사 함수를 거쳐야 한다.
- 호환용 읽기 로직은 화면 복구 전용이다. 사용자가 저장/제출하지 않았는데 기존 `policies`나 `branchDrafts`를 자동 변환·삭제·덮어쓰기 하지 않는다.
- 행정부 시행령 작성은 `ExecutiveGuidedPolicyBuilder`를 우선 사용한다. 학생에게 빈 시행령 textarea만 먼저 보여주지 말고, 가결 법령 확인, 준비자료 참고, 질문형 입력, 자동 조립 미리보기, 최종안 반영 버튼 순서로 작성하게 한다.
- 자동 조립 미리보기는 `policyFields.ordinance`를 즉시 덮어쓰지 않는다. 학생이 명시적으로 `미리보기를 최종안에 반영`을 눌렀을 때만 `ordinance`에 넣고, 기존 최종안이 있으면 확인을 받는다.
- 새 시행령 보조 필드를 추가할 때는 가능하면 기존 `policyFields` 안의 `linkedBill*`, `problem`, `purpose`, `targetCitizens`, `content`, `support`, `exception`, `ordinance`를 재사용한다. 별도 RTDB 경로를 만들기 전에 기존 `policies`/`branchDrafts` 호환성을 먼저 검토한다.
- `ExecutiveGuidedPolicyBuilder`는 3개 접기 구역을 유지한다. `1. 입법내용 확인`, `2. 질문에 답하며 시행령 재료 만들기`, `3. 시행령 초안 미리보기와 최종안 다듬기`가 기본 구조다.
- 공동작업 모드에서 각 접기 구역 저장은 중간 공개 기능이다. `branchDrafts/{unitId}/finalDoc`뿐 아니라 `policies/{groupId}`에도 `status: saved`로 남겨 평가단/대통령 모둠이 사전 열람하고 기사·브리핑을 준비할 수 있게 한다.
- 단, 이미 `submitted`, `requested`, `adjusted`, `final` 상태인 정책은 중간 저장으로 `saved` 상태로 낮추지 않는다.
- 행정부 `~국 통계` 참고 영역은 예산안 작성란에 둔다. 예산 계산기와 같은 `BIBIM_STATS`를 사용하며, 이름은 `branchConfig.executive.countryName`, `config.countryName`, `className`, `축소국` 순으로 정한다.
- 초안 단계에는 `온라인 정책토의 의견 반영`을 넣지 않는다. 온라인 정책토의와 국무회의 토론 반영은 `ExecutivePolicyFinalEdit`의 최종 수정 페이지에서 작성한다.
- 초안 단계에서 시행령의 구체적 근거·사례, 시민 피해·손해 예측과 대응, 기대효과·홍보 문구는 `ExecutivePublicEyeSection`에 함께 작성한다. 저장 버튼명은 `국민 눈높이 반영 저장`이며 `publicEye` 파트로 중간 공개 저장한다.

---

## 4. React 훅 작성 규칙

### 훅은 반드시 조건부 리턴 이전에 모두 선언

```js
function MyComponent({ role, groupId }) {
  // ✅ 모든 훅 먼저 선언
  const roomCode = useGameStore((s) => s.roomCode)
  const [data, setData] = useState(null)
  const derived = useMemo(() => ..., [data])

  useEffect(() => { ... }, [roomCode])

  // ✅ 가드(early return)는 모든 훅 선언 이후에만
  if (role !== 'teacher') return null
  if (!groupId) return <p>모둠 가입 후 이용 가능합니다.</p>

  return ( ... )
}
```

```js
// ❌ 금지: 훅 선언 전에 early return
function MyComponent({ role }) {
  if (role !== 'teacher') return null   // ← 여기서 리턴하면 아래 훅들이 조건부가 됨

  const [data, setData] = useState(null)  // React Rules of Hooks 위반
}
```

---

## 5. 모듈화 패턴 — ROUNDS / RoundTabShell

### 새 라운드 추가 방법 (3단계)

**1단계:** `Phase3Page.jsx`의 `ROUNDS` 배열에 항목 추가

```js
const ROUNDS = [
  // ... 기존 입법/행정/사법 ...
  {
    id: 'assembly',             // 고유 ID
    label: '국민의회',           // 탭 버튼 텍스트
    sessions: '19~20차시',
    headline: '🏅 4라운드 — 국민의회 (19~20차시)',
    articleStepId: 'article4',  // 이 라운드에 연결된 기사 작성 단계 ID
    useCustomTab: false,        // false = RoundTabShell 사용
    color: 'slate',             // Tailwind 색상 키 (colorMap 참고)
    sessionId: 'assembly-default',
    submissionLabel: '결의문 제출',
    offlineLabel: '전체 회의',
    dataPath: 'resolutions',    // RTDB 경로
    SubmissionForm: ResolutionForm,   // ③ 단계 컴포넌트
    ResultDisplay: ResolutionResult,  // ⑦ 단계 컴포넌트 (없으면 null)
    teacherNote: '각 모둠이 결의문을 작성하고 온라인 토의 후 전체 회의를 진행합니다.',
    prompt: {
      q: '우리 학교가 가장 먼저 해결해야 할 문제는 무엇인가?',
      sub: '모둠별 결의문을 비교하며 토론합니다.',
    },
  },
]
```

**2단계:** `SubmissionForm` 컴포넌트 작성

RoundTabShell이 전달하는 props: `groupId`, `dataPath`, `sessionId`, `kind`

```js
// ✅ 표준 SubmissionForm 시그니처
function ResolutionForm({ groupId, dataPath, sessionId, kind }) {
  const roomCode = useGameStore((s) => s.roomCode)

  // dataPath 를 그대로 RTDB 경로에 사용
  useEffect(() => {
    if (!roomCode || !groupId) return
    const u = subscribe(roomCode, `${dataPath}/${groupId}`, (d) => setData(d || null))
    return () => u?.()
  }, [roomCode, groupId, dataPath])

  // 저장 시
  await setAt(roomCode, `${dataPath}/${groupId}`, { status: 'submitted', ... })
}
```

**3단계:** 기존 코드 터치 없음. 빌드 후 탭에 자동 추가됨.

### useCustomTab 플래그

| 값 | 의미 |
|---|---|
| `true` | 기존 커스텀 탭 컴포넌트 사용 (`TabComponent` 직접 렌더) |
| `false` | `RoundTabShell` 사용 (8단계 제네릭 껍데기 + 주입 컴포넌트) |

입법/행정/사법 3탭은 `useCustomTab: true`로 고정 — 기존 로직 유지. 새로 추가하는 라운드는 가능하면 `useCustomTab: false` + `RoundTabShell`을 사용한다.

### RoundTabShell이 처리하는 8단계

| 단계 | 내용 | 처리 주체 |
|---|---|---|
| ①② | 역할 배정 + 개인 미션 작업 | 쉘 내장 (RoleAssigner, RoleWorkspace, GroupRoleSummary) |
| ③ | 모둠 결과 제출 | `SubmissionForm` prop 주입 |
| ④ | 온라인 토의 (CommentList) | 쉘 내장 (dataPath의 제출물 기반) |
| ⑤⑥ | 토론 상정 + 오프토론 안내 | 쉘 내장 (안내 텍스트만) |
| ⑦ | 결과 발표 | `ResultDisplay` prop 주입 (없으면 생략) |
| ⑧ | 기사 작성 | Phase3Page의 ArticleSection이 담당 (탭 밖) |

---

## 6. 컴포넌트 Props 규칙

### 기본값은 반드시 하위 호환

기존 사용처를 깨지 않으려면 새 prop의 기본값을 **기존 하드코딩 값과 동일하게** 설정한다.

```js
// ✅ 하위 호환 기본값
function BillTemplate({ groupId, dataPath = 'bills' }) { ... }
function MinisterPolicyDraft({ groupId, dataPath = 'policies' }) { ... }
function VerdictTemplate({ caseId, groupId, decision, dataPath = 'verdicts' }) { ... }
```

기존 `LegislativeTab`은 `<BillTemplate groupId={...} />`로 호출하고 있으므로 `dataPath` 생략 시 자동으로 `'bills'`를 사용해 동작이 동일하다.

### RoundTabShell이 SubmissionForm에 전달하는 표준 Props

```
groupId    — 현재 학생의 모둠 ID
dataPath   — RTDB 경로 (ROUNDS 설정의 dataPath)
sessionId  — 역할 세션 ID (ROUNDS 설정의 sessionId)
kind       — 라운드 종류 ('legislative' | 'executive' | 'judicial' | 커스텀)
```

새 `SubmissionForm`을 만들 때 이 4가지 props를 시그니처에 포함한다.

---

## 7. Dead Code 관리

### 삭제 전 필수 확인 절차

```bash
# 1. 해당 파일이 어디서 import 되는지 확인
grep -r "파일명" ~/class_democra_dev/app/src --include="*.jsx" --include="*.js"

# 2. import 결과가 0이면 삭제 안전
# 3. RTDB 경로가 다른 파일에서 사용 중인지 확인 (경로명으로 grep)
grep -r "경로명" ~/class_democra_dev/app/src --include="*.jsx" --include="*.js"
```

### 판단 기준

| 상태 | 조치 |
|---|---|
| import 없음, RTDB 경로도 미사용 | 즉시 삭제 |
| import 없음, but RTDB 경로 다른 파일에서 사용 | 파일 삭제 후 경로 유지 결정 (경로와 컴포넌트는 독립) |
| import 있음, but 주석 처리됨 | 주석 해제 여부 확인 후 결정 |
| 미래를 위해 남겨둔 뼈대 | `task.md`에 기록하고 명시적 TODO 주석 추가 |

---

## 8. Tailwind 색상 패턴

동적 Tailwind 클래스는 빌드 타임에 정적으로 감지되지 않으므로, **컬러맵 객체**를 컴포넌트 안에 미리 선언한다. `RoundTabShell.jsx` 패턴을 표준으로 따른다.

```js
const colorMap = {
  emerald: {
    bg:     'bg-emerald-50/30',
    border: 'border-emerald-300',
    title:  'text-emerald-900',
    badge:  'bg-emerald-600',
    light:  'bg-emerald-50 border-emerald-200',
  },
  violet: {
    bg:     'bg-violet-50/30',
    border: 'border-violet-300',
    title:  'text-violet-900',
    badge:  'bg-violet-600',
    light:  'bg-violet-50 border-violet-200',
  },
  amber:  { ... },
  slate:  { ... },
  indigo: { ... },
}

// 사용
const c = colorMap[color] || colorMap.indigo
<section className={`${c.bg} border-2 ${c.border} rounded-2xl`}>
```

**지원 색상 키:** `emerald`, `violet`, `amber`, `slate`, `indigo`  
새 색상이 필요하면 `RoundTabShell.jsx`의 `colorMap`에 추가하고 이 목록을 갱신한다.

**`tokens.js` 디자인 토큰:**  
페이즈별 색상·아이콘은 `src/styles/tokens.js`의 `PHASE_META`를 사용한다. 컴포넌트 안에 페이즈 색상을 직접 하드코딩하지 않는다.

---

## 9. 배포 워크플로

> **⚠️ 2026-07-10부로 배포 방식이 바뀌었다.** 아래는 옛 NAS `deploy.sh` 수동 배포 방식이며 더 이상 사용하지 않는다. 현재는 **GitHub 저장소 main 브랜치에 `git push`하면 연결된 정적 호스팅(Cloudflare Pages 등)이 자동으로 빌드·배포**한다. 즉 코드 수정 → 커밋 → `git push origin main`까지만 하면 끝 — 로컬에서 `npm run build`를 수동 실행하거나 산출물을 어딘가로 복사할 필요가 없다.
>
> - 배포 여부/진행 상황은 연결된 호스팅 서비스(Cloudflare Pages 등) 대시보드에서 확인한다.
> - `app/src/lib/build-info.js`의 `APP_BUILD`는 여전히 사람이 보는 버전 표시용이므로, 의미 있는 변경 시 수동으로 올려준다(자동 증가 아님).
> - `uploads/`(레거시 이미지)·`fetch_meta.php`(PHP)만 예외적으로 NAS에서 계속 서비스되며, 이 두 가지는 배포 파이프라인과 무관하다.
>
> 아래 옛 `deploy.sh` 관련 내용은 과거 기록(NAS 단독 배포 시절) 참고용으로만 남겨둔다.

### (레거시) 옛 NAS 배포 명령

```bash
cd ~/class_democra_dev/app && bash deploy.sh
```

### (레거시) 금지 사항

| 금지 | 이유 |
|---|---|
| 배포 폴더에서 `npm install` 실행 | node_modules 병목, 심볼릭 링크 에러 |
| `dist/` 내 파일 직접 편집 | 다음 빌드에서 덮어쓰여 사라짐 |
| `<배포경로>/app/` 에 소스 파일 복사 | 배포 경로는 `dist/` 산출물만 |
| 에러 상태로 배포 | 빌드 에러 해결 후 배포 (빌드 실패 시 deploy.sh 중단됨) |
| **`rsync ... <배포경로>/app/dist/`** 같은 직접 rsync 호출 | **라이브 URL이 보는 위치는 `app/` 루트이지 `app/dist/` 가 아니다.** rsync로 `app/dist/`에 복사하면 빌드 산출물이 잘못된 위치에 들어가서 배포가 안 됨. **반드시 `bash deploy.sh` 사용** |

---

## 10. 문서 업데이트 규칙

**모든 의미 있는 코드 변경 후 반드시 실행한다.**

### 갱신 항목 체크리스트

```
□ docs/history.md      — 버전(v0.x.y) + 날짜 + [도구 라벨] + 변경 요약 1줄 이상 (시간 역순 추가)
□ docs/task.md         — 완료된 항목 [x] 체크, 다음 항목 추가
□ docs/project_context.md — 의미 있는 진척이면 '현재 단계' 및 '다음 우선순위' 갱신
□ app/src/lib/build-info.js — 배포 변경 시 `APP_BUILD`를 새 빌드 번호로 갱신
```

### 🚨 `task.md` "보류 (Deferred)" 섹션 — 사용자 명시 삭제 명령 전까지 유지 (필수)

`docs/task.md` 상단의 **`## 보류 (Deferred)` 섹션은 사용자가 명시적으로 "삭제해줘" / "지워줘" / "보류 풀어줘" 같은 직접적인 삭제 명령을 내리기 전까지 절대 삭제·축약·이동하지 않는다.**

- **이유**: 보류 항목은 "지금 만들기엔 데이터·맥락이 부족하지만 나중에 만들 기능"을 기록한다. 사용자가 잊지 않도록 docs 최상단 가까운 위치에 유지되어야 한다.
- **금지**: 세션 정리·문서 정돈 명목으로 임의 삭제, 길어졌다고 요약, 다른 파일로 이동.
- **허용**: 보류 항목을 실제로 착수하면 "다음 작업" 또는 "완료" 섹션으로 이동(이때 보류에서 제거). 보류 조건이 충족됐다고 판단되면 **사용자에게 먼저 확인**한 뒤 이동.
- **추가**: 새 보류 항목은 기존 보류 섹션 안에 append. 보류 섹션이 없으면 신설.

예외: 사용자가 "이 보류 항목은 더 이상 필요없어" 또는 "보류 섹션 전체 정리해줘" 등 명시 의사를 표현한 경우에만 삭제·축약 가능.

### history.md 도구 라벨 규칙

모든 `history.md` 항목에 작업에 사용한 AI 코딩 도구를 라벨로 표기한다:

```
## v0.9.xx (YYYY-MM-DD) [Claude] — 변경 요약
```

| 라벨 | 사용 시점 |
|---|---|
| `[Claude]` | Claude Code CLI 세션 |
| `[Codex]` | OpenAI Codex 세션 |
| `[Antigravity]` | Anthropic Antigravity 세션 |
| `[Codex+Claude]` | 복수 도구 혼용 |

레거시 항목(라벨 규칙 확립 전, v0.9.20 이전)은 소급 적용 불필요. 단, 별도 도구 로그 파일이 있으면 내용을 history.md에 통합 후 원본 파일을 간략 정리 보존한다.

### 버전 체계

`v주.부.패치`  
- 패치(0.0.x): 버그 수정, 오탈자, 스타일 미세 조정  
- 마이너(0.x.0): 새 컴포넌트 추가, 기존 기능 개선, 최적화 작업  
- 메이저(x.0.0): 페이즈 구조 변경, 데이터 스키마 대규모 변경

### 큰 변경 전 proposal 문서 작성 필수

데이터 스키마 변경, 페이즈 구조 변경, 인증 방식 변경 등은 **코드 작성 전에** `docs/proposal_*.md` 를 작성하고 사용자 확인을 받는다.

```
docs/proposal_알기쉬운_이름_v1.md
```

---

## 부록: 자주 발생하는 실수와 대응

| 실수 | 증상 | 해결 |
|---|---|---|
| 셀렉터 안 `\|\| []` | React Error #185, 하얀 화면 | 모듈 상수 + 셀렉터 밖 병합 |
| `useEffect` 의존성 누락 | roomCode 변경 시 구독 안 됨 | `[roomCode, groupId, dataPath]` 모두 포함 |
| `getState()` in useEffect | 방 코드 바뀌어도 이전 구독 유지 | 셀렉터 사용 |
| 훅 전 early return | `Invalid hook call` | 모든 훅 → 가드 순서 |
| 같은 매핑 테이블 여러 곳 | 한 곳 수정해도 다른 곳 반영 안 됨 | 원본 데이터에 필드 추가 |
| `dataPath` 없는 SubmissionForm | `undefined/groupId` RTDB 경로 | `dataPath = 'default-path'` 기본값 |
| Tailwind 동적 클래스 | 프로덕션 빌드에서 스타일 사라짐 | colorMap 객체에 전체 클래스 미리 선언 |
