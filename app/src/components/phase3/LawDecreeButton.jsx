import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * 법·시행령 자료실 버튼 (판결중심 재판·판결 단계용).
 * 사건 자료실 옆에 두는 알약형 버튼. 누르면 우리 반에서 통과된 법(가결 법안)과
 * 행정부 시행령을 모달로 보여준다 — 판결의 구형·벌금이 벌칙 범위를 넘지 않는지 확인용.
 */
export default function LawDecreeButton({ label = '⚖️ 법·시행령 보기' }) {
  const [open, setOpen] = useState(false)
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const [bills, setBills] = useState({})
  const [policies, setPolicies] = useState({})

  useEffect(() => {
    if (!open || !roomCode) return
    const u1 = subscribe(roomCode, 'bills', (d) => setBills(d || {}))
    const u2 = subscribe(roomCode, 'policies', (d) => setPolicies(d || {}))
    return () => { u1?.(); u2?.() }
  }, [open, roomCode])

  const passedBills = useMemo(
    () => Object.entries(bills).map(([id, b]) => ({ id, ...b })).filter((b) => b.status === 'passed'),
    [bills],
  )
  const decrees = useMemo(
    () => Object.entries(policies)
      .map(([gid, p]) => ({ gid, ...p }))
      .filter((p) => {
        const f = p.policyFields || {}
        return (f.ordinance && f.ordinance.trim()) || (f.content && f.content.trim())
      }),
    [policies],
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-violet-100 bg-violet-50 rounded-t-2xl flex-shrink-0">
              <h2 className="text-sm font-bold text-violet-800">⚖️ 우리 반 법·시행령</h2>
              <button onClick={() => setOpen(false)} className="text-violet-400 hover:text-violet-700 text-lg leading-none font-bold">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <p className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                판결의 구형·벌금이 아래 <b>법안의 벌칙</b>이나 <b>시행령의 상벌·처분</b> 범위를 넘지 않는지 확인하세요.
              </p>

              <section>
                <h3 className="text-sm font-black text-indigo-900 mb-2">📜 통과된 법 (가결 법안) — {passedBills.length}건</h3>
                {passedBills.length === 0 ? (
                  <p className="text-xs text-gray-400">아직 가결된 법안이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {passedBills.map((b) => (
                      <li key={b.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                        <p className="text-sm font-bold text-indigo-900">{b.title || '법안'}</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">{b.body || '(내용 없음)'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-sm font-black text-amber-900 mb-2">🏢 행정부 시행령 — {decrees.length}건</h3>
                {decrees.length === 0 ? (
                  <p className="text-xs text-gray-400">아직 작성된 시행령이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {decrees.map((p) => {
                      const f = p.policyFields || {}
                      return (
                        <li key={p.gid} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-1">
                          <p className="text-sm font-bold text-amber-900">{f.title || p.ministryName || groups?.[p.gid]?.name || '시행령'}</p>
                          {f.ordinance && <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed"><b className="text-amber-700">시행령:</b> {f.ordinance}</p>}
                          {f.content && <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed"><b className="text-amber-700">집행계획:</b> {f.content}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
