import { useMemo, useState, useEffect, useRef } from 'react'
import useGameStore from '../../store/gameStore'
import { BIBIM_STATS, DEFAULT_EXECUTIVE_BUDGET, MINISTRY_TEMPLATES } from '../phase3/executiveBudgetData'
import { calculateRanks } from '../../lib/election'
import {
  DEFAULT_ROLES as SCAFFOLD_ROLES,
  DEFAULT_ROLE_EXAMPLES,
  normalizeRoleList,
} from '../../lib/scaffolding-data'
import { syncExecutiveRepresentative } from '../../lib/representative-sync'
import JudicialCaseSetupPanel from './JudicialCaseSetupPanel'
import JudicialMemberAssigner from './JudicialMemberAssigner'

/** scaffolding-data 역할 객체 → RolesEditor 포맷으로 변환 */
function scaffoldToEditorRole(r) {
  return {
    ...r,
    id: r.key,
    key: r.key,
    emoji: r.emoji,
    label: r.label,
    name: r.label,
    desc: r.desc ?? (r.isRepresentative
      ? (r.sectionLabel ? `${r.sectionLabel} 작성 + 전체 검토·확정` : '전체 검토 및 확정')
      : (r.sectionLabel ? `${r.sectionLabel} 섹션 담당` : '')),
    memoGuide: r.memoGuide || [],
    todos: r.todos || [],
  }
}

/**
 * Phase 3 부서 단위 배치 설정 편집기
 *
 * props:
 *   value   : config.branchConfig 객체
 *   onChange: (nextBranchConfig) => void
 *
 * 교사가 각 부서에 모둠을 배치하고, 각 단위의 대표를 지정한다.
 * 배치되지 않은 모둠은 평가단(시민단/기사단)으로 배치할 수 있다.
 * 모든 모둠이 배치되면 평가단 섹션은 숨긴다.
 */

const BRANCH_META = {
  legislative: { label: '입법부', emoji: '🏛️', color: 'indigo',  unitLabel: '법안',  titlePlaceholder: '예: 환경보호특별법안', addLabel: '+ 입법 모둠 추가' },
  executive:   { label: '행정부', emoji: '🇰🇷', color: 'amber',   unitLabel: '부처',  titlePlaceholder: '예: 환경부',           addLabel: '+ 행정 모둠 추가' },
}

const EVAL_TYPES = [
  { value: 'citizens', label: '🏛️ 시민단체', desc: '각 부서 작업에 요청 댓글 전달' },
  { value: 'press',    label: '📰 기사단',   desc: '평가 기사 작성 → 해당 모둠 상단 피드' },
]


function genUnitId(prefix) {
  return `${prefix}_${Date.now().toString(36).slice(-5)}`
}

/** 배정된 groupId 집합 반환 (특정 부서(department) 내로 한정하거나 전체 반환) */
function assignedGroupIds(bc, filterDepartment = null, excludePos = null) {
  const ids = new Set()

  const addUnits = (units, department, collection) => {
    if (filterDepartment && filterDepartment !== department) return
    units.forEach((u, i) => {
      if (
        excludePos?.department === department &&
        excludePos?.collection === collection &&
        excludePos?.idx === i
      ) return
      if (u.groupId) ids.add(u.groupId)
    })
  }

  addUnits(bc.legislative?.units || [], 'legislative', 'units')
  addUnits(bc.legislative?.evaluators || [], 'legislative', 'evaluators')
  addUnits(bc.executive?.units || [], 'executive', 'units')
  addUnits(bc.executive?.evaluators || [], 'executive', 'evaluators')
  addUnits(bc.judicial?.prosecution || [], 'judicial', 'prosecution')
  addUnits(bc.judicial?.defense     || [], 'judicial', 'defense')
  addUnits(bc.judicial?.witness     || [], 'judicial', 'witness')
  addUnits(bc.judicial?.jury        || [], 'judicial', 'jury')
  addUnits(bc.judicial?.judge       || [], 'judicial', 'judge')
  addUnits(bc.judicial?.press       || [], 'judicial', 'press')
  addUnits(bc.judicial?.evaluators  || [], 'judicial', 'evaluators')

  // 대통령 모둠 수집 추가 (일반 부처나 평가단 배정 셀렉트 시 중복 제외용)
  if (bc.executive?.presidentGroupId && (!filterDepartment || filterDepartment === 'executive')) {
    ids.add(bc.executive.presidentGroupId)
  }

  return ids
}

