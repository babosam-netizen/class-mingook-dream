import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

/**
 * 모둠 내 4역할 배정 (셀렉터 방식 — 태블릿 안정성)
 *
 * 사용 컨텍스트: Phase 3의 입법/행정/사법 첫 차시 도입.
 *   - kind: 'legislative'|'executive'|'judicial' (어떤 역할 풀을 쓸지)
 *   - sessionId: 'legislative-10' 같은 식별자(차시 단위 저장)
 *   - groupId: 자기 모둠
 *
 * 모둠 멤버 4명에게 4개 역할을 1:1로 배정. 같은 차시 내 중복 차단.
 *
 * RTDB: rooms/{rc}/groups/{gid}/sessionRoles/{sessionId} = { studentId: roleKey }
 */
const EMPTY_ROLES = []
const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

const JUDICIAL_TEAM_INTRO = {
  judge: {
    label: '판사 모둠',
    body: '재판의 흐름을 정리하고, 양쪽 주장과 증거를 비교해 판결 기준을 세웁니다.',
  },
  prosecution: {
    label: '검사팀',
    body: '피고인의 책임을 입증하기 위해 법 조항, 피해 사실, 증거의 신빙성을 정리합니다.',
  },
  defense: {
    label: '변호팀',
    body: '피고인의 입장을 방어하고, 반박 근거와 정상참작 사유를 설득력 있게 제시합니다.',
  },
  witness: {
    label: '증인 모둠',
    body: '사건을 직접 보거나 관련 사실을 아는 사람의 입장에서 진술을 준비합니다.',
  },
  jury: {
    label: '배심원 모둠',
    body: '양쪽 주장을 공정하게 듣고, 유죄와 무죄 판단에 필요한 기준을 세웁니다.',
  },
  press: {
    label: '기자 모둠',
    body: '재판의 흐름과 쟁점을 시민에게 정확하고 균형 있게 전달할 기사를 준비합니다.',
  },
}

function roleDescription(role) {
  const bits = [
    role.desc,
    role.memoGuide?.[0],
    typeof role.todos?.[0] === 'object' ? role.todos?.[0]?.label : role.todos?.[0],
  ].filter(Boolean)
  return bits[0] || '이 역할이 맡을 핵심 임무를 확인하고, 모둠 안에서 책임 있게 나누어 맡습니다.'
}

function RoleAssigner({ groupId, sessionId, kind, filterSide, onClose }) {
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const config = useGameStore((s) => s.config)
  // selector는 안정 reference만 반환해야 함 (`|| []` 는 매번 새 배열 → 무한 루프)
  const rolesForKind = useGameStore((s) => s.config?.roles?.[kind])
  const roles = useMemo(() => {
    const g = groups?.[groupId]
    const isPresidentGroup = kind === 'executive' && (config?.branchConfig?.executive?.presidentGroupId === groupId || g?.name?.includes('대통령'))

    const baseSource = isPresidentGroup
      ? DEFAULT_ROLES.executive_president
      : (rolesForKind || config?.branchConfig?.[kind]?.roles || DEFAULT_ROLES[kind] || EMPTY_ROLES)

    // 역할 우선순위: config.roles.[kind] → config.branchConfig.[kind].roles → DEFAULT_ROLES[kind]
    const baseRoles = normalizeRoleList(kind, baseSource)
    if (kind === 'executive' && groupId) {
      const memberCount = g?.members ? Object.keys(g.members).length : 4
      const limit = Math.max(4, memberCount)
      return baseRoles.slice(0, limit)
    }
    // 사법부: 팀 구분(검사팀/변호팀/배심원팀 등)에 맞는 역할만 표시
    if (kind === 'judicial' && filterSide) {
      return baseRoles.filter((r) => r.side === filterSide)
    }
    return baseRoles
  }, [rolesForKind, kind, groupId, groups, config, filterSide])
  const assignSessionRoles = useGameStore((s) => s.assignSessionRoles)

  const group = groups[groupId]
  const memberIds = group?.members ? Object.keys(group.members) : []
  const existing = group?.sessionRoles?.[sessionId] || {}

  const [draft, setDraft] = useState({ ...existing })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ ...existing })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, groupId])

  const usedRoles = useMemo(() => {
    return new Set(Object.values(draft).filter(Boolean))
  }, [draft])

  const setRole = (sid, roleKey) => {
    setError('')
    setDraft((prev) => {
      const next = { ...prev }
      if (!roleKey) delete next[sid]
      else next[sid] = roleKey
      return next
    })
  }

  const onSave = async () => {
    setError('')
    // 중복 검증
    const counts = {}
    for (const v of Object.values(draft)) {
      counts[v] = (counts[v] || 0) + 1
    }
    const dups = Object.keys(counts).filter((k) => counts[k] > 1)
    if (dups.length > 0) {
      setError('같은 역할이 두 명에게 배정됐어요.')
      return
    }
    setBusy(true)
    try {
      await assignSessionRoles(groupId, sessionId, draft)
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!group) {
    return <p className="text-sm text-gray-500">모둠 정보가 없어요.</p>
  }
  if (memberIds.length === 0) {
    return <p className="text-sm text-gray-500">모둠 멤버가 없어요.</p>
  }
  if (roles.length === 0) {
    return <p className="text-sm text-gray-500">역할 데이터가 없어요.</p>
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-300 p-4 shadow space-y-3">
      <h3 className="font-bold text-indigo-800">🎭 모둠 내 4역할 배정</h3>
      <p className="text-xs text-gray-500">
        {group.name} 모둠의 4명에게 서로 다른 역할을 정해 주세요. 차시마다 새로 배정합니다.
      </p>

      {kind === 'judicial' && filterSide && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
          <div>
            <p className="text-xs font-black text-rose-800">
              {group.name} 모둠은 {JUDICIAL_TEAM_INTRO[filterSide]?.label || '사법부 팀'}입니다.
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
              {JUDICIAL_TEAM_INTRO[filterSide]?.body} 아래 역할을 읽고, 각자 맡을 일을 정해 보세요.
            </p>
          </div>
          <div className="grid gap-1.5">
            {roles.map((r) => (
              <div key={r.key} className="rounded-lg bg-white/80 border border-rose-100 px-2 py-1.5">
                <p className="text-[11px] font-bold text-slate-800">
                  {r.emoji} {getText(r.label)}
                </p>
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{roleDescription(r)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {memberIds.map((sid) => {
          const member = students[sid]
          const current = draft[sid] || ''
          return (
            <li
              key={sid}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
            >
              <span className="w-24 text-sm font-semibold">
                {member?.number}번 {member?.nickname}
              </span>
              <select
                value={current}
                onChange={(e) => setRole(sid, e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300"
              >
                <option value="">— 미정 —</option>
                {roles.map((r) => {
                  const taken = usedRoles.has(r.key) && current !== r.key
                  return (
                    <option key={r.key} value={r.key} disabled={taken}>
                      {r.emoji} {getText(r.label)} {taken ? '(다른 사람이 맡음)' : ''}
                    </option>
                  )
                })}
              </select>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700"
        >
          {busy ? '저장 중...' : '확정'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  )
}

export default RoleAssigner
