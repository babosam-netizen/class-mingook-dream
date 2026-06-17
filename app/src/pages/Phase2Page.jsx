import { useEffect, useMemo, useState } from 'react'
import RoomBar from '../components/shared/RoomBar'

import CandidateRegister from '../components/phase2/CandidateRegister'
import CandidateCard from '../components/phase2/CandidateCard'
import CandidateSupportStatements from '../components/phase2/CandidateSupportStatements'
import ElectionResultPanel from '../components/phase2/ElectionResultPanel'
import CandidateBallotList from '../components/phase2/CandidateBallotList'
import ElectionResultBoard from '../components/phase2/ElectionResultBoard'
import useGameStore from '../store/gameStore'
import { subscribe, removeAt, setAt } from '../lib/rtdb-helpers'
import ArticleSection from '../components/news/ArticleSection'
import ElectionJournalistWorkspace from '../components/phase2/ElectionJournalistWorkspace'
import { calculateRanks } from '../lib/election'
import { PHASE_META, CARD } from '../styles/tokens'
import SessionFinishButton from '../components/shared/SessionFinishButton'
import PollFeed from '../components/shared/PollFeed'
import DiscussionPrompt from '../components/shared/DiscussionPrompt'
import HighlightBox from '../components/shared/HighlightBox'
import PhaseActivitySummary from '../components/shared/PhaseActivitySummary'
import { useWorkflow } from '../lib/use-workflow'
import ResearchWorkspace from '../components/research/ResearchWorkspace'
import { JournalistNewspaperGallery } from '../components/phase2/JournalistNewspaper'

const STATUS_LABEL = {
  idle: '⏸️ 선거 준비 중',
  voting: '🗳️ 투표 진행 중',
  ended: '🏆 선거 종료',
}

