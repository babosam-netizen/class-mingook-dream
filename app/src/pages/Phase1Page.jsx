import { useEffect, useMemo, useState } from 'react'
import RoomBar from '../components/shared/RoomBar'

import GroupJoinPanel from '../components/phase1/GroupJoinPanel'
import PosterUpload from '../components/phase1/PosterUpload'
import PosterCard from '../components/phase1/PosterCard'
import CoreIssuePoll from '../components/phase1/CoreIssuePoll'
import TrustGauge from '../components/shared/TrustGauge'
import LinkSubmit from '../components/links/LinkSubmit'
import SessionFinishButton from '../components/shared/SessionFinishButton'
import PollFeed from '../components/shared/PollFeed'
import DiscussionPrompt from '../components/shared/DiscussionPrompt'
import StudentWorkflowProgress from '../components/shared/StudentWorkflowProgress'
import PhaseActivitySummary from '../components/shared/PhaseActivitySummary'
import HighlightBox from '../components/shared/HighlightBox'
import GroupShowcase from '../components/phase1/GroupShowcase'
import ArticleSection from '../components/news/ArticleSection'
import { useWorkflow } from '../lib/use-workflow'
import useGameStore from '../store/gameStore'
import { subscribe, setAt } from '../lib/rtdb-helpers'
import { PHASE_META, CARD } from '../styles/tokens'

import MyGroupActivityPreview from '../components/phase1/MyGroupActivityPreview'
import EssayEditor from '../components/phase1/EssayEditor'
import PetitionBoard from '../components/petition/PetitionBoard'