// ── 공통 UnitRow ─────────────────────────────────────────────────
function UnitRow({ 
  unit, 
  onGroupChange, 
  onTitleChange, 
  onRepChange, 
  titlePlaceholder, 
  titleLabel, 
  memberList, 
  groupList,
  groups,
  hideRepresentative = false,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500 w-12 shrink-0">모둠</span>
        <select
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
          value={unit.groupId || ''}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="">— 모둠 선택 —</option>
          {unit.groupId && !groupList.some((g) => g.id === unit.groupId) && (
            <option value={unit.groupId}>
              ⚠️ {groups?.[unit.groupId]?.name || unit.groupId} (중복 배치됨)
            </option>
          )}
          {groupList.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji || ''} {g.name || g.id}
            </option>
          ))}
        </select>
      </div>

      {titleLabel && (
        <div className="flex gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 w-12 shrink-0">{titleLabel}</span>
          <input
            type="text"
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
            placeholder={titlePlaceholder}
            value={unit.title || unit.ministryName || ''}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
      )}

      {unit.groupId && !hideRepresentative && (
        <div className="flex gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 w-12 shrink-0">👑 대표</span>
          <select
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
            value={unit.representativeStudentId || ''}
            onChange={(e) => onRepChange(e.target.value || null)}
          >
            <option value="">— 대표 지정 —</option>
            {memberList.map((s) => (
              <option key={s.number} value={`student_${s.number}`}>
                {s.number}번 {s.nickname}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── 평가단 행 컴포넌트 ───────────────────────────────────────────
function EvaluatorRow({ ev, onUpdate, onRemove, groupList }) {
  return (
    <div className="bg-white/60 border border-gray-200 rounded-lg p-2 flex items-center gap-2 relative group/eval">
      <select
        className="flex-1 text-[11px] border border-gray-300 rounded px-1.5 py-1 bg-white"
        value={ev.groupId || ''}
        onChange={(e) => onUpdate({ groupId: e.target.value })}
      >
        <option value="">— 모둠 선택 —</option>
        {groupList.map((g) => (
          <option key={g.id} value={g.id}>{g.emoji || '🏢'} {g.name || g.id}</option>
        ))}
      </select>
      <div className="flex bg-gray-100 rounded p-0.5 border">
        {EVAL_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onUpdate({ type: t.value })}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${
              ev.type === t.value ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'
            }`}
            title={t.desc}
          >{t.label.slice(0, 2)}</button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 text-xs px-1"
      >✕</button>
    </div>
  )
}

// ── 역할 목록 편집기 (역할 중심 모드 전용) ──────────────────────
function RolesEditor({ branchKey, roles, onChange }) {
  const [showExamples, setShowExamples] = useState(false)
  const [newEmoji, setNewEmoji] = useState('🎯')
  const [newName, setNewName]   = useState('')
  const [newDesc, setNewDesc]   = useState('')

  const isLeg    = branchKey === 'legislative'
  const clr      = isLeg
    ? { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', chip: 'border-indigo-200', add: 'hover:bg-indigo-100 border-indigo-300 text-indigo-700' }
    : { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  chip: 'border-amber-200',  add: 'hover:bg-amber-100  border-amber-300  text-amber-700'  }

  const exampleRoles = [
    ...(SCAFFOLD_ROLES[branchKey] || []),
    ...(DEFAULT_ROLE_EXAMPLES[branchKey] || []),
  ].map(scaffoldToEditorRole)

  const updateRole    = (idx, partial) => onChange(roles.map((r, i) => i === idx ? { ...r, ...partial } : r))
  const removeRole    = (idx)          => onChange(roles.filter((_, i) => i !== idx))

  const addRole = () => {
    const name = newName.trim()
    if (!name) return
    const id = `${branchKey}_r${Date.now().toString(36).slice(-4)}`
    onChange([...roles, { id, key: id, emoji: newEmoji || '🎯', name, label: name, desc: newDesc.trim(), memoGuide: [], todos: [], enabled: true }])
    setNewName(''); setNewDesc(''); setNewEmoji('🎯')
  }

  const addExampleRole = (ex) => {
    if (roles.some((r) => (r.key || r.id) === (ex.key || ex.id) || r.name === ex.name)) return
    onChange([...roles, { ...ex, enabled: true }])
  }

  return (
    <div className={`rounded-xl border p-3 space-y-3 ${clr.bg} ${clr.border}`}>

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className={`text-[10px] font-black uppercase tracking-wider ${clr.text}`}>🎭 역할 목록</p>
        <div className="flex items-center gap-2">
          <p className="text-[9px] text-gray-400">같은 역할을 여러 명이 맡아도 됩니다</p>
          <button
            type="button"
            onClick={() => setShowExamples((v) => !v)}
            className={`text-[9px] px-2 py-0.5 rounded-full border font-bold transition-colors ${
              showExamples ? `${clr.text} border-current bg-white` : 'text-gray-500 border-gray-200 hover:text-gray-700'
            }`}
          >
            📋 역할 예시 자료 {showExamples ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── 예시 자료 패널 ── */}
      {showExamples && (
        <div className={`rounded-xl border ${clr.border} bg-white/70 p-3 space-y-2`}>
          <p className={`text-[10px] font-black ${clr.text}`}>만들 수 있는 역할 예시</p>
          <div className="space-y-1.5">
            {exampleRoles.map((ex) => {
              const added = roles.some((r) => (r.key || r.id) === (ex.key || ex.id) || r.name === ex.name)
              return (
                <div key={ex.id} className="flex items-start justify-between gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">{ex.emoji} {ex.name}</p>
                    {ex.desc && <p className="text-[10px] text-gray-500 mt-0.5">{ex.desc}</p>}
                    {ex.memoGuide?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {ex.memoGuide.map((g, i) => (
                          <li key={i} className="text-[9px] text-gray-400 leading-relaxed">• {g}</li>
                        ))}
                      </ul>
                    )}
                    {ex.todos?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {ex.todos.map((t, i) => (
                          <li key={i} className="text-[9px] text-emerald-600 font-semibold">
                            ✅ {typeof t === 'object' ? (t?.label || '') : t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addExampleRole(ex)}
                    disabled={added}
                    className={`shrink-0 mt-0.5 text-[10px] px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      added ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : `bg-white ${clr.text} ${clr.border} hover:bg-opacity-80`
                    }`}
                  >
                    {added ? '추가됨' : '+ 추가'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 역할 칩 목록 ── */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role, idx) => (
          <div key={role.key || role.id} className="relative group/chip">
            {/* 칩 */}
            <div className={`flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-xl border bg-white shadow-sm ${clr.chip}`}>
              <input
                type="text" value={role.emoji}
                onChange={(e) => updateRole(idx, { emoji: e.target.value })}
                className="w-6 text-sm text-center bg-transparent border-none outline-none leading-none"
              />
              <input
                type="text" value={role.name}
                onChange={(e) => updateRole(idx, { name: e.target.value, label: e.target.value })}
                className={`text-xs font-bold bg-transparent border-none outline-none min-w-[52px] max-w-[90px] ${clr.text}`}
              />
              <button
                type="button" onClick={() => removeRole(idx)}
                className="opacity-0 group-hover/chip:opacity-100 transition-opacity text-gray-300 hover:text-red-400 text-[10px] px-0.5 ml-0.5"
              >✕</button>
            </div>

            {/* 툴팁 */}
            {(role.desc || role.memoGuide?.length > 0 || role.todos?.length > 0) && (
              <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-gray-900 text-white rounded-2xl p-3.5 text-[10px] leading-relaxed pointer-events-none shadow-2xl invisible group-hover/chip:visible opacity-0 group-hover/chip:opacity-100 transition-all">
                <p className="font-black text-yellow-300 mb-2">{role.emoji} {role.name}</p>
                {role.desc && <p className="text-gray-300 mb-2">{role.desc}</p>}
                {role.memoGuide?.length > 0 && (
                  <div className="mb-2">
                    <p className="font-black text-blue-300 mb-1">📝 메모 가이드</p>
                    {role.memoGuide.map((g, i) => <p key={i} className="text-gray-300 pl-2 mb-0.5">• {g}</p>)}
                  </div>
                )}
                {role.todos?.length > 0 && (
                  <div>
                    <p className="font-black text-emerald-300 mb-1">✅ 할 일</p>
                    {role.todos.map((t, i) => <p key={i} className="text-gray-300 pl-2 mb-0.5">• {typeof t === 'object' ? (t?.label || '') : t}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 새 역할 추가 ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <input type="text" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}
          className="w-8 text-sm text-center border border-gray-200 rounded-lg px-1 py-1 bg-white shrink-0" title="이모지" />
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
          placeholder="역할 이름..." className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white" />
        <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
          placeholder="하는 일 (한 줄 설명)..." className="flex-1 min-w-[140px] text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white" />
        <button type="button" onClick={addRole} disabled={!newName.trim()}
          className={`shrink-0 text-[10px] px-2.5 py-1 rounded-lg border border-dashed font-bold transition-colors disabled:opacity-30 ${clr.add}`}>
          + 추가
        </button>
      </div>

      <p className="text-[9px] text-gray-400">이름·이모지를 클릭해 수정하세요. 역할 칩에 마우스를 올리면 메모 가이드와 할 일이 나타납니다.</p>
    </div>
  )
}

export default function BranchConfigEditor({ value, onChange }) {
  const groups   = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const candidatesRaw = useGameStore((s) => s.roomData?.candidates)
  const votesRaw = useGameStore((s) => s.roomData?.votes)
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.roomData?.className) || '우리 반'
  const bc = value || {}

  // ── 구버전 역할 라벨 자동 마이그레이션 ──────────────────────────────
  // BranchConfigEditor 마운트 시 한 번만 실행: Firebase에 저장된 구 라벨을
  // 현재 블루프린트 라벨로 교체해 영구 저장. 이후 정규화 없이도 새 이름이 보임.
  const autoMigrated = useRef(false)
  useEffect(() => {
    if (autoMigrated.current) return
    autoMigrated.current = true
    const executive = value?.executive
    if (!executive?.roles?.length) return
    const normalized = normalizeRoleList('executive', executive.roles).map(scaffoldToEditorRole)
    const changed = normalized.some((r, i) => {
      const orig = executive.roles[i] || {}
      return r.label !== (orig.label || orig.name || '')
    })
    if (changed) {
      onChange({ ...(value || {}), executive: { ...executive, roles: normalized } })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const electionWinnerId = useMemo(() => {
    if (!candidatesRaw) return null
    const ranks = calculateRanks(candidatesRaw, votesRaw)
    return ranks?.[0]?.groupId || null
  }, [candidatesRaw, votesRaw])

  const hasInitializedPresident = useRef(false)
  useEffect(() => {
    const branch = bc.executive || {}
    if (electionWinnerId && !branch.presidentGroupId && !hasInitializedPresident.current) {
      hasInitializedPresident.current = true
      const gid = electionWinnerId
      const name = branch.presidentMinistryName || '대통령실'
      let units = [...(branch.units || [])]
      
      const existingIdx = units.findIndex(u => u.groupId === gid)
      if (existingIdx !== -1) {
        units[existingIdx] = { ...units[existingIdx], ministryName: name, title: name }
      } else {
        units.push({
          unitId: genUnitId('exe'),
          groupId: gid,
          ministryName: name,
          title: name,
          representativeStudentId: null
        })
      }

      onChange({
        ...bc,
        executive: {
          ...branch,
          presidentGroupId: gid,
          units
        }
      })
    }
  }, [electionWinnerId, bc, onChange])

  const groupList = useMemo(
    () => Object.entries(groups || {}).map(([id, g]) => ({ id, ...g })),
    [groups],
  )

  const assignedAll = useMemo(() => {
    const ids = new Set()
    const add = (units) => units?.forEach(u => u.groupId && ids.add(u.groupId))
    const addEv = (evs) => evs?.forEach(e => e.groupId && ids.add(e.groupId))

    add(bc.legislative?.units)
    addEv(bc.legislative?.evaluators)
    add(bc.executive?.units)
    addEv(bc.executive?.evaluators)
    add(bc.judicial?.prosecution)
    add(bc.judicial?.defense)
    add(bc.judicial?.witness)
    add(bc.judicial?.jury)
    add(bc.judicial?.judge)
    add(bc.judicial?.press)
    addEv(bc.judicial?.evaluators)
    
    return ids
  }, [bc])

  const unassigned = useMemo(
    () => groupList.filter((g) => !assignedAll.has(g.id)),
    [groupList, assignedAll],
  )

  function availableGroupsFor(department, collection, idx) {
    const excluded = assignedGroupIds(bc, department, { department, collection, idx })
    return groupList.filter((g) => !excluded.has(g.id))
  }

  function availableCountFor(department) {
    const excluded = assignedGroupIds(bc, department)
    return groupList.filter((g) => !excluded.has(g.id)).length
  }

  const availablePresidentGroups = useMemo(() => {
    const excluded = new Set()
    const branch = bc.executive || {}
    const units = branch.units || []

    // 타 부서/유닛에 이미 지정된 모둠들 수집 (단, 현재 대통령실 모둠은 제외하지 않음)
    units.forEach(u => {
      if (u.groupId && u.groupId !== branch.presidentGroupId) {
        excluded.add(u.groupId)
      }
    })

    const otherIds = assignedGroupIds(bc)
    otherIds.forEach(id => {
      if (id !== branch.presidentGroupId) {
        excluded.add(id)
      }
    })

    return groupList.filter(g => !excluded.has(g.id))
  }, [bc, groupList])

  function membersOf(groupId) {
    const g = groups?.[groupId]
    if (!g?.members) return []
    return Object.keys(g.members)
      .map((sid) => students?.[sid])
      .filter(Boolean)
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  }

  function addUnit(branchKey, type = 'unit') {
    const branch = bc[branchKey] || {}
    const key = type === 'unit' ? 'units' : 'evaluators'
    const arr = [...(branch[key] || [])]
    if (type === 'unit') {
      arr.push({ unitId: genUnitId(branchKey.slice(0, 3)), groupId: '', title: '', representativeStudentId: null })
    } else {
      arr.push({ groupId: '', type: 'citizens' })
    }
    onChange({ ...bc, [branchKey]: { ...branch, [key]: arr } })
  }

  function removeUnit(branchKey, idx, type = 'unit') {
    const branch = bc[branchKey] || {}
    const key = type === 'unit' ? 'units' : 'evaluators'
    const arr = [...(branch[key] || [])]
    arr.splice(idx, 1)
    onChange({ ...bc, [branchKey]: { ...branch, [key]: arr } })
  }

  function updateUnit(branchKey, idx, partial, type = 'unit') {
    const branch = bc[branchKey] || {}
    const key = type === 'unit' ? 'units' : 'evaluators'
    const arr = [...(branch[key] || [])].map((u, i) => i === idx ? { ...u, ...partial } : u)
    if (type === 'unit' && partial.groupId !== undefined) arr[idx].representativeStudentId = null
    onChange({ ...bc, [branchKey]: { ...branch, [key]: arr } })
  }

  function updateBranchSettings(branchKey, partial) {
    const branch = bc[branchKey] || {}
    onChange({ ...bc, [branchKey]: { ...branch, ...partial } })
  }

  function applyExecutiveTemplate(templateKey) {
    const template = MINISTRY_TEMPLATES[templateKey]
    if (!template) return
    const branch = bc.executive || {}
    const existingUnits = branch.units || []
    
    // 대통령실이 아닌 일반 부처 유닛만 기존 목록에서 추출하여 템플릿과 매핑
    const nonPresidentUnits = existingUnits.filter(u => u.groupId !== branch.presidentGroupId)
    
    const nextUnits = template.ministries.map((name, idx) => ({
      ...(nonPresidentUnits[idx] || { unitId: genUnitId('exe'), groupId: '', representativeStudentId: null }),
      ministryName: name,
      title: name,
    }))

    // 기존 설정된 대통령실 모둠이 있다면 삭제되지 않도록 보존/추가
    if (branch.presidentGroupId) {
      const presUnit = existingUnits.find(u => u.groupId === branch.presidentGroupId)
      if (presUnit) {
        nextUnits.push(presUnit)
      } else {
        const name = branch.presidentMinistryName || '대통령실'
        nextUnits.push({
          unitId: genUnitId('exe'),
          groupId: branch.presidentGroupId,
          ministryName: name,
          title: name,
          representativeStudentId: null
        })
      }
    }

    onChange({
      ...bc,
      executive: {
        ...branch,
        issueCategory: templateKey,
        units: nextUnits,
      },
    })
  }

  function addJudicialEvaluator() {
    const arr = [...(bc.judicial?.evaluators || [])]
    arr.push({ groupId: '', type: 'citizens' })
    onChange({ ...bc, judicial: { ...bc.judicial, evaluators: arr } })
  }

  function removeJudicialEvaluator(idx) {
    const arr = [...(bc.judicial?.evaluators || [])]
    arr.splice(idx, 1)
    onChange({ ...bc, judicial: { ...bc.judicial, evaluators: arr } })
  }

  function updateJudicialEvaluator(idx, partial) {
    const arr = [...(bc.judicial?.evaluators || [])].map((e, i) => i === idx ? { ...e, ...partial } : e)
    onChange({ ...bc, judicial: { ...bc.judicial, evaluators: arr } })
  }

  function setJudicialCaseType(type) {
    onChange({ ...bc, judicial: { ...bc.judicial, caseType: type } })
  }

  // ── 사법부 작업 방식 토글 (collaborative / role) — v3 ──────────────
  function setJudicialWorkMode(workMode) {
    onChange({ ...bc, judicial: { ...bc.judicial, workMode } })
  }


  // ── 섹션 렌더러 ─────────────────────────────────────────────────
  const isJudicialCivil = bc.judicial?.caseType === 'civil'
  // 기자단 편성 여부 — 기자 모둠에 한 모둠이라도 배정되어 있으면 '기자단 편성', 아니면 '전원 사법'
  const hasPressTeam = (bc.judicial?.press || []).some((u) => u?.groupId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700">⑦ Phase 3 부서 배치</h3>
        <span className="text-xs text-gray-400">
          배치 안 된 모둠: {unassigned.length}개
        </span>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        모둠을 각 부서에 배치하세요. 배치된 모둠 수만큼 법안·정책·변론이 생성됩니다.
        비어 있으면 기존 단일 문서 방식으로 동작합니다.
      </p>

      {/* 입법/행정 섹션 */}
      {Object.keys(BRANCH_META).map((branchKey) => {
        const meta = BRANCH_META[branchKey]
        const branch = bc[branchKey] || {}
        const units = branch.units || []
        const colorCls = {
          indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
          amber:  'bg-amber-50 border-amber-200 text-amber-800',
        }[meta.color]

        return (
          <section key={branchKey} className={`rounded-xl border p-4 space-y-3 ${colorCls}`}>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="font-bold text-sm">
                {meta.emoji} {meta.label} — {meta.unitLabel} {units.length}개
              </h4>
              
              <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                <button
                  type="button"
                  onClick={() => onChange({ ...bc, [branchKey]: { ...branch, mode: 'role_based' } })}
                  className={`text-[10px] px-2 py-1 rounded transition-colors font-bold ${
                    (branch.mode || 'role_based') === 'role_based'
                      ? `bg-${meta.color}-600 text-white`
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  🎭 역할 중심
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...bc, [branchKey]: { ...branch, mode: 'collaborative' } })}
                  className={`text-[10px] px-2 py-1 rounded transition-colors font-bold ${
                    branch.mode === 'collaborative'
                      ? `bg-${meta.color}-600 text-white`
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  🤝 공동 작업
                </button>
              </div>

              <button
                type="button"
                onClick={() => addUnit(branchKey)}
                disabled={availableCountFor(branchKey) === 0 && !units.some((u) => !u.groupId)}
                className="text-xs px-3 py-1 rounded-full bg-white border border-current font-semibold disabled:opacity-40"
              >
                {meta.addLabel}
              </button>
            </div>

            <p className="text-[10px] font-medium opacity-80">
              {(branch.mode || 'role_based') === 'role_based'
                ? `※ 아래 역할 목록을 모둠원에게 배분하세요. 특정 역할(${branchKey === 'legislative' ? '법안 작성자' : '장관'})만 템플릿을 수정할 수 있습니다.`
                : `※ 역할 배정 여부와 상관없이 모든 모둠원이 ${branchKey === 'legislative' ? '법안' : '정책'} 템플릿을 함께 수정할 수 있습니다.`}
            </p>

            {(branch.mode || 'role_based') === 'role_based' && (
              <RolesEditor
                branchKey={branchKey}
                roles={normalizeRoleList(branchKey, branch.roles || SCAFFOLD_ROLES[branchKey] || []).map(scaffoldToEditorRole)}
                onChange={(nextRoles) => updateBranchSettings(branchKey, { roles: nextRoles })}
              />
            )}

            {branchKey === 'executive' && (
              <div className="rounded-xl bg-white/80 border border-amber-200 p-3 space-y-3">
                <div className="space-y-1 border-b border-amber-200 pb-3 mb-3 text-left">
                  <span className="text-xs font-black text-amber-800 flex items-center gap-1">
                    👑 대통령 모둠 (국무회의 진행 및 최종 예산 결정)
                  </span>
                  <select
                    className="w-full text-xs border border-amber-300 bg-amber-50 rounded px-2 py-1.5 font-bold text-amber-900"
                    value={branch.presidentGroupId ?? ''}
                    onChange={(e) => {
                      const gid = e.target.value
                      const prevGid = branch.presidentGroupId
                      const name = branch.presidentMinistryName || '대통령실'
                      let units = [...(branch.units || [])]

                      if (gid) {
                        const existingIdx = units.findIndex(u => u.groupId === gid)
                        const prevIdx = prevGid ? units.findIndex(u => u.groupId === prevGid) : -1

                        if (existingIdx !== -1) {
                          units[existingIdx] = { ...units[existingIdx], ministryName: name, title: name }
                        } else if (prevIdx !== -1) {
                          units[prevIdx] = { ...units[prevIdx], groupId: gid, ministryName: name, title: name }
                        } else {
                          units.push({
                            unitId: genUnitId('exe'),
                            groupId: gid,
                            ministryName: name,
                            title: name,
                            representativeStudentId: null
                          })
                        }
                      } else {
                        if (prevGid) {
                          units = units.filter(u => u.groupId !== prevGid)
                        }
                      }

                      onChange({
                        ...bc,
                        executive: {
                          ...branch,
                          presidentGroupId: gid || null,
                          units
                        }
                      })
                    }}
                  >
                    <option value="">— 대통령 모둠 선택 —</option>
                    {availablePresidentGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.emoji || '🏢'} {g.name || g.id} {electionWinnerId === g.id ? ' (🏆 선거 1위)' : ''}
                      </option>
                    ))}
                  </select>

                  {branch.presidentGroupId && (
                    <label className="block space-y-1 mt-2">
                      <span className="text-[10px] font-black text-amber-700">대통령실 부처명</span>
                      <input
                        type="text"
                        className="w-full text-xs border border-amber-300 rounded px-2 py-1.5 bg-white font-bold text-slate-800 focus:outline-none"
                        value={branch.presidentMinistryName ?? '대통령실'}
                        placeholder="예: 대통령실, 청와대"
                        onChange={(e) => {
                          const name = e.target.value
                          const gid = branch.presidentGroupId
                          const units = [...(branch.units || [])]
                          const idx = units.findIndex(u => u.groupId === gid)
                          if (idx !== -1) {
                            units[idx] = { ...units[idx], ministryName: name, title: name }
                          }
                          onChange({
                            ...bc,
                            executive: {
                              ...branch,
                              presidentMinistryName: name,
                              units
                            }
                          })
                        }}
                      />
                    </label>
                  )}

                  {branch.presidentGroupId && (() => {
                    const presUnit = (branch.units || []).find((u) => u.groupId === branch.presidentGroupId)
                      || { groupId: branch.presidentGroupId, unitId: 'exe-president' }
                    return (
                      <label className="block space-y-1 mt-2">
                        <span className="text-[10px] font-black text-amber-700">👑 대통령실 대표 (최종 승인 권한)</span>
                        <select
                          className="w-full text-xs border border-amber-300 rounded px-2 py-1.5 bg-white font-bold text-amber-900"
                          value={presUnit.representativeStudentId || ''}
                          onChange={(e) => syncExecutiveRepresentative({ roomCode, branchConfig: bc, groups, unit: presUnit, studentId: e.target.value || null })}
                        >
                          <option value="">— 대표 지정 —</option>
                          {membersOf(branch.presidentGroupId).map((s) => (
                            <option key={s.number} value={`student_${s.number}`}>
                              {s.number}번 {s.nickname}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-amber-600">빠른제어의 대표 지정과 자동으로 동기화됩니다.</span>
                      </label>
                    )
                  })()}

                  <p className="text-[10px] text-amber-700 mt-1">
                    ※ 대통령 모둠을 선택하면 행정부 부처 목록에 대통령실 유닛이 자동으로 동기화되며, 부처명을 언제든 바꿀 수 있습니다.
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black text-amber-700">국가명</span>
                    <input
                      type="text"
                      value={branch.countryName || '비빔민국'}
                      onChange={(e) => updateBranchSettings('executive', { countryName: e.target.value })}
                      className="w-full text-xs border border-amber-200 rounded px-2 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black text-amber-700">정부 전체 예산(억)</span>
                    <input
                      type="number"
                      min={0}
                      value={branch.totalBudget ?? DEFAULT_EXECUTIVE_BUDGET}
                      onChange={(e) => updateBranchSettings('executive', { totalBudget: Number(e.target.value) || 0 })}
                      className="w-full text-xs border border-amber-200 rounded px-2 py-1.5 text-right"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black text-amber-700">국가 규모(명)</span>
                    <input
                      type="number"
                      min={0}
                      value={branch.population ?? 100000}
                      onChange={(e) => updateBranchSettings('executive', { population: Number(e.target.value) || 0 })}
                      className="w-full text-xs border border-amber-200 rounded px-2 py-1.5 text-right"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-amber-800">
                  <input
                    type="checkbox"
                    checked={branch.useEvaluatorPanel !== false}
                    onChange={(e) => updateBranchSettings('executive', { useEvaluatorPanel: e.target.checked })}
                  />
                  평가단 브리핑 운영하기 (끄면 교사가 브리핑 작성)
                </label>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-amber-700">최우선과제 유형별 추천 부처 불러오기</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(MINISTRY_TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyExecutiveTemplate(key)}
                        className="text-[10px] px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
                <details className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                  <summary className="cursor-pointer text-[10px] font-black text-amber-700">비빔민국 10만 명 기본 통계 보기</summary>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-2">
                    {BIBIM_STATS.map((stat) => (
                      <div key={stat.key} className="rounded bg-white px-2 py-1 text-[10px]">
                        <b>{stat.label}</b> {Number(stat.value).toLocaleString()}
                        <p className="text-gray-400">{stat.desc}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {units.length === 0 && (
              <p className="text-xs opacity-60 italic">배치된 모둠 없음 (기존 단일 법안 동작 유지)</p>
            )}

            {units.map((unit, idx) => {
              if (branchKey === 'executive' && unit.groupId === branch.presidentGroupId) return null;
              return (
                <div key={unit.unitId} className="relative">
                  <UnitRow
                    unit={unit}
                    onGroupChange={(gid) => updateUnit(branchKey, idx, { groupId: gid })}
                    onTitleChange={(t) => updateUnit(branchKey, idx, branchKey === 'executive' ? { ministryName: t, title: t } : { title: t })}
                    onRepChange={(sid) => {
                      if (branchKey === 'executive') {
                        // config·sessionRoles 양쪽 동시 기록(빠른제어와 동기화)
                        syncExecutiveRepresentative({ roomCode, branchConfig: bc, groups, unit, studentId: sid })
                      } else {
                        updateUnit(branchKey, idx, { representativeStudentId: sid })
                      }
                    }}
                    titleLabel={branchKey === 'executive' ? '부처명' : '법안명'}
                    titlePlaceholder={meta.titlePlaceholder}
                    memberList={membersOf(unit.groupId)}
                  groupList={availableGroupsFor(branchKey, 'units', idx)}
                  groups={groups}
                  hideRepresentative={branch.mode === 'collaborative'}
                  />
                  <button
                    type="button"
                    onClick={() => removeUnit(branchKey, idx)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-sm"
                    title="단위 제거"
                  >✕</button>
                </div>
              )
            })}

            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-black text-gray-500">📋 {meta.label} 평가단 ({branch.evaluators?.length || 0})</span>
                <button
                  type="button"
                  onClick={() => addUnit(branchKey, 'evaluator')}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold"
                >+ 평가단 추가</button>
              </div>
              <div className="space-y-2">
                {(branch.evaluators || []).map((ev, eidx) => (
                  <EvaluatorRow
                    key={eidx}
                    ev={ev}
                    onUpdate={(p) => updateUnit(branchKey, eidx, p, 'evaluator')}
                    onRemove={() => removeUnit(branchKey, eidx, 'evaluator')}
                    groupList={availableGroupsFor(branchKey, 'evaluators', eidx)}
                  />
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {/* 사법부 섹션 */}
      <section key="judicial-section" className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h4 className="font-bold text-sm text-rose-800">⚖️ 사법부</h4>
          <span className="text-[10px] font-black text-rose-700 bg-rose-100/50 px-2 py-1 rounded-full">
            {isJudicialCivil ? '📜 민사 재판' : '⛓️ 형사 재판'}
            {' · '}
            {hasPressTeam ? '📰 기자단 편성' : '⚖️ 전원 사법'}
          </span>
        </div>

        {/* 재판 종류 + 편성 모드 토글 */}
        <div className="bg-white rounded-lg border border-rose-100 p-2.5 space-y-2.5">
          {/* 형사 / 민사 */}
          <div className="space-y-1">
            <p className="text-[10px] font-black text-rose-700">⚖️ 재판 종류</p>
            <div className="flex gap-2">
              {[
                { value: 'criminal', label: '⛓️ 형사 재판', desc: '검사 vs 변호인 — 유무죄·형량 결정' },
                { value: 'civil',    label: '📜 민사 재판', desc: '원고 vs 피고 — 손해배상·권리 다툼' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setJudicialCaseType(t.value)}
                  className={`flex-1 text-left p-2 rounded border text-[10px] transition-all ${
                    (bc.judicial?.caseType || 'criminal') === t.value
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-200'
                  }`}
                >
                  <div className="font-black">{t.label}</div>
                  <div className={`mt-0.5 ${(bc.judicial?.caseType || 'criminal') === t.value ? 'text-rose-100' : 'text-gray-400'}`}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 작업 방식 (사법부 2모드) — verdict(판결중심) vs role(역할중심) */}
          <div className="space-y-1">
            <p className="text-[10px] font-black text-rose-700">⚖️ 활동 방식</p>
            <div className="flex gap-2">
              {[
                { value: 'role', label: '🎭 역할중심', desc: '학생이 직접 검사·변호·증인이 되어 증거·증인으로 논고를 쓰고 실제 재판을 진행.' },
                { value: 'verdict', label: '⚖️ 판결중심', desc: 'AI 대본 재판을 참관하고, 모든 모둠이 판사가 되어 판결문을 작성·비교(전원 판사).' },
              ].map((m) => {
                const cur = bc.judicial?.workMode || 'role'
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setJudicialWorkMode(m.value)}
                    className={`flex-1 text-left p-2 rounded border text-[10px] transition-all ${
                      cur === m.value
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-rose-200'
                    }`}
                  >
                    <div className="font-black">{m.label}</div>
                    <div className={`mt-0.5 ${cur === m.value ? 'text-rose-100' : 'text-gray-400'}`}>{m.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 사건 시나리오 — 공통 컴포넌트 (학급설정/빠른 제어 공용) */}
        <JudicialCaseSetupPanel
          bc={bc}
          onChange={onChange}
          className={className}
          roomCode={roomCode}
        />

        <JudicialMemberAssigner bc={bc} onChange={onChange} />

        <div className="mt-4 pt-4 border-t border-dashed border-rose-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-black text-rose-600/70">📋 사법부 평가단 ({bc.judicial?.evaluators?.length || 0})</span>
            <button
              type="button"
              onClick={addJudicialEvaluator}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white text-emerald-600 border border-emerald-200 font-bold"
            >+ 평가단 추가</button>
          </div>
          <div className="space-y-2">
            {(bc.judicial?.evaluators || []).map((ev, eidx) => (
              <EvaluatorRow
                key={eidx}
                ev={ev}
                onUpdate={(p) => updateJudicialEvaluator(eidx, p)}
                onRemove={() => removeJudicialEvaluator(eidx)}
                groupList={availableGroupsFor('judicial', 'evaluators', eidx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 배치 현황 요약 */}
      {groupList.length > 0 && (
        <section key="summary-section" className="bg-gray-50 rounded-2xl p-5 border-2 border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📋</span>
            <h4 className="font-black text-gray-800 text-sm">국가기관 배치 현황 요약</h4>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-100/80 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-black text-gray-600 w-[24%]">시민단체 (모둠)</th>
                  <th className="px-3 py-2 text-[10px] font-black text-gray-600 w-[19%] text-center">🏛️ 입법부</th>
                  <th className="px-3 py-2 text-[10px] font-black text-gray-600 w-[19%] text-center">🇰🇷 행정부</th>
                  <th className="px-3 py-2 text-[10px] font-black text-gray-600 w-[19%] text-center">
                    {bc.judicial?.caseType === 'civil' ? '⚖️ 변호(원고)' : '👨‍💼 검사'}
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black text-gray-600 w-[19%] text-center">
                    {bc.judicial?.caseType === 'civil' ? '🛡️ 변호(피고)' : '🛡️ 변호'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupList.map((g) => {
                  const isLeg = (bc.legislative?.units || []).some(u => u.groupId === g.id)
                  const isExe = (bc.executive?.units || []).some(u => u.groupId === g.id)
                  const isPros = (bc.judicial?.prosecution || []).some(u => u.groupId === g.id)
                  const isDef = (bc.judicial?.defense || []).some(u => u.groupId === g.id)
                  
                  const isLegEv = (bc.legislative?.evaluators || []).some(e => e.groupId === g.id)
                  const isExeEv = (bc.executive?.evaluators || []).some(e => e.groupId === g.id)
                  const isJudEv = (bc.judicial?.evaluators || []).some(e => e.groupId === g.id)

                  const isUnassigned = !isLeg && !isExe && !isPros && !isDef && !isLegEv && !isExeEv && !isJudEv

                  return (
                    <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5 text-[10px] font-bold text-gray-700">
                        <span className="mr-1">{g.emoji || '🏢'}</span>
                        <span className={isUnassigned ? 'text-red-400' : ''}>{g.name || g.id}</span>
                        {(isLegEv || isExeEv || isJudEv) && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black">
                            평가단
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLeg ? <span className="text-indigo-600 font-black text-[10px]">입법</span> : <span className="text-gray-200">─</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isExe ? <span className="text-amber-600 font-black text-[10px]">행정</span> : <span className="text-gray-200">─</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isPros ? (
                          <div className="flex flex-col items-center">
                            <span className="text-red-600 font-black text-[10px]">
                              {bc.judicial?.caseType === 'civil' ? '원고' : '검사'}
                            </span>
                          </div>
                        ) : <span className="text-gray-200">─</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isDef ? (
                          <div className="flex flex-col items-center">
                            <span className="text-sky-600 font-black text-[10px]">
                              {bc.judicial?.caseType === 'civil' ? '피고' : '변호'}
                            </span>
                          </div>
                        ) : <span className="text-gray-200">─</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[9px] text-gray-400 font-medium">※ 위에서 모둠을 배정하면 자동으로 표에 반영됩니다.</p>
        </section>
      )}
    </div>
  )
}
