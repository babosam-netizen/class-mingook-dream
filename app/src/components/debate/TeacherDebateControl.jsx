import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import useDebateStore, { DEBATE_SIDE_LABELS } from '../../store/debateStore'
import { JUDICIAL_PRESETS } from '../../lib/judicial-case-data'
import { pushUnder, updateAt, setAt, removeAt } from '../../lib/rtdb-helpers'
import SubmissionDetailModal from '../teacher/SubmissionDetailModal'
import DebateTimer, { 
  DEFAULT_DEBATE_STAGES, 
  TRIAL_STAGES, 
  MULTI_PARTY_STAGES, 
  CONSULTATIVE_STAGES,
  computeRemaining,
  getRoundInfo,
  getRoundTeams,
} from './tools/DebateTimer'
import { getDebatePrepCardConfig, normalizeDebatePrepSources } from './tools/DebatePrepCard'
import SpeechEval, { aggregateEval, EVAL_AXES, MiniRadar } from './tools/SpeechEval'
import ArticleSection from '../news/ArticleSection'

const DEFAULT_OPTIONS = ['찬성', '반대', '중립']
const TRIAL_OPTIONS = ['유죄', '무죄', '기타']
const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''
const normalizeOptions = (options = []) =>
  (options || []).map((option) => getText(option)).filter(Boolean)

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function roundLabelForStage(stage, timer, fallbackStageLabel = '') {
  const info = getRoundInfo(timer, stage)
  if (!info.isRound) return fallbackStageLabel
  return `${fallbackStageLabel} — ${info.teamLabel} (${info.teamIdx + 1}/${info.teams.length})`
}

/**
 * 토론 단계 평가 대상의 단일 진입점.
 *
 * 저장 호환 필드:
 * - 일반 단계: evalCount + evalNames
 * - 라운드 단계: roundEvalTargets, 비어 있으면 현재 라운드 팀 1개
 *
 * 평가 생성은 항상 반환된 targets 배열만 사용한다.
 */
function getStageEvalTargets(stage, roundInfo) {
  if (!stage) return []
  if (roundInfo?.isRound) {
    const roundTargets = (Array.isArray(stage.roundEvalTargets) ? stage.roundEvalTargets : [])
      .map((label, idx) => ({ id: `target_${idx}`, label: String(label || '').trim() }))
      .filter((target) => target.label)
    if (roundTargets.length) return roundTargets
    return [{ id: 'target_0', label: roundInfo.teamLabel || '1팀' }]
  }
  const count = Math.max(1, Number(stage.evalCount) || 1)
  const names = Array.from({ length: count }, (_, idx) =>
    (stage.evalNames || [])[idx]?.trim() || `${idx + 1}번째 대상`
  )
  return names.map((label, idx) => ({ id: `target_${idx}`, label }))
}

function buildRoundEvalLabel(stageLabel, roundInfo, targets = []) {
  const speaker = roundInfo?.teamLabel || ''
  const targetText = targets.length ? ` / 평가: ${targets.map((t) => t.label).join(', ')}` : ''
  return `${stageLabel} — 발언: ${speaker}${targetText}`
}

/**
 * 교사 토론 도구 제어판.
 *
 * 1) 세션 관리 — 새 세션 생성 / 의장 지정 / 종료
 * 2) 토론 전 ① 여론조사(StancePoll pre) — 질문/선택지 편집, 열기/닫기, 결과
 * 3) 토론 전 ② 토론 준비 카드 — 활성 토글, 공개 여부 토글, 제출 목록
 *
 * 토론 중/후는 다음 프롬프트에서 확장.
 */