function Phase2Page({ previewMode = false }) {
  const meta = PHASE_META[2]
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const roomData = useGameStore((s) => s.roomData)
  const config = useGameStore((s) => s.config)
  const electionStatus = useGameStore((s) => s.electionStatus)
  const setElectionStatus = useGameStore((s) => s.setElectionStatus)
  const wf = useWorkflow()
  const isStudent = role === 'student' || previewMode
  // 선거 잠금 모드(voting/ended) 시 highlight 시스템 우회 — 후보/투표소/결과/대기 보드 항상 노출
  // (highlight 시스템: anyHighlight=true && active=false → 섹션 null 반환하는 동작이 결과 발표를 가림)
  const stepHighlight = wf.currentStep?.highlight

  const [candidatesMap, setCandidatesMap] = useState({})
  const [votesMap, setVotesMap] = useState({})
  const [supportStatementsMap, setSupportStatementsMap] = useState({})
  const [pollsMap, setPollsMap] = useState({})
  const [electionJournalistsMap, setElectionJournalistsMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [candidateRatingsMap, setCandidateRatingsMap] = useState({})
  const [voteBusy, setVoteBusy] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // electionStatus를 Firebase에서 직접 구독 — gameStore 경유 없이 실시간 수신
  // (gameStore의 full-room 리스너 지연 or 누락 문제 방지)
  const [liveElectionStatus, setLiveElectionStatus] = useState(electionStatus || 'idle')
  useEffect(() => {
    if (!roomCode) return
    const unsub = subscribe(roomCode, 'electionStatus', (v) => setLiveElectionStatus(v || 'idle'))
    return () => unsub?.()
  }, [roomCode])

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'candidates', (d) => setCandidatesMap(d || {}))
    const u2 = subscribe(roomCode, 'electionVotes', (d) => setVotesMap(d || {}))
    const u3 = subscribe(roomCode, 'candidateSupportStatements', (d) => setSupportStatementsMap(d || {}))
    const u4 = subscribe(roomCode, 'polls', (d) => setPollsMap(d || {}))
    const u5 = subscribe(roomCode, 'electionJournalists', (d) => setElectionJournalistsMap(d || {}))
    const u6 = subscribe(roomCode, 'comments', (d) => setCommentsMap(d || {}))
    const u7 = subscribe(roomCode, 'candidateRatings', (d) => setCandidateRatingsMap(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.(); u7?.() }
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (previewMode) return Object.keys(groups || {})[0] || 'preview_group'
    return students?.[myStudentId]?.groupId || null
  }, [groups, myStudentId, previewMode, students])

  const myCandidate = myGroupId ? candidatesMap[myGroupId] : null
  const myVote = myStudentId ? votesMap[myStudentId]?.candidateGroupId : null
  const isJournalist = !!(isStudent && myGroupId && electionJournalistsMap[myGroupId])
  const roleLocked   = !!config?.roleSelectionLocked

  const unregisterJournalist = async () => {
    if (!confirm('선거 기자 활동을 취소하고 역할을 다시 선택하시겠습니까?')) return
    await removeAt(roomCode, `electionJournalists/${myGroupId}`)
  }

  // 9단계 워크플로 상태 기반 제어
  const stepId = wf.currentStep?.id
  // 교사가 본 투표 활성/결과 공개 상태 — liveElectionStatus(Firebase 직접 구독) 사용
  const isVoting = liveElectionStatus === 'voting'
  const isEnded  = liveElectionStatus === 'ended'
  // 선거 잠금 모드 — 반드시 vote 단계(7단계)에서만 활성화
  // electionStatus가 이전 단계에 잔류해도 1~6단계 컨텐츠를 덮지 않음
  const electionLockActive = (isVoting || isEnded) && stepId === 'vote'
  // 1단계: 자료수집 — 선거 잠금 시 숨김
  const showPrep = (stepId === 'prep' || stepId === 'register') && !electionLockActive
  // 2단계: 후보등록 — 선거 잠금 시 숨김
  const showRegister = stepId === 'register' && !electionLockActive

  // 7단계: 투표 버튼 — 교사가 'voting' 누른 경우 & 반드시 vote 단계에서만
  const showVote = isVoting && stepId === 'vote'
  // 2~6단계: 후보 카드 노출 / 7단계 투표 중에만 노출
  const showCandidates = showVote
    || (['register', 'agora', 'prepoll', 'debatePrep', 'debateEval'].includes(stepId) && !electionLockActive)
  // 4단계: 사전 여론조사 — 선거 잠금 시 숨김
  const showPoll = stepId === 'prepoll' && !electionLockActive
  // 5단계: 토론 준비 — 선거 잠금 시 숨김
  const showDebatePrep = stepId === 'debatePrep' && !electionLockActive
  // 6·8단계: 기사 작성
  const showArticle = ['debateEval', 'finalNews', 'nextJourney'].includes(stepId) && !electionLockActive
  // 결과 패널 — vote 단계에서 종료됐거나 8·9단계에 있을 때
  const showResult = !isVoting && (
    (isEnded && stepId === 'vote') ||
    stepId === 'finalNews' ||
    stepId === 'nextJourney'
  )
  // 투표소 입장 대기 — 7단계(vote)에 왔지만 교사가 '투표 시작'을 누르지 않은 상태
  const showEntryWaiting = (
    wf.currentPhase === 2 &&
    stepId === 'vote' &&
    !isVoting && !isEnded && !showResult
  )
  // 투표 마친 후 대기 화면 — voting 중이고 내가 투표 완료한 경우, 7단계(vote)에서만 노출
  const isWaitingForOthers = isVoting && Boolean(myVote) && stepId === 'vote'
  // 선거 잠금 시 highlight 효과 끔
  const anyHL = isStudent && !!stepHighlight && !electionLockActive

  const coreIssue = roomData?.coreIssue
  const coreIssueGroup = coreIssue ? groups?.[coreIssue] : null
  const coreIssueLabel = coreIssueGroup?.name || (typeof coreIssue === 'string' ? coreIssue : '최우선과제')

  const candidatesList = useMemo(() =>
    Object.values(candidatesMap)
      .sort((a, b) => (a.candidateNumber ?? a.leaderNumber ?? 999) - (b.candidateNumber ?? b.leaderNumber ?? 999)),
  [candidatesMap])
  const ranks = useMemo(() => calculateRanks(candidatesMap, votesMap), [candidatesMap, votesMap])
  const totalVotes = Object.keys(votesMap).length

  // 사전 여론조사(prepoll) 결과로 후보 순위 계산
  const prePollRanks = useMemo(() => {
    const entries = Object.entries(pollsMap)
      .filter(([, p]) => Number(p?.phaseStep?.phase) === 2 && p?.phaseStep?.stepId === 'prepoll')
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    if (!entries.length) return []
    const poll = entries[0][1]
    const counts = {}
    for (const v of Object.values(poll.votes || {})) {
      if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
    }
    const options = (poll.options || []).map((o, i) =>
      typeof o === 'string'
        ? { id: `opt_${i}`, label: o }
        : { id: o?.id || `opt_${i}`, label: o?.label || '', groupId: o?.groupId || null },
    )
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
  }, [pollsMap, candidatesMap, groups])
  const prePollTotal = prePollRanks.reduce((s, r) => s + r.count, 0)

  // 사전 여론조사 단일 항목 (상태 기반 화면 분기용)
  const prePoll = useMemo(() => {
    const entries = Object.entries(pollsMap)
      .filter(([, p]) => Number(p?.phaseStep?.phase) === 2 && p?.phaseStep?.stepId === 'prepoll')
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    return entries.length ? { id: entries[0][0], ...entries[0][1] } : null
  }, [pollsMap])
  
  const supportByGroup = useMemo(() => {
    const m = {}
    Object.entries(supportStatementsMap).forEach(([id, s]) => {
      const statement = { id, ...s }
      if (!m[statement.candidateGroupId]) m[statement.candidateGroupId] = []
      m[statement.candidateGroupId].push(statement)
    })
    return m
  }, [supportStatementsMap])

  const tallyByGroup = useMemo(() => {
    const m = {}
    ranks.forEach((r) => { m[r.groupId] = r })
    return m
  }, [ranks])

  // 컴팩트 카드 [투표하기] → 확인 모달 없이 즉시 기록
  // (자세히 보기 모달이 별도로 있어서 사전 검토는 거기서 완료)
  const onVote = async (candidate) => {
    if (!showVote || !candidate?.groupId || !myStudentId || voteBusy) return
    setVoteBusy(true)
    try {
      await setAt(roomCode, `electionVotes/${myStudentId}`, {
        candidateGroupId: candidate.groupId,
        weighted: false,
        at: Date.now(),
      })
    } catch (err) {
      alert('투표 기록 실패: ' + err.message)
    } finally {
      setVoteBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <RoomBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-rose-600 flex items-center gap-2">
                <span className="p-1.5 bg-rose-100 rounded-xl text-lg">🗳️</span>
                두 번째 여정: 선거 본부
              </h1>
              <p className="text-xs text-gray-500 mt-1">9단계 워크플로에 따라 선거를 진행합니다.</p>
            </div>
          </div>
          
          <DiscussionPrompt
            tone="rose"
            question={`${coreIssueLabel}을(를) 가장 잘 해결할 후보는 누구인가?`}
            subline="보통, 평등, 직접, 비밀선거의 원칙에 따라 신중하게 참여해 주세요."
          />
        </header>

        {/* ─── 1단계: 자료 수집 및 캠프 구성 ─── */}
        {showPrep && (
          <HighlightBox active={wf.isHighlight('linkBoard')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-emerald-800">📚 ① 공약 개발 자료실</h2>
              <p className="text-xs text-gray-500">먼저 우리 캠프가 찾아야 할 자료 목록을 정하고, 기사 자료를 목록별로 모아 공약을 준비하세요.</p>
              <ResearchWorkspace
                contextKey="phase2_election"
                groupId={myGroupId}
                title="공약 전략 자료실"
                description="최우선과제를 해결할 공약을 만들기 위해 필요한 자료 목록을 정하고, 관련 기사 자료를 수집하세요."
                defaultTargets={['국민들의 불편사항', '설문조사 결과', '국민들이 바라는 점', '인기 있는 제안']}
                accent="rose"
              />
            </section>
          </HighlightBox>
        )}

        {/* ─── 2단계: 후보자 등록 또는 선거 기자단 등록 ─── */}
        {showRegister && isStudent && myGroupId && (
          <HighlightBox active={wf.isHighlight('register')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="bg-white rounded-2xl shadow-sm border-2 border-rose-200 p-6 space-y-4">
              <h2 className="text-xl font-bold text-rose-800">② 후보자 등록 또는 선거 기자단 등록</h2>

              {/* 기자단 등록 완료 */}
              {isJournalist && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-3">
                  <div>
                    <p className="font-bold text-blue-900">📰 선거 기자단으로 활동 중</p>
                    <p className="text-sm text-blue-700 mt-0.5">
                      후보를 내지 않은 모둠은 선거 기자단이 되어 후보들의 공약과 토론을 취재합니다.
                    </p>
                  </div>
                  <ul className="grid sm:grid-cols-3 gap-2 text-xs text-blue-800">
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">후보 공약을 비교하고 핵심 쟁점을 찾습니다.</li>
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">토론에서 나온 주장과 근거를 기사로 정리합니다.</li>
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">유권자가 판단할 수 있도록 사실과 의견을 구분합니다.</li>
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">여러 선거 캠프에서 일어나는 일들을 육하원칙에 맞게 생생하게 전달합니다.(이때 이름가리기 사용)</li>
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">주제와 관련된 사항을 쉽고, 빠르고 정확하게 알려줍니다.</li>
                    <li className="rounded-lg bg-white/80 border border-blue-100 px-3 py-2">기자의 직업 윤리를 생각하며 여러 사람에게 두루 도움이 되는 기사를 작성합니다.</li>
                  </ul>
                  <div className="flex justify-end">
                    {roleLocked ? (
                      <span className="shrink-0 text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg font-semibold">🔒 잠금</span>
                    ) : (
                      <button
                        onClick={unregisterJournalist}
                        className="shrink-0 text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
                      >
                        후보 등록으로 변경
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 후보 캠프 작성 중/제출 완료 */}
              {!isJournalist && myCandidate && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <p className="font-bold text-rose-900">
                    {myCandidate.status === 'submitted' ? '✅ 선관위 제출 완료' : '📝 후보 캠프 작성 중'}
                  </p>
                  <p className="text-sm text-rose-700 mt-1">
                    {myCandidate.leaderNumber}번 {myCandidate.leaderNickname} 후보를 중심으로 공약과 홍보자료를 준비합니다.
                  </p>
                  {!roleLocked && (
                    <>
                      <button onClick={() => setIsEditing((v) => !v)} className="mt-3 text-xs px-3 py-1.5 bg-rose-600 text-white rounded-lg">
                        {isEditing ? '작성창 닫기' : '계속 작성/수정하기'}
                      </button>
                      {isEditing && (
                        <div className="mt-4 pt-4 border-t border-rose-200">
                          <CandidateRegister groupId={myGroupId} coreIssueLabel={coreIssueLabel} initialData={myCandidate} onSuccess={() => setIsEditing(false)} />
                        </div>
                      )}
                    </>
                  )}
                  {roleLocked && (
                    <span className="mt-3 inline-block text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg font-semibold">🔒 잠금</span>
                  )}
                </div>
              )}

              {/* 후보자 등록: 후보를 고르면 캠프, 없음이면 기자단 */}
              {!isJournalist && !myCandidate && !roleLocked && (
                <CandidateRegister groupId={myGroupId} coreIssueLabel={coreIssueLabel} />
              )}

              {/* 미선택 + 잠금 */}
              {!isJournalist && !myCandidate && roleLocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-semibold text-center">
                  🔒 선생님이 역할 선택을 잠갔습니다. 선생님께 문의하세요.
                </div>
              )}

              {/* 지지 선언문 (후보 등록 모둠 또는 후보 미결정 상태에서만) */}
              {!isJournalist && (
                <div className="mt-6 pt-6 border-t border-rose-100">
                  <h3 className="font-bold text-rose-800 mb-3">🤝 지지 선언문 작성</h3>
                  <CandidateSupportStatements
                    groupId={myGroupId}
                    allCandidates={candidatesList}
                    allSupportByGroup={supportByGroup}
                    editable={true}
                  />
                </div>
              )}
            </section>
          </HighlightBox>
        )}

        {/* ─── 선거 기자 활동 워크스페이스 (기자단 모둠 전용, 단계 내내 표시) ─── */}
        {isJournalist && (
          <HighlightBox active={wf.isHighlight('register') || wf.isHighlight('article')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="bg-white rounded-2xl shadow-sm border-2 border-blue-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-blue-800">📰 선거 기자 활동</h2>
                {showRegister && !roleLocked && (
                  <button
                    onClick={unregisterJournalist}
                    className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    역할 변경
                  </button>
                )}
                {showRegister && roleLocked && (
                  <span className="text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg font-semibold">🔒 잠금</span>
                )}
              </div>
              <ElectionJournalistWorkspace
                groupId={myGroupId}
                candidatesList={candidatesList}
                supportByGroup={supportByGroup}
                groups={groups}
                myVote={myVote}
                showJournalistSupport={!!config?.showJournalistSupport}
              />
            </section>
          </HighlightBox>
        )}

        {/* ─── 3단계: 후보 비교 및 아고라 찬반 의견 (투표 버튼 없음) ─── */}
        {/* 투표 완료 후 대기 중에는 후보 카드 숨김 (대기 화면만 노출) */}
        {showCandidates && !showDebatePrep && !isWaitingForOthers && !showResult && (
          <HighlightBox active={wf.isHighlight('candidates')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-rose-800">
                {showVote
                  ? '🏛️ ⑦ 중앙 선거 관리 위원회 (투표소)'
                  : '🔍 ③ 후보자 비교 및 아고라 찬반 의견'}
              </h2>
              {showVote && !myVote && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-sm font-bold text-rose-800">🗳️ 투표가 시작되었어요!</p>
                  <p className="text-xs text-rose-700">
                    각 후보의 <b>공약·포스터·카드뉴스</b>를 꼼꼼히 확인하고, 마음에 드는 후보의 <b>[투표하기]</b> 버튼을 눌러주세요.
                    한 번 투표하면 바꿀 수 없으니 신중하게 선택하세요.
                  </p>
                </div>
              )}
              {!showVote && (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg font-bold">
                  ⚠️ 이 단계에서는 투표하지 않습니다. 후보를 충분히 비교하고 의견을 나누세요.
                </p>
              )}
              {!showVote && (
                <JournalistNewspaperGallery groups={groups} currentGroupId={myGroupId} />
              )}

              {showVote ? (
                /* 7단계 본 투표 — 컴팩트 후보 카드 (기호·이름 + 자세히 보기 + 투표) */
                <CandidateBallotList
                  candidates={candidatesList}
                  groups={groups}
                  myVote={myVote}
                  onVote={(c) => onVote(c)}
                  supportByGroup={supportByGroup}
                  votingActive={true}
                />
              ) : (
                /* 2~6단계 후보 비교 — 전체 자료 노출 (투표 버튼 없음) */
                <div className="grid sm:grid-cols-2 gap-4">
                  {candidatesList.map((c) => (
                    <CandidateCard
                      key={c.groupId}
                      candidate={c}
                      group={groups[c.groupId]}
                      previewMode={true}
                      myVote={myVote}
                      supportStatements={supportByGroup[c.groupId] || []}
                    />
                  ))}
                </div>
              )}
            </section>
          </HighlightBox>
        )}

        {/* ─── 4단계: 사전 선거 여론조사 ─── */}
        {showPoll && (
          <HighlightBox active={wf.isHighlight('poll')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-indigo-800">📊 ④ 선거 사전 여론조사</h2>
              {(!prePoll || prePoll.status === 'ready') ? (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl py-14 flex flex-col items-center gap-3">
                  <span className="text-5xl">📊</span>
                  <p className="text-base font-bold text-indigo-700">여론조사 준비 중</p>
                  <p className="text-xs text-indigo-400">선생님이 여론조사를 시작하면 참여할 수 있어요.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">지금 지지하는 후보와 그 이유를 솔직하게 응답하세요. (아직 투표가 아닙니다)</p>
                  <PollFeed plannedOnly={true} statusFilter={['voting', 'ended', 'published']} />
                </>
              )}
            </section>
          </HighlightBox>
        )}

        {/* ─── 5단계: 토론 준비 ─── */}
        {showDebatePrep && (
          <HighlightBox active={wf.isHighlight('candidates')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-violet-800">🎯 ⑤ 선거 토론 준비</h2>

              {/* 학생용 안내 */}
              <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 space-y-2">
                <p className="text-sm font-bold text-violet-800">📋 토론 전에 이것을 준비하세요</p>
                <ul className="space-y-1.5 pl-1 text-xs text-violet-700">
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold">①</span><span>아래 <b>온라인 토의 브리핑</b>에서 각 후보에 대한 찬반 의견과 좋아요 많은 댓글을 읽고 핵심 쟁점을 파악하세요.</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold">②</span><span>화면 오른쪽 하단 <b>💬 토론 도구</b> 버튼을 눌러 <b>토론 준비 카드</b>를 작성하세요. (주장·근거·반론 대비)</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold">③</span><span>후보 캠프라면 자신의 공약을 발표하고 상대 공약을 질의·반론할 내용을 준비하세요.</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold">④</span><span>선거 기자단이라면 핵심 쟁점을 정리하고 날카로운 질문을 2~3개 준비하세요.</span></li>
                </ul>
              </div>

              {/* 온라인 토의 브리핑 — 후보별 */}
              <ElectionDebateBriefing
                candidatesMap={candidatesMap}
                commentsMap={commentsMap}
                groups={groups}
                myStudentId={myStudentId}
                prePollRanks={prePollRanks}
                prePollTotal={prePollTotal}
                candidateRatingsMap={candidateRatingsMap}
              />
            </section>
          </HighlightBox>
        )}

        {/* ─── 6단계: 토론 결과 평가 및 기사 작성 (비기자 모둠) ─── */}
        {showArticle && stepId === 'debateEval' && !isJournalist && (
          <HighlightBox active={wf.isHighlight('article')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-blue-800">📰 ⑥ 토론 결과 평가 및 기사 작성</h2>
              <p className="text-xs text-gray-500">토론을 지켜본 소감·평가를 기사로 정리하세요.</p>
              <ArticleSection />
            </section>
          </HighlightBox>
        )}

        {/* ─── 🚪 투표소 입장 대기 — 교사가 '투표 시작' 누르기 전 ─── */}
        {showEntryWaiting && (
          <HighlightBox active={false} anyHighlight={false} previewMode={previewMode}>
            <ElectionResultBoard entryWaiting={true} />
          </HighlightBox>
        )}

        {/* ─── ⏳ 투표 완료 후 대기 — 안내 문구만 노출 (통계·중간결과 모두 제거) ─── */}
        {isWaitingForOthers && !showResult && (
          <HighlightBox active={false} anyHighlight={false} previewMode={previewMode}>
            <ElectionResultBoard waiting={true} />
          </HighlightBox>
        )}

        {/* ─── 7단계: 결과 확인 (투표 후) — 전광판 스타일 ─── */}
        {/* anyHighlight=false: 결과 공개 시 워크플로 highlight와 무관하게 항상 노출 */}
        {showResult && (
          <HighlightBox active={wf.isHighlight('result')} anyHighlight={false} previewMode={previewMode}>
            <section className="space-y-4">
              <ElectionResultBoard ranks={ranks} totalVotes={totalVotes} />
              {stepId === 'nextJourney' && (
                <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 text-amber-900 shadow-sm">
                  <h3 className="font-black text-xl mb-3">🚀 ⑨ 세 번째 여정: 국정 포털 안내</h3>
                  <ul className="space-y-2 text-sm leading-relaxed">
                    <li>• <strong>입법부</strong>: 당선된 대통령의 공약을 바탕으로 법안을 발의하고 의결합니다.</li>
                    <li>• <strong>행정부</strong>: 확정된 법안을 시행하기 위한 구체적인 예산을 편성하고 정책을 집행합니다.</li>
                    <li>• <strong>사법부</strong>: 법과 원칙에 따라 갈등을 조정하고 판결을 내립니다.</li>
                  </ul>
                </div>
              )}
            </section>
          </HighlightBox>
        )}

        {/* ─── 8단계: 선거 결과 기사 작성 (비기자 모둠) ─── */}
        {showArticle && stepId === 'finalNews' && !isJournalist && (
          <HighlightBox active={wf.isHighlight('article')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-blue-800">📰 ⑧ 선거 결과 기사 작성</h2>
              <p className="text-xs text-gray-500">최종 당선 결과를 여론판 기사로 정리하세요.</p>
              <ArticleSection />
            </section>
          </HighlightBox>
        )}

        {/* nextJourney 단계 기사 (비기자 모둠) */}
        {showArticle && stepId === 'nextJourney' && !isJournalist && (
          <HighlightBox active={false} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-blue-800">📰 여론판 기사</h2>
              <ArticleSection />
            </section>
          </HighlightBox>
        )}

        {wf.showSummary && <PhaseActivitySummary phase={2} />}
      </main>

      {/* 투표 확인 모달 제거 — 컴팩트 카드 [투표하기] 즉시 기록 (v1.2.263) */}
      <SessionFinishButton />
    </div>
  )
}

/**
 * 토론 준비용 온라인 토의 브리핑 — 후보별 찬반 의견 + 좋아요 순 정렬
 */
const BRIEFING_CRITERIA = [
  { key: 'relevance',   label: '최우선과제관련성', emoji: '🎯', color: 'text-violet-700 bg-violet-50' },
  { key: 'feasibility', label: '실현가능성',       emoji: '🔧', color: 'text-blue-700 bg-blue-50'     },
  { key: 'validity',    label: '타당성',           emoji: '⚖️', color: 'text-amber-700 bg-amber-50'   },
]

function avgScore(ratingsObj, key) {
  const vals = Object.values(ratingsObj || {}).map((r) => r?.[key]).filter((v) => v > 0)
  if (!vals.length) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function ElectionDebateBriefing({ candidatesMap, commentsMap, groups, myStudentId, prePollRanks = [], prePollTotal = 0, candidateRatingsMap = {} }) {
  const candidateList = Object.values(candidatesMap)
    .sort((a, b) => (a.candidateNumber ?? 999) - (b.candidateNumber ?? 999))

  if (candidateList.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed">
        등록된 후보가 없습니다.
      </p>
    )
  }

  const allComments = Object.entries(commentsMap).map(([id, c]) => ({ id, ...c }))

  const likeCount = (c) => Object.keys(c.likes || {}).length

  const getTopComments = (groupId, stance, limit = 3) =>
    allComments
      .filter((c) => c.targetType === 'candidate' && c.targetId === groupId && c.stance === stance)
      .sort((a, b) => {
        const diff = likeCount(b) - likeCount(a)
        return diff !== 0 ? diff : (b.createdAt || 0) - (a.createdAt || 0)
      })
      .slice(0, limit)

  // groupId → 사전여론조사 순위 매핑
  const pollRankByGroup = {}
  prePollRanks.forEach((r) => {
    if (r.candidateGroupId) pollRankByGroup[r.candidateGroupId] = r
  })

  const rankColors = ['text-amber-600', 'text-gray-500', 'text-orange-400']
  const rankLabels = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-violet-700">📣 온라인 토의 브리핑 — 후보별 찬반 의견 (❤️ 좋아요 순)</p>
        <span className="text-[10px] text-gray-400">아래 내용을 참고해 토론 준비 카드를 작성하세요</span>
      </div>

      {/* 사전 여론조사 결과 */}
      {prePollRanks.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 space-y-2">
          <p className="text-xs font-bold text-indigo-800">
            📊 사전 여론조사 결과
            <span className="ml-1.5 text-[10px] font-normal text-indigo-500">총 {prePollTotal}표</span>
          </p>
          <ul className="space-y-1.5">
            {prePollRanks.map((r, idx) => {
              const pct = prePollTotal > 0 ? Math.round((r.count / prePollTotal) * 100) : 0
              return (
                <li key={r.optionId} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-800">
                      {rankLabels[idx] ?? `${idx + 1}위`} {r.label}
                    </span>
                    <span className={`font-black ${rankColors[idx] ?? 'text-gray-500'}`}>
                      {r.count}표 ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {candidateList.map((candidate) => {
          const gid = candidate.groupId
          const group = groups?.[gid]
          const pros = getTopComments(gid, 'pro')
          const cons = getTopComments(gid, 'con')
          const questions = getTopComments(gid, 'question', 2)
          const totalPro = allComments.filter((c) => c.targetType === 'candidate' && c.targetId === gid && c.stance === 'pro').length
          const totalCon = allComments.filter((c) => c.targetType === 'candidate' && c.targetId === gid && c.stance === 'con').length
          const totalQ   = allComments.filter((c) => c.targetType === 'candidate' && c.targetId === gid && c.stance === 'question').length
          const pollRank = pollRankByGroup[gid]
          const gidRatings = candidateRatingsMap[gid] || {}
          const ratingCount = Object.keys(gidRatings).length
          const scores = BRIEFING_CRITERIA.map((c) => ({ ...c, avg: avgScore(gidRatings, c.key) }))
          const totalAvg = scores.every((s) => s.avg !== null)
            ? scores.reduce((sum, s) => sum + (s.avg || 0), 0) / scores.length
            : null

          return (
            <div key={gid} className="bg-white rounded-2xl border border-violet-200 overflow-hidden shadow-sm">
              {/* 후보 헤더 */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-violet-200 font-semibold">{group?.name} 모둠</p>
                  {pollRank && (
                    <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
                      {rankLabels[pollRank.rank - 1] ?? `${pollRank.rank}위`} 사전여론 {pollRank.count}표
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-white truncate">
                  {candidate.leaderNumber}번 {candidate.leaderNickname} 후보
                </p>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] text-violet-200">👍 찬성 {totalPro}</span>
                  <span className="text-[10px] text-violet-200">👎 반대 {totalCon}</span>
                  <span className="text-[10px] text-violet-200">❓ 질문 {totalQ}</span>
                </div>
              </div>

              {/* 공약 평가 점수 */}
              {ratingCount > 0 && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-amber-800">📊 공약 평가 ({ratingCount}명)</p>
                    {totalAvg !== null && (
                      <span className="text-[11px] font-black text-amber-700">
                        종합 {totalAvg.toFixed(1)} / 5.0
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {scores.map((s) => (
                      <div key={s.key} className={`rounded-lg px-2 py-1 text-center ${s.color}`}>
                        <p className="text-[9px] font-semibold leading-tight">{s.emoji} {s.label}</p>
                        <p className="text-[13px] font-black mt-0.5">
                          {s.avg !== null ? s.avg.toFixed(1) : '—'}
                        </p>
                        {s.avg !== null && (
                          <div className="h-1 rounded-full bg-white/60 overflow-hidden mt-0.5">
                            <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${(s.avg / 5) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 space-y-3">
                {/* 찬성 의견 */}
                {pros.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold text-emerald-700 mb-1">👍 찬성 (좋아요 상위)</p>
                    <ul className="space-y-1">
                      {pros.map((c) => (
                        <BriefingComment key={c.id} comment={c} myStudentId={myStudentId} />
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-300 italic">찬성 의견 없음</p>
                )}

                {/* 반대 의견 */}
                {cons.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold text-rose-700 mb-1">👎 반대 (좋아요 상위)</p>
                    <ul className="space-y-1">
                      {cons.map((c) => (
                        <BriefingComment key={c.id} comment={c} myStudentId={myStudentId} />
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-300 italic">반대 의견 없음</p>
                )}

                {/* 주요 질문 */}
                {questions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-violet-700 mb-1">❓ 주요 질문</p>
                    <ul className="space-y-1">
                      {questions.map((c) => (
                        <BriefingComment key={c.id} comment={c} myStudentId={myStudentId} />
                      ))}
                    </ul>
                  </div>
                )}

                {pros.length === 0 && cons.length === 0 && questions.length === 0 && (
                  <p className="text-[10px] text-gray-400 text-center py-2">아직 온라인 토의 의견이 없습니다.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BriefingComment({ comment: c, myStudentId }) {
  const likes = c.likes || {}
  const lc = Object.keys(likes).length
  const iLiked = myStudentId ? !!likes[myStudentId] : false
  return (
    <li className="flex items-start gap-1.5 text-[11px] bg-gray-50 rounded-lg px-2 py-1.5">
      <p className="flex-1 text-gray-700 leading-snug">{c.body}</p>
      <div className="shrink-0 flex items-center gap-1">
        {lc > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${iLiked ? 'text-rose-600 bg-rose-50' : 'text-gray-400'}`}>
            ❤️ {lc}
          </span>
        )}
        <span className="text-[10px] text-gray-400">{c.authorNumber}번</span>
      </div>
    </li>
  )
}

export default Phase2Page
