import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * 학생 화면 우측 하단 floating button — 전문가 호출(SOS)
 *
 * Phase 3에서만 활성. 모둠당 페이즈 3 누적 N회(config.expertCallQuotaPerGroup) 한도.
 *
 * SessionFinishButton(우측 하단)과 자리 충돌 피하려고 하단 한 단계 위로 배치.
 */
function ExpertCallButton() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const config = useGameStore((s) => s.config)
  const callExpert = useGameStore((s) => s.callExpert)

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [calls, setCalls] = useState({})
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // null | 'sent' | error string

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'expertCalls', (d) => setCalls(d || {}))
    return () => u?.()
  }, [roomCode])

  if (role !== 'student' || !myGroupId || currentPhase !== 3) return null

  const quota = config?.expertCallQuotaPerGroup ?? 3
  const myCalls = Object.values(calls).filter((c) => c?.groupId === myGroupId)
  const usedCount = myCalls.length
  const remaining = Math.max(0, quota - usedCount)
  const canCall = remaining > 0
  const myLatest = myCalls
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]

  const onSend = async () => {
    if (!request.trim()) return
    setBusy(true)
    setDone(null)
    try {
      await callExpert({
        groupId: myGroupId,
        sessionNo: currentPhase,
        request: request.trim(),
      })
      setDone('sent')
      setRequest('')
      setTimeout(() => {
        setDone(null)
        setOpen(false)
      }, 2000)
    } catch (e) {
      setDone(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-24 right-4 z-30">
        <button
          onClick={() => setOpen(true)}
          disabled={!canCall}
          className={`px-4 py-3 rounded-2xl shadow-lg font-bold transition flex items-center gap-1 ${
            canCall
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title={canCall ? '전문가 호출' : `이미 ${quota}회 모두 사용`}
        >
          📞 전문가 호출
          <span className="text-xs opacity-80">
            ({remaining}/{quota})
          </span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-amber-700">📞 전문가 호출</h3>
            <p className="text-sm text-gray-500 mt-1">
              어떤 자문이 필요한가요? 한 줄로 적어 주세요. 선생님이 잠깐 게스트로 와요.
            </p>

            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="예: 위반 시 어떤 처벌이 적당한지 모르겠어요."
              rows={3}
              maxLength={200}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />

            <p className="mt-2 text-xs text-gray-500">
              남은 호출: <strong>{remaining}/{quota}회</strong> (모둠당 페이즈 3 누적)
            </p>

            {myLatest && myLatest.status !== 'closed' && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                직전 호출: {myLatest.status === 'pending' ? '⏳ 대기 중' : '🟢 응답 중'}
              </p>
            )}

            {done === 'sent' && (
              <p className="mt-2 text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                ✓ 호출이 전달됐어요. 선생님 응답을 기다려 주세요.
              </p>
            )}
            {done && done !== 'sent' && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                {done}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={onSend}
                disabled={busy || !request.trim() || !canCall}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50"
              >
                {busy ? '...' : '호출 보내기'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ExpertCallButton
