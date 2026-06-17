import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { setAt } from '../../lib/rtdb-helpers'

/**
 * 본회의 의결 투표 모달
 *
 * props:
 *   bill: { id, title }
 *   choice: 'yes' | 'no' (사전 선택 — 카드 클릭 단계에서 결정)
 *   onClose()
 */
function BillVoteModal({ bill, choice, onClose }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)

  const myGroupId = (() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  })()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onConfirm = async () => {
    if (!bill?.id) return
    setBusy(true)
    setError('')
    try {
      await setAt(roomCode, `billVotes/${bill.id}/${myStudentId}`, {
        choice,
        weighted: false,
        groupId: myGroupId,
        at: Date.now(),
      })
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-800">
          {bill?.title || '법안'}
        </h3>
        <p
          className={`text-sm mt-2 px-3 py-2 rounded-lg ${
            choice === 'yes'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {choice === 'yes' ? '👍 찬성' : '👎 반대'} 표를 행사합니다.
        </p>

        {error && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2 rounded-lg text-white font-semibold disabled:opacity-50 ${
              choice === 'yes'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {busy ? '...' : '확정'}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

export default BillVoteModal
