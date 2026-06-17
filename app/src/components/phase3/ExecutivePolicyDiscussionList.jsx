import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, removeAt, subscribe, updateAt, setAt } from '../../lib/rtdb-helpers'
import MultiAxisRating from '../shared/MultiAxisRating'
import { EXECUTIVE_RATING_AXES, formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'
import ExecutivePolicyBudgetDraft from './ExecutivePolicyBudgetDraft'

const STANCES = ['찬성', '반대', '중립']
const BUDGET_OPINIONS = ['유지', '증액', '감액', '재검토']

// 의견(질문)에 대한 답글 스레드. 답글 작성은 해당 정책을 낸 모둠 구성원만 가능.
function PolicyReplyThread({ comment, canReply }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const myNumber = useGameStore((s) => s.myNumber)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const replies = useMemo(() => Object.entries(comment.replies || {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), [comment.replies])

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true)
    try {
      await pushUnder(roomCode, `executivePolicyComments/${comment.id}/replies`, {
        authorStudentId: myStudentId,
        authorNickname: myNickname,
        authorNumber: myNumber,
        body: body.trim(),
      })
      setBody('')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (replyId) => {
    if (!confirm('답글을 삭제할까요?')) return
    await removeAt(roomCode, `executivePolicyComments/${comment.id}/replies/${replyId}`)
  }

  if (replies.length === 0 && !canReply) return null

  return (
    <div className="mt-2 space-y-2 border-l-2 border-violet-100 pl-3">
      {replies.map((r) => (
        <div key={r.id} className="rounded-lg bg-violet-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700">
            <span className="rounded-full bg-violet-200 px-1.5 py-0.5">↳ 부처 답변</span>
            <span className="text-slate-400 font-normal">{r.authorNumber}번 {r.authorNickname}</span>
            {(role === 'teacher' || r.authorStudentId === myStudentId) && (
              <button onClick={() => remove(r.id)} className="ml-auto text-[10px] text-slate-400 underline hover:text-rose-500">삭제</button>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
        </div>
      ))}
      {canReply && (
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            maxLength={300}
            placeholder="이 의견에 답글 달기 (우리 부처만 작성 가능)"
            className="flex-1 resize-none rounded-lg border px-3 py-1.5 text-sm"
          />
          <button disabled={busy || !body.trim()} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">답글</button>
        </form>
      )}
    </div>
  )
}

// 정책에 달린 의견 목록(읽기 전용 표시 + 답글). 평가 입력 폼과 분리해 어디서든 재사용한다.
// (초안 수정 패널 안에서도 같은 목록을 보여 주기 위함)
function PolicyCommentsList({ policyGid, allowReply = false }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const [commentsMap, setCommentsMap] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'executivePolicyComments', (d) => setCommentsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const comments = useMemo(() => Object.entries(commentsMap)
    .map(([id, c]) => ({ id, ...c }))
    .filter((c) => c.policyId === policyGid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [commentsMap, policyGid])
  const stats = STANCES.map((s) => ({ stance: s, count: comments.filter((c) => c.stance === s).length }))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {stats.map((s) => (
          <span key={s.stance} className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{s.stance} {s.count}</span>
        ))}
      </div>
      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="py-3 text-center text-sm text-slate-400">아직 온라인 정책토의 의견이 없습니다.</li>
        ) : comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-white p-3 text-xs shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 flex-wrap font-bold">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{c.stance}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">예산 {c.budgetOpinion}</span>
              {c.suggestedBudget !== null && c.suggestedBudget !== undefined && <span className="text-slate-500">제안 {c.suggestedBudget}억</span>}
              <span className="text-slate-400">{c.authorNumber}번 {c.authorNickname}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.reason}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              관련 {c.ratings?.relevance || 0} · 실행 {c.ratings?.feasibility || 0} · 공익 {c.ratings?.publicGood || 0}
            </p>
            <PolicyReplyThread comment={c} canReply={allowReply} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExecutivePolicyCommentBox({ policy, myGroupId, canEvaluate = true, lockNotice = null }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const myNumber = useGameStore((s) => s.myNumber)
  const [commentsMap, setCommentsMap] = useState({})
  const [stance, setStance] = useState('중립')
  const [budgetOpinion, setBudgetOpinion] = useState('유지')
  const [suggestedBudget, setSuggestedBudget] = useState('')
  const [reason, setReason] = useState('')
  const [ratings, setRatings] = useState({ relevance: 0, feasibility: 0, publicGood: 0 })
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'executivePolicyComments', (d) => setCommentsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const comments = useMemo(() => Object.entries(commentsMap)
    .map(([id, c]) => ({ id, ...c }))
    .filter((c) => c.policyId === policy.gid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [commentsMap, policy.gid])
  const myComment = comments.find((c) => c.authorStudentId === myStudentId)
  const isMine = policy.gid === myGroupId

  const startEdit = () => {
    if (!myComment) return
    setStance(myComment.stance || '중립')
    setBudgetOpinion(myComment.budgetOpinion || '유지')
    setSuggestedBudget(myComment.suggestedBudget ?? '')
    setReason(myComment.reason || '')
    setRatings(myComment.ratings || { relevance: 0, feasibility: 0, publicGood: 0 })
    setEditing(true)
  }

  const reset = () => {
    setStance('중립')
    setBudgetOpinion('유지')
    setSuggestedBudget('')
    setReason('')
    setRatings({ relevance: 0, feasibility: 0, publicGood: 0 })
    setEditing(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!reason.trim() || busy) return

    setBusy(true)
    try {
      const fields = {
        stance,
        budgetOpinion,
        suggestedBudget: suggestedBudget === '' ? null : Number(suggestedBudget) || 0,
        reason: reason.trim(),
        ratings,
        updatedAt: Date.now(),
      }
      if (editing && myComment) {
        // 작성자 본인이 기존 의견 수정 (replies·createdAt 등은 보존)
        await updateAt(roomCode, `executivePolicyComments/${myComment.id}`, fields)
      } else {
        await pushUnder(roomCode, 'executivePolicyComments', {
          policyId: policy.gid,
          targetGroupId: policy.groupId || policy.gid,
          authorStudentId: myStudentId,
          authorNickname: myNickname,
          authorNumber: myNumber,
          ...fields,
        })
      }
      reset()
    } finally {
      setBusy(false)
    }
  }

  const removeComment = async () => {
    if (!myComment || busy) return
    if (!confirm('내가 쓴 의견을 삭제할까요?')) return
    setBusy(true)
    try {
      await removeAt(roomCode, `executivePolicyComments/${myComment.id}`)
      reset()
    } finally {
      setBusy(false)
    }
  }

  const editorFields = (
    <>
      <div className="grid sm:grid-cols-3 gap-2">
        <select value={stance} onChange={(e) => setStance(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
          {STANCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={budgetOpinion} onChange={(e) => setBudgetOpinion(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
          {BUDGET_OPINIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="number" min={0} value={suggestedBudget} onChange={(e) => setSuggestedBudget(e.target.value)} placeholder="제안 예산(억, 선택)" className="rounded-lg border px-2 py-1.5 text-sm" />
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="왜 그렇게 평가했나요? 정책과 예산을 함께 보고 이유를 적어 주세요." className="w-full resize-none rounded-lg border px-3 py-2 text-sm" />
      <MultiAxisRating value={ratings} onChange={setRatings} compact axes={EXECUTIVE_RATING_AXES} />
    </>
  )

  return (
    <div className="space-y-3 border-t border-violet-100 pt-3">
      {role === 'student' && isMine && <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">우리 부처 정책에는 의견을 남기지 않고, 다른 부처 정책을 평가합니다.</p>}

      {/* 새 평가 작성 — 아직 내 의견이 없고 평가 가능 상태일 때만 */}
      {role === 'student' && !isMine && !myComment && canEvaluate && (
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          {editorFields}
          <div className="flex justify-end">
            <button disabled={busy || !reason.trim()} className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">의견 남기기</button>
          </div>
        </form>
      )}

      {/* 평가 잠금 안내 — 기존 의견은 아래에 그대로 보임 */}
      {role === 'student' && !isMine && !myComment && !canEvaluate && lockNotice && (
        <p className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600 font-bold text-center">{lockNotice}</p>
      )}

      {/* 내 의견 — 작성자 본인이 수정·삭제 가능 */}
      {role === 'student' && !isMine && myComment && (
        editing ? (
          <form onSubmit={submit} className="rounded-xl border border-violet-300 bg-violet-50/40 p-3 space-y-2">
            <p className="text-xs font-black text-violet-800">✏️ 내 의견 수정 중</p>
            {editorFields}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600">취소</button>
              <button disabled={busy || !reason.trim()} className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">수정 저장</button>
            </div>
          </form>
        ) : (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black px-3 py-2 rounded-lg flex items-center justify-between gap-2">
            <span>✓ 의견 제출 완료</span>
            <div className="flex gap-2">
              <button onClick={startEdit} className="rounded-lg border border-emerald-400 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">수정</button>
              <button onClick={removeComment} className="rounded-lg border border-rose-300 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">삭제</button>
            </div>
          </div>
        )
      )}
      <PolicyCommentsList policyGid={policy.gid} allowReply={role === 'student' && isMine} />
    </div>
  )
}

function ExecutivePolicyDiscussionList() {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const groups = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const totalCap = branchConfig?.executive?.totalBudget ?? 100
  const presidentGroupId = branchConfig?.executive?.presidentGroupId || null
  const [policies, setPolicies] = useState({})
  const [presidentDirectives, setPresidentDirectives] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'policies', (d) => setPolicies(d || {}))
    const u2 = subscribe(roomCode, 'branchDrafts/exe-president/directives', (d) => setPresidentDirectives(d || {}))
    return () => { u?.(); u2?.() }
  }, [roomCode])

  const directiveList = useMemo(
    () => Object.values(presidentDirectives || {}).filter((d) => d && (d.text || '').trim()),
    [presidentDirectives]
  )

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])

  // 평가 중 우리 모둠 정책 수정 — 토의화면에서 바로 수정·재제출
  const [editingGid, setEditingGid] = useState(null)
  const sawEditableRef = useRef(false)
  const startEditing = async (p) => {
    // 잠금 해제 + 편집 가능 상태로(내용 보존). 학생이 ExecutivePolicyBudgetDraft에서 다시 [최종 제출]하면 제출됨.
    if (p.branchUnitId) await setAt(roomCode, `branchDrafts/${p.branchUnitId}/finalDoc/status`, 'draft')
    await updateAt(roomCode, `policies/${p.gid}`, { status: 'saved' })
    sawEditableRef.current = false
    setEditingGid(p.gid)
  }

  // 재제출(다시 submitted) 되면 수정 모드 자동 종료 — "수정 닫기"를 따로 누르지 않아도 됨.
  useEffect(() => {
    if (!editingGid) return
    const st = policies?.[editingGid]?.status
    const submitted = ['submitted', 'requested', 'adjusted', 'final'].includes(st)
    if (!submitted) {
      sawEditableRef.current = true // 편집 가능(saved) 상태를 한 번 본 뒤에만 자동 종료 허용
    } else if (sawEditableRef.current) {
      setEditingGid(null)
    }
  }, [policies, editingGid])

  const submitted = Object.entries(policies)
    .filter(([, p]) => ['saved', 'submitted', 'requested', 'adjusted', 'final'].includes(p?.status))
    .map(([gid, p]) => ({ gid, ...p }))
    .sort((a, b) => (b.submittedAt || b.updatedAt || 0) - (a.submittedAt || a.updatedAt || 0))

  const totalRequested = roundBudgetAmount(submitted.reduce((sum, p) => sum + (Number(p.requestedBudget ?? p.draftBudget) || 0), 0))
  const diff = roundBudgetAmount(totalRequested - totalCap)
  const isExcess = diff > 0
  const pct = totalCap > 0 ? Math.round((totalRequested / totalCap) * 100) : 0

  if (submitted.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">아직 저장되거나 발의된 정책·예산안이 없습니다.</div>
  }

  return (
    <div className="space-y-4">
      {/* 상단 예산 현황 띠배너 */}
      <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-4 text-white shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base md:text-lg font-black text-amber-300 flex items-center gap-1.5">
              <span>📊 실시간 부처별 예산 청구 합계 현황</span>
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              각 부처의 청구 예산 합계를 확인하며, 어느 부처 예산을 조정해야 할지 토의의 근거로 삼으세요.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-black/30 px-4 py-2 rounded-xl border border-white/10 flex-wrap">
            <div className="text-center">
              <span className="text-[10px] text-white/60 block font-bold">정부 총예산</span>
              <span className="text-sm md:text-base font-black text-white">{formatBudgetAmount(totalCap)} 억원</span>
            </div>
            <div className="text-center border-l border-white/10 pl-4">
              <span className="text-[10px] text-white/60 block font-bold">청구 합계</span>
              <span className="text-sm md:text-base font-black text-indigo-300">{formatBudgetAmount(totalRequested)} 억원</span>
            </div>
            <div className="text-center border-l border-white/10 pl-4">
              <span className="text-[10px] text-white/60 block font-bold">{isExcess ? '초과액' : '잔여액'}</span>
              <span className={`text-sm md:text-base font-black ${isExcess ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {formatBudgetAmount(Math.abs(diff))} 억원 {isExcess ? '⚠️' : '✅'}
              </span>
            </div>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-white/80 px-0.5">
            <span>예산 소진율</span>
            <span className={isExcess ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>{pct}%</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExcess ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>

      {submitted.map((p) => {
        const f = p.policyFields || {}
        const requested = roundBudgetAmount(Number(p.requestedBudget ?? p.draftBudget) || 0)
        const budgetItems = Array.isArray(p.budgetItems) ? p.budgetItems : []
        const isSavedOnly = p.status === 'saved'
        const isPresident = (presidentGroupId && p.gid === presidentGroupId) || String(p.ministryName || '').includes('대통령')
        const isMine = role === 'student' && p.gid === myGroupId && !isPresident
        return (
          <article key={p.gid} className="rounded-2xl border-2 border-violet-200 bg-white p-4 space-y-3">
            <header className="flex justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-black text-violet-950">{isPresident ? '👑' : '🏢'} {p.ministryName || p.groupName || '부처'} — {f.title || '집행계획명 미입력'}</h3>
                <p className="text-xs text-slate-500">청구 예산 {formatBudgetAmount(requested)}억 · 초안 {formatBudgetAmount(p.draftBudget)}억</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isSavedOnly ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                {p.status === 'requested' ? '청구 확정' : isSavedOnly ? '시행령 저장 (발의 대기중)' : '정책·예산안 발의'}
              </span>
            </header>

            {/* 우리 모둠: 평가 중에도 댓글 보고 바로 수정·재제출 */}
            {isMine && (editingGid === p.gid ? (
              <div className="rounded-xl border-2 border-violet-300 bg-violet-50/40 p-2 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-black text-violet-800">✏️ 우리 모둠 정책 수정 중 — 아래 받은 의견을 참고해 고친 뒤 [🚀 최종 제출]을 다시 누르세요</span>
                  <button onClick={() => setEditingGid(null)} className="shrink-0 text-[11px] text-slate-500 underline">수정 닫기</button>
                </div>
                {/* 수정하는 동안에도 받은 의견을 바로 보며 고칠 수 있게 — 편집기 위에 표시 */}
                <details open className="rounded-lg border border-violet-200 bg-white/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-black text-violet-800">💬 받은 의견 보기 (수정 참고용)</summary>
                  <div className="px-3 pb-3">
                    <PolicyCommentsList policyGid={p.gid} allowReply={role === 'student'} />
                  </div>
                </details>
                <ExecutivePolicyBudgetDraft groupId={p.gid} />
              </div>
            ) : (
              <button
                onClick={() => startEditing(p)}
                className="text-xs font-bold text-violet-700 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition"
              >
                ✏️ 댓글 보고 수정하기
              </button>
            ))}
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              {f.linkedBillTitle && (
                <div className="rounded-xl bg-indigo-50 p-3 md:col-span-2"><b className="text-indigo-800">근거 법령</b><p className="whitespace-pre-wrap">{f.linkedBillTitle}</p></div>
              )}
              <div className="rounded-xl bg-amber-50 p-3"><b className="text-amber-800">문제</b><p className="whitespace-pre-wrap">{f.problem}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><b className="text-sky-800">대상</b><p className="whitespace-pre-wrap">{f.targetCitizens || '미입력'}</p></div>
              <div className="rounded-xl bg-violet-50 p-3 md:col-span-2"><b className="text-violet-800">집행계획</b><p className="whitespace-pre-wrap">{f.content}</p></div>
              <div className="rounded-xl bg-fuchsia-50 p-3 md:col-span-2"><b className="text-fuchsia-800">시행령 초안</b><p className="whitespace-pre-wrap">{f.ordinance || '미입력'}</p></div>
              {(f.evidence || f.publicConcern || f.publicResponse || f.expectedEffect) && (
                <div className="rounded-xl bg-amber-50 p-3 md:col-span-2">
                  <b className="text-amber-800">국민 눈높이 반영</b>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">필요 근거 및 사례: </span>{f.evidence || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">예상 피해/손해: </span>{f.publicConcern || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">대응: </span>{f.publicResponse || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">기대 효과/홍보: </span>{f.expectedEffect || '미입력'}</p>
                </div>
              )}
              {budgetItems.length > 0 && (
                <div className="rounded-xl bg-lime-50 p-3 md:col-span-2">
                  <b className="text-lime-800">예산 항목</b>
                  <ul className="mt-1 space-y-1">
                    {budgetItems.map((item, idx) => (
                      <li key={item.id || idx} className="text-xs text-slate-700">- {item.title || `항목 ${idx + 1}`}: <b>{formatBudgetAmount(item.amount)}억</b>{item.note ? ` · ${item.note}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {isPresident && directiveList.length > 0 && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-1.5">
                <p className="text-xs font-black text-amber-900">📋 대통령실 → 부처별 업무지시</p>
                <ul className="space-y-1">
                  {directiveList.map((d, idx) => (
                    <li key={idx} className="text-xs text-amber-900 whitespace-pre-wrap">
                      <b>🏛️ {d.ministryName || '부처'}</b>: {d.text}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-amber-700">각 부처는 위 지시를 참고해 시행령·예산에 반영하거나 아래에 의견을 남기세요.</p>
              </div>
            )}
            {(() => {
              // 저장(발의 대기) 상태에서는 '새 평가 작성'만 평가단·대통령·교사로 제한한다.
              // 단, 이미 달린 의견은 상태와 무관하게 항상 보여 사라지지 않게 한다(초안 수정 중에도 유지).
              // 대통령실은 별도 발의 절차 없이 '저장' 상태로 머무는 경우가 많아, saved여도 항상 평가 가능하게 연다.
              const myGroup = groups?.[myGroupId]
              const isEvaluator = myGroup?.name?.includes('평가단') || myGroup?.name?.includes('대통령') || role === 'teacher' || role === 'evaluator'
              const canEvaluate = !isSavedOnly || isEvaluator || isPresident
              const lockNotice = isSavedOnly && !isEvaluator && !isPresident
                ? '🔒 해당 부처가 시행령·예산안을 저장(또는 수정)했습니다. 발의가 완료되면 새 평가 작성이 다시 열립니다. (기존 의견은 그대로 유지됩니다)'
                : null
              return (
                <div className="space-y-2 pt-2 border-t border-violet-100">
                  {isSavedOnly && isEvaluator && (
                    <div className="rounded-xl bg-amber-100 p-3 text-xs text-amber-900 font-bold border border-amber-300">
                      👑 현재 [저장 (발의 대기)] 상태입니다. 평가단 및 대통령 모둠은 사전에 열람하고 의견을 제시할 수 있습니다.
                    </div>
                  )}
                  <ExecutivePolicyCommentBox policy={p} myGroupId={myGroupId} canEvaluate={canEvaluate} lockNotice={lockNotice} />
                </div>
              )
            })()}
          </article>
        )
      })}
    </div>
  )
}

export default ExecutivePolicyDiscussionList
