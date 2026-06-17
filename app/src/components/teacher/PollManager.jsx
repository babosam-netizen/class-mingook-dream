import { useEffect, useMemo, useState, useRef } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, updateAt, removeAt, pushUnder } from '../../lib/rtdb-helpers'
import { POLL_SLOTS, PHASE_STEPS, pollSlotOrder } from './PhaseWorkflow'

const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

// [Antigravity] 학급 설정에서 청원 머리말 가져오기 (기타 제외)
const getFilteredPrefixes = (config) => {
  const prefixes = config?.petitionConfig?.prefixOptions || []
  return prefixes.filter(p => p !== '기타' && p !== '')
}

/**
 * 일반화된 여론조사 관리 (교사용)
 *
 * 흐름:
 *   1) 교사가 폴 생성 (질문·옵션·태그) → status:'idle'
 *   2) 교사가 [실시] 클릭 → status:'voting' → 학생 응답 가능
 *   3) 교사가 [종료] → status:'closed' → 결과 교사만 봄
 *   4) 교사가 [게시] → status:'published' → 학생들도 결과 봄
 *
 * 1차/2차/3차/4차 여론조사 모두 같은 시스템.
 *
 * 데이터:
 *   polls/{pollId}: { question, options:[{id,label}], status, tag, createdAt }
 *   polls/{pollId}/votes/{studentId}: { optionId, at }
 */

const STATUS_LABEL = {
  idle:      { label: '⏸️ 준비',   cls: 'bg-gray-100 text-gray-700' },
  voting:    { label: '🗳️ 진행 중', cls: 'bg-amber-100 text-amber-800 animate-pulse' },
  closed:    { label: '🔒 종료',   cls: 'bg-rose-100 text-rose-800' },
  published: { label: '📢 게시됨', cls: 'bg-emerald-100 text-emerald-800' },
}

