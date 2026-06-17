import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { setAt, updateAt, pushUnder, removeAt } from '../../lib/rtdb-helpers'
import { topicBg } from '../../styles/tokens'
import { useWorkflow } from '../../lib/use-workflow'

/** 구호 한 줄 입력 — Enter 또는 ↵ 버튼으로 추가, 입력값 자동 비움 */
function SloganInput({ onAdd }) {
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t) return
    onAdd(t)
    setVal('')
  }
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }
  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        placeholder="새 구호 입력 후 ↵"
        maxLength={40}
        className="flex-1 text-sm bg-white/80 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!val.trim()}
        className="px-3 py-1 text-sm rounded bg-indigo-600 text-white font-semibold disabled:opacity-40"
        title="Enter로 빠르게 추가"
      >
        ↵
      </button>
    </div>
  )
}

function GroupJoinPanel() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const config = useGameStore((s) => s.config)
  const wf = useWorkflow()

  const topics = config?.topics || {}
  const assignmentMode = config?.assignmentMode || 'free'
  const assignedSlots = config?.assignedSlots || {}
  const maxPerGroup = config?.maxPerGroup || 4

  const [busy, setBusy] = useState(false)

  // 토픽 + 그룹 데이터를 합쳐 보여주기 (group이 아직 없으면 빈 모둠으로 표시)
  const groupViews = useMemo(() => {
    return Object.entries(topics).map(([id, t]) => {
      const data = groups[id] || {}
      const memberIds = Object.keys(data.members || {})
      const memberList = memberIds
        .map((sid) => students[sid])
        .filter(Boolean)
      const slogansList = Object.entries(data.slogans || {})
        .map(([sid, s]) => ({ id: sid, ...s }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      return {
        id,
        emoji: t.emoji,
        color: t.color,
        baseName: t.name,
        name: data.name || t.name,
        slogan: data.slogan || '',     // legacy 단일 슬로건 (호환)
        slogans: slogansList,           // v2 — 여러 슬로건
        memberIds,
        memberList,
        full: memberIds.length >= maxPerGroup,
      }
    })
  }, [topics, groups, students, maxPerGroup])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return groupViews.find((g) => g.memberIds.includes(myStudentId))?.id ?? null
  }, [groupViews, myStudentId])

  // 지정 모드: 학생이 자기 모둠에 자동 합류
  useEffect(() => {
    if (
      role !== 'student' ||
      assignmentMode !== 'assigned' ||
      !myStudentId ||
      myGroupId
    )
      return
    const target = assignedSlots[myNumber]
    if (!target || !topics[target]) return

    // [Antigravity] '국민청원'이나 '오프닝' 단계에서는 자동 합류 차단
    if (wf.currentStep?.id === 'opening' || wf.currentStep?.id === 'petition') return

    // 비동기 합류 (race 방지: busy 검사)
    if (busy) return
    ;(async () => {
      setBusy(true)
      try {
        const existing = groups[target]
        if (!existing) {
          await setAt(roomCode, `groups/${target}`, {
            name: topics[target].name,
            topic: target,
            slogan: '',
            members: { [myStudentId]: true },
            createdAt: Date.now(),
          })
        } else {
          await updateAt(roomCode, `groups/${target}/members`, {
            [myStudentId]: true,
          })
        }
        await updateAt(roomCode, `students/${myStudentId}`, { groupId: target })
      } finally {
        setBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, assignmentMode, myStudentId, myNumber, myGroupId, assignedSlots, topics])

  const handleJoin = async (group) => {
    if (busy) return

    // [Antigravity] '국민청원'이나 '오프닝' 단계에서는 합류 차단
    if (wf.currentStep?.id === 'opening' || wf.currentStep?.id === 'petition') {
      alert('아직 시민단체 활동 단계가 아닙니다. 국민청원 활동에 집중해 주세요!')
      return
    }

    if (assignmentMode === 'assigned') {
      alert(
        `이 학급은 번호별 지정 모드입니다.\n선생님이 정해 둔 단체에 자동으로 합류합니다.`,
      )
      return
    }
    if (myGroupId === group.id) return
    if (group.full && myGroupId !== group.id) {
      alert(`이 모둠은 이미 ${maxPerGroup}명입니다.`)
      return
    }

    setBusy(true)
    try {
      if (myGroupId) {
        await updateAt(roomCode, `groups/${myGroupId}/members`, {
          [myStudentId]: null,
        })
      }
      const existing = groups[group.id]
      if (!existing) {
        await setAt(roomCode, `groups/${group.id}`, {
          name: group.baseName,
          topic: group.id,
          slogan: '',
          members: { [myStudentId]: true },
          createdAt: Date.now(),
        })
      } else {
        await updateAt(roomCode, `groups/${group.id}/members`, {
          [myStudentId]: true,
        })
      }
      await updateAt(roomCode, `students/${myStudentId}`, {
        groupId: group.id,
      })
    } catch (e) {
      alert('합류 실패: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async (group, value) => {
    await updateAt(roomCode, `groups/${group.id}`, { name: value })
  }
  const addSlogan = async (group, text) => {
    const t = (text || '').trim()
    if (!t) return
    await pushUnder(roomCode, `groups/${group.id}/slogans`, {
      text: t,
      authorStudentId: myStudentId,
      authorNumber: myNumber,
      authorNickname: myNickname,
    })
  }
  const removeSlogan = async (group, sloganId) => {
    await removeAt(roomCode, `groups/${group.id}/slogans/${sloganId}`)
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-amber-800">시민단체 결성</h2>
        <p className="text-xs text-gray-500">
          {assignmentMode === 'assigned'
            ? `🔒 번호별 지정 모드 — 선생님이 정해 둔 단체에 자동 배정됩니다.`
            : `자유 합류 모드 — 모둠당 최대 ${maxPerGroup}명.`}
        </p>
      </div>

      {Object.keys(topics).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400">
          시민단체가 아직 설정되지 않았어요. 선생님이 교사실에서 설정 중입니다.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groupViews.map((g) => {
            const isMine = myGroupId === g.id
            const assignedNumbers = Object.entries(assignedSlots)
              .filter(([, gid]) => gid === g.id)
              .map(([n]) => Number(n))
              .sort((a, b) => a - b)
            return (
              <div
                key={g.id}
                className={`p-4 rounded-2xl border-2 transition ${topicBg(g.color)} ${
                  isMine ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-3xl">{g.emoji}</span>
                  <div className="flex-1 min-w-0">
                    {isMine ? (
                      <input
                        type="text"
                        defaultValue={g.name}
                        onBlur={(e) => handleRename(g, e.target.value)}
                        className="w-full font-bold text-base bg-transparent border-b border-dashed focus:outline-none"
                      />
                    ) : (
                      <h3 className="font-bold text-base">{g.name}</h3>
                    )}
                    <p className="text-xs text-gray-500">주제: {g.baseName}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {g.memberIds.length}/{maxPerGroup}
                  </span>
                </div>

                {assignmentMode === 'assigned' && assignedNumbers.length > 0 && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    배정된 번호:{' '}
                    {assignedNumbers.length > 8
                      ? `${assignedNumbers.slice(0, 8).join(', ')} 외 ${assignedNumbers.length - 8}명`
                      : assignedNumbers.join(', ')}
                  </p>
                )}

                {/* 구호 — 멤버 누구나 여러 개 추가 가능. 작성자 이름 표시. */}
                {(isMine || g.slogans.length > 0 || g.slogan) && (
                  <div className="mt-2 space-y-1">
                    {/* 기존 단일 slogan(호환) */}
                    {g.slogan && (
                      <p className="text-sm italic text-gray-700">"{g.slogan}"</p>
                    )}
                    {/* 새 다중 슬로건 */}
                    <ul className="space-y-1">
                      {g.slogans.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-baseline gap-2 bg-white/70 rounded px-2 py-1 text-sm group"
                        >
                          <span className="flex-1 italic">"{s.text}"</span>
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            — {s.authorNumber}번 {s.authorNickname}
                          </span>
                          {isMine && s.authorStudentId === myStudentId && (
                            <button
                              type="button"
                              onClick={() => removeSlogan(g, s.id)}
                              className="text-[11px] text-gray-400 hover:text-red-600"
                              title="삭제"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {/* 자기 모둠일 때 입력 폼 */}
                    {isMine && (
                      <SloganInput onAdd={(t) => addSlogan(g, t)} />
                    )}
                  </div>
                )}

                <ul className="mt-2 text-xs text-gray-700 space-y-0.5 min-h-[24px]">
                  {g.memberList.length === 0 && (
                    <li className="text-gray-400">아직 비어 있어요</li>
                  )}
                  {g.memberList.map((m) => (
                    <li
                      key={m.number}
                      className={
                        myStudentId === `student_${m.number}`
                          ? 'font-bold text-indigo-700'
                          : ''
                      }
                    >
                      · {m.number}번 {m.nickname}
                    </li>
                  ))}
                </ul>

                {role === 'student' && assignmentMode === 'free' && (
                  <button
                    onClick={() => handleJoin(g)}
                    disabled={busy || isMine || (g.full && !isMine)}
                    className={`mt-2 w-full py-2 text-sm rounded-lg font-semibold transition ${
                      isMine
                        ? 'bg-indigo-600 text-white cursor-default'
                        : g.full
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                  >
                    {isMine
                      ? '✓ 우리 모둠'
                      : g.full
                      ? '꽉 찼어요'
                      : '합류하기'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {role === 'student' && assignmentMode === 'free' && !myGroupId && Object.keys(topics).length > 0 && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
          🚩 아직 합류한 모둠이 없어요. 위에서 한 곳을 골라 합류해 주세요.
        </p>
      )}
      {role === 'student' && assignmentMode === 'assigned' && !myGroupId && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
          🚩 {myNumber}번에 배정된 단체가 없습니다. 선생님께 확인해 주세요.
        </p>
      )}
    </section>
  )
}

export default GroupJoinPanel