function TeacherDebateControl() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const students = useGameStore((s) => s.students)
  const groups = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const branchConfig = useGameStore((s) => s.config?.branchConfig)

  const session = useDebateStore((s) => s.currentSession)
  const prepCards = useDebateStore((s) => s.prepCards)
  const stancePolls = useDebateStore((s) => s.stancePolls)
  const speechEvals = useDebateStore((s) => s.speechEvals)
  const evaluatorsMap = useDebateStore((s) => s.evaluators)
  const sessionsMap = useDebateStore((s) => s.sessionsMap)
  const attachListener = useDebateStore((s) => s.attachListener)

  // 자동 구독 시작 (이미 어디서 attach 됐다면 중복 호출도 안전)
  useEffect(() => {
    if (roomCode) attachListener(roomCode, myStudentId)
  }, [roomCode, myStudentId, attachListener])

  const [newTitle, setNewTitle] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newType, setNewType] = useState('general') // 'general' | 'trial' | 'multi_party' | 'consultative'
  const [newTeamLabel, setNewTeamLabel] = useState('')
  const [assignmentView, setAssignmentView] = useState('student') // 'student' | 'group'
  const [viewingCard, setViewingCard] = useState(null) // { studentName, ...fields }
  const [viewingScript, setViewingScript] = useState(null) // { sideLabel, body }
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaTopic, setMetaTopic] = useState('')
  const [selectedStageIndices, setSelectedStageIndices] = useState([])

  const type = session?.type || 'general'
  const isTrial = type === 'trial'
  const isMulti = type === 'multi_party'
  const isConsult = type === 'consultative'

  // 재판 증거 송출 관련
  const judicialActiveCase = branchConfig?.judicial?.activeCase
    || JUDICIAL_PRESETS?.find((p) => p.id === (branchConfig?.judicial?.activeCaseId || 'byeolbit_2024'))
    || JUDICIAL_PRESETS?.[0]
  const [broadcastingEvidenceId, setBroadcastingEvidenceId] = useState(null)

  const broadcastEvidence = async (ev) => {
    if (!roomCode) return
    if (broadcastingEvidenceId === ev.id) {
      // 같은 증거 재클릭 → 종료
      await setAt(roomCode, 'judicialPresentation', null)
      setBroadcastingEvidenceId(null)
    } else {
      await setAt(roomCode, 'judicialPresentation', {
        type: 'evidence',
        evidenceId: ev.id,
        title: ev.title,
        description: ev.description || null,
        imageUrl: ev.imageUrl || null,
        canvaUrl: ev.canvaUrl || null,
        imageHint: ev.imageHint || null,
        sampleContent: ev.sampleContent || null,
        side: ev.side,
        caseTitle: judicialActiveCase?.title || null,
      })
      setBroadcastingEvidenceId(ev.id)
    }
  }

  const stopEvidenceBroadcast = async () => {
    if (!roomCode) return
    await setAt(roomCode, 'judicialPresentation', null)
    setBroadcastingEvidenceId(null)
  }

  const MODE_THEME = {
    general: { color: 'indigo', label: '🎙️ 일반 토론', icon: '🎙️', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    trial: { color: 'amber', label: '⚖️ 국민참여재판', icon: '⚖️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    multi_party: { color: 'emerald', label: '👥 다자간 토론', icon: '👥', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    consultative: { color: 'blue', label: '🤝 협의 토론', icon: '🤝', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  }
  const theme = MODE_THEME[type] || MODE_THEME.general
  const prepCardConfig = useMemo(() => getDebatePrepCardConfig(session), [session])
  const viewingCardSources = useMemo(
    () => normalizeDebatePrepSources(viewingCard?.sources),
    [viewingCard?.sources],
  )

  const baseSideLabels = DEBATE_SIDE_LABELS[type] || DEBATE_SIDE_LABELS.general
  const sideLabelOverrides = session?.sideLabelOverrides || {}
  const modeSideLabels = { ...baseSideLabels, ...sideLabelOverrides }

  // 탭 — 'pre' | 'mid' | 'post'  (RTDB session.teacherTab 와 양방향 동기화 → 학생 패널이 자동 따라감)
  const remoteTab = session?.teacherTab
  const [activeTab, setActiveTabLocal] = useState(remoteTab || 'pre')

  // 교사가 클릭 → RTDB 업데이트 → 학생 자동 추종
  const setActiveTab = (next) => {
    setActiveTabLocal(next)
    if (session?.id && roomCode) {
      updateAt(roomCode, `debateSessions/${session.id}`, { teacherTab: next }).catch(() => { })
    }
  }

  // 다른 디바이스에서 교사 탭 변경 시 동기화 (교사가 노트북·태블릿 동시 사용 케이스)
  useEffect(() => {
    if (remoteTab && remoteTab !== activeTab) setActiveTabLocal(remoteTab)
  }, [remoteTab])

  // 도구 활성 변화에 따라 탭 자동 추천 — 도구가 새로 켜질 때만 이동 (초기 로드 시 덮어쓰기 방지)
  const prevToolsRef = useRef(null)
  useEffect(() => {
    const tools = session?.activeTools || []
    const prev = prevToolsRef.current
    if (prev === null) {
      // 초기 로드: 이전값 기록만 하고 탭은 건드리지 않음
      prevToolsRef.current = tools
      return
    }
    const timerJustAdded = !prev.includes('debateTimer') && tools.includes('debateTimer')
    const postPollJustAdded = !prev.includes('stancePollPost') && tools.includes('stancePollPost')
    prevToolsRef.current = tools
    if (timerJustAdded && activeTab === 'pre') setActiveTab('mid')
    if (postPollJustAdded && activeTab !== 'post') setActiveTab('post')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeTools?.join(',')])

  // prevAutoStageRef — ⚡ 자동 평가용 (useEffect는 openStageEval 선언 이후로 이동)
  const prevAutoStageRef = useRef(null)

  // (학생 비표시: 조기 반환은 모든 훅 호출 뒤로 미룸 — 훅 순서 안정 보장)

  const studentsArr = useMemo(
    () => Object.entries(students || {})
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.number || 0) - (b.number || 0)),
    [students],
  )

  const groupEntries = useMemo(
    () => Object.entries(groups || {})
      .map(([id, group]) => {
        const memberIds = Object.keys(group?.members || {})
        const memberList = memberIds
          .map((studentId) => students?.[studentId] ? { id: studentId, ...students[studentId] } : null)
          .filter(Boolean)
          .sort((a, b) => (a.number || 0) - (b.number || 0))
        return {
          id,
          name: group?.name || group?.topic || id,
          emoji: group?.emoji || '🏛️',
          topic: group?.topic || '',
          memberIds,
          memberList,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [groups, students],
  )

  const startNewSession = async () => {
    if (!newTitle.trim() || !newTopic.trim()) return alert('제목과 논제를 모두 입력해 주세요.')
    // 기존 활성 세션 자동 종료
    for (const [sid, s] of Object.entries(sessionsMap || {})) {
      if (s.isActive) {
        await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false, isPopupOpen: false })
      }
    }
    // 새 세션 생성 + 기본 데이터 일괄 초기화
    const id = await pushUnder(roomCode, 'debateSessions', {
      title: newTitle.trim(),
      topic: newTopic.trim(),
      type: newType, // 'general' | 'trial'
      phase: String(currentPhase), // 현재 페이즈 자동 기록
      chairId: '',
      chairName: '',
      activeTools: ['stancePollPre'], // 기본적으로 사전 여론조사 켜둠
      currentDebateStage: 0,
      isActive: true,
      isPopupOpen: false, // 팝업은 기본적으로 닫힘
      // [Antigravity] 노출 전 수정을 위해 타이머 데이터 즉시 생성
      debateTimer: {
        stages: 
          newType === 'trial' ? TRIAL_STAGES : 
          newType === 'multi_party' ? MULTI_PARTY_STAGES :
          newType === 'consultative' ? CONSULTATIVE_STAGES :
          DEFAULT_DEBATE_STAGES,
        currentStage: 0,
        currentTeamIdx: 0,
        isRunning: false,
        isPaused: false,
        pausedRemaining: 0,
        startedAt: 0,
      },
    })
    // 기본 pre 폴
    await setAt(roomCode, `debateSessions/${id}/stancePoll/pre`, {
      question: newType === 'trial' ? '이 사건에 대한 여러분의 생각은?' : '이 논제에 대한 여러분의 입장은?',
      options: newType === 'trial' ? TRIAL_OPTIONS : DEFAULT_OPTIONS,
      isOpen: false,
      allowChange: false,
      type: 'pre',
    })
    setNewTitle('')
    setNewTopic('')
  }

  const endSession = async () => {
    if (!session) return
    if (!confirm(`'${session.title}' 세션을 종료할까요? (데이터는 보존됩니다)`)) return
    await updateAt(roomCode, `debateSessions/${session.id}`, { isActive: false, isPopupOpen: false })
  }

  const setChair = async (sid) => {
    if (!session) return
    const stu = sid ? students[sid] : null
    await updateAt(roomCode, `debateSessions/${session.id}`, {
      chairId: sid || '',
      chairName: stu?.nickname || '',
    })
  }

  const toggleTool = async (tool, on) => {
    if (!session) return
    const cur = Array.isArray(session.activeTools) ? session.activeTools : []
    const next = on ? [...new Set([...cur, tool])] : cur.filter((t) => t !== tool)
    await updateAt(roomCode, `debateSessions/${session.id}`, { activeTools: next })
  }

  const switchMode = async (mode) => {
    if (!session) return
    if (session.type === mode) return
    const labelsMap = {
      general: '일반 토론',
      trial: '국민참여재판',
      multi_party: '다자간 토론',
      consultative: '협의 토론'
    }
    const stagesMap = {
      general: DEFAULT_DEBATE_STAGES,
      trial: TRIAL_STAGES,
      multi_party: MULTI_PARTY_STAGES,
      consultative: CONSULTATIVE_STAGES
    }
    
    if (!confirm(`'${labelsMap[mode]}' 모드로 전환할까요?\n(타이머 단계가 해당 모드의 기본값으로 초기화됩니다)`)) return

    await updateAt(roomCode, `debateSessions/${session.id}`, {
      type: mode,
      'debateTimer/stages': stagesMap[mode],
      'debateTimer/currentStage': 0,
      'debateTimer/currentTeamIdx': 0,
      'debateTimer/isRunning': false,
      'debateTimer/isPaused': false,
    })
    
    // 사전 여론조사 선택지가 기본값이면 함께 변경 제안
    const prePoll = stancePolls?.pre
    const isDefaultGeneral = JSON.stringify(prePoll?.options || []) === JSON.stringify(DEFAULT_OPTIONS)
    const isDefaultTrial = JSON.stringify(prePoll?.options || []) === JSON.stringify(TRIAL_OPTIONS)
    
    if (isDefaultGeneral || isDefaultTrial || !prePoll?.options?.length) {
       const isSpecial = mode === 'trial'
       await updateAt(roomCode, `debateSessions/${session.id}/stancePoll/pre`, {
         options: isSpecial ? TRIAL_OPTIONS : DEFAULT_OPTIONS,
         question: isSpecial ? '이 사건에 대한 여러분의 생각은?' : '이 논제에 대한 여러분의 입장은?'
       })
    }
  }

  // [Antigravity] 토론 팝업 열기/닫기 (여론조사 방식)
  const togglePopup = async () => {
    if (!session) return
    await updateAt(roomCode, `debateSessions/${session.id}`, {
      isPopupOpen: !session.isPopupOpen
    })
  }

  // pre poll
  const prePoll = stancePolls?.pre
  const preOptions = useMemo(
    () => normalizeOptions(prePoll?.options?.length ? prePoll.options : DEFAULT_OPTIONS),
    [prePoll?.options],
  )
  const updatePre = (partial) => {
    if (!session) return
    return updateAt(roomCode, `debateSessions/${session.id}/stancePoll/pre`, partial)
  }
  const togglePreOpen = () => updatePre({ isOpen: !prePoll?.isOpen })
  const setPreQuestion = (q) => updatePre({ question: q })
  const setPreOptions = (opts) => updatePre({ options: opts })

  // pre poll 결과 카운트
  const preCounts = useMemo(() => {
    if (!preOptions.length) return {}
    const m = {}
    for (const o of preOptions) m[o] = 0
    for (const v of Object.values(prePoll?.votes || {})) {
      if (v?.option && m[v.option] !== undefined) m[v.option] += 1
    }
    return m
  }, [prePoll, preOptions])
  const preTotal = Object.values(preCounts).reduce((a, n) => a + n, 0)
  
  // 여론조사 전후 비교 데이터 (v1.2.9 복구)
  const pollCompare = useMemo(() => {
    const pre = stancePolls?.pre || {}
    const post = stancePolls?.post || {}
    const options = preOptions 
    
    const preC = {}
    const postC = {}
    options.forEach(o => { preC[o] = 0; postC[o] = 0; })
    
    Object.values(pre.votes || {}).forEach(v => { if (preC[v.option] !== undefined) preC[v.option]++ })
    Object.values(post.votes || {}).forEach(v => { if (postC[v.option] !== undefined) postC[v.option]++ })
    
    return {
      options,
      preC,
      postC,
      sumPre: Object.values(preC).reduce((a, b) => a + b, 0),
      sumPost: Object.values(postC).reduce((a, b) => a + b, 0)
    }
  }, [stancePolls, preOptions])

  // prep card
  const prepActive = (session?.activeTools || []).includes('prepCard')
  const scriptActive = (session?.activeTools || []).includes('debateScript')
  const isPublic = !!session?.prepCardsPublic

  // ========== 토론 중 타이머 ==========
  const timerActive = (session?.activeTools || []).includes('debateTimer')
  const timer = session?.debateTimer
  const stages = Array.isArray(timer?.stages) && timer.stages.length ? timer.stages : DEFAULT_DEBATE_STAGES
  const curIdx = Number(timer?.currentStage) || 0
  const curRoundInfo = getRoundInfo(timer, stages[curIdx])
  const evalExposureEnabled = !!session?.evalExposureEnabled
  const canGoNextTimerStep = curIdx < stages.length - 1 || (curRoundInfo.isRound && !curRoundInfo.isLastTeam)
  const nextTimerLabel = curRoundInfo.isRound && !curRoundInfo.isLastTeam ? '다음 팀 ▶' : '다음 단계 ▶'
  const selectedStageSet = useMemo(() => new Set(selectedStageIndices), [selectedStageIndices])

  useEffect(() => {
    setSelectedStageIndices((prev) => prev.filter((idx) => idx >= 0 && idx < stages.length))
  }, [stages.length])

  // 1초 tick — 카운트다운 표시
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!timer?.isRunning || timer?.isPaused) return
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [timer?.isRunning, timer?.isPaused, timer?.startedAt, timer?.currentStage, timer?.currentTeamIdx])

  const ensureTimer = async () => {
    if (!session) return
    if (!timer) {
      await setAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
        stages: DEFAULT_DEBATE_STAGES,
        currentStage: 0,
        currentTeamIdx: 0,
        isRunning: false,
        isPaused: false,
        pausedRemaining: 0,
        startedAt: 0,
      })
    }
  }

  const toggleTimer = async (on) => {
    if (on) await ensureTimer()
    await toggleTool('debateTimer', on)
  }

  const updateTimer = (partial) => updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, partial)

  const startTimer = () =>
    updateTimer({ isRunning: true, isPaused: false, startedAt: Date.now() })

  const pauseTimer = () => {
    const remaining = computeRemaining(timer)
    updateTimer({ isRunning: false, isPaused: true, pausedRemaining: remaining })
  }

  const resumeTimer = () => {
    const stageSec = Number(stages[curIdx]?.seconds) || 0
    const remaining = Number(timer?.pausedRemaining) || stageSec
    // 재개 시 startedAt 을 거꾸로 계산해 남은 시간이 보존되게
    const startedAt = Date.now() - (stageSec - remaining) * 1000
    updateTimer({ isRunning: true, isPaused: false, startedAt })
  }

  const nextStage = () => {
    const roundInfo = getRoundInfo(timer, stages[curIdx])
    if (roundInfo.isRound && !roundInfo.isLastTeam) {
      updateTimer({
        currentTeamIdx: roundInfo.teamIdx + 1,
        isRunning: false,
        isPaused: false,
        pausedRemaining: 0,
        startedAt: 0,
      })
      return
    }
    const next = Math.min(stages.length - 1, curIdx + 1)
    updateTimer({ currentStage: next, currentTeamIdx: 0, isRunning: false, isPaused: false, pausedRemaining: 0, startedAt: 0 })
  }
  const resetAll = () =>
    updateTimer({ currentStage: 0, currentTeamIdx: 0, isRunning: false, isPaused: false, pausedRemaining: 0, startedAt: 0 })

  const jumpStage = (i) =>
    updateTimer({ currentStage: i, currentTeamIdx: 0, isRunning: false, isPaused: false, pausedRemaining: 0, startedAt: 0 })

  const updateStageField = (i, partial) => {
    const next = stages.map((s, idx) => (idx === i ? { ...s, ...partial } : s))
    updateTimer({ stages: next })

    // [Antigravity] 수정한 단계가 현재 단계(curIdx)이고, 이미 열려 있는 평가가 있다면 실시간으로 대상을 갱신한다.
    if (i === curIdx && session) {
      const updatedStage = next[i]
      const roundInfo = getRoundInfo(timer, updatedStage)
      const targets = getStageEvalTargets(updatedStage, roundInfo)

      const existing = speechEvals.find((e) =>
        e.isOpen &&
        Number(e.debateStage) === curIdx &&
        (roundInfo.isRound ? Number(e.roundTeamIdx) === roundInfo.teamIdx : e.roundTeamIdx == null)
      )

      if (existing) {
        const stageLabel = updatedStage.label || `${curIdx + 1}단계`
        const targetLabel = roundInfo.isRound
          ? buildRoundEvalLabel(`${curIdx + 1}단계: ${stageLabel}`, roundInfo, targets)
          : `${curIdx + 1}단계: ${stageLabel}`

        updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${existing.id}`, {
          targets,
          targetLabel,
        })
      }
    }
  }
  const removeStage = (i) => {
    if (stages.length <= 1) return alert('최소 1단계는 있어야 합니다.')
    const next = stages.filter((_, idx) => idx !== i)
    const newCur = Math.min(curIdx, next.length - 1)
    updateTimer({ stages: next, currentStage: newCur })
  }
  const moveStage = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= stages.length) return
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]]
    const newCur = curIdx === i ? j : curIdx === j ? i : curIdx
    updateTimer({ stages: next, currentStage: newCur })
  }
  const toggleStageSelection = (i) => {
    setSelectedStageIndices((prev) => {
      const exists = prev.includes(i)
      const next = exists ? prev.filter((idx) => idx !== i) : [...prev, i]
      return next
        .filter((idx) => idx >= 0 && idx < stages.length)
        .sort((a, b) => a - b)
    })
  }
  const clearStageSelection = () => setSelectedStageIndices([])
  const moveSelectedStages = (dir) => {
    const selected = [...new Set(selectedStageIndices)]
      .filter((idx) => idx >= 0 && idx < stages.length)
      .sort((a, b) => a - b)
    if (!selected.length) return alert('먼저 이동할 단계를 선택해 주세요.')
    if (dir < 0 && selected[0] === 0) return
    if (dir > 0 && selected[selected.length - 1] === stages.length - 1) return

    const selectedSet = new Set(selected)
    const items = stages.map((stage, index) => ({ stage, index }))

    if (dir < 0) {
      for (let pos = 1; pos < items.length; pos += 1) {
        if (selectedSet.has(items[pos].index) && !selectedSet.has(items[pos - 1].index)) {
          [items[pos - 1], items[pos]] = [items[pos], items[pos - 1]]
          pos += 1
        }
      }
    } else {
      for (let pos = items.length - 2; pos >= 0; pos -= 1) {
        if (selectedSet.has(items[pos].index) && !selectedSet.has(items[pos + 1].index)) {
          [items[pos + 1], items[pos]] = [items[pos], items[pos + 1]]
          pos -= 1
        }
      }
    }

    const oldToNewIndex = new Map(items.map((item, index) => [item.index, index]))
    const nextSelected = selected
      .map((idx) => oldToNewIndex.get(idx))
      .filter((idx) => Number.isInteger(idx))
      .sort((a, b) => a - b)
    const newCur = oldToNewIndex.get(curIdx) ?? curIdx
    setSelectedStageIndices(nextSelected)
    updateTimer({ stages: items.map((item) => item.stage), currentStage: newCur })
  }
  const addStage = () => {
    const next = [...stages, { label: `새 단계 ${stages.length + 1}`, seconds: 60, hint: '' }]
    updateTimer({ stages: next })
  }
  const resetStagesToDefault = () => {
    const labelsMap = {
      general: '국어 6-1-3단원 기본 7단계',
      trial: '국민참여재판 9단계',
      multi_party: '다자간 토론 5단계',
      consultative: '협의 토론 5단계'
    }
    const stagesMap = {
      general: DEFAULT_DEBATE_STAGES,
      trial: TRIAL_STAGES,
      multi_party: MULTI_PARTY_STAGES,
      consultative: CONSULTATIVE_STAGES
    }
    const mode = session?.type || 'general'
    if (!confirm(`단계를 ${labelsMap[mode]}로 되돌릴까요?`)) return
    updateTimer({ 
      stages: stagesMap[mode], 
      currentStage: 0, 
      currentTeamIdx: 0,
      isRunning: false, 
      isPaused: false, 
      pausedRemaining: 0, 
      startedAt: 0 
    })
  }

  // ========== 토론 후: 평가단 지정 + 발언 평가 + post poll ==========
  const evaluatorIds = useMemo(() => Object.keys(evaluatorsMap || {}), [evaluatorsMap])
  const evaluatorCount = evaluatorIds.length

  // ========== 찬반 진영 배정 (이 토론 한정) ==========
  const proStudents = session?.proStudents || {}
  const conStudents = session?.conStudents || {}
  const extraSides = session?.extraSides || {}
  const extraSideEntries = Object.entries(extraSides)
  const proCount = Object.values(proStudents).filter(Boolean).length
  const conCount = Object.values(conStudents).filter(Boolean).length

  // 학생의 현재 진영 — 'pro' | 'con' | 'evaluator' | 'none'
  const sideOf = (sid) => {
    if (proStudents[sid]) return 'pro'
    if (conStudents[sid]) return 'con'
    if (evaluatorsMap[sid]) return 'evaluator'
    for (const [sideId, side] of extraSideEntries) {
      if (side?.students?.[sid]) return sideId
    }
    return 'none'
  }

  // 학생 진영을 한 번에 변경 — pro/con/evaluator/none 중 하나로 (다른 진영 자동 해제)
  const setStudentSide = async (sid, side) => {
    if (!session) return
    const next = {
      [`proStudents/${sid}`]: side === 'pro' ? true : null,
      [`conStudents/${sid}`]: side === 'con' ? true : null,
      [`evaluators/${sid}`]: side === 'evaluator' ? true : null,
    }
    for (const [sideId] of extraSideEntries) {
      next[`extraSides/${sideId}/students/${sid}`] = side === sideId ? true : null
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, next)
  }

  const setGroupSide = async (group, side) => {
    if (!session || !group?.memberIds?.length) return
    const next = {}
    for (const sid of group.memberIds) {
      next[`proStudents/${sid}`] = side === 'pro' ? true : null
      next[`conStudents/${sid}`] = side === 'con' ? true : null
      next[`evaluators/${sid}`] = side === 'evaluator' ? true : null
      for (const [sideId] of extraSideEntries) {
        next[`extraSides/${sideId}/students/${sid}`] = side === sideId ? true : null
      }
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, next)
  }

  const addExtraTeam = async () => {
    if (!session || type !== 'multi_party') return
    const label = newTeamLabel.trim()
    if (!label) return
    const sideId = `team_${Date.now().toString(36)}`
    await updateAt(roomCode, `debateSessions/${session.id}/extraSides/${sideId}`, {
      label,
      students: {},
      createdAt: Date.now(),
    })
    setNewTeamLabel('')
  }

  const removeExtraTeam = async (sideId) => {
    if (!session) return
    const label = extraSides?.[sideId]?.label || sideId
    if (!confirm(`'${label}' 팀을 삭제할까요? 해당 팀 배정도 함께 해제됩니다.`)) return
    await removeAt(roomCode, `debateSessions/${session.id}/extraSides/${sideId}`)
  }

  const updateBaseTeamLabel = async (sideId, label) => {
    if (!session || !['pro', 'con'].includes(sideId)) return
    const value = label.trim()
    await updateAt(roomCode, `debateSessions/${session.id}/sideLabelOverrides`, {
      [sideId]: value || null,
    })
  }

  const updateExtraTeamLabel = async (sideId, label) => {
    if (!session || !extraSides?.[sideId]) return
    const value = label.trim()
    if (!value) return
    await updateAt(roomCode, `debateSessions/${session.id}/extraSides/${sideId}`, {
      label: value,
      updatedAt: Date.now(),
    })
  }

  const toggleEvaluator = async (sid) => {
    if (!session) return
    const cur = !!evaluatorsMap[sid]
    if (cur) await setStudentSide(sid, 'none')
    else await setStudentSide(sid, 'evaluator')
  }
  const setAllEvaluators = async (on) => {
    if (!session) return
    const next = {}
    for (const s of studentsArr) {
      next[`evaluators/${s.id}`] = on ? true : null
      // 평가단 일괄 지정 시 다른 진영 자동 해제
      if (on) {
        next[`proStudents/${s.id}`] = null
        next[`conStudents/${s.id}`] = null
        for (const [sideId] of extraSideEntries) {
          next[`extraSides/${sideId}/students/${s.id}`] = null
        }
      }
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, next)
  }
  // 미배정(none) 학생을 모두 평가단으로 — 이미 배정된 진영(찬/반/추가편/기존 평가단)은 그대로 둔다.
  const setRestAsEvaluators = async () => {
    if (!session) return
    const next = {}
    let count = 0
    for (const s of studentsArr) {
      if (sideOf(s.id) === 'none') { next[`evaluators/${s.id}`] = true; count++ }
    }
    if (count === 0) { alert('평가단으로 지정할 미배정 학생이 없습니다.'); return }
    await updateAt(roomCode, `debateSessions/${session.id}`, next)
  }
  const clearAllSides = async () => {
    if (!session) return
    if (!confirm('모든 학생의 진영·평가단 배정을 해제할까요?')) return
    const next = {}
    for (const s of studentsArr) {
      next[`proStudents/${s.id}`] = null
      next[`conStudents/${s.id}`] = null
      next[`evaluators/${s.id}`] = null
      for (const [sideId] of extraSideEntries) {
        next[`extraSides/${sideId}/students/${s.id}`] = null
      }
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, next)
  }

  // 활성 평가 (isOpen)
  const activeEvalItem = speechEvals.find((e) => e.isOpen) || null

  // [Antigravity] v1.2.11: 발언 평가 자동 종료 (전원 제출 시)
  useEffect(() => {
    if (!activeEvalItem || evaluatorCount <= 0 || !activeEvalItem.isOpen) return
    if (evalExposureEnabled) return
    const submitted = Object.keys(activeEvalItem.results || {}).length
    if (submitted >= evaluatorCount) {
      // 전원 제출 시 1초 후 자동 종료 (너무 갑작스럽지 않게)
      const t = setTimeout(() => {
        updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${activeEvalItem.id}`, { isOpen: false })
      }, 1000)
      return () => clearTimeout(t)
    }
  }, [activeEvalItem?.results, evaluatorCount, roomCode, session?.id, activeEvalItem?.id, activeEvalItem?.isOpen, evalExposureEnabled])

  // 단계 평가 열기. 모든 평가는 단일 대상이어도 targets 배열로 저장한다.
  // 같은 단계/라운드 팀의 기존 평가가 있으면 재사용하고, 다른 활성 평가는 자동으로 닫는다.
  const openStageEval = async (targets, options = {}) => {
    if (!session || !targets || targets.length === 0) return
    const curStage = Number(timer?.currentStage) || 0
    const stageLabel = stages[curStage]?.label || `${curStage + 1}단계`
    const roundInfo = getRoundInfo(timer, stages[curStage])
    const roundTeamIdx = options.roundTeamIdx ?? (roundInfo.isRound ? roundInfo.teamIdx : null)
    const roundTeamLabel = options.roundTeamLabel ?? (roundInfo.isRound ? roundInfo.teamLabel : '')
    const label = options.targetLabel || (roundInfo.isRound
      ? `${curStage + 1}단계: ${stageLabel} — ${roundTeamLabel}`
      : `${curStage + 1}단계: ${stageLabel}`)
    const existing = speechEvals.find((e) =>
      Number(e.debateStage) === curStage &&
      (roundInfo.isRound ? Number(e.roundTeamIdx) === roundTeamIdx : e.roundTeamIdx == null)
    )
    for (const e of speechEvals) {
      if (e.isOpen && (!existing || e.id !== existing.id)) {
        await updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${e.id}`, { isOpen: false })
      }
    }
    if (existing) {
      await updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${existing.id}`, {
        isOpen: true, targetLabel: label, targets, openedAt: Date.now(),
        ...(roundInfo.isRound ? { roundTeamIdx, roundTeamLabel } : {}),
      })
    } else {
      await pushUnder(roomCode, `debateSessions/${session.id}/speechEvals`, {
        targetLabel: label, targets, debateStage: curStage,
        ...(roundInfo.isRound ? { roundTeamIdx, roundTeamLabel } : {}),
        isOpen: true, openedAt: Date.now(), evaluatorRole: '평가단',
      })
    }
  }

  const openCurrentStageEval = async () => {
    if (!session) return
    const idx = Number(timer?.currentStage) || 0
    const stageLabel = stages[idx]?.label || `${idx + 1}단계`
    const roundInfo = getRoundInfo(timer, stages[idx])
    const targets = getStageEvalTargets(stages[idx], roundInfo)
    if (roundInfo.isRound) {
      await openStageEval(targets, {
        roundTeamIdx: roundInfo.teamIdx,
        roundTeamLabel: roundInfo.teamLabel,
        targetLabel: buildRoundEvalLabel(`${idx + 1}단계: ${stageLabel}`, roundInfo, targets),
      })
      return
    }
    await openStageEval(targets, {
      targetLabel: `${idx + 1}단계: ${stageLabel}`,
    })
  }

  // 평가단 평가 노출 — 켜져 있으면 단계/라운드 팀 변경 시 현재 순서 평가를 자동 노출한다.
  // [Antigravity] 여기에 배치한 이유: openStageEval 이 const 화살표 함수라
  // 위에서 useEffect 안에서 참조하면 TDZ(Temporal Dead Zone) 에러가 프로덕션 빌드에서 발생한다.
  // useRef는 위에서 선언하고, useEffect만 여기에 두어 훅 순서는 유지하되 TDZ를 피한다.
  useEffect(() => {
    const curIdx = Number(timer?.currentStage) ?? 0
    const stage = stages[curIdx]
    const roundInfo = getRoundInfo(timer, stage)
    const autoKey = `${curIdx}:${roundInfo.isRound ? roundInfo.teamIdx : 'stage'}`
    const prev = prevAutoStageRef.current
    // 초기 로드: 이전값만 기록하고 동작 안 함
    if (prev === null) { prevAutoStageRef.current = autoKey; return }
    // 단계 변화 없으면 무시
    if (prev === autoKey) return
    prevAutoStageRef.current = autoKey
    if (!session) return
    if (!evalExposureEnabled) return
    openCurrentStageEval()
  // stages를 deps에 포함하면 편집 중 오발동 위험 → timer.currentStage 변화에만 반응
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.currentStage, timer?.currentTeamIdx, evalExposureEnabled])

  const toggleEvalExposure = async (checked) => {
    if (!session) return
    if (checked && evaluatorCount === 0) {
      alert('평가단이 지정되지 않았습니다.\n[토론 후] 탭에서 평가단을 먼저 지정해 주세요.')
      return
    }
    await updateAt(roomCode, `debateSessions/${session.id}`, { evalExposureEnabled: checked })
    if (checked) {
      await openCurrentStageEval()
      return
    }
    const updates = {}
    for (const e of speechEvals) {
      if (e.isOpen) updates[`speechEvals/${e.id}/isOpen`] = false
    }
    if (Object.keys(updates).length) {
      await updateAt(roomCode, `debateSessions/${session.id}`, updates)
    }
  }

  const closeSpeechEval = async (evalId) => {
    if (!session) return
    await updateAt(roomCode, `debateSessions/${session.id}`, { evalExposureEnabled: false })
    await updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${evalId}`, { isOpen: false })
  }

  const reopenSpeechEval = async (evalId) => {
    if (!session) return
    // 기존 isOpen 평가 닫음
    for (const e of speechEvals) {
      if (e.isOpen && e.id !== evalId) await updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${e.id}`, { isOpen: false })
    }
    await updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${evalId}`, { isOpen: true })
  }

  const removeSpeechEval = async (evalId) => {
    if (!confirm('이 평가 기록을 영구 삭제할까요?')) return
    await removeAt(roomCode, `debateSessions/${session.id}/speechEvals/${evalId}`)
  }

  // post poll
  const postPoll = stancePolls?.post
  const postActive = (session?.activeTools || []).includes('stancePollPost')
  const ensurePostPoll = async () => {
    if (!session) return
    const preOpts = stancePolls?.pre?.options || DEFAULT_OPTIONS
    const q = stancePolls?.pre?.question || '토론 후 최종 의견은?'
    if (!postPoll) {
      await setAt(roomCode, `debateSessions/${session.id}/stancePoll/post`, {
        question: q,
        options: preOpts,
        isOpen: true,
        createdAt: Date.now()
      })
    } else {
      // 이미 존재하면 옵션을 pre 폴과 동기화 + 열기
      await updateAt(roomCode, `debateSessions/${session.id}/stancePoll/post`, {
        isOpen: true,
        options: preOpts,
      })
    }
    toggleTool('stancePollPost', true)
  }
  const togglePostTool = async (checked) => {
    if (!session) return
    if (checked) {
      await ensurePostPoll()
    } else {
      const cur = Array.isArray(session.activeTools) ? session.activeTools : []
      await updateAt(roomCode, `debateSessions/${session.id}`, {
        activeTools: cur.filter((t) => t !== 'stancePollPost'),
      })
    }
  }
  const togglePostOpen = async () => {
    if (!session || !postPoll) return
    await updateAt(roomCode, `debateSessions/${session.id}/stancePoll/post`, { isOpen: !postPoll.isOpen })
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-2 pb-20">
      {/* ① 세션 관리 — 프리미엄 디자인 적용 */}
      <section className={`${theme.bg} rounded-2xl shadow-sm border-2 ${theme.border} p-4 space-y-4`}>
        <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          <h3 className={`font-black text-base flex items-center gap-1.5 ${theme.text}`}>
            <span className="text-xl">{theme.icon}</span> 
            {session ? '토론 세션 관리' : '새 토론 시작'}
          </h3>
          {session && (
            <div className="flex gap-1">
              {Object.entries(MODE_THEME).map(([m, info]) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all font-bold ${
                    type === m 
                      ? `${info.bg} ${info.border} ${info.text} ring-2 ring-white` 
                      : 'bg-white/50 border-gray-200 text-gray-400 hover:bg-white'
                  }`}
                >
                  {info.label.split(' ')[1]}
                </button>
              ))}
            </div>
          )}
        </div>

        {!session ? (
          <div className="space-y-3">
            <div className="bg-white/60 p-3 rounded-xl border border-white/80 space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="세션 제목을 입력하세요 (예: 12차시 환경 재판)"
                className="w-full px-4 py-2 text-sm rounded-lg border-gray-200 focus:ring-2 focus:ring-indigo-400 border"
              />
              <textarea
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="토론 논제를 입력하세요 (예: 플라스틱 컵 사용을 금지해야 한다)"
                rows={2}
                className="w-full px-4 py-2 text-sm rounded-lg border-gray-200 focus:ring-2 focus:ring-indigo-400 border resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MODE_THEME).map(([m, info]) => (
                <button
                  key={m}
                  onClick={() => setNewType(m)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    newType === m 
                      ? `${info.bg} ${info.border} ${info.text} scale-[1.02] shadow-sm` 
                      : 'bg-white border-gray-100 text-gray-400 grayscale'
                  }`}
                >
                  <span className="text-xl mb-1">{info.icon}</span>
                  <span className="text-[11px] font-black">{info.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={startNewSession}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 text-sm"
            >
              세션 생성 및 시작하기
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* 좌측 — 학생 화면 미리보기 카드 */}
            <StudentViewPreview
              session={session}
              prePoll={stancePolls?.pre}
              postPoll={stancePolls?.post}
              prepCards={prepCards}
              speechEvals={speechEvals}
              evaluatorCount={evaluatorCount}
              studentsCount={studentsArr.length}
              sideLabels={modeSideLabels}
            />

            {/* 우측 — 활성 세션 제어 */}
            <div className="flex flex-col justify-between">
              <div className="space-y-2">
                <div className="bg-white/80 p-3 rounded-xl border border-white shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${theme.bg} ${theme.text} border ${theme.border}`}>
                      {theme.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">Phase {session.phase}</span>
                  </div>
                  {editingMeta ? (
                    <div className="mt-1 space-y-1.5">
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder="토론 제목"
                        className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 font-bold"
                      />
                      <textarea
                        value={metaTopic}
                        onChange={(e) => setMetaTopic(e.target.value)}
                        rows={3}
                        placeholder="논제"
                        className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!session?.id) return
                            await updateAt(roomCode, `debateSessions/${session.id}`, { title: metaTitle, topic: metaTopic })
                            setEditingMeta(false)
                          }}
                          className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700"
                        >저장</button>
                        <button
                          type="button"
                          onClick={() => setEditingMeta(false)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg hover:bg-gray-200"
                        >취소</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-black text-gray-900 leading-tight">{session.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{session.topic}</p>
                      <button
                        type="button"
                        onClick={() => { setMetaTitle(session.title || ''); setMetaTopic(session.topic || ''); setEditingMeta(true) }}
                        className="mt-1.5 text-[11px] text-indigo-500 hover:text-indigo-700 font-bold"
                      >✏️ 제목·논제 수정</button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 px-1">
                  <button
                    onClick={togglePopup}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${session.isPopupOpen
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 animate-pulse'
                      }`}
                  >
                    {session.isPopupOpen ? '🔕 학생 화면 도구 내리기' : '🔔 학생 화면 도구 올리기'}
                  </button>
                  <button
                    onClick={endSession}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-bold hover:bg-rose-100 hover:text-rose-600 transition-colors text-xs"
                  >
                    종료
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white/50 rounded-xl border border-white/80 border-dashed">
                <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">의사 진행 안내</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  💡 <b>{modeSideLabels.chair}</b>는 학생 명단에서 별 아이콘을 눌러 지정할 수 있습니다.<br/>
                  💡 지정된 학생은 본인의 화면에서 타이머와 평가 창을 제어할 수 있게 됩니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 탭 바 — 세션이 있을 때만 표시 */}
      {session && (
        <div className="flex gap-1 border-b-2 border-indigo-200 sticky top-0 bg-white z-10">
          {[
            ['pre', '🟢 토론 전', (session.activeTools || []).includes('stancePollPre') || (session.activeTools || []).includes('prepCard')],
            ['mid', '⏱️ 토론 중', (session.activeTools || []).includes('debateTimer')],
            ['post', '📣 토론 후', (session.activeTools || []).includes('stancePollPost') || speechEvals.some((e) => e.isOpen)],
          ].map(([id, label, on]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative px-4 py-2 text-sm font-bold rounded-t-lg transition flex-1 ${activeTab === id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
            >
              {label}
              {on && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ===== 토론 전 탭 — 여론조사 + 준비 카드 ===== */}
      {session && activeTab === 'pre' && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold text-indigo-800">② 토론 전 — 여론조사</h3>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={(session.activeTools || []).includes('stancePollPre')}
                onChange={(e) => toggleTool('stancePollPre', e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              학생에게 노출
            </label>
          </div>

          {prePoll ? (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600">질문</label>
                <input
                  type="text"
                  value={prePoll.question || ''}
                  onChange={(e) => setPreQuestion(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-sm rounded border border-gray-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">선택지</label>
                <OptionEditor
                  options={preOptions}
                  onChange={setPreOptions}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={togglePreOpen}
                  className={`px-3 py-1.5 text-sm rounded font-semibold ${prePoll.isOpen
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {prePoll.isOpen ? '✓ 여론조사 열림 (클릭하여 닫기)' : '여론조사 열기'}
                </button>
                <span className="text-[11px] text-gray-500 ml-auto">
                  {Object.keys(prePoll.votes || {}).length}명 제출
                </span>
              </div>


              {/* 결과 */}
              {preTotal > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs text-gray-500">실시간 결과</p>
                  {preOptions.map((o) => {
                    const c = preCounts[o] || 0
                    const pct = preTotal > 0 ? Math.round((c / preTotal) * 100) : 0
                    return (
                      <div key={o}>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-semibold">{o}</span>
                          <span className="tabular-nums text-gray-500">{c}표 · {pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">여론조사가 초기화되지 않았습니다.</p>
          )}
        </section>
      )}

      {/* ===== 토론 중 탭 — 7단계 타이머 ===== */}
      {session && activeTab === 'mid' && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h3 className="font-bold text-violet-800">⏱️ 토론 중 — 7단계 타이머</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timerActive}
                  onChange={(e) => toggleTimer(e.target.checked)}
                  className="w-4 h-4 accent-violet-600 rounded"
                />
                학생에게 노출
              </label>
              <button
                onClick={() => {
                  const url = `#/debate-timer-tv?room=${roomCode}&sessionId=${session.id}`
                  window.open(url, 'debateTimerTV', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes')
                }}
                className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-100 transition-all active:scale-95"
              >
                <span className="text-[10px]">🖥️</span> TV 송출용
              </button>
            </div>
          </div>

          {/* ── 재판 증거 TV 송출 패널 (모의재판 세션에서만 표시) ── */}
          {isTrial && judicialActiveCase?.evidence?.length > 0 && (
            <div className="mt-3 border border-amber-200 rounded-xl bg-amber-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-amber-800">🗂️ 증거 TV 송출</p>
                {broadcastingEvidenceId && (
                  <button
                    onClick={stopEvidenceBroadcast}
                    className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold hover:bg-red-600"
                  >
                    ■ 송출 종료
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {judicialActiveCase.evidence.map((ev) => {
                  const sideLabel = ev.side === 'prosecution' ? '🔴 검사' : ev.side === 'defense' ? '🔵 변호' : '🟣 공통'
                  const isOn = broadcastingEvidenceId === ev.id
                  return (
                    <button
                      key={ev.id}
                      onClick={() => broadcastEvidence(ev)}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                        isOn
                          ? 'bg-amber-400 border-amber-500 text-white font-black shadow-md'
                          : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-100'
                      }`}
                    >
                      <span className="text-[10px] shrink-0">{sideLabel}</span>
                      <span className="truncate font-semibold">{ev.title}</span>
                      {isOn && <span className="ml-auto text-[10px] animate-pulse shrink-0">📺 송출중</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* [Antigravity] timer 노출 조건 완화: 타이머 데이터가 있으면 항상 편집 가능 */}
          {timer && (
            <>
              {/* 현재 상태 미니 미리보기 */}
              <DebateTimer timer={timer} compact topic={session.topic} />

              {/* 제어 버튼 */}
              <div className="flex flex-wrap gap-2">
                {!timer.isRunning && !timer.isPaused && (
                  <button
                    onClick={startTimer}
                    className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                  >
                    ▶ 시작
                  </button>
                )}
                {timer.isRunning && (
                  <button
                    onClick={pauseTimer}
                    className="px-3 py-1.5 text-sm rounded bg-amber-500 text-white font-bold hover:bg-amber-600"
                  >
                    ⏸ 일시정지
                  </button>
                )}
                {timer.isPaused && (
                  <>
                    <button
                      onClick={resumeTimer}
                      className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                    >
                      ▶ 재개
                    </button>
                    {/* 일시정지 중 남은시간 직접 수정 */}
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      <span className="text-[10px] text-amber-700 font-bold">남은시간:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={Math.floor((Number(timer.pausedRemaining) || 0) / 60)}
                        onChange={(e) => {
                          const m = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                          const sc = (Number(timer.pausedRemaining) || 0) % 60
                          updateTimer({ pausedRemaining: m * 60 + sc })
                        }}
                        className="w-10 px-1 py-0.5 text-xs rounded border border-amber-300 tabular-nums text-center bg-white"
                      />
                      <span className="text-[10px] text-amber-700">분</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={Math.round(Number(timer.pausedRemaining) || 0) % 60}
                        onChange={(e) => {
                          const sc = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                          const m = Math.floor((Number(timer.pausedRemaining) || 0) / 60)
                          updateTimer({ pausedRemaining: m * 60 + sc })
                        }}
                        className="w-10 px-1 py-0.5 text-xs rounded border border-amber-300 tabular-nums text-center bg-white"
                      />
                      <span className="text-[10px] text-amber-700">초</span>
                    </div>
                  </>
                )}
                <button
                  onClick={nextStage}
                  disabled={!canGoNextTimerStep}
                  className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white font-bold disabled:opacity-40 hover:bg-indigo-700"
                >
                  {nextTimerLabel}
                </button>
                <button
                  onClick={resetAll}
                  className="px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
                >
                  ↺ 처음으로
                </button>
                <button
                  onClick={resetStagesToDefault}
                  className="ml-auto px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                  단계 기본값 복원
                </button>
              </div>



              {/* 현재 단계 평가 — 탭 전환 없이 바로 평가 열기 */}
              <div className="pt-2 border-t border-violet-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-semibold">
                    📣 단계 평가 — {roundLabelForStage(stages[curIdx], timer, `${curIdx + 1}단계: ${stages[curIdx]?.label || ''}`)}
                    {(stages[curIdx]?.evalCount || 1) > 1 && (
                      <span className="ml-1.5 text-violet-600 font-bold">({stages[curIdx].evalCount}명)</span>
                    )}
                    {curRoundInfo.isRound && (
                      <span className="ml-1.5 text-emerald-600 font-bold">라운드 {curRoundInfo.teamIdx + 1}/{curRoundInfo.teams.length}</span>
                    )}
                  </span>
                  {activeEvalItem && (
                    <button
                      onClick={() => closeSpeechEval(activeEvalItem.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-rose-100 text-rose-700 font-semibold hover:bg-rose-200"
                    >
                      평가 닫기
                    </button>
                  )}
                </div>

                <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 cursor-pointer hover:bg-violet-100 transition-colors">
                  <span className="text-sm font-black text-violet-800">
                    ✨ {session?.sideLabelOverrides?.evaluator || '평가단'} 평가 노출
                    <span className="block text-[10px] font-semibold text-violet-500 mt-0.5">
                      켜두면 다음 단계/다음 팀으로 넘어갈 때 현재 순서의 평가가 자동으로 보입니다.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={evalExposureEnabled}
                    onChange={(e) => toggleEvalExposure(e.target.checked)}
                    disabled={!stages[curIdx]}
                    className="w-4 h-4 accent-violet-600 disabled:opacity-40"
                  />
                </label>
              </div>
              {/* 평가 진행 학생 공개 토글 */}
              <label className="flex items-center justify-between gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[11px] cursor-pointer">
                <span className="text-amber-800">
                  📊 학생 화면에 평가 진행 상황 공개
                  <span className="text-[10px] text-amber-600 ml-1">
                    (몇 명 중 몇 명 제출했는지 학생 타이머 아래 표시)
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={!!session?.evalStatsPublic}
                  onChange={(e) =>
                    updateAt(roomCode, `debateSessions/${session.id}`, {
                      evalStatsPublic: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-600"
                />
              </label>
              {activeEvalItem && (
                <div className="space-y-1.5">
                  <div className="bg-violet-50 border border-violet-200 rounded p-2 text-[11px] text-violet-800">
                    진행 중: <b>{activeEvalItem.targetLabel}</b> · 제출 {Object.keys(activeEvalItem.results || {}).length}/{evaluatorCount}명
                  </div>
                  
                  {/* 강제 결과 공개 토글 (v1.2.11) */}
                  <label className="flex items-center justify-between gap-2 px-2 py-1.5 bg-violet-100/50 border border-violet-200 rounded-lg text-[10px] cursor-pointer hover:bg-violet-100 transition-colors">
                    <span className="text-violet-700 font-black flex items-center gap-1.5">
                      <span className="text-sm">📢</span> 실시간 결과 미리 노출 (평가 중에도 결과 보임)
                    </span>
                    <input
                      type="checkbox"
                      checked={!!activeEvalItem.forceShowResult}
                      onChange={(e) => updateAt(roomCode, `debateSessions/${session.id}/speechEvals/${activeEvalItem.id}`, { forceShowResult: e.target.checked })}
                      className="w-4 h-4 accent-violet-600"
                    />
                  </label>
                </div>
              )}

              {/* 단계 편집 — 클릭 시 점프 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-gray-500 font-semibold">단계 설정 (번호 클릭 시 해당 단계로 이동)</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold">
                      선택 {selectedStageIndices.length}개
                    </span>
                    <button
                      type="button"
                      onClick={() => moveSelectedStages(-1)}
                      disabled={!selectedStageIndices.length || selectedStageSet.has(0)}
                      className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30"
                      title="선택한 단계를 한 칸 위로"
                    >
                      선택 ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelectedStages(1)}
                      disabled={!selectedStageIndices.length || selectedStageSet.has(stages.length - 1)}
                      className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30"
                      title="선택한 단계를 한 칸 아래로"
                    >
                      선택 ▼
                    </button>
                    <button
                      type="button"
                      onClick={clearStageSelection}
                      disabled={!selectedStageIndices.length}
                      className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-bold text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      title="단계 선택 해제"
                    >
                      해제
                    </button>
                  </div>
                </div>
                {stages.map((s, i) => {
                  const current = i === curIdx
                  const selected = selectedStageSet.has(i)
                  const isRound = !!s.isRound
                  const roundTeams = getRoundTeams(s)
                  const roundEvalTargets = (Array.isArray(s.roundEvalTargets) ? s.roundEvalTargets : [])
                    .map((name) => String(name || ''))
                  const roundTargetNames = roundEvalTargets.length
                    ? roundEvalTargets
                    : [roundTeams[0] || '1팀']
                  const evalCount = Number(s.evalCount) || 1
                  const evalNames = s.evalNames || []
                  return (
                    <div
                      key={i}
                      className={`rounded p-1.5 transition space-y-1.5 ${
                        current
                          ? 'bg-indigo-50 border border-indigo-300'
                          : selected
                            ? 'bg-amber-50 border border-amber-300'
                            : 'bg-gray-50 border border-transparent'
                      }`}
                    >
                      {/* 메인 행 */}
                      <div className="flex items-center gap-1.5">
                        <label className="shrink-0 flex items-center" title="여러 단계를 선택해 함께 이동">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleStageSelection(i)}
                            className="w-3.5 h-3.5 accent-amber-500"
                          />
                        </label>
                        {/* ▲▼ 순서 변경 */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveStage(i, -1)}
                            disabled={i === 0}
                            className="w-5 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-gray-200 text-gray-500 hover:bg-gray-200 disabled:opacity-25"
                            title="위로"
                          >▲</button>
                          <button
                            type="button"
                            onClick={() => moveStage(i, 1)}
                            disabled={i === stages.length - 1}
                            className="w-5 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-gray-200 text-gray-500 hover:bg-gray-200 disabled:opacity-25"
                            title="아래로"
                          >▼</button>
                        </div>
                        <button
                          type="button"
                          onClick={() => jumpStage(i)}
                          className={`text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 ${current ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-indigo-100'}`}
                          title="이 단계로 이동"
                        >
                          {i + 1}
                        </button>
                        <input
                          type="text"
                          value={s.label || ''}
                          onChange={(e) => updateStageField(i, { label: e.target.value })}
                          className="flex-1 px-2 py-1 text-xs rounded border border-gray-300"
                        />
                        {/* 분:초 직접 입력 */}
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={Math.floor((Number(s.seconds) || 0) / 60)}
                          onChange={(e) => {
                            const m = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                            const sec = m * 60 + ((Number(s.seconds) || 0) % 60)
                            updateStageField(i, { seconds: Math.max(5, sec) })
                          }}
                          className="w-10 px-1 py-1 text-xs rounded border border-gray-300 tabular-nums text-center"
                          title="분"
                        />
                        <span className="text-[10px] text-gray-400">분</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={(Number(s.seconds) || 0) % 60}
                          onChange={(e) => {
                            const sc = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                            const total = Math.floor((Number(s.seconds) || 0) / 60) * 60 + sc
                            updateStageField(i, { seconds: Math.max(5, total) })
                          }}
                          className="w-10 px-1 py-1 text-xs rounded border border-gray-300 tabular-nums text-center"
                          title="초"
                        />
                        <span className="text-[10px] text-gray-400">초</span>
                        <label
                          className={`shrink-0 px-1.5 py-1 rounded border text-[10px] font-black cursor-pointer ${
                            isRound ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-400'
                          }`}
                          title="한 단계 안에서 여러 팀이 순서대로 발언"
                        >
                          <input
                            type="checkbox"
                            checked={isRound}
                            onChange={(e) => {
                              const checked = e.target.checked
                              updateStageField(i, checked
                                ? {
                                    isRound: true,
                                    teams: roundTeams.length ? roundTeams : (evalNames.length ? evalNames : ['1팀', '2팀']),
                                    evalCount: 1,
                                  }
                                : { isRound: false }
                              )
                            }}
                            className="sr-only"
                          />
                          라운드
                        </label>
                        {/* 일반 단계 평가 대상 인원 */}
                        {!isRound && (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={4}
                              value={evalCount}
                              onChange={(e) => {
                                const newCount = Math.min(4, Math.max(1, Number(e.target.value) || 1))
                                const existing = s.evalNames || []
                                const newNames = Array.from({ length: newCount }, (_, k) => existing[k]?.trim() || `${k + 1}번째 대상`)
                                updateStageField(i, { evalCount: newCount, evalNames: newNames })
                              }}
                              className="w-9 px-1 py-1 text-xs rounded border border-violet-200 tabular-nums text-center"
                              title="평가 대상 수 (1~4명)"
                            />
                            <span className="text-[10px] text-violet-500" title="평가 대상 수">명</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeStage(i)}
                          className="px-1.5 text-[10px] text-gray-400 hover:text-red-600"
                          title="단계 삭제"
                        >✕</button>
                      </div>

                      {/* 라운드 팀 이름 행 */}
                      {isRound && (
                        <div className="space-y-1.5 pl-[3.25rem]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-emerald-700 font-bold shrink-0">라운드 팀:</span>
                            {(roundTeams.length ? roundTeams : ['1팀', '2팀']).map((teamName, ni) => (
                              <input
                                key={ni}
                                type="text"
                                value={teamName || ''}
                                onChange={(e) => {
                                  const next = [...(roundTeams.length ? roundTeams : ['1팀', '2팀'])]
                                  next[ni] = e.target.value
                                  updateStageField(i, { teams: next, evalNames: next })
                                }}
                                onBlur={(e) => {
                                  if (!e.target.value.trim()) {
                                    const next = [...(roundTeams.length ? roundTeams : ['1팀', '2팀'])]
                                    next[ni] = `${ni + 1}팀`
                                    updateStageField(i, { teams: next, evalNames: next })
                                  }
                                }}
                                placeholder={`${ni + 1}팀`}
                                className="w-20 px-2 py-1 text-xs rounded border border-emerald-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(roundTeams.length ? roundTeams : ['1팀', '2팀']), `${roundTeams.length + 1 || 3}팀`]
                                updateStageField(i, { teams: next, evalNames: next })
                              }}
                              className="px-2 py-1 text-[10px] rounded bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200"
                            >
                              +팀
                            </button>
                            {roundTeams.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = roundTeams.slice(0, -1)
                                  updateStageField(i, { teams: next, evalNames: next })
                                }}
                                className="px-2 py-1 text-[10px] rounded bg-white border border-emerald-200 text-emerald-600 font-bold hover:bg-emerald-50"
                              >
                                -팀
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-violet-700 font-bold shrink-0">평가 대상:</span>
                            {roundTargetNames.map((targetName, ni) => (
                              <input
                                key={ni}
                                type="text"
                                value={targetName || ''}
                                onChange={(e) => {
                                  const next = [...roundTargetNames]
                                  next[ni] = e.target.value
                                  updateStageField(i, { roundEvalTargets: next })
                                }}
                                onBlur={(e) => {
                                  const next = [...roundTargetNames]
                                  if (!e.target.value.trim()) next[ni] = roundTeams[ni] || `${ni + 1}팀`
                                  updateStageField(i, { roundEvalTargets: next })
                                }}
                                placeholder={`${ni + 1}번째 대상`}
                                className="w-24 px-2 py-1 text-xs rounded border border-violet-200 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...roundTargetNames, roundTeams[roundTargetNames.length] || `${roundTargetNames.length + 1}팀`]
                                updateStageField(i, { roundEvalTargets: next })
                              }}
                              className="px-2 py-1 text-[10px] rounded bg-violet-100 text-violet-700 font-bold hover:bg-violet-200"
                            >
                              +대상
                            </button>
                            {roundTargetNames.length > 1 && (
                              <button
                                type="button"
                                onClick={() => updateStageField(i, { roundEvalTargets: roundTargetNames.slice(0, -1) })}
                                className="px-2 py-1 text-[10px] rounded bg-white border border-violet-200 text-violet-600 font-bold hover:bg-violet-50"
                              >
                                -대상
                              </button>
                            )}
                            <span className="text-[10px] text-violet-500">
                              기본 1개, 상호질문은 실제 평가할 대상을 적어 주세요
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 일반 단계 평가 대상 이름 행 */}
                      {!isRound && (
                        <div className="flex items-center gap-1.5 pl-[3.25rem]">
                          <span className="text-[10px] text-violet-600 font-bold shrink-0">평가 대상:</span>
                          {Array.from({ length: evalCount }).map((_, ni) => (
                            <input
                              key={ni}
                              type="text"
                              value={evalNames[ni] || `${ni + 1}번째 대상`}
                              onChange={(e) => {
                                const next = Array.from({ length: evalCount }, (_, k) => evalNames[k] || '')
                                next[ni] = e.target.value
                                updateStageField(i, { evalNames: next })
                              }}
                              onBlur={(e) => {
                                // 비워두면 기본 평가 대상명으로 복원
                                if (!e.target.value.trim()) {
                                  const next = Array.from({ length: evalCount }, (_, k) => evalNames[k] || '')
                                  next[ni] = `${ni + 1}번째 대상`
                                  updateStageField(i, { evalNames: next })
                                }
                              }}
                              placeholder={`${ni + 1}번째 대상`}
                              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-violet-200 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={addStage}
                  className="w-full text-xs py-1 rounded border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
                >
                  + 단계 추가
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 토론 전 탭 — 통합 참가자 배정 (v2.0 핵심 개편) */}
      {session && activeTab === 'pre' && (
        <section className="bg-white rounded-3xl shadow-sm border p-5 space-y-4">
          <div className="flex items-baseline justify-between border-b pb-3">
            <h3 className="font-black text-indigo-800 flex items-center gap-2">
              <span className="text-xl">👥</span> 통합 참가자 관리
            </h3>
            <div className="flex gap-1.5">
              <SideStatusBadge label={modeSideLabels.pro} count={proCount} cls="bg-emerald-100 text-emerald-700" />
              <SideStatusBadge label={modeSideLabels.con} count={conCount} cls="bg-rose-100 text-rose-700" />
              {extraSideEntries.map(([sideId, side]) => (
                <SideStatusBadge
                  key={sideId}
                  label={side.label || sideId}
                  count={Object.keys(side.students || {}).length}
                  cls="bg-amber-100 text-amber-700"
                />
              ))}
              <SideStatusBadge label={modeSideLabels.evaluator} count={evaluatorCount} cls="bg-violet-100 text-violet-700" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
              <p className="text-xs text-slate-500 font-bold">학생 명단에서 역할을 배정하세요</p>
              <div className="flex gap-2">
                 <button onClick={setRestAsEvaluators} className="text-[10px] px-2 py-1 bg-violet-500 text-white rounded-lg font-bold shadow-sm">나머지 전부 {modeSideLabels.evaluator}</button>
                 <button onClick={() => setAllEvaluators(true)} className="text-[10px] px-2 py-1 bg-violet-600 text-white rounded-lg font-bold shadow-sm">전원 {modeSideLabels.evaluator}</button>
                 <button onClick={clearAllSides} className="text-[10px] px-2 py-1 bg-white border border-slate-200 text-slate-400 rounded-lg font-bold">전체 해제</button>
              </div>
            </div>

            {type === 'multi_party' && (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] font-black text-amber-800 mr-auto">
                    다자토론 팀 관리
                  </p>
                  <input
                    type="text"
                    value={newTeamLabel}
                    onChange={(e) => setNewTeamLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addExtraTeam()
                      }
                    }}
                    placeholder="예: C팀, 전문가팀, 시민대표"
                    maxLength={18}
                    className="min-w-[180px] flex-1 px-3 py-1.5 text-xs rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="button"
                    onClick={addExtraTeam}
                    disabled={!newTeamLabel.trim()}
                    className="px-3 py-1.5 text-xs rounded-xl bg-amber-600 text-white font-black disabled:opacity-40 hover:bg-amber-700"
                  >
                    + 팀 추가
                  </button>
                </div>
                {!(isMulti && extraSideEntries.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <EditableTeamName
                      label="기본 A팀 이름"
                      value={modeSideLabels.pro}
                      placeholder={baseSideLabels.pro}
                      color="emerald"
                      onSave={(next) => updateBaseTeamLabel('pro', next)}
                    />
                    <EditableTeamName
                      label="기본 B팀 이름"
                      value={modeSideLabels.con}
                      placeholder={baseSideLabels.con}
                      color="rose"
                      onSave={(next) => updateBaseTeamLabel('con', next)}
                    />
                  </div>
                )}
                {extraSideEntries.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extraSideEntries.map(([sideId, side]) => (
                      <div
                        key={sideId}
                        className="flex items-center gap-1.5 rounded-xl bg-white border border-amber-200 p-2"
                      >
                        <EditableTeamName
                          label="추가 팀 이름"
                          value={side.label || sideId}
                          placeholder="팀 이름"
                          color="amber"
                          onSave={(next) => updateExtraTeamLabel(sideId, next)}
                        />
                        <button
                          type="button"
                          onClick={() => removeExtraTeam(sideId)}
                          className="shrink-0 self-end px-2.5 py-1.5 text-[10px] rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 font-black"
                          title="팀 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-2xl bg-white p-1 border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setAssignmentView('student')}
                  className={`px-3 py-1.5 text-xs rounded-xl font-black transition ${
                    assignmentView === 'student'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  학생별 배정
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentView('group')}
                  className={`px-3 py-1.5 text-xs rounded-xl font-black transition ${
                    assignmentView === 'group'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  시민단체별 배정
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-bold">
                시민단체별 배정은 모둠원 전체의 토론 역할을 한 번에 바꿉니다.
              </p>
            </div>

            {assignmentView === 'student' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {studentsArr.map((s) => {
                  const side = sideOf(s.id)
                  const isMyChair = session.chairId === s.id
                  return (
                    <div key={s.id} className={`flex items-center gap-2 bg-white rounded-xl p-2 border transition-all ${isMyChair ? 'ring-2 ring-amber-400 border-amber-200 shadow-md' : 'border-slate-100 shadow-sm'}`}>
                      <span className="text-[10px] font-mono text-slate-400 w-5 shrink-0">{s.number}</span>
                      <span className="text-xs font-bold flex-1 truncate">{s.nickname}</span>
                      
                      <div className="flex gap-1 flex-wrap justify-end">
                        {/* 의장(재판장) 토글 */}
                        <button
                          onClick={() => setChair(isMyChair ? '' : s.id)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isMyChair ? 'bg-amber-400 text-white shadow-inner' : 'bg-slate-100 text-slate-300 hover:text-amber-500'
                          }`}
                          title={modeSideLabels.chair}
                        >
                          ★
                        </button>
                        <div className="w-px h-4 bg-slate-100 self-center mx-1" />
                        {!(isMulti && extraSideEntries.length > 0) && (
                          <AssignmentChip
                            label={modeSideLabels.pro}
                            active={side === 'pro'}
                            color="emerald"
                            onClick={() => setStudentSide(s.id, side === 'pro' ? 'none' : 'pro')}
                          />
                        )}
                        {!(isMulti && extraSideEntries.length > 0) && (
                          <AssignmentChip
                            label={modeSideLabels.con}
                            active={side === 'con'}
                            color="rose"
                            onClick={() => setStudentSide(s.id, side === 'con' ? 'none' : 'con')}
                          />
                        )}
                        {type === 'multi_party' && extraSideEntries.map(([sideId, extraSide]) => (
                          <AssignmentChip
                            key={sideId}
                            label={extraSide.label || sideId}
                            active={side === sideId}
                            color="amber"
                            onClick={() => setStudentSide(s.id, side === sideId ? 'none' : sideId)}
                          />
                        ))}
                        <AssignmentChip 
                          label={modeSideLabels.evaluator} 
                          active={side === 'evaluator'} 
                          color="violet" 
                          onClick={() => setStudentSide(s.id, side === 'evaluator' ? 'none' : 'evaluator')} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {groupEntries.length === 0 ? (
                  <p className="lg:col-span-2 text-xs text-slate-400 text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                    아직 생성된 시민단체가 없습니다.
                  </p>
                ) : groupEntries.map((group) => {
                  const assignedCounts = group.memberIds.reduce((acc, sid) => {
                    const side = sideOf(sid)
                    acc[side] = (acc[side] || 0) + 1
                    return acc
                  }, {})
                  const mainSide = Object.entries(assignedCounts)
                    .filter(([side]) => side !== 'none')
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
                  const mainLabel = mainSide === 'pro'
                    ? modeSideLabels.pro
                    : mainSide === 'con'
                      ? modeSideLabels.con
                      : mainSide === 'evaluator'
                        ? modeSideLabels.evaluator
                        : extraSides?.[mainSide]?.label || '미배정'
                  return (
                    <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xl leading-none">{group.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-800 truncate">{group.name}</p>
                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">
                              {group.memberList.length}명
                            </span>
                          </div>
                          {group.topic && (
                            <p className="text-[10px] text-slate-400 font-bold truncate">주제: {group.topic}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-black">
                          현재 {mainLabel}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                        {group.memberList.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-bold">아직 모둠원이 없습니다.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {group.memberList.map((member) => {
                              const side = sideOf(member.id)
                              return (
                                <span
                                  key={member.id}
                                  className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                                    side === 'none'
                                      ? 'bg-white text-slate-500 border-slate-200'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                  }`}
                                  title={side === 'pro' ? modeSideLabels.pro : side === 'con' ? modeSideLabels.con : side === 'evaluator' ? modeSideLabels.evaluator : extraSides?.[side]?.label || '미배정'}
                                >
                                  {member.number}번 {member.nickname}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {!(isMulti && extraSideEntries.length > 0) && (
                          <AssignmentChip
                            label={`${modeSideLabels.pro} 전체`}
                            active={group.memberIds.length > 0 && group.memberIds.every((sid) => sideOf(sid) === 'pro')}
                            color="emerald"
                            onClick={() => setGroupSide(group, 'pro')}
                          />
                        )}
                        {!(isMulti && extraSideEntries.length > 0) && (
                          <AssignmentChip
                            label={`${modeSideLabels.con} 전체`}
                            active={group.memberIds.length > 0 && group.memberIds.every((sid) => sideOf(sid) === 'con')}
                            color="rose"
                            onClick={() => setGroupSide(group, 'con')}
                          />
                        )}
                        {type === 'multi_party' && extraSideEntries.map(([sideId, extraSide]) => (
                          <AssignmentChip
                            key={sideId}
                            label={`${extraSide.label || sideId} 전체`}
                            active={group.memberIds.length > 0 && group.memberIds.every((sid) => sideOf(sid) === sideId)}
                            color="amber"
                            onClick={() => setGroupSide(group, sideId)}
                          />
                        ))}
                        <AssignmentChip
                          label={`${modeSideLabels.evaluator} 전체`}
                          active={group.memberIds.length > 0 && group.memberIds.every((sid) => sideOf(sid) === 'evaluator')}
                          color="violet"
                          onClick={() => setGroupSide(group, 'evaluator')}
                        />
                        <AssignmentChip
                          label="전체 해제"
                          active={false}
                          color="slate"
                          onClick={() => setGroupSide(group, 'none')}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
             <SideRosterSimple title={modeSideLabels.pro} list={studentsArr.filter(s => proStudents[s.id])} color="emerald" />
             <SideRosterSimple title={modeSideLabels.con} list={studentsArr.filter(s => conStudents[s.id])} color="rose" />
             {extraSideEntries.map(([sideId, side]) => (
               <SideRosterSimple
                 key={sideId}
                 title={side.label || sideId}
                 list={studentsArr.filter(s => side.students?.[s.id])}
                 color="amber"
               />
             ))}
             <SideRosterSimple title={modeSideLabels.evaluator} list={studentsArr.filter(s => evaluatorsMap[s.id])} color="violet" />
          </div>
        </section>
      )}

      {/* 토론 전 탭 — 준비 카드 */}
      {session && activeTab === 'pre' && (
        <section className="bg-white rounded-3xl shadow-sm border p-5 space-y-4">
          <div className="flex items-baseline justify-between border-b pb-3">
            <h3 className="font-black text-indigo-800 flex items-center gap-2">
               <span className="text-xl">📝</span> 토론 전 — 준비 카드
            </h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepActive}
                  onChange={(e) => toggleTool('prepCard', e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                학생에게 노출
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => updateAt(roomCode, `debateSessions/${session.id}`, { prepCardsPublic: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                친구들 카드 공개
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!session?.prepCardsVisibleToEvaluators}
                  onChange={(e) => updateAt(roomCode, `debateSessions/${session.id}`, { prepCardsVisibleToEvaluators: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                평가단도 작성 허용
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-400 font-bold">{prepCards.length}명 제출함</span>
            <button
              onClick={() => {
                if (confirm('모든 준비 카드를 초기화할까요?')) {
                  removeAt(roomCode, `debateSessions/${session.id}/prepCards`)
                }
              }}
              className="text-rose-500 hover:text-rose-600 text-[10px] font-black uppercase tracking-tighter"
            >
              전체 초기화
            </button>
          </div>

          <div className="max-h-[160px] overflow-y-auto space-y-1.5 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
            {prepCards.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-6 font-bold">아직 제출된 카드가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {prepCards.sort((a,b) => (a.studentNumber||0) - (b.studentNumber||0)).map(c => (
                  <div key={c.id} className="text-[10px] flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm group/card">
                    <button 
                      onClick={() => setViewingCard(c)}
                      className="font-bold truncate mr-1 hover:text-indigo-600 transition-colors flex-1 text-left"
                    >
                      {c.studentNumber}번 {c.studentName}
                    </button>
                    <button onClick={() => removeAt(roomCode, `debateSessions/${session.id}/prepCards/${c.id}`)} className="text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover/card:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 토론 전 탭 — 토론 대본 작성 */}
      {session && activeTab === 'pre' && (
        <section className="bg-white rounded-3xl shadow-sm border p-5 space-y-4">
          <div className="flex items-baseline justify-between border-b pb-3">
            <h3 className="font-black text-indigo-800 flex items-center gap-2">
               <span className="text-xl">🎙️</span> 토론 전 — 대본 작성
            </h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scriptActive}
                  onChange={(e) => toggleTool('debateScript', e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                학생에게 노출
              </label>
            </div>
          </div>

          {/* 대본 열람 영역 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {Object.entries(modeSideLabels).map(([sideId, label]) => {
              if (sideId === 'chair' || sideId === 'evaluator') return null
              const script = session?.scripts?.[sideId]
              return (
                <div key={sideId} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-indigo-900">{label} 대본</h4>
                    <div className="flex items-center gap-2">
                      {script?.body && (
                        <button 
                          onClick={() => setViewingScript({ label, body: script.body })}
                          className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                        >
                          확대 🔍
                        </button>
                      )}
                      {script?.lastAuthor && (
                        <span className="text-[9px] text-slate-400">작성: {script.lastAuthor}</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 min-h-[120px] max-h-[200px] overflow-y-auto">
                    {script?.body ? (
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{script.body}</p>
                    ) : (
                      <p className="text-[10px] text-slate-300 text-center py-10">아직 작성된 내용이 없습니다.</p>
                    )}
                  </div>
                </div>
              )
            })}
            
            {/* 평가단 대본도 표시 */}
            {session?.scripts?.evaluator && (
              <div className="col-span-full bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-900">{modeSideLabels.evaluator} 판정 대본</h4>
                  <div className="flex items-center gap-2">
                    {session.scripts.evaluator.body && (
                      <button 
                        onClick={() => setViewingScript({ label: `${modeSideLabels.evaluator} 판정`, body: session.scripts.evaluator.body })}
                        className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        확대 🔍
                      </button>
                    )}
                    <span className="text-[9px] text-amber-400">작성: {session.scripts.evaluator.lastAuthor}</span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-100 min-h-[80px] max-h-[150px] overflow-y-auto">
                  <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">{session.scripts.evaluator.body}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 카드 상세 열람 오버레이 */}
      {viewingCard && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingCard(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-black text-indigo-900 text-lg">{viewingCard.studentNumber}번 {viewingCard.studentName}</h4>
                <p className="text-xs text-slate-400">{viewingCard.groupName} · {viewingCard.stance} 입장</p>
              </div>
              <button onClick={() => setViewingCard(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">✕</button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-600 uppercase">1. {prepCardConfig.fields.mainClaim.label}</p>
                <p className="text-sm bg-amber-50 p-3 rounded-xl border border-amber-100 leading-relaxed">{viewingCard.mainClaim}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-600 uppercase">2. {prepCardConfig.fields.evidence.label}</p>
                <p className="text-sm bg-blue-50 p-3 rounded-xl border border-blue-100 leading-relaxed">{viewingCard.evidence}</p>
              </div>
              {viewingCardSources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-sky-600 uppercase">출처</p>
                  <div className="bg-sky-50 p-3 rounded-xl border border-sky-100 space-y-1">
                    {viewingCardSources.map((source, index) => (
                      source.url ? (
                        <a
                          key={`${source.title}-${index}`}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs text-sky-700 underline break-all"
                        >
                          {source.title}
                        </a>
                      ) : (
                        <p key={`${source.title}-${index}`} className="text-xs text-sky-700 break-all">{source.title}</p>
                      )
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-rose-600 uppercase">3. {prepCardConfig.fields.rebuttal.label}</p>
                <p className="text-sm bg-rose-50 p-3 rounded-xl border border-rose-100 leading-relaxed">{viewingCard.rebuttal || '(내용 없음)'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-purple-600 uppercase">4. {prepCardConfig.fields.counterRebuttal.label}</p>
                <p className="text-sm bg-purple-50 p-3 rounded-xl border border-purple-100 leading-relaxed">{viewingCard.counterRebuttal}</p>
              </div>
            </div>
            <button onClick={() => setViewingCard(null)} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900">확인</button>
          </div>
        </div>
      )}


      {/* (구) 평가단 지정 섹션 — 진영 배정으로 통합되어 비활성 */}
      {false && session && activeTab === 'pre' && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold text-indigo-800">📋 평가단 지정</h3>
            <span className="text-xs text-violet-600 font-semibold">
              {evaluatorCount}명 지정됨
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            토론 중 단계 평가 시 별점·코멘트를 입력할 학생들을 토론 시작 전에 미리 지정합니다.
            평가단 외 학생은 단계 평가에 참여하지 않습니다.
          </p>
          <div className="flex gap-1 text-[10px]">
            <button
              onClick={() => setAllEvaluators(true)}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded"
            >
              전체 선택
            </button>
            <button
              onClick={() => setAllEvaluators(false)}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded"
            >
              전체 해제
            </button>
          </div>
          <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto bg-gray-50 rounded-lg p-2 border">
            {studentsArr.length === 0 ? (
              <p className="text-[10px] text-gray-400">접속한 학생이 없어요.</p>
            ) : studentsArr.map((s) => {
              const on = !!evaluatorsMap[s.id]
              return (
                <button
                  key={s.id}
                  onClick={() => toggleEvaluator(s.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${on
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
                    }`}
                >
                  {s.number}번 {s.nickname}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ===== 토론 후 탭 — 누적 평가 결과 + 토론 후 여론조사 + 기사쓰기 ===== */}
      {session && activeTab === 'post' && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <h3 className="font-bold text-violet-800">📣 토론 후</h3>

          {/* 누적 평가 결과 (토론 중에 진행한 평가들 — 읽기 전용) */}
          {speechEvals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">📚 단계별 평가 결과 ({speechEvals.length}건)</p>
              <ul className="space-y-1">
                {speechEvals.map((e) => {
                  const agg = aggregateEval(e)
                  return (
                    <li key={e.id} className="bg-gray-50 rounded p-1.5 flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${e.isOpen ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                        {e.isOpen ? '진행' : `${agg.n}명`}
                      </span>
                      <span className="flex-1 truncate font-semibold text-xs">{e.targetLabel}</span>
                      <span className="text-[10px] text-gray-500">
                        ★{((agg.avgs[0] + agg.avgs[1] + agg.avgs[2]) / 3).toFixed(1)}
                      </span>
                      <button
                        onClick={() => removeSpeechEval(e.id)}
                        className="text-[10px] text-red-400 hover:text-red-600"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] text-gray-400">
                💡 단계 평가는 [⏱️ 토론 중] 탭의 타이머 옆 버튼으로 진행합니다.
              </p>
            </div>
          )}

          {/* 토론 후 여론조사 */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-gray-700">🗳️ 토론 후 여론조사 (post)</p>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={postActive}
                  onChange={(e) => togglePostTool(e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                학생에게 노출
              </label>
            </div>

            {postPoll ? (
              <>
                <p className="text-[10px] text-gray-500">
                  토론 전과 동일 질문/선택지로 자동 연동되어 비교가 가능합니다.
                </p>
                <button
                  onClick={togglePostOpen}
                  className={`w-full py-1.5 text-sm rounded font-semibold ${postPoll.isOpen
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {postPoll.isOpen ? '✓ 토론 후 여론조사 열림 (클릭하여 닫기)' : '토론 후 여론조사 열기'}
                </button>
              </>
            ) : (
              <p className="text-[11px] text-gray-400">
                '학생에게 노출' 체크 시 자동으로 초기화됩니다.
              </p>
            )}

            {/* 전후 비교 */}
            {pollCompare && (pollCompare.sumPre > 0 || pollCompare.sumPost > 0) && (
              <div className="space-y-1.5 pt-2 border-t">
                <p className="text-xs font-bold text-gray-700">📊 전후 비교</p>
                {pollCompare.options.map((o) => {
                  const prePct = pollCompare.sumPre ? Math.round((pollCompare.preC[o] / pollCompare.sumPre) * 100) : 0
                  const postPct = pollCompare.sumPost ? Math.round((pollCompare.postC[o] / pollCompare.sumPost) * 100) : 0
                  const delta = postPct - prePct
                  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–'
                  const arrowCls = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-400'
                  return (
                    <div key={o} className="text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="font-semibold">{o}</span>
                        <span className="tabular-nums">
                          {prePct}% → {postPct}% <span className={`font-bold ${arrowCls}`}>{arrow} {Math.abs(delta)}%p</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-400" style={{ width: `${prePct}%` }} />
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500" style={{ width: `${postPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500 text-center">
                  <span>토론 전 ({pollCompare.sumPre}명)</span>
                  <span>토론 후 ({pollCompare.sumPost}명)</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 토론 후 탭 — 기사 쓰기 (학생 제출 + 교사 승인 큐 자동 분기) */}
      {session && activeTab === 'post' && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <h3 className="font-bold text-blue-800">📰 토론 후 기사 쓰기</h3>
          <p className="text-[11px] text-gray-500">
            토론에서 나온 주장·반론·근거를 학생이 기사로 정리해 여론판에 게시합니다.
            교사는 승인 큐로 검토할 수 있어요.
          </p>
          <ArticleSection />
        </section>
      )}

      {/* ===== 지난 토론 세션 (접이식, 최하단) ===== */}
      <PastSessionsPanel
        sessionsMap={sessionsMap}
        currentSessionId={session?.id}
        roomCode={roomCode}
      />
    </div>
  )
}

/** 배정용 미니 칩 */
function AssignmentChip({ label, active, color, onClick }) {
  const colors = {
    emerald: active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    rose: active ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    amber: active ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    violet: active ? 'bg-violet-600 text-white shadow-sm' : 'bg-violet-50 text-violet-600 hover:bg-violet-100',
    slate: active ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
  }
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-1 rounded-lg font-black transition-all ${colors[color]}`}
    >
      {label}
    </button>
  )
}

/** 요약 배지 */
function SideStatusBadge({ label, count, cls }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black shadow-sm ${cls}`}>
      {label} {count}명
    </span>
  )
}

/** 팀 이름 인라인 편집 */
function EditableTeamName({ label, value, placeholder, color, onSave }) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  const save = () => {
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    if (!next && value !== placeholder) onSave('')
  }

  const colors = {
    emerald: 'text-emerald-700 border-emerald-200 focus:ring-emerald-300',
    rose: 'text-rose-700 border-rose-200 focus:ring-rose-300',
    amber: 'text-amber-800 border-amber-200 focus:ring-amber-300',
  }

  return (
    <label className="min-w-0 flex-1">
      <span className="block text-[9px] font-black text-slate-400 mb-0.5">
        {label}
      </span>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        maxLength={18}
        className={`w-full px-2.5 py-1.5 rounded-lg bg-white border text-xs font-black focus:outline-none focus:ring-2 ${colors[color] || colors.amber}`}
      />
    </label>
  )
}

/** 진영별 명단 단순화 */
function SideRosterSimple({ title, list, color }) {
  const colors = {
    emerald: 'bg-emerald-50/50 text-emerald-800 border-emerald-100',
    rose: 'bg-rose-50/50 text-rose-800 border-rose-100',
    amber: 'bg-amber-50/50 text-amber-800 border-amber-100',
    violet: 'bg-violet-50/50 text-violet-800 border-violet-100',
  }
  return (
    <div className={`p-2.5 rounded-2xl border ${colors[color]}`}>
      <p className="text-[10px] font-black mb-1 opacity-70 uppercase tracking-tighter">{title}</p>
      {list.length === 0 ? (
        <p className="text-[10px] opacity-30">미배정</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {list.map(s => (
            <span key={s.id} className="text-[10px] font-bold">
              {s.nickname}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 학생 화면 상태 미리보기 (교사 제어판 좌측 상단)
 * — 학생이 지금 무엇을 보고 있는지 한눈에 파악
 */
function StudentViewPreview({ session, prePoll, postPoll, prepCards, speechEvals, evaluatorCount, studentsCount, sideLabels }) {
  const tools = Array.isArray(session?.activeTools) ? session.activeTools : []
  const showPre = tools.includes('stancePollPre')
  const showPrep = tools.includes('prepCard')
  const showScript = tools.includes('debateScript')
  const showTimer = tools.includes('debateTimer')
  const showPost = tools.includes('stancePollPost')
  const isPublic = !!session?.prepCardsPublic
  const activeEval = speechEvals.find((e) => e.isOpen) || null
 
  const timer = session?.debateTimer
  const stages = Array.isArray(timer?.stages) ? timer.stages : []
  const curStage = stages[Number(timer?.currentStage) || 0]
  const roundInfo = getRoundInfo(timer, curStage)
 
  // 학생이 지금 보는 것 추정
  const currentlyShowing = activeEval
    ? `📣 [단계 평가] ${activeEval.targetLabel}`
    : showTimer && timer?.isRunning
      ? `⏱️ ${curStage?.label || '타이머 진행 중'}${roundInfo.isRound ? ` — ${roundInfo.teamLabel}` : ''}`
      : showPost && postPoll?.isOpen
        ? '🗳️ 토론 후 여론조사 응답 중'
        : showPre && prePoll?.isOpen
          ? '🗳️ 토론 전 여론조사 응답 중'
          : showPrep
            ? '📝 토론 준비 카드 작성 중'
            : (showPre || showPrep || showTimer || showPost)
              ? '⏸️ 도구 활성화됨 (대기)'
              : '🔒 활성 도구 없음 — 학생 화면 비표시'
 
  const prePollVotes = prePoll ? Object.keys(prePoll.votes || {}).length : 0
  const postPollVotes = postPoll ? Object.keys(postPoll.votes || {}).length : 0
  const evalSubmitted = activeEval ? Object.keys(activeEval.results || {}).length : 0
 
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 space-y-3 shadow-inner">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Student Preview</span>
        {session.chairId && (
          <span className="text-[10px] px-2 py-0.5 bg-amber-400 text-white rounded-full font-black shadow-sm">
            {sideLabels.chair}: {session.chairName}
          </span>
        )}
      </div>
 
      {/* 지금 학생이 보는 핵심 메시지 */}
      <div className="bg-slate-800 rounded-xl p-3 text-sm font-black text-white shadow-lg ring-4 ring-slate-100">
        <span className="text-emerald-400 mr-2">●</span>
        {currentlyShowing}
      </div>
 
      {/* 도구별 미니 상태 */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <ToolChip
          on={showPre}
          label="토론전 여론"
          detail={prePoll?.isOpen ? `열림 · ${prePollVotes}명` : showPre ? '닫힘' : ''}
        />
        <ToolChip
          on={showPrep}
          label="준비 카드"
          detail={showPrep ? `${prepCards.length}장 · ${isPublic ? '공개' : '비공개'}` : ''}
        />
        <ToolChip
          on={showScript}
          label="대본 작성"
          detail={showScript ? '활성' : ''}
        />
        <ToolChip
          on={showTimer}
          label="타이머"
          detail={
            showTimer
              ? timer?.isRunning
                ? '실행 중'
                : timer?.isPaused
                  ? '⏸ 일시정지'
                  : '대기'
              : ''
          }
        />
        <ToolChip
          on={showPost}
          label="토론후 여론"
          detail={postPoll?.isOpen ? `열림 · ${postPollVotes}명` : showPost ? '닫힘' : ''}
        />
      </div>
 
      {/* 제출 현황 게이지 (진행 중인 평가) */}
      {activeEval && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span className="text-violet-600">평가단 제출 현황</span>
            <span className="text-slate-400">{evalSubmitted} / {evaluatorCount}명</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-500"
              style={{ width: `${evaluatorCount > 0 ? (evalSubmitted / evaluatorCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 지난 토론 세션 목록 — 접이식, 모달 최하단.
 * 활성 세션은 제외하고 createdAt 역순(최신 위)으로 노출.
 */
function PastSessionsPanel({ sessionsMap, currentSessionId, roomCode }) {
  const list = Object.entries(sessionsMap || {})
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.id !== currentSessionId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const [detailView, setDetailView] = useState(null) // { title, items, type }

  if (list.length === 0) return null

  const reactivate = async (sid) => {
    if (!confirm('이 세션을 다시 활성화할까요? 현재 활성 세션이 있으면 자동 종료됩니다.')) return
    // 기존 활성 세션 닫기
    for (const [otherSid, other] of Object.entries(sessionsMap || {})) {
      if (other.isActive && otherSid !== sid) {
        await updateAt(roomCode, `debateSessions/${otherSid}`, { isActive: false })
      }
    }
    await updateAt(roomCode, `debateSessions/${sid}`, { isActive: true })
  }

  const remove = async (sid, title) => {
    if (!confirm(`'${title}' 세션을 영구 삭제할까요? 해당 세션의 모든 데이터가 사라집니다.`)) return
    await removeAt(roomCode, `debateSessions/${sid}`)
  }

  return (
    <details className="bg-gray-50 rounded-2xl border p-3 group">
      <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <span className="text-base">📚</span>
        <span>지난 토론 세션 ({list.length}건)</span>
        <span className="ml-auto text-xs text-gray-400 group-open:hidden">펼치기 ▼</span>
        <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">접기 ▲</span>
      </summary>

      <ul className="mt-3 space-y-1.5">
        {list.map((s) => {
          const evalCount = Object.keys(s.speechEvals || {}).length
          const cardCount = Object.keys(s.prepCards || {}).length
          const preVotes = Object.keys(s.stancePoll?.pre?.votes || {}).length
          const postVotes = Object.keys(s.stancePoll?.post?.votes || {}).length
          return (
            <li key={s.id} className="bg-white rounded-lg border p-2.5 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-sm flex-1 truncate">{s.title}</span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  Phase {s.phase} · {fmtDate(s.createdAt)}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 truncate">{s.topic}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 flex-wrap">
                {cardCount > 0 && (
                  <button 
                    onClick={() => setDetailView({ 
                      title: `'${s.title}' 준비 카드 목록`, 
                      type: 'cards', 
                      items: Object.values(s.prepCards || {}) 
                    })}
                    className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-bold transition-colors"
                  >
                    📝 카드 {cardCount}
                  </button>
                )}
                {preVotes > 0 && (
                  <button 
                    onClick={() => setDetailView({ 
                      title: `'${s.title}' 토론 전 투표 결과`, 
                      type: 'votes', 
                      items: Object.entries(s.stancePoll?.pre?.votes || {}).map(([sid, v]) => ({ sid, ...v })) 
                    })}
                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 font-bold transition-colors"
                  >
                    🗳️ 토론전 {preVotes}
                  </button>
                )}
                {postVotes > 0 && (
                  <button 
                    onClick={() => setDetailView({ 
                      title: `'${s.title}' 토론 후 투표 결과`, 
                      type: 'votes', 
                      items: Object.entries(s.stancePoll?.post?.votes || {}).map(([sid, v]) => ({ sid, ...v })) 
                    })}
                    className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-bold transition-colors"
                  >
                    🗳️ 토론후 {postVotes}
                  </button>
                )}
                {evalCount > 0 && (
                  <button 
                    onClick={() => setDetailView({ 
                      title: `'${s.title}' 평가 내역`, 
                      type: 'evals', 
                      items: Object.values(s.speechEvals || {}) 
                    })}
                    className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded hover:bg-violet-100 font-bold transition-colors"
                  >
                    📣 평가 {evalCount}건
                  </button>
                )}
                {s.chairName && <span className="px-1.5 py-0.5 bg-gray-100 rounded">의장 {s.chairName}</span>}
                <span className="ml-auto flex gap-1">
                  <button
                    onClick={() => reactivate(s.id)}
                    className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 font-semibold"
                    title="이 세션을 다시 활성화"
                  >
                    재개
                  </button>
                  <button
                    onClick={() => remove(s.id, s.title)}
                    className="px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                    title="영구 삭제"
                  >
                    삭제
                  </button>
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {detailView && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setDetailView(null)}
          title={detailView.title}
          items={detailView.items}
          renderItem={(item) => {
            if (detailView.type === 'cards') {
              const itemSources = normalizeDebatePrepSources(item.sources)
              return (
                <div className="space-y-1">
                  <p className="text-xs font-black text-indigo-600">{item.studentNumber}번 {item.studentName} ({item.stance})</p>
                  <p className="text-sm font-bold">주장: {item.mainClaim}</p>
                  <p className="text-xs text-slate-500">근거: {item.evidence}</p>
                  {itemSources.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-sky-600">출처</p>
                      {itemSources.map((source, index) => (
                        source.url ? (
                          <a
                            key={`${source.title}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[10px] text-sky-700 underline break-all"
                          >
                            {source.title}
                          </a>
                        ) : (
                          <p key={`${source.title}-${index}`} className="text-[10px] text-sky-700 break-all">{source.title}</p>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            if (detailView.type === 'votes') {
              return (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{item.nickname || item.sid}</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-black">{item.optionId}</span>
                </div>
              )
            }
            if (detailView.type === 'evals') {
              return (
                <div className="space-y-1">
                  <p className="text-xs font-black text-violet-600">{item.targetLabel}</p>
                  <p className="text-[10px] text-slate-400">{Object.keys(item.results || {}).length}명 참여</p>
                </div>
              )
            }
            return null
          }}
        />
      )}
    </details>
  )
}

/** 선택지 in-place 에디터 */
function OptionEditor({ options, onChange }) {
  const normalized = Array.isArray(options) ? options : ['찬성', '반대']
  const [draft, setDraft] = useState('')
  const update = (i, v) => {
    const next = [...normalized]
    next[i] = v
    onChange(next)
  }
  const remove = (i) => {
    if (normalized.length <= 2) return alert('최소 2개의 선택지가 필요합니다.')
    onChange(normalized.filter((_, idx) => idx !== i))
  }
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (normalized.includes(v)) return
    onChange([...normalized, v])
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      {normalized.map((o, i) => (
        <div key={i} className="flex gap-1">
          <input
            type="text"
            value={o}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 px-2 py-1 text-sm rounded border border-gray-300"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="px-2 text-xs bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="선택지 추가"
          className="flex-1 px-2 py-1 text-sm rounded border border-gray-300"
        />
        <button
          type="button"
          onClick={add}
          className="px-2 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded"
        >
          추가
        </button>
      </div>
    </div>
  )
}

function ToolChip({ on, label, detail }) {
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-1 rounded ${on ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-400'
        }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      <span className="font-semibold">{label}</span>
      {on && detail && <span className="ml-auto text-[9px] opacity-80">{detail}</span>}
    </div>
  )
}

export default TeacherDebateControl
