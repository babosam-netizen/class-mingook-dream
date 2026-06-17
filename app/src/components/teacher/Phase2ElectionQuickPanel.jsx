import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt, pushUnder, getOnce } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { calculateRanks } from '../../lib/election'

const ROLE_OPTIONS = [
  { value: '',       label: '없음',     emoji: '' },
  { value: '대통령', label: '대통령',   emoji: '🇰🇷' },
  { value: '국회의장', label: '국회의장', emoji: '🏛️' },
  { value: '판사',   label: '판사',     emoji: '⚖️' },
]
const DEFAULT_ROLE_BY_RANK = { 1: '대통령', 2: '국회의장', 3: '판사' }

const ELECTION_DEBATE_STAGES = [
  { label: '각 후보별 기조 발언',       seconds: 300, hint: '후보별로 공약과 핵심 주장을 발표합니다' },
  { label: '후보별 상호 질의 및 응답',   seconds: 420, hint: '다른 후보의 공약에 질문하고 답변합니다' },
  { label: '공통 쟁점 자유 토론',       seconds: 600, hint: '최우선 과제 해결 방안을 두고 자유롭게 토론합니다' },
  { label: '최종 발언 및 정리',         seconds: 240, hint: '후보별로 최종 공약과 입장을 정리합니다' },
  { label: '판정단 판정 및 결과 발표',   seconds: 180, hint: '판정단이 결과를 발표합니다' },
]

const normalizeOptions = (rawOptions = []) =>
  rawOptions.map((o, i) =>
    typeof o === 'string'
      ? { id: `opt_${i}`, label: o }
      : { id: o?.id || `opt_${i}`, label: o?.label || String(o || ''), ...(o?.groupId ? { groupId: o.groupId } : {}) },
  )

const medals = ['🥇', '🥈', '🥉']

const STATUS_META = {
  ready:  { label: '준비',   cls: 'bg-gray-100 text-gray-600' },
  voting: { label: '투표 중', cls: 'bg-emerald-100 text-emerald-700' },
  ended:  { label: '마감',   cls: 'bg-rose-100 text-rose-600' },
}

