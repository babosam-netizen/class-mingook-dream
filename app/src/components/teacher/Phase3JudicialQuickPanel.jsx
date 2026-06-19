import { useEffect, useMemo, useState, Fragment } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt, pushUnder } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'
import { JUDICIAL_PRESETS, PERSONA_LABEL } from '../../lib/judicial-case-data'
import { getJudicialSideStudentIds } from '../../lib/judicial-teams'
import { extractCanvaUrl } from '../../lib/canva-embed'
import { TRIAL_STAGES, VERDICT_TRIAL_STAGES } from '../debate/tools/DebateTimer'
import JudicialCaseSetupPanel from './JudicialCaseSetupPanel'
import JudicialMemberAssigner from './JudicialMemberAssigner'

const DEFAULT_STANCE_OPTIONS = [
  { id: 'pro', label: '찬성 (유죄)' },
  { id: 'con', label: '반대 (무죄)' },
  { id: 'neutral', label: '중립 (판단 유예)' },
]

const VERDICT_SCRIPT_SPEAKERS_BY_SIDE = {
  judge: ['judge'],
  pro: ['prosecution', 'witness'],
  con: ['defense', 'defendant'],
}

const VERDICT_SCRIPT_SPEAKER_LABEL = {
  judge: '판사',
  prosecution: '검사',
  defense: '변호인',
  witness: '증인',
  defendant: '피고인',
}

