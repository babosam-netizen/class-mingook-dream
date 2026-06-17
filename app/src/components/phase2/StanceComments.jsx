import { useEffect, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, pushUnder, removeAt, setAt } from '../../lib/rtdb-helpers'

/**
 * 후보별 한줄 의견 — 찬성·반대·질문·의견 4종 + 공약 평가(3기준) + 캠프 답변
 */

const STANCES = [
  { key: 'question', label: '질문',  emoji: '❓', cls: 'bg-violet-50 border-violet-200', headerCls: 'text-violet-800 border-violet-100', dotCls: 'bg-violet-400', activeCls: 'bg-violet-600 text-white', inactiveCls: 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50' },
  { key: 'opinion',  label: '의견',  emoji: '💬', cls: 'bg-blue-50 border-blue-200',   headerCls: 'text-blue-800 border-blue-100',   dotCls: 'bg-blue-400',   activeCls: 'bg-blue-600 text-white',   inactiveCls: 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50' },
  { key: 'pro',      label: '찬성',  emoji: '👍', cls: 'bg-emerald-50',                headerCls: 'text-emerald-800 border-emerald-100', dotCls: 'bg-emerald-400', activeCls: 'bg-emerald-600 text-white', inactiveCls: 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  { key: 'con',      label: '반대',  emoji: '👎', cls: 'bg-rose-50',                   headerCls: 'text-rose-800 border-rose-100',   dotCls: 'bg-rose-400',   activeCls: 'bg-rose-600 text-white',   inactiveCls: 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50' },
]

const RATING_CRITERIA = [
  { key: 'relevance',   label: '최우선과제\n관련성', emoji: '🎯', color: 'violet' },
  { key: 'feasibility', label: '실현\n가능성',       emoji: '🔧', color: 'blue'   },
  { key: 'validity',    label: '타당성',              emoji: '⚖️', color: 'amber'  },
]

const SCORE_COLORS = {
  violet: { star: 'text-violet-500', bg: 'bg-violet-50', label: 'text-violet-700', bar: 'bg-violet-400' },
  blue:   { star: 'text-blue-500',   bg: 'bg-blue-50',   label: 'text-blue-700',   bar: 'bg-blue-400'   },
  amber:  { star: 'text-amber-500',  bg: 'bg-amber-50',  label: 'text-amber-700',  bar: 'bg-amber-400'  },
}

function StarSelector({ value, onChange, color = 'violet' }) {
  const cls = SCORE_COLORS[color]
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className={`text-lg leading-none transition-transform hover:scale-125 ${n <= value ? cls.star : 'text-gray-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function avgRating(ratingsObj, key) {
  const vals = Object.values(ratingsObj || {}).map((r) => r?.[key]).filter((v) => v > 0)
  if (!vals.length) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function StanceComments({ targetType, targetId }) {
  const roomCode    = useGameStore((s) => s.roomCode)
  const role        = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber    = useGameStore((s) => s.myNumber)
  const myNickname  = useGameStore((s) => s.myNickname)
  const students    = useGameStore((s) => s.students)

  // 내 모둠 ID — 후보 캠프 여부 판별용
  const myGroupId = myStudentId ? students?.[myStudentId]?.groupId || null : null
  // 이 후보 카드의 캠프 구성원인지
  const isMyCamp = targetType === 'candidate' && myGroupId === targetId

  const [allComments, setAllComments]   = useState({})
  const [ratingsMap, setRatingsMap]     = useState({})
  const [stance, setStance]             = useState('pro')
  const [body, setBody]                 = useState('')
  const [busy, setBusy]                 = useState(false)
  const textareaRef = useRef(null)

  // 평가 draft
  const [ratingDraft, setRatingDraft]   = useState({ relevance: 0, feasibility: 0, validity: 0 })
  const [ratingBusy, setRatingBusy]     = useState(false)
  const [ratingOpen, setRatingOpen]     = useState(false)

  useEffect(() => {
    const unsub = subscribe(roomCode, 'comments', (data) => setAllComments(data || {}))
    return () => unsub?.()
  }, [roomCode])

  // 후보 카드일 때만 평가 구독
  useEffect(() => {
    if (targetType !== 'candidate') return
    const unsub = subscribe(roomCode, `candidateRatings/${targetId}`, (data) => setRatingsMap(data || {}))
    return () => unsub?.()
  }, [roomCode, targetType, targetId])

  // 내 기존 평가 불러오기
  useEffect(() => {
    if (!myStudentId || !ratingsMap[myStudentId]) return
    const r = ratingsMap[myStudentId]
    setRatingDraft({ relevance: r.relevance || 0, feasibility: r.feasibility || 0, validity: r.validity || 0 })
  }, [ratingsMap, myStudentId])

  const likeComment = async (commentId, isLiked) => {
    if (!myStudentId) return
    if (isLiked) {
      await removeAt(roomCode, `comments/${commentId}/likes/${myStudentId}`)
    } else {
      await setAt(roomCode, `comments/${commentId}/likes/${myStudentId}`, Date.now())
    }
  }

  const likeCount = (c) => Object.keys(c.likes || {}).length

  const list = Object.entries(allComments)
    .map(([id, c]) => ({ id, ...c }))
    .filter((c) => c.targetType === targetType && c.targetId === targetId && c.stance)
    .sort((a, b) => {
      const la = likeCount(a), lb = likeCount(b)
      if (lb !== la) return lb - la
      return (b.createdAt || 0) - (a.createdAt || 0)
    })

  const byStance = (key) => list.filter((c) => c.stance === key)
  const proCount  = byStance('pro').length
  const conCount  = byStance('con').length
  const qCount    = byStance('question').length
  const opCount   = byStance('opinion').length

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    try {
      await pushUnder(roomCode, 'comments', {
        targetType,
        targetId,
        authorStudentId: myStudentId,
        authorNumber:    myNumber,
        authorNickname:  myNickname,
        body: body.trim(),
        stance,
      })
      setBody('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } finally {
      setBusy(false)
    }
  }

  const onBodyChange = (e) => {
    setBody(e.target.value)
    e.currentTarget.style.height = 'auto'
    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 96)}px`
  }

  const onDelete = async (id) => {
    if (!confirm('이 의견을 삭제할까요?')) return
    try {
      await removeAt(roomCode, `comments/${id}`)
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  const submitRating = async () => {
    if (!myStudentId || ratingBusy) return
    const { relevance, feasibility, validity } = ratingDraft
    if (!relevance && !feasibility && !validity) { alert('별점을 하나 이상 선택해 주세요.'); return }
    setRatingBusy(true)
    try {
      await setAt(roomCode, `candidateRatings/${targetId}/${myStudentId}`, {
        relevance:   relevance || 0,
        feasibility: feasibility || 0,
        validity:    validity || 0,
        ratedAt: Date.now(),
      })
      setRatingOpen(false)
    } catch (err) {
      alert('평가 저장 실패: ' + err.message)
    } finally {
      setRatingBusy(false)
    }
  }

  const ratingCount  = Object.keys(ratingsMap).length
  const avgRelevance   = avgRating(ratingsMap, 'relevance')
  const avgFeasibility = avgRating(ratingsMap, 'feasibility')
  const avgValidity    = avgRating(ratingsMap, 'validity')
  const totalAvg = ratingCount > 0 ? ((avgRelevance + avgFeasibility + avgValidity) / 3) : 0
  const myRating = myStudentId ? ratingsMap[myStudentId] : null

  const currentStance = STANCES.find((s) => s.key === stance) || STANCES[2]

  return (
    <div className="space-y-2 rounded-xl border border-white/70 bg-white/60 p-2">

      {/* ── 공약 평가 섹션 (후보 카드 전용) ── */}
      {targetType === 'candidate' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
          {/* 헤더 — 평균 점수 요약 */}
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
            onClick={() => role === 'student' && setRatingOpen((v) => !v)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-amber-800">📊 공약 평가</span>
              {ratingCount > 0 ? (
                <div className="flex items-center gap-2">
                  {RATING_CRITERIA.map((c) => {
                    const avg = c.key === 'relevance' ? avgRelevance : c.key === 'feasibility' ? avgFeasibility : avgValidity
                    const cls = SCORE_COLORS[c.color]
                    return (
                      <span key={c.key} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls.bg} ${cls.label}`}>
                        {c.emoji} {avg.toFixed(1)}
                      </span>
                    )
                  })}
                  <span className="text-[10px] text-amber-500">({ratingCount}명)</span>
                </div>
              ) : (
                <span className="text-[10px] text-amber-500">아직 평가 없음</span>
              )}
            </div>
            {role === 'student' && (
              <span className="text-[10px] text-amber-600 font-semibold shrink-0">
                {myRating ? '✏️ 수정' : '+ 평가하기'} {ratingOpen ? '▲' : '▼'}
              </span>
            )}
          </div>

          {/* 평가 바 (항상 표시) */}
          {ratingCount > 0 && !ratingOpen && (
            <div className="px-3 pb-2 grid grid-cols-3 gap-2">
              {RATING_CRITERIA.map((c) => {
                const avg = c.key === 'relevance' ? avgRelevance : c.key === 'feasibility' ? avgFeasibility : avgValidity
                const cls = SCORE_COLORS[c.color]
                return (
                  <div key={c.key}>
                    <p className="text-[9px] text-gray-500 mb-0.5 whitespace-pre-line leading-tight">{c.label}</p>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${(avg / 5) * 100}%` }} />
                    </div>
                    <p className={`text-[10px] font-bold mt-0.5 ${cls.label}`}>{avg.toFixed(1)}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 별점 입력 폼 */}
          {role === 'student' && ratingOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-amber-200/50 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {RATING_CRITERIA.map((c) => {
                  const cls = SCORE_COLORS[c.color]
                  return (
                    <div key={c.key} className={`${cls.bg} rounded-xl p-2 text-center`}>
                      <p className="text-[10px] font-bold text-gray-600 mb-1 whitespace-pre-line leading-tight">{c.label}</p>
                      <StarSelector
                        value={ratingDraft[c.key]}
                        onChange={(v) => setRatingDraft((d) => ({ ...d, [c.key]: v }))}
                        color={c.color}
                      />
                      <p className={`text-[11px] font-black mt-0.5 ${cls.label}`}>
                        {ratingDraft[c.key] > 0 ? `${ratingDraft[c.key]}점` : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={submitRating}
                disabled={ratingBusy || (!ratingDraft.relevance && !ratingDraft.feasibility && !ratingDraft.validity)}
                className="w-full py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {ratingBusy ? '저장 중...' : myRating ? '평가 수정 저장' : '평가 제출'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 헤더 카운트 */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="font-bold text-rose-800">찬반·질문·의견</p>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-semibold">❓질문 {qCount}</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">💬의견 {opCount}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">👍찬성 {proCount}</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">👎반대 {conCount}</span>
        </div>
      </div>

      {/* 질문·의견 — 풀너비 1열 */}
      {(qCount > 0 || opCount > 0) && (
        <div className="space-y-1">
          {qCount > 0 && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 space-y-1">
              <p className="text-[11px] font-bold text-violet-800 border-b border-violet-100 pb-1">❓ 질문 ({qCount})</p>
              <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                {byStance('question').map((c) => (
                  <CommentItem key={c.id} comment={c} myStudentId={myStudentId} isMyCamp={isMyCamp} onDelete={onDelete} onLike={likeComment} roomCode={roomCode} myNumber={myNumber} myNickname={myNickname} />
                ))}
              </ul>
            </div>
          )}
          {opCount > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-2 space-y-1">
              <p className="text-[11px] font-bold text-blue-800 border-b border-blue-100 pb-1">💬 의견 ({opCount})</p>
              <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                {byStance('opinion').map((c) => (
                  <CommentItem key={c.id} comment={c} myStudentId={myStudentId} isMyCamp={isMyCamp} onDelete={onDelete} onLike={likeComment} roomCode={roomCode} myNumber={myNumber} myNickname={myNickname} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 찬성 / 반대 — 2열 */}
      <div className="grid grid-cols-2 gap-4 mt-1">
        <div className="space-y-1">
          <header className="flex items-center gap-1.5 mb-1 px-1 border-b border-emerald-100 pb-1">
            <p className="text-[11px] font-bold text-emerald-800">👍 찬성</p>
            <span className="text-[9px] text-emerald-500 font-medium">{proCount}</span>
          </header>
          <ul className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {proCount === 0 ? (
              <li className="text-[10px] text-gray-300 py-4 text-center">의견이 없습니다.</li>
            ) : (
              byStance('pro').map((c) => (
                <CommentItem key={c.id} comment={c} myStudentId={myStudentId} isMyCamp={isMyCamp} onDelete={onDelete} onLike={likeComment} roomCode={roomCode} myNumber={myNumber} myNickname={myNickname} />
              ))
            )}
          </ul>
        </div>
        <div className="space-y-1">
          <header className="flex items-center gap-1.5 mb-1 px-1 border-b border-rose-100 pb-1">
            <p className="text-[11px] font-bold text-rose-800">👎 반대</p>
            <span className="text-[9px] text-rose-500 font-medium">{conCount}</span>
          </header>
          <ul className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {conCount === 0 ? (
              <li className="text-[10px] text-gray-300 py-4 text-center">의견이 없습니다.</li>
            ) : (
              byStance('con').map((c) => (
                <CommentItem key={c.id} comment={c} myStudentId={myStudentId} isMyCamp={isMyCamp} onDelete={onDelete} onLike={likeComment} roomCode={roomCode} myNumber={myNumber} myNickname={myNickname} />
              ))
            )}
          </ul>
        </div>
      </div>

      {/* 입력 폼 */}
      {role === 'student' && (
        <form onSubmit={onSubmit} className="mt-3 pt-3 border-t border-white/40 space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {STANCES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStance(s.key)}
                className={`py-1.5 text-[10px] rounded-lg font-bold transition-all ${
                  stance === s.key
                    ? `${s.activeCls} shadow-md scale-105`
                    : `border ${s.inactiveCls} opacity-70`
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 items-end">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={onBodyChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={
                stance === 'question' ? '궁금한 점을 질문해 보세요...' :
                stance === 'opinion'  ? '자유롭게 의견을 남겨 보세요...' :
                stance === 'pro'      ? '찬성 의견의 근거를 짧게 입력하세요...' :
                                        '반대 의견의 근거를 짧게 입력하세요...'
              }
              maxLength={80}
              rows={1}
              className={`flex-1 text-xs px-3 py-2.5 rounded-xl border-2 transition-colors focus:outline-none focus:ring-4 resize-none overflow-y-auto leading-snug max-h-24 shadow-inner ${
                stance === 'pro'      ? 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100' :
                stance === 'con'      ? 'border-rose-200 focus:border-rose-500 focus:ring-rose-100' :
                stance === 'question' ? 'border-violet-200 focus:border-violet-500 focus:ring-violet-100' :
                                        'border-blue-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className={`shrink-0 h-[42px] px-4 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 shadow-sm ${currentStance.activeCls}`}
            >
              등록
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function CommentItem({ comment: c, myStudentId, isMyCamp, onDelete, onLike, roomCode, myNumber, myNickname }) {
  const mine = c.authorStudentId === myStudentId
  const likes = c.likes || {}
  const lc = Object.keys(likes).length
  const iLiked = myStudentId ? !!likes[myStudentId] : false
  const stanceDot = {
    pro:      'bg-emerald-400',
    con:      'bg-rose-400',
    question: 'bg-violet-400',
    opinion:  'bg-blue-400',
  }[c.stance] || 'bg-gray-400'

  const replies = c.replies ? Object.entries(c.replies).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) : []

  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  const submitReply = async () => {
    if (!replyBody.trim() || replyBusy) return
    setReplyBusy(true)
    try {
      await pushUnder(roomCode, `comments/${c.id}/replies`, {
        authorStudentId: myStudentId,
        authorNumber:    myNumber,
        authorNickname:  myNickname,
        body: replyBody.trim(),
        createdAt: Date.now(),
      })
      setReplyBody('')
      setReplyOpen(false)
    } catch (err) {
      alert('답변 등록 실패: ' + err.message)
    } finally {
      setReplyBusy(false)
    }
  }

  const deleteReply = async (replyId) => {
    if (!confirm('이 답변을 삭제할까요?')) return
    try {
      await removeAt(roomCode, `comments/${c.id}/replies/${replyId}`)
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  return (
    <li className="py-1.5 border-b border-dotted border-gray-200/50 last:border-0">
      {/* 댓글 본문 */}
      <div className="flex items-start gap-1.5 text-[11px] hover:bg-gray-50/30 transition-colors">
        <span className={`mt-1.5 shrink-0 w-1 h-1 rounded-full ${stanceDot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-gray-700 leading-snug break-words">{c.body}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-400 font-medium">{c.authorNumber}번</span>
            <button
              type="button"
              onClick={() => onLike?.(c.id, iLiked)}
              className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all ${
                iLiked ? 'bg-rose-100 text-rose-600' : 'text-gray-400 hover:text-rose-400 hover:bg-rose-50'
              }`}
              title={iLiked ? '좋아요 취소' : '좋아요'}
            >
              ❤️ {lc > 0 ? lc : ''}
            </button>
            {/* 캠프 답변 버튼 — 질문·의견에만 */}
            {isMyCamp && (c.stance === 'question' || c.stance === 'opinion') && (
              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="text-[10px] text-violet-500 hover:text-violet-700 font-bold px-1 transition-colors"
                title="후보 캠프 답변"
              >
                {replyOpen ? '취소' : '💬 답변'}
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="text-rose-300 hover:text-rose-600 font-black text-[10px] px-1 transition-colors leading-none"
                title="삭제"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 캠프 답변 목록 */}
      {replies.length > 0 && (
        <ul className="ml-4 mt-1 space-y-1">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-1.5 bg-violet-50 rounded-lg px-2 py-1 text-[10px]">
              <span className="text-violet-500 shrink-0">↳</span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-violet-700 mr-1">후보캠프 {r.authorNumber}번</span>
                <span className="text-gray-700">{r.body}</span>
              </div>
              {r.authorStudentId === myStudentId && (
                <button
                  type="button"
                  onClick={() => deleteReply(r.id)}
                  className="shrink-0 text-rose-300 hover:text-rose-600 font-black leading-none"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 답변 입력 */}
      {isMyCamp && replyOpen && (
        <div className="ml-4 mt-1 flex gap-1">
          <input
            type="text"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitReply() }}
            maxLength={80}
            placeholder="후보 캠프 공식 답변을 입력하세요..."
            className="flex-1 text-[11px] px-2 py-1 rounded-lg border border-violet-200 focus:outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={submitReply}
            disabled={replyBusy || !replyBody.trim()}
            className="shrink-0 px-2 py-1 rounded-lg bg-violet-500 text-white text-[10px] font-bold disabled:opacity-50"
          >
            등록
          </button>
        </div>
      )}
    </li>
  )
}

export default StanceComments
