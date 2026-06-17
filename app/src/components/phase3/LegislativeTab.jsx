import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, subscribe, updateAt } from '../../lib/rtdb-helpers'
import BillCard from './BillCard'
import LegislativeProgressGuide from './LegislativeProgressGuide'
import AlliancePanel from './AlliancePanel'
import { useWorkflow } from '../../lib/use-workflow'
import RoleWorkspace from '../scaffolding/RoleWorkspace'
import RoleAssigner from '../scaffolding/RoleAssigner'
import GroupRoleSummary from '../scaffolding/GroupRoleSummary'
import OtherGroupsRoleSummary from '../scaffolding/OtherGroupsRoleSummary'
import BranchUnitBanner from './BranchUnitBanner'
import BranchUnitWorkspace from './BranchUnitWorkspace'
import BillTemplate from '../scaffolding/BillTemplate'
import { isDiscussionBill } from '../../lib/bill-status'
import ResearchWorkspace from '../research/ResearchWorkspace'

const SESSION_ID = 'legislative-default' // Phase3Page 와 동일 키

function buildBillBodyFromTemplateData(data = {}) {
  // 총괄 검토원이 최종 편집한 본문이 있으면 우선 사용
  if (data.mergedBody?.trim()) return data.mergedBody.trim()

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

/** 댓글에서 특정 bill 의 다축 평가 평균 계산 */
function computeBillScore(commentsMap, billId) {
  let sumLogic = 0, sumFeas = 0, sumRel = 0, n = 0
  for (const c of Object.values(commentsMap || {})) {
    if (c?.targetType !== 'bill' || c?.targetId !== billId) continue
    const r = c.ratings
    if (!r) continue
    sumLogic += Number(r.logic) || 0
    sumFeas  += Number(r.feasibility) || 0
    sumRel   += Number(r.relevance) || 0
    n += 1
  }
  if (n === 0) return null
  return {
    n,
    logic: sumLogic / n,
    feasibility: sumFeas / n,
    relevance: sumRel / n,
    overall: (sumLogic + sumFeas + sumRel) / (n * 3), // 1~3 평균
  }
}

/**
 * @param {{previewMode?: boolean}} props
 *   previewMode: true 면 학생 전용 영역(역할 작업 공간 / 모둠 활동 / 야당연합 등) 숨기고
 *   법안 데이터 영역만 노출. 모든 입력·액션 비활성. 교사 대시보드 미리보기용.
 */
function LegislativeTab({ previewMode = false }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const legUnits = branchConfig?.legislative?.units || []
  const wf = useWorkflow()
  const stepId = wf.currentStep?.id
  // 입법 6단계 step → 단계 인덱스(0~5) 매핑. 모르는 step 은 폴백(showAll) 처리.
  // article1·poll2 도 발표 후 단계 — 의결 종료 법안 섹션을 active 로, 나머지는 past 로 블러.
  const STAGE_OF_STEP = {
    core: 0,
    'legislative-prep': 0,
    'legislative-draft': 1,
    'legislative-discuss': 2,
    'legislative-tabling': 3,
    'legislative-vote': 4,
    'legislative-announce': 5,
    'legislative-result': 5,
    article1: 5,
    poll2: 5,
  }
  const knownStage = STAGE_OF_STEP[stepId]
  const isKnown = knownStage !== undefined
  // 미리보기(교사 대시보드 미니뷰) 또는 모르는 step 은 모든 섹션 active 로 노출
  const showAll = previewMode || !isKnown
  // 섹션 상태: 'active'(현재 단계) / 'past'(지나간 단계 — 블러) / 'hidden'(아직 도달 안 함)
  const modeFor = (stages) => {
    if (showAll) return 'active'
    if (stages.includes(knownStage)) return 'active'
    if (stages.every((s) => s < knownStage)) return 'past'
    return 'hidden'
  }
  const prepMode = modeFor([0])
  const draftMode = modeFor([1])
  const discussMode = modeFor([2])
  // 상정토론(3), 표결(4), 발표(5) 모두 정식 상정 카드 영역에서 진행
  const tabledMode = modeFor([3, 4, 5])
  const closedMode = modeFor([5])

  // 단계 전환 시 자동 스크롤 — 활성 섹션을 화면 상단으로
  const prepRef = useRef(null)
  const draftRef = useRef(null)
  const discussRef = useRef(null)
  const tabledRef = useRef(null)
  const closedRef = useRef(null)
  useEffect(() => {
    if (previewMode || !isKnown) return
    let target = null
    if (knownStage === 0) target = prepRef.current
    else if (knownStage === 1) target = draftRef.current
    else if (knownStage === 2) target = discussRef.current
    else if (knownStage === 3 || knownStage === 4) target = tabledRef.current
    else if (knownStage === 5) target = closedRef.current
    if (!target) return
    // DOM 렌더 직후 스크롤 — 약간의 딜레이로 안정성 확보
    const t = setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(t)
  }, [stepId, previewMode, isKnown, knownStage])

  // 'past' 섹션 시각 처리 — 블러 + 흐림 + 상호작용 차단
  const pastClass =
    'opacity-50 pointer-events-none select-none [filter:blur(1.8px)_grayscale(40%)]'
  const sectionWrap = (mode) =>
    `transition-all duration-300 ${mode === 'past' ? pastClass : ''}`

  const [billsMap, setBillsMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [prefsByBill, setPrefsByBill] = useState({}) // { billId: prefMap }

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'bills', (d) => setBillsMap(d || {}))
    const u2 = subscribe(roomCode, 'comments', (d) => setCommentsMap(d || {}))
    return () => {
      u1?.()
      u2?.()
    }
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const bills = Object.entries(billsMap)
    .map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  // 토의 단계 법안 — 점수 + 추천 카운트로 정렬
  const discussionBillsRanked = useMemo(() => {
    const list = bills.filter(isDiscussionBill)
    const enriched = list.map((b) => {
      const score = computeBillScore(commentsMap, b.id)
      const prefMap = b.preferences || {}
      const prefCount = Object.values(prefMap).filter((v) => v?.liked).length
      return { ...b, _score: score, _prefCount: prefCount }
    })
    // 정렬: 교사 추천/학생 상정 요청 → 평점 종합 → 추천 수 → 발의 시각
    enriched.sort((a, b) => {
      if (!!b.teacherRecommended !== !!a.teacherRecommended) return b.teacherRecommended ? 1 : -1
      if (!!b.tablingRequested !== !!a.tablingRequested) return b.tablingRequested ? 1 : -1
      const sa = a._score?.overall || 0
      const sb = b._score?.overall || 0
      if (Math.abs(sa - sb) > 0.001) return sb - sa
      if (b._prefCount !== a._prefCount) return b._prefCount - a._prefCount
      return (a.createdAt || 0) - (b.createdAt || 0)
    })
    return enriched
  }, [bills, commentsMap])

  const billBoard = useGameStore((s) => s.roomData?.billBoard)
  // 발표 후(voteResult 있고 전광판 켜진 상태)도 tabled 영역에 유지
  const tabledBillsLive = bills.filter((b) =>
    b.status === 'tabled' ||
    (b.voteResult && billBoard?.billId === b.id && billBoard?.active)
  )
  const isVotingActive =
    !!billBoard?.active && tabledBillsLive.some((b) => b.id === billBoard?.billId)

  return (
    <div className="space-y-4">
      {/* 부서 배치 현황 배너 (branchConfig 설정 시에만 표시) */}
      <BranchUnitBanner branch="legislative" />

      {/* === ① 준비 단계 — 자료 수집과 쟁점 확인 === */}
      {!previewMode && prepMode !== 'hidden' && (
        <div ref={prepRef} className={`space-y-4 ${sectionWrap(prepMode)}`}>
          {role === 'student' && myGroupId ? (
            <ResearchWorkspace
              contextKey="phase3_legislative"
              groupId={myGroupId}
              title="법안 근거 자료실"
              description="법안을 만들기 전에 필요한 자료 목록을 정하고, 입법 배경·근거가 될 기사 자료를 수집하세요."
              defaultTargets={['피해 규모 통계', '전문가의 원인 분석', '다른 나라의 법률 사례', '사회적 문제 뉴스']}
              accent="indigo"
            />
          ) : (
            <section className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-sm text-indigo-900">
              <h2 className="text-lg font-bold mb-2">
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full mr-2">①</span>
                입법 준비
              </h2>
              <p>법안 발의 전에 필요한 자료와 쟁점을 확인하는 단계입니다.</p>
            </section>
          )}
        </div>
      )}

      {/* === ② 발의 단계 — branchUnits + 단일 발의 UI 한 묶음으로 ref/블러 처리 === */}
      {!previewMode && draftMode !== 'hidden' && (
      <div ref={draftRef} className={`space-y-4 ${sectionWrap(draftMode)}`}>
      {/* === 부서 단위 작업 공간 — branchConfig 설정 시에만 표시 ===
          legUnits 가 있을 때: 각 유닛의 메모→섹션→확정 워크플로
          legUnits 가 비어 있을 때: 아래 기존 단일 발의 UI 그대로 사용 */}
      {legUnits.length > 0 && legUnits.map((unit) => (
        <div key={unit.unitId} className="border-2 border-indigo-200 rounded-2xl overflow-hidden">
          <div className="bg-indigo-100 px-4 py-2 flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-800">
              🏛️ {groups?.[unit.groupId]?.name || unit.groupId}
              {unit.title && <span className="ml-2 text-indigo-600 font-normal">— {unit.title}</span>}
            </span>
          </div>
          <div className="p-4">
            <BranchUnitWorkspace
              unitId={unit.unitId}
              branch="legislative"
              isCollaborative={branchConfig?.legislative?.mode === 'collaborative'}
              onPublish={async (content) => {
                if (!roomCode) return
                const body = buildBillBodyFromTemplateData(content)
                // 같은 유닛(branchUnitId)으로 이미 발의된 법안이 있으면 새로 만들지 않고 업데이트
                // (제출 후 [다시 수정하기]로 고쳐 재발의할 때 중복 법안 방지)
                const existing = Object.entries(billsMap || {}).find(
                  ([, b]) => b?.branchUnitId === unit.unitId,
                )
                if (existing) {
                  const [billId] = existing
                  await updateAt(roomCode, `bills/${billId}`, {
                    title: unit.title || `${groups?.[unit.groupId]?.name || ''} 법안`,
                    body,
                    templateData: content,
                    updatedAt: Date.now(),
                  })
                } else {
                  await pushUnder(roomCode, 'bills', {
                    title: unit.title || `${groups?.[unit.groupId]?.name || ''} 법안`,
                    body,
                    proposerGroupId: unit.groupId,
                    authorStudentId: unit.representativeStudentId,
                    status: 'discussion',
                    templateData: content,
                    branchUnitId: unit.unitId,
                    createdAt: Date.now(),
                  })
                }
              }}
            >
              <BillTemplate groupId={unit.groupId} />
            </BranchUnitWorkspace>
          </div>
        </div>
      ))}

      {/* === 단일 발의 UI (legUnits 가 비어 있을 때만) === */}
      {legUnits.length === 0 && (() => {
        const isCollaborative = (branchConfig?.legislative?.mode || 'role_based') === 'collaborative'
        const myGroup = myGroupId ? groups[myGroupId] : null
        const myRoleKey = myGroup?.sessionRoles?.[SESSION_ID]?.[myStudentId]
        const memberCount = myGroup?.members ? Object.keys(myGroup.members).length : 0

        return (
          <section className="bg-emerald-50/30 border-2 border-emerald-300 rounded-2xl p-4">
            {/* 학생인데 모둠이 없을 때 — 명확히 안내 */}
            {role === 'student' && !myGroupId && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-sm text-rose-900 mb-4">
                ⚠️ 아직 시민단체 모둠에 가입돼 있지 않아 작업 공간이 보이지 않아요. 선생님께 모둠 배정을 요청하세요.
              </div>
            )}

            {/* 교사 화면 안내 */}
            {role === 'teacher' && (
              <div className="bg-white/60 border border-emerald-200 rounded-lg p-3 mb-4 text-xs text-emerald-800 space-y-1">
                <p className="font-bold text-sm">
                  👩‍🏫 {isCollaborative ? '입법부 운영 — 공동 작업 모드' : '입법부 운영 — 역할 중심 모드'}
                </p>
                <p>
                  {isCollaborative 
                    ? '🤝 현재 공동 작업 모드입니다. 학생들은 역할 배정 없이도 모둠원 누구나 법안을 수정할 수 있으며, 템플릿이 전체 화면으로 확장됩니다.' 
                    : '🎭 현재 역할 중심 모드입니다. 법안 작성자✍️ 역할을 맡은 학생만 법안 템플릿을 수정할 수 있습니다.'}
                </p>
              </div>
            )}

            {/* 학생 + 모둠 OK — 역할 배정 + 작업 공간 */}
            {role === 'student' && myGroupId && (
              <div className="space-y-4">
                {/* 타이틀 및 모드 안내 */}
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-emerald-900 flex items-baseline gap-2">
                    <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">②</span>
                    {isCollaborative ? '법안 발의 — 공동 작업 공간' : '법안 발의 — 내 역할 작업 공간'}
                  </h2>
                  {isCollaborative && (
                    <span className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold animate-pulse">
                      🤝 공동 편집 활성화됨
                    </span>
                  )}
                </div>

                {!isCollaborative ? (
                  /* [일반 모드] 기존 2단 레이아웃 */
                  <>
                    <details
                      open={!myRoleKey}
                      className={`rounded-xl mb-3 ${
                        myRoleKey
                          ? 'bg-white border-2 border-emerald-200'
                          : 'bg-amber-50 border-2 border-amber-400'
                      }`}
                    >
                      <summary className="cursor-pointer p-3 font-bold flex items-center gap-2 select-none">
                        {myRoleKey ? (
                          <span className="text-emerald-900">🎭 모둠 4역할 배정 — 변경하려면 펼치기</span>
                        ) : (
                          <span className="text-amber-900">🎭 먼저 입법부 4역할을 배정해야 임무 입력창 나타나요 (펼치기)</span>
                        )}
                      </summary>
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-sm text-gray-700">
                          모둠원 {memberCount}명에게 <b>법안 작성자 ✍️ / 자료 조사원 🔎 / 본회의 발언자 🎤 / 회의록 기록자 📝</b> 를 1:1로 정해 주세요.
                        </p>
                        <div className="bg-white border border-gray-200 rounded-xl p-2">
                          <RoleAssigner groupId={myGroupId} sessionId={SESSION_ID} kind="legislative" />
                        </div>
                      </div>
                    </details>
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <RoleWorkspace groupId={myGroupId} sessionId={SESSION_ID} kind="legislative" />
                      </div>
                      <div className="space-y-3">
                        <GroupRoleSummary groupId={myGroupId} sessionId={SESSION_ID} kind="legislative" />
                        <OtherGroupsRoleSummary myGroupId={myGroupId} sessionId={SESSION_ID} kind="legislative" />
                      </div>
                    </div>
                  </>
                ) : (
                  /* [공동 작업 모드] 법안 템플릿 중심의 넓은 레이아웃 */
                  <div className="space-y-6">
                    <div className="max-w-4xl mx-auto w-full">
                      <BillTemplate groupId={myGroupId} />
                    </div>
                    
                    {/* 다른 모둠 상황 */}
                    <div className="pt-4 border-t border-emerald-100">
                      <OtherGroupsRoleSummary myGroupId={myGroupId} sessionId={SESSION_ID} kind="legislative" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })()}
      </div>
      )}

      {/* 야당 연합 패널 (당분간 보류로 인한 숨김 처리) */}
      {/* {!previewMode && <AlliancePanel />} */}

      {/* === ③ 토의 및 평가 — legislative-discuss 단계에만 노출 === */}
      {discussMode !== 'hidden' && (() => {
        return (
          <section ref={discussRef} className={sectionWrap(discussMode)}>
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
              <h2 className="text-lg font-bold text-amber-900 flex items-baseline gap-2">
                <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">③</span>
                토의 및 평가
              </h2>
              <span className="text-xs text-gray-500">{discussionBillsRanked.length}건</span>
            </div>
            {/* 점수 산정 안내 — 학생도 교사도 보임 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">📊 어떻게 정식 상정될 법안을 고르나요?</p>
              <p>
                각 법안에 댓글로 <b>🏛️ 공익성 / 🛠️ 실행가능성 / ⚖️ 법적 타당성</b> 3축 별점(1~3점)을 줍니다.
                <b className="text-amber-800"> 종합 평균 점수가 높은 법안이 상위권</b>에 오르고,
                선생님이 그 중에서 한 법안을 정식 상정합니다.
              </p>
              <p className="text-[11px] text-amber-700">
                동점이면 <b>👍 추천 수</b> 가 많은 법안이 우선. 본인 모둠 법안에는 평가·댓글·추천 모두 불가합니다.
              </p>
            </div>
            {discussionBillsRanked.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400">
                아직 발의된 법안이 없어요.
                {role === 'student' && myGroupId && ' 법안 작성자가 발의 템플릿으로 발의해 보세요.'}
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {discussionBillsRanked.map((b, i) => (
                  <BillCard
                    key={b.id}
                    bill={b}
                    commentsMap={commentsMap}
                    rank={i < 3 && b._score ? i + 1 : null}
                    previewMode={previewMode}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })()}

      {/* === ④ 상정 토론 / ⑤ 표결 / ⑥ 발표 — legislative-tabling/vote/announce 단계 === */}
      {tabledMode !== 'hidden' && (
      <div ref={tabledRef} className={sectionWrap(tabledMode)}>
      {(() => {
        // 발표 후에도 전광판 켜져 있으면 tabled 카드 영역에 유지
        const tabledBills = bills.filter((b) =>
          b.status === 'tabled' ||
          (b.voteResult && billBoard?.billId === b.id && billBoard?.active)
        )
        const isVoteStep = stepId === 'legislative-vote'
        const isAnnounceStep = stepId === 'legislative-announce'
        const stepNumber = isAnnounceStep ? '⑥' : isVoteStep ? '⑤' : '④'
        const stepTitle = isAnnounceStep ? '발표' : isVoteStep ? '표결' : '상정 토론'
        if (tabledBills.length === 0) {
          // 폴백 모드(showAll)면 빈 섹션은 숨김. 명시적 단계일 땐 안내 박스 노출.
          if (showAll) return null
          return (
            <section className="bg-gradient-to-br from-indigo-50 to-violet-50 border-4 border-indigo-400 rounded-2xl p-6 shadow-lg text-center">
              <h2 className="text-lg font-bold text-indigo-900 mb-2">
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full mr-2">{stepNumber}</span>
                {stepTitle}
              </h2>
              <p className="text-sm text-indigo-800">
                아직 정식 상정된 법안이 없어요.
                {role === 'teacher'
                  ? ' ③ 토의 및 평가 단계로 돌아가 [✓ 정식 상정] 버튼으로 한 법안을 올려 주세요.'
                  : ' 선생님이 한 법안을 정식 상정할 때까지 기다리세요.'}
              </p>
            </section>
          )
        }
        return (
          <section className="bg-gradient-to-br from-indigo-50 to-violet-50 border-4 border-indigo-400 rounded-2xl p-4 shadow-lg">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-indigo-900 flex items-baseline gap-2">
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">{stepNumber}</span>
                {stepTitle}{(isVoteStep || isAnnounceStep) && isVotingActive ? ' — 진행 중' : ''}
              </h2>
              <span className="text-xs text-indigo-700 font-bold animate-pulse">
                {isAnnounceStep ? '📢 결과 발표' : isVoteStep ? (isVotingActive ? '🎬 표결 중' : '🎬 전광판 대기') : '🎙️ 토론 단계'}
              </span>
            </div>
            <div className="grid lg:grid-cols-1 gap-4">
              {tabledBills.map((b) => (
                <BillCard key={b.id} bill={b} commentsMap={commentsMap} previewMode={previewMode} />
              ))}
            </div>
          </section>
        )
      })()}
      </div>
      )}

      {/* === ⑥ 발표 — 의결 종료 법안까지 함께 노출 === */}
      {closedMode !== 'hidden' && (
      <div ref={closedRef} className={sectionWrap(closedMode)}>
      {(() => {
        const closedBills = bills.filter((b) => b.status === 'passed' || b.status === 'rejected')
        if (closedBills.length === 0) {
          if (showAll) return null
          return (
            <section className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-6 text-center">
              <h2 className="text-lg font-bold text-gray-700 mb-2">
                <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full mr-2">⑥</span>
                발표 및 의결 종료 법안
              </h2>
              <p className="text-sm text-gray-600">
                아직 의결이 종료된 법안이 없어요. 표결 마감 후 결과가 여기에 표시됩니다.
              </p>
            </section>
          )
        }
        // 발표/기사/여론조사 단계일 땐 펼친 상태로 노출 (폴백 시엔 접이식)
        if (stepId === 'legislative-announce' || stepId === 'legislative-result' || stepId === 'article1' || stepId === 'poll2') {
          return (
            <section className="bg-white border-2 border-gray-300 rounded-2xl p-4">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-baseline gap-2">
                <span className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">⑥</span>
                의결 종료 법안 ({closedBills.length}건)
              </h2>
              <div className="grid lg:grid-cols-2 gap-3">
                {closedBills.map((b) => (
                  <BillCard key={b.id} bill={b} commentsMap={commentsMap} previewMode={previewMode} />
                ))}
              </div>
            </section>
          )
        }
        return (
          <details className="bg-gray-50 rounded-2xl border p-4 group">
            <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900">
              <span>⑥ 📂 의결 종료 법안 ({closedBills.length}건)</span>
              <span className="ml-auto text-xs text-gray-400">펼치기</span>
            </summary>
            <div className="mt-3 grid lg:grid-cols-2 gap-3">
              {closedBills.map((b) => (
                <BillCard key={b.id} bill={b} commentsMap={commentsMap} previewMode={previewMode} />
              ))}
            </div>
          </details>
        )
      })()}
      </div>
      )}
    </div>
  )
}

export default LegislativeTab
