/**
 * JudicialCaseSetupPanel.jsx
 * 사법부 사건 시나리오 설정 패널 (학급설정 + 빠른 제어 공용)
 *
 * 책임:
 *  - 활성 사건 미리보기
 *  - 프리셋 사건 선택
 *  - 우리 반 입법·시행령 자동 주입 AI 프롬프트 (Claude/ChatGPT/Gemini)
 *  - JSON 파일 업로드 + 검증 + 적용
 *
 * 사용처:
 *  - BranchConfigEditor.jsx (학급설정)
 *  - Phase3JudicialQuickPanel.jsx 의 모달 (빠른 제어)
 *
 * Props:
 *  - bc: 현재 branchConfig (없으면 빈 객체)
 *  - onChange: (nextBc) => void  — bc 변경 시 호출
 *  - className: 학급명 (프롬프트용)
 *  - roomCode: 방 코드 (프롬프트용)
 *  - compact: true 면 빠른 제어용 컴팩트 모드 (현재는 동일 — 향후 분기 가능)
 */

import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { normalizeBillStatus } from '../../lib/bill-status'
import {
  JUDICIAL_PRESETS,
  validateCaseJson,
  PERSONA_LABEL,
} from '../../lib/judicial-case-data'

// ── AI 벤더별 사이트 URL & 안내 ─────────────────────────────────────
const AI_VENDORS = {
  claude: {
    key: 'claude',
    label: 'Claude',
    emoji: '🟣',
    url: 'https://claude.ai/new',
    bgClass: 'bg-violet-600 hover:bg-violet-700',
    borderClass: 'border-violet-300',
    accentText: 'text-violet-700',
    tipShort: '코드블록(```json)로 출력',
    tipLong: '※ Claude 사용 팁: 답변 마지막에 ```json 코드블록 안에 JSON 전체를 한 번에 출력해 주세요. 사고 과정 설명은 짧게, JSON은 완전한 형태로 한 번만 작성합니다.',
  },
  chatgpt: {
    key: 'chatgpt',
    label: 'ChatGPT',
    emoji: '🟢',
    url: 'https://chatgpt.com/',
    bgClass: 'bg-emerald-600 hover:bg-emerald-700',
    borderClass: 'border-emerald-300',
    accentText: 'text-emerald-700',
    tipShort: 'Canvas 또는 코드블록 추천',
    tipLong: '※ ChatGPT 사용 팁: Canvas 기능이 있다면 JSON을 Canvas에 작성해 주세요(복사가 쉬워집니다). 없다면 ```json 코드블록 안에 한 번만 출력해 주세요.',
  },
  gemini: {
    key: 'gemini',
    label: 'Gemini',
    emoji: '🔵',
    url: 'https://gemini.google.com/app',
    bgClass: 'bg-sky-600 hover:bg-sky-700',
    borderClass: 'border-sky-300',
    accentText: 'text-sky-700',
    tipShort: 'JSON 코드블록 한 번만',
    tipLong: '※ Gemini 사용 팁: 응답에 ```json 코드블록을 정확히 한 번만 포함시키고, 그 안에 완전한 JSON을 출력해 주세요. 추가 설명은 코드블록 위쪽에 짧게만 작성합니다.',
  },
}

