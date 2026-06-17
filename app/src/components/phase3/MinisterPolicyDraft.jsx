import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'

/**
 * 행정부 ① 예산편성 + 시행령 작성 패널.
 *
 *  - 장관(minister)만 편집 가능. 다른 모둠원은 읽기 전용.
 *  - 모둠원 동의는 참고 정보이며, 최종 제출은 장관이 수행.
 *
 * RTDB: rooms/{rc}/policies/{groupId}
 *   {
 *     groupId, groupName,
 *     ministerStudentId, ministerName,
 *     budget: { personnel, project, education, pr },  // 합 100억
 *     decree: 'string',
 *     status: 'drafting' | 'submitted',
 *     approvals: { studentId: { name, roleKey, roleLabel, at } },
 *     updatedAt, submittedAt,
 *   }
 */

const SESSION_ID = 'executive-default'
const TOTAL_BUDGET = 100 // 100억
const CATEGORIES = [
  { key: 'personnel', label: '인건비', icon: '👥' },
  { key: 'project',   label: '사업비', icon: '🏗️' },
  { key: 'education', label: '교육비', icon: '📚' },
  { key: 'pr',        label: '홍보비', icon: '📣' },
]
const DECREE_RULE_ITEMS = 3
const EMPTY_DECREE_SCAFFOLD = {
  owner: '',
  whenWhere: '',
  rules: ['', '', ''],
  rewardsPenalties: '',
  exceptions: '',
}

function composeDecreeFromScaffold(scaffold) {
  const rules = (scaffold?.rules || [])
    .map((rule, index) => `${index + 1}) ${String(rule || '').trim()}`)
    .filter((line) => line.length > 3)
    .join('\n')
  return [
    `[담당자] ${String(scaffold?.owner || '').trim()}`,
    `[시간 및 장소] ${String(scaffold?.whenWhere || '').trim()}`,
    `[세부 규칙]`,
    rules || '(미입력)',
    `[상벌] ${String(scaffold?.rewardsPenalties || '').trim()}`,
    `[예외] ${String(scaffold?.exceptions || '').trim()}`,
  ].join('\n')
}

/**
 * dataPath  RTDB 컬렉션 경로 기본값 'policies'. RoundTabShell 에서 주입 가능.
 */
