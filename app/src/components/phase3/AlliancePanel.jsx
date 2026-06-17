import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, updateAt } from '../../lib/rtdb-helpers'
import { topicBg } from '../../styles/tokens'
import AllianceTimer from '../shared/AllianceTimer'

/**
 * 야당 연합 패널
 *
 * 흐름:
 *   1) 교사가 [1분 타이머 시작] 클릭 → 학생 모둠들이 [연합 신청] 가능
 *   2) 모둠 A 대표가 다른 모둠 B를 지목 → alliances/pending/{B}/{A} = {at} 기록
 *   3) 모둠 B 대표가 [수락] → alliances/active/{id} = { groupA, groupB, formedAt }
 *   4) 차시 끝나면 자동 해체(교사 수동) — 그 차시의 의결 1회에 한해 띠배너 표시
 *
 * 단순화: 모든 모둠이 한 번에 한 동맹만 가질 수 있음.
 */
function AlliancePanel() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const startAllianceTimer = useGameStore((s) => s.startAllianceTimer)
  const stopAllianceTimer = useGameStore((s) => s.stopAllianceTimer)

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [timer, setTimer] = useState(null)
  const [pending, setPending] = useState({})
  const [active, setActive] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'timers/oppositionAlliance', setTimer)
    const u2 = subscribe(roomCode, 'alliances/pending', (d) => setPending(d || {}))
    const u3 = subscribe(roomCode, 'alliances/active', (d) => setActive(d || {}))
    return () => {
      u1?.()
      u2?.()
      u3?.()
    }
  }, [roomCode])

  // 1위가 아닌 모둠만 야당 연합 자격 (config.benefitCardDistribution rank1 제외)
  const otherGroups = useMemo(
    () =>
      Object.entries(groups).filter(([gid, g]) => {
        if (gid === myGroupId) return false
        if (g?.rank === 1) return false
        return true
      }),
    [groups, myGroupId],
  )

  const myRank = myGroupId ? groups[myGroupId]?.rank : null
  const eligibleAsRequester = role === 'student' && myRank !== 1 && timer?.active

  const myPending = pending[myGroupId] || {} // 받은 신청들
  const sentByMe = Object.entries(pending).find(([target, fromList]) =>
    fromList?.[myGroupId] && target !== myGroupId,
  )
  const myActive = Object.entries(active).find(
    ([, a]) => a?.groupA === myGroupId || a?.groupB === myGroupId,
  )

  // 신청
  const requestAlliance = async (targetGroupId) => {
    if (!myGroupId || !timer?.active) return
    await setAt(roomCode, `alliances/pending/${targetGroupId}/${myGroupId}`, {
      at: Date.now(),
    })
  }

  const cancelRequest = async (targetGroupId) => {
    await updateAt(roomCode, `alliances/pending/${targetGroupId}`, {
      [myGroupId]: null,
    })
  }

  const acceptRequest = async (fromGroupId) => {
    if (!myGroupId) return
    const id = `${fromGroupId}__${myGroupId}__${Date.now().toString(36)}`
    await setAt(roomCode, `alliances/active/${id}`, {
      groupA: fromGroupId,
      groupB: myGroupId,
      formedAt: Date.now(),
    })
    // pending 정리
    await updateAt(roomCode, `alliances/pending/${myGroupId}`, {
      [fromGroupId]: null,
    })
  }

  const dissolveAlliance = async (id) => {
    if (!confirm('이 야당 연합을 해체할까요?')) return
    await updateAt(roomCode, 'alliances/active', { [id]: null })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-amber-800">🤝 야당 연합</h3>
        <AllianceTimer timer={timer} compact />
      </div>

      {role === 'teacher' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => startAllianceTimer(60)}
            disabled={timer?.active}
            className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white disabled:opacity-50 hover:bg-amber-700"
          >
            ⏱️ 1분 타이머 시작
          </button>
          <button
            onClick={stopAllianceTimer}
            disabled={!timer?.active}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200"
          >
            타이머 종료
          </button>
        </div>
      )}

      {/* 활성 연합 띠배너 */}
      {Object.keys(active).length > 0 && (
        <div className="space-y-1">
          {Object.entries(active).map(([id, a]) => {
            const gA = groups[a.groupA]
            const gB = groups[a.groupB]
            return (
              <div
                key={id}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-100 to-rose-100 border-2 border-amber-300 text-sm font-bold flex items-center justify-between"
              >
                <span>
                  🤝 <strong>{gA?.name || a.groupA}</strong> + <strong>{gB?.name || a.groupB}</strong> 야당 연대 결성
                </span>
                {role === 'teacher' && (
                  <button
                    onClick={() => dissolveAlliance(id)}
                    className="text-xs px-2 py-1 rounded bg-white/80 hover:bg-white"
                  >
                    해체
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 학생: 자격 안내 */}
      {role === 'student' && myRank === 1 && (
        <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded">
          1위 모둠은 야당 연합에 참여할 수 없습니다.
        </p>
      )}

      {/* 학생: 받은 신청 */}
      {role === 'student' && Object.keys(myPending).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-700">받은 연합 신청</p>
          {Object.keys(myPending).map((fromGid) => {
            const g = groups[fromGid]
            if (!g) return null
            return (
              <div
                key={fromGid}
                className={`p-2 rounded-lg border-2 flex items-center justify-between ${topicBg(
                  config?.topics?.[g?.topic]?.color || g?.color,
                )}`}
              >
                <span className="text-sm">
                  <strong>{g.name}</strong> 모둠과 연합?
                </span>
                <button
                  onClick={() => acceptRequest(fromGid)}
                  className="text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                >
                  수락
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 학생: 다른 모둠에 연합 신청 */}
      {eligibleAsRequester && otherGroups.length > 0 && !myActive && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-700">
            연합할 모둠 선택 (1분 안에)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherGroups.map(([gid, g]) => {
              const sent = sentByMe && sentByMe[0] === gid
              return (
                <button
                  key={gid}
                  onClick={() =>
                    sent ? cancelRequest(gid) : requestAlliance(gid)
                  }
                  className={`p-2 rounded-lg border-2 text-left ${
                    sent
                      ? 'bg-amber-100 border-amber-400'
                      : 'bg-white border-gray-200 hover:border-amber-400'
                  }`}
                >
                  <div className="text-sm font-bold">{g.name}</div>
                  <div className="text-xs text-gray-500">
                    {sent ? '신청 보냄 (취소하려면 다시 클릭)' : '연합 신청'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!timer?.active && Object.keys(active).length === 0 && (
        <p className="text-xs text-gray-400">
          타이머가 시작되면 야당 연합을 신청할 수 있습니다.
        </p>
      )}
    </div>
  )
}

export default AlliancePanel