function PollManager() {
  const isProcessingRef = useRef(false)
  const roomCode = useGameStore((s) => s.roomCode)
  const roomData = useGameStore((s) => s.roomData)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)

  const [pollsMap, setPollsMap] = useState({})
  const [votesByPoll, setVotesByPoll] = useState({})

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  // slotKey: `${phase}:${stepId}` 또는 'custom'
  // 'custom' 일 때는 customPhase + customStepId 로 어느 단계에 노출할지 직접 지정
  const [draft, setDraft] = useState({
    slotKey: `${POLL_SLOTS[0].phase}:${POLL_SLOTS[0].stepId}`,
    tag: POLL_SLOTS[0].tag,
    question: '',
    options: ['', '', ''],
    allowReason: false,
    customPhase: 1,
    customStepId: PHASE_STEPS[1][0].id,
  })

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'polls', (d) => {
      const data = d || {}
      setPollsMap(data)
      // 각 폴의 votes를 함께 추출
      const votes = {}
      for (const [pid, p] of Object.entries(data)) {
        votes[pid] = p?.votes || {}
      }
      setVotesByPoll(votes)
    })
    return () => u?.()
  }, [roomCode])

  useEffect(() => {
    if (!roomCode) return
    const entries = Object.entries(pollsMap || {})
    if (!entries.length) return
    const targets = entries.filter(([id, p]) => {
      const phase = Number(p?.phaseStep?.phase || 0)
      const stepId = String(p?.phaseStep?.stepId || '')
      const isTarget = (phase === 1 && stepId === 'poll1') || (phase === 2 && stepId === 'prepoll')
      if (!isTarget) return false
      if (id === 'phase1_poll1' || id === 'phase2_prepoll') return false
      return !String(p?.question || '').trim()
    })
    if (!targets.length) return
    ;(async () => {
      for (const [id] of targets) {
        await removeAt(roomCode, `polls/${id}`)
      }
    })()
  }, [roomCode, pollsMap])
 
  // [Antigravity] 사전 여론조사 자동 활성화 보정 (기존 방 대응)
  useEffect(() => {
    if (!roomCode || !pollsMap?.phase1_prepoll) return
    if (pollsMap.phase1_prepoll.status === 'idle') {
      updateAt(roomCode, 'polls/phase1_prepoll', { status: 'voting' })
    }
  }, [roomCode, pollsMap?.phase1_prepoll?.status])

  // 페이즈 → 단계 순서로 정렬 (지정되지 않은 폴은 맨 뒤, 같은 슬롯끼리는 최신이 위)
  const polls = useMemo(
    () =>
      Object.entries(pollsMap)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => {
          const ao = a.phaseStep
            ? pollSlotOrder(a.phaseStep.phase, a.phaseStep.stepId)
            : 9999
          const bo = b.phaseStep
            ? pollSlotOrder(b.phaseStep.phase, b.phaseStep.stepId)
            : 9999
          if (ao !== bo) return ao - bo
          return (b.createdAt || 0) - (a.createdAt || 0)
        }),
    [pollsMap],
  )

  const setStatus = async (pid, status) => {
    await updateAt(roomCode, `polls/${pid}`, {
      status,
      ...(status === 'published' ? { publishedAt: Date.now() } : {}),
    })

    // [Antigravity] 사후 여론조사 1 종료/게시 시 자동으로 최우선 과제 선정 로직은 제거되었습니다.
    // 이제 교사가 직접 목록에서 [선정] 버튼을 눌러야만 확정됩니다.
  }

  // [Antigravity] 특정 항목을 최우선 과제로 확정하는 유틸리티 (토글 기능 추가)
  const selectAsCoreIssue = async (optionLabel) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
      // 1. 선택지 텍스트 정규화 (예: "환경 문제" -> "환경")
      const targetTopicName = optionLabel.replace(' 문제', '').trim()
      
      // 2. 해당 주제를 다루는 모둠 찾기
      const matchingGroupEntry = Object.entries(groups || {}).find(([gid, g]) => {
        const gTopic = g.topic || ''
        return gTopic === targetTopicName || gid === targetTopicName || g.name?.includes(targetTopicName)
      })

      const value = matchingGroupEntry ? matchingGroupEntry[0] : targetTopicName
      
      // [Antigravity] 토글 로직: 이미 선택된 값이면 해제 (비교 로직을 UI와 맞춤)
      const currentIssue = roomData?.coreIssue
      const isAlreadySelected = (
        currentIssue === value || 
        currentIssue === optionLabel || 
        (groups && groups[currentIssue]?.topic === targetTopicName)
      )
      
      const nextValue = isAlreadySelected ? null : value

      await updateAt(roomCode, '', { coreIssue: nextValue })
      
      if (nextValue) {
        alert(`'${optionLabel}' 항목이 우리 반의 '최우선 과제'로 선정되었습니다.`)
      } else {
        alert(`'${optionLabel}' 항목 선정이 취소되었습니다.`)
      }
    } finally {
      isProcessingRef.current = false
    }
  }

  const remove = (pid) => {
    if (!confirm('이 여론조사를 영구 삭제할까요?')) return
    removeAt(roomCode, `polls/${pid}`)
  }

  const togglePopup = (pid) => {
    const current = roomData?.activePopupPoll
    const next = current === pid ? null : pid
    updateAt(roomCode, '', { activePopupPoll: next })
  }

  const tally = (pid) => {
    const v = votesByPoll[pid] || {}
    const counts = {}
    for (const vote of Object.values(v)) {
      if (!vote?.optionId) continue
      counts[vote.optionId] = (counts[vote.optionId] || 0) + 1
    }
    return counts
  }

  const onCreate = async () => {
    const opts = draft.options
      .map((o) => o.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `opt_${i}_${Date.now().toString(36).slice(-3)}`, label }))
    if (!draft.question.trim() || opts.length < 2) {
      alert('질문 + 옵션 2개 이상 필요합니다.')
      return
    }
    let phaseStep = null
    if (draft.slotKey === 'now') {
      phaseStep = null // 특정 여정·단계 없음 — 교사가 직접 실시
    } else if (draft.slotKey === 'custom') {
      if (!draft.customStepId) {
        alert('단계를 선택해 주세요.')
        return
      }
      phaseStep = { phase: Number(draft.customPhase), stepId: draft.customStepId }
    } else {
      const [pStr, sid] = draft.slotKey.split(':')
      phaseStep = { phase: Number(pStr), stepId: sid }
    }
    await pushUnder(roomCode, 'polls', {
      tag: draft.tag.trim() || '여론조사',
      question: draft.question.trim(),
      options: opts,
      status: 'idle',
      phaseStep,
      allowReason: draft.allowReason,
    })
    setDraft({
      slotKey: `${POLL_SLOTS[0].phase}:${POLL_SLOTS[0].stepId}`,
      tag: POLL_SLOTS[0].tag,
      question: '',
      options: ['', '', ''],
      allowReason: false,
      customPhase: 1,
      customStepId: PHASE_STEPS[1][0].id,
    })
    setCreating(false)
  }

  const buildOptionObjects = (labels) =>
    labels
      .map((o) => getText(o).trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `opt_${i}_${Date.now().toString(36).slice(-3)}`, label }))

  const getSlotOptions = (slot) => {
    if (!slot) return ['', '', '']
    if (slot.useGroups) {
      const groupNames = Object.entries(groups || {}).map(([gid, g]) => g?.name || gid)
      if (groupNames.length) return groupNames
      return ['1모둠', '2모둠', '3모둠', '4모둠', '5모둠', '6모둠']
    }
    return slot.options?.length ? slot.options : ['', '', '']
  }

  const startEdit = (poll) => {
    setEditingId(poll.id)
    setEditDraft({
      tag: poll.tag || '여론조사',
      question: poll.question || '',
      options: (poll.options || []).map((o) => getText(o?.label || o)).concat(['']).slice(0, 10),
      phase: Number(poll.phaseStep?.phase || 1),
      stepId: poll.phaseStep?.stepId || PHASE_STEPS[1]?.[0]?.id,
      allowReason: !!poll.allowReason,
    })
  }

  const saveEdit = async (poll) => {
    if (!editDraft || editingId !== poll.id) return
    const nextOpts = buildOptionObjects(editDraft.options || [])
    if (!editDraft.question.trim() || nextOpts.length < 2) {
      alert('질문 + 옵션 2개 이상 필요합니다.')
      return
    }
    const prevLabels = (poll.options || []).map((o) => getText(o?.label || o)).join('||')
    const nextLabels = nextOpts.map((o) => o.label).join('||')
    const hasVotes = Object.keys(poll.votes || {}).length > 0
    const optionsChanged = prevLabels !== nextLabels
    if (hasVotes && optionsChanged) {
      const ok = confirm('옵션을 바꾸면 기존 투표 결과가 초기화됩니다. 계속할까요?')
      if (!ok) return
    }
    const phase = Number(editDraft.phase) || 1
    const stepId = editDraft.stepId || PHASE_STEPS[phase]?.[0]?.id
    await updateAt(roomCode, `polls/${poll.id}`, {
      tag: editDraft.tag.trim() || '여론조사',
      question: editDraft.question.trim(),
      options: nextOpts,
      phaseStep: { phase, stepId },
      allowReason: editDraft.allowReason,
      ...(hasVotes && optionsChanged ? { votes: null } : {}),
    })
    setEditingId(null)
    setEditDraft(null)
  }

  const onSelectSlot = (slotKey) => {
    if (slotKey === 'now') {
      setDraft({ ...draft, slotKey, tag: '수시' })
      return
    }
    if (slotKey === 'custom') {
      setDraft({
        ...draft,
        slotKey,
        tag: '여론조사',
        customPhase: 1,
        customStepId: PHASE_STEPS[1][0].id,
      })
      return
    }
    const slot = POLL_SLOTS.find(
      (s) => `${s.phase}:${s.stepId}` === slotKey,
    )
    if (slot) {
      let options = slot.options || ['', '', '']
      if (slot.useGroups) {
        options = Object.entries(groups).map(([gid, g]) => g.name || gid)
      }
      setDraft({ 
        ...draft, 
        slotKey, 
        tag: slot.tag, 
        question: slot.question || '', 
        options: options.length ? options : ['', '', ''] 
      })
    }
  }

  const onSelectCustomPhase = (phaseStr) => {
    const phase = Number(phaseStr)
    const firstStepId = PHASE_STEPS[phase]?.[0]?.id
    setDraft({ ...draft, customPhase: phase, customStepId: firstStepId })
  }

  // 모둠을 옵션으로 빠르게 채우기
  const fillFromGroups = () => {
    const list = Object.entries(groups).map(([gid, g]) => g.name || gid)
    setDraft({ ...draft, options: list.length ? list : ['', '', ''] })
  }

  const realtimePolls = useMemo(() => polls.filter((p) => !p.phaseStep), [polls])
  const plannedPolls = useMemo(() => polls.filter((p) => !!p.phaseStep), [polls])

  const renderPollItem = (poll) => {
    const isEditing = editingId === poll.id && !!editDraft
    const counts = tally(poll.id)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const sorted = (poll.options || [])
      .map((o) => ({ ...o, count: counts[o.id] || 0 }))
      .sort((a, b) => b.count - a.count)
    const status = STATUS_LABEL[poll.status] || STATUS_LABEL.idle

    return (
      <li key={poll.id} className="border rounded-xl p-3 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-indigo-600">
                {getText(poll.tag)}
              </span>
              {poll.phaseStep ? (
                (() => {
                  const ps = poll.phaseStep
                  const steps = PHASE_STEPS[ps.phase] || []
                  const idx = steps.findIndex((s) => s.id === ps.stepId)
                  const step = idx >= 0 ? steps[idx] : null
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                      Phase {ps.phase} · {idx + 1}단계
                      {step?.session && ` · ${step.session}`}
                    </span>
                  )
                })()
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  기타
                </span>
              )}
            </div>
            <h3 className="font-bold text-sm mt-0.5 text-gray-800">{getText(poll.question)}</h3>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2">
            <input
              type="text"
              value={editDraft.tag}
              onChange={(e) => setEditDraft({ ...editDraft, tag: e.target.value })}
              className="w-full px-2 py-1 text-xs rounded border border-indigo-300 focus:ring-2 focus:ring-indigo-200"
              placeholder="태그"
            />
            <input
              type="text"
              value={editDraft.question}
              onChange={(e) => setEditDraft({ ...editDraft, question: e.target.value })}
              className="w-full px-2 py-1 text-sm rounded border border-indigo-300 focus:ring-2 focus:ring-indigo-200"
              placeholder="질문"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editDraft.phase}
                onChange={(e) => {
                  const phase = Number(e.target.value)
                  setEditDraft({
                    ...editDraft,
                    phase,
                    stepId: PHASE_STEPS[phase]?.[0]?.id,
                  })
                }}
                className="px-2 py-1 text-xs rounded border border-indigo-300 bg-white"
              >
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>Phase {p}</option>
                ))}
              </select>
              <select
                value={editDraft.stepId}
                onChange={(e) => setEditDraft({ ...editDraft, stepId: e.target.value })}
                className="px-2 py-1 text-xs rounded border border-indigo-300 bg-white"
              >
                {(PHASE_STEPS[editDraft.phase] || []).map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {idx + 1}단계 · {s.studentLabel || s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-1.5 px-1">
                <input
                  type="checkbox"
                  checked={editDraft.allowReason}
                  onChange={(e) => setEditDraft({ ...editDraft, allowReason: e.target.checked, requireReason: e.target.checked ? editDraft.requireReason : false })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-indigo-800">✍️ 참여 시 이유 쓰기 허용</span>
              </label>
              {editDraft.allowReason && (
                <label className="flex items-center gap-1.5 px-5 py-0.5">
                  <input
                    type="checkbox"
                    checked={!!editDraft.requireReason}
                    onChange={(e) => setEditDraft({ ...editDraft, requireReason: e.target.checked })}
                    className="w-3.5 h-3.5 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                  />
                  <span className="text-xs text-rose-700 font-semibold">이유 쓰기 필수</span>
                </label>
              )}
            </div>

            {/* [Antigravity] 선택지 자동 채우기 도구 (Phase 1 사전 여론조사 등) */}
            <div className="flex gap-1 items-center mb-1">
              <span className="text-[10px] font-bold text-gray-400 mr-1">도구:</span>
              <button
                type="button"
                onClick={() => {
                  const prefixes = getFilteredPrefixes(config)
                  if (prefixes.length > 0) {
                    setEditDraft({ ...editDraft, options: [...prefixes, ''] })
                  } else {
                    alert('학급 설정에 등록된 청원 머리말이 없습니다.')
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100"
              >
                청원 머리말로 채우기
              </button>
            </div>

            <div className="space-y-1">
              {(editDraft.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...(editDraft.options || [])]
                      next[idx] = e.target.value
                      setEditDraft({ ...editDraft, options: next })
                    }}
                    className="min-w-0 flex-1 px-2 py-1 text-xs rounded border border-indigo-300"
                    placeholder={`옵션 ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (editDraft.options || []).filter((_, optionIdx) => optionIdx !== idx)
                      setEditDraft({ ...editDraft, options: next.length ? next : [''] })
                    }}
                    className="shrink-0 px-2 py-1 text-[10px] rounded border border-red-100 bg-red-50 text-red-600 font-bold hover:bg-red-100"
                    title="이 보기 삭제"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditDraft({ ...editDraft, options: [...(editDraft.options || []), ''] })}
                className="text-[11px] text-indigo-700 hover:underline px-1"
              >
                + 옵션 추가
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            {sorted.map((o, idx) => {
              const pct = total ? Math.round((o.count / total) * 100) : 0
              const label = getText(o.label)
              return (
                <div
                  key={o.id}
                  className={`relative rounded overflow-hidden text-xs h-8 flex items-center transition-all ${
                    (roomData?.coreIssue === o.id || roomData?.coreIssue === label || (groups && groups[roomData?.coreIssue]?.topic === label.replace(' 문제', '')))
                      ? 'bg-amber-100 border-2 border-amber-400 ring-2 ring-amber-200 z-10'
                      : 'bg-gray-100'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      (roomData?.coreIssue === o.id || roomData?.coreIssue === label || (groups && groups[roomData?.coreIssue]?.topic === label.replace(' 문제', '')))
                        ? 'bg-amber-200'
                        : 'bg-indigo-100'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative w-full px-2 flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-bold">
                        {(roomData?.coreIssue === o.id || roomData?.coreIssue === label || (groups && groups[roomData?.coreIssue]?.topic === label.replace(' 문제', ''))) ? '👑 ' : idx === 0 && total > 0 ? '🏆 ' : ''}
                        {label}
                      </span>
                      {/* [Antigravity] 사후 여론조사 1 전용 선정 컨트롤 */}
                      {(poll.phaseStep?.phase === 1 && poll.phaseStep?.stepId === 'poll1') && (
                        (roomData?.coreIssue === o.id || roomData?.coreIssue === label || (groups && groups[roomData?.coreIssue]?.topic === label.replace(' 문제', ''))) ? (
                          <span className="shrink-0 px-2 py-0.5 rounded bg-amber-600 text-white text-[9px] font-black shadow-sm animate-bounce">
                            ✅ 선정됨
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if(confirm(`'${getText(label)}' 항목을 우리 반의 최종 최우선 과제로 확정할까요?`)) {
                                selectAsCoreIssue(getText(label))
                              }
                            }}
                            className="shrink-0 px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-700 text-[9px] font-black hover:bg-amber-500 hover:text-white transition-colors shadow-sm"
                          >
                            🎯 선정
                          </button>
                        )
                      )}
                    </div>
                    <span className={`font-mono text-[10px] whitespace-nowrap ${(roomData?.coreIssue === o.id || roomData?.coreIssue === label || (groups && groups[roomData?.coreIssue]?.topic === label.replace(' 문제', ''))) ? 'text-amber-900 font-black' : 'text-gray-500'}`}>
                      {o.count}표 ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            참여 {total}명
            {poll.status === 'closed' && ' · 결과 비공개'}
            {poll.status === 'published' && ' · 결과 공개됨'}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] border-t pt-3">
          {poll.status === 'idle' ? (
            <button
              onClick={() => setStatus(poll.id, 'voting')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-sm"
            >
              ▶️ 시작
            </button>
          ) : poll.status === 'voting' ? (
            <button
              onClick={() => setStatus(poll.id, 'closed')}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm"
            >
              🔒 종료
            </button>
          ) : (
            <button
              onClick={() => setStatus(poll.id, 'voting')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 font-bold hover:bg-amber-200"
            >
              ↩️ 재개
            </button>
          )}

          {poll.status === 'published' ? (
            <button
              onClick={() => setStatus(poll.id, 'closed')}
              className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-300 font-bold hover:bg-gray-200"
            >
              🚫 취소
            </button>
          ) : (
            <button
              onClick={() => setStatus(poll.id, 'published')}
              className={`px-2.5 py-1.5 rounded-lg font-bold shadow-sm ${
                poll.status === 'idle'
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              disabled={poll.status === 'idle'}
            >
              📢 게시
            </button>
          )}

          <button
            onClick={() => togglePopup(poll.id)}
            disabled={poll.status === 'idle'}
            className={`px-2.5 py-1.5 rounded-lg font-bold shadow-sm ${
              poll.status === 'idle'
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                : roomData?.activePopupPoll === poll.id
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
            }`}
          >
            {roomData?.activePopupPoll === poll.id ? '👇 내리기' : '🚀 팝업'}
          </button>

          <div className="flex-1" />

          {!isEditing ? (
            <button
              onClick={() => startEdit(poll)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold hover:bg-indigo-100"
            >
              수정
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={() => saveEdit(poll)}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditDraft(null)
                }}
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          )}
          <button
            onClick={() => remove(poll.id)}
            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold hover:bg-red-100"
          >
            삭제
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-bold text-indigo-700">📊 여론조사 관리</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >
            {creating ? '취소' : '+ 새 여론조사'}
          </button>
        </div>
      </header>

      {creating && (
        <div className="border rounded-xl p-3 space-y-2 bg-gray-50">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">
              실시 시점 (어느 페이즈·단계에 제시할지)
            </p>
            <select
              value={draft.slotKey}
              onChange={(e) => onSelectSlot(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 bg-white"
            >
              <option value="now">⚡ 지금 바로 (수시 실시)</option>
              {POLL_SLOTS.map((s) => (
                <option key={`${s.phase}:${s.stepId}`} value={`${s.phase}:${s.stepId}`}>
                  {s.label}
                </option>
              ))}
              <option value="custom">기타 (자유 주제)</option>
            </select>
          </div>
          {draft.slotKey === 'custom' && (
            <div className="space-y-2 bg-amber-50 border border-amber-200 rounded p-2">
              <p className="text-[11px] font-semibold text-amber-800">
                기타 — 어느 페이즈·단계에 노출할지 직접 선택
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={draft.customPhase}
                  onChange={(e) => onSelectCustomPhase(e.target.value)}
                  className="px-2 py-1.5 text-sm rounded border border-gray-300 bg-white"
                >
                  {[1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      Phase {p}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.customStepId}
                  onChange={(e) =>
                    setDraft({ ...draft, customStepId: e.target.value })
                  }
                  className="px-2 py-1.5 text-sm rounded border border-gray-300 bg-white"
                >
                  {(PHASE_STEPS[draft.customPhase] || []).map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {idx + 1}단계 · {s.studentLabel || s.label}
                      {s.session ? ` (${s.session})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                placeholder="태그 (예: 임시)"
                maxLength={10}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
              />
            </div>
          )}
          <input
            type="text"
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            placeholder="질문 (예: 가장 시급한 문제는?)"
            className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-600">옵션 (2개 이상)</p>
              {/* [Antigravity] 생성 시에도 청원 머리말 가져오기 버튼 제공 (Phase 1용) */}
              <button
                type="button"
                onClick={() => {
                  const prefixes = getFilteredPrefixes(config)
                  if (prefixes.length > 0) {
                    setDraft({ ...draft, options: [...prefixes, ''] })
                  } else {
                    alert('학급 설정에 등록된 청원 머리말이 없습니다.')
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100"
              >
                청원 머리말로 채우기
              </button>
            </div>
            {draft.options.map((opt, i) => (
              <input
                key={i}
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...draft.options]
                  next[i] = e.target.value
                  setDraft({ ...draft, options: next })
                }}
                placeholder={`옵션 ${i + 1}`}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
              />
            ))}
            <div className="flex gap-1">
              <button
                onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}
                className="text-xs text-indigo-600 hover:underline"
              >
                + 옵션 추가
              </button>
              <button
                onClick={fillFromGroups}
                className="text-xs text-emerald-600 hover:underline ml-auto"
              >
                모둠으로 옵션 채우기
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 px-1 py-1">
              <input
                type="checkbox"
                checked={draft.allowReason}
                onChange={(e) => setDraft({ ...draft, allowReason: e.target.checked, requireReason: e.target.checked ? draft.requireReason : false })}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-indigo-800">✍️ 참여 시 이유 쓰기 허용</span>
            </label>
            {draft.allowReason && (
              <label className="flex items-center gap-1.5 px-5 py-0.5">
                <input
                  type="checkbox"
                  checked={!!draft.requireReason}
                  onChange={(e) => setDraft({ ...draft, requireReason: e.target.checked })}
                  className="w-3.5 h-3.5 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                />
                <span className="text-xs text-rose-700 font-semibold">이유 쓰기 필수</span>
              </label>
            )}
          </div>
          <button
            onClick={onCreate}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            만들기 (준비 상태)
          </button>
        </div>
      )}

      <div className="space-y-6">
        {realtimePolls.length > 0 && (
          <div>
            <h3 className="font-bold text-sm text-indigo-800 mb-2 border-b-2 border-indigo-200 pb-1 flex items-center gap-2">
              <span>⚡ 수시 (실시간) 여론조사</span>
              <span className="text-[10px] font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">맨 위로 고정됨</span>
            </h3>
            <ul className="space-y-3">
              {realtimePolls.map(renderPollItem)}
            </ul>
          </div>
        )}
        <div>
          <h3 className="font-bold text-sm text-indigo-800 mb-2 border-b-2 border-indigo-200 pb-1 flex items-center justify-between">
            <span>📊 정규 (계획된) 여론조사</span>
            <span className="text-[10px] font-normal text-gray-400">페이즈별 단계에 자동 노출</span>
          </h3>
          <ul className="space-y-3">
            {plannedPolls.length === 0 ? (
              <li className="text-sm text-gray-400 text-center py-8 border-2 border-dashed rounded-xl bg-gray-50">
                아직 만들어진 여론조사가 없어요.
              </li>
            ) : (
              plannedPolls.map(renderPollItem)
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default PollManager
