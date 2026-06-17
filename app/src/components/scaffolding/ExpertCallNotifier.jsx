import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * 교사 대시보드 — 전문가 호출 알림 + 응답 패널
 *
 * pending이면 빨간 점멸 뱃지. 클릭하면 응답 화면.
 */
function ExpertCallNotifier() {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const respondExpertCall = useGameStore((s) => s.respondExpertCall)

  const [calls, setCalls] = useState({})
  const [responseDraft, setResponseDraft] = useState({})
  const [filter, setFilter] = useState('pending') // 'pending'|'all'

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'expertCalls', (d) => setCalls(d || {}))
    return () => u?.()
  }, [roomCode])

  const list = useMemo(() => {
    const arr = Object.entries(calls)
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (filter === 'all') return arr
    return arr.filter((c) => c.status === 'pending' || c.status === 'inProgress')
  }, [calls, filter])

  const pendingCount = Object.values(calls).filter(
    (c) => c?.status === 'pending',
  ).length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-amber-800">
          📞 전문가 호출
          {pendingCount > 0 && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-red-600 text-white text-xs animate-pulse">
              {pendingCount}건 대기
            </span>
          )}
        </h3>
        <div className="flex gap-1 text-xs">
          {[
            ['pending', '진행 중'],
            ['all', '전체'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded ${
                filter === v
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2 max-h-[420px] overflow-y-auto">
        {list.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-4">
            대기 중인 전문가 호출이 없어요.
          </li>
        )}
        {list.map((c) => {
          const group = c.groupId ? groups[c.groupId] : null
          const draft = responseDraft[c.id] ?? c.teacherResponse ?? ''
          return (
            <li
              key={c.id}
              className={`bg-white border rounded-lg p-3 text-sm ${
                c.status === 'pending'
                  ? 'border-amber-300 ring-2 ring-amber-100'
                  : c.status === 'inProgress'
                  ? 'border-emerald-300'
                  : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <strong className="text-amber-800">
                  {group?.name || c.groupId}
                </strong>
                <span className="text-xs text-gray-500">
                  {c.createdAt
                    ? new Date(c.createdAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
              <p className="mt-1 text-gray-800">{c.request}</p>
              <div className="mt-1 text-xs text-gray-500">
                상태:{' '}
                <strong
                  className={
                    c.status === 'pending'
                      ? 'text-amber-700'
                      : c.status === 'inProgress'
                      ? 'text-emerald-700'
                      : 'text-gray-500'
                  }
                >
                  {c.status === 'pending'
                    ? '대기 중'
                    : c.status === 'inProgress'
                    ? '응답 중'
                    : '종료'}
                </strong>
              </div>

              {c.status !== 'closed' && (
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setResponseDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  placeholder="응답 메모 (선택) — 학생에게 노출됩니다"
                  rows={2}
                  className="mt-2 w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                />
              )}
              {c.status === 'closed' && c.teacherResponse && (
                <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                  📝 {c.teacherResponse}
                </p>
              )}

              <div className="mt-2 flex gap-1 justify-end flex-wrap">
                {c.status === 'pending' && (
                  <button
                    onClick={() =>
                      respondExpertCall(c.id, 'inProgress', draft)
                    }
                    className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    응답 시작
                  </button>
                )}
                {c.status === 'inProgress' && (
                  <button
                    onClick={() => respondExpertCall(c.id, 'closed', draft)}
                    className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-800"
                  >
                    완료
                  </button>
                )}
                {c.status !== 'closed' && (
                  <button
                    onClick={() => respondExpertCall(c.id, 'closed', '')}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    바로 닫기
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ExpertCallNotifier
