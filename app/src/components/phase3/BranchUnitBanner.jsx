import { useMemo } from 'react'
import useGameStore from '../../store/gameStore'

/**
 * Phase 3 각 탭 최상단에 표시되는 부서 배치 현황 배너
 *
 * props:
 *   branch : 'legislative' | 'executive' | 'judicial'
 *   side   : (judicial 전용) 'prosecution' | 'defense' | null
 *
 * branchConfig.legislative.units 가 비어 있으면 렌더링 없음 (기존 단일 문서 동작 유지).
 * 학생은 자신이 속한 유닛을 강조 표시로 확인한다.
 * 교사(previewMode 포함)는 모든 유닛 현황을 확인한다.
 */
export default function BranchUnitBanner({ branch, side = null }) {
  const role          = useGameStore((s) => s.role)
  const myStudentId   = useGameStore((s) => s.myStudentId)
  const groups        = useGameStore((s) => s.groups)
  const branchConfig  = useGameStore((s) => s.config?.branchConfig)

  // branchConfig 없거나 해당 부서 유닛이 없으면 렌더링 안 함
  const units = useMemo(() => {
    if (!branchConfig) return []
    if (branch === 'judicial') {
      if (side) return branchConfig.judicial?.[side] || []
      // side 없이 judicial 전체 보기 (교사용)
      return [
        ...(branchConfig.judicial?.prosecution || []).map((u) => ({ ...u, _side: 'prosecution' })),
        ...(branchConfig.judicial?.defense     || []).map((u) => ({ ...u, _side: 'defense'     })),
      ]
    }
    const rawUnits = [...(branchConfig[branch]?.units || [])]
    if (branch === 'executive') {
      const pGid = branchConfig.executive?.presidentGroupId
      if (pGid) {
        const hasPresidentUnit = rawUnits.some((u) => u.groupId === pGid)
        if (!hasPresidentUnit) {
          rawUnits.push({
            unitId: 'exe-president',
            groupId: pGid,
            ministryName: branchConfig.executive?.presidentMinistryName || '대통령실',
            title: branchConfig.executive?.presidentMinistryName || '대통령실',
            representativeStudentId: null
          })
        }
      }
    }
    return rawUnits
  }, [branchConfig, branch, side])

  // 내 모둠 ID
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 내 유닛 (학생인 경우)
  const myUnit = useMemo(
    () => units.find((u) => u.groupId === myGroupId) || null,
    [units, myGroupId],
  )

  // 평가단 확인
  const myEvalRole = useMemo(() => {
    if (!myGroupId || !branchConfig?.evaluators) return null
    return branchConfig.evaluators.find((e) => e.groupId === myGroupId) || null
  }, [myGroupId, branchConfig])

  if (units.length === 0 && !myEvalRole) return null

  // 메타
  const BRANCH_META = {
    legislative: { label: '입법부',  color: 'indigo', unitLabel: '법안' },
    executive:   { label: '행정부',  color: 'amber',  unitLabel: '정책' },
    judicial:    { label: '사법부',  color: 'rose',   unitLabel: '변론' },
  }
  const SIDE_META = {
    prosecution: { label: '검사팀', emoji: '👨‍💼' },
    defense:     { label: '변호팀', emoji: '🛡️' },
  }
  const meta = BRANCH_META[branch]
  const isCollaborativeBranch = ['legislative', 'executive'].includes(branch)
    && branchConfig?.[branch]?.mode === 'collaborative'

  const colorMap = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-600 text-white', muted: 'bg-indigo-100 text-indigo-600' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-600 text-white',  muted: 'bg-amber-100 text-amber-600'  },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-800',   badge: 'bg-rose-600 text-white',   muted: 'bg-rose-100 text-rose-600'    },
    emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-800',badge: 'bg-emerald-600 text-white',muted: 'bg-emerald-100 text-emerald-600'},
  }
  const c = colorMap[meta.color]

  // 평가단 학생인 경우 별도 배너
  if (role === 'student' && myEvalRole && !myUnit) {
    const isPress    = myEvalRole.type === 'press'
    const evalColor  = colorMap.emerald
    return (
      <div className={`rounded-xl border ${evalColor.border} ${evalColor.bg} px-4 py-3 flex items-center gap-3`}>
        <span className="text-xl">{isPress ? '📰' : '🏛️'}</span>
        <div>
          <div className={`text-sm font-bold ${evalColor.text}`}>
            {isPress ? '기사단' : '시민단체'} 역할
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isPress
              ? '이 탭의 모든 모둠 작업을 열람하고, 평가 기사를 작성합니다.'
              : '이 탭의 모든 모둠 작업을 열람하고, 요청 댓글을 보냅니다.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-2`}>
      {/* 헤더 */}
      <div className={`text-xs font-bold ${c.text} flex items-center gap-1.5`}>
        <span>📋</span>
        <span>{meta.label} 참여 모둠 ({units.length}개 {meta.unitLabel})</span>
        {units.length > 0 && role === 'student' && !myUnit && (
          <span className="ml-auto text-gray-400 font-normal">관찰자 모드</span>
        )}
      </div>

      {/* 유닛 목록 */}
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => {
          const group   = groups?.[unit.groupId]
          const isMe    = unit.groupId === myGroupId
          const isRep   = unit.representativeStudentId === myStudentId
          const sideMeta = unit._side ? SIDE_META[unit._side] : null
          const label   = unit.ministryName || unit.title ||
                          (sideMeta ? `${sideMeta.emoji} ${sideMeta.label}` : '') ||
                          meta.unitLabel

          return (
            <div
              key={unit.unitId}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                isMe
                  ? `${c.badge} border-transparent shadow-sm`
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <span>{group?.emoji || '👥'}</span>
              <span>{group?.name || unit.groupId}</span>
              {label && <span className="opacity-70">— {label}</span>}
              {isRep && <span className="ml-1">👑</span>}
              {isMe && !isRep && <span className="ml-1">✓</span>}
            </div>
          )
        })}
      </div>

      {/* 내 역할 안내 (학생) */}
      {role === 'student' && myUnit && (
        <div className={`text-xs ${c.text} opacity-80`}>
          {myUnit.representativeStudentId === myStudentId
            ? `👑 대표로서 전체 섹션을 편집하고 최종 확정할 수 있습니다.`
            : `내 모둠이 이 ${meta.label}에 참여합니다. 담당 섹션을 작성하세요.`}
        </div>
      )}

      {/* 교사: 대표 미지정 경고 */}
      {role === 'teacher' && !isCollaborativeBranch && units.some((u) => u.groupId && !u.representativeStudentId) && (
        <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
          ⚠️ 대표가 지정되지 않은 모둠이 있습니다. 학급 설정에서 대표를 지정하세요.
        </div>
      )}
    </div>
  )
}
