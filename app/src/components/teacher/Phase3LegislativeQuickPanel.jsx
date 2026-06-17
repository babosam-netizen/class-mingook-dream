import { Fragment, useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt, pushUnder } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { isDiscussionBill } from '../../lib/bill-status'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'

const DEFAULT_STANCE_OPTIONS = [
  { id: 'pro', label: '찬성' },
  { id: 'con', label: '반대' },
  { id: 'neutral', label: '중립' },
]

function buildBillBodyText(bill) {
  if (bill?.body) return bill.body
  const data = bill?.templateData || {}
  const lines = []
  if (data.purpose) lines.push(`제1조 (목적) ${data.purpose}`)
  if (data.definition) lines.push(`제2조 (정의) ${data.definition}`)
  if (data.duty) lines.push(`제3조 (의무) ${data.duty}`)
  if (data.penalty) lines.push(`제4조 (벌칙) ${data.penalty}`)
  if (lines.length) return lines.join('\n\n')

  const sectionLabels = {
    background: '입법 배경',
    clause: '핵심 조항',
    effect: '예상 효과',
    rebuttal: '우려 대응',
  }
  for (const [key, label] of Object.entries(sectionLabels)) {
    if (data[key]) lines.push(`[${label}]\n${data[key]}`)
  }
  return lines.join('\n\n')
}