function Phase2ElectionQuickPanel({ onOpenDebateTool }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const countryName = useGameStore((s) => s.config?.countryName) || '축소국'
  const coreIssue = useGameStore((s) => s.roomData?.coreIssue) || '최우선과제'
  const electionStatus = useGameStore((s) => s.electionStatus)
  const setElectionStatus = useGameStore((s) => s.setElectionStatus)

  const wf = useWorkflow()
  const currentStepId = wf.currentStep?.id
  // 단계별 섹션 가시성 — 해당 단계에만 관련 섹션 노출
  const showPollSection   = currentStepId === 'prepoll'
  const showDebateSection = ['debatePrep', 'debateEval'].includes(currentStepId)
  const showVoteControl   = ['vote', 'finalNews', 'nextJourney'].includes(currentStepId)

  const [pollsMap, setPollsMap] = useState({})
  const [candidatesMap, setCandidatesMap] = useState({})
  const [debateSessions, setDebateSessions] = useState(null)
  const [electionVotes, setElectionVotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [voteCtrlBusy, setVoteCtrlBusy] = useState(false)

  const config = useGameStore((s) => s.config)
  const showJournalistSupport = !!(config?.showJournalistSupport)

  const toggleJournalistSupport = async () => {
    try {
      await updateAt(roomCode, 'config', { showJournalistSupport: !showJournalistSupport })
    } catch (err) {
      alert('설정 변경 실패: ' + err.message)
    }
  }

  const [topN, setTopN] = useState(0)

  // 사전 여론조사 편집 상태
  const [editingPoll, setEditingPoll] = useState(false)
  const [pollDraft, setPollDraft] = useState(null)
  const [pollBusy, setPollBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'polls', (d) => setPollsMap(d || {}))
    const u2 = subscribe(roomCode, 'candidates', (d) => setCandidatesMap(d || {}))
    const u3 = subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {}))
    const u4 = subscribe(roomCode, 'electionVotes', (d) => setElectionVotes(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.() }
  }, [roomCode])

  // ── 🗳️ 본 투표 컨트롤 액션 ─────────────────────────────────
  const totalStudentsCount = Object.keys(students || {}).length
  const votedCount = Object.keys(electionVotes).length
  const candidatesReady = Object.keys(candidatesMap).length >= 2

  // 활성 선거 토론 세션 자동 종료 (학생 화면 풀모달 해제)
  // getOnce로 최신 Firebase 데이터를 직접 읽어 로컬 상태 stale 문제 방지
  const closeActiveElectionDebate = async () => {
    const freshSessions = await getOnce(roomCode, 'debateSessions')
    if (!freshSessions) return
    for (const [sid, s] of Object.entries(freshSessions)) {
      if (s?.isActive || s?.isPopupOpen) {
        await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false, isPopupOpen: false })
      }
    }
  }

  const startVote = async () => {
    if (!candidatesReady) {
      alert('후보가 2명 이상 등록되어야 투표를 시작할 수 있어요.')
      return
    }
    if (voteCtrlBusy) return
    if (Object.keys(electionVotes).length > 0) {
      if (!confirm('이미 기록된 투표가 있어요. 그대로 두고 투표를 다시 열까요?')) return
    }
    setVoteCtrlBusy(true)
    try {
      await closeActiveElectionDebate()
      await setElectionStatus('voting')
    } catch (err) { alert('투표 시작 실패: ' + err.message) }
    finally { setVoteCtrlBusy(false) }
  }
  // 📺 기존 투표 결과 보이기 (votes는 있는데 결과 화면이 안 보이는 상태)
  const showExistingResult = async () => {
    if (voteCtrlBusy) return
    setVoteCtrlBusy(true)
    try {
      await closeActiveElectionDebate()
      await setElectionStatus('ended')
    } catch (err) { alert('결과 표시 실패: ' + err.message) }
    finally { setVoteCtrlBusy(false) }
  }
  const endVoteAndShowResult = async () => {
    if (voteCtrlBusy) return
    if (votedCount === 0) {
      if (!confirm('아직 아무도 투표하지 않았어요. 정말 결과를 공개하시겠어요?')) return
    } else if (votedCount < totalStudentsCount) {
      if (!confirm(`${totalStudentsCount - votedCount}명이 아직 투표하지 않았어요. 그래도 결과를 공개할까요?`)) return
    }
    setVoteCtrlBusy(true)
    try {
      await closeActiveElectionDebate()
      await setElectionStatus('ended')
    } catch (err) { alert('결과 공개 실패: ' + err.message) }
    finally { setVoteCtrlBusy(false) }
  }
  const reopenVote = async () => {
    if (voteCtrlBusy) return
    if (!confirm('투표를 다시 열까요? (기존 투표는 그대로 유지)')) return
    setVoteCtrlBusy(true)
    try {
      await closeActiveElectionDebate()
      await setElectionStatus('voting')
    } catch (err) { alert('재오픈 실패: ' + err.message) }
    finally { setVoteCtrlBusy(false) }
  }
  const resetElectionVotes = async () => {
    if (voteCtrlBusy) return
    if (!confirm('모든 본 투표 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    setVoteCtrlBusy(true)
    try {
      await setAt(roomCode, 'electionVotes', null)
      await setElectionStatus('idle')
    } catch (err) { alert('초기화 실패: ' + err.message) }
    finally { setVoteCtrlBusy(false) }
  }

  // 사전 여론조사 전체 데이터 (pollId 포함)
  const prePollEntry = useMemo(() => {
    const entries = Object.entries(pollsMap)
      .filter(([, p]) => Number(p?.phaseStep?.phase) === 2 && p?.phaseStep?.stepId === 'prepoll')
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    return entries.length ? { id: entries[0][0], ...entries[0][1] } : null
  }, [pollsMap])

  // 사전 여론조사 순위 계산
  const prePollRanks = useMemo(() => {
    if (!prePollEntry) return []
    const counts = {}
    for (const v of Object.values(prePollEntry.votes || {})) {
      if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
    }
    const options = normalizeOptions(prePollEntry.options || [])
    const mapped = options.map((o) => ({
      optionId: o.id,
      label: o.label,
      count: counts[o.id] || 0,
      candidateGroupId: o.groupId || Object.keys(candidatesMap).find(
        (gid) => (groups?.[gid]?.name || '') === o.label,
      ) || null,
    }))
    if (mapped.every((o) => o.count === 0)) return []
    return mapped
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [prePollEntry, candidatesMap, groups])

  const prePollTotal = prePollRanks.reduce((s, r) => s + r.count, 0)

  // 활성 선거 토론 세션
  const electionDebate = useMemo(() =>
    Object.entries(debateSessions || {})
      .map(([id, s]) => ({ id, ...s }))
      .find((s) => s?.relatedElectionDebate && s?.isActive) || null,
  [debateSessions])

  const candidateCount = Object.keys(candidatesMap).length

  // 득표 순위 계산 (직책 배정용)
  const electionRanks = useMemo(() => calculateRanks(candidatesMap, electionVotes), [candidatesMap, electionVotes])

  // 직책 변경 — 즉시 config.electionRoles에 저장
  const changeRole = async (rank, newLabel) => {
    const emoji = ROLE_OPTIONS.find((o) => o.value === newLabel)?.emoji || ''
    const others = (config?.electionRoles || []).filter((r) => Number(r?.rank) !== rank)
    const next = newLabel ? [...others, { rank, label: newLabel, emoji }] : others
    await updateAt(roomCode, 'config', { electionRoles: next })
  }

  // 등수별 현재 직책 레이블 (config 우선, 없으면 기본값)
  const getRoleLabel = (rank) => {
    const found = (config?.electionRoles || []).find((r) => Number(r?.rank) === rank)
    if (found !== undefined) return found?.label || ''
    return DEFAULT_ROLE_BY_RANK[rank] || ''
  }

  // 참여 후보 목록 (topN 기준)
  const participatingGids = useMemo(() => {
    const rankedGids = prePollRanks.length > 0
      ? prePollRanks.filter((r) => r.candidateGroupId).map((r) => r.candidateGroupId)
      : Object.keys(candidatesMap)
    const extra = Object.keys(candidatesMap).filter((gid) => !rankedGids.includes(gid))
    const all = [...rankedGids, ...extra]
    return topN === 0 ? all : all.slice(0, topN)
  }, [prePollRanks, candidatesMap, topN])

  const evaluatorGids = useMemo(() =>
    Object.keys(groups || {}).filter(
      (gid) => Object.keys(groups[gid]?.members || {}).length > 0 && !participatingGids.includes(gid),
    ),
  [groups, participatingGids])

  // ── 사전 여론조사 액션 ──────────────────────────────────────

  // 등록된 후보를 여론조사 선택지로 자동 채우기 (생성 또는 업데이트)
  const applyPrepollFromCandidates = async () => {
    if (pollBusy) return
    const sorted = Object.values(candidatesMap)
      .sort((a, b) => (a.candidateNumber ?? 999) - (b.candidateNumber ?? 999))
    if (sorted.length < 2) { alert('후보가 2명 이상 등록된 후 사용하세요.'); return }
    const options = sorted.map((c) => ({
      id: `cand_${c.groupId}`,
      label: `기호${c.candidateNumber}번 ${c.leaderNickname || groups?.[c.groupId]?.name || c.groupId}`,
      groupId: c.groupId,
    }))
    setPollBusy(true)
    try {
      if (prePollEntry) {
        await updateAt(roomCode, `polls/${prePollEntry.id}`, { options })
      } else {
        await pushUnder(roomCode, 'polls', {
          question: '현재 지지하는 후보는 누구인가요? (그 이유도 꼭 써주세요)',
          options,
          status: 'ready',
          phaseStep: { phase: 2, stepId: 'prepoll' },
          createdAt: Date.now(),
        })
      }
    } catch (err) {
      alert('여론조사 자동 생성 실패: ' + err.message)
    } finally {
      setPollBusy(false)
    }
  }

  const togglePollStatus = async () => {
    if (!prePollEntry || pollBusy) return
    const next = prePollEntry.status === 'voting' ? 'ended' : 'voting'
    setPollBusy(true)
    try {
      await updateAt(roomCode, `polls/${prePollEntry.id}`, { status: next })
    } catch (err) {
      alert('상태 변경 실패: ' + err.message)
    } finally {
      setPollBusy(false)
    }
  }

  const openEditPoll = () => {
    if (!prePollEntry) return
    setPollDraft({
      question: prePollEntry.question || '',
      options: normalizeOptions(prePollEntry.options || []),
    })
    setEditingPoll(true)
  }

  const savePollDraft = async () => {
    if (!prePollEntry || !pollDraft || pollBusy) return
    const cleanOptions = pollDraft.options.filter((o) => o.label.trim())
    if (cleanOptions.length < 2) { alert('선택지는 최소 2개 필요합니다.'); return }
    setPollBusy(true)
    try {
      await updateAt(roomCode, `polls/${prePollEntry.id}`, {
        question: pollDraft.question.trim(),
        options: cleanOptions,
      })
      setEditingPoll(false)
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setPollBusy(false)
    }
  }

  const resetPollVotes = async () => {
    if (!prePollEntry) return
    if (!confirm('모든 투표를 초기화할까요? 되돌릴 수 없습니다.')) return
    setPollBusy(true)
    try {
      await setAt(roomCode, `polls/${prePollEntry.id}/votes`, null)
    } catch (err) {
      alert('초기화 실패: ' + err.message)
    } finally {
      setPollBusy(false)
    }
  }

  const updateDraftOption = (idx, value) => {
    setPollDraft((d) => ({
      ...d,
      options: d.options.map((o, i) => i === idx ? { ...o, label: value } : o),
    }))
  }

  const addDraftOption = () => {
    setPollDraft((d) => ({
      ...d,
      options: [...d.options, { id: `opt_new_${Date.now()}`, label: '' }],
    }))
  }

  const removeDraftOption = (idx) => {
    setPollDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== idx) }))
  }

  // ── 토론 세션 생성 ───────────────────────────────────────────
  const doCreateDebate = async () => {
    if (!roomCode) return

    for (const [sid, s] of Object.entries(debateSessions || {})) {
      if (s?.isActive) await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false })
    }

    const extraSides = {}
    const debateTeamNames = []
    participatingGids.forEach((gid, idx) => {
      const group = groups?.[gid]
      if (!group) return
      const rankItem = prePollRanks.find((r) => r.candidateGroupId === gid)
      const rankPrefix = rankItem ? `${rankItem.rank}위 ` : ''
      const label = `${rankPrefix}${group.name || `후보 ${idx + 1}`}`
      debateTeamNames.push(label)
      const students = Object.keys(group.members || {}).reduce((acc, sid) => {
        acc[sid] = true; return acc
      }, {})
      extraSides[`election_${gid}`] = { label, students, createdAt: Date.now() }
    })
    const electionStages = ELECTION_DEBATE_STAGES.map((stage, idx) =>
      idx === 0 || idx === 1 || idx === 3
        ? { ...stage, isRound: true, teams: debateTeamNames, evalNames: debateTeamNames }
        : stage
    )

    const evaluators = {}
    evaluatorGids.forEach((gid) => {
      Object.keys(groups?.[gid]?.members || {}).forEach((sid) => { evaluators[sid] = true })
    })

    const sessionId = await pushUnder(roomCode, 'debateSessions', {
      title: `${countryName} 대통령 후보 토론회`,
      topic: `어떤 후보가 '${coreIssue}'를 가장 잘 해결할 수 있을까요?`,
      phase: '2',
      type: 'multi_party',
      chairId: '',
      chairName: '사회자',
      activeTools: ['stancePollPre', 'prepCard', 'debateScript', 'debateTimer'],
      teacherTab: 'pre',
      currentDebateStage: 0,
      isActive: true,
      isPopupOpen: false,   // 선거 토론은 팝업 자동오픈 안 함 — 학생이 플로팅버튼으로 직접 열기
      relatedElectionDebate: true,
      sourceStepId: 'debatePrep',
      proStudents: {},
      conStudents: {},
      evaluators,
      extraSides,
      sideLabelOverrides: { evaluator: '평가단' },
      debateTimer: {
        stages: electionStages,
        currentStage: 0,
        currentTeamIdx: 0,
        isRunning: false,
        isPaused: false,
        pausedRemaining: electionStages[0]?.seconds || 0,
        visibleToStudents: true,
      },
    })

    const candidateOptions = participatingGids
      .filter((gid) => groups?.[gid])
      .map((gid, idx) => {
        const group = groups?.[gid]
        const rankItem = prePollRanks.find((r) => r.candidateGroupId === gid)
        const label = rankItem ? `${rankItem.rank}위 ${group.name}` : (group.name || `후보 ${idx + 1}`)
        return { id: `candidate_${idx}`, label }
      })

    if (candidateOptions.length >= 2) {
      await setAt(roomCode, `debateSessions/${sessionId}/stancePoll/pre`, {
        question: '현재 지지하는 후보는 누구인가요?',
        options: candidateOptions,
        isOpen: true,
        allowChange: false,
        type: 'pre',
      })
    }
  }

  const handleCreate = async () => {
    if (busy || participatingGids.length === 0) return
    setBusy(true)
    try {
      await doCreateDebate()
    } catch (err) {
      alert('토론 세션 생성 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleEndAndReset = async () => {
    if (!electionDebate || !confirm('현재 토론 세션을 종료하고 새로 설정할까요?')) return
    await updateAt(roomCode, `debateSessions/${electionDebate.id}`, { isActive: false })
  }

  const pollStatusMeta = STATUS_META[prePollEntry?.status] || STATUS_META.ready

  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-violet-800">
          {showPollSection   ? '📊 사전 여론조사 제어' :
           showDebateSection ? '🎙️ 선거 토론 제어'    :
           showVoteControl   ? '🗳️ 선거 본 투표 제어'  :
                               '🗳️ 선거 빠른 제어'}
        </h3>
        {(busy || pollBusy || voteCtrlBusy) && <span className="text-xs text-violet-500 animate-pulse">처리 중...</span>}
      </div>

      {/* 기자단 지지선언문 허용 토글 — 토론 단계(5·6단계)에만 노출 */}
      {showDebateSection && (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
        <div>
          <p className="text-xs font-bold text-blue-800">🤝 기자단 지지선언문 허용</p>
          <p className="text-[10px] text-blue-500">기자단 모둠에도 지지선언문 작성란 노출</p>
        </div>
        <button
          type="button"
          onClick={toggleJournalistSupport}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            showJournalistSupport ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            showJournalistSupport ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      )}

      {/* ── 🗳️ 본 투표 컨트롤 — 7단계(vote) 이후에만 노출 ─────── */}
      {showVoteControl && (
      <div className="border-2 border-amber-300 rounded-xl overflow-hidden bg-amber-50">
        <div className="bg-amber-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-amber-900">🗳️ 선거 본 투표</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              electionStatus === 'voting' ? 'bg-emerald-200 text-emerald-800' :
              electionStatus === 'ended'  ? 'bg-rose-200 text-rose-800'       :
                                            'bg-gray-200 text-gray-700'
            }`}>
              {electionStatus === 'voting' ? '🟢 투표 중' :
               electionStatus === 'ended'  ? '🔴 마감'    :
                                              '⚪ 준비'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-900">
            {votedCount}/{totalStudentsCount}명 투표 완료
          </span>
        </div>
        <div className="px-3 py-3 space-y-2">
          {!candidatesReady && (
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
              ⚠️ 후보가 2명 이상 등록되어야 투표를 시작할 수 있어요.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {electionStatus === 'idle' && votedCount === 0 && (
              <button
                type="button"
                onClick={startVote}
                disabled={voteCtrlBusy || !candidatesReady}
                className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg"
              >
                🚀 투표 시작
              </button>
            )}
            {electionStatus === 'idle' && votedCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={showExistingResult}
                  disabled={voteCtrlBusy}
                  className="flex-1 min-w-[120px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg"
                >
                  📺 결과 보이기
                </button>
                <button
                  type="button"
                  onClick={startVote}
                  disabled={voteCtrlBusy || !candidatesReady}
                  className="flex-1 min-w-[120px] bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 text-emerald-700 text-sm font-bold py-2 rounded-lg border border-emerald-300"
                >
                  🚀 투표 다시 시작
                </button>
              </>
            )}
            {electionStatus === 'voting' && (
              <button
                type="button"
                onClick={endVoteAndShowResult}
                disabled={voteCtrlBusy}
                className="flex-1 min-w-[120px] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg"
              >
                🏁 결과 공개
              </button>
            )}
            {electionStatus === 'ended' && (
              <button
                type="button"
                onClick={reopenVote}
                disabled={voteCtrlBusy}
                className="flex-1 min-w-[120px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-lg"
              >
                ⏪ 투표 다시 열기
              </button>
            )}
            <button
              type="button"
              onClick={resetElectionVotes}
              disabled={voteCtrlBusy}
              title="모든 본 투표 기록 삭제 + 준비 상태로 되돌림"
              className="px-3 bg-white border-2 border-gray-300 hover:border-rose-300 text-rose-600 text-sm font-bold rounded-lg disabled:opacity-50"
            >
              ♻️
            </button>
          </div>
          <p className="text-[10px] text-amber-700 leading-relaxed">
            <b>투표 시작</b> → 학생 화면에 투표소 활성. <b>결과 공개</b> → 학생 화면에 등수·득표 자동 표시.
            투표하지 않은 학생은 결과 공개 후에도 결과만 볼 수 있어요.
          </p>
        </div>

        {/* 직책 배정 — 투표 기록이 있을 때만 */}
        {electionRanks.length > 0 && (
          <div className="border-t border-amber-200 px-3 py-3 space-y-2">
            <p className="text-[11px] font-bold text-amber-900">🏆 직책 배정 (변경 즉시 학생 화면 반영)</p>
            {electionRanks.map((r) => {
              const cand = candidatesMap[r.groupId]
              const currentLabel = getRoleLabel(r.rank)
              return (
                <div key={r.groupId} className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-amber-700 w-5 shrink-0">{r.rank}위</span>
                  <span className="flex-1 text-[11px] text-gray-700 truncate">
                    {cand?.leaderNickname || r.groupId}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0">{r.count}표</span>
                  <select
                    value={currentLabel}
                    onChange={(e) => changeRole(r.rank, e.target.value)}
                    className="text-[11px] border border-amber-300 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:border-amber-500 shrink-0"
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.emoji ? `${o.emoji} ${o.label}` : o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* ── 사전 여론조사 — 4단계(prepoll)에만 노출 ─────────── */}
      {showPollSection && (
      <div className="border border-indigo-200 rounded-xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-indigo-50 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-indigo-800">📊 사전 여론조사</p>
            {prePollEntry && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pollStatusMeta.cls}`}>
                {pollStatusMeta.label}
              </span>
            )}
            {prePollTotal > 0 && (
              <span className="text-[10px] text-indigo-500">총 {prePollTotal}표</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={applyPrepollFromCandidates}
              disabled={pollBusy || candidateCount < 2}
              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition disabled:opacity-40"
              title="등록된 후보를 선택지로 자동 채우기"
            >
              🗳️ 후보 채우기
            </button>
            {prePollEntry && (
              <>
                <button
                  type="button"
                  onClick={togglePollStatus}
                  disabled={pollBusy}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition disabled:opacity-50 ${
                    prePollEntry.status === 'voting'
                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {prePollEntry.status === 'voting' ? '마감' : '열기'}
                </button>
                <button
                  type="button"
                  onClick={editingPoll ? () => setEditingPoll(false) : openEditPoll}
                  disabled={pollBusy}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50"
                >
                  {editingPoll ? '취소' : '✏️ 편집'}
                </button>
                <button
                  type="button"
                  onClick={resetPollVotes}
                  disabled={pollBusy || prePollTotal === 0}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-40"
                  title="투표 초기화"
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-3">
          {!prePollEntry ? (
            <div className="py-2 space-y-2 text-center">
              <p className="text-xs text-gray-400">사전 여론조사가 없습니다.</p>
              <button
                type="button"
                onClick={applyPrepollFromCandidates}
                disabled={pollBusy || candidateCount < 2}
                className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40 transition"
              >
                {candidateCount < 2
                  ? '후보 2명 이상 등록 후 사용'
                  : `🗳️ 등록된 후보 ${candidateCount}명으로 여론조사 자동 생성`}
              </button>
            </div>
          ) : editingPoll && pollDraft ? (
            /* ── 편집 폼 ── */
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1 block">질문</label>
                <input
                  type="text"
                  value={pollDraft.question}
                  onChange={(e) => setPollDraft((d) => ({ ...d, question: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1 block">선택지</label>
                <div className="space-y-1.5">
                  {pollDraft.options.map((o, idx) => (
                    <div key={o.id} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={o.label}
                        onChange={(e) => updateDraftOption(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400"
                        placeholder={`선택지 ${idx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeDraftOption(idx)}
                        className="shrink-0 text-[10px] px-2 py-1.5 rounded-lg border border-rose-100 text-rose-400 hover:bg-rose-50"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDraftOption}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-dashed border-indigo-200 text-indigo-500 hover:bg-indigo-50 w-full"
                  >
                    + 선택지 추가
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={savePollDraft}
                disabled={pollBusy}
                className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {pollBusy ? '저장 중...' : '💾 저장'}
              </button>
            </div>
          ) : (
            /* ── 결과 보기 ── */
            <div className="space-y-2">
              {prePollEntry.question && (
                <p className="text-[11px] text-indigo-700 font-semibold">{prePollEntry.question}</p>
              )}
              {prePollRanks.length > 0 ? (
                <div className="space-y-1.5">
                  {prePollRanks.map((r) => {
                    const pct = prePollTotal ? Math.round((r.count / prePollTotal) * 100) : 0
                    return (
                      <div key={r.optionId} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-gray-800">
                            {medals[r.rank - 1] || `${r.rank}위`} {r.label}
                          </span>
                          <span className="text-gray-500 shrink-0">
                            {r.count}표 ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1">아직 투표한 학생이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 토론 세션 — 5·6단계(debatePrep·debateEval)에만 노출 */}
      {showDebateSection && (electionDebate ? (
        <div className="border-t border-violet-100 pt-3 space-y-2">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800">
            <p className="font-bold">✅ 토론 세션 진행 중</p>
            <p className="mt-0.5 text-violet-600">{electionDebate.title}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenDebateTool}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition"
            >
              🎙️ 토론 도구 열기
            </button>
            <button
              type="button"
              onClick={handleEndAndReset}
              className="px-3 py-2.5 rounded-xl bg-white border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition"
            >
              종료
            </button>
          </div>
        </div>
      ) : (
        /* 토론 세션 없을 때 — 설정 UI */
        <div className="border-t border-violet-100 pt-3 space-y-3">
          <p className="text-xs font-bold text-gray-600">⚙️ 토론 참여 설정</p>

          {/* 참여 범위 선택 */}
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">몇 위까지 토론에 참여하나요?</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTopN(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                  topN === 0
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                모두 ({candidateCount}팀)
              </button>
              {Array.from({ length: Math.max(0, candidateCount - 1) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTopN(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                    topN === n
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  {n === 1 ? '1위' : `1~${n}위`} ({n}팀)
                </button>
              ))}
            </div>
          </div>

          {/* 배치 미리보기 */}
          {participatingGids.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
              <div>
                <span className="font-bold text-violet-700">🎙️ 토론 팀 ({participatingGids.length})</span>
                <span className="ml-2 text-gray-600">
                  {participatingGids.map((gid) => groups?.[gid]?.name || gid).join(', ')}
                </span>
              </div>
              {evaluatorGids.length > 0 && (
                <div>
                  <span className="font-bold text-amber-700">📋 평가단 ({evaluatorGids.length}모둠)</span>
                  <span className="ml-2 text-gray-600">
                    {evaluatorGids.map((gid) => groups?.[gid]?.name || gid).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || participatingGids.length === 0}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition"
          >
            {busy ? '생성 중...' : '🎙️ 토론 세션 생성'}
          </button>
        </div>
      ))}
    </div>
  )
}

export default Phase2ElectionQuickPanel
