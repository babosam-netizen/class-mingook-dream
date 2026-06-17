import { useState, useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import { setAt } from '../../lib/rtdb-helpers'
import { DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

/**
 * 학생 자기 역할 선택 컴포넌트
 *
 * - 역할 카드 목록을 표시하고 각 학생이 자신의 역할을 직접 선택
 * - 선택된 역할: "내 역할 ✓" 배지 + 취소 버튼
 * - 다른 사람이 선택한 역할: 이름 표시, 선택 불가
 * - 잠금 상태: 모든 버튼 비활성화 + 안내 메시지
 *
 * RTDB: rooms/{rc}/groups/{gid}/sessionRoles/{sessionId}/{studentId} = roleKey
 */
const EMPTY_ROLES = []
const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

export default function RoleSelfSelector({ groupId, sessionId, kind, isLocked = false, filterSide = null }) {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const students    = useGameStore((s) => s.students)
  const config      = useGameStore((s) => s.config)
  const rolesForKind = useGameStore((s) => s.config?.roles?.[kind])
  const roles = useMemo(() => {
    // 역할 우선순위: config.roles.[kind] → config.branchConfig.[kind].roles → DEFAULT_ROLES[kind]
    const baseRoles = normalizeRoleList(
      kind,
      rolesForKind || config?.branchConfig?.[kind]?.roles || DEFAULT_ROLES[kind] || EMPTY_ROLES,
    )
    if (kind === 'executive' && groupId) {
      const g = groups?.[groupId]
      const memberCount = g?.members ? Object.keys(g.members).length : 4
      const limit = Math.max(4, memberCount)
      return baseRoles.slice(0, limit)
    }
    // 사법부: 팀 구분(검사팀/변호팀/증인/배심원/판사/기자)에 맞는 역할만 표시
    // v3 workMode: collaborative면 lead 역할만, role(역할중심)이면 collaborativeOnly 제외
    if (kind === 'judicial' && filterSide) {
      const sideRoles = baseRoles.filter((r) => r.side === filterSide)
      const workMode = config?.branchConfig?.judicial?.workMode || 'role'
      const isJury = filterSide === 'jury'
      const isJudge = filterSide === 'judge'
      const useCollab = (workMode === 'collaborative' || isJury) && !isJudge
      if (useCollab) {
        const lead = sideRoles.filter((r) => r.collaborativeOnly)
        return lead.length > 0 ? lead : sideRoles.filter((r) => !r.collaborativeOnly)
      }
      return sideRoles.filter((r) => !r.collaborativeOnly)
    }
    return baseRoles
  }, [rolesForKind, kind, groupId, groups, config, filterSide])

  const [busy, setBusy] = useState(false)

  const group = groups?.[groupId]
  const sessionRoleMap = group?.sessionRoles?.[sessionId] || {}

  // roleKey → studentId 역매핑 (현재 roles에 정의된 유효한 역할만 역매핑)
  const claimedBy = {}
  for (const [sid, roleKey] of Object.entries(sessionRoleMap)) {
    if (roleKey && roles.some((r) => r.key === roleKey)) {
      claimedBy[roleKey] = sid
    }
  }

  const myRoleKeyRaw = sessionRoleMap[myStudentId] || null
  const myRoleKey = useMemo(() => {
    if (!myRoleKeyRaw) return null
    const exists = roles.some((r) => r.key === myRoleKeyRaw)
    return exists ? myRoleKeyRaw : null
  }, [myRoleKeyRaw, roles])

  const claimRole = async (roleKey) => {
    if (!roomCode || !groupId || !myStudentId || busy || isLocked) return
    setBusy(true)
    try {
      await setAt(
        roomCode,
        `groups/${groupId}/sessionRoles/${sessionId}/${myStudentId}`,
        roleKey,
      )
    } finally {
      setBusy(false)
    }
  }

  const cancelRole = async () => {
    if (!roomCode || !groupId || !myStudentId || busy || isLocked) return
    setBusy(true)
    try {
      // Firebase에서 단일 필드를 null로 세팅하면 삭제
      await setAt(
        roomCode,
        `groups/${groupId}/sessionRoles/${sessionId}/${myStudentId}`,
        null,
      )
    } finally {
      setBusy(false)
    }
  }

  if (!group) return <p className="text-sm text-gray-400">모둠 정보가 없어요.</p>

  return (
    <div className="space-y-2">
      {isLocked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-sm">🔒</span>
          <p className="text-xs text-amber-800 font-semibold">
            선생님이 역할을 잠갔습니다. 변경이 필요하면 선생님께 문의하세요.
          </p>
        </div>
      )}

      {roles.map((roleDef) => {
        const key       = roleDef.key
        const isMine    = myRoleKey === key
        const ownerSid  = claimedBy[key]
        const ownerStudent = ownerSid ? students?.[ownerSid] : null
        const isTaken   = Boolean(ownerSid) && ownerSid !== myStudentId
        const guide     = roleDef.memoGuide?.[0] || ''

        return (
          <div
            key={key}
            className={`rounded-xl border-2 p-3 transition ${
              isMine
                ? 'border-indigo-400 bg-indigo-50'
                : isTaken
                ? 'border-gray-200 bg-gray-50 opacity-75'
                : 'border-gray-200 bg-white hover:border-indigo-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-2xl leading-none mt-0.5 shrink-0">{roleDef.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-sm font-bold text-gray-800">
                    {getText(roleDef.label)}
                  </span>
                  {roleDef.isRepresentative && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                      총괄 검토원
                    </span>
                  )}
                  {isMine && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                      내 역할 ✓
                    </span>
                  )}
                  {isTaken && ownerStudent && (
                    <span className="text-[11px] text-gray-500">
                      {ownerStudent.number}번 {ownerStudent.nickname}
                    </span>
                  )}
                </div>
                {guide && (
                  <p className="text-[11px] text-gray-500 leading-snug truncate">{guide}</p>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="shrink-0 ml-1">
                {isMine ? (
                  <button
                    onClick={cancelRole}
                    disabled={busy || isLocked}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-40"
                  >
                    취소
                  </button>
                ) : isTaken ? (
                  <span className="text-[11px] text-gray-400 px-2">맡음</span>
                ) : (
                  <button
                    onClick={() => claimRole(key)}
                    disabled={busy || isLocked || Boolean(myRoleKey)}
                    className="px-3 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    나 맡을게요
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
