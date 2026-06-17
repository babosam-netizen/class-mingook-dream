import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import ResearchReferencePanel from '../research/ResearchReferencePanel'

/**
 * ② 초안작성 등 후반 단계 상단에 표시하는 읽기 전용 준비 요약.
 * - 우리 부처가 ① 역할및준비에서 수집한 자료 (ResearchReferencePanel, 입력창 없이 읽기만)
 * - 대표가 정리한 "이 법안과 관련해 우리 부처에서 할 일" (chosenTask)
 * - 대표가 정리한 비슷한 시행령 내용 + 참고자료 (similarOrdinance + references)
 * 새 데이터 생성 없음 — 기존 prep 노드를 읽기만 한다.
 */
export default function ExecutivePrepSummary({ unitId, groupId, isPresident = false, ministryName = '우리 부처' }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const students = useGameStore((s) => s.students)

  const [chosen, setChosen] = useState(null)
  const [similar, setSimilar] = useState(null)
  const [references, setReferences] = useState({})
  useEffect(() => {
    if (!roomCode || !unitId) return undefined
    const u1 = subscribe(roomCode, `branchDrafts/${unitId}/prep/chosenTask`, (d) => setChosen(d || null))
    const u2 = subscribe(roomCode, `branchDrafts/${unitId}/prep/similarOrdinance`, (d) => setSimilar(d || null))
    const u3 = subscribe(roomCode, `branchDrafts/${unitId}/prep/references`, (d) => setReferences(d || {}))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [roomCode, unitId])

  const refList = useMemo(
    () => Object.entries(references || {}).map(([id, r]) => ({ id, ...r })).filter((r) => (r.url || '').trim()).sort((a, b) => (a.at || 0) - (b.at || 0)),
    [references]
  )

  return (
    <div className="space-y-3">
      {/* 수집한 자료 (읽기 전용) */}
      <ResearchReferencePanel
        contextKey="phase3_executive"
        groupId={groupId}
        title={`${ministryName}가 수집한 자료`}
        emptyMessage="① 역할 및 준비 단계에서 모은 자료가 아직 없습니다."
        accent="amber"
      />

      {!isPresident && chosen?.text?.trim() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[11px] font-black text-amber-800 mb-1">🎯 이 법안과 관련해 {ministryName}에서 할 일 (대표 정리)</p>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{chosen.text}</p>
        </div>
      )}

      {!isPresident && (similar?.text?.trim() || refList.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          <p className="text-[11px] font-black text-amber-800">🔎 비슷한 시행령 찾은 내용 (대표 정리)</p>
          {similar?.text?.trim() && (
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{similar.text}</p>
          )}
          {refList.length > 0 && (
            <ul className="space-y-1">
              {refList.map((r) => (
                <li key={r.id} className="text-[11px] bg-white border border-slate-100 rounded px-2 py-1">
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">🔗 {r.url}</a>
                  {r.note && <span className="text-slate-500"> · {r.note}</span>}
                  <span className="text-slate-300"> · {students?.[r.by || r.id]?.nickname || ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
