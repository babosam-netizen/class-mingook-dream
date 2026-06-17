import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, pushUnder, updateAt, removeAt } from '../../lib/rtdb-helpers'
import MultiAxisRating from '../shared/MultiAxisRating'

/**
 * 댓글 + 다축 평가
 *
 * props:
 *   targetType: 'poster' | 'article' | ...
 *   targetId: 대상 ID
 *   targetGroupId?: 대상 자료가 속한 모둠 ID (자기 모둠 차단 + 1회 제한 키)
 *   allowReplies?: true 면 각 댓글에 답글(reply) 표시. 답글 작성은 '제안한 모둠'(자기 모둠 자료)만 가능
 *                  (자기 모둠은 새 댓글은 못 달지만, 친구들이 남긴 질문에 답글로 답변 가능. 다른 모둠은 답글을 볼 수만 있음)
 *
 * 규칙:
 *   - 자기 모둠 자료(targetGroupId === myGroupId)면 새 댓글(top-level) 입력 차단
 *   - 한 모둠에 한 학생당 (top-level) 댓글 1개만 작성, 이후엔 ‘수정’ 또는 ‘삭제’
 *   - 답글(parentId 있는 항목)은 위 1회 제한과 무관 — 제안 모둠만 여러 개 작성 가능
 *   - 본인 댓글은 항상 리스트 첫 줄 + 노란 강조
 *   - 한 페이지 2개씩, 좌·우 페이지 이동, 마지막 페이지면 ‘✓ 마지막’ 표시
 */
const PAGE_SIZE = 2
const BILL_RATING_AXES = [
  { key: 'relevance',   full: '🏛️ 공익성',       short: '🏛️ 공익', color: 'bg-rose-500' },
  { key: 'feasibility', full: '🛠️ 실행가능성',   short: '🛠️ 실행', color: 'bg-emerald-500' },
  { key: 'logic',       full: '⚖️ 법적 타당성', short: '⚖️ 타당', color: 'bg-amber-500' },
]
const ARTICLE_RATING_AXES = [
  { key: 'relevance',   full: '✅ 정보가 정확한가?',            short: '✅ 정확', color: 'bg-blue-500' },
  { key: 'feasibility', full: '🤝 여러사람을 배려하는가?',      short: '🤝 배려', color: 'bg-emerald-500' },
  { key: 'logic',       full: '💡 이해하기 쉬운가?',            short: '💡 쉬움', color: 'bg-amber-500' },
]
const VERDICT_RATING_AXES = [
  { key: 'relevance',   full: '🔎 증거와 쟁점을 잘 반영했는가?', short: '🔎 근거', color: 'bg-rose-500' },
  { key: 'feasibility', full: '⚖️ 양쪽 입장을 공정하게 보았는가?', short: '⚖️ 공정', color: 'bg-emerald-500' },
  { key: 'logic',       full: '🧠 결론이 논리적으로 설득되는가?', short: '🧠 설득', color: 'bg-amber-500' },
]
const DEFAULT_RATING_AXES = [
  { key: 'relevance',   label: '주제' },
  { key: 'feasibility', label: '실현' },
  { key: 'logic',       label: '설득' },
]
const BILL_RATING_LABELS = [
  { key: 'relevance',   label: '공익' },
  { key: 'feasibility', label: '실행' },
  { key: 'logic',       label: '타당' },
]
const ARTICLE_RATING_LABELS = [
  { key: 'relevance',   label: '정확' },
  { key: 'feasibility', label: '배려' },
  { key: 'logic',       label: '쉬움' },
]
const VERDICT_RATING_LABELS = [
  { key: 'relevance',   label: '근거' },
  { key: 'feasibility', label: '공정' },
  { key: 'logic',       label: '설득' },
]

