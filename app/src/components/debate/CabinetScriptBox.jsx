import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * 국무회의(행정부 다자토론)에서 대통령실 모둠에게만 보이는 진행 대본 박스.
 * 대통령실은 토론 '편'이 아니라 의장이므로, 타이머 밑에 자기 진행 대본을 띄워 참고한다.
 * 작성/수정은 행정부 화면의 PresidentControlPanel(③ 국무회의 대본)에서 한다. 여기서는 읽기 전용.
 * 저장 위치: branchDrafts/exe-president/cabinetScript
 */
export default function CabinetScriptBox({ session }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const role = useGameStore((s) => s.role)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const presidentGroupId = config?.branchConfig?.executive?.presidentGroupId || null

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])

  const isPresidentSide =
    role === 'teacher' ||
    (presidentGroupId && myGroupId === presidentGroupId) ||
    Boolean(groups?.[myGroupId]?.name?.includes('대통령'))

  const [script, setScript] = useState(null)
  const [directivesMap, setDirectivesMap] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'branchDrafts/exe-president/cabinetScript', (d) => setScript(d || null))
    const u2 = subscribe(roomCode, 'branchDrafts/exe-president/directives', (d) => setDirectivesMap(d || {}))
    return () => { u?.(); u2?.() }
  }, [roomCode])

  const directives = useMemo(
    () => Object.values(directivesMap || {}).filter((d) => d && (d.text || '').trim()),
    [directivesMap]
  )

  // 국무회의(행정부 다자토론)에서 대통령실 모둠에게만 노출
  if (!session?.relatedExecutiveMeeting || !isPresidentSide) return null

  const text = script?.text || ''

  return (
    <div className="space-y-2">
      {/* 부처별 업무지시 */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black text-amber-900">📋 부처별 업무지시 (대통령실)</p>
          <span className="text-[10px] text-amber-600">수정은 행정부 화면에서</span>
        </div>
        {directives.length > 0 ? (
          <ul className="space-y-1 bg-white border border-amber-200 rounded-xl p-3">
            {directives.map((d, i) => (
              <li key={i} className="text-xs text-amber-900 whitespace-pre-wrap">
                <b>🏛️ {d.ministryName || '부처'}</b>: {d.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-amber-700 bg-white border border-amber-200 rounded-xl p-3">
            아직 업무지시가 없습니다. 행정부 화면의 <b>대통령실 패널</b>에서 부처별 업무지시를 작성하세요.
          </p>
        )}
      </div>

      {/* 국무회의 진행 대본 */}
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black text-yellow-800">👑 국무회의 진행 대본 (대통령실)</p>
          <span className="text-[10px] text-yellow-600">수정은 행정부 화면 ③에서</span>
        </div>
        {text ? (
          <pre className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-yellow-200 rounded-xl p-3 max-h-72 overflow-y-auto">
            {text}
          </pre>
        ) : (
          <p className="text-xs text-yellow-700 bg-white border border-yellow-200 rounded-xl p-3">
            아직 대본이 없습니다. 행정부 화면의 <b>③ 국무회의 진행 대본</b>에서 [🤖 대본 자동 생성]을 눌러 준비하세요.
          </p>
        )}
      </div>
    </div>
  )
}
