import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { normalizeTodo, decorateRoleForContext, DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

const EMPTY_ROLES = []
const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

/**
 * 모둠원 전체의 역할별 작업 진행 요약 — 누가 무엇을 어떻게 정리했는지 한눈에.
 *
 * 표시 내용:
 *  - 4역할별 카드 (담당자, 작성 진행 상태, 작업 메모 요약)
 *  - 클릭 시 상세 내용 펼침
 *  - 본인이 아닌 모둠원이 작성한 내용도 모두 노출 — 협업 가시화
 *
 * @param {{groupId, sessionId, kind: 'legislative'|'executive'|'judicial', statusOnly?: boolean, statusProgressByRole?: Record<string, number>}} props
 */
function GroupRoleSummary({ groupId, sessionId, kind, statusOnly = false, statusProgressByRole = null, filterSide = null }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const rolesForKind = useGameStore((s) => s.config?.roles?.[kind])
  const config = useGameStore((s) => s.config)
  // 역할 우선순위: config.roles.[kind] → config.branchConfig.[kind].roles → DEFAULT_ROLES[kind]
  const baseRolesAll = normalizeRoleList(
    kind,
    rolesForKind || config?.branchConfig?.[kind]?.roles || DEFAULT_ROLES[kind] || EMPTY_ROLES,
  )
  // 사법부: 팀 구분에 맞는 역할만 표시
  // v3 workMode: collaborative→lead만, role→lead 제외 (배심원·판사 특수 처리)
  const baseRoles = (() => {
    if (kind !== 'judicial' || !filterSide) return baseRolesAll
    const sideRoles = baseRolesAll.filter((r) => r.side === filterSide)
    const workMode = config?.branchConfig?.judicial?.workMode || 'role'
    const isJury = filterSide === 'jury'
    const isJudge = filterSide === 'judge'
    const useCollab = (workMode === 'collaborative' || isJury) && !isJudge
    if (useCollab) {
      const lead = sideRoles.filter((r) => r.collaborativeOnly)
      return lead.length > 0 ? lead : sideRoles.filter((r) => !r.collaborativeOnly)
    }
    return sideRoles.filter((r) => !r.collaborativeOnly)
  })()

  // 컨텍스트별 라벨 변환 (행정부 장관은 모둠 부처명 적용)
  const group = groups?.[groupId]
  const allRoles = baseRoles.map((r) => decorateRoleForContext(r, group, config, kind))

  const [notes, setNotes] = useState({})

  useEffect(() => {
    if (!roomCode || !groupId || !sessionId) return
    const u = subscribe(roomCode, `groups/${groupId}/roleNotes/${sessionId}`, (d) => setNotes(d || {}))
    return () => u?.()
  }, [roomCode, groupId, sessionId])

  if (!groupId) return null
  if (!group) return null

  // sessionRoles 에서 각 역할 담당자(studentId) 추출
  const sessionRoles = group.sessionRoles?.[sessionId] || {}
  // 역할별 담당자 매핑 (roleKey → studentId)
  const assigneeByRole = {}
  for (const [stuId, roleKey] of Object.entries(sessionRoles)) {
    assigneeByRole[roleKey] = stuId
  }

  const memberCount = group.members ? Object.keys(group.members).length : 0
  const filledRoles = allRoles.filter((r) => {
    const note = notes[r.key]
    return note?.fields && Object.values(note.fields).some((v) => String(v || '').trim())
  }).length

  return (
    <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-4 border-amber-400 rounded-2xl p-4 space-y-3 shadow-lg">
      {/* 강조 헤더 — 우리 모둠임을 한눈에 */}
      <header className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
            👥 우리 모둠
          </span>
          <h3 className="text-lg font-black text-amber-900 mt-1">
            🏛️ {group.name}
            <span className="ml-2 text-xs font-normal text-amber-700">
              · {memberCount}명 · {filledRoles}/{allRoles.length}역할 작성 중
            </span>
          </h3>
        </div>
        <p className="text-[11px] text-amber-700 max-w-xs text-right">
          모둠원이 각자 역할에 맞게 정리한 내용을 한눈에 볼 수 있어요.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-2">
        {allRoles.map((roleMeta) => {
          const assigneeId = assigneeByRole[roleMeta.key]
          const assignee = assigneeId ? group.members?.[assigneeId] : null
          const note = notes[roleMeta.key]
          const isMe = assigneeId === myStudentId
          const filledCount = note?.fields
            ? Object.values(note.fields).filter((v) => String(v || '').trim()).length
            : 0
          const totalTodos = roleMeta.todos?.length || 0
          let progressPct = totalTodos > 0 ? Math.round((filledCount / totalTodos) * 100) : 0
          const overridden = statusProgressByRole?.[roleMeta.key]
          if (typeof overridden === 'number') {
            progressPct = overridden <= 1
              ? Math.round(overridden * 100)
              : Math.max(0, Math.min(100, Math.round(overridden)))
          }

          if (statusOnly) {
            return (
              <div
                key={roleMeta.key}
                className={`bg-white rounded-xl border p-2.5 flex items-center gap-2 ${
                  isMe ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
                }`}
              >
                <span className="text-lg">{roleMeta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold flex items-center gap-1">
                    {getText(roleMeta.label)}
                    {isMe && <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">나</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {assignee
                      ? `${assignee.number || note?.studentNumber || ''}번 ${assignee.nickname || note?.studentName || ''}`.trim() || '담당자 미지정'
                      : '담당자 미지정'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold ${
                    progressPct === 100 ? 'text-emerald-600'
                    : progressPct > 0 ? 'text-amber-600'
                    : 'text-gray-400'
                  }`}>
                    {progressPct === 100 ? '✓ 완료' : progressPct > 0 ? `${progressPct}%` : '대기'}
                  </div>
                  <div className="w-12 h-1 mt-0.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          }

          return (
            <details
              key={roleMeta.key}
              className={`bg-white rounded-xl border p-2.5 group ${
                isMe ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
              }`}
            >
              <summary className="cursor-pointer list-none flex items-center gap-2">
                <span className="text-lg">{roleMeta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold flex items-center gap-1">
                    {getText(roleMeta.label)}
                    {isMe && <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">나</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {assignee
                      ? `${assignee.number || note?.studentNumber || ''}번 ${assignee.nickname || note?.studentName || ''}`.trim() || '담당자 미지정'
                      : '담당자 미지정'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold ${
                    progressPct === 100 ? 'text-emerald-600'
                    : progressPct > 0 ? 'text-amber-600'
                    : 'text-gray-400'
                  }`}>
                    {progressPct === 100 ? '✓ 완료' : progressPct > 0 ? `${progressPct}%` : '대기'}
                  </div>
                  <div className="w-12 h-1 mt-0.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-300 text-xs group-open:rotate-180 transition">▼</span>
              </summary>

              {(roleMeta.todos || []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  {roleMeta.todos.map((todoRaw, i) => {
                    const todo = normalizeTodo(todoRaw)
                    const v = note?.fields?.[i]
                    return (
                      <div key={i} className="text-xs">
                        <p className="text-[10px] text-gray-500 font-semibold">
                          {i + 1}. {todo.label}
                        </p>
                        {v ? (
                          <p className="text-gray-800 whitespace-pre-wrap pl-2 border-l-2 border-indigo-200">
                            {v}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-300 italic pl-2">아직 작성 전</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </details>
          )
        })}
      </div>
    </section>
  )
}

export default GroupRoleSummary
