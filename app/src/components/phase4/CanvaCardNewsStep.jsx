import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { getDebatePrepCardConfig } from '../debate/tools/DebatePrepCard'
import PosterMedia from '../phase1/PosterMedia'
import { calculateRanks } from '../../lib/election'

/**
 * 2단계: 캔바 카드뉴스 제작 + URL 제출
 * - 1단계에서 별점 준 상위 활동 3개 참고 목록 표시 (누르면 아코디언으로 본문/투표결과/미디어 전체 펼침)
 * - 캔바 링크 자료는 단순 링크 텍스트가 아닌 Canva Embed iframe으로 자동 렌더링
 * - 내가 작성한 동료 평가 댓글(원글 제목 노출 및 제목 클릭 시 내용 펼침) 수집 및 시각화 지원
 * - Canva 바로가기 버튼 + 제작 가이드
 * - URL/embed 제출 + 미리보기
 */
export default function CanvaCardNewsStep() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const candidatesMap = useGameStore((s) => s.candidates) || {}

  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [ratings,         setRatings]         = useState({})
  const [essays,          setEssays]          = useState({})
  const [posters,         setPosters]         = useState({})
  const [candidates,      setCandidates]      = useState({})
  const [supports,        setSupports]        = useState({})
  const [articles,        setArticles]        = useState({})
  const [branchData,      setBranchData]      = useState({})
  const [links,           setLinks]           = useState({})
  const [polls,           setPolls]           = useState({})
  const [pollReasons,     setPollReasons]     = useState({})
  const [electionVotes,   setElectionVotes]   = useState({})
  const [billVotes,       setBillVotes]       = useState({})
  const [juryVotes,       setJuryVotes]       = useState({})
  const [debateSessions,  setDebateSessions]  = useState({})
  const [commentsMap,     setCommentsMap]     = useState({})
  const [reflectionsMap,  setReflectionsMap]  = useState({})

  const [canvaInput, setCanvaInput] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [showEmbedGuide, setShowEmbedGuide] = useState(false)

  // 기존 저장값 및 전체 활동 리소스를 로드/구독
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}`).then((d) => {
      if (d?.journeyRatings) setRatings(d.journeyRatings)
      if (d?.canvaCardNewsUrl) {
        setSavedUrl(d.canvaCardNewsUrl)
        setCanvaInput(d.canvaCardNewsUrl)
      }
    })
    const subs = [
      subscribe(roomCode, 'essays',            (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',           (d) => setPosters(d || {})),
      subscribe(roomCode, 'candidates',        (d) => setCandidates(d || {})),
      subscribe(roomCode, 'supportStatements', (d) => setSupports(d || {})),
      subscribe(roomCode, 'articles',          (d) => setArticles(d || {})),
      subscribe(roomCode, 'branchUnits',       (d) => setBranchData(d || {})),
      subscribe(roomCode, 'links',             (d) => setLinks(d || {})),
      subscribe(roomCode, 'polls',             (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons',     (d) => setPollReasons(d || {})),
      subscribe(roomCode, 'electionVotes',     (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'billVotes',         (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes',         (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'debateSessions',    (d) => setDebateSessions(d || {})),
      subscribe(roomCode, 'comments',          (d) => setCommentsMap(d || {})),
      subscribe(roomCode, 'reflections',       (d) => setReflectionsMap(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode, myStudentId])

  // 전체 활동 수집 (MyJourneyTimeline 과 동기화)
  const activities = useMemo(() => {
    const acts = []

    // 1-1. 슬로건
    Object.entries(groups || {}).forEach(([gid, g]) => {
      const ss = g?.slogans || {}
      Object.entries(ss).forEach(([sid, s]) => {
        if (s?.authorStudentId === myStudentId) {
          acts.push({
            key: `phase1_slogan_${gid}_${sid}`,
            phase: 1,
            type: 'slogan',
            icon: '💬',
            shortTitle: '슬로건',
            stepLabel: '슬로건 제출',
            title: `시민광장 슬로건`,
            content: `내가 제출한 슬로건:\n"${s.text}"`
          })
        }
      })
    })

    // 1-2. 주장하는 글 (에세이)
    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`, phase: 1,
        type: 'essay',
        icon: '📝', shortTitle: '주장글',
        stepLabel: '나의 주장글(에세이) 작성',
        title: e.title || '주장하는 글',
        content: [
          e.claim ? `[주장] ${e.claim}` : '',
          e.evidence ? `[근거] ${e.evidence}` : '',
          e.impact ? `[해결 방안 및 기대 효과] ${e.impact}` : ''
        ].filter(Boolean).join('\n\n'),
      })
    })

    // 1-3. 포스터
    Object.entries(posters).forEach(([id, p]) => {
      if (p.authorStudentId !== myStudentId && (!myGroupId || p.groupId !== myGroupId)) return
      const isMyUpload = p.authorStudentId === myStudentId
      acts.push({
        key: `phase1_poster_${id}`, phase: 1,
        type: 'poster',
        poster: p,
        icon: '🖼️', shortTitle: isMyUpload ? '내포스터' : '모둠포스터',
        stepLabel: isMyUpload ? '내 포스터 제작' : '모둠 포스터 제작',
        title: p.title || p.caption || (isMyUpload ? '내가 올린 포스터' : '우리 모둠 포스터'), 
        content: p.caption || p.description || '',
      })
    })

    // 1-4. 시민광장 설문조사 투표 및 사유
    Object.entries(polls).forEach(([pid, p]) => {
      const isPhase1 = pid.startsWith('phase1') || (typeof p?.tag === 'string' && p.tag.includes('시민'))
      if (!isPhase1) return
      const v = p?.votes?.[myStudentId]
      if (!v) return

      const optIdx = parseInt(v.optionId?.replace('opt_', '') || '', 10)
      const opt = p.options?.[optIdx] || p.options?.[v.optionId]
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.id || v.optionId)
      const reason = pollReasons[pid]?.[myStudentId] || ''

      acts.push({
        key: `phase1_poll_${pid}`, phase: 1,
        type: 'poll',
        rawPoll: p,
        icon: '📊', shortTitle: '설문투표',
        stepLabel: '시민 여론조사 투표',
        title: p.question || '시민광장 설문조사',
        content: reason ? `[선택 이유]\n${reason}` : '',
      })
    })

    // 2-1. 후보 등록
    if (myGroupId && candidates[myGroupId]) {
      const c = candidates[myGroupId]
      const candName = c.leaderNickname || c.candidateName
      acts.push({
        key: 'phase2_candidate', phase: 2,
        type: 'candidate',
        candidate: c,
        icon: '🗳️', 
        shortTitle: candName ? `후보: ${candName}` : '후보등록',
        stepLabel: '대통령 후보 등록',
        title: candName ? `대통령 후보 등록 (${candName})` : '대통령 후보 등록',
        content: c.pamphlet ? `[출마선언문]\n${c.pamphlet}` : '대통령 후보 등록 완료',
      })
    }

    // 2-2. 지지 선언문
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`, phase: 2,
        type: 'support',
        icon: '📣', shortTitle: '지지선언',
        stepLabel: '대통령 후보 지지선언문',
        title: '대통령 후보 지지 선언문',
        content: s.content || s.statement || '',
      })
    })

    // 2-3. 선거 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`, phase: 2,
        type: 'article',
        icon: '📰', shortTitle: '선거기사',
        stepLabel: '선거 보도 기사 작성',
        title: a.title || '선거 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 2-4. 대통령 선거 투표 참여
    if (electionVotes[myStudentId]) {
      acts.push({
        key: 'phase2_election', phase: 2,
        type: 'election',
        rawVotes: electionVotes,
        icon: '🗳️', shortTitle: '대선투표',
        stepLabel: '대통령 선거 투표',
        title: '대통령 선거 투표 참여',
        content: '대한민국 제1대 대통령 선거 투표에 참여하였습니다.',
      })
    }

    // 2-5. 공유 뉴스 기사 (type: news인 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type !== 'news') return
      acts.push({
        key: `phase2_news_${id}`, phase: 2,
        type: 'link',
        link: l,
        icon: '🔗', shortTitle: '뉴스공유',
        stepLabel: '선거 관련 뉴스 공유',
        title: l.title || '공유한 뉴스기사',
        content: l.summary ? `[요약]\n${l.summary}` : '',
      })
    })

    // 3-1. 입법 법안
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'legislative') return
      const bills = Object.values(unit.bills || {})
      bills.forEach((bill, i) => {
        acts.push({
          key: `phase3_bill_${unitId}_${i}`, phase: 3,
          type: 'bill',
          icon: '🏛️', shortTitle: '제안법안',
          stepLabel: '의회 법안 발의',
          title: bill.title || '입법부 제안 법안',
          content: bill.content || bill.body || '',
        })
      })
    })

    // 3-2. 행정 정책
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'executive') return
      acts.push({
        key: `phase3_executive_${unitId}`, phase: 3,
        type: 'policy',
        icon: '🏢', shortTitle: '행정정책',
        stepLabel: '행정부 국정 정책 수립',
        title: unit.ministryName || '행정부 정책 수립',
        content: `[수립 정책]\n${unit.policyDraft || unit.finalPolicy || ''}`,
      })
    })

    // 3-3. 사법 활동
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'judicial') return
      acts.push({
        key: `phase3_judicial_${unitId}`, phase: 3,
        type: 'judicial',
        icon: '⚖️', shortTitle: '사법활동',
        stepLabel: '사법부 재판/활동',
        title: unit.role ? `사법부 활동 (${unit.role})` : '사법부 재판/활동',
        content: unit.submission || unit.verdict || '',
      })
    })

    // 3-4. 국정 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 3) return
      acts.push({
        key: `phase3_article_${id}`, phase: 3,
        type: 'article',
        icon: '📰', shortTitle: '국정기사',
        stepLabel: '국정 기사 보도',
        title: a.title || '국정 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 3-5. 법안 투표 참여
    Object.entries(billVotes).forEach(([bid, votes]) => {
      if (votes && votes[myStudentId]) {
        let billTitle = bid
        for (const unit of Object.values(branchData)) {
          if (unit.type === 'legislative' && unit.bills) {
            const matched = Object.values(unit.bills).find(b => b.title && b.title.includes(bid) || b.content && b.content.includes(bid))
            if (matched) { billTitle = matched.title; break }
          }
        }
        acts.push({
          key: `phase3_billvote_${bid}`, phase: 3,
          type: 'billvote',
          rawVotes: votes,
          icon: '🏛️', shortTitle: '법안투표',
          stepLabel: '국회 법안 의결 투표',
          title: `법안 표결 참여: ${billTitle}`,
          content: '',
        })
      }
    })

    // 3-6. 배심원 재판 투표 참여
    Object.entries(juryVotes).forEach(([cid, votes]) => {
      if (votes && votes[myStudentId]) {
        acts.push({
          key: `phase3_juryvote_${cid}`, phase: 3,
          type: 'juryvote',
          rawVotes: votes,
          icon: '⚖️', shortTitle: '재판투표',
          stepLabel: '사법 재판 배심원 투표',
          title: `배심원 재판 표결 참여: ${cid}`,
          content: '',
        })
      }
    })

    // 3-7. 공유 영상/캔바 링크 (type이 news가 아닌 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type === 'news') return
      acts.push({
        key: `phase3_video_${id}`, phase: 3,
        type: 'link',
        link: l,
        icon: '🎬', shortTitle: '영상공유',
        stepLabel: '영상/캔바 자료 공유',
        title: l.title || '공유한 영상/캔바',
        content: '',
      })
    })

    // ── 3-8. 토론 여론조사 및 토론 활동 ──
    Object.entries(debateSessions).forEach(([sid, s]) => {
      const preVote = s.stancePoll?.pre?.votes?.[myStudentId]
      const postVote = s.stancePoll?.post?.votes?.[myStudentId]
      const phase = Number(s.phase) || 3

      if (preVote || postVote) {
        acts.push({
          key: `debate_poll_${sid}`,
          phase,
          type: 'debate_poll',
          debateSession: s,
          icon: '📊',
          shortTitle: '토론설문',
          stepLabel: '토론 여론조사(사전/사후)',
          title: s.title || '토론 여론조사',
          content: s.topic ? `토론 주제: ${s.topic}` : '',
        })
      }

      // ── 3-8-1. 토론전 카드 (Debate Prep Card) ──
      const cardsObj = s.prepCards || {}
      Object.entries(cardsObj).forEach(([cid, card]) => {
        if (card.studentId === myStudentId) {
          acts.push({
            key: `debate_prep_${sid}_${card.studentId}`,
            phase,
            type: 'debate_prep',
            icon: '📇',
            shortTitle: '토론전카드',
            stepLabel: '토론 준비 카드 작성',
            title: `토론 준비 카드 (${s.title || '토론'})`,
            debateCard: card,
            debateSession: s,
            content: `[입장] ${card.stance || '미정'}\n\n[주장/판단] ${card.mainClaim || ''}\n\n[근거] ${card.evidence || ''}\n\n[반박] ${card.rebuttal || ''}\n\n[대응] ${card.counterRebuttal || ''}`
          })
        }
      })

      // ── 3-8-2. 평가단 최종 종합 평가 (Debate Final Evaluation) ──
      const finalEvals = s.finalEvaluations || {}
      const myEval = finalEvals[myStudentId]
      if (myEval) {
        acts.push({
          key: `debate_final_eval_${sid}_${myStudentId}`,
          phase,
          type: 'debate_final_eval',
          icon: '⚖️',
          shortTitle: '최종평가',
          stepLabel: '평가단 최종 종합 평가 제출',
          title: `평가단 최종 종합 평가 (${s.title || '토론'})`,
          content: typeof myEval === 'string' ? myEval : myEval.content || myEval.comment || '',
        })
      }
    })

    // ── 4. 내가 작성한 댓글 및 동료 평가 ──
    Object.entries(commentsMap).forEach(([cid, c]) => {
      if (c.authorStudentId !== myStudentId || c.parentId) return
      
      let targetTitle = '원글 자료'
      let phase = 1
      
      if (c.targetType === 'poster') {
        const p = posters[c.targetId]
        targetTitle = p ? `🖼️ 포스터: "${p.title || p.caption || '제목 없음'}"` : '🖼️ 친구의 포스터'
        phase = p?.phase || 1
      } else if (c.targetType === 'article') {
        const a = articles[c.targetId]
        targetTitle = a ? `📰 기사: "${a.title || '제목 없음'}"` : '📰 친구의 기사'
        phase = a?.phase || 2
      } else if (c.targetType === 'bill') {
        let matchedTitle = ''
        for (const unit of Object.values(branchData)) {
          if (unit.type === 'legislative' && unit.bills) {
            const bill = Object.values(unit.bills).find(b => b.id === c.targetId || b.title === c.targetId)
            if (bill) { matchedTitle = bill.title; break }
          }
        }
        targetTitle = matchedTitle ? `🏛️ 법안: "${matchedTitle}"` : `🏛️ 의회 법안: ${c.targetId}`
        phase = 3
      } else if (c.targetType === 'trial') {
        targetTitle = `⚖️ 사법 재판: ${c.targetId}`
        phase = 3
      } else if (c.targetType === 'policy') {
        const unit = branchData[c.targetId]
        targetTitle = unit ? `🏢 행정 정책: "${unit.ministryName || '정책'}"` : `🏢 행정 정책`
        phase = 3
      } else if (c.targetType === 'reflection') {
        const r = reflectionsMap[c.targetId]
        targetTitle = r ? `📝 정리글: "${r.title || '친구의 글'}"` : '📝 친구의 정리글'
        phase = 4
      }

      acts.push({
        key: `comment_${cid}`,
        phase,
        type: 'comment',
        icon: '💬',
        shortTitle: '댓글 작성',
        stepLabel: '동료 평가 및 댓글 작성',
        title: `내가 작성한 댓글`,
        targetTitle,
        commentBody: c.body,
        ratings: c.ratings || {},
        targetType: c.targetType,
        content: `내가 남긴 동료 평가 의견:\n"${c.body}"`
      })
    })

    // 여정별 단계 번호 및 전역 발자취 번호 동적 부여
    const phaseCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const processedActs = acts.map((act, idx) => {
      phaseCounts[act.phase]++
      return {
        ...act,
        phaseStep: phaseCounts[act.phase],
        globalStep: idx + 1
      }
    })

    return processedActs
  }, [essays, posters, candidates, supports, articles, branchData, links, polls, pollReasons, electionVotes, billVotes, juryVotes, debateSessions, commentsMap, reflectionsMap, myStudentId, myGroupId, groups])

  // 별점 준 활동 전체 — 별점 높은 순으로 정렬(개수 제한 없음, 스크롤로 표시)
  const topActivities = useMemo(() => {
    const scored = activities.filter((act) => (ratings[act.key] || 0) > 0)
    return scored
      .map((act) => ({
        ...act,
        score: ratings[act.key],
      }))
      .sort((a, b) => b.score - a.score)
  }, [activities, ratings])

  const handleSave = async () => {
    setError('')
    const url = formatCanvaEmbedUrl(canvaInput.trim())
    if (!url) { setError('Canva URL 또는 embed 코드를 입력해 주세요.'); return }
    setSaving(true)
    try {
      await updateAt(roomCode, `students/${myStudentId}`, { canvaCardNewsUrl: url })
      setSavedUrl(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleExpand = (key) => {
    setExpandedKey(prev => prev === key ? null : key)
  }

  return (
    <div className="space-y-5">
      {/* 안내 헤더 */}
      <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-4 border border-violet-200 shadow-xs">
        <h2 className="font-black text-violet-800 text-lg mb-1">🎨 캔바 카드뉴스 제작</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          1단계에서 별점 준 활동들을 중심으로 Canva에서 카드뉴스를 만들어요.
          나의 여정을 멋진 카드뉴스로 정리해 보세요!
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 왼쪽: 참고 활동 (아코디언 구조) */}
        <div className="space-y-4">
          {topActivities.length > 0 && (
            <div className="bg-yellow-50/70 border border-yellow-200 rounded-2xl p-4 space-y-3">
              <div className="border-b border-yellow-250 pb-2">
                <h3 className="font-black text-yellow-800 text-sm">⭐ 내가 높이 평가한 활동들 <span className="text-[10px] font-bold text-yellow-600">({topActivities.length}개 · 별점순)</span></h3>
                <p className="text-[10px] text-gray-500 mt-0.5">별점 높은 순으로 모두 표시됩니다. 제목을 누르면 내용이 펼쳐져요. 스크롤하며 참고하세요!</p>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {topActivities.map((act) => {
                  const isExpanded = expandedKey === act.key
                  return (
                    <div key={act.key} className="border border-yellow-200 rounded-xl overflow-hidden bg-white/90 shadow-2xs transition-all">
                      {/* 아코디언 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(act.key)}
                        className="w-full text-left px-4 py-3 font-semibold text-gray-800 hover:bg-yellow-50/50 transition flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-amber-500 text-xs shrink-0 select-none">
                            {'★'.repeat(act.score)}
                          </span>
                          <span className="text-[9px] font-black shrink-0 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/50">
                            발자취 {act.globalStep}
                          </span>
                          <span className="text-xs font-black truncate">{act.title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 font-black">
                          {isExpanded ? '접기 ▴' : '펼치기 ▾'}
                        </span>
                      </button>

                      {/* 아코디언 내용부 */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2.5 border-t border-yellow-100 bg-amber-50/15 space-y-3 animate-in fade-in duration-200 text-xs text-gray-700">
                          
                          {/* 1. 포스터 렌더링 */}
                          {act.type === 'poster' && act.poster && (
                            <div className="rounded-xl overflow-hidden shadow-xs border bg-white aspect-[4/3] relative max-w-sm">
                              <PosterMedia 
                                poster={act.poster} 
                                className="w-full h-full"
                              />
                            </div>
                          )}

                          {/* 2. 링크 (영상/캔바) - 캔바 링크는 무조건 임베드 렌더링, 링크 주소 노출 없음 */}
                          {act.type === 'link' && act.link && (() => {
                            const l = act.link
                            const isCanva = l.url && l.url.toLowerCase().includes('canva.')
                            return (
                              <div className="space-y-2">
                                {isCanva ? (
                                  <div className="rounded-xl overflow-hidden border shadow-xs bg-slate-50 aspect-[4/3] relative max-w-sm">
                                    <iframe
                                      src={formatCanvaEmbedUrl(l.url)}
                                      loading="lazy"
                                      allowFullScreen
                                      allow="fullscreen; autoplay"
                                      className="absolute inset-0 w-full h-full border-0"
                                      title="카드뉴스 캔바 임베드"
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-white/90 p-3 rounded-lg border text-xs shadow-2xs">
                                    <span className="font-bold text-indigo-700">🔗 외부 자료 링크: </span>
                                    <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                                      {l.url} ↗
                                    </a>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* 3. 후보등록 상세 */}
                          {act.type === 'candidate' && act.candidate && (() => {
                            const c = act.candidate
                            return (
                              <div className="space-y-3 max-w-sm">
                                <div className="bg-white p-3 rounded-xl border border-rose-100 flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px]">
                                    기호 {c.candidateNumber ?? c.leaderNumber ?? '?'}번
                                  </span>
                                  <h4 className="font-black text-gray-800 text-xs">👑 {c.leaderNickname || c.candidateName} 후보</h4>
                                </div>
                                {c.pamphlet && <p className="italic text-gray-600 bg-white p-3 rounded-xl border border-gray-150">"{c.pamphlet}"</p>}
                                {c.posterCanvaUrl && (
                                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border bg-slate-50 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.posterCanvaUrl)} className="absolute inset-0 w-full h-full border-0" title="선거 포스터" />
                                  </div>
                                )}
                                {c.canvaUrl && (
                                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden border bg-slate-50 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.canvaUrl)} className="absolute inset-0 w-full h-full border-0" title="공약 카드뉴스" />
                                  </div>
                                )}
                                {c.videoCanvaUrl && (
                                  <div className="relative aspect-video rounded-xl overflow-hidden border bg-slate-900 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.videoCanvaUrl)} className="absolute inset-0 w-full h-full border-0" title="홍보영상" />
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* 4. 일반 설문조사 결과 그래프 */}
                          {act.type === 'poll' && act.rawPoll && (() => {
                            const p = act.rawPoll
                            const votes = p.votes || {}
                            const totalVotes = Object.keys(votes).length
                            const normalizedOptions = (p.options || []).map((opt, index) => {
                              if (typeof opt === 'string') return { id: `opt_${index}`, label: opt }
                              return { id: opt.id || `opt_${index}`, label: opt.label || opt.id || '' }
                            })
                            const counts = {}
                            Object.values(votes).forEach((v) => {
                              if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
                            })
                            const myVoteId = votes[myStudentId]?.optionId

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">📊 여론조사 집계 (총 {totalVotes}명)</p>
                                <div className="space-y-2">
                                  {normalizedOptions.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myVoteId === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50/70 border-indigo-300 font-bold' : 'bg-gray-50/40'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                          <span>{isMine && '✨ '}{o.label}</span>
                                          <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div className={`h-full ${isMine ? 'bg-indigo-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 5. 토론 사전/사후 비교 결과 그래프 */}
                          {act.type === 'debate_poll' && act.debateSession && (() => {
                            const s = act.debateSession
                            const prePoll = s.stancePoll?.pre || {}
                            const postPoll = s.stancePoll?.post || {}
                            const options = ['찬성', '반대', '중립']
                            const preVotes = prePoll.votes || {}
                            const postVotes = postPoll.votes || {}
                            const preTotal = Object.keys(preVotes).length
                            const postTotal = Object.keys(postVotes).length
                            const preCounts = { '찬성': 0, '반대': 0, '중립': 0 }
                            const postCounts = { '찬성': 0, '반대': 0, '중립': 0 }

                            Object.values(preVotes).forEach(v => { if (v?.option && preCounts[v.option] !== undefined) preCounts[v.option]++ })
                            Object.values(postVotes).forEach(v => { if (v?.option && postCounts[v.option] !== undefined) postCounts[v.option]++ })

                            const myPre = preVotes[myStudentId]?.option
                            const myPost = postVotes[myStudentId]?.option

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-3 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🗳️ 토론 전/후 내 선택 변화</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div>
                                    <p className="font-bold mb-1 text-gray-500">토론 전 (총 {preTotal}명)</p>
                                    {options.map(o => {
                                      const cnt = preCounts[o] || 0
                                      const pct = preTotal ? Math.round((cnt / preTotal) * 100) : 0
                                      const isMine = myPre === o
                                      return (
                                        <div key={o} className={`p-1.5 rounded border mb-1 ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                          <div className="flex justify-between">{o} <span>{pct}%</span></div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div>
                                    <p className="font-bold mb-1 text-gray-500">토론 후 (총 {postTotal}명)</p>
                                    {options.map(o => {
                                      const cnt = postCounts[o] || 0
                                      const pct = postTotal ? Math.round((cnt / postTotal) * 100) : 0
                                      const isMine = myPost === o
                                      return (
                                        <div key={o} className={`p-1.5 rounded border mb-1 ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                          <div className="flex justify-between">{o} <span>{pct}%</span></div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* 6. 대통령 선거 득표 그래프 */}
                          {act.type === 'election' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const totalVotes = Object.keys(votes).length
                            const ranks = calculateRanks(candidatesMap || {}, votes)
                            const myVoteGroupId = votes[myStudentId]?.candidateGroupId

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🏆 선거 개표 현황 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {ranks.map((r) => {
                                    const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
                                    const isMine = myVoteGroupId === r.groupId
                                    return (
                                      <div key={r.groupId} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{r.candidateNumber}번 {r.leaderNickname} 후보</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 7. 법안 투표 그래프 */}
                          {act.type === 'billvote' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const myChoice = votes[myStudentId]
                            const totalVotes = Object.keys(votes).length
                            const counts = { pro: 0, con: 0, abstain: 0 }
                            Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++ })
                            const opts = [
                              { id: 'pro', label: '찬성', color: 'bg-emerald-500' },
                              { id: 'con', label: '반대', color: 'bg-rose-500' },
                              { id: 'abstain', label: '기권', color: 'bg-gray-400' }
                            ]

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🏛️ 의회 법안 투표 결과 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {opts.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myChoice === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{o.label}</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className={`h-full ${o.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 8. 배심원 재판 투표 그래프 */}
                          {act.type === 'juryvote' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const myChoice = votes[myStudentId]
                            const totalVotes = Object.keys(votes).length
                            const counts = { pro: 0, con: 0 }
                            Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++ })
                            const opts = [
                              { id: 'pro', label: '유죄', color: 'bg-amber-500' },
                              { id: 'con', label: '무죄', color: 'bg-sky-500' }
                            ]

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">⚖️ 배심원 판결 결과 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {opts.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myChoice === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{o.label}</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className={`h-full ${o.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 9. 내가 작성한 댓글 및 동료 평가 상세 피드 */}
                          {act.type === 'comment' && (
                            <div className="space-y-2.5 max-w-sm">
                              {/* 1. 작성한 댓글 내용 (가장 위) */}
                              <div className="p-3 bg-white rounded-xl border leading-relaxed text-xs shadow-2xs">
                                <span className="font-bold text-indigo-700 block mb-1">✍️ 내가 작성한 댓글</span>
                                <p className="font-semibold text-gray-800">"${act.commentBody}"</p>
                              </div>

                              {/* 2. 원글보기 (작은 라벨 + 원글 제목) */}
                              <div className="bg-white p-3 rounded-xl border shadow-2xs">
                                <span className="text-[9px] font-bold text-gray-400 block mb-1">🔍 원글보기</span>
                                <p className="font-extrabold text-indigo-900 text-xs">${act.targetTitle}</p>
                              </div>
                              
                              {/* 3. 3축 평가 점수 */}
                              {act.ratings && Object.keys(act.ratings).length > 0 && (
                                <div className="bg-white p-3 rounded-xl border shadow-2xs space-y-1.5">
                                  <p className="text-[9px] font-bold text-gray-400 block">📊 내가 매긴 3축 평가 점수</p>
                                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                    {Object.entries(act.ratings).map(([axis, val]) => {
                                      const labelMap = { relevance: '공익/정확', feasibility: '실행/배려', logic: '타당/설득' }
                                      return (
                                        <div key={axis} className="bg-slate-50 border rounded-lg p-1.5">
                                          <span className="block text-[8px] text-gray-400 font-bold mb-0.5">{labelMap[axis] || axis}</span>
                                          <span className="font-mono text-amber-550 font-black">★ {val}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 9-1. 토론 준비 카드 */}
                          {act.type === 'debate_prep' && act.debateCard && (() => {
                            const card = act.debateCard
                            const s = act.debateSession
                            const config = getDebatePrepCardConfig(s)
                            const fields = config?.fields || {}
                            return (
                              <div className="space-y-2 max-w-sm">
                                <div className="bg-white border rounded-xl p-3 shadow-2xs flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-black uppercase">
                                      입장: {card.stance || '미정'}
                                    </span>
                                  </div>
                                  {Object.entries(fields).map(([key, f]) => {
                                    const val = card[key]
                                    if (!val) return null
                                    return (
                                      <div key={key} className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                                        <span className="block text-[8px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">💡 {f.label}</span>
                                        <p className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap">{val}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 9-2. 평가단 최종 종합 평가 */}
                          {act.type === 'debate_final_eval' && (
                            <div className="bg-white border rounded-xl p-3 shadow-2xs space-y-2 max-w-sm">
                              <span className="text-[9px] font-bold text-gray-400 block border-b pb-0.5">⚖️ 평가단 최종 종합 평가</span>
                              <p className="text-[10px] text-gray-750 leading-relaxed whitespace-pre-wrap">
                                {act.content}
                              </p>
                            </div>
                          )}

                          {/* 10. 본문 텍스트 콘텐츠 */}
                          {act.content && act.type !== 'comment' && act.type !== 'debate_prep' && act.type !== 'debate_final_eval' && (
                            <div className="p-3 bg-white rounded-xl border leading-relaxed text-xs whitespace-pre-wrap shadow-2xs">
                              {act.content}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {topActivities.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm text-gray-500 text-center shadow-inner">
              1단계에서 별점을 주면 여기에 활동이 표시돼요.
            </div>
          )}


        </div>

                {/* 오른쪽: URL 제출 + 미리보기 */}
        <div className="space-y-3">
          {/* 캔바 바로가기 + 제작 가이드 */}
          <div className="bg-white border border-violet-100 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-black text-violet-850 text-sm">📋 카드뉴스 제작 가이드</h3>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>Canva 프레젠테이션(16:9) 또는 인스타그램 정사각형 템플릿 추천</li>
              <li>슬라이드 1: 제목 (나의 여정 이야기)</li>
              <li>슬라이드 2~4: 1·2·3여정 각 하이라이트 한 장씩</li>
              <li>슬라이드 마지막: 나의 다짐 한 줄</li>
            </ul>
            <a
              href="https://www.canva.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold text-sm hover:opacity-90 transition shadow-sm cursor-pointer"
            >
              🎨 Canva 열기
            </a>
          </div>
          <div className="bg-white border border-violet-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="border-b border-violet-100 pb-2.5">
              <button
                type="button"
                onClick={() => setShowEmbedGuide(!showEmbedGuide)}
                className="w-full text-left flex items-center justify-between hover:bg-violet-50/50 p-2 rounded-xl transition cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-violet-850 text-sm flex items-center gap-1.5">
                    <span>📎</span> 캔바 임베드 코드 제출
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-bold leading-relaxed">
                    갤러리워크에서 카드뉴스가 바로 보이게 제출하기
                  </p>
                </div>
                <span className="text-[10px] text-violet-600 font-bold shrink-0 bg-violet-50 border border-violet-200/50 px-2.5 py-1 rounded-full shadow-2xs">
                  {showEmbedGuide ? '안내 접기 ▴' : '방법 보기 ▾'}
                </span>
              </button>
            </div>

            {/* 임베드 코드 복사 방법 가이드 (접기/펼치기) */}
            {showEmbedGuide && (
              <div className="bg-violet-50/50 rounded-xl p-3.5 border border-violet-100 text-xs space-y-2.5 text-violet-950 font-medium animate-in fade-in duration-200">
                <p className="font-bold text-violet-850 text-[11px] flex items-center gap-1">
                  <span>💡</span> 캔바에서 임베드 코드 복사하는 방법:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-gray-700 pl-0.5">
                  <li>Canva 편집 화면 우측 상단의 <strong className="text-violet-850">우측 [공유]</strong> 버튼을 누릅니다.</li>
                  <li>아래 메뉴 중 <strong className="text-violet-850">[더 보기](점 3개 •••)</strong>를 누릅니다.</li>
                  <li>목록에서 <strong className="text-violet-850">[임베디드]</strong> 아이콘( <code className="bg-violet-100 text-violet-800 px-1 py-0.2 rounded font-mono font-bold text-[9px]">&lt;/&gt;</code> 모양 )을 선택합니다.</li>
                  <li>활성화 후, <strong className="text-violet-850">‘HTML 임베디드 코드’</strong>의 <strong className="text-violet-900">[복사]</strong>를 누릅니다.</li>
                </ol>
                <div className="text-[10px] bg-amber-50/70 text-amber-800 border border-amber-200/50 p-2.5 rounded-lg leading-relaxed mt-1 flex items-start gap-1 font-semibold">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>
                    브라우저 주소창의 링크(canva.com/design/...)나 일반 [링크 복사] 주소는 갤러리에서 정상 동작하지 않을 수 있으니 꼭 <strong>임베디드 코드</strong>를 붙여넣어 주세요!
                  </span>
                </div>
              </div>
            )}

                        <div className="space-y-1.5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">✍️ 임베디드 코드 입력</span>
              <textarea
                value={canvaInput}
                onChange={(e) => setCanvaInput(e.target.value)}
                rows={4}
                placeholder="<iframe ...> 로 시작하는 Canva 임베디드 코드를 통째로 붙여넣어 주세요."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none shadow-inner bg-slate-50/50 leading-relaxed font-mono"
              />
            </div>

            {error && <p className="text-xs text-red-650 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
            {saved && <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">✓ 성공적으로 저장되었습니다!</p>}
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-sm hover:from-violet-750 hover:to-indigo-750 disabled:opacity-50 transition-all transform active:scale-[0.98] shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{saving ? '저장 중...' : savedUrl ? '✏️ 임베디드 코드 수정' : '제출하기'}</span>
            </button>
          </div>

          {/* 미리보기 (Canva Embed iframe 형식으로만 풀 렌더링) */}
          {savedUrl && (
            <div className="bg-white border border-violet-200 rounded-2xl overflow-hidden shadow-sm">
              <p className="text-xs font-black text-violet-700 px-4 py-2.5 border-b border-violet-100 bg-violet-50/50">
                제출 완료된 카드뉴스 미리보기
              </p>
              <div className="aspect-video relative bg-slate-50">
                <iframe
                  src={savedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  title="캔바 카드뉴스 미리보기"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {savedUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-sm text-emerald-700 font-black">
            ✓ 카드뉴스가 완벽하게 제출되었습니다 — 이제 3단계에서 정리글을 작성해 보세요!
          </p>
        </div>
      )}
    </div>
  )
}