function BillReviewDetails({ bill }) {
  const body = buildBillBodyText(bill)
  const comments = bill._comments || []
  return (
    <details className="bg-white/70 border border-amber-100 rounded-lg overflow-hidden">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-white">
        법안 내용·온라인 댓글평가 보기 ({comments.length}건)
      </summary>
      <div className="p-2.5 space-y-2 border-t border-amber-100">
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <p className="text-[10px] font-bold text-slate-500 mb-1">상정 검토 내용</p>
          <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
            {body || '아직 본문 내용이 없습니다.'}
          </p>
        </div>
        {comments.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-2">
            아직 온라인 댓글평가가 없습니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {comments.map((c) => {
              const r = c.ratings || {}
              return (
                <li key={c.id} className="bg-white border border-gray-100 rounded p-2 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 flex-wrap text-gray-500 mb-1">
                    <span className="font-bold text-slate-600">
                      {c.authorNumber}번 {c.authorNickname || '학생'}
                    </span>
                    <span>공익 {r.relevance || 0}</span>
                    <span>실행 {r.feasibility || 0}</span>
                    <span>타당 {r.logic || 0}</span>
                    {c.updatedAt && <span className="text-amber-600">수정됨</span>}
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap">{c.body}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}

// 등수 표시용 — 1·2·3등에는 메달, 그 외에는 숫자 배지
function RankBadge({ rank }) {
  const MEDALS = { 0: { emoji: '🥇', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
                   1: { emoji: '🥈', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
                   2: { emoji: '🥉', cls: 'bg-orange-100 text-orange-800 border-orange-300' } }
  const medal = MEDALS[rank]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
      medal?.cls || 'bg-gray-100 text-gray-600 border-gray-300'
    }`}>
      {medal ? <>{medal.emoji} {rank + 1}등</> : <>{rank + 1}등</>}
    </span>
  )
}

/**
 * 교사 대시보드 — Phase 3 입법부 빠른 제어 패널 (패턴 C 적용).
 *
 * /phase3 페이지로 이동하지 않고도 다음 액션을 즉시 수행:
 *  - 토의 중 법안 → [✓ N등 법안 정식 상정]
 *  - 정식 상정 법안 → [🎬 전광판 띄우기] / [표결 마감]
 *  - 부결 후 → 다음 후보 법안 자동 안내
 */
function Phase3LegislativeQuickPanel({ onOpenDebateTool }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const billBoard = useGameStore((s) => s.roomData?.billBoard)
  const config = useGameStore((s) => s.config)

  const branchConfig = config?.branchConfig
  const isCollaborative = (branchConfig?.legislative?.mode || 'role_based') === 'collaborative'
  const isRolesLocked = Boolean(config?.branchRolesLocked?.legislative)

  const toggleRoleLock = async () => {
    await updateAt(roomCode, 'config', {
      branchRolesLocked: {
        ...(config?.branchRolesLocked || {}),
        legislative: !isRolesLocked,
      },
    })
  }

  const resetAllRoles = async () => {
    if (!roomCode || !groups) return
    if (!confirm('🚨 모든 입법부 모둠원 역할 지정을 정말 초기화(배정 취소)할까요?')) return
    const updates = {}
    for (const groupId of Object.keys(groups)) {
      updates[`groups/${groupId}/sessionRoles/legislative-default`] = null
    }
    try {
      await updateAt(roomCode, '', updates)
      alert('모든 입법부 역할 지정을 초기화했습니다.')
    } catch (err) {
      alert('초기화 에러: ' + err.message)
    }
  }

  const [billsMap, setBillsMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [debateSessions, setDebateSessions] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'bills', (d) => setBillsMap(d || {}))
    const u2 = subscribe(roomCode, 'comments', (d) => setCommentsMap(d || {}))
    const u3 = subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {}))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [roomCode])

  // 다축 점수 계산
  const scoreOf = (billId) => {
    let sl = 0, sf = 0, sr = 0, n = 0
    for (const c of Object.values(commentsMap)) {
      if (c?.targetType !== 'bill' || c?.targetId !== billId || !c?.ratings) continue
      sl += Number(c.ratings.logic) || 0
      sf += Number(c.ratings.feasibility) || 0
      sr += Number(c.ratings.relevance) || 0
      n += 1
    }
    if (n === 0) return null
    return { n, overall: (sl + sf + sr) / (n * 3) }
  }

  const bills = useMemo(() => {
    return Object.entries(billsMap).map(([id, b]) => {
      const score = scoreOf(id)
      const prefMap = b.preferences || {}
      const prefCount = Object.values(prefMap).filter((v) => v?.liked).length
      const comments = Object.entries(commentsMap)
        .map(([cid, c]) => ({ id: cid, ...c }))
        .filter((c) => c?.targetType === 'bill' && c?.targetId === id)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      const finalVotes = b.finalVotes || {}
      const tally = { pro: 0, con: 0, abstain: 0 }
      for (const v of Object.values(finalVotes)) {
        if (v?.choice && tally[v.choice] !== undefined) tally[v.choice] += 1
      }
      const total = tally.pro + tally.con + tally.abstain
      return { id, ...b, _score: score, _prefCount: prefCount, _comments: comments, _tally: { ...tally, total } }
    })
  }, [billsMap, commentsMap])

  const discussionBills = useMemo(() => {
    return bills
      .filter(isDiscussionBill)
      .sort((a, b) => {
        if (!!b.teacherRecommended !== !!a.teacherRecommended) return b.teacherRecommended ? 1 : -1
        if (!!b.tablingRequested !== !!a.tablingRequested) return b.tablingRequested ? 1 : -1
        const sa = a._score?.overall || 0
        const sb = b._score?.overall || 0
        if (Math.abs(sa - sb) > 0.001) return sb - sa
        if (b._prefCount !== a._prefCount) return b._prefCount - a._prefCount
        return (a.createdAt || 0) - (b.createdAt || 0)
      })
  }, [bills])

  // 표결 발표 직후(voteResult 있고 전광판에 결과 표시 중)도 tabled 카드 영역에 유지
  const tabledBills = bills.filter((b) =>
    b.status === 'tabled' ||
    (b.voteResult && billBoard?.billId === b.id && billBoard?.active)
  )
  const closedBills = useMemo(
    () => bills
      .filter((b) => b.status === 'passed' || b.status === 'rejected')
      .sort((a, b) => (b.finalizedAt || 0) - (a.finalizedAt || 0)),
    [bills],
  )
  // 직전 부결 — 다음 후보 심사 안내 트리거
  const lastClosed = closedBills[0]
  const justRejected =
    lastClosed?.status === 'rejected' &&
    tabledBills.length === 0 &&
    discussionBills.length > 0

  const wf = useWorkflow()
  const stepIndex = useGameStore((s) => s.roomData?.workflow?.phase3?.stepIndex ?? 0)
  const isVotingActive = !!billBoard?.active && tabledBills.some((b) => b.id === billBoard?.billId)
  const wfStage = wf.currentStep?.stage
  let stage, stageLabel, nextHint
  if (wfStage !== undefined) {
    stage = wfStage
    const STAGE_INFO = [
      ['① 준비', '학생들이 역할을 선택하고 법안 근거 자료실에서 필요한 자료를 수집하도록 안내하세요. 모든 역할 선택이 완료되면 아래 [역할 잠금] 버튼으로 역할을 확정하세요.'],
      ['② 법안 발의', '학생들이 역할별 작업 공간에서 미션 수행 후 발의 템플릿으로 법안을 올릴 때까지 기다리세요. 모두 발의했으면 [페이즈/활동 단계] 에서 다음 단계로 넘기세요.'],
      ['③ 토의 및 평가', '⬇️ 점수 1·2·3등 법안 중 하나를 [✓ 정식 상정] 버튼으로 상정+토론 단계로 넘기세요.'],
      ['④ 상정 토론', '🎙️ [이 법안으로 오프라인 토론 시작] → 토론 후 [🎬 전광판 띄우기] 로 표결 단계로 진행.'],
      ['⑤ 표결', '🗳️ 학생 표결 진행 중 — 모두 투표하면 다음 단계로 넘겨 발표하세요.'],
      ['⑥ 발표', '🗳️ [표결 발표] 또는 [표결 마감]으로 결과를 정리하고, 의결 종료 법안을 발표 화면에서 확인하세요.'],
    ]
    ;[stageLabel, nextHint] = STAGE_INFO[stage] || STAGE_INFO[0]
  } else if (bills.length === 0) {
    stage = 0; stageLabel = '① 준비'
    nextHint = '학생들이 법안 근거 자료실에서 자료 목록을 정하고 근거 자료를 수집하도록 안내하세요.'
  } else if (tabledBills.length === 0 && discussionBills.length > 0) {
    stage = 2; stageLabel = '③ 토의 및 평가'
    nextHint = '⬇️ 점수 1·2·3등 법안 중 하나를 [✓ 정식 상정] 버튼으로 상정+토론 단계로 넘기세요.'
  } else if (tabledBills.length > 0 && !isVotingActive && !tabledBills.some((b) => b.voteResult)) {
    stage = 3; stageLabel = '④ 상정 토론'
    nextHint = '🎙️ [이 법안으로 오프라인 토론 시작] → 토론 후 [🎬 전광판 띄우기] 로 표결 단계로 진행.'
  } else if (tabledBills.length > 0 && isVotingActive && !tabledBills.some((b) => b.voteResult)) {
    stage = 4; stageLabel = '⑤ 표결'
    nextHint = '🗳️ 학생 표결 진행 중 — 모두 투표하면 [표결 발표] 로 결과를 전광판에 띄우세요.'
  } else if (tabledBills.some((b) => b.voteResult)) {
    stage = 5; stageLabel = '⑥ 발표'
    nextHint = '🗳️ 결과 발표 중 — [표결 마감] 으로 전광판을 끄고 의결을 종료하세요.'
  } else {
    stage = 5; stageLabel = '⑥ 발표'
    nextHint = '결과는 발표 단계의 의결 종료 법안 목록에서 확인.'
  }

  // 이전/다음 단계 라벨 (실제 step 의 studentLabel 사용)
  const prevStep = stepIndex > 0 ? wf.steps[stepIndex - 1] : null
  const nextStep = stepIndex < wf.steps.length - 1 ? wf.steps[stepIndex + 1] : null
  const prevShort = prevStep?.studentLabel?.replace(/^입법\s*/, '') || null
  const nextShort = nextStep?.studentLabel?.replace(/^입법\s*/, '') || null

  const tableThisBill = async (bill, rankNote = '') => {
    const noteText = rankNote ? `(${rankNote}) ` : ''
    if (!confirm(`${noteText}'${bill.title}' 을 정식 상정할까요?\n본회의 표결로 넘어갑니다.`)) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: 'tabled',
      tabledAt: Date.now(),
      tablingRequested: null,
      tablingRequestedAt: null,
      tablingRequestedBy: null,
    })
  }

  const toggleTeacherRecommendation = async (bill) => {
    if (bill.teacherRecommended) {
      await updateAt(roomCode, `bills/${bill.id}`, {
        teacherRecommended: null,
        teacherRecommendedAt: null,
      })
    } else {
      await updateAt(roomCode, `bills/${bill.id}`, {
        teacherRecommended: true,
        teacherRecommendedAt: Date.now(),
      })
    }
  }

  const toggleBoard = async (bill) => {
    const active = billBoard?.active && billBoard?.billId === bill.id
    if (active) {
      await setAt(roomCode, 'billBoard', { active: false, billId: null })
    } else {
      await setAt(roomCode, 'billBoard', { active: true, billId: bill.id })
      const url = `${window.location.origin}${window.location.pathname}#/tv-board?room=${encodeURIComponent(roomCode)}`
      window.open(
        url,
        'tvboard_' + bill.id,
        'width=1280,height=800,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no',
      )
    }
  }

  // 표결 발표 — 결과 확정 + 전광판은 결과 화면 모드로 전환 (active 유지)
  const announceResult = async (bill) => {
    const t = bill._tally
    const passed = t.total > 0 && t.pro / t.total > 0.5
    if (!confirm(
      `'${bill.title}' 결과를 전광판에 발표합니다.\n\n` +
      `찬성 ${t.pro} / 반대 ${t.con} / 기권 ${t.abstain} (총 ${t.total}명)\n` +
      `→ ${passed ? '✅ 가결' : '❌ 부결'}\n\n` +
      `전광판이 결과 화면으로 전환됩니다. 계속할까요?`
    )) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: passed ? 'passed' : 'rejected',
      voteResult: { ...t, passed },
      finalizedAt: Date.now(),
    })
    // 전광판은 active 유지하고 resultShown 만 켜서 결과 화면으로 전환
    await updateAt(roomCode, 'billBoard', {
      active: true,
      billId: bill.id,
      resultShown: true,
    })
  }

  // 표결 마감 — 전광판 끄기 (이미 발표된 결과는 closedBills 로 정리됨)
  const closeBoard = async () => {
    if (!confirm('전광판을 끄고 의결을 마무리합니다. 계속할까요?')) return
    await setAt(roomCode, 'billBoard', { active: false, billId: null, resultShown: false })
  }

  const startDebateOnBill = async (bill) => {
    const existing = Object.entries(debateSessions).find(
      ([, s]) => s?.relatedBillId === bill.id && s?.isActive,
    )
    if (existing) {
      alert(`이미 '${bill.title}' 으로 진행 중인 토론 세션이 있습니다.\n토론 도구 패널에서 확인하세요.`)
      return
    }
    if (!confirm(
      `'${bill.title}' 법안으로 오프라인 토론을 시작할까요?\n\n` +
      `· 기존 활성 토론 세션은 자동 종료\n` +
      `· 토론 도구 패널이 자동으로 열립니다\n` +
      `· 논제로 법안 본문이 들어갑니다`,
    )) return
    for (const [sid, s] of Object.entries(debateSessions)) {
      if (s?.isActive) await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false })
    }
    const id = await pushUnder(roomCode, 'debateSessions', {
      title: bill.title,
      topic: `'${bill.title}'은(는) 제정되어야 하는가?`,
      phase: '3',
      chairId: '',
      chairName: '',
      activeTools: ['stancePollPre'],
      currentDebateStage: 0,
      isActive: true,
      relatedBillId: bill.id,
    })
    await setAt(roomCode, `debateSessions/${id}/stancePoll/pre`, {
      question: `'${bill.title}' 법안에 찬성하나요?`,
      options: DEFAULT_STANCE_OPTIONS,
      isOpen: true,
      allowChange: false,
      type: 'pre',
    })
    onOpenDebateTool?.()
  }

  const untableBack = async (bill) => {
    const discussStepIndex = wf.steps.findIndex((step) => step.id === 'legislative-discuss')
    if (!confirm('정식 상정을 취소하고 온라인 법안 토의 단계로 되돌릴까요?\n진행 중이던 표결 데이터와 전광판 상태는 초기화됩니다.')) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: 'discussion',
      tabledAt: null,
      finalVotes: null,
      voteResult: null,
      finalizedAt: null,
    })
    await setAt(roomCode, 'billBoard', { active: false, billId: null })
    await updateAt(roomCode, 'workflow/phase3', {
      stepIndex: discussStepIndex >= 0 ? discussStepIndex : 2,
    })
  }

  // 부결 후 다음 후보 심사 — 토의 단계로 되돌리기
  const goReviewNext = async () => {
    const discussStepIndex = wf.steps.findIndex((step) => step.id === 'legislative-discuss')
    if (discussStepIndex >= 0) {
      await updateAt(roomCode, 'workflow/phase3', { stepIndex: discussStepIndex })
    }
  }

  const stages = [
    { idx: 0, label: '준비' },
    { idx: 1, label: '발의' },
    { idx: 2, label: '토의·평가' },
    { idx: 3, label: '상정토론' },
    { idx: 4, label: '표결' },
    { idx: 5, label: '발표' },
  ]

  return (
    <section className="bg-white rounded-2xl shadow border-2 border-indigo-300 p-4 space-y-3">
      <header className="flex items-baseline justify-between flex-wrap gap-1">
        <h2 className="font-bold text-indigo-800">🏛️ Phase 3 입법부 — 빠른 제어</h2>
        <span className="text-[11px] text-gray-500">
          토의 {discussionBills.length} · 상정 {tabledBills.length} · 종료 {closedBills.length}
        </span>
      </header>

      {/* === 패턴 C — 가로 progress bar (dot + label) === */}
      <div className="px-1 pt-1">
        <div className="flex items-start">
          {stages.map((s, i) => {
            const done = stage > s.idx
            const current = stage === s.idx
            return (
              <Fragment key={s.idx}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                    done ? 'bg-emerald-500 text-white shadow' :
                    current ? 'bg-indigo-600 text-white ring-4 ring-indigo-200 scale-110' :
                    'bg-gray-300 text-white'
                  }`}>
                    {done ? '✓' : current ? '▶' : i + 1}
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${
                    done ? 'text-emerald-700' :
                    current ? 'text-indigo-800' :
                    'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-3.5 ${
                    done ? 'bg-emerald-400' : 'bg-gray-200'
                  }`} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* === 현재 단계 안내 + 이전·다음 단계 (라벨 명시) === */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex-1">
          <p className="text-xs font-bold text-indigo-800">{stageLabel}</p>
          <p className="text-sm text-indigo-900 mt-0.5">👩‍🏫 {nextHint}</p>
        </div>
        <div className="flex md:flex-col gap-2 shrink-0 md:w-44">
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: Math.max(0, stepIndex - 1) }))}
            disabled={!prevStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border-2 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 disabled:opacity-40 text-left leading-tight"
            title={prevShort || ''}
          >
            ← 이전 단계
            {prevShort && <div className="text-[10px] font-normal text-indigo-500 truncate">({prevShort})</div>}
          </button>
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: stepIndex + 1 }))}
            disabled={!nextStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-40 text-left leading-tight"
            title={nextShort || ''}
          >
            다음 단계 →
            {nextShort && <div className="text-[10px] font-normal text-indigo-100 truncate">({nextShort})</div>}
          </button>
        </div>
      </div>

      {/* === 역할 잠금 및 초기화 버튼 (① 준비 단계, 역할중심 모드) === */}
      {!isCollaborative && stage === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-700">학생 역할 설정 관리</p>
            <p className="text-[11px] text-gray-500">
              {isRolesLocked
                ? '현재 잠금 상태 — 학생들이 역할을 변경할 수 없습니다.'
                : '역할을 잠가 학생들이 역할을 변경하지 못하도록 제한할 수 있습니다.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAllRoles}
              className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 transition"
            >
              🔄 역할 전체 초기화
            </button>
            <button
              onClick={toggleRoleLock}
              className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                isRolesLocked
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isRolesLocked ? '🔓 잠금 해제' : '🔒 역할 잠금'}
            </button>
          </div>
        </div>
      )}

      {/* === 직전 부결 → 다음 후보 안내 배너 === */}
      {justRejected && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-2.5 flex items-start gap-2">
          <span className="text-lg leading-none">❌</span>
          <div className="flex-1">
            <p className="text-xs font-extrabold text-rose-800">
              직전 표결 부결 — '{lastClosed.title}'
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              ⬇️ 아래 토의 중 법안에서 다음 후보를 정식 상정하세요.
              {nextStep?.id !== 'legislative-discuss' && (
                <button onClick={goReviewNext} className="ml-2 underline font-bold hover:text-rose-900">
                  ② 토의 단계로 돌아가기
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      {/* === 정식 상정 법안 — 현재 핵심 액션 영역 === */}
      {tabledBills.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-indigo-700">🏛️ 정식 상정 법안 ({tabledBills.length}건)</p>
          {tabledBills.map((b) => {
            const proposer = b.proposerGroupId ? groups[b.proposerGroupId] : null
            const boardActive = billBoard?.active && billBoard?.billId === b.id
            return (
              <div key={b.id} className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm flex-1 truncate">{b.title}</span>
                  <span className="text-[10px] text-gray-500">{proposer?.name}</span>
                </div>
                {b._tally.total > 0 && (
                  <div className="text-[11px] tabular-nums">
                    <span className="text-emerald-700">찬 {b._tally.pro}</span>
                    {' · '}
                    <span className="text-rose-700">반 {b._tally.con}</span>
                    {' · '}
                    <span className="text-gray-600">기권 {b._tally.abstain}</span>
                    {' · '}총 {b._tally.total}
                  </div>
                )}
                <BillReviewDetails bill={b} />
                {/* 패턴 C — 3열 액션 그리드 */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => startDebateOnBill(b)}
                    className="py-2 text-xs rounded font-bold bg-purple-600 text-white hover:bg-purple-700 flex flex-col items-center gap-0.5 leading-tight"
                    title="이 법안 내용으로 토론 도구 자동 활성화"
                  >
                    <span className="text-base">🎙️</span>
                    <span>토론 시작</span>
                  </button>
                  <button
                    onClick={() => toggleBoard(b)}
                    className={`py-2 text-xs rounded font-bold flex flex-col items-center gap-0.5 leading-tight ${
                      boardActive
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
                    }`}
                  >
                    <span className="text-base">🎬</span>
                    <span>{boardActive ? '전광판 끄기' : '전광판 띄우기'}</span>
                  </button>
                  {b.voteResult ? (
                    /* 발표 완료 → 마감(전광판 끄기) */
                    <button
                      onClick={closeBoard}
                      className="py-2 text-xs rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex flex-col items-center gap-0.5 leading-tight ring-2 ring-emerald-300 animate-pulse"
                    >
                      <span className="text-base">✓</span>
                      <span>표결 마감</span>
                      <span className="text-[9px] opacity-90">(전광판 끄기)</span>
                    </button>
                  ) : (
                    /* 발표 전 → 결과 발표 */
                    <button
                      onClick={() => announceResult(b)}
                      disabled={b._tally.total === 0}
                      className="py-2 text-xs rounded bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700 flex flex-col items-center gap-0.5 leading-tight"
                    >
                      <span className="text-base">🗳️</span>
                      <span>표결 발표</span>
                      <span className="text-[9px] opacity-90">(결과 전광판에)</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => untableBack(b)}
                  className="w-full px-2 py-1 text-[10px] rounded bg-white border border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-100"
                  title="온라인 법안 토의 단계로 되돌리기"
                >
                  ↩ 상정 취소 (③ 토의 및 평가 단계로 되돌리기)
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* === 토의 법안 — 등수 배지 + 상정 버튼 (모든 법안 표시) === */}
      {discussionBills.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-700">
            💬 토의 중 법안 ({discussionBills.length}건) — 순위로 표시
          </p>
          {discussionBills.map((b, i) => {
            const proposer = b.proposerGroupId ? groups[b.proposerGroupId] : null
            const rankLabel = `${i + 1}등`
            const isTopRank = i === 0
            return (
              <div key={b.id} className={`rounded-lg p-2.5 space-y-1.5 border ${
                isTopRank
                  ? 'bg-amber-50 border-2 border-amber-400'
                  : 'bg-white border-amber-200'
              }`}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <RankBadge rank={i} />
                  <span className="font-bold text-sm flex-1 truncate">{b.title}</span>
                  <span className="text-[10px] text-gray-500">{proposer?.name}</span>
                </div>
                {(b.teacherRecommended || b.tablingRequested) && (
                  <div className="flex gap-1 flex-wrap">
                    {b.teacherRecommended && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold border border-sky-200">
                        교사 추천
                      </span>
                    )}
                    {b.tablingRequested && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                        학생 상정 요청
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                  {b._score ? (
                    <>
                      <span className="text-amber-700 font-mono">★ {b._score.overall.toFixed(2)}</span>
                      <span className="text-gray-400">· {b._score.n}명 평가</span>
                    </>
                  ) : (
                    <span className="text-gray-400">아직 평가 없음</span>
                  )}
                  <span className="text-amber-600">· 추천 {b._prefCount}</span>
                  <span className="text-slate-500">· 댓글평가 {b._comments.length}</span>
                </div>
                <BillReviewDetails bill={b} />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleTeacherRecommendation(b)}
                    className={`flex-1 py-1.5 text-[11px] rounded font-bold border transition ${
                      b.teacherRecommended
                        ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-white'
                        : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                    }`}
                  >
                    {b.teacherRecommended ? '교사 추천 취소' : '교사 추천'}
                  </button>
                  <button
                    onClick={() => tableThisBill(b, rankLabel)}
                    className={`flex-[2] py-1.5 text-xs rounded font-bold transition ${
                      isTopRank
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 hover:bg-indigo-700'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                  >
                    ✓ {rankLabel} 법안 정식 상정 {isTopRank && '(추천)'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* === 의결 종료 법안 — 결과 카드로 표시 === */}
      {closedBills.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-600">📂 발표 단계 의결 종료 법안 ({closedBills.length}건)</p>
          {closedBills.map((b) => {
            const passed = b.status === 'passed'
            const proposer = b.proposerGroupId ? groups[b.proposerGroupId] : null
            const t = b.voteResult || b._tally || {}
            return (
              <div
                key={b.id}
                className={`rounded-lg p-2 text-[11px] border flex items-center gap-2 ${
                  passed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold border ${
                  passed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {passed ? '✅ 가결' : '❌ 부결'}
                </span>
                <span className="font-bold flex-1 truncate text-slate-800">{b.title}</span>
                {proposer?.name && <span className="text-gray-500">{proposer.name}</span>}
                {t.total > 0 && (
                  <span className="text-gray-600 tabular-nums">
                    {t.pro}/{t.con}/{t.abstain}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bills.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed">
          아직 발의된 법안이 없어요.
        </p>
      )}
    </section>
  )
}

export default Phase3LegislativeQuickPanel
