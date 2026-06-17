import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import SubmissionDetailModal from './SubmissionDetailModal'
import PosterMedia from '../phase1/PosterMedia'

const EMPTY_STUDENTS = {}

/**
 * 교사 대시보드용 — 학생별 활동 현황 모니터.
 *
 * 컬럼: 접속 + 번호·이름 / 모둠 / 댓글(N/M) / 투표 / 기사 / 정리글 /
 *       포스터 / 뉴스기사 / 영상(승인) / 슬로건
 */
function StudentActivityMonitor() {
  const roomCode = useGameStore((s) => s.roomCode)
  const students = useGameStore((s) => s.students) ?? EMPTY_STUDENTS
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const removeStudent = useGameStore((s) => s.removeStudent)
  const [deleting, setDeleting] = useState(null)

  const [comments, setComments] = useState({})
  const [electionVotes, setElectionVotes] = useState({})
  const [billVotes, setBillVotes] = useState({})
  const [juryVotes, setJuryVotes] = useState({})
  const [articles, setArticles] = useState({})
  const [reflections, setReflections] = useState({})
  const [posters, setPosters] = useState({})
  const [links, setLinks] = useState({})
  const [polls, setPolls] = useState({})
  const [pollReasons, setPollReasons] = useState({})
  const [detailView, setDetailView] = useState(null) // { type, sid, title }

  // 5초 tick — lastSeen 기반 online 판정이 시간 흐름에 따라 자연스럽게 갱신되도록
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'comments', (d) => setComments(d || {})),
      subscribe(roomCode, 'electionVotes', (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'billVotes', (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes', (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'articles', (d) => setArticles(d || {})),
      subscribe(roomCode, 'reflections', (d) => setReflections(d || {})),
      subscribe(roomCode, 'posters', (d) => setPosters(d || {})),
      subscribe(roomCode, 'links', (d) => setLinks(d || {})),
      subscribe(roomCode, 'polls', (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons', (d) => setPollReasons(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  // 댓글 '써야 할 전체' 수 = 시민단체 수 - 1 (자기 모둠 제외)
  const topicCount = Object.keys(config?.topics || {}).length
  const commentTarget = Math.max(0, topicCount - 1)

  const rows = useMemo(() => {
    const list = Object.entries(students).map(([sid, s]) => {
      const groupId =
        s?.groupId ||
        Object.entries(groups).find(([, g]) => g?.members?.[sid])?.[0] ||
        null
      const groupName = groupId ? groups[groupId]?.name : null

      // 투표 사유 (Phase 1 기준)
      const myReason = pollReasons['phase1_poll1']?.[sid] || ''

      // 댓글 — 다른 모둠 자료에 단 댓글 (포스터·기사 등 모두 합산)
      const myComments = Object.values(comments).filter(
        (c) => c?.authorStudentId === sid,
      )
      const commentCount = myComments.length

      // 투표 — 선거(1) + 법안(N) + 배심원(N) + 일반 폴(N) 누적
      const electionV = electionVotes[sid] ? 1 : 0
      let billV = 0
      for (const byBill of Object.values(billVotes)) {
        if (byBill && byBill[sid]) billV += 1
      }
      let juryV = 0
      for (const byCase of Object.values(juryVotes)) {
        if (byCase && byCase[sid]) juryV += 1
      }
      let pollV = 0
      for (const p of Object.values(polls)) {
        if (p?.votes && p.votes[sid]) pollV += 1
      }
      const voteTotal = electionV + billV + juryV + pollV

      // 기사 작성 (승인 + 대기 모두 카운트)
      const myArticles = Object.values(articles).filter(
        (a) => a?.authorStudentId === sid,
      )
      const articleCount = myArticles.length

      // 정리글 (본인 작성 1개)
      const myRefl = Object.values(reflections).find(
        (r) => r?.authorStudentId === sid,
      )
      const reflectionCount = myRefl ? 1 : 0

      // 포스터 — 본인 직접 업로드 카운트
      const posterCount = Object.values(posters).filter(
        (p) => p?.authorStudentId === sid,
      ).length

      // 뉴스기사 — 본인이 올린 type='news' 링크
      const myLinks = Object.values(links).filter(
        (l) => l?.submitterStudentId === sid,
      )
      const newsCount = myLinks.filter((l) => l?.type === 'news').length

      // 영상 — 본인이 올린 영상·캔바 중 '승인' 상태
      const videoApprovedCount = myLinks.filter(
        (l) => l?.type !== 'news' && l?.status === 'approved',
      ).length

      // 슬로건 — 본인이 작성한 슬로건 (모든 모둠의 slogans 순회)
      let sloganCount = 0
      for (const g of Object.values(groups || {})) {
        const ss = g?.slogans
        if (!ss) continue
        for (const s of Object.values(ss)) {
          if (s?.authorStudentId === sid) sloganCount += 1
        }
      }

      return {
        sid,
        number: s?.number || 0,
        nickname: s?.nickname || '',
        // lastSeen 기반 effective online — 45초 이내 하트비트가 있으면 온라인 판정.
        // onDisconnect race 로 isOnline=false 가 잠시 깜빡여도 lastSeen 이 최근이면 온라인 유지.
        isOnline: !!s?.isOnline || (!!s?.lastSeen && (Date.now() - Number(s.lastSeen) < 45000)),
        isTabActive: s?.isTabActive !== false,
        sessionFinishedAtPhase: s?.sessionFinishedAtPhase || null,
        groupName,
        commentCount,
        voteTotal,
        articleCount,
        reflectionCount,
        posterCount,
        newsCount,
        videoApprovedCount,
        sloganCount,

        // 역할 정보 [Antigravity]
        // 역할 정보 [Antigravity]
        groupRole: groupId ? groups[groupId]?.kind : null, 
        sessionRole: (function() {
          const g = groupId ? groups[groupId] : null
          if (!g || !g.sessionRoles) return null
          // 현재 세션에 해당하는 역할을 찾거나, 가장 최근 세션 역할을 찾음
          const sessionKey = Object.keys(g.sessionRoles).find(k => k.includes(String(config?.currentSession || ''))) 
            || Object.keys(g.sessionRoles).pop()
          const roleKey = g.sessionRoles[sessionKey]?.[sid]
          if (!roleKey) return null
          
          // 역할 이름 찾기 (config 나 DEFAULT_ROLES 에서)
          const kind = g.kind || 'legislative'
          const roles = config?.roles?.[kind] || []
          const r = roles.find(ro => ro.key === roleKey)
          return r ? `${r.emoji} ${r.label}` : roleKey
        })()
      }
    })
    list.sort((a, b) => (a.number || 0) - (b.number || 0))
    return list
  }, [
    students, groups, comments, electionVotes, billVotes, juryVotes,
    articles, reflections, posters, links, polls, config?.currentSession, config?.roles
  ])

  const onlineCount = rows.filter((r) => r.isOnline).length

  // 상세 분석 모달용 상태 [Antigravity]
  const [selectedSid, setSelectedSid] = useState(null)
  const detailStudent = selectedSid ? students[selectedSid] : null
  const detailRow = useMemo(() => rows.find(r => r.sid === selectedSid), [rows, selectedSid])

  const studentDetails = useMemo(() => {
    if (!selectedSid) return null
    const sid = selectedSid
    
    return {
      articles: Object.values(articles).filter(a => a?.authorStudentId === sid),
      posters: Object.values(posters).filter(p => p?.authorStudentId === sid),
      essays: Object.values(reflections).filter(r => r?.authorStudentId === sid), // 기획상 reflections가 정리글/주장하는글
      links: Object.values(links).filter(l => l?.submitterStudentId === sid),
      polls: Object.entries(polls).map(([pid, p]) => {
        const v = p?.votes?.[sid]
        if (!v) return null
        // ID 기반 인덱스 파싱 (opt_0 -> 0) [Antigravity]
        const optIdx = parseInt(v.optionId.replace('opt_', ''), 10)
        const opt = p.options?.[optIdx] || p.options?.[v.optionId]
        const label = typeof opt === 'string' ? opt : (opt?.label || opt?.id || v.optionId)
        return {
          id: pid,
          tag: typeof p.tag === 'string' ? p.tag : p.tag?.label,
          question: typeof p.question === 'string' ? p.question : p.question?.label,
          choice: label,
          reason: pollReasons[pid]?.[sid] || ''
        }
      }).filter(Boolean),
      election: electionVotes[sid] ? '투표 완료' : '미투표',
      bills: Object.entries(billVotes).map(([bid, votes]) => {
        if (votes && votes[sid]) return { id: bid, status: '투표 완료' }
        return null
      }).filter(Boolean),
    }
  }, [selectedSid, articles, posters, reflections, links, polls, pollReasons, electionVotes, billVotes])

  return (
    <div className="relative">
      <header className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
        <h3 className="font-bold text-indigo-800">학생 활동 모니터</h3>
        <span className="text-xs text-gray-500">
          접속 <strong className="text-emerald-600">{onlineCount}</strong>/
          {rows.length} · 실시간 (닉네임 클릭 시 상세 분석)
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          아직 입장한 학생이 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-1 text-left whitespace-nowrap">학생</th>
                <th className="px-2 py-1 text-left whitespace-nowrap">모둠</th>
                <th className="px-2 py-1 text-left whitespace-nowrap">역할</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">댓글</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">투표</th>
                <th className="px-2 py-1 text-center whitespace-nowrap" title="사전/사후 투표 변화 사유">사유</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">기사</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">정리글</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">포스터</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">뉴스기사</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">영상</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">슬로건</th>
                <th className="px-2 py-1 text-center whitespace-nowrap">삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.sid}
                  className={`border-t border-gray-100 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                  } ${r.isOnline ? '' : 'text-gray-400'} hover:bg-indigo-50/50 transition-colors cursor-pointer`}
                  onClick={() => setSelectedSid(r.sid)}
                >
                  <td className="px-2 py-1 whitespace-nowrap">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${
                        r.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
                      }`}
                      title={r.isOnline ? '접속 중' : '연결 끊김 (오프라인)'}
                    />
                    <span className="font-mono">{r.number}</span>{' '}
                    <span className="font-bold text-indigo-600 hover:underline">{r.nickname}</span>
                    {r.isOnline && !r.isTabActive && (
                      <span className="ml-1 text-[10px] grayscale" title="현재 다른 탭을 보고 있음 (딴짓 감지)">💤</span>
                    )}
                    {!r.isOnline && (
                      <span className="ml-1 text-[10px] text-rose-500 font-semibold" title="이 학생의 인터넷 연결이 끊겼습니다">
                        오프라인
                      </span>
                    )}
                    {r.sessionFinishedAtPhase && (
                      <span className="ml-1 text-emerald-600">✓</span>
                    )}
                  </td>
                  <td className="px-2 py-1 truncate max-w-[80px]">
                    {r.groupName || '—'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {r.groupRole ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        r.groupRole === 'legislative' ? 'bg-blue-100 text-blue-700' :
                        r.groupRole === 'executive' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {r.groupRole === 'legislative' ? '입법' :
                         r.groupRole === 'executive' ? '행정' : '사법'}
                        {r.sessionRole && <span className="ml-1 text-[9px] opacity-70">({r.sessionRole})</span>}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'comment', sid: r.sid, title: `${r.nickname} 학생의 댓글` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.commentCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.commentCount}
                    </button>
                    {commentTarget > 0 && (
                      <span className="text-gray-400">/{commentTarget}</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'vote', sid: r.sid, title: `${r.nickname} 학생의 투표 내역` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.voteTotal === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.voteTotal}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-center">
                    {r.myReason ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'pollReason', sid: r.sid, title: `${r.nickname} 학생의 생각 사유` }) }}
                        className="cursor-pointer text-blue-500 hover:scale-110 transition-transform" 
                        title={r.myReason}
                      >
                        💬
                      </button>
                    ) : (
                      <span className="text-gray-200">💬</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'article', sid: r.sid, title: `${r.nickname} 학생의 기사` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.articleCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.articleCount}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'reflection', sid: r.sid, title: `${r.nickname} 학생의 정리글` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.reflectionCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.reflectionCount}/1
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'poster', sid: r.sid, title: `${r.nickname} 학생의 포스터` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.posterCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.posterCount}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'news', sid: r.sid, title: `${r.nickname} 학생의 뉴스기사` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.newsCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.newsCount}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'video', sid: r.sid, title: `${r.nickname} 학생의 영상` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.videoApprovedCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.videoApprovedCount}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailView({ type: 'slogan', sid: r.sid, title: `${r.nickname} 학생의 슬로건` }) }}
                      className={`hover:underline hover:text-indigo-600 transition-colors ${r.sloganCount === 0 ? 'text-gray-300' : 'font-bold'}`}
                    >
                      {r.sloganCount}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={deleting === r.sid}
                      onClick={async () => {
                        if (!window.confirm(`${r.number}번 ${r.nickname} 학생을 삭제하시겠습니까?\n모둠 멤버십도 함께 제거됩니다.`)) return
                        setDeleting(r.sid)
                        try {
                          await removeStudent(r.sid)
                        } finally {
                          setDeleting(null)
                        }
                      }}
                      className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs px-1 py-0.5 rounded hover:bg-red-50 transition-colors"
                      title="학생 삭제"
                    >
                      {deleting === r.sid ? '…' : '✕'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 상세 분석 모달 [Antigravity] */}
      {selectedSid && studentDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in duration-200">
            <header className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">{detailStudent?.number}번 {detailStudent?.nickname} 학생 분석</h2>
                    {detailRow?.groupRole && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border border-white/30 ${
                        detailRow.groupRole === 'legislative' ? 'bg-blue-500' :
                        detailRow.groupRole === 'executive' ? 'bg-rose-500' : 'bg-amber-500'
                      }`}>
                        {detailRow.groupRole === 'legislative' ? '입법부' :
                         detailRow.groupRole === 'executive' ? '행정부' : '사법부'}
                        {detailRow.sessionRole && <span className="ml-1 opacity-80">({detailRow.sessionRole})</span>}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/70 font-medium">실시간 활동 데이터 기반 상세 리포트</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSid(null)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all active:scale-95"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* 1. 기사 내역 */}
              <section>
                <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                  📰 작성한 기사 <span className="text-indigo-400 text-sm">{studentDetails.articles.length}</span>
                </h3>
                {studentDetails.articles.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">작성된 기사가 없습니다.</p>
                ) : (
                  <div className="space-y-4">
                    {studentDetails.articles.map((a, idx) => (
                      <div key={idx} className="bg-white border-2 border-indigo-50 rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
                        <h4 className="font-bold text-indigo-700 mb-2">{a.headline}</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase">{a.perspective || '기본'}</span>
                          <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 2. 투표 내역 및 사유 */}
              <section>
                <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                  🗳️ 투표 및 생각 정리 <span className="text-indigo-400 text-sm">{studentDetails.polls.length}</span>
                </h3>
                {studentDetails.polls.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">투표 내역이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentDetails.polls.map((p, idx) => (
                      <div key={idx} className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded uppercase">{p.tag}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 mb-3">{p.question}</p>
                        <div className="bg-white rounded-xl p-3 border border-indigo-100 mb-3">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">선택 항목</p>
                          <p className="text-sm font-black text-indigo-700">{p.choice}</p>
                        </div>
                        {p.reason && (
                          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <p className="text-[10px] text-amber-600 uppercase font-bold mb-1">💡 변화/유지 사유</p>
                            <p className="text-xs text-amber-900 font-medium leading-relaxed">{p.reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* 3. 포스터 */}
                <section>
                  <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                    🖼️ 업로드 포스터 <span className="text-indigo-400 text-sm">{studentDetails.posters.length}</span>
                  </h3>
                  {studentDetails.posters.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">업로드된 포스터가 없습니다.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {studentDetails.posters.map((p, idx) => (
                        <div key={idx} className="group relative rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                          <PosterMedia poster={p} className="w-full h-32" imageClassName="w-full h-32 object-cover transition-transform group-hover:scale-110" />
                          {p.imageUrl && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a href={p.imageUrl} target="_blank" rel="noreferrer" className="bg-white text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black">원본보기</a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 4. 주장하는 글 / 링크 */}
                <section className="space-y-10">
                  <div>
                    <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                      ✍️ 주장하는 글 <span className="text-indigo-400 text-sm">{studentDetails.essays.length}</span>
                    </h3>
                    {studentDetails.essays.length === 0 ? (
                      <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">작성된 글이 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {studentDetails.essays.map((e, idx) => (
                          <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{e.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                      🔗 공유 링크 <span className="text-indigo-400 text-sm">{studentDetails.links.length}</span>
                    </h3>
                    {studentDetails.links.length === 0 ? (
                      <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">공유된 링크가 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentDetails.links.map((l, idx) => (
                          <a 
                            key={idx} 
                            href={l.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="block bg-blue-50 border border-blue-100 rounded-xl p-3 hover:bg-blue-100 transition-colors"
                          >
                            <p className="text-xs font-bold text-blue-700 truncate">{l.title || l.url}</p>
                            <p className="text-[10px] text-blue-400 truncate">{l.url}</p>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <footer className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setSelectedSid(null)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full font-black text-sm transition-all"
              >
                닫기
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 전용 항목 열람 모달 [Antigravity] */}
      {detailView && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setDetailView(null)}
          title={detailView.title}
          items={(function() {
            const sid = detailView.sid
            switch (detailView.type) {
              case 'comment': return Object.values(comments).filter(c => c.authorStudentId === sid)
              case 'vote': {
                const vs = []
                if (electionVotes[sid]) vs.push({ type: '선거', label: '대통령 선거 투표' })
                Object.entries(billVotes).forEach(([bid, v]) => { if (v?.[sid]) vs.push({ type: '법안', label: `법안 투표 (${bid})` }) })
                Object.entries(juryVotes).forEach(([cid, v]) => { if (v?.[sid]) vs.push({ type: '배심원', label: `재판 배심원 투표 (${cid})` }) })
                return vs
              }
              case 'pollReason': return Object.entries(pollReasons).map(([pid, reasons]) => {
                if (reasons?.[sid]) return { id: pid, reason: reasons[sid] }
                return null
              }).filter(Boolean)
              case 'article': return Object.values(articles).filter(a => a.authorStudentId === sid)
              case 'reflection': return Object.values(reflections).filter(r => r.authorStudentId === sid)
              case 'poster': return Object.values(posters).filter(p => p.authorStudentId === sid)
              case 'news': return Object.values(links).filter(l => l.submitterStudentId === sid && l.type === 'news')
              case 'video': return Object.values(links).filter(l => l.submitterStudentId === sid && l.type !== 'news')
              case 'slogan': {
                const sls = []
                Object.values(groups).forEach(g => {
                  Object.values(g?.slogans || {}).forEach(s => {
                    if (s.authorStudentId === sid) sls.push({ ...s, groupName: g.name })
                  })
                })
                return sls
              }
              default: return []
            }
          })()}
          renderItem={(item) => {
            switch (detailView.type) {
              case 'comment': return <p className="text-sm">{item.body}</p>
              case 'vote': return <p className="text-sm font-bold">{item.label}</p>
              case 'pollReason': return (
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-500 font-bold uppercase">{item.id}</p>
                  <p className="text-sm">{item.reason}</p>
                </div>
              )
              case 'article': return (
                <div className="space-y-2">
                  <h4 className="font-bold text-indigo-700">{item.headline}</h4>
                  <p className="text-sm whitespace-pre-wrap">{item.body}</p>
                </div>
              )
              case 'reflection': return <p className="text-sm whitespace-pre-wrap">{item.body}</p>
              case 'poster': return (
                <div className="space-y-2">
                  <PosterMedia poster={item} className="w-full aspect-[4/3] rounded-xl overflow-hidden" imageClassName="w-full rounded-xl" />
                  <p className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              )
              case 'news':
              case 'video': return (
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-700">{item.title}</h4>
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 break-all">{item.url}</a>
                </div>
              )
              case 'slogan': return (
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-500 font-bold uppercase">{item.groupName}</p>
                  <p className="text-sm font-bold">"{item.text}"</p>
                </div>
              )
              default: return null
            }
          }}
        />
      )}
 
      <p className="mt-2 text-[10px] text-gray-400">
        ● 접속 · ✓ 차시 끝 · 댓글은 다른 모둠 5곳에 작성(자기 모둠 제외) · 영상은 승인된 것만
      </p>
    </div>
  )
}

export default StudentActivityMonitor