function CommentList({ targetType, targetId, targetGroupId, readOnly = false, allowReplies = false, ownerStudentId = null }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const likeThreshold = useGameStore((s) => s.config?.articleRating?.likeThreshold ?? 6)
  const superLikeThreshold = useGameStore((s) => s.config?.articleRating?.superLikeThreshold ?? 9)

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 소유자(자기 자료) 판정 — 모둠 자료면 모둠으로, 개인 자료(정리글 등)면 ownerStudentId로 판정
  const isOwner = ownerStudentId
    ? ownerStudentId === myStudentId
    : (!!targetGroupId && targetGroupId === myGroupId)
  const isMyGroup = isOwner

  const [allComments, setAllComments] = useState({})
  const [body, setBody] = useState('')
  const [rating, setRating] = useState({ logic: 0, feasibility: 0, relevance: 0 })
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(false)
  const isBillTarget = targetType === 'bill'
  const isArticleTarget = targetType === 'article'
  const isVerdictTarget = targetType === 'verdict'
  const ratingAxes = isBillTarget
    ? BILL_RATING_AXES
    : isArticleTarget
    ? ARTICLE_RATING_AXES
    : isVerdictTarget
    ? VERDICT_RATING_AXES
    : undefined
  const ratingLabels = isBillTarget
    ? BILL_RATING_LABELS
    : isArticleTarget
    ? ARTICLE_RATING_LABELS
    : isVerdictTarget
    ? VERDICT_RATING_LABELS
    : DEFAULT_RATING_AXES

  useEffect(() => {
    const unsub = subscribe(roomCode, 'comments', (data) => {
      setAllComments(data || {})
    })
    return () => unsub?.()
  }, [roomCode])

  // 댓글 정렬: 본인 (top-level) 댓글이 있으면 첫 번째, 그 외는 최신순.
  // parentId 가 있는 항목은 답글(reply) — top-level 목록에서 제외하고 부모별로 묶는다.
  const { myComment, comments, repliesByParent } = useMemo(() => {
    const list = Object.entries(allComments)
      .map(([id, c]) => ({ id, ...c }))
      .filter((c) => c.targetType === targetType && c.targetId === targetId)
    const tops = list.filter((c) => !c.parentId)
    const byParent = {}
    for (const r of list) {
      if (!r.parentId) continue
      if (!byParent[r.parentId]) byParent[r.parentId] = []
      byParent[r.parentId].push(r)
    }
    Object.values(byParent).forEach((arr) => arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)))
    const mine = tops.find((c) => c.authorStudentId === myStudentId) || null
    const others = tops
      .filter((c) => c.authorStudentId !== myStudentId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return { myComment: mine, comments: mine ? [mine, ...others] : others, repliesByParent: byParent }
  }, [allComments, targetType, targetId, myStudentId])

  // 수정 시작 시 폼에 기존 값 채움
  const startEdit = () => {
    if (!myComment) return
    setBody(myComment.body || '')
    setRating(myComment.ratings || { logic: 0, feasibility: 0, relevance: 0 })
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setBody('')
    setRating({ logic: 0, feasibility: 0, relevance: 0 })
  }

  const totalPages = Math.max(1, Math.ceil(comments.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const start = safePage * PAGE_SIZE
  const pageItems = comments.slice(start, start + PAGE_SIZE)
  const isLast = safePage >= totalPages - 1
  const isFirst = safePage <= 0

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    try {
      if (editing && myComment) {
        // 수정
        await updateAt(roomCode, `comments/${myComment.id}`, {
          body: body.trim(),
          ratings: rating,
          updatedAt: Date.now(),
        })
        setEditing(false)
      } else {
        // 신규
        await pushUnder(roomCode, 'comments', {
          targetType,
          targetId,
          targetGroupId: targetGroupId || null,
          authorStudentId: myStudentId,
          authorNumber: myNumber,
          authorNickname: myNickname,
          body: body.trim(),
          ratings: rating,
        })
      }
      setBody('')
      setRating({ logic: 0, feasibility: 0, relevance: 0 })
      setPage(0)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!myComment) return
    if (!confirm('내 댓글을 삭제할까요?')) return
    await removeAt(roomCode, `comments/${myComment.id}`)
    cancelEdit()
  }

  // ── 답글(reply) — allowReplies 일 때만. 자기 모둠도 답글은 가능 ──
  const [replyOpenFor, setReplyOpenFor] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  const submitReply = async (parentId) => {
    if (!replyBody.trim() || replyBusy) return
    setReplyBusy(true)
    try {
      await pushUnder(roomCode, 'comments', {
        targetType,
        targetId,
        targetGroupId: targetGroupId || null,
        parentId,
        kind: 'reply',
        authorStudentId: myStudentId,
        authorNumber: myNumber,
        authorNickname: myNickname,
        body: replyBody.trim(),
      })
      setReplyBody('')
      setReplyOpenFor(null)
    } finally {
      setReplyBusy(false)
    }
  }
  const deleteReply = async (replyId) => {
    if (!confirm('내 답글을 삭제할까요?')) return
    await removeAt(roomCode, `comments/${replyId}`)
  }
  // 답글은 '제안한 모둠'(자기 모둠 자료)만 작성 가능 — 다른 모둠은 답글을 볼 수만 있음
  const canReply = allowReplies && !readOnly && role === 'student' && !!myStudentId && isMyGroup

  // 입력 폼 표시 조건:
  // - 학생만
  // - 자기 모둠이 아닐 때
  // - 아직 댓글 없을 때(신규) 또는 수정 모드일 때
  // - readOnly 모드 아닐 때 (교사 미리보기 등)
  const showForm = !readOnly && role === 'student' && !isMyGroup && (!myComment || editing)

  return (
    <div>
      {role === 'student' && isMyGroup && (
        <p className="mb-2 text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded">
          🚫 자기 모둠 자료에는 새 댓글·평가를 달 수 없어요.
          {allowReplies
            ? ' 대신 친구들이 남긴 댓글에 👇 답글로 답변할 수 있어요.'
            : ' 다른 모둠을 평가해 주세요.'}
        </p>
      )}

      {/* 입력 / 수정 폼 */}
      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-3 bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2"
        >
          {isVerdictTarget && (
            <div className="rounded-lg bg-white border border-violet-100 px-3 py-2">
              <p className="text-[11px] font-bold text-violet-700 mb-1">3축 평가</p>
              <MultiAxisRating value={rating} onChange={setRating} compact axes={ratingAxes} />
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              editing
                ? '내 댓글 수정 중...'
                : targetType === 'bill'
                ? '이 법안에 대한 의견을 남겨 보세요 (공익성·실행가능성·법적 타당성 별점도 함께)'
                : targetType === 'article'
                ? '이 기사에 대한 의견을 남겨 보세요'
                : targetType === 'reflection'
                ? '이 정리글에 공감 의견을 남겨 보세요'
                : targetType === 'verdict'
                ? '이 판결문에 대한 평가, 댓글, 질문을 남겨 보세요'
                : '이 모둠 포스터에 대한 의견을 남겨 보세요'
            }
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            rows={2}
            maxLength={150}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {!isVerdictTarget && <MultiAxisRating value={rating} onChange={setRating} compact axes={ratingAxes} />}
            <div className="flex gap-1">
              {editing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? '...' : editing ? '수정 저장' : '댓글 달기'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 이미 댓글 작성 + 수정 모드 아닌 경우 안내(수정 버튼) */}
      {role === 'student' && !isMyGroup && myComment && !editing && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-emerald-700">✓ 이미 댓글을 달았어요.</span>
          <button
            onClick={startEdit}
            className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
          >
            삭제
          </button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">
          아직 댓글이 없어요.{!isMyGroup && ' 첫 의견을 남겨 보세요.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {pageItems.map((c) => {
              const mine = c.authorStudentId === myStudentId
              const r = c.ratings || {}
              const ratingTotal = isArticleTarget
                ? (r.relevance || 0) + (r.feasibility || 0) + (r.logic || 0)
                : null
              const likeLevel = ratingTotal === null ? 0 : ratingTotal >= superLikeThreshold ? 2 : ratingTotal >= likeThreshold ? 1 : 0
              return (
                <li
                  key={c.id}
                  className="py-1.5 text-sm leading-snug"
                >
                  {mine && <span className="mr-1">✓</span>}
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {ratingLabels.map(({ key, label }) => `${label}${r[key] || 0}`).join(' ')}
                  </span>
                  {likeLevel >= 2 && (
                    <span className="ml-1 text-[11px] font-bold text-pink-600 bg-pink-50 border border-pink-200 px-1.5 py-0.5 rounded-full">👍👍</span>
                  )}
                  {likeLevel === 1 && (
                    <span className="ml-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">👍</span>
                  )}
                  <span className="text-gray-400 mx-1">-</span>
                  <span className="text-gray-800">{c.body}</span>
                  <span className="text-gray-400 text-xs ml-1">
                    ({c.authorNumber}번 {c.authorNickname}
                    {c.updatedAt && ' · 수정됨'})
                  </span>

                  {/* 답글(reply) — allowReplies 일 때만 노출 */}
                  {allowReplies && (
                    <div className="mt-1 ml-4 space-y-1">
                      {(repliesByParent[c.id] || []).map((rp) => (
                        <div key={rp.id} className="flex items-start gap-1 text-[12px]">
                          <span className="text-gray-300 mt-0.5">↳</span>
                          <span className="flex-1 leading-snug">
                            <span className="text-gray-800">{rp.body}</span>
                            <span className="text-gray-400 text-[11px] ml-1">
                              ({rp.authorNumber}번 {rp.authorNickname})
                            </span>
                            {rp.authorStudentId === myStudentId && !readOnly && (
                              <button
                                onClick={() => deleteReply(rp.id)}
                                className="ml-1 text-rose-400 hover:text-rose-600 text-[10px]"
                              >
                                삭제
                              </button>
                            )}
                          </span>
                        </div>
                      ))}

                      {canReply && (
                        replyOpenFor === c.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-300 text-[12px]">↳</span>
                            <input
                              type="text"
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitReply(c.id) } }}
                              placeholder="질문에 답글로 답변하기"
                              maxLength={200}
                              autoFocus
                              className="flex-1 text-[12px] px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button
                              onClick={() => submitReply(c.id)}
                              disabled={replyBusy || !replyBody.trim()}
                              className="px-2 py-1 text-[11px] rounded bg-indigo-600 text-white font-semibold disabled:opacity-50"
                            >
                              답글
                            </button>
                            <button
                              onClick={() => { setReplyOpenFor(null); setReplyBody('') }}
                              className="px-1.5 py-1 text-[11px] rounded bg-gray-200 text-gray-700"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReplyOpenFor(c.id); setReplyBody('') }}
                            className="text-[11px] text-indigo-600 hover:underline"
                          >
                            + 답글
                          </button>
                        )
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={isFirst}
                className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← 이전
              </button>
              <span className="text-gray-500 tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={isLast}
                className={`px-3 py-1 rounded-lg ${
                  isLast
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isLast ? '✓ 마지막' : '다음 →'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CommentList