function MinisterPolicyDraft({ groupId, dataPath = 'policies' }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const rolesForKind = useGameStore((s) => s.config?.roles?.executive)

  const [policy, setPolicy] = useState(null)
  const [busy, setBusy] = useState(false)
  const [draftBudget, setDraftBudget] = useState({ personnel: 25, project: 25, education: 25, pr: 25 })
  const [draftBudgetReasons, setDraftBudgetReasons] = useState({ personnel: '', project: '', education: '', pr: '' })
  const [draftDecreeScaffold, setDraftDecreeScaffold] = useState(EMPTY_DECREE_SCAFFOLD)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(true) // 장관 편집 모드 — 저장 시 false 로 (수정 모드 진입)

  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    if (DraftSaver.load('policy')) setHasDraft(true)
  }, [])

  const onSaveLocalDraft = () => {
    DraftSaver.save('policy', { budget: draftBudget, reasons: draftBudgetReasons, scaffold: draftDecreeScaffold })
    setHasDraft(true)
    alert('브라우저에 임시저장되었습니다.')
  }

  const onLoadLocalDraft = () => {
    const d = DraftSaver.load('policy')
    if (d && d.data) {
      setDraftBudget(d.data.budget || draftBudget)
      setDraftBudgetReasons(d.data.reasons || draftBudgetReasons)
      setDraftDecreeScaffold(d.data.scaffold || draftDecreeScaffold)
      setDirty(true)
      alert('임시저장된 내용을 불러왔습니다.')
    }
  }

  // 구독
  useEffect(() => {
    if (!roomCode || !groupId) return
    const u = subscribe(roomCode, `${dataPath}/${groupId}`, (d) => setPolicy(d || null))
    return () => u?.()
  }, [roomCode, groupId, dataPath])

  // 서버 데이터 → 로컬 draft 동기화 (편집 중이 아닐 때만)
  useEffect(() => {
    if (dirty) return
    if (policy?.budget) setDraftBudget({ ...policy.budget })
    if (policy?.budgetReasons) setDraftBudgetReasons({ ...policy.budgetReasons })
    if (policy?.decreeScaffold) {
      setDraftDecreeScaffold({
        owner: policy.decreeScaffold.owner || '',
        whenWhere: policy.decreeScaffold.whenWhere || '',
        rules: Array.isArray(policy.decreeScaffold.rules)
          ? policy.decreeScaffold.rules.slice(0, DECREE_RULE_ITEMS).concat(Array(Math.max(0, DECREE_RULE_ITEMS - policy.decreeScaffold.rules.length)).fill(''))
          : ['', '', ''],
        rewardsPenalties: policy.decreeScaffold.rewardsPenalties || '',
        exceptions: policy.decreeScaffold.exceptions || '',
      })
    } else if (typeof policy?.decree === 'string' && policy.decree.trim()) {
      setDraftDecreeScaffold({
        ...EMPTY_DECREE_SCAFFOLD,
        rules: [policy.decree, '', ''],
      })
    }
  }, [policy?.updatedAt, dirty])

  // 처음 로드 시 — 저장된 데이터가 있으면 읽기 모드로 진입
  useEffect(() => {
    if (policy?.updatedAt) setEditing(false)
  }, [policy?.updatedAt != null])

  const group = groups?.[groupId]
  const memberIds = group?.members ? Object.keys(group.members) : []
  const ministerKey = group?.sessionRoles?.[SESSION_ID]
    ? Object.entries(group.sessionRoles[SESSION_ID]).find(([, k]) => k === 'minister')?.[0]
    : null
  
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const isCollaborative = branchConfig?.executive?.mode === 'collaborative'
  const isMember = memberIds.includes(myStudentId)
  const isMinister = ministerKey && ministerKey === myStudentId
  
  // 편집 권한: 장관이거나, 공동 작업 모드이면서 모둠원인 경우
  const canEdit = isMinister || (isCollaborative && isMember)

  const isSubmitted = policy?.status === 'submitted'
  const isLocked = isSubmitted // 제출 후엔 읽기 잠금, 수정 진입 시 drafting 복귀
  const roleDefs = rolesForKind || []
  const roleLabelByKey = useMemo(() => {
    const map = {}
    for (const role of roleDefs) map[role.key] = `${role.emoji || ''} ${role.label}`.trim()
    return map
  }, [roleDefs])

  const budgetSum = useMemo(() =>
    CATEGORIES.reduce((s, c) => s + (Number(draftBudget[c.key]) || 0), 0)
  , [draftBudget])
  const budgetReasonsComplete = useMemo(
    () => CATEGORIES.every((c) => String(draftBudgetReasons[c.key] || '').trim().length > 0),
    [draftBudgetReasons],
  )
  const decreeScaffoldComplete = useMemo(() => {
    const rulesFilled = (draftDecreeScaffold.rules || []).filter((rule) => String(rule || '').trim()).length === DECREE_RULE_ITEMS
    return (
      String(draftDecreeScaffold.owner || '').trim().length > 0 &&
      String(draftDecreeScaffold.whenWhere || '').trim().length > 0 &&
      rulesFilled &&
      String(draftDecreeScaffold.rewardsPenalties || '').trim().length > 0 &&
      String(draftDecreeScaffold.exceptions || '').trim().length > 0
    )
  }, [draftDecreeScaffold])
  const composedDecree = useMemo(
    () => composeDecreeFromScaffold(draftDecreeScaffold),
    [draftDecreeScaffold],
  )

  const setBudgetField = (key, v) => {
    setDirty(true)
    setDraftBudget((p) => ({ ...p, [key]: Math.max(0, Math.min(TOTAL_BUDGET, Number(v) || 0)) }))
  }

  const saveDraft = async () => {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      const basePayload = {
        groupId,
        groupName: group?.name || '',
        ministerStudentId: myStudentId,
        ministerName: myNickname || '',
        budget: { ...draftBudget },
        budgetReasons: { ...draftBudgetReasons },
        decree: composedDecree,
        decreeScaffold: draftDecreeScaffold,
        approvals: policy?.approvals || {},
        updatedAt: Date.now(),
      }

      // 제출 상태에서 수정 저장하면 자동으로 drafting 으로 내림
      if (policy?.status === 'submitted') {
        await updateAt(roomCode, `${dataPath}/${groupId}`, {
          ...basePayload,
          status: 'drafting',
          submittedAt: null,
          submittedBy: null,
          submittedByStudentId: null,
        })
      } else {
        await setAt(roomCode, `${dataPath}/${groupId}`, {
          ...basePayload,
          status: 'drafting',
          submittedBy: null,
          submittedByStudentId: null,
        })
      }
      DraftSaver.clear('policy')
      setHasDraft(false)
      setDirty(false)
      setEditing(false) // 저장 직후 → 읽기 모드 (수정 버튼 노출)
    } finally {
      setBusy(false)
    }
  }

  const cancelEdit = () => {
    setDirty(false)
    if (policy?.budget) setDraftBudget({ ...policy.budget })
    if (policy?.budgetReasons) setDraftBudgetReasons({ ...policy.budgetReasons })
    if (policy?.decreeScaffold) {
      setDraftDecreeScaffold({
        owner: policy.decreeScaffold.owner || '',
        whenWhere: policy.decreeScaffold.whenWhere || '',
        rules: Array.isArray(policy.decreeScaffold.rules)
          ? policy.decreeScaffold.rules.slice(0, DECREE_RULE_ITEMS).concat(Array(Math.max(0, DECREE_RULE_ITEMS - policy.decreeScaffold.rules.length)).fill(''))
          : ['', '', ''],
        rewardsPenalties: policy.decreeScaffold.rewardsPenalties || '',
        exceptions: policy.decreeScaffold.exceptions || '',
      })
    } else {
      setDraftDecreeScaffold({
        ...EMPTY_DECREE_SCAFFOLD,
        rules: [typeof policy?.decree === 'string' ? policy.decree : '', '', ''],
      })
    }
    setEditing(false)
  }

  // 모둠원 동의 — 자기 자신을 approvals 에 추가/해제.
  const toggleApproval = async () => {
    if (!myStudentId || canEdit || !policy) return
    const already = !!policy.approvals?.[myStudentId]
    if (already) {
      await updateAt(roomCode, `${dataPath}/${groupId}/approvals`, { [myStudentId]: null })
      return
    }
    const myRoleKey = group?.sessionRoles?.[SESSION_ID]?.[myStudentId] || null
    const myRoleLabel = myRoleKey ? roleLabelByKey[myRoleKey] || myRoleKey : '역할 미지정'
    await updateAt(roomCode, `${dataPath}/${groupId}/approvals`, {
      [myStudentId]: {
        name: myNickname || '',
        roleKey: myRoleKey,
        roleLabel: myRoleLabel,
        at: Date.now(),
      },
    })
  }

  const submitPolicy = async () => {
    if (!canEdit || busy) return
    if (budgetSum !== TOTAL_BUDGET) {
      alert(`예산 합계가 ${TOTAL_BUDGET}억이어야 제출할 수 있어요.`)
      return
    }
    if (!budgetReasonsComplete) {
      alert('예산 각 항목의 "필요 이유"를 모두 작성해 주세요.')
      return
    }
    if (!decreeScaffoldComplete) {
      alert('시행령 비계 항목(담당자/시간·장소/세부 규칙 3개/상벌/예외)을 모두 작성해 주세요.')
      return
    }
    setBusy(true)
    try {
      await updateAt(roomCode, `${dataPath}/${groupId}`, {
        status: 'submitted',
        submittedAt: Date.now(),
        submittedBy: 'minister',
        submittedByStudentId: myStudentId,
      })
      setEditing(false)
      setDirty(false)
    } finally {
      setBusy(false)
    }
  }

  const cancelSubmission = async () => {
    if (!canEdit || busy) return
    if (!confirm('제출을 취소하고 작성 단계로 내릴까요?')) return
    setBusy(true)
    try {
      await updateAt(roomCode, `${dataPath}/${groupId}`, {
        status: 'drafting',
        submittedAt: null,
        submittedBy: null,
        submittedByStudentId: null,
      })
      setEditing(false)
      setDirty(false)
    } finally {
      setBusy(false)
    }
  }

  const removePolicy = async () => {
    if (!confirm(`'${group?.name}' 모둠의 정책 보고서를 영구 삭제할까요?\n작성 중인 모든 예산 및 시행령 데이터가 사라집니다.`)) return
    try {
      await removeAt(roomCode, `${dataPath}/${groupId}`)
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다: ' + err.message)
    }
  }

  if (!group) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-sm text-amber-900">
        ⚠ 모둠 정보가 아직 없어요. 잠시 뒤 다시 확인해 주세요.
      </div>
    )
  }

  const ministerName = ministerKey ? students?.[ministerKey]?.nickname : null
  const nonMinisterMembers = memberIds.filter((id) => id !== ministerKey)
  const approvedSet = policy?.approvals || {}
  const myApproved = !!approvedSet?.[myStudentId]
  const agreedCount = nonMinisterMembers.filter((id) => !!approvedSet?.[id]).length
  const totalNeeded = nonMinisterMembers.length
  const roleRows = roleDefs.map((role) => {
    const assignedStudentId = Object.entries(group?.sessionRoles?.[SESSION_ID] || {}).find(
      ([, rk]) => rk === role.key,
    )?.[0] || null
    const assignedStudent = assignedStudentId ? students?.[assignedStudentId] : null
    const approval = assignedStudentId ? approvedSet?.[assignedStudentId] : null
    return {
      key: role.key,
      label: role.label,
      emoji: role.emoji,
      studentId: assignedStudentId,
      studentName: assignedStudent?.nickname || null,
      isMinisterRole: role.key === 'minister',
      approved: !!approval,
      approvedAt: approval?.at || null,
    }
  })

  return (
    <div className="space-y-3">
      <header className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-violet-900">
            🇰🇷 우리 모둠 정책 보고서 {isCollaborative ? '— 공동 작업 공간' : `— 장관: ${ministerName || '미지정'}`}
          </h3>
          {canEdit && editing && (
            <div className="flex gap-1">
              {hasDraft && (
                <button
                  type="button"
                  onClick={onLoadLocalDraft}
                  className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold hover:bg-amber-200"
                >
                  📂 불러오기
                </button>
              )}
              <button
                type="button"
                onClick={onSaveLocalDraft}
                className="text-[10px] px-2 py-1 bg-violet-50 text-violet-700 rounded border border-violet-100 font-bold hover:bg-violet-100"
              >
                💾 임시저장
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            (!isCollaborative && !ministerKey)
              ? 'bg-rose-100 text-rose-800'
              : isSubmitted
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {(!isCollaborative && !ministerKey) ? '⚠ 장관 미배정' : isSubmitted ? '✓ 제출 완료 (온라인 토의 노출 중)' : '✏️ 작성 중'}
          </span>
          {role === 'teacher' && (
            <button
              onClick={removePolicy}
              className="text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-100 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </header>

      {!canEdit && !isCollaborative && !ministerKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-900">
          장관 🇰🇷 역할이 아직 배정되지 않았어요. 역할 배정 후 장관이 작성/제출할 수 있습니다.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {/* ====== 좌: 예산편성 ====== */}
        <article className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
          <h4 className="font-bold text-violet-900">💰 예산편성 (총 {TOTAL_BUDGET}억)</h4>
          {!canEdit && (
            <p className="text-[11px] text-gray-500">
              {isCollaborative ? '모둠원만 편집할 수 있어요.' : '장관만 편집할 수 있어요. 내용을 확인하고 아래에서 동의하세요.'}
            </p>
          )}
          <div className="space-y-2">
            {CATEGORIES.map((c) => {
              const v = canEdit && editing ? draftBudget[c.key] : (policy?.budget?.[c.key] ?? 0)
              const reason = canEdit && editing ? draftBudgetReasons[c.key] : (policy?.budgetReasons?.[c.key] || '')
              return (
                <div key={c.key} className="space-y-1.5 border border-violet-100 rounded-lg p-2">
                  <div className="flex items-baseline gap-2">
                  <label className="text-sm font-semibold flex-1">
                    {c.icon} {c.label}
                  </label>
                  {canEdit && editing ? (
                    <input
                      type="number"
                      min={0}
                      max={TOTAL_BUDGET}
                      value={v}
                      onChange={(e) => setBudgetField(c.key, e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                    />
                  ) : (
                    <span className="w-20 text-right tabular-nums font-mono font-bold text-violet-900">
                      {v}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 w-6">억</span>
                  </div>
                  {canEdit && editing ? (
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => {
                        setDirty(true)
                        setDraftBudgetReasons((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }}
                      placeholder="이 지출이 꼭 필요한 이유"
                      maxLength={80}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-300"
                    />
                  ) : (
                    <p className="text-[11px] text-gray-600">
                      필요 이유: {reason || <span className="text-gray-400">미입력</span>}
                    </p>
                  )}
                </div>
              )
            })}
            <div className={`flex items-baseline justify-between pt-2 border-t text-sm font-bold ${
              budgetSum === TOTAL_BUDGET ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              <span>합계</span>
              <span className="tabular-nums">{canEdit && editing ? budgetSum : (
                CATEGORIES.reduce((s, c) => s + (Number(policy?.budget?.[c.key]) || 0), 0)
              )} / {TOTAL_BUDGET} 억</span>
            </div>
          </div>
        </article>

        {/* ====== 우: 시행령 ====== */}
        <article className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
          <h4 className="font-bold text-violet-900">📋 시행령 작성</h4>
          {!canEdit && (
            <p className="text-[11px] text-gray-500">
              {isCollaborative ? '모둠원만 편집할 수 있어요.' : '장관만 편집할 수 있어요.'}
            </p>
          )}
          {canEdit && editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draftDecreeScaffold.owner}
                onChange={(e) => {
                  setDirty(true)
                  setDraftDecreeScaffold((prev) => ({ ...prev, owner: e.target.value }))
                }}
                maxLength={80}
                placeholder='(담당자) 누가 이 일을 하나요?'
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
              />
              <input
                type="text"
                value={draftDecreeScaffold.whenWhere}
                onChange={(e) => {
                  setDirty(true)
                  setDraftDecreeScaffold((prev) => ({ ...prev, whenWhere: e.target.value }))
                }}
                maxLength={120}
                placeholder='(시간 및 장소) 언제, 어디서 지키나요?'
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
              />
              {(draftDecreeScaffold.rules || []).map((rule, index) => (
                <input
                  key={index}
                  type="text"
                  value={rule}
                  onChange={(e) => {
                    setDirty(true)
                    setDraftDecreeScaffold((prev) => {
                      const nextRules = [...(prev.rules || ['', '', ''])]
                      nextRules[index] = e.target.value
                      return { ...prev, rules: nextRules }
                    })
                  }}
                  maxLength={120}
                  placeholder={`(세부 규칙 ${index + 1}) 구체적인 실행 방법`}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
                />
              ))}
              <textarea
                value={draftDecreeScaffold.rewardsPenalties}
                onChange={(e) => {
                  setDirty(true)
                  setDraftDecreeScaffold((prev) => ({ ...prev, rewardsPenalties: e.target.value }))
                }}
                maxLength={200}
                rows={2}
                placeholder='(상벌) 규칙 준수/위반 시 결과는?'
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 resize-none"
              />
              <input
                type="text"
                value={draftDecreeScaffold.exceptions}
                onChange={(e) => {
                  setDirty(true)
                  setDraftDecreeScaffold((prev) => ({ ...prev, exceptions: e.target.value }))
                }}
                maxLength={120}
                placeholder='(예외) 예외 상황은 언제인가요?'
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300"
              />
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-2">
                <p className="text-[11px] font-bold text-violet-800 mb-1">시행령 미리보기</p>
                <pre className="text-[11px] text-violet-900 whitespace-pre-wrap">{composedDecree}</pre>
              </div>
            </div>
          ) : (
            <div className="bg-violet-50/40 border border-violet-100 rounded-lg p-3 text-sm whitespace-pre-wrap min-h-[180px]">
              {policy?.decree || <span className="text-gray-400">아직 작성되지 않았어요.</span>}
            </div>
          )}
        </article>
      </div>

      {/* 저장 / 제출 / 동의 컨트롤 */}
      <footer className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
        {canEdit ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-violet-900 max-w-md">
              {isLocked ? (
                <span>✓ 제출 완료 — 온라인 토의 단계에 노출 중입니다. (수정 시 자동으로 작성 단계로 전환됩니다)</span>
              ) : editing ? (
                <>
                  💾 예산 100억을 모두 배정하고 시행령을 작성해 주세요. 
                  [저장] 후 {isCollaborative ? '모둠원이 공유하여 확인' : '장관이 제출'}할 수 있습니다.
                </>
              ) : (
                <span>✓ 저장됨 — 내용을 확인한 뒤 최종 제출해 주세요.</span>
              )}
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  {policy?.updatedAt && (
                    <button
                      onClick={cancelEdit}
                      className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold border-2 border-gray-300"
                    >
                      ✕ 취소
                    </button>
                  )}
                  <button
                    onClick={saveDraft}
                    disabled={busy || !dirty || budgetSum !== TOTAL_BUDGET || !budgetReasonsComplete}
                    className={`px-4 py-2 text-sm rounded-lg font-bold ${
                      busy || !dirty || budgetSum !== TOTAL_BUDGET || !budgetReasonsComplete
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                  >
                    {busy ? '저장 중...' : '💾 저장'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 text-sm rounded-lg bg-white border-2 border-violet-400 text-violet-700 font-bold hover:bg-violet-50"
                  >
                    ✏️ 수정
                  </button>
                  {isSubmitted ? (
                    <button
                      onClick={cancelSubmission}
                      disabled={busy}
                      className="px-4 py-2 text-sm rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50"
                    >
                      {busy ? '처리 중...' : '↩ 제출취소'}
                    </button>
                  ) : (
                    <button
                      onClick={submitPolicy}
                      disabled={
                        busy ||
                        !policy?.budget ||
                        !policy?.decree ||
                        CATEGORIES.reduce((s, c) => s + (Number(policy?.budget?.[c.key]) || 0), 0) !== TOTAL_BUDGET ||
                        !CATEGORIES.every((c) => String(policy?.budgetReasons?.[c.key] || '').trim().length > 0)
                      }
                      className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy ? '제출 중...' : '🚀 최종 제출'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-1">
              <p className="text-xs font-bold text-violet-900">
                👥 모둠원 동의 — {agreedCount} / {totalNeeded} 명
              </p>
              <p className="text-[11px] text-violet-700">
                동의 인원은 참고용이며, 최종 제출은 {isCollaborative ? '모둠원이' : '장관이'} 합니다.
              </p>
            </div>
            <button
              onClick={toggleApproval}
              disabled={!policy}
              className={`w-full py-2 text-sm rounded-lg font-bold transition ${
                myApproved
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : !policy
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {myApproved ? '✓ 동의함 (취소하려면 다시 클릭)' : (
                !policy ? '보고서가 저장되면 동의할 수 있어요' : '👍 우리 모둠 안에 동의'
              )}
            </button>
            <div className="flex flex-wrap gap-1">
              {nonMinisterMembers.map((sid) => {
                const stu = students?.[sid]
                const ok = !!approvedSet?.[sid]
                return (
                  <span
                    key={sid}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      ok ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ok ? '✓' : '·'} {stu?.nickname || sid}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* 역할별 동의 현황 (역할 중심 모드에서만 표시) */}
        {!isCollaborative && (
          <div className="pt-2 border-t border-violet-200">
            <p className="text-xs font-bold text-violet-900 mb-2">
              🧾 역할별 동의 현황 (장관 확인용)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {roleRows.map((row) => (
                <div
                  key={row.key}
                  className={`rounded-lg border px-2.5 py-2 text-xs ${
                    row.isMinisterRole
                      ? 'bg-blue-50 border-blue-200'
                      : row.approved
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="font-semibold text-gray-800 truncate">
                    {row.emoji} {row.label} · {row.studentName || '미배정'}
                    {!row.isMinisterRole && (
                      <span className={`ml-1 ${row.approved ? 'text-emerald-700' : 'text-gray-500'}`}>
                        · {row.approved ? '✓' : 'X'}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

export default MinisterPolicyDraft