export default function JudicialCaseSetupPanel({ bc, onChange, className: classNameProp, roomCode: roomCodeProp, compact = false }) {
  // store fallback (props 없을 때)
  const storeRoomCode = useGameStore((s) => s.roomCode)
  const storeClassName = useGameStore((s) => s.roomData?.className)
  const groups = useGameStore((s) => s.groups)
  const roomCode = roomCodeProp || storeRoomCode
  const className = classNameProp || storeClassName || '우리 반'

  const branchConfig = bc || {}
  const activeCase = branchConfig?.judicial?.activeCase
  const activeCaseId = branchConfig?.judicial?.activeCaseId || 'byeolbit_2024'

  // ── 학급 법안·시행령 구독 (AI 프롬프트 컨텍스트용) ──────────────────
  const [billsMap, setBillsMap] = useState({})
  const [policiesMap, setPoliciesMap] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'bills', (d) => setBillsMap(d || {}))
    const u2 = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode])

  const passedBills = useMemo(() => {
    return Object.entries(billsMap)
      .map(([id, b]) => ({ id, ...b }))
      .filter((b) => normalizeBillStatus(b.status) === 'passed')
      .map((b) => {
        const td = b.templateData || {}
        const proposerName = groups?.[b.proposerGroupId]?.name || ''
        return {
          id: b.id,
          title: b.title || '(제목 미작성)',
          purpose: td.purpose || '',
          definition: td.definition || '',
          duty: td.duty || '',
          penalty: td.penalty || '',
          proposerName,
        }
      })
  }, [billsMap, groups])

  const classDecrees = useMemo(() => {
    return Object.entries(policiesMap)
      .map(([gid, p]) => ({ gid, ...p }))
      .filter((p) => {
        const pf = p.policyFields || {}
        const ds = p.decreeScaffold || {}
        return (p.title || pf.title || p.decree || pf.decree || ds.rewardsPenalties)
      })
      .map((p) => {
        const pf = p.policyFields || {}
        const ds = p.decreeScaffold || {}
        const linkedBillTitle = pf.linkedBillTitle || ''
        const ministryName = groups?.[p.gid]?.name || p.ministry || p.ministryLabel || ''
        // 결정된(최종) 시행령 여부 — 제출·확정 상태면 true, 'saved'(초안)이면 false
        const decided = ['submitted', 'locked', 'adjusted', 'final'].includes(p.status)
        return {
          gid: p.gid,
          title: p.title || pf.title || '(정책명 미작성)',
          ministryName,
          decree: p.decree || pf.decree || pf.content || '',
          rewardsPenalties: ds.rewardsPenalties || '',
          owner: ds.owner || '',
          whenWhere: ds.whenWhere || '',
          exceptions: ds.exceptions || '',
          linkedBillTitle,
          status: p.status || 'saved',
          decided,
        }
      })
  }, [policiesMap, groups])

  // ── AI 사건 생성에 포함할 법안·시행령 선택 ──────────────────────────
  // 기본: 결정된 것(법안=가결 전체 / 시행령=제출·확정 상태)만 선택. 초안 시행령은 목록에 보이되 기본 해제.
  // billSel/decreeSel 에는 교사가 토글한 명시값만 저장(없으면 기본값 사용).
  const [billSel, setBillSel] = useState({})
  const [decreeSel, setDecreeSel] = useState({})
  const isBillSelected = (b) => (billSel[b.id] !== undefined ? billSel[b.id] : true)
  const isDecreeSelected = (p) => (decreeSel[p.gid] !== undefined ? decreeSel[p.gid] : !!p.decided)
  const selectedBills = useMemo(
    () => passedBills.filter((b) => (billSel[b.id] !== undefined ? billSel[b.id] : true)),
    [passedBills, billSel],
  )
  const selectedDecrees = useMemo(
    () => classDecrees.filter((p) => (decreeSel[p.gid] !== undefined ? decreeSel[p.gid] : !!p.decided)),
    [classDecrees, decreeSel],
  )

  // ── 사건 시나리오 — 프리셋 적용 ────────────────────────────────────
  function applyJudicialPreset(presetId) {
    const preset = JUDICIAL_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    onChange({ ...branchConfig, judicial: { ...branchConfig.judicial, activeCaseId: preset.id, activeCase: preset } })
  }

  // ── 사건 시나리오 — AI 프롬프트 빌더 (학급 법안·시행령 자동 주입) ──
  function buildJudicialPromptText(vendor) {
    const v = AI_VENDORS[vendor] || AI_VENDORS.claude

    const billLines = selectedBills.length
      ? selectedBills.map((b, i) =>
          `  ${i + 1}. 「${b.title}」  (제안: ${b.proposerName || '—'})\n` +
          `     ▸ 목적 : ${b.purpose || '(미작성)'}\n` +
          `     ▸ 정의 : ${b.definition || '(미작성)'}\n` +
          `     ▸ 의무 : ${b.duty || '(미작성)'}\n` +
          `     ▸ 벌칙 : ${b.penalty || '(미작성)'}`
        ).join('\n\n')
      : '  (선택된 법안이 없습니다. AI가 적절한 법을 가정해서 생성합니다.)'

    const decreeLines = selectedDecrees.length
      ? selectedDecrees.map((p, i) =>
          `  ${i + 1}. 「${p.title}」  (소관 부처: ${p.ministryName || '—'})` +
          (p.linkedBillTitle ? `   ⟵ 근거 법안: 「${p.linkedBillTitle}」` : '') + '\n' +
          (p.decree         ? `     ▸ 시행령 본문 : ${p.decree}\n` : '') +
          (p.owner          ? `     ▸ 담당자     : ${p.owner}\n` : '') +
          (p.whenWhere      ? `     ▸ 시간·장소  : ${p.whenWhere}\n` : '') +
          (p.rewardsPenalties ? `     ▸ 상벌·처분  : ${p.rewardsPenalties}\n` : '') +
          (p.exceptions     ? `     ▸ 예외       : ${p.exceptions}` : '')
        ).join('\n\n')
      : '  (선택된 시행령이 없습니다.)'

    // 사전 이야기(story.background / story.incident) — 모드와 무관하게 항상 포함
    // 동화·소설처럼 풍부한 배경 이야기로 학생이 사건의 맥락과 인물 감정에 공감하도록.
    const storyRules = `
14. **story (사건 배경 + 있었던 일) 필수** — 사건 자료실에 노출되는 동화·소설처럼 풍부한 사전 이야기입니다.
    - story.background : 인물·환경·이전 상황을 따뜻하고 구체적으로 풀어 쓴 **사건 배경** 3~5문장 (왜 이런 일이 일어날 수밖에 없는 분위기인지 학생이 느낄 수 있게).
    - story.incident   : 사건이 실제로 어떻게 벌어졌는지 시간 순서로 풀어 쓴 **있었던 일** 4~7문장 (짧은 이야기 한 단락처럼).
    - 초등 6학년 눈높이로, 어려운 용어는 풀어 쓰고, 인물의 행동·말·심정이 보이도록 구체적으로 작성합니다.`

    // 재판 대본(trialScript) 생성 규칙 + 스키마 조각 — 모드와 무관하게 항상 포함
    // (판결중심에서 사용, 역할중심에서는 무시. 한 번 만들면 두 모드 다 쓸 수 있게)
    const verdictRules = `
15. **trialScript (재판 대본) 필수** — 판사·검사·변호사·증인·피고인의 대사를 순서대로 작성합니다.
    (판결중심 모드에서 학생들이 보고 연기/참관하는 대본입니다. 역할중심 모드에서는 사용하지 않지만, 한 사건으로 두 모드 다 쓸 수 있도록 항상 작성하세요.)
    - 각 줄 형식: { "order": 숫자, "scene": "막 이름", "speaker": "judge|prosecution|defense|witness|defendant", "text": "대사 1~3문장" }
    - scene 값: 모두진술 / 증거조사 / 증인신문 / 피고인신문 / 최종변론 / 선고직전
    - 공방 대사를 통해 위 keyIssues(핵심 쟁점)가 자연스럽게 드러나야 합니다 (학생이 보고 판결할 수 있도록).
    - 총 20~30줄. **마지막 줄은 speaker:"judge"가 "이제 판결은 배심원 여러분께 맡기겠습니다" 식으로 끝내고, 유죄/무죄 결론은 절대 말하지 않습니다** (판결은 학생 몫).

    [각 장면별 필수 구성]
    ① 모두진술: 판사가 "지금부터 재판을 시작합니다"로 개정 선언 → 검사 모두진술(기소 요지) → 변호인 모두진술(변론 요지)
    ② 증거조사: **판사가 반드시 "이제 증거조사를 시작하겠습니다"라고 먼저 선언** → 검사가 각 증거를 하나씩 제시하며 설명 → 변호인이 각 증거에 반박 (최소 2회 이상 주고받기)
    ③ 증인신문: **판사가 반드시 "○○ 증인을 불러 주십시오. 증인 신문 시작합니다"라고 선언** → 검사가 증인에게 질문(Q) → 증인이 답변(A) → 변호인이 증인에게 반대신문(Q) → 증인이 답변(A) 형식으로 Q&A를 최소 4회 이상 주고받기. 증인은 statement처럼 이야기체가 아니라 "예.", "아니요.", "저는 그날 직접 봤습니다." 처럼 짧고 구체적으로 답해야 합니다.
    ④ 피고인신문: **판사가 반드시 "이제 피고인 신문을 하겠습니다"라고 선언** → 검사 질문(Q) → 피고인 답변(A) → 변호인 질문(Q) → 피고인 답변(A) 최소 3회 이상 주고받기
    ⑤ 최종변론: **판사가 반드시 "이제 최종변론을 듣겠습니다. 검사 측부터 하십시오"라고 선언** → 검사 구형 및 최종 의견 → 변호인 최종변론
    ⑥ 선고직전: 판사가 "양측 주장을 모두 들었습니다. 이제 판결은 배심원 여러분께 맡기겠습니다."로 마무리 (유죄/무죄 결론 절대 금지)`
    const scriptSchema = `,
  "trialScript": [
    { "order": 1, "scene": "모두진술", "speaker": "judge", "text": "지금부터 재판을 시작합니다. 피고인은 자리에서 일어나 주십시오. (잠시 후) 착석하세요. 검사 측, 모두진술 하십시오." },
    { "order": 2, "scene": "모두진술", "speaker": "prosecution", "text": "검사 측 기소 요지 2~3문장. 피고인이 어떤 법을 어떻게 위반했는지 설명." },
    { "order": 3, "scene": "모두진술", "speaker": "defense", "text": "변호인 측 변론 요지 2~3문장. 피고인 무죄 또는 감형 이유." },
    { "order": 4, "scene": "증거조사", "speaker": "judge", "text": "이제 증거조사를 시작하겠습니다. 검사 측, 첫 번째 증거를 제시하십시오." },
    { "order": 5, "scene": "증거조사", "speaker": "prosecution", "text": "첫 번째 증거 제시 및 설명 2문장." },
    { "order": 6, "scene": "증거조사", "speaker": "defense", "text": "첫 번째 증거에 대한 반박 1~2문장." },
    { "order": 7, "scene": "증거조사", "speaker": "prosecution", "text": "두 번째 증거 제시 및 설명 2문장." },
    { "order": 8, "scene": "증거조사", "speaker": "defense", "text": "두 번째 증거에 대한 반박 1~2문장." },
    { "order": 9, "scene": "증인신문", "speaker": "judge", "text": "○○ 증인을 불러 주십시오. (잠시 후) 증인 신문을 시작합니다. 검사 측, 신문하십시오." },
    { "order": 10, "scene": "증인신문", "speaker": "prosecution", "text": "증인에게 묻는 질문 한 문장?" },
    { "order": 11, "scene": "증인신문", "speaker": "witness", "text": "짧고 구체적인 답변. 예: '예, 저는 그날 직접 봤습니다. ○○이 ○○하는 것을 보았습니다.'" },
    { "order": 12, "scene": "증인신문", "speaker": "prosecution", "text": "두 번째 질문 한 문장?" },
    { "order": 13, "scene": "증인신문", "speaker": "witness", "text": "짧고 구체적인 두 번째 답변." },
    { "order": 14, "scene": "증인신문", "speaker": "defense", "text": "반대신문 질문 한 문장?" },
    { "order": 15, "scene": "증인신문", "speaker": "witness", "text": "반대신문 답변. 짧고 사실에 충실하게." },
    { "order": 16, "scene": "피고인신문", "speaker": "judge", "text": "이제 피고인 신문을 하겠습니다. 검사 측, 신문하십시오." },
    { "order": 17, "scene": "피고인신문", "speaker": "prosecution", "text": "피고인에게 묻는 질문 한 문장?" },
    { "order": 18, "scene": "피고인신문", "speaker": "defendant", "text": "피고인 답변 1~2문장. 해명 또는 인정." },
    { "order": 19, "scene": "피고인신문", "speaker": "defense", "text": "변호인 질문 한 문장 (유리한 사실 이끌어내기)?" },
    { "order": 20, "scene": "피고인신문", "speaker": "defendant", "text": "피고인 답변 1~2문장." },
    { "order": 21, "scene": "최종변론", "speaker": "judge", "text": "이제 최종변론을 듣겠습니다. 검사 측부터 하십시오." },
    { "order": 22, "scene": "최종변론", "speaker": "prosecution", "text": "최종 구형 및 의견 2~3문장. 구체적 형량 포함." },
    { "order": 23, "scene": "최종변론", "speaker": "defense", "text": "최종 변론 2~3문장. 무죄 또는 선처 요청." },
    { "order": 24, "scene": "선고직전", "speaker": "judge", "text": "양측 주장을 모두 들었습니다. 이제 판결은 배심원 여러분께 맡기겠습니다." }
  ]`

    return `초등 6학년 사회 수업 '민국이의 꿈' — ${className} 국민참여재판 사건 시나리오 JSON 생성 프롬프트 (배경 이야기 + 증거·증인 + 재판 대본 모두 포함 — 두 모드 공용)
════════════════════════════════════════════════════════════════
[ 사용할 AI : ${v.emoji} ${v.label} ]   학급코드 : ${roomCode || '—'}
════════════════════════════════════════════════════════════════

▶ 사용 방법
  STEP 1.  이 프롬프트 전체를 ${v.label}에게 붙여넣기 (이미 클립보드에 복사됨)
  STEP 2.  아래 [사건 내용 — 여기를 수정하세요] 부분만 우리 반 상황에 맞게 수정
  STEP 3.  ${v.label}이 출력한 JSON을 복사 → 메모장에 붙여넣어 파일명.json 으로 저장
  STEP 4.  학급설정 → 사법부 또는 사법부 빠른 제어 → [📥 파일 선택...] 에서 업로드 → [이 사건으로 재판 열기]

${v.tipLong}

════════════════════════════════════════════════════════════════
▶ [우리 반 입법 결과] — 본회의에서 가결된 법안
   (반드시 이 중 1~2개를 사건의 근거 법으로 사용하세요)
════════════════════════════════════════════════════════════════
${billLines}

════════════════════════════════════════════════════════════════
▶ [우리 반 시행령 결과] — 행정부에서 정한 집행·처분 절차
   (관련된 시행령이 있다면 사건의 처분 절차로 인용하세요)
════════════════════════════════════════════════════════════════
${decreeLines}

════════════════════════════════════════════════════════════════
▶ [사건 내용 — 여기를 수정하세요]
════════════════════════════════════════════════════════════════
- 피고인 : (예: 편의점 점주, 40대 남성 / 공장 사장 / 학원 원장 등)
- 피해자 : (예: 알바생 3명 / 인근 주민 / 학생들 등)
- 사건 한 줄 : (무슨 일이 있었는지 한두 문장)
- 적용할 우리 반 법안 : (위 [입법 결과] 목록의 번호 또는 제목. 모르면 "AI가 적절히 선택")
- 적용할 우리 반 시행령 : (위 [시행령 결과] 중 관련된 것. 없으면 "해당 없음")
- 분위기 : (애매한 편 / 명백히 잘못한 편 / 억울한 편 중 택1)

════════════════════════════════════════════════════════════════
▶ [필수 작성 규칙] — 우리 반 입법·시행령 결과를 반드시 반영
════════════════════════════════════════════════════════════════
1. **charges[].law 에는 반드시 위 [입법 결과] 목록의 법안 제목과 조항을 정확히 인용**합니다.
   - 형식: "「우리 반 법안 제목」 제3조(의무)" 또는 "「우리 반 법안 제목」 제4조(벌칙)"
   - charges[].description 에는 피고인이 그 법의 "의무" 조항을 어떻게 어겼는지 구체적으로 작성.
2. **prosecutionDemand (검사 구형) 은 반드시 위 법안의 "벌칙" 조항 범위 내에서 작성**합니다.
   - 예: 우리 반 법안 벌칙이 "100만원 이하 과태료"이면 → "과태료 80만원" 정도가 적절.
   - 우리 반 벌칙 조항을 넘어선 형량을 부르면 안 됩니다.
3. 위 [시행령 결과]에 관련된 시행령이 있다면 **roleHints.prosecution 에 "○○시행령의 처분 절차에 따라" 라고 명시**합니다.
4. **사건 시나리오는 우리 반 법안의 "의무" 조항을 명확히 위반한 행동이 핵심 쟁점이 되도록** 구성합니다.
   - 학생들이 재판 중에 "우리 반이 만든 의무를 어겼는가?"를 따질 수 있어야 합니다.
5. 초등 6학년이 이해할 수 있는 쉬운 언어 (어려운 법률 용어는 풀어쓰기)
6. roleHints: 판사·검사·변호사·배심원·증인·피고인·기자 7개 모두 필수
7. 증거(evidence): 검사측 3~4개 + 변호측 2~3개. **각 증거는 학생이 바로 읽을 수 있는 가상 자료 내용(sampleContent)과 증거 사진 생성용 프롬프트(imagePrompt)를 함께 생성**합니다.
   - 예: 카톡 대화 원문 3~6줄, 조사보고서 핵심 문구, 급여명세서 표 내용, CCTV 장면 설명, 사진/문서에 적힌 문구 등
   - imageHint에는 "어떤 형태의 자료로 보이는지"를 적습니다. sampleContent에는 "그 자료 안에 실제로 적힌 내용"을 씁니다.
   - imagePrompt에는 나중에 이미지 생성 AI로 증거 사진을 만들 때 그대로 붙여 넣을 수 있는 한글 프롬프트를 씁니다. 교실 재판용 자료처럼 선명한 문서/사진/캡처 형태, 읽을 수 있는 큰 제목, 실제 인물 얼굴 노출 없음, 개인정보 없음, 초등학생 수업용 안전한 이미지라고 명시합니다.
   - imageUrl은 교사가 나중에 업로드할 칸이므로 빈 문자열("")로 둡니다.
   - 증거는 서로 모순·반박 가능성이 있어야 하며, 검사측 증거만 일방적으로 강하지 않게 변호측 반박 증거도 구체적으로 만듭니다.
8. 증인(witnesses): **검사측 최대 2명 + 변호측 최대 2명**만 작성합니다. 총 2~4명.
   - 각 증인은 statement뿐 아니라 saw/heard/knows/answerGuide/expectedQuestions 필드를 반드시 작성합니다.
   - saw: 직접 본 것. 없으면 "직접 본 것은 없음"처럼 명확히.
   - heard: 직접 들은 말. 없으면 "직접 들은 것은 없음"처럼 명확히.
   - knows: 자료·경험으로 알고 있는 사실 2~4개.
   - answerGuide: 증인 역할 학생이 심문에서 어떤 말투와 태도로 답하면 되는지 2~3문장.
   - expectedQuestions: 검사/변호가 물을 법한 질문과 짧은 모범 답변 3~5개.
9. 진술서(statement) / 피고인 진술(script)은 1인칭 3~5문장. 증인은 "내가 직접 본 것"과 "내가 추측한 것"을 구분해서 말해야 합니다.
10. stageGuides: 1~7단계 총 7개 모두 작성 (timerMinutes 포함)
11. persona 값: villain(악의형) / evader(회피형) / righteous(억울형) / victim(피해자형) 중 택1
12. revealedAtStage: 검사측 증거는 4단계, 변호측 증거는 5단계
13. id 값은 영문·숫자·언더바만 (예: "shop_wage_2026")${storyRules}${verdictRules}

════════════════════════════════════════════════════════════════
▶ [출력 형식]
════════════════════════════════════════════════════════════════
아래 JSON 스키마를 완전히 채워서 **순수 JSON 만** 출력해 주세요.
\`\`\`json 코드블록 안에 한 번만 출력합니다. (다른 설명은 코드블록 위쪽에 짧게)

\`\`\`json
{
  "id": "사건id_영문숫자_언더바만사용",
  "title": "사건 전체 이름 (예: 별빛 편의점 임금체불 사건)",
  "subtitle": "짧은 부제 — 「우리 반 법안 제목」 위반 등",
  "caseType": "criminal",
  "trialType": "national_participation",
  "period": "20XX년",
  "summary": "사건 개요 2~3문장. 우리 반 법안의 어떤 의무를 어떻게 어겼는지가 드러나도록.",
  "story": {
    "background": "인물·환경·이전 상황을 동화·소설처럼 풀어 쓴 사건 배경 3~5문장. 학생이 인물에 공감할 수 있게 따뜻하고 구체적으로.",
    "incident": "사건이 실제로 어떻게 벌어졌는지 시간 순서로 4~7문장. 짧은 이야기 한 단락처럼."
  },
  "defendant": {
    "name": "피고인 이름",
    "age": 0,
    "occupation": "직업",
    "persona": "evader",
    "script": "피고인이 재판정에서 할 1인칭 진술 3~5문장. 자신의 행동을 해명하는 내용.",
    "scriptHint": "교사용 — 피고인 역할 학생에게 줄 답변 전략 안내 한 줄"
  },
  "victims": [
    { "name": "피해자 이름", "age": 0, "role": "피해자 역할", "experience": "겪은 일 한 문장", "statementSummary": "진술 요약 한 줄" }
  ],
  "charges": [
    { "law": "「우리 반 법안 제목」 제3조(의무)", "description": "구체적인 위반 내용" }
  ],
  "prosecutionDemand": "우리 반 법안의 벌칙 조항 범위 내에서 작성 (예: 벌금 80만원)",
  "keyIssues": [
    "핵심 쟁점 1 (우리 반 법안의 '의무'를 정말 어겼는가?)",
    "핵심 쟁점 2 (고의였는가 과실이었는가?)",
    "핵심 쟁점 3 (피해 규모와 정상참작 사유)"
  ],
  "evidence": [
    { "id": "e1", "title": "증거 이름", "side": "prosecution", "description": "왜 중요한지", "revealedAtStage": 4, "imageHint": "자료 형태", "imagePrompt": "교실 모의재판용 증거 이미지 생성 프롬프트. 실제 인물 얼굴·개인정보 없이, 선명한 문서/사진/캡처 형태로.", "imageUrl": "", "sampleContent": "학생이 바로 읽을 수 있는 가상 증거 내용. 예: 카톡 4줄, 문서 핵심 문구, 표 숫자 등." },
    { "id": "e2", "title": "증거 이름", "side": "prosecution", "description": "설명", "revealedAtStage": 4, "imageHint": "자료 형태", "imagePrompt": "증거 사진 생성용 한글 프롬프트", "imageUrl": "", "sampleContent": "구체적인 자료 내용" },
    { "id": "e3", "title": "증거 이름", "side": "prosecution", "description": "설명", "revealedAtStage": 4, "imageHint": "자료 형태", "imagePrompt": "증거 사진 생성용 한글 프롬프트", "imageUrl": "", "sampleContent": "구체적인 자료 내용" },
    { "id": "e4", "title": "증거 이름", "side": "defense", "description": "피고인에게 유리한 이유", "revealedAtStage": 5, "imageHint": "자료 형태", "imagePrompt": "증거 사진 생성용 한글 프롬프트", "imageUrl": "", "sampleContent": "구체적인 자료 내용" },
    { "id": "e5", "title": "증거 이름", "side": "defense", "description": "설명", "revealedAtStage": 5, "imageHint": "자료 형태", "imagePrompt": "증거 사진 생성용 한글 프롬프트", "imageUrl": "", "sampleContent": "구체적인 자료 내용" }
  ],
  "witnesses": [
    {
      "id": "w1",
      "name": "증인 이름",
      "role": "역할",
      "side": "prosecution",
      "statement": "1인칭 3~5문장.",
      "keyPoint": "핵심 한 줄",
      "saw": "직접 본 것 1~2문장",
      "heard": "직접 들은 말 1~2문장",
      "knows": ["알고 있는 사실 1", "알고 있는 사실 2", "알고 있는 사실 3"],
      "answerGuide": "증인 역할 학생이 심문에서 말할 태도와 답변 전략 2~3문장.",
      "expectedQuestions": [
        { "question": "검사 또는 변호사가 물을 질문", "answer": "증인이 답할 짧은 답변" },
        { "question": "반대신문 질문", "answer": "증인이 답할 짧은 답변" }
      ]
    },
    {
      "id": "w2",
      "name": "증인 이름",
      "role": "역할",
      "side": "defense",
      "statement": "1인칭 3~5문장.",
      "keyPoint": "핵심 한 줄",
      "saw": "직접 본 것",
      "heard": "직접 들은 말",
      "knows": ["알고 있는 사실 1", "알고 있는 사실 2"],
      "answerGuide": "답변 전략",
      "expectedQuestions": [
        { "question": "예상 질문", "answer": "짧은 답변" }
      ]
    }
  ],
  "roleHints": {
    "judges": "재판 진행 방향 + 우리 반 법안의 '의무' 조항을 어떻게 따질지",
    "prosecution": "어떤 증거에 집중할지 + (관련 시행령이 있다면) ○○시행령 처분 절차 참고",
    "defense": "무죄 또는 감형 주장 방향 + 우리 반 법안의 예외 조항이 있다면 활용",
    "jury": "어떤 기준으로 유무죄를 판단할지 (우리 반 법안의 의무를 정말 어겼는지)",
    "witness": "진술 준비와 심문 대비 방향",
    "defendant": "진술 전략과 방어 포인트",
    "press": "어떤 시각으로 재판을 보도할지"
  },
  "stageGuides": [
    { "stage": 1, "teacherNote": "준비·역할 배정", "studentNote": "오늘 할 일", "timerMinutes": 10 },
    { "stage": 2, "teacherNote": "자료 조사 및 논고카드 작성", "studentNote": "안내", "timerMinutes": 15 },
    { "stage": 3, "teacherNote": "모두진술 및 증거 제출", "studentNote": "안내", "timerMinutes": 8 },
    { "stage": 4, "teacherNote": "증거 조사 및 증인 심문", "studentNote": "안내", "timerMinutes": 15 },
    { "stage": 5, "teacherNote": "피고인 심문", "studentNote": "안내", "timerMinutes": 12 },
    { "stage": 6, "teacherNote": "최종 변론 및 구형", "studentNote": "안내", "timerMinutes": 8 },
    { "stage": 7, "teacherNote": "배심원 평의 및 판결 선고", "studentNote": "안내", "timerMinutes": 15 }
  ]${scriptSchema}
}
\`\`\`

════════════════════════════════════════════════════════════════
▶ 출력 후 자가 점검 체크리스트
════════════════════════════════════════════════════════════════
- [ ] charges[].law 에 우리 반 법안 제목이 정확히 인용되어 있는가?
- [ ] prosecutionDemand 가 우리 반 법안의 벌칙 조항 범위 내인가?
- [ ] 관련 시행령이 있다면 roleHints.prosecution 에 인용되어 있는가?
- [ ] stageGuides 1~7 모두 있는가?
- [ ] evidence[].sampleContent 가 모두 있어 학생이 자료를 바로 읽을 수 있는가?
- [ ] evidence[].imagePrompt 가 모두 있어 교사가 증거 사진을 만들 수 있는가?
- [ ] witnesses 는 검사측 2명 이하, 변호측 2명 이하인가?
- [ ] witnesses[].saw/heard/knows/answerGuide/expectedQuestions 가 모두 있어 증인 역할 학생이 심문에 답할 수 있는가?
- [ ] defendant.script 가 비어있지 않은가?
- [ ] roleHints.judges/prosecution/defense/jury 4개가 모두 채워져 있는가?
- [ ] story.background, story.incident 가 동화·소설처럼 풍부하게(배경 3~5문장, 있었던 일 4~7문장) 작성되어 있는가?
- [ ] trialScript 가 order 순서대로 있고, 마지막 판사 대사가 판결 결론을 말하지 않는가?
════════════════════════════════════════════════════════════════
`
  }

  // ── 사법부 시나리오 — AI 벤더로 보내기 (클립보드 복사 + 새 탭) ──────
  async function openWithAi(vendor) {
    const v = AI_VENDORS[vendor]
    if (!v) return
    const text = buildJudicialPromptText(vendor)
    let copied = false
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch {
      // Clipboard access can be blocked; the AI tab still opens below.
    }
    window.open(v.url, '_blank', 'noopener,noreferrer')
    if (copied) {
      alert(
        `✅ ${v.label} 프롬프트가 클립보드에 복사되었습니다!\n\n` +
        `📋 새로 열린 ${v.label} 탭에서 Ctrl+V (또는 Cmd+V)로 붙여넣으세요.\n\n` +
        `📚 선택한 우리 반 데이터 포함:\n` +
        `   · 법안 ${selectedBills.length}건\n` +
        `   · 시행령 ${selectedDecrees.length}건`
      )
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `사법부_AI프롬프트_${v.label}.txt`
      a.click()
      URL.revokeObjectURL(url)
      alert(
        `⚠️ 클립보드 접근이 차단되어 .txt 파일로 다운로드했습니다.\n\n` +
        `📋 다운받은 파일을 열어서 전체 복사 후 ${v.label} 탭에 붙여넣으세요.`
      )
    }
  }

  function downloadJudicialPrompt() {
    const prompt = buildJudicialPromptText('claude')
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `사법부_AI프롬프트_${className}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── JSON 파일 업로드 ───────────────────────────────────────────────
  const [jsonUploadState, setJsonUploadState] = useState(null)

  async function handleJudicialJsonUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await file.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      setJsonUploadState({ valid: false, errors: ['JSON 형식 오류: 파일을 파싱할 수 없습니다.'], warnings: [], data: null, fileName: file.name })
      return
    }
    const result = validateCaseJson(parsed)
    setJsonUploadState({ ...result, data: parsed, fileName: file.name })
  }

  function applyUploadedCase() {
    if (!jsonUploadState?.valid || !jsonUploadState.data) return
    const d = jsonUploadState.data
    onChange({ ...branchConfig, judicial: { ...branchConfig.judicial, activeCaseId: `custom:${d.id}`, activeCase: d } })
    setJsonUploadState(null)
    alert(`"${d.title}" 사건이 적용되었습니다!`)
  }

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg border border-rose-100 p-2.5 space-y-2">
      <p className="text-[10px] font-black text-rose-700">📂 사건 시나리오</p>
      {/* 현재 적용된 사건 */}
      {activeCase ? (
        <div className="bg-rose-50 border border-rose-200 rounded p-2 space-y-0.5">
          <p className="text-[11px] font-bold text-rose-800">✅ 현재 사건: {activeCase.title}</p>
          <p className="text-[10px] text-rose-600 line-clamp-1">{activeCase.summary}</p>
          <div className="flex gap-1 flex-wrap mt-1">
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
              {PERSONA_LABEL[activeCase.defendant?.persona] || activeCase.defendant?.persona || ''}
            </span>
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
              증거 {activeCase.evidence?.length || 0}건
            </span>
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
              증인 {activeCase.witnesses?.length || 0}명
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-amber-700 bg-amber-50 rounded p-2">⚠️ 아직 사건이 적용되지 않았습니다. 아래에서 선택하세요.</p>
      )}

      {/* 프리셋 드롭다운 */}
      <div className="space-y-1">
        <p className="text-[10px] text-gray-500 font-semibold">기본 제공 사건</p>
        <div className="flex gap-1.5">
          <select
            className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 bg-white"
            defaultValue={activeCaseId}
            onChange={() => {}}
            id={`judicial-preset-select-${compact ? 'qp' : 'cfg'}`}
          >
            {JUDICIAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const sel = document.getElementById(`judicial-preset-select-${compact ? 'qp' : 'cfg'}`)
              if (sel) applyJudicialPreset(sel.value)
            }}
            className="px-2 py-1 text-[11px] rounded bg-rose-600 text-white font-bold hover:bg-rose-700 whitespace-nowrap"
          >
            적용
          </button>
        </div>
      </div>

      {/* AI 프롬프트 + JSON 업로드 */}
      <div className="space-y-2 pt-1 border-t border-dashed border-rose-100">
        {/* STEP 1: 우리 반 입법·시행령 기반 AI 프롬프트 */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-[11px] font-bold text-amber-800">
              🤖 우리 반 입법·시행령 기반 AI 사건 생성
              <span className="ml-1 text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">배경 이야기 + 증거·증인 + 재판 대본</span>
            </p>
            <span className="text-[9px] text-amber-700 bg-white px-1.5 py-0.5 rounded-full border border-amber-200">
              통과 법안 {passedBills.length}건 · 시행령 {classDecrees.length}건 자동 포함
            </span>
          </div>
          <p className="text-[10px] text-amber-800 bg-white rounded px-2 py-1 border border-amber-100">
            🪄 생성되는 JSON에는 <b>동화·소설 같은 배경 이야기(story)</b> + <b>역할중심용 증거·증인 세트</b> + <b>판결중심용 재판 대본(trialScript)</b>이 <b>모두</b> 들어갑니다. 한 번 만들면 두 모드 어디서나 쓸 수 있어요.
          </p>

          {/* 학급 컨텍스트 미리보기 */}
          {(passedBills.length > 0 || classDecrees.length > 0) ? (
            <div className="bg-white rounded border border-amber-100 p-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold text-gray-500">사건에 쓸 법안·시행령 선택</p>
                <span className="text-[9px] text-gray-400">기본: 결정된 것 / 선택 법안 {selectedBills.length}·시행령 {selectedDecrees.length}</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {passedBills.map((b) => (
                  <label key={b.id} className="flex items-start gap-1 text-[9px] text-gray-700 cursor-pointer leading-snug">
                    <input
                      type="checkbox"
                      checked={isBillSelected(b)}
                      onChange={() => setBillSel((s) => ({ ...s, [b.id]: !isBillSelected(b) }))}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-semibold text-emerald-700">✅ 법안(가결)</span>{' '}
                      「{b.title}」{b.penalty && <span className="text-rose-700"> · 벌칙: {b.penalty.slice(0, 24)}{b.penalty.length > 24 ? '…' : ''}</span>}
                    </span>
                  </label>
                ))}
                {classDecrees.map((p) => (
                  <label key={p.gid} className="flex items-start gap-1 text-[9px] text-gray-700 cursor-pointer leading-snug">
                    <input
                      type="checkbox"
                      checked={isDecreeSelected(p)}
                      onChange={() => setDecreeSel((s) => ({ ...s, [p.gid]: !isDecreeSelected(p) }))}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-semibold text-violet-700">📋 시행령</span>
                      {p.decided
                        ? <span className="text-emerald-600"> (확정)</span>
                        : <span className="text-gray-400"> (초안)</span>}{' '}
                      「{p.title}」{p.rewardsPenalties && <span className="text-rose-700"> · 처분: {p.rewardsPenalties.slice(0, 24)}{p.rewardsPenalties.length > 24 ? '…' : ''}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[9px] text-gray-400">기본은 가결 법안 + 확정 시행령이 선택됩니다. 체크를 바꿔 임의로 조정하세요.</p>
            </div>
          ) : (
            <div className="text-[10px] text-amber-700 bg-white rounded px-2 py-1.5 border border-amber-100">
              ⚠️ 아직 가결된 법안과 시행령이 없어요. AI가 적절한 법을 가정해서 사건을 생성합니다.
            </div>
          )}

          <ol className="text-[10px] text-amber-700 space-y-0.5 list-decimal list-inside">
            <li>아래 AI 중 하나를 누르면 <span className="font-semibold">우리 반 법안·시행령이 자동으로 포함된 프롬프트</span>가 클립보드에 복사됩니다.</li>
            <li>새로 열린 AI 탭에서 <span className="font-semibold">Ctrl+V</span> (Mac: Cmd+V)로 붙여넣고 보내세요.</li>
            <li>AI가 출력한 <span className="font-semibold">JSON 코드블록</span>을 복사 → 메모장에 붙여넣어 <span className="font-semibold">.json</span>으로 저장.</li>
            <li>아래 [📥 파일 선택...]에서 업로드 → [이 사건으로 재판 열기].</li>
          </ol>

          {/* AI 벤더 3개 버튼 */}
          <div className="grid grid-cols-3 gap-1.5">
            {['claude', 'chatgpt', 'gemini'].map((vendor) => {
              const v = AI_VENDORS[vendor]
              return (
                <button
                  key={vendor}
                  type="button"
                  onClick={() => openWithAi(vendor)}
                  title={v.tipLong}
                  className={`py-2 rounded-lg ${v.bgClass} text-white text-[11px] font-bold transition-colors flex flex-col items-center gap-0.5`}
                >
                  <span className="text-base leading-none">{v.emoji}</span>
                  <span>{v.label}로 만들기</span>
                </button>
              )
            })}
          </div>

          {/* 보조 옵션 */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-100">
            <p className="text-[9px] text-amber-700">
              💡 클립보드가 차단되면 자동으로 .txt 파일이 다운로드됩니다.
            </p>
            <button
              type="button"
              onClick={downloadJudicialPrompt}
              className="text-[10px] px-2 py-1 rounded bg-white border border-amber-300 text-amber-700 font-semibold hover:bg-amber-100"
            >
              📄 .txt로 받기
            </button>
          </div>
        </div>

        {/* STEP 2: JSON 업로드 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-semibold">AI 생성 JSON 업로드</p>
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <span className="px-2 py-1 text-[11px] rounded border border-gray-200 bg-white text-gray-600 group-hover:border-rose-300 whitespace-nowrap font-semibold">
              📥 파일 선택...
            </span>
            <span className="text-[10px] text-gray-400">.json 파일</span>
            <input type="file" accept=".json" className="hidden" onChange={handleJudicialJsonUpload} />
          </label>
          {jsonUploadState && (
            <div className={`rounded p-2 text-[10px] space-y-0.5 ${jsonUploadState.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-bold">
                {jsonUploadState.valid ? '✅' : '❌'} {jsonUploadState.fileName}
              </p>
              {jsonUploadState.data?.title && (
                <p className="text-gray-600">사건명: {jsonUploadState.data.title}</p>
              )}
              {jsonUploadState.errors.map((e, i) => (
                <p key={i} className="text-red-700">❌ {e}</p>
              ))}
              {jsonUploadState.warnings.map((w, i) => (
                <p key={i} className="text-amber-700">⚠️ {w}</p>
              ))}
              {jsonUploadState.valid && (
                <button
                  type="button"
                  onClick={applyUploadedCase}
                  className="mt-1 w-full py-0.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  이 사건으로 재판 열기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
