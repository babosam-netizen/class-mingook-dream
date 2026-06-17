import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { ArticleDetailModal } from './ArticleCard'

/**
 * 비빔민국의 이모저모 — 여정별 타임라인 안내판
 * Phase 순서대로 결정된 사항·토론·여론조사·기사를 시간순으로 정리
 */

const PHASE_META = [
  { phase: 1, icon: '🌱', label: '첫 번째 여정', sub: '시민광장',    borderCls: 'border-rose-300',   dotCls: 'bg-rose-400',   tagCls: 'bg-rose-100 text-rose-700' },
  { phase: 2, icon: '🗳️',  label: '두 번째 여정', sub: '선거',        borderCls: 'border-amber-300',  dotCls: 'bg-amber-400',  tagCls: 'bg-amber-100 text-amber-700' },
  { phase: 3, icon: '🏛️', label: '세 번째 여정', sub: '국정 운영',   borderCls: 'border-indigo-300', dotCls: 'bg-indigo-400', tagCls: 'bg-indigo-100 text-indigo-700' },
  { phase: 4, icon: '🌿', label: '네 번째 여정', sub: '시사회·정리',  borderCls: 'border-teal-300',  dotCls: 'bg-teal-400',   tagCls: 'bg-teal-100 text-teal-700' },
]

const PERSPECTIVE_BADGE = {
  critical:   { emoji: '🔍', cls: 'bg-rose-100 text-rose-700' },
  supportive: { emoji: '👍', cls: 'bg-emerald-100 text-emerald-700' },
  neutral:    { emoji: '⚖️', cls: 'bg-gray-100 text-gray-700' },
}

/* ── 이벤트 행 ── */
function EventRow({ icon, label, children }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 text-sm leading-none mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-gray-500 mr-1">{label}</span>
        {children}
      </div>
    </div>
  )
}

