import { useEffect, useState, useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'

function Phase2RoleControlPanel() {
  const roomCode  = useGameStore((s) => s.roomCode)
  const groups    = useGameStore((s) => s.groups)
  const config    = useGameStore((s) => s.config)

  const [candidatesMap,  setCandidatesMap]  = useState({})
  const [journalistsMap, setJournalistsMap] = useState({})
  const [busy, setBusy] = useState(false)
  // 기호 입력 임시 상태: { [groupId]: string }
  const [numInputs, setNumInputs] = useState({})

  const isLocked = !!config?.roleSelectionLocked

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'candidates',          (d) => setCandidatesMap(d  || {}))
    const u2 = subscribe(roomCode, 'electionJournalists', (d) => setJournalistsMap(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode])

  // RTDB 값이 바뀌면 입력 상태 동기화 (외부 변경 반영)
  useEffect(() => {
    setNumInputs((prev) => {
      const next = { ...prev }
      for (const [gid, c] of Object.entries(candidatesMap)) {
        if (!(gid in next)) {
          next[gid] = c.candidateNumber != null ? String(c.candidateNumber) : ''
        }
      }
      return next
    })
  }, [candidatesMap])

  const { candidates, journalists, unset } = useMemo(() => {
    const candidates  = []
    const journalists = []
    const unset       = []
    for (const [gid, g] of Object.entries(groups || {})) {
      if (!g || Object.keys(g.members || {}).length === 0) continue
      if (journalistsMap[gid])   journalists.push({ gid, name: g.name })
      else if (candidatesMap[gid]) candidates.push({ gid, name: g.name, data: candidatesMap[gid] })
      else                          unset.push({ gid, name: g.name })
    }
    return { candidates, journalists, unset }
  }, [groups, candidatesMap, journalistsMap])

  const toggleLock = async () => {
    setBusy(true)
    try {
      await updateAt(roomCode, 'config', { roleSelectionLocked: !isLocked })
    } catch (err) {
      alert('설정 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveCandidateNumber = async (gid, value) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1) return
    try {
      await updateAt(roomCode, `candidates/${gid}`, { candidateNumber: num })
    } catch (err) {
      alert('저장 실패: ' + err.message)
    }
  }

  // 기호 자동 배정 (1번부터 순서대로)
  const autoAssign = async () => {
    if (!candidates.length) return
    if (!confirm(`후보 ${candidates.length}팀에게 기호 1번부터 순서대로 배정할까요?`)) return
    try {
      for (let i = 0; i < candidates.length; i++) {
        await updateAt(roomCode, `candidates/${candidates[i].gid}`, { candidateNumber: i + 1 })
      }
      setNumInputs((prev) => {
        const next = { ...prev }
        candidates.forEach(({ gid }, i) => { next[gid] = String(i + 1) })
        return next
      })
    } catch (err) {
      alert('자동 배정 실패: ' + err.message)
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-200 shadow p-4 space-y-4">
      {/* 헤더 + 잠금 */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-rose-800">🎭 모둠 역할 현황</h3>
        <button
          type="button"
          onClick={toggleLock}
          disabled={busy}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
            isLocked
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-rose-600 text-white hover:bg-rose-700'
          }`}
        >
          {busy ? '처리 중...' : isLocked ? '🔓 역할 잠금 해제' : '🔒 역할 잠금'}
        </button>
      </div>

      {isLocked && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-semibold">
          🔒 역할이 잠겨 있어 학생들이 역할을 변경할 수 없습니다.
        </p>
      )}

      {/* 역할 현황 3열 */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="space-y-1.5">
          <p className="font-bold text-rose-700">🎤 후보 캠프 ({candidates.length})</p>
          {candidates.length === 0 ? (
            <p className="text-gray-400 italic">없음</p>
          ) : (
            candidates.map(({ gid, name, data }) => (
              <div key={gid} className="bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 font-semibold text-rose-800">
                {data.candidateNumber != null && (
                  <span className="mr-1 text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full">기호 {data.candidateNumber}번</span>
                )}
                {name}
              </div>
            ))
          )}
        </div>

        <div className="space-y-1.5">
          <p className="font-bold text-blue-700">📰 선거 기자 ({journalists.length})</p>
          {journalists.length === 0 ? (
            <p className="text-gray-400 italic">없음</p>
          ) : (
            journalists.map(({ gid, name }) => (
              <div key={gid} className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 font-semibold text-blue-800">
                {name}
              </div>
            ))
          )}
        </div>

        <div className="space-y-1.5">
          <p className="font-bold text-gray-500">⏳ 미선택 ({unset.length})</p>
          {unset.length === 0 ? (
            <p className="text-gray-400 italic">없음</p>
          ) : (
            unset.map(({ gid, name }) => (
              <div key={gid} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-500">
                {name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 후보 기호 지정 */}
      {candidates.length > 0 && (
        <div className="border-t border-rose-100 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-rose-800">🔢 후보 기호 지정</p>
            <button
              type="button"
              onClick={autoAssign}
              className="text-[11px] px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold hover:bg-rose-100 transition"
            >
              자동 배정 (1번~)
            </button>
          </div>
          <div className="space-y-1.5">
            {candidates.map(({ gid, name, data }) => (
              <div key={gid} className="flex items-center gap-2">
                <span className="flex-1 text-xs font-semibold text-gray-800 truncate">
                  {name}
                  <span className="ml-1 text-[10px] text-gray-400">
                    ({data.leaderNumber}번 {data.leaderNickname})
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] text-gray-500">기호</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={numInputs[gid] ?? (data.candidateNumber != null ? String(data.candidateNumber) : '')}
                    onChange={(e) => setNumInputs((prev) => ({ ...prev, [gid]: e.target.value }))}
                    onBlur={(e) => saveCandidateNumber(gid, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCandidateNumber(gid, e.target.value) }}
                    placeholder="—"
                    className="w-14 px-2 py-1 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 font-bold"
                  />
                  <span className="text-[11px] text-gray-500">번</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">입력 후 Enter 또는 칸 밖 클릭 시 저장됩니다.</p>
        </div>
      )}
    </div>
  )
}

export default Phase2RoleControlPanel