function Phase3JudicialQuickPanel({ onOpenDebateTool }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)

  // 사법부 활동 방식: 'verdict'(판결중심) | 'role'(역할중심)
  const workMode = branchConfig?.judicial?.workMode || 'role'
  const isVerdict = workMode === 'verdict'

  // activeCase: branchConfig에서 직접 읽음 (학급설정 / 빠른제어 사건만들기에서 저장된 시나리오)
  const storedActiveCase = branchConfig?.judicial?.activeCase
  const storedActiveCaseId = branchConfig?.judicial?.activeCaseId || 'byeolbit_2024'
  // activeCase가 null이면 로컬 프리셋에서 fallback
  const activeCase = storedActiveCase
    || JUDICIAL_PRESETS.find((p) => p.id === storedActiveCaseId)
    || JUDICIAL_PRESETS[0]

  // ★ 세션·평결·배심원 투표의 기준 키 — branchConfig activeCase를 우선, NPC 이벤트는 레거시 폴백
  // (구 NPC 시스템 npcCaseId가 남아있어도 이 키를 우선 사용해서 '폐수방류' 등 오염 방지)
  const activeCaseRelatedId = activeCase?.id || storedActiveCaseId || null

  const [events, setEvents] = useState({})
  const [verdicts, setVerdicts] = useState({})
  const [issues, setIssues] = useState({})
  const [debateSessions, setDebateSessions] = useState({})
  const [juryVotes, setJuryVotes] = useState({})
  // 재판 미리 준비 (임시저장판) — judicialTrialDraft/{caseId}
  const [trialPrepDraft, setTrialPrepDraft] = useState(null)
  const [trialPrepOpen, setTrialPrepOpen] = useState(false)
  // 🤖 사건 만들기/변경 모달 (학급설정과 같은 패널을 빠른 제어에서도 노출)
  const [caseSetupOpen, setCaseSetupOpen] = useState(false)
  // 판결중심: 전체 대본 미리보기 토글
  const [scriptPreviewOpen, setScriptPreviewOpen] = useState(false)
  const [presentation, setPresentation] = useState(null)

  // 빠른 제어에서 사건 설정 변경 시 RTDB(config.branchConfig)에 직접 저장
  const saveBranchConfig = async (nextBc) => {
    if (!roomCode) return
    try {
      await updateAt(roomCode, 'config', { branchConfig: nextBc })
    } catch (err) {
      alert('사건 설정 저장 중 오류: ' + (err?.message || err))
    }
  }

  // 연기팀 배정 인원 수 / 라벨 — 모둠별·개인별 모두 대응
  const actingCount = (side) => getJudicialSideStudentIds(side, branchConfig?.judicial, groups).length
  const actingLabel = (side) => {
    const names = (branchConfig?.judicial?.[side] || []).map((u) => groups?.[u.groupId]?.name).filter(Boolean)
    const n = actingCount(side)
    if (names.length && n > 0) return `${names.join(', ')} 외 ${n - names.length > 0 ? `${n - names.length}명` : '개인 배정'}`
    return n > 0 ? `${n}명` : '미지정'
  }

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'npcEvents', (d) => setEvents(d || {}))
    const u2 = subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {}))
    const u3 = subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {}))
    const u4 = subscribe(roomCode, 'judicialPresentation', (d) => setPresentation(d || null))
    const u5 = subscribe(roomCode, 'judicialIssues', (d) => setIssues(d || {}))
    return () => {
      u1?.()
      u2?.()
      u3?.()
      u4?.()
      u5?.()
    }
  }, [roomCode])

  // 재판 미리 준비 임시저장 구독 (사건별)
  useEffect(() => {
    if (!roomCode || !storedActiveCaseId) return
    const u = subscribe(roomCode, `judicialTrialDraft/${storedActiveCaseId}`,
      (d) => setTrialPrepDraft(d || null))
    return () => u?.()
  }, [roomCode, storedActiveCaseId])

  const eventList = useMemo(() => {
    return Object.entries(events)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0))
  }, [events])

  const npcCaseId = eventList[0]?.id || null

  // 배심원 투표 구독 — activeCaseRelatedId(branchConfig 우선) 기준
  useEffect(() => {
    if (!roomCode || !activeCaseRelatedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJuryVotes({})
      return
    }
    const u = subscribe(roomCode, `juryVotes/${activeCaseRelatedId}`, (d) => setJuryVotes(d || {}))
    return () => u?.()
  }, [roomCode, activeCaseRelatedId])

  const wf = useWorkflow()
  const stepIndex = useGameStore((s) => s.roomData?.workflow?.phase3?.stepIndex ?? 0)
  const stepId = wf.currentStep?.id
  const wfStage = wf.currentStep?.stage
  // 사법부 단계 = judicial-*(역할중심) / verdict-*(판결중심) + article3/poll4 (기사·여론조사 공통)
  const isJudStep = typeof stepId === 'string' && (
    stepId.startsWith('judicial-') || stepId.startsWith('verdict-') || stepId === 'article3' || stepId === 'poll4'
  )
  let stage = isJudStep ? (wfStage ?? 0) : -1

  // Pre/next step label abbreviations
  const prevStep = stepIndex > 0 ? wf.steps[stepIndex - 1] : null
  const nextStep = stepIndex < wf.steps.length - 1 ? wf.steps[stepIndex + 1] : null
  const prevShort = prevStep?.studentLabel?.replace(/^사법\s*/, '') || null
  const nextShort = nextStep?.studentLabel?.replace(/^사법\s*/, '') || null

  const guilty = Object.values(juryVotes).filter((v) => v?.choice === 'guilty').length
  const notGuilty = Object.values(juryVotes).filter((v) => v?.choice === 'notGuilty').length
  const totalVotes = guilty + notGuilty

  // 판결문·변론서: activeCaseRelatedId 우선, 구 NPC ID 폴백 (하위호환)
  const verdictNode = verdicts[activeCaseRelatedId] || (npcCaseId ? verdicts[npcCaseId] : null) || null
  // 쟁점·재판 메모(학생별): judicialIssues/{caseId}/{studentId}
  const issuesNode = useMemo(() => issues?.[activeCaseRelatedId] || {}, [issues, activeCaseRelatedId])

  const judgeVerdict = useMemo(() => {
    if (!verdictNode) return null
    return Object.values(verdictNode).find((v) => v?.decision) || null
  }, [verdictNode])

  const prosecutionStatements = useMemo(() => {
    if (!verdictNode) return []
    return Object.values(verdictNode).filter((v) => v?.side === 'prosecution')
  }, [verdictNode])

  const defenseStatements = useMemo(() => {
    if (!verdictNode) return []
    return Object.values(verdictNode).filter((v) => v?.side === 'defense')
  }, [verdictNode])

  // 활성 재판 세션 탐색 — activeCaseRelatedId 우선, 구 NPC ID 폴백 (하위호환)
  const trialDebate = Object.entries(debateSessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .find((s) =>
      (s?.relatedCaseId === activeCaseRelatedId ||
        (npcCaseId && s?.relatedCaseId === npcCaseId)) &&
      s?.isActive
    ) || null

  // 7단계 progress — activeCase.stageGuides에서 자동 표시 (모드별 라벨)
  const ROLE_STAGE_INFO = [
    ['① 준비 (사건 확인+역할 선택)', '학생들이 사건 자료실에서 사건의 배경·내용·증거를 충분히 읽고, 팀 배정 확인 + 모둠 내 역할까지 이 단계에서 정하도록 안내하세요.'],
    ['② 자료 조사',                  '팀별로 판례·법조항·뉴스·통계 등 사건과 관련된 자료를 수집합니다.'],
    ['③ 논고초안 작성',              '역할별 3가지 미션(출처 링크 포함) → 섹션 초안에 불러오기 → 대표가 최종 변론서/논고서로 편집·제출.'],
    ['④ 온라인 토의',                '제출된 논고초안을 다른 모둠 친구들이 읽고 찬성·반대·질문으로 평가 토의.'],
    ['⑤ 국민참여재판',               '준비(자리·논고) → 진행(⬇️ [🎙️ 모의재판 시작] 토론도구 연결) → 정리(배심원 평결 + 판사 판결문).'],
    ['⑥ 기사 작성',                  '기자 모둠 보도 기사 + 다른 모둠 자유 기사. 교사 승인 → 여론판 게시.'],
    ['⑦ 사후 여론조사',              '판결 결과에 대한 시민 평가를 여론조사로 받습니다.'],
  ]
  const VERDICT_STAGE_INFO = [
    ['① 준비 (사건 개요+팀 배정)',  '사건 개요를 함께 읽고, 연기 3팀(판사·검사·변호사)을 지정하세요. 나머지 모둠은 판결문 작성팀입니다. 아래에서 사건·대본·연기팀을 모두 설정할 수 있어요.'],
    ['② 쟁점 파악',                 '각 모둠이 재판에서 무엇이 판결에 중요할지 쟁점을 정리합니다. 재판을 능동적으로 보게 하는 준비입니다.'],
    ['③ 재판하기',                  '연기팀은 대본을 연기하고, 나머지 학생은 토론도구에서 메모·모둠 판결문 작성·게시까지 진행합니다.'],
    ['④ 판결문 토의',               '토론도구에서 게시된 모둠별 판결문을 비교하며 의견을 나눕니다.'],
    ['⑤ 기사 작성',                 '사법부의 역할과 이번 재판을 기사로 정리합니다. 교사 승인 → 여론판 게시.'],
    ['⑥ 여론조사',                  '여러 모둠의 판결에 대한 시민 평가를 여론조사로 받습니다.'],
  ]
  const DEFAULT_STAGE_INFO = isVerdict ? VERDICT_STAGE_INFO : ROLE_STAGE_INFO

  const stageGuides = activeCase?.stageGuides || []
  const getStageInfo = (idx) => {
    const guide = stageGuides.find((g) => g.stage === idx + 1)
    if (guide?.teacherNote) return [DEFAULT_STAGE_INFO[idx]?.[0] || `${idx + 1}단계`, guide.teacherNote]
    return DEFAULT_STAGE_INFO[idx] || [`${idx + 1}단계`, '다음 단계로 진행하세요.']
  }

  let stageLabel, nextHint
  if (stage === -1) {
    stageLabel = '⏳ 사법부 시작 전 대기'
    nextHint = '행정부 단계가 끝나면 다음 단계 → 를 눌러 사법부 ① 준비 단계로 진입하세요.'
  } else if (stage >= 0 && stage <= 6) {
    ;[stageLabel, nextHint] = getStageInfo(stage)
  } else {
    stageLabel = '사법부 완료'
    nextHint = '모든 단계가 완료되었습니다.'
  }

  // 권장 시간 (현재 단계)
  const currentTimerMin = stage >= 0 && stage <= 6
    ? (stageGuides.find((g) => g.stage === stage + 1)?.timerMinutes || null)
    : null

  // 7단계 progress bar (모드별 라벨)
  const stages = isVerdict
    ? [
        { idx: 0, label: '준비' },
        { idx: 1, label: '쟁점' },
        { idx: 2, label: '재판하기' },
        { idx: 3, label: '판결토의' },
        { idx: 4, label: '기사' },
        { idx: 5, label: '여론조사' },
      ]
    : [
        { idx: 0, label: '준비' },
        { idx: 1, label: '자료조사' },
        { idx: 2, label: '논고초안' },
        { idx: 3, label: '온라인토의' },
        { idx: 4, label: '재판' },
        { idx: 5, label: '기사' },
        { idx: 6, label: '여론조사' },
      ]

  const activityModeControl = (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {[
          { value: 'role', label: '🎭 역할중심', desc: '학생이 직접 검사·변호·증인이 되어 실제 재판 진행' },
          { value: 'verdict', label: '⚖️ 판결중심', desc: 'AI 대본 재판을 보고 전 모둠이 판사가 되어 판결문 작성' },
        ].map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => saveBranchConfig({
              ...branchConfig,
              judicial: { ...(branchConfig?.judicial || {}), workMode: m.value },
            })}
            className={`flex-1 text-left p-2 rounded border text-[10px] transition ${
              workMode === m.value
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-rose-200'
            }`}
          >
            <div className="font-black flex items-center gap-1">
              {m.label}{workMode === m.value && <span className="text-[9px] bg-white/30 px-1 rounded">현재</span>}
            </div>
            <div className={`mt-0.5 ${workMode === m.value ? 'text-rose-100' : 'text-gray-400'}`}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )

  const prepTitle = (num, title, desc) => (
    <div className="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <p className="text-[10px] font-black text-rose-500">준비 {num}</p>
        <h4 className="text-xs font-black text-rose-900">{title}</h4>
        {desc && <p className="text-[10px] text-rose-600 mt-0.5">{desc}</p>}
      </div>
    </div>
  )

  async function updateActiveCaseEvidence(evidenceId, patch) {
    if (!activeCase || !Array.isArray(activeCase.evidence)) return
    const nextCase = {
      ...activeCase,
      evidence: activeCase.evidence.map((ev) => (
        ev.id === evidenceId ? { ...ev, ...patch } : ev
      )),
    }
    await saveBranchConfig({
      ...(branchConfig || {}),
      judicial: {
        ...(branchConfig?.judicial || {}),
        activeCaseId: branchConfig?.judicial?.activeCaseId || activeCaseRelatedId || nextCase.id,
        activeCase: nextCase,
      },
    })
  }

  // 업로드 서버 없이: 이미지 직접 주소(URL) 또는 Canva 링크/임베드 코드를 붙여넣어 증거 자료를 지정한다.
  async function setEvidenceMedia(ev) {
    if (!ev?.id) return
    const current = ev.canvaUrl || ev.imageUrl || ''
    const input = prompt(
      '증거 자료의 이미지/Canva 주소를 붙여넣으세요.\n· 이미지 직접 주소 (https://....jpg / .png)\n· 또는 Canva 공유 링크 / 임베드 코드\n(비우고 확인하면 제거)',
      current,
    )
    if (input === null) return
    const value = extractCanvaUrl(input).trim()
    if (!value) {
      await updateActiveCaseEvidence(ev.id, { imageUrl: null, canvaUrl: null })
      return
    }
    const isCanva = /canva\.com/i.test(value)
    await updateActiveCaseEvidence(ev.id, isCanva
      ? { canvaUrl: value, imageUrl: null }
      : { imageUrl: value, canvaUrl: null })
  }

  async function presentEvidence(ev) {
    if (!roomCode || !ev) return
    await setAt(roomCode, 'judicialPresentation', {
      type: 'evidence',
      caseId: activeCaseRelatedId || '',
      caseTitle: activeCase?.title || '',
      evidenceId: ev.id || '',
      title: ev.title || '증거',
      side: ev.side || 'both',
      description: ev.description || '',
      imageUrl: ev.imageUrl || '',
      canvaUrl: ev.canvaUrl || '',
      imageHint: ev.imageHint || '',
      sampleContent: ev.sampleContent || '',
    })
  }

  async function clearPresentation() {
    if (!roomCode) return
    await setAt(roomCode, 'judicialPresentation', null)
  }

  const evidenceSideBadge = (side) => (
    side === 'prosecution' ? 'bg-red-100 text-red-700' :
    side === 'defense' ? 'bg-sky-100 text-sky-700' :
    'bg-purple-100 text-purple-700'
  )

  const evidenceSideLabel = (side) => (
    side === 'prosecution' ? '검사' : side === 'defense' ? '변호' : '공통'
  )

  const evidenceActions = (ev) => {
    const hasMedia = !!(ev.imageUrl || ev.canvaUrl)
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEvidenceMedia(ev)}
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
            hasMedia
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="증거 이미지 주소나 Canva 링크를 붙여넣습니다 (업로드 서버 불필요)"
        >
          {hasMedia ? '자료링크 ✓' : '자료링크'}
        </button>
        <button
          type="button"
          onClick={() => presentEvidence(ev)}
          className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          title="전광판 TV 화면에 이 증거를 크게 띄웁니다"
        >
          TV송출
        </button>
      </div>
    )
  }

  // ownSpeakers 가 주어지면(연기팀 대본): 전체 줄을 순서대로 넣되, 내 역할 줄만 대사 전문을 쓰고
  // 다른 역할 줄은 "번호. 화자: …"로 축약해 '빠진 번호에 누가 말하는지'를 보여준다.
  function formatTrialScriptLines(lines, title, ownSpeakers = null) {
    if (!lines.length) return ''
    const own = ownSpeakers ? new Set(ownSpeakers) : null
    return [
      `[${title}]`,
      'AI가 작성한 재판 대본입니다. 번호 순서에 맞춰 읽고, 괄호 안 행동은 자연스럽게 연기하세요.',
      ...(own ? ['진하게 표시되는 내 대사 차례를 기다리세요. "…"는 다른 역할이 말하는 순서입니다.'] : []),
      '',
      ...lines.map((line) => {
        const order = line.order ? `${line.order}. ` : ''
        const scene = line.scene ? `[${line.scene}] ` : ''
        const speaker = VERDICT_SCRIPT_SPEAKER_LABEL[line.speaker] || line.speaker || '역할'
        const isOther = own && !own.has(line.speaker)
        if (isOther) return `${order}${speaker}: …`.trim()
        return `${order}${scene}${speaker}: ${line.text || ''}`.trim()
      }),
    ].join('\n')
  }

  function buildVerdictDebateScripts() {
    const script = Array.isArray(activeCase?.trialScript)
      ? [...activeCase.trialScript].sort((a, b) => (a.order || 0) - (b.order || 0))
      : []
    if (script.length === 0) return {}

    const bySide = Object.fromEntries(
      Object.entries(VERDICT_SCRIPT_SPEAKERS_BY_SIDE).map(([side, speakers]) => {
        const title = side === 'judge' ? '판사팀 대본'
          : side === 'pro' ? '검사팀 대본'
          : '변호팀 대본'
        // 전체 줄을 순서대로 넣되 내 역할 줄만 전문 — 빠진 번호도 누가 말하는지 보이도록.
        return [side, {
          body: formatTrialScriptLines(script, title, speakers),
          lastAuthor: 'AI 재판 대본',
          source: 'activeCase.trialScript',
        }]
      }),
    )

    bySide.evaluator = {
      body: formatTrialScriptLines(script, '참관·판결문 작성팀용 전체 대본'),
      lastAuthor: 'AI 재판 대본',
      source: 'activeCase.trialScript',
    }
    return bySide
  }

  function buildVerdictSessionSeedPatch(session = {}) {
    const judgeIds = getJudicialSideStudentIds('judge', branchConfig?.judicial, groups)
    const proIds = getJudicialSideStudentIds('prosecution', branchConfig?.judicial, groups)
    const conIds = getJudicialSideStudentIds('defense', branchConfig?.judicial, groups)
    const judgeStudents = {}
    judgeIds.forEach((id) => { judgeStudents[id] = true })
    const proStudents = {}
    proIds.forEach((id) => { proStudents[id] = true })
    const conStudents = {}
    conIds.forEach((id) => { conStudents[id] = true })

    const judgeSet = new Set(judgeIds)
    const proSet = new Set(proIds)
    const conSet = new Set(conIds)
    const evaluators = {}
    for (const [, g] of Object.entries(groups || {})) {
      for (const sid of Object.keys(g?.members || {})) {
        if (!judgeSet.has(sid) && !proSet.has(sid) && !conSet.has(sid)) evaluators[sid] = true
      }
    }

    const seededScripts = buildVerdictDebateScripts()
    const currentScripts = session?.scripts || {}
    const scripts = { ...currentScripts }
    Object.entries(seededScripts).forEach(([side, script]) => {
      if (!String(currentScripts?.[side]?.body || '').trim()) scripts[side] = script
    })

    return {
      activeTools: Array.from(new Set([...(session?.activeTools || []), 'debateScript', 'debateTimer'])),
      teacherTab: 'pre',
      scripts,
      evalExposureEnabled: session?.evalExposureEnabled ?? true, // ⑦ 참관 판사 평가 노출 기본 ON
      judicialTrialScript: Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : [],
      proStudents,
      conStudents,
      evaluators,
      extraSides: {
        ...(session?.extraSides || {}),
        judge: { label: '판사', name: '판사', students: judgeStudents },
      },
      sideLabelOverrides: {
        ...(session?.sideLabelOverrides || {}),
        judge: session?.sideLabelOverrides?.judge || '판사',
        evaluator: session?.sideLabelOverrides?.evaluator || '참관 판사',
      },
    }
  }

  async function ensureVerdictDebateScripts(session = trialDebate) {
    if (!roomCode || !session?.id) return false
    if (!isVerdict) return true
    const hasTrialScript = Array.isArray(activeCase?.trialScript) && activeCase.trialScript.length > 0
    if (!hasTrialScript) {
      alert('적용된 사건에 trialScript 대본이 없습니다.\n준비 단계에서 사건을 다시 만들거나 대본이 포함된 JSON을 적용해 주세요.')
      return false
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, buildVerdictSessionSeedPatch(session))
    return true
  }

  const appliedCasePanel = (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-2">
      {prepTitle(2, '적용된 사건', '학생들이 볼 사건 내용, 쟁점, 증거, 증인을 한 번에 확인합니다.')}
      {activeCase ? (
        <div className="space-y-2">
          <div className="bg-white/85 p-2 rounded border border-amber-100">
            <p className="text-xs font-bold text-slate-900">{activeCase.title}</p>
            {activeCase.subtitle && <p className="text-[10px] text-amber-700 mt-0.5">{activeCase.subtitle}</p>}
            <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">{activeCase.summary}</p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                {activeCase.caseType === 'civil' ? '민사 재판' : '형사 재판'}
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                {PERSONA_LABEL[activeCase.defendant?.persona] || '피고인'}
              </span>
              <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                증거 {activeCase.evidence?.length || 0}건 · 증인 {activeCase.witnesses?.length || 0}명
              </span>
              {activeCase.trialScript?.length > 0 && (
                <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
                  대본 {activeCase.trialScript.length}줄
                </span>
              )}
            </div>
          </div>

          {activeCase.keyIssues?.length > 0 && (
            <div className="bg-white/75 border border-amber-100 rounded p-1.5">
              <p className="text-[10px] font-bold text-amber-700 mb-0.5">핵심 쟁점</p>
              {activeCase.keyIssues.map((q, i) => (
                <p key={i} className="text-[10px] text-amber-900 leading-snug">• {q}</p>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-2">
            {activeCase.evidence?.length > 0 && (
              <div className="bg-white/75 border border-sky-100 rounded p-1.5 space-y-0.5">
                <p className="text-[10px] font-bold text-sky-700">증거 목록</p>
                <div className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                  {activeCase.evidence.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between gap-1.5">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${evidenceSideBadge(ev.side)}`}>
                          {evidenceSideLabel(ev.side)}
                        </span>
                        <span className="text-[10px] text-slate-700 leading-snug min-w-0">
                          {ev.title}{(ev.imageUrl || ev.canvaUrl) ? ' · 자료 있음' : ''}
                        </span>
                      </div>
                      {evidenceActions(ev)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeCase.witnesses?.length > 0 && (
              <div className="bg-white/75 border border-indigo-100 rounded p-1.5 space-y-0.5">
                <p className="text-[10px] font-bold text-indigo-700">증인 목록</p>
                <div className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                  {activeCase.witnesses.map((w) => (
                    <div key={w.id} className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${
                        w.side === 'prosecution' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {w.side === 'prosecution' ? '검사측' : '변호측'}
                      </span>
                      <span className="text-[10px] text-slate-700 truncate">{w.name} ({w.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-amber-700 bg-white/75 rounded border border-amber-100 px-2 py-1">
          아직 적용된 사건이 없습니다. 먼저 사건을 만들거나 프리셋을 적용하세요.
        </p>
      )}
    </div>
  )

  // Debate controller
  const startJudicialDebate = async () => {
    if (!roomCode) return
    // ★ npcCaseId 조건 제거 — branchConfig activeCase(사건만들기)로 설정한 사건이 있으면 바로 생성 가능
    if (trialDebate) {
      if (isVerdict) {
        const ok = await ensureVerdictDebateScripts(trialDebate)
        if (ok) {
          alert('이미 진행 중인 재판 세션에 AI 대본을 적용했습니다.\n토론 도구의 [토론 전] 탭에서 역할별 대본을 확인하세요.')
          if (typeof onOpenDebateTool === 'function') onOpenDebateTool()
        }
        return
      }
      alert('이미 진행 중인 모의재판 토론 세션이 있습니다.\n토론 도구에서 확인하세요.')
      return
    }
    if (!confirm(
      `'${activeCase?.title || '모의재판'}' 사건으로 모의재판 토론을 시작할까요?\n\n` +
      `· 기존 활성 토론 세션은 자동 종료됩니다.\n` +
      `· 검사팀 및 변호인팀이 찬반 양측으로 자동 매핑됩니다.\n` +
      `· 그 외 학생들은 배심원(평가단)으로 배정됩니다.`
    )) return

    for (const [sid, session] of Object.entries(debateSessions || {})) {
      if (session?.isActive) await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false })
    }

    // ⑥ 새 재판 시작 시 이전 증거 TV 송출 상태를 초기화 — 처음엔 송출 안 함(종료와 동일 상태)
    await setAt(roomCode, 'judicialPresentation', null)

    // 검사/변호 진영 학생 — 모둠별/개인별 배정 모두 반영
    const judgeIds = isVerdict
      ? getJudicialSideStudentIds('judge', branchConfig?.judicial, groups)
      : []
    const proIds = getJudicialSideStudentIds('prosecution', branchConfig?.judicial, groups)
    const conIds = getJudicialSideStudentIds('defense', branchConfig?.judicial, groups)
    const judgeStudents = {}
    judgeIds.forEach((id) => { judgeStudents[id] = true })
    const proStudents = {}
    proIds.forEach((id) => { proStudents[id] = true })
    const conStudents = {}
    conIds.forEach((id) => { conStudents[id] = true })

    // 그 외 전원 = 배심원(평가단)
    const judgeSet = new Set(judgeIds)
    const proSet = new Set(proIds)
    const conSet = new Set(conIds)
    const evaluators = {}
    for (const [, g] of Object.entries(groups || {})) {
      for (const sid of Object.keys(g?.members || {})) {
        if (!judgeSet.has(sid) && !proSet.has(sid) && !conSet.has(sid)) evaluators[sid] = true
      }
    }

    // 진영 라벨 — 모둠 모드면 모둠명, 개인 모드면 기본 라벨
    const proGroupIds = (branchConfig?.judicial?.prosecution || []).map((u) => u.groupId).filter(Boolean)
    const conGroupIds = (branchConfig?.judicial?.defense || []).map((u) => u.groupId).filter(Boolean)
    const proGroupNames = proGroupIds.map((gid) => groups?.[gid]?.name).filter(Boolean).join(', ') || '검사팀'
    const conGroupNames = conGroupIds.map((gid) => groups?.[gid]?.name).filter(Boolean).join(', ') || '변호팀'

    // ★ activeCase(branchConfig / 사건만들기)를 우선 사용 — 구 NPC scenarioId는 사용하지 않음
    const caseTitle = activeCase?.title || '모의재판'
    // 임시저장된 준비안이 있으면 우선 적용
    const draft = trialPrepDraft || {}
    const seededScripts = isVerdict ? buildVerdictDebateScripts() : {}
    const sessionId = await pushUnder(roomCode, 'debateSessions', {
      title: `모의재판: ${caseTitle}`,
      topic: draft.topic || `'${caseTitle}'에 대한 검사 및 변호인의 토론`,
      phase: '3',
      type: 'trial', // ⚖️ 국민참여재판 — 검사/변호인/배심원/재판장 라벨 자동 적용 (DEBATE_SIDE_LABELS.trial)
      chairId: draft.chairId || '',
      chairName: draft.chairName || '재판부 (판사)',
      // 판결중심: AI 재판 대본 + 타이머 / 역할중심: 전체 도구
      activeTools: isVerdict
        ? ['debateScript', 'debateTimer']
        : ['stancePollPre', 'prepCard', 'debateScript', 'debateTimer'],
      currentDebateStage: 0,
      isActive: true,
      isPopupOpen: true,
      // 판결중심은 토론 전 대본 확인 후 교사가 토론 중 탭으로 넘겨 진행
      teacherTab: 'pre',
      relatedCaseId: activeCaseRelatedId,  // ★ branchConfig 케이스 ID 사용
      sourceStepId: 'judicial-trial',
      proStudents,
      conStudents,
      evaluators,
      ...(isVerdict ? {
        scripts: seededScripts,
        judicialTrialScript: Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : [],
        evalExposureEnabled: true, // ⑦ 참관 판사 평가 노출 기본 ON
        extraSides: {
          judge: { label: '판사', name: '판사', students: judgeStudents },
        },
      } : {}),
      sideLabelOverrides: {
        ...(isVerdict ? { judge: draft.chairLabel || '판사' } : {}),
        pro: draft.proLabel || proGroupNames,
        con: draft.conLabel || conGroupNames,
        evaluator: draft.evaluatorLabel || (isVerdict ? '참관 판사' : '배심원단'),
        chair: draft.chairLabel || '재판장',
      },
    })

    await setAt(roomCode, `debateSessions/${sessionId}/stancePoll/pre`, {
      question: draft.pollQuestion || '피고인은 유죄라고 생각하나요?',
      options: (Array.isArray(draft.pollOptions) && draft.pollOptions.length >= 2)
        ? draft.pollOptions
        : DEFAULT_STANCE_OPTIONS,
      isOpen: true,
      allowChange: false,
      type: 'pre',
    })

    // 토론 타이머 단계 초기화 — 판결중심은 VERDICT_TRIAL_STAGES(마지막=참관 판사 평의·판결문 작성), 역할중심은 TRIAL_STAGES
    const timerStages = isVerdict ? VERDICT_TRIAL_STAGES : TRIAL_STAGES
    await setAt(roomCode, `debateSessions/${sessionId}/debateTimer`, {
      isRunning: false,
      currentStage: 0,
      secondsLeft: timerStages[0]?.seconds ?? 180,
      stages: timerStages,
    })

    // 준비안 사용 완료 — 정리
    if (trialPrepDraft) {
      await setAt(roomCode, `judicialTrialDraft/${storedActiveCaseId}`, null)
    }

    // 세션 생성 후 토론 도구 패널을 자동으로 열어줌 (사용자 편의)
    if (typeof onOpenDebateTool === 'function') {
      onOpenDebateTool()
      alert('모의재판 토론 세션을 만들었고 토론 도구 패널을 열었습니다.\n학생 화면에 전광판을 띄우려면 [📺 전광판 띄우기]를 누르세요.')
    } else {
      alert('모의재판 토론 세션을 만들었습니다.\n[🎙️ 토론 도구 열기]를 누르거나 전광판을 띄울 수 있습니다.')
    }
  }

  const openTrialDebateBoard = () => {
    if (!roomCode || !trialDebate) return
    const url = `${window.location.origin}${window.location.pathname}#/debate-timer-tv?room=${encodeURIComponent(roomCode)}&sessionId=${encodeURIComponent(trialDebate.id)}`
    window.open(
      url,
      'trialDebateTimerTV_' + roomCode,
      'width=1280,height=800,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no'
    )
  }

  return (
    <section className="bg-white rounded-2xl shadow border-2 border-rose-350 p-4 space-y-3">
      <header className="flex items-baseline justify-between flex-wrap gap-1">
        <h2 className="font-bold text-rose-800 flex items-center gap-2">
          ⚖️ Phase 3 사법부 — 빠른 제어
          {/* 사법부 활동 방식 뱃지 */}
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            isVerdict
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
          }`}>
            {isVerdict ? '⚖️ 판결중심 모드' : '🎭 역할중심 모드'}
          </span>
        </h2>
        <span className="text-[11px] text-gray-500 max-w-[200px] truncate">
          {activeCase?.title || '사건 미설정'}
        </span>
      </header>

      {/* === 패턴 C — 가로 progress bar (dot + label) === */}
      <div className="px-1 pt-1 overflow-x-auto">
        <div className="flex items-start min-w-[500px] md:min-w-0">
          {stages.map((s, i) => {
            const done = stage >= 0 && stage > s.idx
            const current = stage >= 0 && stage === s.idx
            return (
              <Fragment key={s.idx}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                    done ? 'bg-emerald-500 text-white shadow' :
                    current ? 'bg-rose-600 text-white ring-4 ring-rose-200 scale-110' :
                    'bg-gray-300 text-white'
                  }`}>
                    {done ? '✓' : current ? '▶' : i + 1}
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${
                    done ? 'text-emerald-700' :
                    current ? 'text-rose-800 font-extrabold' :
                    'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-3.5 ${
                    done ? 'bg-emerald-400' : 'bg-gray-200'
                  }`} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* 현재 단계 + 다음 행동 안내 및 제어 버튼 */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-2.5 flex-1 space-y-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-rose-850">{stageLabel}</p>
              {currentTimerMin && (
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold">
                  ⏱ 권장 {currentTimerMin}분
                </span>
              )}
            </div>
            <p className="text-sm text-rose-950 mt-0.5">👩‍🏫 {nextHint}</p>
          </div>

          {/* 현재 사건 요약 — 준비단계에서는 아래 "재판 준비하기" 다음에 배치 */}
          {activeCase && stage !== 0 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-1">
              <p className="text-[10px] font-black text-rose-700">⚖️ 적용된 사건</p>
              <div className="bg-white/80 p-2 rounded border border-rose-100">
                <p className="text-xs font-bold text-slate-800">{activeCase.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{activeCase.summary}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                    {PERSONA_LABEL[activeCase.defendant?.persona] || ''}
                  </span>
                  <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                    증거 {activeCase.evidence?.length || 0}건 · 증인 {activeCase.witnesses?.length || 0}명
                  </span>
                </div>
              </div>
              {/* 핵심 쟁점 (배경·논고 단계에서 강조) */}
              {(stage === 0 || stage === 1) && activeCase.keyIssues?.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded p-1.5">
                  <p className="text-[10px] font-bold text-amber-700 mb-0.5">핵심 쟁점</p>
                  {activeCase.keyIssues.map((q, i) => (
                    <p key={i} className="text-[10px] text-amber-800">• {q}</p>
                  ))}
                </div>
              )}
              {/* 증거 공개 현황 — 역할중심 재판 단계(stage 4)에서 노출 */}
              {!isVerdict && stage === 4 && activeCase.evidence?.length > 0 && (
                <div className="bg-sky-50 border border-sky-100 rounded p-1.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-sky-700">이 단계 공개 증거 (revealedAtStage ≤ 4)</p>
                  {activeCase.evidence
                    .filter((ev) => ev.revealedAtStage <= 4)
                    .map((ev) => (
                      <div key={ev.id} className="flex items-start justify-between gap-1.5">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <span className={`text-[10px] px-1 rounded font-bold shrink-0 ${evidenceSideBadge(ev.side)}`}>
                            {evidenceSideLabel(ev.side)}
                          </span>
                          <span className="text-[10px] text-slate-700 min-w-0">{ev.title}</span>
                        </div>
                        {evidenceActions(ev)}
                      </div>
                    ))}
                </div>
              )}
              {/* 증인 목록 (심문 단계) */}
              {!isVerdict && stage === 4 && activeCase.witnesses?.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded p-1.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-indigo-700">증인 목록</p>
                  {activeCase.witnesses.map((w) => (
                    <div key={w.id} className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1 rounded font-bold ${
                        w.side === 'prosecution' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {w.side === 'prosecution' ? '검사측' : '변호측'}
                      </span>
                      <span className="text-[10px] text-slate-700">{w.name} ({w.role})</span>
                    </div>
                  ))}
                  {/* 추가 공개 증거 (stage 5) */}
                  {activeCase.evidence?.filter((ev) => ev.revealedAtStage === 5).map((ev) => (
                    <div key={ev.id} className="flex items-start gap-1.5 mt-1 pt-1 border-t border-indigo-100">
                      <span className={`text-[10px] px-1 rounded font-bold ${
                        ev.side === 'prosecution' ? 'bg-red-100 text-red-700' :
                        ev.side === 'defense' ? 'bg-sky-100 text-sky-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {ev.side === 'prosecution' ? '검사' : ev.side === 'defense' ? '변호' : '공통'}
                      </span>
                      <span className="text-[10px] text-slate-700">🆕 {ev.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* 구형 — 역할중심 재판 단계(stage 4)에서 노출 */}
              {!isVerdict && stage === 4 && activeCase.prosecutionDemand && (
                <div className="bg-red-50 border border-red-100 rounded p-1.5">
                  <p className="text-[10px] font-bold text-red-700">검사 구형</p>
                  <p className="text-[10px] text-red-800 mt-0.5">{activeCase.prosecutionDemand}</p>
                </div>
              )}
            </div>
          )}

          {/* ════ 판결중심 준비(stage 0) — 교사 설정 모음 ════ */}
          {isVerdict && stage === 0 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              {prepTitle(1, '재판 준비하기', '사건 만들기와 재판 미리 준비를 먼저 끝냅니다.')}

              {/* ① 사건·대본 만들기 / 변경 */}
              <button
                type="button"
                onClick={() => setCaseSetupOpen(true)}
                className="w-full py-2 text-[11px] rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                title="AI로 사건·재판 대본을 만들거나, JSON 업로드 / 프리셋 선택"
              >
                <span>🤖 ① 사건 · 재판 대본 만들기 / 변경</span>
                <span className="text-[10px] font-normal bg-white/20 px-1.5 py-0.5 rounded-full">
                  현재: {activeCase?.title?.slice(0, 12) || '미설정'}{activeCase?.title && activeCase.title.length > 12 ? '…' : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTrialPrepOpen(true)}
                className="w-full py-2 text-[11px] rounded-lg bg-white border-2 border-amber-300 text-amber-800 font-bold hover:bg-amber-50 shadow-sm transition flex items-center justify-center gap-1.5"
                title="토론 세션 생성 전 사회자·발언 진영 라벨·사전 여론조사를 미리 정해 임시저장합니다"
              >
                ⚙️ ② 재판 미리 준비
                <span className="text-[10px] font-normal text-amber-600">
                  (사회자·역할 라벨·여론조사)
                </span>
              </button>

              {appliedCasePanel}

              {prepTitle(3, '사법부 활동 방식', '역할중심과 판결중심 중 수업 진행 방식을 선택합니다.')}
              {activityModeControl}

              {prepTitle(4, '역할배정', '왼쪽에서 배정하고, 오른쪽에서 현재 배정된 모둠과 학생을 확인합니다.')}
              <JudicialMemberAssigner
                bc={branchConfig}
                onChange={saveBranchConfig}
                sides={['judge', 'prosecution', 'defense']}
                compact
              />

              {/* 대본 상태 + 전체 대본 미리보기 */}
              {(() => {
                const script = Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : []
                return (
                  <div className="bg-white/70 border border-rose-100 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>{prepTitle(5, '재판대본과 준비상태 확인', '대본, 준비안, 연기팀 배정이 모두 갖춰졌는지 확인합니다.')}</div>
                      {script.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setScriptPreviewOpen((v) => !v)}
                          className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-700 px-1.5 py-0.5 rounded font-bold"
                        >
                          {scriptPreviewOpen ? '미리보기 닫기' : '전체 대본 미리보기'}
                        </button>
                      )}
                    </div>
                    {script.length === 0 ? (
                      <p className="text-[10px] text-gray-500">⭕ 대본 없음 — 위 [사건·재판 대본 만들기]에서 대본을 만들어 적용하세요.</p>
                    ) : (
                      <p className="text-[10px] text-emerald-700 font-semibold">✅ 대본 {script.length}줄 설정됨</p>
                    )}
                    {scriptPreviewOpen && script.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-0.5 border-t border-rose-100 pt-1">
                        {[...script].sort((a, b) => (a.order || 0) - (b.order || 0)).map((l, i) => (
                          <p key={i} className="text-[10px] text-slate-700">
                            <span className="font-mono text-gray-300 mr-1">{l.order}</span>
                            <span className="font-bold text-slate-500">{PERSONA_LABEL[l.speaker] || ({ judge: '판사', prosecution: '검사', defense: '변호인', witness: '증인', defendant: '피고인' }[l.speaker] || l.speaker)}:</span>{' '}
                            {l.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className={`rounded px-1.5 py-1 border text-center ${activeCase?.id ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {activeCase?.id ? '✅ 사건' : '⭕ 사건'}
                </div>
                <div className={`rounded px-1.5 py-1 border text-center ${(activeCase?.trialScript?.length || 0) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {(activeCase?.trialScript?.length || 0) > 0 ? '✅ 대본' : '⭕ 대본'}
                </div>
                <div className={`rounded px-1.5 py-1 border text-center ${actingCount('judge') && actingCount('prosecution') && actingCount('defense') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {actingCount('judge') && actingCount('prosecution') && actingCount('defense') ? '✅ 연기팀' : '⭕ 연기팀'}
                </div>
              </div>
              <p className="text-[10px] text-rose-600">
                💡 사건·대본·연기 3팀을 모두 설정하면 ③ 재판하기 단계에서 각 팀이 자기 대사를 화면에서 봅니다.
              </p>
            </div>
          )}

          {/* Stage 0(준비): 사건 설정 + 재판 미리 준비 ★ 재판 전 가장 먼저 해야 할 일 (역할중심) */}
          {!isVerdict && stage === 0 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              {prepTitle(1, '재판 준비하기', '사건 만들기와 재판 미리 준비를 먼저 끝냅니다.')}

              {/* ① 사건 만들기 / 변경 */}
              <button
                type="button"
                onClick={() => setCaseSetupOpen(true)}
                className="w-full py-2 text-[11px] rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                title="AI로 우리 반 입법·시행령 기반 사건을 만들거나, JSON 업로드 / 프리셋 선택"
              >
                <span>🤖 ① 사건 만들기 / 변경</span>
                <span className="text-[10px] font-normal bg-white/20 px-1.5 py-0.5 rounded-full">
                  현재: {activeCase?.title?.slice(0, 14) || '미설정'}{activeCase?.title && activeCase.title.length > 14 ? '…' : ''}
                </span>
              </button>

              {/* ② 재판 미리 준비 */}
              <button
                type="button"
                onClick={() => setTrialPrepOpen(true)}
                className="w-full py-2 text-[11px] rounded-lg bg-white border-2 border-amber-300 text-amber-800 font-bold hover:bg-amber-50 shadow-sm transition flex items-center justify-center gap-1.5"
                title="토론 세션 생성 전 사회자·발언 진영 라벨·사전 여론조사를 미리 정해 임시저장합니다"
              >
                ⚙️ ② 재판 미리 준비
                <span className="text-[10px] font-normal text-amber-600">
                  (사회자·역할 라벨·여론조사)
                </span>
              </button>

              {appliedCasePanel}

              {prepTitle(3, '사법부 활동 방식', '역할중심과 판결중심 중 수업 진행 방식을 선택합니다.')}
              {activityModeControl}

              {prepTitle(4, '역할배정', '왼쪽에서 배정하고, 오른쪽에서 현재 배정된 모둠과 학생을 확인합니다.')}
              <JudicialMemberAssigner bc={branchConfig} onChange={saveBranchConfig} compact />
              <div className="rounded-lg bg-white/80 border border-rose-100 p-2 space-y-1.5">
                {prepTitle(5, '재판대본과 준비상태 확인', '사건, 준비안, 양측 배정이 모두 갖춰졌는지 확인합니다.')}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className={`rounded px-1.5 py-1 border text-center ${activeCase?.id ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    {activeCase?.id ? '✅ 사건' : '⭕ 사건'}
                  </div>
                  <div className={`rounded px-1.5 py-1 border text-center ${trialPrepDraft ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    {trialPrepDraft ? '✅ 준비안' : '⭕ 준비안'}
                  </div>
                  <div className={`rounded px-1.5 py-1 border text-center ${actingCount('prosecution') && actingCount('defense') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    {actingCount('prosecution') && actingCount('defense') ? '✅ 양측 배정' : '⭕ 양측 배정'}
                  </div>
                </div>
                <p className="text-[9px] text-gray-500">
                  역할중심 모드는 토론 세션 생성 시 검사·변호 배정과 준비안이 바로 연결됩니다.
                </p>
              </div>
            </div>
          )}

          {/* Stage 2(논고초안): 변론서 제출 현황 (역할중심) */}
          {!isVerdict && stage === 2 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-1.5 text-xs">
              <h4 className="font-bold text-rose-800">📄 양측 변론서 제출 상황</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-white border border-rose-100">
                  <p className="font-bold text-slate-800">👨‍💼 검사팀</p>
                  <p className="text-slate-600 mt-1">
                    {prosecutionStatements.length > 0 ? (
                      <span className="text-emerald-600 font-semibold">제출됨 ({prosecutionStatements.length}건)</span>
                    ) : (
                      <span className="text-gray-400">미제출</span>
                    )}
                  </p>
                </div>
                <div className="p-2 rounded bg-white border border-rose-100">
                  <p className="font-bold text-slate-800">🛡️ 변호팀</p>
                  <p className="text-slate-600 mt-1">
                    {defenseStatements.length > 0 ? (
                      <span className="text-emerald-600 font-semibold">제출됨 ({defenseStatements.length}건)</span>
                    ) : (
                      <span className="text-gray-400">미제출</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stage 4 (재판): 사건 설정 → 미리 준비 → 토론 세션 생성 → 전광판 (역할중심) */}
          {!isVerdict && stage === 4 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold text-rose-850">🎙️ 모의재판 빠른 제어</h4>
                  <p className="text-[11px] text-rose-700">
                    {trialDebate
                      ? `진행 중: ${trialDebate.title}`
                      : '(사건·준비안은 ① 준비 단계에서 설정) 세션 생성 → 전광판 띄우기 순으로 진행하세요.'}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${trialDebate ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {trialDebate ? '토론 진행 중' : '준비 완료'}
                </span>
              </div>

              {/* 사건·준비안 현황 (Stage 0에서 설정, 여기서 재확인/변경 가능) */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-amber-700 font-bold shrink-0">⚖️ 적용 사건</span>
                  <span className="text-[10px] text-amber-900 font-semibold truncate">{activeCase?.title || '미설정'}</span>
                  <button
                    type="button"
                    onClick={() => setCaseSetupOpen(true)}
                    className="shrink-0 text-[9px] bg-amber-200 hover:bg-amber-300 text-amber-800 px-1.5 py-0.5 rounded font-bold"
                    title="사건 변경 (준비 단계에서 설정 권장)"
                  >변경</button>
                </div>
                {trialPrepDraft && (
                  <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded font-semibold shrink-0">
                    💾 준비안 적용됨
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTrialPrepOpen(true)}
                  disabled={!!trialDebate}
                  className="py-1.5 text-[11px] rounded bg-white border-2 border-amber-300 text-amber-800 font-bold hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                  title="토론 세션 생성 전 사회자·여론조사 등을 미리 정해 둡니다 (임시저장)"
                >
                  ⚙️ 재판 미리 준비
                </button>
                <button
                  onClick={startJudicialDebate}
                  disabled={!!trialDebate}
                  className="py-1.5 text-[11px] rounded bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                  title="모의재판용 토론 세션을 새로 생성합니다"
                >
                  🎙️ 세션 생성
                </button>
                <button
                  type="button"
                  onClick={onOpenDebateTool}
                  disabled={!trialDebate || !onOpenDebateTool}
                  className="py-1.5 text-[11px] rounded bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                  title="교사용 토론 도구 패널을 엽니다 (단계 진행·발언 평가·타이머 제어)"
                >
                  🎙️ 토론 도구 열기
                </button>
                <button
                  onClick={openTrialDebateBoard}
                  disabled={!trialDebate}
                  className="py-1.5 text-[11px] rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                  title="학생 화면용 전광판을 새 창으로 띄웁니다 (TV·빔프로젝터용)"
                >
                  📺 전광판 띄우기
                </button>
              </div>
              {trialDebate && (
                <p className="text-[10px] text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-1">
                  💡 <b>토론 도구 열기</b>로 단계·평가·타이머를 제어하고, <b>전광판</b>은 학생용 화면에 띄우세요.
                </p>
              )}
              {presentation && (
                <div className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">📺 TV 송출 중: <b>{presentation.title}</b></span>
                  <button
                    type="button"
                    onClick={clearPresentation}
                    className="shrink-0 px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100"
                  >
                    송출 종료
                  </button>
                </div>
              )}
              {trialPrepDraft && !trialDebate && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  💾 임시저장된 준비안이 있습니다. <b>세션 생성</b> 시 이 설정으로 적용됩니다.
                </p>
              )}
            </div>
          )}

          {/* Stage 4 (재판): 실시간 배심원 평결 + 판사 판결문 (역할중심) */}
          {!isVerdict && stage === 4 && (totalVotes > 0 || judgeVerdict) && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              <h4 className="text-xs font-bold text-rose-850">⚖️ 배심원 평결 · 판결문 현황</h4>
              {totalVotes > 0 && (
                <>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-rose-700">유죄 {guilty}표 ({totalVotes ? Math.round((guilty / totalVotes) * 100) : 0}%)</span>
                    <span className="text-emerald-700">무죄 {notGuilty}표 ({totalVotes ? Math.round((notGuilty / totalVotes) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-gray-150 rounded-full overflow-hidden flex">
                    <div className="bg-rose-500 transition-all duration-500" style={{ width: totalVotes ? `${(guilty / totalVotes) * 100}%` : '0%' }} />
                    <div className="bg-emerald-500 transition-all duration-500" style={{ width: totalVotes ? `${(notGuilty / totalVotes) * 100}%` : '0%' }} />
                  </div>
                </>
              )}
              {judgeVerdict && (
                <div className="bg-white border border-rose-100 p-2 rounded">
                  <p className="font-semibold text-rose-700 text-xs">
                    판결 선고: {judgeVerdict.decision === 'guilty' ? '유죄' : '무죄'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap">{judgeVerdict.body}</p>
                  {judgeVerdict.sentence && (
                    <p className="text-[10px] text-slate-500 mt-1">선고 형량: {judgeVerdict.sentence}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ 판결중심 — 쟁점 메모·판결문 내용 모니터링 (모든 단계 공통) ════ */}
          {isVerdict && (
            <JudicialContentReview issuesNode={issuesNode} verdictNode={verdictNode} students={students} groups={groups} />
          )}

          {/* ════ 판결중심 재판하기(stage 2) — 대본·연기팀 점검 ════ */}
          {isVerdict && stage === 2 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              <h4 className="text-xs font-bold text-rose-850">🎬 재판하기 — 대본·판결문 진행</h4>
              <p className="text-[11px] text-rose-700">
                연기 3팀은 각자 자기 대사를 연기하고, 나머지 모둠은 토론도구에서 판결문을 작성·게시합니다.
              </p>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {[
                  { side: 'judge', label: '⚖️ 판사' },
                  { side: 'prosecution', label: '👨‍💼 검사' },
                  { side: 'defense', label: '🛡️ 변호' },
                ].map((t) => {
                  const has = actingCount(t.side) > 0
                  return (
                    <div key={t.side} className={`rounded px-1.5 py-1 border text-center ${has ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      {t.label}: {has ? actingLabel(t.side) : '미지정'}
                    </div>
                  )
                })}
              </div>
              {(() => {
                const script = Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : []
                if (script.length === 0) {
                  return <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠️ 대본이 없습니다. ① 준비 단계에서 대본을 만들어 적용하세요.</p>
                }
                return (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setScriptPreviewOpen((v) => !v)}
                      className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-0.5 rounded font-bold"
                    >
                      {scriptPreviewOpen ? '전체 대본 닫기' : `전체 대본 보기 (${script.length}줄)`}
                    </button>
                    {scriptPreviewOpen && (
                      <div className="max-h-44 overflow-y-auto space-y-0.5 bg-white/70 border border-rose-100 rounded p-1.5">
                        {[...script].sort((a, b) => (a.order || 0) - (b.order || 0)).map((l, i) => (
                          <p key={i} className="text-[10px] text-slate-700">
                            <span className="font-mono text-gray-300 mr-1">{l.order}</span>
                            <span className="font-bold text-slate-500">{({ judge: '판사', prosecution: '검사', defense: '변호인', witness: '증인', defendant: '피고인' }[l.speaker] || l.speaker)}:</span>{' '}
                            {l.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ════ 판결중심 stage 2 — 토론 도구 제어 ════ */}
          {isVerdict && stage === 2 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-2">
              <h4 className="text-xs font-bold text-rose-850">🎙️ 재판 토론 도구</h4>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={startJudicialDebate}
                  disabled={!!trialDebate}
                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🎙️ 세션 생성
                </button>
                <button
                  onClick={() => { if (typeof onOpenDebateTool === 'function') onOpenDebateTool() }}
                  disabled={!trialDebate || !onOpenDebateTool}
                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🎙️ 토론 도구 열기
                </button>
                {/* 세션 생성 시 역할별 AI 대본이 자동 주입되므로 '대본 넣기/적용' 버튼은 두지 않는다. */}
                <button
                  onClick={openTrialDebateBoard}
                  disabled={!trialDebate}
                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📺 전광판 띄우기
                </button>
                {trialDebate && (
                  <button
                    onClick={async () => {
                      await updateAt(roomCode, `debateSessions/${trialDebate.id}`, { isActive: false, isPopupOpen: false })
                    }}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 border border-red-200"
                  >
                    ■ 세션 종료
                  </button>
                )}
              </div>
              {/* 증거 TV 송출 */}
              {activeCase?.evidence?.length > 0 && (
                <div className="border border-amber-200 rounded-xl bg-amber-50 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black text-amber-800">🗂️ 증거 TV 송출</p>
                    {presentation?.evidenceId && (
                      <button onClick={clearPresentation} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold hover:bg-red-600">■ 종료</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {activeCase.evidence.map((ev) => {
                      const sideLabel = ev.side === 'prosecution' ? '🔴 검사' : ev.side === 'defense' ? '🔵 변호' : '🟣 공통'
                      const isOn = presentation?.evidenceId === ev.id
                      return (
                        <button key={ev.id} onClick={() => isOn ? clearPresentation() : presentEvidence(ev)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] transition-all ${isOn ? 'bg-amber-400 border-amber-500 text-white font-black' : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-100'}`}
                        >
                          <span className="shrink-0">{sideLabel}</span>
                          <span className="truncate font-semibold">{ev.title}</span>
                          {isOn && <span className="ml-auto animate-pulse shrink-0">📺 송출중</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ 판결중심 판결문 게시 현황(stage 3: 판결문 토의) ════ */}
          {isVerdict && stage === 3 && (
            <div className="pt-2 border-t border-rose-200/50 space-y-1.5">
              <h4 className="text-xs font-bold text-rose-850">📜 모둠별 판결문 게시 현황</h4>
              {(() => {
                const node = verdictNode || {}
                const byGroup = {}
                for (const v of Object.values(node)) {
                  if (!v || !v.body) continue
                  const gid = v.judgeGroupId || v.groupId
                  if (!gid) continue
                  if (!byGroup[gid] || (v.createdAt || 0) > (byGroup[gid].createdAt || 0)) byGroup[gid] = v
                }
                const totalGroups = Object.keys(groups || {}).length
                const postedGids = Object.keys(byGroup)
                return (
                  <>
                    <p className="text-[11px] text-rose-700">
                      게시한 모둠: <b className="text-emerald-700">{postedGids.length}</b> / {totalGroups}
                    </p>
                    {postedGids.length > 0 ? (
                      <div className="space-y-0.5">
                        {postedGids.map((gid) => (
                          <div key={gid} className="flex items-center gap-1.5 text-[10px]">
                            <span className="font-bold text-slate-700">🧑‍⚖️ {groups?.[gid]?.name || gid}</span>
                            <span className={`px-1 rounded font-bold ${byGroup[gid].decision === 'guilty' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {byGroup[gid].decision === 'guilty' ? '유죄' : '무죄'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400">아직 게시된 판결문이 없습니다.</p>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Stage 6(사후 여론조사) — 별도 컨트롤 없음. PollManager 사용 안내만 */}
        </div>

        {/* 이전/다음 단계 제어 버튼 — 이동 대상 라벨 명시 */}
        <div className="flex md:flex-col gap-2 shrink-0 md:w-44">
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: Math.max(0, stepIndex - 1) }))}
            disabled={!prevStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border-2 border-rose-200 text-rose-700 font-bold hover:bg-rose-50 disabled:opacity-40 text-left leading-tight"
            title={prevShort || ''}
          >
            ← 이전 단계
            {prevShort && <div className="text-[10px] font-normal text-rose-500 truncate">({prevShort})</div>}
          </button>
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: stepIndex + 1 }))}
            disabled={!nextStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm disabled:opacity-40 text-left leading-tight animate-in fade-in"
            title={nextShort || ''}
          >
            다음 단계 →
            {nextShort && <div className="text-[10px] font-normal text-rose-100 truncate">({nextShort})</div>}
          </button>
        </div>
      </div>

      {/* ════════ 재판 미리 준비 모달 (임시저장판) ════════ */}
      {trialPrepOpen && (
        <TrialPrepModal
          roomCode={roomCode}
          caseId={storedActiveCaseId}
          groups={groups}
          students={useGameStore.getState().students || {}}
          existing={trialPrepDraft}
          onClose={() => setTrialPrepOpen(false)}
        />
      )}

      {/* ════════ 🤖 사건 만들기/변경 모달 (학급설정과 동일 패널) ════════ */}
      {caseSetupOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"
          onClick={(e) => { if (e.target === e.currentTarget) setCaseSetupOpen(false) }}
        >
          <div className="bg-rose-50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border-2 border-rose-300">
            <header className="sticky top-0 z-10 bg-rose-100 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="text-sm font-black text-rose-800">🤖 재판 사건 설정 (빠른 제어)</p>
                <p className="text-[10px] text-rose-600">
                  학급설정과 동일한 사건 설정 패널입니다. 여기서 변경하면 학급설정에도 같이 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCaseSetupOpen(false)}
                className="text-rose-600 hover:bg-white rounded-full w-7 h-7 flex items-center justify-center font-bold"
                aria-label="닫기"
              >
                ✕
              </button>
            </header>
            <div className="p-3">
              <JudicialCaseSetupPanel
                bc={branchConfig || {}}
                onChange={saveBranchConfig}
                compact
              />
            </div>
            <footer className="sticky bottom-0 bg-rose-100 border-t border-rose-200 px-4 py-2 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setCaseSetupOpen(false)}
                className="w-full py-1.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                ✅ 사건 설정 완료
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 재판 미리 준비 모달 — 토론 세션 생성 전 임시저장판
 * 교사가 사회자·발언 진영 라벨·여론조사 항목을 미리 정해 두고 임시저장.
 * 저장된 draft는 `judicialTrialDraft/{caseId}` 에 들어가고 startJudicialDebate가 우선 사용.
 */
// 판결중심 모니터링 — 쟁점 메모(학생별)·판결문(모둠별)을 간략 표시, 누르면 펼침
function JudicialContentReview({ issuesNode, verdictNode, students, groups }) {
  const [openId, setOpenId] = useState(null)

  const memoRows = Object.entries(issuesNode || {})
    .filter(([, m]) => m?.body && String(m.body).trim())
    .map(([sid, m]) => {
      const st = students?.[sid]
      return { id: `iss_${sid}`, name: st ? `${st.number ? `${st.number}번 ` : ''}${st.nickname || ''}`.trim() : sid, body: m.body, at: Number(m.at) || 0 }
    })
    .sort((a, b) => b.at - a.at)

  // 판결문: 모둠별 최신 1건
  const verdictRows = (() => {
    const byGroup = {}
    Object.values(verdictNode || {}).forEach((v) => {
      if (!v || !v.body) return
      const gid = v.judgeGroupId || v.groupId
      if (!gid) return
      if (!byGroup[gid] || (v.createdAt || 0) > (byGroup[gid].createdAt || 0)) byGroup[gid] = v
    })
    return Object.entries(byGroup).map(([gid, v]) => ({
      id: `vd_${gid}`,
      name: groups?.[gid]?.name || gid,
      decision: v.decision,
      body: v.body,
      at: Number(v.createdAt) || 0,
    })).sort((a, b) => b.at - a.at)
  })()

  const Row = (r, accent) => {
    const open = openId === r.id
    return (
      <li key={r.id}>
        <button
          onClick={() => setOpenId(open ? null : r.id)}
          className="w-full text-left bg-white border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
        >
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold shrink-0 ${accent}`}>{r.name}</span>
            {r.decision && (
              <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${r.decision === 'guilty' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {r.decision === 'guilty' ? '유죄' : '무죄'}
              </span>
            )}
            <span className="text-[10px] text-slate-500 truncate flex-1">{String(r.body || '').split('\n')[0]}</span>
            <span className="text-[9px] text-slate-300 shrink-0">{open ? '▲' : '▼'}</span>
          </div>
          {open && (
            <p className="mt-1 pt-1 border-t border-slate-100 text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>
          )}
        </button>
      </li>
    )
  }

  return (
    <details className="pt-2 border-t border-rose-200/50">
      <summary className="text-xs font-bold text-rose-850 cursor-pointer select-none">
        🔎 쟁점 메모 · 📜 판결문 내용 보기 ({memoRows.length} · {verdictRows.length})
      </summary>
      <div className="mt-2 space-y-3">
        <div>
          <p className="text-[11px] font-black text-amber-700 mb-1">🔎 쟁점·재판 메모 (학생별 {memoRows.length}명)</p>
          {memoRows.length === 0 ? (
            <p className="text-[10px] text-gray-400">아직 작성된 쟁점 메모가 없습니다.</p>
          ) : (
            <ul className="space-y-1">{memoRows.map((r) => Row(r, 'text-amber-700'))}</ul>
          )}
        </div>
        <div>
          <p className="text-[11px] font-black text-rose-700 mb-1">📜 게시된 판결문 (모둠별 {verdictRows.length}건)</p>
          {verdictRows.length === 0 ? (
            <p className="text-[10px] text-gray-400">아직 게시된 판결문이 없습니다.</p>
          ) : (
            <ul className="space-y-1">{verdictRows.map((r) => Row(r, 'text-rose-700'))}</ul>
          )}
        </div>
      </div>
    </details>
  )
}

function TrialPrepModal({ roomCode, caseId, groups, students, existing, onClose }) {
  const [topic, setTopic] = useState(existing?.topic || '')
  const [chairId, setChairId] = useState(existing?.chairId || '')
  const [proLabel, setProLabel] = useState(existing?.proLabel || '')
  const [conLabel, setConLabel] = useState(existing?.conLabel || '')
  const [evaluatorLabel, setEvaluatorLabel] = useState(existing?.evaluatorLabel || '배심원단')
  const [chairLabel, setChairLabel] = useState(existing?.chairLabel || '재판장')
  const [pollQuestion, setPollQuestion] = useState(existing?.pollQuestion || '피고인은 유죄라고 생각하나요?')
  const [pollOptions, setPollOptions] = useState(
    Array.isArray(existing?.pollOptions) && existing.pollOptions.length >= 2
      ? existing.pollOptions
      : ['유죄', '무죄']
  )
  const [busy, setBusy] = useState(false)

  // 학생 목록 (chairId 선택용)
  const studentList = useMemo(() => {
    const arr = []
    for (const [sid, s] of Object.entries(students || {})) {
      const groupName = groups?.[s?.groupId]?.name || s?.groupId || ''
      arr.push({ sid, number: s?.number, nickname: s?.nickname, groupName })
    }
    arr.sort((a, b) => (a.number || 999) - (b.number || 999))
    return arr
  }, [students, groups])

  const handleSave = async () => {
    if (!roomCode || !caseId) return
    setBusy(true)
    try {
      const chair = chairId ? students?.[chairId] : null
      const chairName = chair ? `${chair.number ? chair.number + '번 ' : ''}${chair.nickname || ''}`.trim() : ''
      await setAt(roomCode, `judicialTrialDraft/${caseId}`, {
        topic: topic.trim(),
        chairId,
        chairName,
        chairLabel: chairLabel.trim() || '재판장',
        proLabel: proLabel.trim(),
        conLabel: conLabel.trim(),
        evaluatorLabel: evaluatorLabel.trim() || '배심원단',
        pollQuestion: pollQuestion.trim() || '피고인은 유죄라고 생각하나요?',
        pollOptions: pollOptions.filter((o) => String(o || '').trim()),
        savedAt: Date.now(),
      })
      alert('재판 준비안을 임시저장했어요. 세션 생성 시 이 설정이 자동 적용됩니다.')
      onClose?.()
    } catch (err) {
      alert('임시저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('임시저장된 준비안을 삭제할까요?')) return
    setBusy(true)
    try {
      await setAt(roomCode, `judicialTrialDraft/${caseId}`, null)
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  const updatePollOpt = (i, v) => setPollOptions((arr) => arr.map((o, idx) => idx === i ? v : o))
  const addPollOpt = () => setPollOptions((arr) => [...arr, ''])
  const removePollOpt = (i) => setPollOptions((arr) => arr.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-200">
          <div>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">재판 미리 준비 (임시저장판)</p>
            <p className="text-sm font-black text-amber-900">⚙️ 토론 세션 생성 전 설정 미리 정하기</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border border-amber-200 hover:bg-amber-100 font-bold text-amber-700">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">📝 토론 논제 (비워두면 자동 생성)</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: '별빛 24시 임금체불 사건'에 대한 검사 및 변호인의 토론"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">👨‍⚖️ 사회자 (판사) 학생</label>
            <select
              value={chairId}
              onChange={(e) => setChairId(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">(지정 안 함 — 토론 도구에서 직접 진행)</option>
              {studentList.map((s) => (
                <option key={s.sid} value={s.sid}>
                  {s.number ? `${s.number}번 ` : ''}{s.nickname}{s.groupName ? ` (${s.groupName})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">사회자로 지정된 학생은 토론 도구에서 단계 진행·발언 제어 권한을 가집니다.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">⚖️ 검사 측 라벨</label>
              <input
                type="text"
                value={proLabel}
                onChange={(e) => setProLabel(e.target.value)}
                placeholder="(비워두면 검사팀 모둠명)"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">🛡️ 변호 측 라벨</label>
              <input
                type="text"
                value={conLabel}
                onChange={(e) => setConLabel(e.target.value)}
                placeholder="(비워두면 변호팀 모둠명)"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">🙋 평가단 라벨</label>
              <input
                type="text"
                value={evaluatorLabel}
                onChange={(e) => setEvaluatorLabel(e.target.value)}
                placeholder="배심원단"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">👨‍⚖️ 사회자 라벨</label>
              <input
                type="text"
                value={chairLabel}
                onChange={(e) => setChairLabel(e.target.value)}
                placeholder="재판장"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">📊 사전 여론조사 질문</label>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p className="text-[10px] font-bold text-gray-500 mt-2">선택지</p>
            <div className="space-y-1.5 mt-1">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updatePollOpt(i, e.target.value)}
                    placeholder={`선택지 ${i + 1}`}
                    className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="button"
                    onClick={() => removePollOpt(i)}
                    disabled={pollOptions.length <= 2}
                    className="px-2 py-1.5 rounded-lg border border-rose-200 text-rose-500 text-xs hover:bg-rose-50 disabled:opacity-30"
                  >✕</button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPollOpt}
                className="w-full py-1.5 text-xs font-bold rounded-lg border-2 border-dashed border-amber-200 text-amber-600 hover:bg-amber-50/40"
              >
                + 선택지 추가
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
          {existing ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            >
              🗑️ 임시저장 삭제
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-2 text-xs font-black rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {busy ? '저장 중…' : '💾 임시저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Phase3JudicialQuickPanel