/* ── 여정별 기사 모아보기 ── */
function ArticleGallery({ articles, label = '기사', onOpen }) {
  const [open, setOpen] = useState(false)
  if (articles.length === 0) return null
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold transition"
      >
        <span>📰</span>
        <span>{label} ({articles.length}건)</span>
        <span className="text-indigo-300">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 pl-1">
          {articles.map((a) => {
            const badge = PERSPECTIVE_BADGE[a.perspective] || PERSPECTIVE_BADGE.neutral
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpen(a)}
                  className="w-full text-left flex items-start gap-1.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition group"
                >
                  <span className={`mt-0.5 shrink-0 text-[9px] px-1 py-0.5 rounded font-bold ${badge.cls}`}>
                    {badge.emoji}
                  </span>
                  <span className="text-gray-700 group-hover:text-indigo-700 leading-snug line-clamp-1">
                    {a.headline}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                    {a.authorNickname}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── 여론조사 요약 ── */
function PollSummary({ poll }) {
  const votes  = poll.votes || {}
  const total  = Object.keys(votes).length
  const counts = {}
  Object.values(votes).forEach((v) => {
    const oid = typeof v === 'object' ? v.optionId : v
    if (oid) counts[oid] = (counts[oid] || 0) + 1
  })
  const best = (poll.options || []).reduce((prev, cur) =>
    (counts[cur.id] || 0) > (counts[prev?.id] || 0) ? cur : (prev || cur), null)
  const pct = total > 0 && best ? Math.round(((counts[best.id] || 0) / total) * 100) : 0
  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-1.5 space-y-0.5 text-xs">
      <p className="font-bold text-gray-700 leading-snug">{poll.question}</p>
      {best && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-blue-700 font-bold shrink-0">{best.label} {pct}%</span>
          <span className="text-gray-400 shrink-0">({total}명)</span>
        </div>
      )}
    </div>
  )
}

/* ── 최우선 과제 투표 결과 ── */
function CoreIssueResult({ coreIssuePoll, coreIssue }) {
  const votes  = coreIssuePoll?.votes || {}
  const total  = Object.keys(votes).length
  if (total === 0 && !coreIssue) return null

  const counts = {}
  Object.values(votes).forEach((v) => {
    const oid = v?.optionId || v
    if (oid) counts[oid] = (counts[oid] || 0) + 1
  })
  const tally = Object.entries(counts)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="bg-rose-50 rounded-xl px-3 py-2.5 space-y-2 border border-rose-100">
      <div className="flex items-center gap-2">
        <p className="text-xs font-black text-rose-800">
          🎯 확정: <span className="text-rose-600">"{coreIssue}"</span>
        </p>
        {total > 0 && <span className="text-[10px] text-rose-400">투표 {total}명 참여</span>}
      </div>
      {tally.length > 0 && (
        <div className="space-y-1">
          {tally.map(({ label, count, pct }) => (
            <div key={label} className="flex items-center gap-2 text-[10px]">
              <span className={`shrink-0 font-bold w-16 truncate ${label === coreIssue ? 'text-rose-700' : 'text-gray-600'}`}>
                {label === coreIssue && '🎯 '}{label}
              </span>
              <div className="flex-1 bg-rose-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${label === coreIssue ? 'bg-rose-500' : 'bg-rose-200'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-gray-500 shrink-0 tabular-nums">{count}표 ({pct}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 여정 섹션 ── */
function JourneySection({ meta, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="relative pl-6">
      <div className={`absolute left-2 top-5 bottom-0 w-0.5 ${meta.borderCls}`} />
      <div className={`absolute left-[3px] top-1.5 w-3.5 h-3.5 rounded-full ${meta.dotCls} border-2 border-white shadow`} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-2 group w-full text-left"
      >
        <span className="text-base leading-none">{meta.icon}</span>
        <span className="font-black text-gray-800 text-sm">{meta.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${meta.tagCls}`}>{meta.sub}</span>
        <span className="ml-auto text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="space-y-2 pb-5">{children}</div>}
    </div>
  )
}

/* ── 메인 컴포넌트 ── */
function OpinionBriefing() {
  const roomCode     = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const coreIssue    = useGameStore((s) => s.coreIssue)
  const groups       = useGameStore((s) => s.groups) || {}

  const [candidatesMap,   setCandidatesMap]   = useState({})
  const [journalistsMap,  setJournalistsMap]  = useState({})
  const [billsMap,        setBillsMap]        = useState({})
  const [pollsMap,        setPollsMap]        = useState({})
  const [petitionsMap,    setPetitionsMap]    = useState({})
  const [debatesMap,      setDebatesMap]      = useState({})
  const [articlesMap,     setArticlesMap]     = useState({})
  const [openArticle,     setOpenArticle]     = useState(null)

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'candidates',        (d) => setCandidatesMap(d || {}))
    const u2 = subscribe(roomCode, 'electionJournalists',(d) => setJournalistsMap(d || {}))
    const u3 = subscribe(roomCode, 'bills',             (d) => setBillsMap(d || {}))
    const u4 = subscribe(roomCode, 'polls',             (d) => setPollsMap(d || {}))
    const u5 = subscribe(roomCode, 'petitions',         (d) => setPetitionsMap(d || {}))
    const u6 = subscribe(roomCode, 'debateSessions',    (d) => setDebatesMap(d || {}))
    const u7 = subscribe(roomCode, 'articles',          (d) => setArticlesMap(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.(); u7?.() }
  }, [roomCode])

  /* ── 승인된 기사 전체 ── */
  const approvedArticles = useMemo(() =>
    Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.status === 'approved')
      .sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0)),
  [articlesMap])

  const articlesByPhase = useMemo(() => {
    const result = { 1: [], 2: [], 3: [], 4: [] }
    approvedArticles.forEach((a) => {
      const ph = Number(a.phase) || 1
      if (result[ph]) result[ph].push(a)
    })
    return result
  }, [approvedArticles])

  /* ── 여정별·맥락별 기사 분류 ── */
  const articlesByPhaseCtx = useMemo(() => {
    const r = {}
    for (let ph = 1; ph <= 4; ph++) {
      const list = articlesByPhase[ph] || []
      r[ph] = {
        debate:     list.filter((a) => a.contextType === 'debate'),
        journalist: list.filter((a) => a.contextType !== 'debate' && !!journalistsMap[a.authorGroupId]),
        activity:   list.filter((a) => a.contextType !== 'debate' && !journalistsMap[a.authorGroupId]),
      }
    }
    return r
  }, [articlesByPhase, journalistsMap])

  /* ── Phase 1 ── */
  const p1 = useMemo(() => {
    const coreIssuePoll = pollsMap['coreIssue'] || null
    const approved = Object.values(petitionsMap).filter((p) => p.status === 'approved')
    const top3     = [...approved].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0)).slice(0, 3)
    const polls    = Object.values(pollsMap)
      .filter((p) => p !== coreIssuePoll && Number(p?.phaseStep?.phase) === 1 && Object.keys(p.votes || {}).length > 0)
    const debates  = Object.values(debatesMap).filter((d) => String(d.phase) === '1')
    return { coreIssuePoll, approved, top3, polls, debates }
  }, [petitionsMap, pollsMap, debatesMap])

  /* ── Phase 2 ── */
  const p2 = useMemo(() => {
    const allGroups = Object.entries(groups).map(([gid, g]) => {
      const c = candidatesMap[gid]
      const isJournalist = !!journalistsMap[gid]
      if (isJournalist) return { gid, name: g.name, type: 'journalist', step: 0, c: null }
      if (!c) return { gid, name: g.name, type: 'none', step: 0, c: null }
      const step = [
        !!(c.candidateSavedAt || c.leaderStudentId),
        !!c.introSavedAt,
        !!c.pledgesSavedAt,
        !!c.mediaSavedAt,
        c.status === 'submitted',
      ].filter(Boolean).length
      return { gid, name: g.name, type: c.status === 'submitted' ? 'submitted' : 'drafting', step, c }
    }).sort((a, b) => (a.c?.candidateNumber ?? 99) - (b.c?.candidateNumber ?? 99))

    const polls   = Object.values(pollsMap).filter((p) => Number(p?.phaseStep?.phase) === 2 && Object.keys(p.votes || {}).length > 0)
    const debates = Object.values(debatesMap).filter((d) => String(d.phase) === '2')
    return { allGroups, polls, debates }
  }, [groups, candidatesMap, journalistsMap, pollsMap, debatesMap])

  /* ── Phase 3 ── */
  const p3 = useMemo(() => {
    const allBills = Object.values(billsMap)
    const passed   = allBills.filter((b) => b.status === 'passed').sort((a, b) => (b.votedAt || 0) - (a.votedAt || 0))
    const rejected = allBills.filter((b) => b.status === 'rejected').sort((a, b) => (b.votedAt || 0) - (a.votedAt || 0))
    const polls    = Object.values(pollsMap).filter((p) => Number(p?.phaseStep?.phase) === 3 && Object.keys(p.votes || {}).length > 0)
    const debates  = Object.values(debatesMap).filter((d) => String(d.phase) === '3')
    return { passed, rejected, polls, debates }
  }, [billsMap, pollsMap, debatesMap])

  /* ── Phase 4 ── */
  const p4 = useMemo(() => {
    const polls   = Object.values(pollsMap).filter((p) => Number(p?.phaseStep?.phase) === 4 && Object.keys(p.votes || {}).length > 0)
    const debates = Object.values(debatesMap).filter((d) => String(d.phase) === '4')
    return { polls, debates }
  }, [pollsMap, debatesMap])

  const hasPhase1 = !!(coreIssue || p1.approved.length > 0 || p1.polls.length > 0 || p1.debates.length > 0)
  const hasPhase2 = currentPhase >= 2 && !!(p2.allGroups.length > 0 || p2.polls.length > 0 || p2.debates.length > 0)
  const hasPhase3 = currentPhase >= 3 && !!(p3.passed.length > 0 || p3.rejected.length > 0 || p3.polls.length > 0 || p3.debates.length > 0)
  const hasPhase4 = currentPhase >= 4 && !!(p4.polls.length > 0 || p4.debates.length > 0)

  if (!hasPhase1 && !hasPhase2 && !hasPhase3 && !hasPhase4) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
      <header className="bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 text-white">
        <h2 className="text-sm font-black flex items-center gap-2">
          <span className="text-base">📋</span> 비빔민국의 이모저모
        </h2>
        <p className="text-[10px] text-orange-100 mt-0.5">여정별 결정 사항 · 토론 · 여론조사 · 기사 타임라인</p>
      </header>

      <div className="px-4 py-4 space-y-0">

        {/* ── 첫 번째 여정 ── */}
        {hasPhase1 && (
          <JourneySection meta={PHASE_META[0]}>
            {/* 최우선 과제 투표 결과 */}
            {coreIssue && (
              <CoreIssueResult coreIssuePoll={p1.coreIssuePoll} coreIssue={coreIssue} />
            )}

            {/* 국민청원 */}
            {p1.approved.length > 0 && (
              <EventRow icon="📢" label={`국민청원 ${p1.approved.length}건 접수`}>
                <div className="mt-1 space-y-0.5">
                  {p1.top3.map((p, i) => (
                    <div key={p.id} className="flex items-start gap-1">
                      <span className="text-gray-400 shrink-0">#{i + 1}</span>
                      {p.prefixTag && <span className="bg-gray-100 text-gray-600 text-[9px] px-1 py-0.5 rounded shrink-0">{p.prefixTag}</span>}
                      <span className="text-gray-700">{p.title}</span>
                      {(p.likeCount || 0) > 0 && <span className="text-rose-400 text-[10px] shrink-0">♥{p.likeCount}</span>}
                    </div>
                  ))}
                  {p1.approved.length > 3 && <p className="text-gray-400 text-[10px]">외 {p1.approved.length - 3}건</p>}
                </div>
              </EventRow>
            )}

            {/* 토론 */}
            {p1.debates.map((d) => (
              <EventRow key={d.id || d.topic} icon="💬" label="토론">
                <span className="text-gray-700">{d.topic || '주제 미지정'}</span>
                <span className={`ml-1 text-[10px] ${d.isActive ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  {d.isActive ? '진행 중' : '종료'}
                </span>
              </EventRow>
            ))}

            {/* 여론조사 */}
            {p1.polls.map((poll) => (
              <EventRow key={poll.id} icon="📊" label="여론조사">
                <div className="mt-0.5 w-full"><PollSummary poll={poll} /></div>
              </EventRow>
            ))}

            <ArticleGallery label="토론 기사 모아보기"       articles={articlesByPhaseCtx[1].debate}     onOpen={setOpenArticle} />
            <ArticleGallery label="첫 번째 여정 기사 모아보기" articles={articlesByPhaseCtx[1].activity}   onOpen={setOpenArticle} />
          </JourneySection>
        )}

        {/* ── 두 번째 여정 ── */}
        {hasPhase2 && (
          <JourneySection meta={PHASE_META[1]}>
            {p2.allGroups.length > 0 && (
              <EventRow icon="🏛️" label={`모둠별 후보 현황`}>
                <div className="mt-1 space-y-0.5">
                  {p2.allGroups.map(({ gid, name, type, step, c }) => (
                    <div key={gid} className="flex items-center gap-1.5">
                      {c?.candidateNumber ? (
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {c.candidateNumber}
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-gray-200 text-[9px] flex items-center justify-center shrink-0 text-gray-400">·</span>
                      )}
                      <span className={`font-semibold text-[11px] ${type === 'none' ? 'text-gray-400' : 'text-gray-800'}`}>
                        {c?.leaderNickname ? `${c.leaderNickname} 후보` : name}
                      </span>
                      <span className={`ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        type === 'submitted'  ? 'bg-emerald-100 text-emerald-700' :
                        type === 'drafting'   ? 'bg-amber-100 text-amber-700' :
                        type === 'journalist' ? 'bg-blue-100 text-blue-700' :
                                               'bg-gray-100 text-gray-400'
                      }`}>
                        {type === 'submitted'  ? '✅ 등록완료' :
                         type === 'drafting'   ? `${step}번까지 등록` :
                         type === 'journalist' ? '📰 기자단' :
                                                '○ 미등록'}
                      </span>
                    </div>
                  ))}
                </div>
              </EventRow>
            )}
            {p2.debates.map((d) => (
              <EventRow key={d.id || d.topic} icon="💬" label="선거 토론">
                <span className="text-gray-700">{d.topic || '주제 미지정'}</span>
                <span className={`ml-1 text-[10px] ${d.isActive ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  {d.isActive ? '진행 중' : '종료'}
                </span>
              </EventRow>
            ))}
            {p2.polls.map((poll) => (
              <EventRow key={poll.id} icon="📊" label="여론조사">
                <div className="mt-0.5 w-full"><PollSummary poll={poll} /></div>
              </EventRow>
            ))}
            <ArticleGallery label="기자단 기사 모아보기"    articles={articlesByPhaseCtx[2].journalist} onOpen={setOpenArticle} />
            <ArticleGallery label="선거 토론 기사 모아보기"  articles={articlesByPhaseCtx[2].debate}     onOpen={setOpenArticle} />
            <ArticleGallery label="선거 기사 모아보기"       articles={articlesByPhaseCtx[2].activity}   onOpen={setOpenArticle} />
          </JourneySection>
        )}

        {/* ── 세 번째 여정 ── */}
        {hasPhase3 && (
          <JourneySection meta={PHASE_META[2]}>
            {(p3.passed.length > 0 || p3.rejected.length > 0) && (
              <EventRow icon="📜" label={`법안 의결 (통과 ${p3.passed.length} / 부결 ${p3.rejected.length})`}>
                <div className="mt-1 space-y-0.5">
                  {p3.passed.map((b, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold shrink-0">통과</span>
                      <span className="text-gray-800">{b.title}</span>
                    </div>
                  ))}
                  {p3.rejected.map((b, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold shrink-0">부결</span>
                      <span className="text-gray-500">{b.title}</span>
                    </div>
                  ))}
                </div>
              </EventRow>
            )}
            {p3.debates.map((d) => (
              <EventRow key={d.id || d.topic} icon="💬" label="본회의 토론">
                <span className="text-gray-700">{d.topic || '주제 미지정'}</span>
                <span className={`ml-1 text-[10px] ${d.isActive ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  {d.isActive ? '진행 중' : '종료'}
                </span>
              </EventRow>
            ))}
            {p3.polls.map((poll) => (
              <EventRow key={poll.id} icon="📊" label="여론조사">
                <div className="mt-0.5 w-full"><PollSummary poll={poll} /></div>
              </EventRow>
            ))}
            <ArticleGallery label="기자단 기사 모아보기"    articles={articlesByPhaseCtx[3].journalist} onOpen={setOpenArticle} />
            <ArticleGallery label="본회의 토론 기사 모아보기" articles={articlesByPhaseCtx[3].debate}     onOpen={setOpenArticle} />
            <ArticleGallery label="국정 운영 기사 모아보기"   articles={articlesByPhaseCtx[3].activity}   onOpen={setOpenArticle} />
          </JourneySection>
        )}

        {/* ── 네 번째 여정 ── */}
        {hasPhase4 && (
          <JourneySection meta={PHASE_META[3]}>
            {p4.debates.map((d) => (
              <EventRow key={d.id || d.topic} icon="💬" label="정리 토론">
                <span className="text-gray-700">{d.topic || '주제 미지정'}</span>
                <span className={`ml-1 text-[10px] ${d.isActive ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  {d.isActive ? '진행 중' : '종료'}
                </span>
              </EventRow>
            ))}
            {p4.polls.map((poll) => (
              <EventRow key={poll.id} icon="📊" label="여론조사">
                <div className="mt-0.5 w-full"><PollSummary poll={poll} /></div>
              </EventRow>
            ))}
            <ArticleGallery label="기자단 기사 모아보기"    articles={articlesByPhaseCtx[4].journalist} onOpen={setOpenArticle} />
            <ArticleGallery label="마무리 토론 기사 모아보기" articles={articlesByPhaseCtx[4].debate}     onOpen={setOpenArticle} />
            <ArticleGallery label="네 번째 여정 기사 모아보기" articles={articlesByPhaseCtx[4].activity}   onOpen={setOpenArticle} />
          </JourneySection>
        )}

      </div>

      {/* 기사 열기 모달 */}
      {openArticle && (
        <ArticleDetailModal
          article={openArticle}
          onClose={() => setOpenArticle(null)}
        />
      )}
    </div>
  )
}

export default OpinionBriefing
