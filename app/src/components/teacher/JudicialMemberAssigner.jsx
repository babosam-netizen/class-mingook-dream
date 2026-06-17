/**
 * JudicialMemberAssigner.jsx
 * 사법부 팀 배정 — 모둠 통째 배정 + 개인별 배정을 동시에 다루는 혼합 배정 UI.
 */
import { useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import {
  JUDICIAL_SIDES,
  JUDICIAL_SIDE_LABEL,
  getJudicialAssignmentSummary,
} from '../../lib/judicial-teams'

const SIDE_BTN = {
  judge: 'bg-slate-600',
  prosecution: 'bg-red-600',
  defense: 'bg-sky-600',
  jury: 'bg-violet-600',
  witness: 'bg-amber-600',
  press: 'bg-emerald-600',
}

const shortLabel = (side) => JUDICIAL_SIDE_LABEL[side]?.replace(/^[^\s]+ /, '') || side

export default function JudicialMemberAssigner({ bc, onChange, sides = JUDICIAL_SIDES, compact = false }) {
  const students = useGameStore((s) => s.students)
  const groups = useGameStore((s) => s.groups)
  const branchConfig = bc || {}
  const jud = branchConfig.judicial || {}
  const members = jud.members || {}
  const offeredSides = sides.filter((s) => JUDICIAL_SIDES.includes(s))

  const groupList = useMemo(() => {
    return Object.entries(groups || {})
      .map(([gid, g]) => ({
        gid,
        name: g?.name || gid,
        memberIds: Object.keys(g?.members || {}),
      }))
      .filter((g) => g.memberIds.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [groups])

  const studentList = useMemo(() => {
    const groupByStudent = {}
    for (const [gid, g] of Object.entries(groups || {})) {
      for (const sid of Object.keys(g?.members || {})) groupByStudent[sid] = gid
    }
    const arr = Object.entries(students || {}).map(([sid, s]) => {
      const groupId = s?.groupId || groupByStudent[sid] || ''
      return {
        sid,
        number: s?.number,
        nickname: s?.nickname || sid,
        groupId,
        groupName: groups?.[groupId]?.name || '',
      }
    })
    arr.sort((a, b) => (a.number || 999) - (b.number || 999))
    return arr
  }, [students, groups])

  const personalSideOf = (sid) => {
    for (const s of offeredSides) {
      if (members[s] && members[s][sid]) return s
    }
    return null
  }

  const groupSideOf = (gid) => {
    for (const s of offeredSides) {
      if ((jud[s] || []).some((u) => u?.groupId === gid)) return s
    }
    return null
  }

  const setStudentSide = (sid, side) => {
    const nextMembers = {}
    for (const s of JUDICIAL_SIDES) {
      const map = { ...(members[s] || {}) }
      if (s === side) map[sid] = true
      else delete map[sid]
      nextMembers[s] = map
    }
    onChange({ ...branchConfig, judicial: { ...jud, members: nextMembers, assignMode: 'individual' } })
  }

  const setGroupSide = (gid, side) => {
    const nextJud = { ...jud, assignMode: 'individual' }
    for (const s of JUDICIAL_SIDES) {
      const arr = [...(nextJud[s] || [])].filter((u) => u?.groupId !== gid)
      if (s === side && gid) arr.push({ unitId: `${s}_${gid}`, groupId: gid, representativeStudentId: '' })
      nextJud[s] = arr
    }
    onChange({ ...branchConfig, judicial: nextJud })
  }

  const clearPersonal = () => {
    if (!confirm('개인별 배정을 모두 해제할까요? 모둠 통째 배정은 유지됩니다.')) return
    const nextMembers = {}
    for (const s of JUDICIAL_SIDES) nextMembers[s] = {}
    onChange({ ...branchConfig, judicial: { ...jud, members: nextMembers, assignMode: 'individual' } })
  }

  const summary = getJudicialAssignmentSummary(jud, groups, students, offeredSides)
  const hasAny = offeredSides.some((side) => summary[side]?.groups.length || summary[side]?.students.length)

  return (
    <div className={`rounded-lg border border-rose-100 bg-white p-2.5 grid gap-3 ${compact ? 'md:grid-cols-[minmax(0,1fr)_220px]' : 'lg:grid-cols-[minmax(0,1fr)_260px]'}`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[10px] font-black text-rose-700">🧑‍⚖️ 역할 배정</p>
            <p className="text-[9px] text-gray-500 mt-0.5">
              모둠 통째 배정과 개인별 배정을 함께 사용할 수 있습니다. 개인별 배정은 모둠 배정보다 우선합니다.
            </p>
          </div>
          <button type="button" onClick={clearPersonal} className="text-[10px] text-rose-500 hover:underline">
            개인 배정 해제
          </button>
        </div>

        {groupList.length > 0 && (
          <details className="rounded-lg bg-rose-50/60 border border-rose-100 px-2 py-1.5 text-[10px]" open>
            <summary className="cursor-pointer font-black text-rose-700">모둠 통째로 배정하기</summary>
            <div className="mt-1.5 space-y-1">
              {groupList.map((g) => {
                const cur = groupSideOf(g.gid)
                return (
                  <div key={g.gid} className="flex items-center gap-1 flex-wrap border-t border-rose-100/70 pt-1 first:border-t-0 first:pt-0">
                    <span className="text-gray-700 font-semibold w-24 truncate shrink-0">{g.name}</span>
                    {offeredSides.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGroupSide(g.gid, cur === s ? null : s)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          cur === s ? `${SIDE_BTN[s]} text-white` : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {shortLabel(s)}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </details>
        )}

        <div className={`space-y-0.5 overflow-y-auto ${compact ? 'max-h-60' : 'max-h-80'}`}>
          {studentList.length === 0 ? (
            <p className="text-[10px] text-gray-400">아직 입장한 학생이 없습니다.</p>
          ) : studentList.map((st) => {
            const personal = personalSideOf(st.sid)
            const inherited = st.groupId ? groupSideOf(st.groupId) : null
            return (
              <div key={st.sid} className="flex items-center gap-1 py-0.5 border-b border-gray-50">
                <span className="text-[10px] text-gray-700 w-32 truncate shrink-0">
                  {st.number ? `${st.number}번 ` : ''}{st.nickname}
                  {st.groupName && <span className="text-gray-300"> · {st.groupName}</span>}
                </span>
                <div className="flex gap-0.5 flex-wrap flex-1">
                  {offeredSides.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStudentSide(st.sid, personal === s ? null : s)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                        personal === s
                          ? `${SIDE_BTN[s]} text-white`
                          : inherited === s
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title={inherited === s && !personal ? `${st.groupName} 모둠 통째 배정` : undefined}
                    >
                      {shortLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <AssignmentSummary summary={summary} offeredSides={offeredSides} hasAny={hasAny} />
    </div>
  )
}

function AssignmentSummary({ summary, offeredSides, hasAny }) {
  return (
    <aside className="rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-2">
      <p className="text-[10px] font-black text-slate-700">오른쪽 배정 현황</p>
      {!hasAny && <p className="text-[10px] text-slate-400">아직 배정된 모둠이나 학생이 없습니다.</p>}
      {offeredSides.map((side) => {
        const item = summary[side] || { groups: [], students: [] }
        return (
          <div key={side} className="rounded-md bg-white border border-slate-100 px-2 py-1.5">
            <p className="text-[10px] font-black text-slate-800">{JUDICIAL_SIDE_LABEL[side]}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              통째 모둠: {item.groups.length ? item.groups.map((g) => g.name).join(', ') : '-'}
            </p>
            <p className="text-[9px] text-slate-500">
              개인: {item.students.length ? item.students.map((s) => s.name).join(', ') : '-'}
            </p>
          </div>
        )
      })}
    </aside>
  )
}