function Phase1PollReasonCard({
  myPollStats,
  voteReason,
  setVoteReason,
  dbReason,
  savingReason,
  onSave,
}) {
  if (!myPollStats) return null

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl border-2 border-indigo-200 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-black text-indigo-500 uppercase tracking-wide">
            기사 쓰기 전 생각 정리
          </p>
          <h3 className="text-lg font-black text-indigo-950">
            나의 여론조사 선택과 이유를 먼저 정리해요
          </h3>
          <p className="text-sm text-indigo-800 leading-relaxed">
            사후 여론조사에서 내가 선택한 내용과 그 까닭을 적은 뒤, 이 생각을 바탕으로 시민단체 활동 기사를 작성해 보세요.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs shrink-0 lg:w-64">
          <div className="rounded-2xl bg-white/80 border border-indigo-100 p-3">
            <p className="text-[10px] font-bold text-gray-400">사전 선택</p>
            <p className="mt-1 font-black text-gray-700 truncate">{myPollStats.myPre || '아직 없음'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-indigo-100 p-3">
            <p className="text-[10px] font-bold text-indigo-400">사후 선택</p>
            <p className="mt-1 font-black text-indigo-800 truncate">{myPollStats.myPost || '아직 없음'}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-black text-indigo-950">
            선택한 이유
          </label>
          <button
            type="button"
            onClick={onSave}
            disabled={savingReason}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
              savingReason
                ? 'bg-gray-200 text-gray-400'
                : (dbReason && voteReason === dbReason)
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-95'
            }`}
          >
            {savingReason ? '저장 중...' : (dbReason && voteReason === dbReason ? '저장됨' : (dbReason ? '수정 저장' : '저장하기'))}
          </button>
        </div>
        <textarea
          value={voteReason}
          onChange={(e) => setVoteReason(e.target.value)}
          placeholder="왜 이 선택을 했나요? 캠페인 활동, 친구들의 의견, 포스터 평가, 토론 내용을 떠올리며 2~3문장으로 적어 보세요."
          className="w-full min-h-28 px-4 py-3 bg-white/90 border-2 border-indigo-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 resize-y"
        />
      </div>
    </div>
  )
}

function Phase1ArticleReferenceStats({
  config,
  groups,
  groupTrust,
  maxTrustScore,
  myPollStats,
}) {
  const hasTopics = Object.keys(config?.topics || {}).length > 0
  if (!hasTopics && !myPollStats) return null

  return (
    <div className="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            작성 참고 자료
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900">
            자료를 먼저 보고 기사로 정리해요
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
          기사 작성 전 확인
        </span>
      </div>

      {hasTopics && (
        <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200">
          <h4 className="text-xs font-bold text-amber-900 mb-3 flex items-center gap-1">
            📊 실시간 사회적 신뢰도
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(config.topics).map(([tid, t]) => {
              const g = groups[tid] || {}
              const trust = groupTrust[tid] || { total: 0, n: 0 }
              return (
                <TrustGauge
                  key={tid}
                  score={trust.total}
                  max={maxTrustScore}
                  label={`${t.emoji} ${g.name || t.name}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {myPollStats && (
        <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-indigo-900 uppercase">📈 {myPollStats.topic} 지지율</h4>
                <div className={`text-xs font-black ${myPollStats.post >= myPollStats.pre ? 'text-rose-600' : 'text-blue-600'}`}>
                  {myPollStats.post >= myPollStats.pre ? '▲' : '▼'}{Math.abs(myPollStats.post - myPollStats.pre).toFixed(1)}%
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-8">사전</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-300 transition-all duration-1000" style={{ width: `${myPollStats.pre}%` }} />
                  </div>
                  <span className="text-xs font-bold text-indigo-400 w-10 text-right">{myPollStats.pre.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-600 font-bold w-8">사후</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${myPollStats.post}%` }} />
                  </div>
                  <span className="text-xs font-black text-indigo-700 w-10 text-right">{myPollStats.post.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-indigo-100 pt-3 md:pt-0 md:pl-4 space-y-2">
              <h4 className="text-xs font-black text-indigo-900 uppercase">👤 나의 선택</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/80 border border-indigo-100 p-2">
                  <p className="text-[10px] text-gray-400">사전</p>
                  <p className="text-xs font-medium truncate text-gray-600">{myPollStats.myPre || '—'}</p>
                </div>
                <div className="rounded-xl bg-white/80 border border-indigo-100 p-2">
                  <p className="text-[10px] text-indigo-400">사후</p>
                  <p className="text-xs font-black truncate text-indigo-700">{myPollStats.myPost || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Phase1Page({ previewMode = false }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const config = useGameStore((s) => s.config)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const wf = useWorkflow()
  const isStudent = role === 'student' || previewMode
  const anyHL = isStudent && !!wf.currentStep?.highlight

  const roomData = useGameStore((s) => s.roomData)
  const coreIssue = roomData?.coreIssue
  const coreIssueGroup = coreIssue ? (groups?.[coreIssue] || { name: coreIssue }) : null

  const [postersMap, setPostersMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [linksMap, setLinksMap] = useState({})
  const [essaysMap, setEssaysMap] = useState({})
  const [articlesMap, setArticlesMap] = useState({})
  
  // [Antigravity] 수정 모드 상태 추가 (포스터는 PosterUpload에서 자체적으로 처리)
  const [editingEssayId, setEditingEssayId] = useState(null)
  const [editingLinkId, setEditingLinkId] = useState(null)

  // 활동 탭 — 'petition'(국민청원, 사전 단계) | 'civic'(시민단체 활동)
  const petitionEnabled = config?.petitionEnabled !== false
  const petitionOpen = config?.petitionConfig?.isOpen !== false
  const [activeTab, setActiveTab] = useState(petitionEnabled ? 'petition' : 'civic')

  // 청원 시스템이 비활성화되면 탭을 자동으로 civic 으로
  useEffect(() => {
    if (!petitionEnabled && activeTab === 'petition') setActiveTab('civic')
  }, [petitionEnabled, activeTab])

  // 교사 워크플로의 하이라이트 키에 따라 학생 탭 자동 전환
  // petition → 청원 탭 / 그 외(groups·media·gallery·article·poll) → 시민단체 탭
  useEffect(() => {
    if (!isStudent) return
    const hl = wf.currentStep?.highlight
    if (!hl) return
    // [Antigravity] hl이 'opening'이거나 'petition'인 경우 'petition' 탭 고정 (civic 유출 방지)
    if (hl === 'petition' || hl === 'opening') setActiveTab('petition')
    else setActiveTab('civic')
  }, [wf.currentStep?.highlight, isStudent])

  // 포스터·댓글·링크·주장하는글·기사·여론조사 실시간 구독
  const [pollsMap, setPollsMap] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'posters', (d) => setPostersMap(d || {}))
    const u2 = subscribe(roomCode, 'comments', (d) => setCommentsMap(d || {}))
    const u3 = subscribe(roomCode, 'links', (d) => setLinksMap(d || {}))
    const u4 = subscribe(roomCode, 'essays', (d) => setEssaysMap(d || {}))
    const u5 = subscribe(roomCode, 'articles', (d) => setArticlesMap(d || {}))
    const u6 = subscribe(roomCode, 'polls', (d) => setPollsMap(d || {}))
    return () => {
      u1?.()
      u2?.()
      u3?.()
      u4?.()
      u5?.()
      u6?.()
    }
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (previewMode) {
      const gids = Object.keys(groups || {})
      return gids.length > 0 ? gids[0] : 'preview_group'
    }
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    const me = students[myStudentId]
    // [Antigravity] 세션 만료/강퇴 시 렌더링 에러(백화현상) 방지
    if (!me) return null
    return me.groupId || null
  }, [groups, students, myStudentId])

  // 우리 모둠의 사전/사후 여론조사 결과 계산 [Antigravity]
  const [voteReason, setVoteReason] = useState('')
  const [dbReason, setDbReason] = useState('') // [Antigravity] DB에 실제 저장된 값
  const [savingReason, setSavingReason] = useState(false)

  // 사유 실시간 구독
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    return subscribe(roomCode, `polls/reasons/phase1_poll1/${myStudentId}`, (d) => {
      const val = d || ''
      setVoteReason(val)
      setDbReason(val)
    })
  }, [roomCode, myStudentId])

  const saveVoteReason = async () => {
    if (!roomCode || !myStudentId) return
    setSavingReason(true)
    try {
      await setAt(roomCode, `polls/reasons/phase1_poll1/${myStudentId}`, voteReason)
      setDbReason(voteReason) // 로컬 상태 즉시 갱신
    } finally {
      setSavingReason(false)
    }
  }

  const myPollStats = useMemo(() => {
    if (!myGroupId || !groups[myGroupId]) return null
    const myTopic = groups[myGroupId].topic // '환경', '노동' 등
    
    // [Antigravity] PollFeed에서 사용하는 'opt_0' 형식을 인덱스로 변환
    const getIndex = (oid) => {
      if (oid === undefined || oid === null) return -1
      const s = String(oid)
      if (s.startsWith('opt_')) return parseInt(s.replace('opt_', ''), 10)
      return parseInt(s, 10)
    }

    const getPollData = (id) => {
      const p = pollsMap[id]
      if (!p || !p.votes || !p.options) return 0
      const optIdx = p.options.findIndex(opt => {
        const label = typeof opt === 'string' ? opt : opt.label
        return label.includes(myTopic)
      })
      if (optIdx === -1) return 0
      const votes = Object.values(p.votes).filter(v => getIndex(v.optionId) === optIdx).length
      const total = Object.keys(p.votes).length 
      return total > 0 ? (votes / total) * 100 : 0
    }

    const getMyChoice = (id) => {
      const p = pollsMap[id]
      if (!p || !p.votes || !p.options || !myStudentId) return null
      const myVote = p.votes[myStudentId]
      if (!myVote) return null
      const idx = getIndex(myVote.optionId)
      const opt = p.options[idx]
      if (!opt) return null
      return typeof opt === 'string' ? opt : opt.label
    }

    return {
      pre: getPollData('phase1_prepoll'),
      post: getPollData('phase1_poll1'),
      myPre: getMyChoice('phase1_prepoll'),
      myPost: getMyChoice('phase1_poll1'),
      topic: myTopic
    }
  }, [pollsMap, groups, myGroupId, myStudentId])

  const posters = Object.entries(postersMap)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const essays = Object.entries(essaysMap)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const commentsArr = Object.entries(commentsMap).map(([id, c]) => ({ id, ...c }))

  // 모둠별 신뢰도 (절대 점수 기반 게이지) [Antigravity]
  // 기준(100%): 가장 댓글을 많이 받은 모둠의 댓글 수 * 9점 (3개 항목 만점)
  const { groupTrust, maxTrustScore } = useMemo(() => {
    const stats = {}
    let maxN = 0
    
    for (const gid of Object.keys(groups)) {
      const myPosters = posters.filter((p) => p.groupId === gid).map((p) => p.id)
      const my = commentsArr.filter(
        (c) => c.targetType === 'poster' && myPosters.includes(c.targetId),
      )
      let total = 0
      let n = 0
      for (const c of my) {
        if (!c.ratings) continue
        n += 1
        total += (c.ratings.logic || 0) + (c.ratings.feasibility || 0) + (c.ratings.relevance || 0)
      }
      stats[gid] = { total, n }
      if (n > maxN) maxN = n
    }
    
    return { 
      groupTrust: stats, 
      maxTrustScore: maxN > 0 ? maxN * 9 : 9 
    }
  }, [groups, posters, commentsArr])

  const meta = PHASE_META[1]

  // config.topics 기준 모든 시민단체 6개를 항상 표시(멤버 없는 모둠도 빈 상태로).
  // 자기 모둠 첫 번째 + 나머지는 학생 ID 기반 안정 셔플
  // → 모든 모둠이 누군가에겐 위에 오게 됨
  const orderedGroupEntries = useMemo(() => {
    const topicMap = config?.topics || {}
    const topicIds = Object.keys(topicMap)
    if (topicIds.length === 0) return []

    // 토픽마다 (gid=topicId, group 데이터) — 결성 안 된 토픽은 빈 모둠 객체
    const all = topicIds.map((tid) => {
      const t = topicMap[tid]
      const data = groups[tid] || {
        name: t?.name || tid,
        topic: tid,
        slogan: '',
        slogans: {},
        members: {},
      }
      return [tid, data]
    })

    const mine = myGroupId ? all.filter(([gid]) => gid === myGroupId) : []
    const others = all.filter(([gid]) => gid !== myGroupId)

    // 학생 ID 기반 시드 셔플 (간단한 해시)
    const seed = (myStudentId || 'teacher')
      .split('')
      .reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)
    const shuffled = others
      .map(([gid, g], i) => ({ gid, g, key: ((seed + i * 1009) % 9973) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => [x.gid, x.g])
    return [...mine, ...shuffled]
  }, [config, groups, myGroupId, myStudentId])

  const newsLinks = useMemo(() => {
    return Object.entries(linksMap)
      .map(([id, l]) => ({ id, ...l }))
      .filter((l) => l.type === 'news' && l.status === 'approved')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [linksMap])

  const videoLinks = useMemo(() => {
    return Object.entries(linksMap)
      .map(([id, l]) => ({ id, ...l }))
      .filter((l) => l.type !== 'news' && l.status === 'approved')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [linksMap])

  return (
    <div className={`min-h-screen ${meta.pageBg}`}>
      <RoomBar />

      <main className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        <StudentWorkflowProgress tone="amber" />

        <header className="space-y-3">
          <h1 className={`text-2xl font-bold ${meta.titleText}`}>시민 광장</h1>
          <p className="text-sm text-gray-600">
            시민단체에 합류하고, 캠페인 포스터나 제안 글로 {config?.countryName || '우리 반'} 문제를 알려 보세요.
          </p>
          <DiscussionPrompt
            tone="amber"
            question="지금 우리가 가장 해결해야 하는 문제는 무엇인가?"
            subline="시민단체 활동을 통해 의견을 모으고, 사후 여론조사 1로 코어 이슈를 선정한 뒤 기사를 작성합니다."
          />
        </header>

        {/* 오프닝 단계 안내 메시지 */}
        {wf.isHighlight('opening') && (
          <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-2xl p-8 shadow-lg text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">🎙️ 오프닝 멘트</h2>
            <p className="text-lg">지금은 선생님의 프로젝트 소개를 들어 봅시다.</p>
          </div>
        )}

        {/* 오프닝 단계일 때는 하위 탭 및 콘텐츠 전부 숨김 */}
        {!wf.isHighlight('opening') && (
          <>
        {/* 0. 최우선 과제 확정 전광판 [Antigravity] (Step 8 잠금 단계 혹은 여정 1 이후에만 노출) */}
        {(wf.isHighlight('lock') || currentPhase > 1) && (
          <HighlightBox active={wf.isHighlight('lock')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start" className="mb-8">
            <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-900 rounded-[2.5rem] p-8 text-center shadow-2xl border-4 border-amber-500/50 relative overflow-hidden ring-8 ring-indigo-900/10">
              {/* 광원 효과 */}
              <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-white/10 to-transparent blur-3xl pointer-events-none" />
              
              <div className="relative z-10 space-y-6">
                <header>
                  <span className="inline-block px-4 py-1 bg-amber-500 text-indigo-950 text-xs font-black rounded-full tracking-widest mb-3 animate-pulse">
                    {coreIssueGroup ? '공식 발표' : '선정 대기 중'}
                  </span>
                  <h2 className="text-white text-3xl font-black tracking-tight flex items-center justify-center gap-3">
                    <span className="text-amber-400">🎯</span> {config?.countryName || '우리 반'} 최우선 과제 확정
                  </h2>
                </header>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm shadow-inner">
                  
                  {coreIssueGroup ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <span className="text-8xl drop-shadow-[0_0_30px_rgba(255,223,0,0.6)]">{coreIssueGroup.emoji || config?.topics?.[coreIssueGroup.topic]?.emoji}</span>
                      </div>
                      <h3 className="text-5xl font-black text-white tracking-tighter drop-shadow-lg break-keep px-4">
                        {coreIssueGroup.name}
                      </h3>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-4 opacity-50">
                      <span className="text-6xl animate-bounce">⏳</span>
                      <h3 className="text-2xl font-bold text-white">아직 {config?.countryName || '우리 반'} 최우선 과제가 선정되지 않았습니다.</h3>
                      <p className="text-amber-200/60 text-xs">선생님께서 최종 결과를 확정할 때까지 잠시 기다려 주세요!</p>
                    </div>
                  )}
                </div>

                <div className="max-w-2xl mx-auto">
                  <div className="bg-white/10 rounded-2xl p-6 border border-white/10 text-white leading-relaxed shadow-lg backdrop-blur-md">
                    <p className="text-amber-300 font-bold mb-2 flex items-center justify-center gap-2">
                      <span>➡️</span> 두 번째 여정으로의 연결
                    </p>
                    <div className="text-base font-medium whitespace-pre-wrap">
                      {coreIssueGroup ? (
                        config?.guidance?.showPhase2Transition !== false && config?.guidance?.phase2Transition
                          ? config.guidance.phase2Transition
                          : `${coreIssueGroup.name} 의제를 중심으로 우리 반의 첫 번째 법안을 만들고 정책을 집행하는 두 번째 여정이 곧 시작됩니다.`
                      ) : (
                        `${config?.countryName || '우리 반'} 최우선 과제 선정 결과\n확정되면, 해당 주제를 중심으로 민주주의 의사결정 과정이 본격적으로 시작됩니다.`
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-center gap-4">
                  <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-amber-500/50" />
                  <span className="text-amber-500/70 text-[10px] font-bold tracking-[0.25em]">다음 여정: 선거</span>
                  <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-amber-500/50" />
                </div>
              </div>
            </section>
          </HighlightBox>
        )}

        {/* 활동 탭 — 국민청원 ↔ 시민단체 활동 (청원 활성화일 때만 탭 노출) */}
        {petitionEnabled && !coreIssueGroup && (
          <div className="flex gap-1 border-b border-amber-200">
            <button
              type="button"
              onClick={() => setActiveTab('petition')}
              className={`relative px-4 py-2 text-sm font-bold rounded-t-lg transition ${
                activeTab === 'petition'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-white text-amber-700 border-x border-t border-amber-200 hover:bg-amber-50'
              }`}
            >
              📜 국민청원
              {!petitionOpen && (
                <span className="ml-1 text-[10px] opacity-80">(읽기 전용)</span>
              )}
              {wf.currentStep?.highlight === 'petition' && (
                <span className="absolute -top-1 -right-1 text-[9px] px-1 py-0.5 rounded-full bg-rose-500 text-white animate-pulse font-bold">
                  NOW
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                // [Antigravity] 국민청원 단계에서는 접근 제한
                if (wf.currentStep?.id === 'petition' || wf.currentStep?.id === 'opening') {
                  alert('아직 시민단체 활동 단계가 아닙니다. 국민청원 활동에 집중해 주세요!')
                  return
                }
                setActiveTab('civic')
              }}
              className={`relative px-4 py-2 text-sm font-bold rounded-t-lg transition ${
                activeTab === 'civic'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-white text-amber-700 border-x border-t border-amber-200 hover:bg-amber-50'
              } ${ (wf.currentStep?.id === 'petition' || wf.currentStep?.id === 'opening') ? 'opacity-60 cursor-not-allowed' : '' }`}
            >
              🏛️ 시민단체 활동
              {(wf.currentStep?.id === 'petition' || wf.currentStep?.id === 'opening') && (
                <span className="ml-1 text-[10px]">🔒</span>
              )}
              {wf.currentStep?.highlight && wf.currentStep.highlight !== 'petition' && wf.currentStep.id !== 'opening' && (
                <span className="absolute -top-1 -right-1 text-[9px] px-1 py-0.5 rounded-full bg-rose-500 text-white animate-pulse font-bold">
                  NOW
                </span>
              )}
            </button>
          </div>
        )}

        {/* 청원 탭 */}
        {petitionEnabled && activeTab === 'petition' && (
          <HighlightBox active={wf.isHighlight('petition')} anyHighlight={anyHL} previewMode={previewMode}>
            <section className="space-y-4">
              {config?.guidance?.enabled !== false && config?.guidance?.phase1?.petition && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-amber-900 text-sm font-medium shadow-sm">
                  💡 {config.guidance.phase1.petition}
                </div>
              )}
              <PetitionBoard />
            </section>
          </HighlightBox>
        )}

        {/* 시민단체 활동 탭 (청원 비활성화 시 항상 표시) */}
        {(!petitionEnabled || activeTab === 'civic') && <>

        {/* 1. 모둠 결성 및 사전 여론조사 */}
        <HighlightBox active={wf.isHighlight('groups')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start">
          <div className="space-y-4">
            <GroupJoinPanel />
            {/* [Antigravity] 3단계 사전 여론조사 노출 (ID 지정으로 확실히 노출) */}
            <div className="mt-4">
              <PollFeed targetPollId="phase1_prepoll" previewMode={previewMode} />
            </div>
          </div>
        </HighlightBox>

        {/* 2. 우리 모둠 활동 박스 (학생 혹은 미리보기 모드일 때 표시) */}
        {isStudent && (
          <HighlightBox active={wf.isHighlight('media')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start">
            <section className="bg-white rounded-2xl shadow-sm border-2 border-indigo-200 p-4 space-y-5">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-lg font-bold text-indigo-800">
                  {myGroupId ? `우리 모둠 — ${groups[myGroupId]?.name}` : '🚩 활동 안내 및 제출'}
                </h2>
                {config?.guidance?.enabled !== false && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">ACTIVITY GUIDANCE</span>
                )}
              </div>
              
              {config?.guidance?.enabled !== false && (
                <div className="space-y-2">
                  {config.guidance.phase1?.poster && config.phase1Activities?.poster !== false && (
                    <p className="text-xs text-indigo-700 bg-indigo-50/50 p-2 rounded-xl">🎨 <strong>포스터:</strong> {config.guidance.phase1.poster}</p>
                  )}
                  {config.guidance.phase1?.essay && config.phase1Activities?.essay !== false && (
                    <p className="text-xs text-indigo-700 bg-indigo-50/50 p-2 rounded-xl">✍️ <strong>주장글:</strong> {config.guidance.phase1.essay}</p>
                  )}
                  {config.guidance.phase1?.link && (config.phase1Activities?.news !== false || config.phase1Activities?.video !== false) && (
                    <p className="text-xs text-indigo-700 bg-indigo-50/50 p-2 rounded-xl">🎬 <strong>기사/영상:</strong> {config.guidance.phase1.link}</p>
                  )}
                </div>
              )}

              {!myGroupId ? (
                <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-8 text-center space-y-3">
                  <p className="text-3xl">🤝</p>
                  <p className="text-sm font-bold text-amber-800">활동을 시작하려면 먼저 시민단체에 가입해 주세요!</p>
                  <p className="text-xs text-amber-600">위의 '시민단체 가입' 섹션에서 원하는 단체를 선택할 수 있습니다.</p>
                </div>
              ) : (
                <>
                  {/* 활동 미리보기 (Preview) [Antigravity] */}
                  <MyGroupActivityPreview 
                    group={{ id: myGroupId, ...groups[myGroupId] }}
                    posters={posters.filter(p => p.groupId === myGroupId)}
                    essays={essays.filter(e => e.groupId === myGroupId)}
                    articles={Object.entries(articlesMap).map(([id, a]) => ({ id, ...a })).filter(a => a.authorGroupId === myGroupId)}
                    links={Object.entries(linksMap).map(([id, l]) => ({ id, ...l })).filter(l => l.groupId === myGroupId)}
                    topicMeta={config?.topics?.[groups[myGroupId]?.topic]}
                    config={config}
                    myStudentId={myStudentId}
                    roomCode={roomCode}
                    onEditEssay={(id) => setEditingEssayId(id)}
                    onEditLink={(id) => setEditingLinkId(id)}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* 포스터 업로드 (모둠 공통) [Antigravity] */}
                    {config?.phase1Activities?.poster !== false && (
                      <div className="lg:col-span-1 h-full">
                        {(() => {
                          const myGroupPoster = posters.find(p => p.groupId === myGroupId)
                          return (
                            <PosterUpload 
                              groupId={myGroupId} 
                              posterId={myGroupPoster?.id}
                              existingPoster={myGroupPoster}
                            />
                          )
                        })()}
                      </div>
                    )}
                    
                    {/* 주장하는 글 에디터 (개인별) [Antigravity] */}
                    {config?.phase1Activities?.essay !== false && (
                      <div className={config?.phase1Activities?.poster !== false ? "lg:col-span-2" : "lg:col-span-3"}>
                        <EssayEditor 
                          groupId={myGroupId} 
                          editingEssayId={editingEssayId}
                          essayData={essays.find(e => e.id === editingEssayId)}
                          onSuccess={() => setEditingEssayId(null)}
                          onCancel={() => setEditingEssayId(null)}
                        />
                      </div>
                    )}
                  </div>

                  {/* 링크 제출 (기사/영상 설정에 따라 표시) [Antigravity] */}
                  <div className="lg:col-span-2">
                    {config?.linksOpen !== false && (config?.phase1Activities?.news !== false || config?.phase1Activities?.video !== false) && (
                      <div className="bg-gray-50 rounded-2xl p-4 border border-dashed">
                        <p className="text-xs font-bold text-gray-500 mb-2">🎬 추가 기사 및 영상 링크 제출</p>
                        <LinkSubmit 
                          groupId={myGroupId} 
                          showNews={config?.phase1Activities?.news !== false}
                          showVideo={config?.phase1Activities?.video !== false}
                          editingLinkId={editingLinkId}
                          linkData={Object.entries(linksMap).map(([id, l]) => ({ id, ...l })).find(l => l.id === editingLinkId)}
                          onSuccess={() => setEditingLinkId(null)}
                          onCancel={() => setEditingLinkId(null)}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </HighlightBox>
        )}

        {/* 3. 캠페인 광장 — 모둠별 통합 카드(포스터·구호·기사·주장글) */}
        <HighlightBox active={wf.isHighlight('gallery')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start">
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-bold text-amber-800">캠페인 광장</h2>
              <span className="text-xs text-gray-500">
                시민단체 {orderedGroupEntries.length}개 · 학생마다 순서가 다릅니다
              </span>
            </div>
            {config?.guidance?.enabled !== false && config?.guidance?.phase1?.gallery && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-amber-900 text-sm font-medium shadow-sm">
                📢 {config.guidance.phase1.gallery}
              </div>
            )}
            {orderedGroupEntries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400">
                선생님이 아직 시민단체 종류를 설정하지 않았어요.
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {orderedGroupEntries.map(([gid, g]) => {
                  const groupPosters = posters.filter((p) => p.groupId === gid)
                  const groupEssays = essays.filter((e) => e.groupId === gid)
                  const groupNews = newsLinks.filter((l) => l.groupId === gid)
                  const groupVideos = videoLinks.filter((l) => l.groupId === gid)
                  const topicMeta = config?.topics?.[g?.topic]
                  return (
                    <GroupShowcase
                      key={gid}
                      group={{ id: gid, ...g }}
                      posters={groupPosters}
                      essays={groupEssays}
                      newsLinks={groupNews}
                      videoLinks={groupVideos}
                      comments={commentsArr}
                      topicMeta={topicMeta}
                      isMine={gid === myGroupId}
                      myStudentId={myStudentId}
                      roomCode={roomCode}
                      onEditEssay={(id) => setEditingEssayId(id)}
                    />
                  )
                })}
              </div>
            )}
          </section>
        </HighlightBox>



        {/* 5. 여론조사 단계 — 활동 요약 + 폴 (기사 작성 앞으로 이동) */}
        {wf.showSummary && <PhaseActivitySummary phase={1} />}

        <HighlightBox active={wf.isHighlight('poll')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start">
          <div className="space-y-6">
            {/* 최종 여론조사 시 신뢰도 현황판 표시 [Antigravity] */}
            {Object.keys(config?.topics || {}).length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                  📊 최종 캠페인 신뢰도 현황 (여론조사 참고)
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(config.topics).map(([tid, t]) => {
                    const g = groups[tid] || {}
                    const trust = groupTrust[tid] || { total: 0, n: 0 }
                    return (
                      <TrustGauge
                        key={tid}
                        score={trust.total}
                        max={maxTrustScore}
                        label={`${t.emoji} ${g.name || t.name} (${trust.n}건)`}
                      />
                    )
                  })}
                </div>
              </div>
            )}
            <PollFeed plannedOnly={true} previewMode={previewMode} />
          </div>
        </HighlightBox>

        {/* 6. 기사 작성 (여론조사 뒤로 이동) */}
        <HighlightBox active={wf.isHighlight('article')} anyHighlight={anyHL} previewMode={previewMode} scrollBlock="start">
          <section className="space-y-6">
              <header className="mb-6">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <span className="text-3xl">📰</span> 시민단체의 목소리 (기사 작성)
                </h2>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  오늘의 활동 결과를 정리하여 기사로 남겨보세요. <br />
                  기사가 승인되면 '여론판'에 게시되어 모든 친구들이 볼 수 있습니다.
                </p>
              </header>

              {coreIssueGroup && (
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <h3 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-1">
                    ✨ 다음 여정 안내
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    이제 {config?.countryName || '우리 반'}의 <strong>최우선 과제</strong>가 결정되었습니다. <br />
                    이어지는 <strong>두 번째 여정</strong>에서는 이 문제를 해결하기 위해 나설 {config?.countryName || '우리 반'}의 리더를 뽑는 선거가 시작됩니다!
                  </p>
                </div>
              )}

            {config?.guidance?.enabled !== false && config?.guidance?.phase1?.article && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-blue-900 text-sm font-medium shadow-sm">
                💡 {config.guidance.phase1.article}
              </div>
            )}

            <Phase1ArticleReferenceStats
              config={config}
              groups={groups}
              groupTrust={groupTrust}
              maxTrustScore={maxTrustScore}
              myPollStats={myPollStats}
            />

            <Phase1PollReasonCard
              myPollStats={myPollStats}
              voteReason={voteReason}
              setVoteReason={setVoteReason}
              dbReason={dbReason}
              savingReason={savingReason}
              onSave={saveVoteReason}
            />

            <ArticleSection />

            <hr className="border-dashed border-gray-200" />

            {/* 참고용 데이터들 */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">📝 우리 모둠 활동 참고</h3>

              {/* 3. 우리 모둠 활동 미리보기 (포스터/글 등) */}
              {myGroupId && (
                <MyGroupActivityPreview 
                  group={{ id: myGroupId, ...groups[myGroupId] }}
                  posters={posters.filter(p => p.groupId === myGroupId)}
                  essays={essays.filter(e => e.groupId === myGroupId)}
                  articles={Object.entries(articlesMap).map(([id, a]) => ({ id, ...a })).filter(a => a.authorGroupId === myGroupId)}
                  links={Object.entries(linksMap).map(([id, l]) => ({ id, ...l })).filter(l => l.groupId === myGroupId)}
                  topicMeta={config?.topics?.[groups[myGroupId]?.topic]}
                  config={config}
                />
              )}
            </div>
          </section>
        </HighlightBox>

          </>
        }
          </>
        )}
      </main>
      <SessionFinishButton />
    </div>
  )
}

export default Phase1Page
