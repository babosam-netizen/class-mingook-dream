import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'
import { normalizeTodo } from '../../lib/scaffolding-data'

/**
 * 역할 todos 기반 메모 폼 — 각 todo 마다 독립 저장.
 * - 1번 미션 끝나면 그 칸만 [저장]: RTDB 에 즉시 반영, 다른 미션은 천천히
 * - 입력은 groups/{gid}/roleNotes/{sessionId}/{roleKey} 에 저장
 * - 저장한 내용은 모둠원이 모두 읽을 수 있음 (GroupRoleSummary 가 표시)
 *
 * @param {{groupId, sessionId, role: {key, label, emoji, todos}}} props
 */
function GenericRoleNotes({ groupId, sessionId, role: roleMeta }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)

  const [data, setData] = useState({ fields: {}, updatedAt: 0 })
  const [busyIdx, setBusyIdx] = useState(null) // 저장 중인 todo index
  const [savedIdx, setSavedIdx] = useState(null)
  const [savedFlashTimer, setSavedFlashTimer] = useState(null)
  const [editingIdx, setEditingIdx] = useState({}) // { idx: true } — 명시적 수정 모드

  // memoGuide Q&A 상태 (역할별 조사 안내 질문 답변)
  const hasMemoGuide = (roleMeta?.memoGuide?.length || 0) > 0
  const [memoQnas, setMemoQnas] = useState({})      // { idx: string }
  const [memoQnasDirty, setMemoQnasDirty] = useState(false)
  const [memoQnasBusy, setMemoQnasBusy] = useState(false)
  const [memoQnasSaved, setMemoQnasSaved] = useState(false)

  const path = `groups/${groupId}/roleNotes/${sessionId}/${roleMeta.key}`

  useEffect(() => {
    if (!roomCode || !groupId || !sessionId || !roleMeta?.key) return
    const u = subscribe(roomCode, path, (d) => setData(d || { fields: {}, updatedAt: 0 }))
    return () => u?.()
  }, [roomCode, path])

  // memoQnas 초기화 — RTDB 데이터 수신 시 (입력 중이면 보호)
  useEffect(() => {
    if (!memoQnasDirty) {
      const saved = data?.memoQnas || {}
      setMemoQnas((prev) => {
        const next = { ...prev }
        Object.keys(saved).forEach((k) => { next[k] = saved[k] })
        return next
      })
    }
  }, [data?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMemoQnaChange = (idx, val) => {
    setMemoQnas((prev) => ({ ...prev, [idx]: val }))
    setMemoQnasDirty(true)
    setMemoQnasSaved(false)
  }

  const saveMemoQnas = async () => {
    if (memoQnasBusy || !myStudentId) return
    setMemoQnasBusy(true)
    try {
      await updateAt(roomCode, path, {
        studentId: myStudentId,
        studentNumber: Number(myNumber) || null,
        studentName: myNickname || '',
        roleKey: roleMeta.key,
        memoQnas,
        updatedAt: Date.now(),
      })
      setMemoQnasDirty(false)
      setMemoQnasSaved(true)
      setTimeout(() => setMemoQnasSaved(false), 2000)
    } finally {
      setMemoQnasBusy(false)
    }
  }

  // 로컬 입력 상태 — RTDB 데이터로 초기화 (단, 본인이 그 칸을 입력 중일 땐 보호)
  const [drafts, setDrafts] = useState({})
  const [linkDrafts, setLinkDrafts] = useState({})   // 출처 URL 로컬 상태
  const [dirtyMap, setDirtyMap] = useState({}) // { idx: true } — 수정 중인 todo 만 보호
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const idx of Object.keys(data?.fields || {})) {
        if (!dirtyMap[idx]) next[idx] = data.fields[idx]
      }
      ;(roleMeta.todos || []).forEach((_, i) => {
        if (next[i] === undefined && !dirtyMap[i]) next[i] = data?.fields?.[i] || ''
      })
      return next
    })
    setLinkDrafts((prev) => {
      const next = { ...prev }
      for (const idx of Object.keys(data?.links || {})) {
        if (!dirtyMap[idx]) next[idx] = data.links[idx]
      }
      ;(roleMeta.todos || []).forEach((_, i) => {
        if (next[i] === undefined && !dirtyMap[i]) next[i] = data?.links?.[i] || ''
      })
      return next
    })
  }, [data?.updatedAt])

  const setField = (idx, v) => {
    setDirtyMap((prev) => ({ ...prev, [idx]: true }))
    setDrafts((prev) => ({ ...prev, [idx]: v }))
  }
  const setLink = (idx, v) => {
    setDirtyMap((prev) => ({ ...prev, [idx]: true }))
    setLinkDrafts((prev) => ({ ...prev, [idx]: v }))
  }

  const saveField = async (idx) => {
    if (busyIdx !== null || !myStudentId) return
    const text = (drafts[idx] || '').trim()
    const link = (linkDrafts[idx] || '').trim()
    setBusyIdx(idx)
    try {
      // 메타데이터 + 해당 필드 + 출처 URL 부분 업데이트
      await updateAt(roomCode, path, {
        studentId: myStudentId,
        studentNumber: Number(myNumber) || null,
        studentName: myNickname || '',
        roleKey: roleMeta.key,
        roleLabel: roleMeta.label,
        [`fields/${idx}`]: text,
        [`links/${idx}`]: link,
        updatedAt: Date.now(),
      })
      setDirtyMap((prev) => ({ ...prev, [idx]: false }))
      setEditingIdx((prev) => ({ ...prev, [idx]: false }))
      setSavedIdx(idx)
      if (savedFlashTimer) clearTimeout(savedFlashTimer)
      setSavedFlashTimer(setTimeout(() => setSavedIdx(null), 2000))
    } finally {
      setBusyIdx(null)
    }
  }

  const startEdit = (idx) => {
    setEditingIdx((prev) => ({ ...prev, [idx]: true }))
  }
  const cancelEdit = (idx) => {
    setEditingIdx((prev) => ({ ...prev, [idx]: false }))
    setDirtyMap((prev) => ({ ...prev, [idx]: false }))
    setDrafts((prev) => ({ ...prev, [idx]: data?.fields?.[idx] || '' }))
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold text-indigo-900">
          {roleMeta.emoji} {roleMeta.label} — 작업 메모
        </h3>
        {data?.studentName && data.studentId !== myStudentId && (
          <span className="text-[10px] text-amber-600">
            ※ {data.studentNumber}번 {data.studentName} 가 작성 중
          </span>
        )}
      </div>

      {/* ── memoGuide Q&A 메모 카드 (역할에 memoGuide가 있는 경우만) ── */}
      {hasMemoGuide && (
        <div className="border border-indigo-200 rounded-xl p-3 space-y-3 bg-indigo-50">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-[12px] font-extrabold text-indigo-800">
              📝 {roleMeta.emoji} {roleMeta.label} 메모 카드
            </p>
            <span className="text-[10px] text-indigo-500">질문에 답하며 조사 내용을 정리하세요</span>
          </div>
          <div className="space-y-3 bg-white border border-indigo-100 rounded-lg p-3">
            <p className="text-[11px] font-bold text-indigo-700">❓ 역할별 조사 안내 질문</p>
            {(roleMeta.memoGuide || []).map((q, idx) => (
              <label key={idx} className="block space-y-1 text-left">
                <span className="text-xs font-semibold text-slate-700">{q}</span>
                <textarea
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                  placeholder="여기에 답변을 적으세요..."
                  value={memoQnas[idx] || ''}
                  onChange={(e) => handleMemoQnaChange(idx, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            {memoQnasSaved && (
              <span className="text-[11px] text-emerald-600 font-bold animate-pulse">✓ 저장 완료!</span>
            )}
            {!memoQnasSaved && memoQnasDirty && (
              <span className="text-[11px] text-amber-600 font-bold">● 미저장</span>
            )}
            {!memoQnasSaved && !memoQnasDirty && (
              <span className="text-[11px] text-gray-400">답변을 입력하면 저장 버튼이 활성화됩니다.</span>
            )}
            <button
              type="button"
              onClick={saveMemoQnas}
              disabled={memoQnasBusy || !memoQnasDirty}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                memoQnasBusy
                  ? 'bg-gray-200 text-gray-500'
                  : memoQnasDirty
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {memoQnasBusy ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        각 미션을 끝낼 때마다 <b>해당 칸의 [저장]</b> 버튼을 눌러 모둠 친구들과 공유하세요.
        먼저 끝낸 미션부터 올릴 수 있어요.
      </p>

      {(roleMeta.todos || []).map((todoRaw, i) => {
        const todo = normalizeTodo(todoRaw)
        const dirty = !!dirtyMap[i]
        const saved = data?.fields?.[i] || ''
        const hasSaved = String(saved || '').trim().length > 0
        const text = drafts[i] !== undefined ? drafts[i] : saved
        const busy = busyIdx === i
        const justSaved = savedIdx === i
        const placeholder = todo.hint || '예시를 참고해 자유롭게 적어 주세요'
        // 읽기 모드 조건: 저장된 내용이 있고 + 명시적 수정 모드가 아니고 + 저장 직후 깜박 상태도 아닌 경우
        const inEditMode = !!editingIdx[i] || dirty
        const showAsDisplay = hasSaved && !inEditMode

        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <label className="text-xs font-semibold text-gray-700 flex-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 mr-1 font-bold">
                  {i + 1}
                </span>
                {todo.label}
              </label>
              {showAsDisplay && !justSaved && (
                <span className="text-[10px] text-emerald-600 font-bold">✓ 저장됨</span>
              )}
              {justSaved && (
                <span className="text-[10px] text-emerald-600 font-bold animate-pulse">✓ 저장 완료!</span>
              )}
              {dirty && (
                <span className="text-[10px] text-amber-600 font-bold">● 미저장</span>
              )}
            </div>

            {showAsDisplay ? (
              // === 읽기 전용 표시 + 수정 버튼 ===
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3 group/note">
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                  {saved}
                </p>
                {/* 저장된 출처 URL 표시 */}
                {data?.links?.[i] && (
                  <p className="mt-1.5 text-[11px]">
                    <span className="text-gray-400">🔗 출처: </span>
                    <a href={data.links[i]} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">
                      {data.links[i]}
                    </a>
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-100">
                  <span className="text-[10px] text-gray-400">{saved.length}자 저장됨</span>
                  <button
                    type="button"
                    onClick={() => startEdit(i)}
                    className="px-2.5 py-1 text-[11px] rounded bg-white border border-gray-300 hover:bg-indigo-50 hover:border-indigo-400 font-semibold text-gray-700"
                  >
                    ✏️ 수정
                  </button>
                </div>
              </div>
            ) : (
              // === 수정 (또는 최초 입력) 모드 ===
              <>
                <textarea
                  value={text}
                  onChange={(e) => setField(i, e.target.value)}
                  maxLength={400}
                  rows={3}
                  placeholder={placeholder}
                  autoFocus={!!editingIdx[i]}
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${
                    dirty ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300'
                  }`}
                />
                {/* 출처 URL 입력 */}
                <input
                  type="url"
                  value={linkDrafts[i] || ''}
                  onChange={(e) => setLink(i, e.target.value)}
                  placeholder="🔗 출처 링크 (선택) — 참고한 기사·판례·법령 URL"
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    dirty ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300'
                  }`}
                />
                {!String(text || '').trim() && todo.hint && (
                  <p className="text-[10px] text-gray-400 italic px-1">
                    💡 {todo.hint}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400">{(text || '').length}/400</p>
                  <div className="flex gap-1.5">
                    {hasSaved && (
                      <button
                        type="button"
                        onClick={() => cancelEdit(i)}
                        className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold border border-gray-300"
                      >
                        ✕ 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => saveField(i)}
                      disabled={busy || !dirty || !String(text || '').trim()}
                      className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
                        busy
                          ? 'bg-gray-200 text-gray-500'
                          : dirty && String(text || '').trim()
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {busy ? '저장 중...' : hasSaved ? '수정 저장' : '이 미션 저장'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default GenericRoleNotes
