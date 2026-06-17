import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import useDebateStore, { DEBATE_SIDE_LABELS } from '../../store/debateStore'
import { useWorkflow } from '../../lib/use-workflow'
import { updateAt, subscribe, pushUnder, getOnce, setAt } from '../../lib/rtdb-helpers'
import StancePoll from './tools/StancePoll'
import DebatePrepCard from './tools/DebatePrepCard'
import DebateTimer, { computeRemaining, getRoundInfo } from './tools/DebateTimer'
import CabinetScriptBox from './CabinetScriptBox'
import SpeechEval, { aggregateEval, MiniRadar, EVAL_AXES } from './tools/SpeechEval'
import DebateScriptEditor from './tools/DebateScriptEditor'
import DebateScriptPrompter from './tools/DebateScriptPrompter'
import ArticleSection from '../news/ArticleSection'
import JudicialCaseRoomButton from '../phase3/JudicialCaseRoomButton'
import JudicialActivityMemo from '../phase3/JudicialActivityMemo'
import PlaceholderField, { isFieldComplete } from '../scaffolding/PlaceholderField'

/** 국무회의: 다른 모둠 시행령·예산을 새 창(전광판)으로 검토 — 타이머의 [대본 보기] 옆 버튼에서 호출 */
function openExecPolicyBoard(roomCode) {
  if (!roomCode) return
  const url = `${window.location.origin}${window.location.pathname}#/tv-executive-board?room=${encodeURIComponent(roomCode)}`
  window.open(
    url,
    'execpolicyreview_' + roomCode,
    'width=1280,height=900,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no',
  )
}

/** 같은 debateStage의 여러 eval 항목을 대상별로 병합해 평균 반환 */
function mergeStageTargets(items) {
  if (!items?.length) return []
  const targets = items.reduce(
    (best, item) => ((item.targets || []).length > best.length ? item.targets : best), []
  )
  if (!targets.length) {
    // 단일 대상 (scores)
    const label = items[0]?.targetLabel || '평가 대상'
    let sums = [0, 0, 0], n = 0
    for (const item of items)
      for (const r of Object.values(item.results || {}))
        if (Array.isArray(r.scores)) { for (let i = 0; i < 3; i++) sums[i] += Number(r.scores[i]) || 0; n++ }
    return [{ id: 'single', label, n, avgs: n > 0 ? sums.map((s) => +(s / n).toFixed(1)) : [0, 0, 0] }]
  }
  const acc = {}
  for (const t of targets) acc[t.id] = { label: t.label, sums: [0, 0, 0], n: 0 }
  for (const item of items)
    for (const r of Object.values(item.results || {}))
      if (r.perTarget)
        for (const t of targets) {
          const d = r.perTarget[t.id]
          if (d && Array.isArray(d.scores)) { for (let i = 0; i < 3; i++) acc[t.id].sums[i] += Number(d.scores[i]) || 0; acc[t.id].n++ }
        }
  return targets.map((t) => {
    const d = acc[t.id]
    return { id: t.id, label: d.label, n: d.n, avgs: d.n > 0 ? d.sums.map((s) => +(s / d.n).toFixed(1)) : [0, 0, 0] }
  })
}

/**
 * 학생 화면 토론 도구 패널.
 *
 * 동작 패턴 — GlobalPollPopup 동일 방식으로 변경:
 *  - 세션이 활성화되고 도구가 1개 이상 켜진 순간 → 화면 중앙에 모달이 자동으로 뜸
 *  - 학생이 '닫기' 누르면 dismiss → 좌하단 플로팅 버튼으로 축소 (재열기 가능)
 *  - 세션이 새로 바뀌거나 새 도구가 활성화되면 dismiss 해제 → 다시 모달로 부각
 *
 * 교사 화면에서는 표시하지 않음 (TeacherDebateControl 모달이 별도).
 */
const TYPE_LABELS = {
  general: '찬반 토론', trial: '모의재판', multi_party: '다자간 토론', consultative: '협의 토론',
}

/* ── 토론 결과 참고 패널 ── */
function DebateRefPanel() {
  const roomCode = useGameStore((s) => s.roomCode)
  const [open, setOpen] = useState(false)
  const [sessionsMap, setSessionsMap] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!open || !roomCode) return
    const unsub = subscribe(roomCode, 'debateSessions', (d) => setSessionsMap(d || {}))
    return unsub
  }, [open, roomCode])

  const closedSessions = useMemo(() =>
    Object.entries(sessionsMap)
      .filter(([, s]) => s.isActive === false)
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0)),
  [sessionsMap])

  return (
    <div className="border border-violet-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 hover:bg-violet-100 text-xs font-bold text-violet-800 transition"
      >
        <span>📋 토론 결과 참고하기</span>
        <span className="text-violet-400 text-[10px]">{open ? '▲ 닫기' : '▼ 열기'}</span>
      </button>
      {open && (
        <div className="bg-white p-2.5 space-y-2 max-h-96 overflow-y-auto">
          {closedSessions.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-3">종료된 토론이 없어요.</p>
          ) : closedSessions.map(([id, s]) => {
            const isExp = expandedId === id
            const baseLabels = DEBATE_SIDE_LABELS[s.type] || DEBATE_SIDE_LABELS.general
            const sideLabels = { ...baseLabels, ...(s.sideLabelOverrides || {}) }
            const proCount = Object.values(s.proStudents || {}).filter(Boolean).length
            const conCount = Object.values(s.conStudents || {}).filter(Boolean).length
            const extraSideEntries = Object.entries(s.extraSides || {})
            const evals = Object.values(s.speechEvals || {}).filter((e) => !e.isOpen)

            // 단계별 집계
            const stageGroups = Object.values(
              evals.reduce((acc, e) => {
                const k = e.debateStage ?? -1
                if (!acc[k]) acc[k] = { key: k, label: e.targetLabel || `${k + 1}단계`, n: 0, sums: [0, 0, 0] }
                for (const r of Object.values(e.results || {}))
                  if (Array.isArray(r.scores)) {
                    acc[k].n++
                    for (let i = 0; i < 3; i++) acc[k].sums[i] += Number(r.scores[i]) || 0
                  }
                return acc
              }, {})
            ).sort((a, b) => a.key - b.key)
              .map((g) => ({ ...g, avgs: g.n > 0 ? g.sums.map((s) => +(s / g.n).toFixed(1)) : null, label: g.label.replace(/\s*[—-]\s*발언:.*$/, '').trim() }))

            // 입장 여론조사 전후 비교
            const prePoll = s.stancePolls?.pre
            const postPoll = s.stancePolls?.post
            const pollOptions = prePoll?.options || postPoll?.options || []
            const countVotes = (poll) => {
              const counts = {}
              for (const v of Object.values(poll?.votes || {})) {
                const oid = typeof v === 'object' ? v.optionId : v
                counts[oid] = (counts[oid] || 0) + 1
              }
              return counts
            }
            const preCounts = countVotes(prePoll)
            const postCounts = countVotes(postPoll)

            return (
              <div key={id} className="border border-violet-100 rounded-lg overflow-hidden">
                {/* 세션 헤더 */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExp ? null : id)}
                  className="w-full flex items-start gap-2 p-2.5 hover:bg-violet-50/60 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                      {TYPE_LABELS[s.type] || '토론'}
                    </span>
                    <p className="text-xs font-bold text-gray-800 leading-snug mt-1">{s.topic || '주제 미지정'}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {sideLabels.pro} {proCount}명 vs {sideLabels.con} {conCount}명
                      {extraSideEntries.map(([sid, side]) => {
                        const cnt = Object.values(side.students || {}).filter(Boolean).length
                        return ` · ${side.name || sid} ${cnt}명`
                      })}
                    </p>
                  </div>
                  <span className="text-violet-400 text-[10px] shrink-0 mt-1">{isExp ? '▲' : '▼'}</span>
                </button>

                {isExp && (
                  <div className="border-t border-violet-100 px-2.5 pb-2.5 pt-2 space-y-2.5 bg-violet-50/20">

                    {/* 발언 평가 결과 */}
                    {stageGroups.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-violet-700">📊 발언 평가 결과</p>
                        {stageGroups.map((g) => (
                          <div key={g.key} className="flex items-center gap-2 py-0.5">
                            <span className="text-[10px] text-gray-600 flex-1 truncate">{g.label}</span>
                            {g.avgs ? (
                              <div className="flex items-center gap-1.5">
                                {EVAL_AXES.map((axis, i) => (
                                  <span key={axis} className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-gray-400">{axis.slice(0, 2)}</span>
                                    <span className="text-[11px] font-black text-violet-700 tabular-nums">{g.avgs[i]}</span>
                                  </span>
                                ))}
                                <span className="text-[9px] text-gray-400 ml-0.5">{g.n}명</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400">평가 없음</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400">제출된 발언 평가가 없어요.</p>
                    )}

                    {/* 입장 여론조사 전후 비교 */}
                    {pollOptions.length > 0 && (prePoll || postPoll) && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-violet-700">🗳️ 입장 여론조사 전후</p>
                        <div className="grid grid-cols-2 gap-1">
                          {[{ label: '토론 전', counts: preCounts, poll: prePoll }, { label: '토론 후', counts: postCounts, poll: postPoll }]
                            .filter((p) => p.poll)
                            .map(({ label, counts, poll }) => {
                              const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
                              return (
                                <div key={label} className="bg-white rounded-lg border border-violet-100 p-1.5 space-y-0.5">
                                  <p className="text-[9px] font-bold text-gray-500">{label}</p>
                                  {pollOptions.map((opt) => {
                                    const cnt = counts[opt.id] || 0
                                    const pct = Math.round(cnt / total * 100)
                                    return (
                                      <div key={opt.id} className="flex items-center gap-1">
                                        <span className="text-[9px] text-gray-600 w-14 truncate">{opt.label}</span>
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[9px] font-bold text-violet-700 tabular-nums w-6 text-right">{pct}%</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VerdictTrialDraftPanel({ session, groupId, groups, sections, myStudentId, myNickname }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const students = useGameStore((s) => s.students)
  const draft = groupId ? session?.verdictDrafts?.[groupId] || {} : {}
  const [values, setValues] = useState(draft.templateData || {})
  const [decision, setDecision] = useState(draft.decision || '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const saveTimerRef = useRef(null)

  const memberIds = useMemo(
    () => new Set(Object.keys(groups?.[groupId]?.members || {})),
    [groups, groupId],
  )

  // ② 모둠원 개인 종합평가 카드 — 토론 중 저장되면 같은 모둠원에게 모두 보임(토론카드 방식)
  const evalCards = useMemo(() => {
    const out = []
    Object.entries(session?.finalEvaluations || {}).forEach(([sid, d]) => {
      if (!memberIds.has(sid)) return
      const content = typeof d === 'string' ? d : (d?.content || d?.comment || '')
      if (!content.trim()) return
      const st = students?.[sid]
      out.push({
        sid,
        name: st ? `${st.number ? `${st.number}번 ` : ''}${st.nickname || ''}`.trim() : sid,
        content,
      })
    })
    return out
  }, [session?.finalEvaluations, memberIds, students])

  const allComplete = decision && sections.every((section) => isFieldComplete(values[section.id]))

  const persistDraft = (nextValues, nextDecision = decision) => {
    if (!roomCode || !session?.id || !groupId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateAt(roomCode, `debateSessions/${session.id}/verdictDrafts/${groupId}`, {
        templateData: nextValues,
        decision: nextDecision,
        groupId,
        lastAuthorStudentId: myStudentId || '',
        lastAuthorName: myNickname || '',
      }).catch(() => {})
    }, 700)
  }

  const updateValue = (sectionId, value) => {
    setValues((prev) => {
      const next = { ...prev, [sectionId]: value }
      persistDraft(next)
      return next
    })
  }

  const updateDecision = (nextDecision) => {
    setDecision(nextDecision)
    persistDraft(values, nextDecision)
  }

  const submitVerdict = async () => {
    if (!roomCode || !session?.relatedCaseId || !groupId || !allComplete || busy) return
    setBusy(true)
    try {
      const body = sections
        .map((section) => `◎ ${section.label}\n${values[section.id] || ''}`)
        .join('\n\n')
      await pushUnder(roomCode, `verdicts/${session.relatedCaseId}`, {
        decision,
        body,
        templateData: values,
        sentence: values.order || '',
        judgeGroupId: groupId,
        sourceDebateSessionId: session.id,
      })
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      alert('판결문 게시 실패: ' + (err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (!groupId) {
    return (
      <section className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-slate-500">모둠에 들어가면 판결문 공동 작성 칸이 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section className="bg-white border-2 border-rose-200 rounded-2xl p-4 space-y-4">
      <header>
        <h3 className="text-sm font-black text-rose-900">📜 우리 모둠 판결문 공동 작성</h3>
        <p className="text-[11px] text-rose-600 mt-0.5">
          모둠원 누구나 함께 작성할 수 있어요. 아래 <b>모둠원 종합평가</b>와 판결문 참고 메모를 보며 작성하고, 완성하면 게시하세요. (자동저장)
        </p>
      </header>

      {/* ② 모둠원 개인 종합평가 카드 */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2">
        <p className="text-xs font-black text-violet-800">🗳️ 우리 모둠원 종합평가 ({evalCards.length}명)</p>
        {evalCards.length === 0 ? (
          <p className="text-[11px] text-violet-500">아직 저장된 모둠원 종합평가가 없습니다. 각자 위에서 종합평가를 저장하면 카드로 모입니다.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {evalCards.map((c) => (
              <article key={c.sid} className="rounded-lg bg-white border border-violet-100 p-2">
                <p className="text-[10px] font-bold text-violet-700 mb-1">🧑‍⚖️ {c.name}</p>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['guilty', '유죄'],
          ['notGuilty', '무죄'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => updateDecision(value)}
            className={`rounded-xl border-2 px-3 py-2 text-sm font-black ${
              decision === value
                ? value === 'guilty'
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <PlaceholderField
            key={section.id}
            label={section.label}
            placeholder={section.placeholder}
            value={values[section.id] || ''}
            onChange={(value) => updateValue(section.id, value)}
            rows={section.rows}
            maxLength={section.maxLength}
          />
        ))}
      </div>

      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">✓ 판결문 게시 완료.</p>
      )}
      <button
        type="button"
        disabled={!allComplete || busy}
        onClick={submitVerdict}
        className="w-full py-3 rounded-xl bg-rose-700 text-white font-black disabled:opacity-40 hover:bg-rose-800"
      >
        {busy ? '게시 중...' : allComplete ? '판결문 게시' : '결론과 빈칸을 모두 채워 주세요'}
      </button>
    </section>
  )
}

/* ── 여론판 기사 참고 인라인 패널 ── */
function ArticleRefPanel() {
  const roomCode = useGameStore((s) => s.roomCode)
  const [open, setOpen] = useState(false)
  const [articlesMap, setArticlesMap] = useState({})
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open || !roomCode) return
    const unsub = subscribe(roomCode, 'articles', (d) => setArticlesMap(d || {}))
    return unsub
  }, [open, roomCode])

  const articles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.status === 'approved')
      .filter((a) => !q || (a.headline || '').toLowerCase().includes(q) || (a.body || '').toLowerCase().includes(q))
      .sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0))
  }, [articlesMap, query])

  return (
    <div className="border border-indigo-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-800 transition"
      >
        <span>🗞️ 여론판 기사 참고하기</span>
        <span className="text-indigo-400 text-[10px]">{open ? '▲ 닫기' : '▼ 열기'}</span>
      </button>
      {open && (
        <div className="bg-white p-2.5 space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·내용 검색..."
            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
            {articles.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-4">
                {query ? '검색 결과가 없어요.' : '아직 게시된 기사가 없어요.'}
              </p>
            ) : articles.map((a) => (
              <div key={a.id} className="border border-gray-100 rounded-lg p-2 space-y-0.5 bg-gray-50">
                <p className="text-[11px] font-bold text-gray-800 leading-tight">{a.headline}</p>
                <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{a.body}</p>
                <p className="text-[9px] text-gray-400">{a.authorNumber}번 {a.authorNickname}</p>
              </div>
            ))}
          </div>
          {articles.length > 0 && (
            <p className="text-[9px] text-gray-400 text-right">{articles.length}개 기사</p>
          )}
        </div>
      )}
    </div>
  )
}

/** 상정 법안 요약 배너 — 토론 전 카드 위에 표시 */
function buildBillText(bill) {
  const td = bill?.templateData || {}
  if (bill?.body) return bill.body
  const lines = []
  if (td.purpose) lines.push(`제1조 (목적) ${td.purpose}`)
  if (td.definition) lines.push(`제2조 (정의) ${td.definition}`)
  if (td.duty) lines.push(`제3조 (의무) ${td.duty}`)
  if (td.penalty) lines.push(`제4조 (벌칙) ${td.penalty}`)
  if (lines.length) return lines.join('\n\n')
  for (const [k, l] of [['background','입법 배경'],['clause','핵심 조항'],['effect','예상 효과'],['rebuttal','우려 대응']]) {
    if (td[k]) lines.push(`[${l}]\n${td[k]}`)
  }
  return lines.join('\n\n')
}

function BillBanner({ bill }) {
  const [open, setOpen] = useState(false)
  const td = bill?.templateData || {}
  const background = td.background || td.proposalReason || td.reason || ''
  const bodyText = buildBillText(bill)
  return (
    <div className="border border-indigo-200 rounded-xl overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <span className="text-sm">🏛️</span>
        <div className="flex-1 min-w-0">
          <p className="font-black text-indigo-800 truncate">상정 법안 · {bill.title}</p>
          <p className="text-indigo-400 text-[10px]">눌러서 법안 전문 보기</p>
        </div>
        <span className="shrink-0 text-indigo-400 font-bold">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-white px-3 py-3 space-y-2.5">
          {background && (
            <>
              <div className="bg-sky-50 rounded-lg px-3 py-2 text-[11px] text-sky-900 leading-relaxed">
                <span className="font-black text-sky-700 mr-1.5">📌 제안 이유</span>{background.trim()}
              </div>
              <hr className="border-slate-100" />
            </>
          )}
          <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">{bodyText}</p>
        </div>
      )}
    </div>
  )
}

function DebateToolPanel() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const verdictSections = useGameStore((s) => s.config?.templates?.verdict?.sections) || []
  const debateEnabled = useGameStore((s) => s.config?.debateToolEnabled !== false)
  // 선거 투표 상태 — vote 단계에서 투표 중/종료 시에만 억제 (다른 단계에서는 억제 안 함)
  const electionStatus = useGameStore((s) => s.electionStatus)
  const wf = useWorkflow()

  const session = useDebateStore((s) => s.currentSession)
  const sessionId = useDebateStore((s) => s.currentSessionId)
  const stancePolls = useDebateStore((s) => s.stancePolls)
  const prepCards = useDebateStore((s) => s.prepCards)
  const scripts = useDebateStore((s) => s.scripts)
  const speechEvals = useDebateStore((s) => s.speechEvals)
  const isChair = useDebateStore((s) => s.isChair)
  const attachListener = useDebateStore((s) => s.attachListener)
  const detach = useDebateStore((s) => s.detach)

  const [tab, setTab] = useState('pre')
  const [relatedBill, setRelatedBill] = useState(null) // 상정 법안 정보
  // dismiss 상태: '<sessionId>:<toolKey>' 단위로 학생이 닫은 흔적 보관
  const [dismissedKey, setDismissedKey] = useState(null)
  // 평가단 전용 — 선택된 평가 단계 (타이머 자동진행 무관)
  const [selectedEvalStage, setSelectedEvalStage] = useState(0)
const lastSessionIdRef = useRef(null)
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])

  // RTDB 구독
  useEffect(() => {
    if (roomCode) attachListener(roomCode, myStudentId)
    return () => detach()
  }, [roomCode, myStudentId, attachListener, detach])

  // 상정 법안 구독 — session.relatedBillId 기준
  useEffect(() => {
    const billId = session?.relatedBillId
    if (!roomCode || !billId) { setRelatedBill(null); return }
    const unsub = subscribe(roomCode, `bills/${billId}`, (d) =>
      setRelatedBill(d ? { id: billId, ...d } : null)
    )
    return unsub
  }, [roomCode, session?.relatedBillId])

  // 활성 도구 시그니처 — pre 폴 isOpen 변화나 prepCard 활성화도 감지
  const activeTools = Array.isArray(session?.activeTools) ? session.activeTools : []
  const showPrePoll = activeTools.includes('stancePollPre')
  const showPrepCard = activeTools.includes('prepCard')
  const showScript = activeTools.includes('debateScript')
  const showTimer = activeTools.includes('debateTimer')
  const showPostPoll = activeTools.includes('stancePollPost')
  const isVerdictTrialSession = session?.type === 'trial' && (
    Array.isArray(session?.judicialTrialScript) || !!session?.extraSides?.judge
  )
  const prePollOpen = !!stancePolls?.pre?.isOpen
  const postPollOpen = !!stancePolls?.post?.isOpen
  const isPublic = !!session?.prepCardsPublic
  const timer = session?.debateTimer
  const timerRunning = !!timer?.isRunning
  const activeEval = speechEvals.find((e) => e.isOpen) || null

  const type = session?.type || 'general'

  const MODE_THEME = {
    general: { color: 'indigo', label: '🎙️ 일반 토론', icon: '🎙️', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', gradient: 'from-indigo-600 to-violet-600' },
    trial: { color: 'amber', label: '⚖️ 국민참여재판', icon: '⚖️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', gradient: 'from-amber-600 to-amber-700' },
    multi_party: { color: 'emerald', label: '👥 다자간 토론', icon: '👥', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', gradient: 'from-emerald-600 to-emerald-700' },
    consultative: { color: 'blue', label: '🤝 협의 토론', icon: '🤝', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', gradient: 'from-blue-600 to-indigo-700' },
  }
  const theme = MODE_THEME[type] || MODE_THEME.general
 
  // 형식별 기본 진영명에 세션별 추가 진영을 병합한다.
  const modeSideLabels = useMemo(() => {
    const labels = {
      ...(DEBATE_SIDE_LABELS[type] || DEBATE_SIDE_LABELS.general),
      ...(session?.sideLabelOverrides || {}),
    }
    if (session?.extraSides) {
      Object.entries(session.extraSides).forEach(([sideId, side]) => {
        labels[sideId] = side?.label || sideId
      })
    }
    return labels
  }, [type, session?.sideLabelOverrides, session?.extraSides])

  // [Antigravity] v1.2.7 진영 정보 (RTDB 데이터 구조에 맞게 수정)
  const proStudents = session?.proStudents || {}
  const conStudents = session?.conStudents || {}
  const evaluators = session?.evaluators || {}
  
  const mySideId = useMemo(() => {
    if (proStudents[myStudentId]) return 'pro'
    if (conStudents[myStudentId]) return 'con'
    if (evaluators[myStudentId]) return 'evaluator'
    if (session?.extraSides) {
      for (const [sideId, side] of Object.entries(session.extraSides)) {
        if (side?.students?.[myStudentId]) return sideId
      }
    }
    return 'none'
  }, [proStudents, conStudents, evaluators, session?.extraSides, myStudentId])

  // 단계별 평가 항목 맵 — 평가단 단계 네비게이션용 (early return 이전에 위치해야 훅 순서 유지)
  const evalItemsByStage = useMemo(() => {
    const map = {}
    for (const item of speechEvals) {
      const idx = item.debateStage != null ? Number(item.debateStage) : -1
      if (!map[idx]) map[idx] = []
      map[idx].push(item)
    }
    return map
  }, [speechEvals])

  // 토론 후 탭용 — 닫힌 평가를 단계별 병합
  const stageEvalGroups = useMemo(() => {
    const stageMap = {}
    for (const e of speechEvals.filter((e) => !e.isOpen)) {
      const idx = e.debateStage != null ? Number(e.debateStage) : -1
      if (!stageMap[idx]) stageMap[idx] = { stageIdx: idx, items: [] }
      stageMap[idx].items.push(e)
    }
    return Object.values(stageMap)
      .sort((a, b) => a.stageIdx - b.stageIdx)
      .map(({ stageIdx, items }) => {
        const stageLabel = (items[0]?.targetLabel || `${stageIdx + 1}단계`)
          .replace(/\s*[—-]\s*발언:.*$/, '').trim()
        return { stageIdx, stageLabel, mergedTargets: mergeStageTargets(items) }
      })
  }, [speechEvals])

  const overallByTarget = useMemo(() => {
    const acc = {}
    for (const { mergedTargets } of stageEvalGroups)
      for (const t of mergedTargets) {
        if (t.n === 0) continue
        if (!acc[t.id]) acc[t.id] = { label: t.label, sums: [0, 0, 0], count: 0 }
        for (let i = 0; i < 3; i++) acc[t.id].sums[i] += t.avgs[i]
        acc[t.id].count++
      }
    return Object.values(acc).map((d) => ({
      id: d.label,
      label: d.label,
      avgs: d.count > 0 ? d.sums.map((s) => +(s / d.count).toFixed(1)) : [0, 0, 0],
    }))
  }, [stageEvalGroups])

  const mySideLabel =
    mySideId === 'evaluator'
      ? modeSideLabels.evaluator
      : mySideId === 'pro'
        ? modeSideLabels.pro
      : mySideId === 'con'
        ? modeSideLabels.con
        : modeSideLabels[mySideId] || '미배정'

  // 도구 시그니처(어떤 도구 어떤 상태로 열렸는지) — 변화 시 dismiss 해제하여 재부각
  const toolSignature = [
    sessionId || 'none',
    showPrePoll ? `1${prePollOpen ? '!' : ''}` : '0',
    showPrepCard ? `1${isPublic ? '!' : ''}` : '0',
    showScript ? '1' : '0',
    showTimer ? `1${timerRunning ? '!' : ''}` : '0',
    showPostPoll ? `1${postPollOpen ? '!' : ''}` : '0',
    activeEval ? `eval:${activeEval.id}` : '',
    mySideId, // 진영이 바뀌어도 재부각
  ].join(':')

  useEffect(() => {
    // 세션이 바뀌거나 도구가 새로 켜지면 dismissed 초기화
    if (sessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = sessionId
      setDismissedKey(null)
      return
    }
    // [Antigravity] 선생님이 팝업을 새로 올리면(false -> true) 무조건 재부각
    if (session?.isPopupOpen) {
      setDismissedKey(null)
    } else if (dismissedKey && dismissedKey !== toolSignature) {
      // 같은 세션 내에서 도구가 새로 켜졌거나 상태가 바뀌었으면 다시 부각
      setDismissedKey(null)
    }
  }, [sessionId, toolSignature, dismissedKey, session?.isPopupOpen])

  // 타이머가 실제로 '시작'되거나 활성 평가가 열리면 '토론 중' 탭으로 자동 전환
  // (timer 도구가 활성화만 되어 있고 아직 시작 전이면 '토론 전' 탭을 유지 — 사법·행정 흐름 자연스럽게)
  useEffect(() => {
    if (timerRunning || activeEval) setTab('mid')
  }, [timerRunning, activeEval?.id])
  // 토론 후 도구가 켜지면 '토론 후' 탭으로 자동 전환
  useEffect(() => {
    if (showPostPoll) setTab('post')
  }, [showPostPoll])
  // 교사 탭이 바뀌면 학생도 자동으로 따라감 — 교사·학생 화면이 항상 같은 탭을 봄
  useEffect(() => {
    const teacherTab = session?.teacherTab
    if (teacherTab && (teacherTab === 'pre' || teacherTab === 'mid' || teacherTab === 'post')) {
      setTab(teacherTab)
    }
  }, [session?.teacherTab])

  // 학생 전용 + 학급 설정 활성화
  if (role !== 'student') return null
  if (!debateEnabled) return null
  if (!session) return null

  const anyToolActive = showPrePoll || showPrepCard || showScript || showTimer || showPostPoll || !!activeEval
  const dismissed = dismissedKey === toolSignature
  // 선거 본 투표 모달 억제 — vote 단계(7단계)에서 투표 진행/종료 중일 때만 적용
  // (다른 단계에서 electionStatus가 잔류해도 토론 도구를 막지 않음)
  const electionModalSuppressed = wf.currentStep?.id === 'vote'
    && (electionStatus === 'voting' || electionStatus === 'ended')
  // [Antigravity] 선생님의 팝업 제어(isPopupOpen)를 최우선으로 따름 (단, 선거 투표 중에는 억제)
  const showFullModal = !!session?.isPopupOpen && !dismissed && !electionModalSuppressed

  // [Antigravity] 준비 카드 노출 대상 결정 (평가단이 아니면 무조건 노출, 평가단은 교사 옵션에 따라)
  const canSeePrep = mySideId === 'evaluator'
    ? !!session?.prepCardsVisibleToEvaluators
    : true

  // pre/post 비교 데이터
  const pollCompare = (() => {
    const pre = stancePolls?.pre
    const post = stancePolls?.post
    if (!pre?.options) return null
    const tally = (poll) => {
      const out = {}
      for (const o of pre.options) out[o] = 0
      for (const v of Object.values(poll?.votes || {})) {
        if (v?.option && out[v.option] !== undefined) out[v.option] += 1
      }
      return out
    }
    const preC = tally(pre)
    const postC = tally(post)
    const sumPre = Object.values(preC).reduce((a, n) => a + n, 0)
    const sumPost = Object.values(postC).reduce((a, n) => a + n, 0)
    return { options: pre.options, preC, postC, sumPre, sumPost }
  })()

  // 의장 — 다음 단계 / 일시정지·재개
  const onNextStage = () => {
    if (!timer) return
    const stages = timer.stages || []
    const idx = Number(timer.currentStage) || 0
    const roundInfo = getRoundInfo(timer, stages[idx])
    if (roundInfo.isRound && !roundInfo.isLastTeam) {
      return updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
        currentTeamIdx: roundInfo.teamIdx + 1,
        isRunning: false,
        isPaused: false,
        pausedRemaining: 0,
        startedAt: 0,
      })
    }
    const next = Math.min(stages.length - 1, idx + 1)
    return updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
      currentStage: next,
      currentTeamIdx: 0,
      isRunning: false,
      isPaused: false,
      pausedRemaining: 0,
      startedAt: 0,
    })
  }
  const timerStages = timer?.stages || []
  const timerIdx = Number(timer?.currentStage) || 0
  const timerRoundInfo = getRoundInfo(timer, timerStages[timerIdx])
  const evaluatorCount = Object.keys(session?.evaluators || {}).length
  const currentStageEvalItems = speechEvals.filter((e) => {
    if (!timer) return e.isOpen
    if (Number(e.debateStage) !== timerIdx) return false
    if (timerRoundInfo.isRound) return Number(e.roundTeamIdx) === timerRoundInfo.teamIdx
    return e.roundTeamIdx == null
  })
  const midEvalItems = timer ? currentStageEvalItems : (activeEval ? [activeEval] : [])
  const canGoNextTimerStep = timerIdx < timerStages.length - 1 || (timerRoundInfo.isRound && !timerRoundInfo.isLastTeam)
  const nextTimerLabel = timerRoundInfo.isRound && !timerRoundInfo.isLastTeam ? '다음 팀 ▶' : '다음 단계 ▶'
  const onPauseToggle = () => {
    if (!timer) return
    if (timer.isRunning && !timer.isPaused) {
      const remaining = computeRemaining(timer)
      return updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
        isRunning: false,
        isPaused: true,
        pausedRemaining: remaining,
      })
    }
    if (timer.isPaused) {
      const stages = timer.stages || []
      const idx = Number(timer.currentStage) || 0
      const stageSec = Number(stages[idx]?.seconds) || 0
      const remaining = Number(timer.pausedRemaining) || stageSec
      const startedAt = Date.now() - (stageSec - remaining) * 1000
      return updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
        isRunning: true,
        isPaused: false,
        startedAt,
      })
    }
    // idle → 시작
    return updateAt(roomCode, `debateSessions/${session.id}/debateTimer`, {
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
    })
  }

  return (
    <>
      {/* 1) 풀스크린 모달 (자동) — GlobalPollPopup 방식 */}
      {showFullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1008px] overflow-hidden flex flex-col max-h-[90vh]">
            {/* 헤더 — 모드별 테마 적용 */}
            <div className={`px-4 py-4 bg-gradient-to-r ${theme.gradient} text-white flex items-center gap-3 shadow-lg relative`}>
              <span className="text-2xl drop-shadow-md">{theme.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">{theme.label}</p>
                <h3 className="text-base font-black truncate drop-shadow-sm">{session.title}</h3>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className={`text-[11px] px-3 py-1 rounded-full font-black shadow-md bg-white ${theme.text}`}>
                  {mySideLabel}
                </span>
                {isChair && (
                  <span className="text-[11px] px-2 py-1 bg-amber-400 text-white rounded-lg font-black shadow-md ring-2 ring-white/50">
                    {modeSideLabels.chair}
                  </span>
                )}
                {type === 'trial' && <JudicialCaseRoomButton currentStage={5} label="📖 사건" />}
              </div>
              <button
                onClick={() => setDismissedKey(toolSignature)}
                className="ml-2 text-white/80 hover:text-white transition-colors bg-black/10 hover:bg-black/20 w-8 h-8 rounded-full flex items-center justify-center font-black"
                title="닫기 (좌하단에서 다시 열 수 있어요)"
              >
                ✕
              </button>
            </div>

            {/* 논제 */}
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
              <p className="text-[10px] text-indigo-500 font-bold">논제</p>
              <p className="text-sm text-gray-800 font-semibold">{session.topic}</p>
            </div>

            {/* 탭 */}
            <div className="flex bg-slate-50 border-b border-slate-200">
              {(() => {
                const teacherTab = session?.teacherTab
                const midUnlocked = timerRunning || teacherTab === 'mid' || teacherTab === 'post'
                const postUnlocked = showPostPoll || teacherTab === 'post' ||
                  speechEvals.filter((e) => !e.isOpen).length > 0
                return [
                  ['pre',  '토론 전',  true,         showPrePoll || (showPrepCard && canSeePrep) || showScript],
                  ['mid',  '토론 중',  midUnlocked,  showTimer],
                  ['post', '토론 후',  postUnlocked, showPostPoll || speechEvals.filter((e) => !e.isOpen).length > 0],
                ].map(([id, label, unlocked, on]) => (
                  <button
                    key={id}
                    onClick={() => unlocked && setTab(id)}
                    disabled={!unlocked}
                    title={!unlocked ? '교사가 아직 이 단계를 열지 않았습니다.' : undefined}
                    className={`flex-1 py-3 text-xs font-black transition-all relative ${
                      !unlocked
                        ? 'text-slate-300 cursor-not-allowed'
                        : tab === id
                          ? 'bg-white text-indigo-700 border-b-4 border-indigo-600'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    {!unlocked && <span className="ml-1 text-[9px]">🔒</span>}
                    {unlocked && on && (
                      <span className="absolute top-2 right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm shadow-rose-200" />
                    )}
                  </button>
                ))
              })()}
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {tab === 'pre' && (
                <>
                  {!showPrePoll && !showPrepCard && !showScript && (
                    <p className="text-xs text-gray-400 text-center py-6">
                      선생님이 도구를 활성화하면 여기에 표시됩니다.
                    </p>
                  )}
                  {showPrePoll && stancePolls?.pre && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                        📊 토론 전 여론조사
                      </h3>
                      <StancePoll session={session} pollId="pre" poll={stancePolls.pre} />
                    </div>
                  )}
                  {showPrepCard && canSeePrep && (
                    <>
                      {relatedBill && <BillBanner bill={relatedBill} />}
                      <DebatePrepCard session={session} prepCards={prepCards} isPublic={isPublic} />
                    </>
                  )}
                  {showScript && (
                    <DebateScriptEditor 
                      session={session} 
                      scripts={scripts} 
                      mySideId={mySideId} 
                      sideLabel={mySideLabel} 
                    />
                  )}
                </>
              )}
              {tab === 'mid' && (
                <>
                  {!showTimer ? (
                    <>
                      <CurrentStageEvalPanel
                        evalItems={midEvalItems}
                        activeEvalId={activeEval?.id}
                        evaluatorCount={evaluatorCount}
                        session={session}
                        stageLabel="타이머 준비 전 평가"
                        roundInfo={timerRoundInfo}
                      />
                      {!activeEval && (
                        <p className="text-xs text-gray-400 text-center py-6">
                          선생님이 토론 타이머를 켜면 여기에 표시됩니다.
                        </p>
                      )}
                    </>
                  ) : mySideId === 'evaluator' ? (
                    /* 평가단 전용 뷰 — 타이머 + 단계 네비게이션 바 */
                    <>
                      <DebateTimer
                        timer={timer}
                        topic={session.topic}
                        onPolicyReview={session?.relatedExecutiveMeeting ? () => openExecPolicyBoard(roomCode) : undefined}
                      />
                      {/* 국무회의: 대통령실 모둠이면 업무지시·진행 대본 노출(자체 게이트) */}
                      <CabinetScriptBox session={session} />
                      {/* ⑦ 참관 판사: 평가 작성란 위에 쟁점에서 이어온 활동 메모(읽기 전용 참고) */}
                      {isVerdictTrialSession && myStudentId && (
                        <JudicialActivityMemo
                          readOnly
                          title="🧑‍⚖️ 참관 판사 메모 (쟁점 단계 작성본 · 참고용)"
                          subtitle="쟁점 단계에서 쓴 내 메모입니다. 아래 평가·종합평가 작성에 참고하세요. (복사 가능)"
                          className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4"
                        />
                      )}
                      {timerStages.length > 0 && (
                        <EvaluatorStageNav
                          timerStages={timerStages}
                          currentDebateStage={timerIdx}
                          selectedStage={selectedEvalStage}
                          onSelect={(idx) => { setSelectedEvalStage(idx) }}
                          evalItemsByStage={evalItemsByStage}
                          myStudentId={myStudentId}
                        />
                      )}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-violet-700 uppercase tracking-wide">
                          {timerStages[selectedEvalStage]?.label || `${selectedEvalStage + 1}단계`} 평가 항목
                        </p>
                        {/* 모든 단계를 항상 마운트 유지 — CSS로만 표시/숨김 (단계 이동 후 재방문해도 입력값 보존)
                            라운드 단계: 타이머 기준 현재 발언자 1개만 표시 (나머지는 DOM에서 제외해 중복 방지) */}
                        {timerStages.map((_, stageIdx) => {
                          const allItems = evalItemsByStage[stageIdx] || []
                          const isRoundStage = allItems.some((i) => i.roundTeamIdx != null)
                          if (isRoundStage) {
                            // 현재 타이머 단계면 타이머 라운드 인덱스 기준, 그 외(과거/미래)는 첫 항목만
                            const roundItem = stageIdx === timerIdx
                              ? allItems.find((i) => Number(i.roundTeamIdx) === timerRoundInfo.teamIdx)
                              : allItems[0]
                            return (
                              <div key={stageIdx} className={stageIdx === selectedEvalStage ? '' : 'hidden'}>
                                {!roundItem ? (
                                  <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 text-center">
                                    <p className="text-sm text-violet-400">이 단계에는 평가 항목이 없습니다.</p>
                                  </div>
                                ) : (
                                  <SpeechEval
                                    key={roundItem.id}
                                    evalItem={roundItem}
                                    session={session}
                                    mode="live"
                                    forceInput={true}
                                  />
                                )}
                              </div>
                            )
                          }
                          // 일반 단계: 모두 마운트 유지 (입력값 보존)
                          return (
                            <div key={stageIdx} className={stageIdx === selectedEvalStage ? '' : 'hidden'}>
                              {allItems.length === 0 ? (
                                <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 text-center">
                                  <p className="text-sm text-violet-400">이 단계에는 평가 항목이 없습니다.</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {allItems.map((item) => (
                                    <SpeechEval
                                      key={item.id}
                                      evalItem={item}
                                      session={session}
                                      mode="live"
                                      forceInput={true}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    /* 일반 학생 뷰 (기존) */
                    <>
                      <CurrentStageEvalPanel
                        evalItems={midEvalItems}
                        activeEvalId={activeEval?.id}
                        evaluatorCount={evaluatorCount}
                        session={session}
                        stageLabel={timerStages[timerIdx]?.label || `${timerIdx + 1}단계`}
                        roundInfo={timerRoundInfo}
                      />
                      <DebateTimer
                        timer={timer}
                        topic={session.topic}
                        onPolicyReview={session?.relatedExecutiveMeeting ? () => openExecPolicyBoard(roomCode) : undefined}
                      />

                      {/* 국무회의: 대통령실 모둠 타이머 밑에 진행 대본 노출 */}
                      <CabinetScriptBox session={session} />

                      {isVerdictTrialSession && myStudentId && (
                        <JudicialActivityMemo
                          title="🧑‍⚖️ 판결문 참고 메모 (쟁점에서 이어서)"
                          subtitle="쟁점 단계에서 쓴 내 메모입니다. 재판을 보며 이어서 보강하세요. 입력하면 자동 저장됩니다."
                          rows={6}
                          className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4"
                        />
                      )}

                      {isVerdictTrialSession && myStudentId && (
                        <VerdictTrialDraftPanel
                          session={session}
                          groupId={myGroupId}
                          groups={groups}
                          sections={verdictSections}
                          myStudentId={myStudentId}
                          myNickname={myNickname}
                        />
                      )}

                      {/* 프롬프트 (대본) */}
                      {showScript && (
                        <DebateScriptPrompter
                          scripts={scripts}
                          mySideId={mySideId}
                          sideLabel={mySideLabel}
                        />
                      )}

                      {/* 우리가 작성한 토론카드 (전체 펼침) */}
                      {showPrepCard && canSeePrep && (
                        <DebatePrepCard
                          session={session}
                          prepCards={prepCards}
                          isPublic={isPublic}
                          mode="view"
                        />
                      )}

                      {/* 의장 미니 제어 */}
                      {isChair && timer && (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-2">
                          <p className="text-[11px] font-bold text-amber-800">
                            🎙️ 의장 모드 — 토론 진행 제어
                          </p>
                          <DebateTimer timer={timer} compact topic={session.topic} />
                          <div className="flex gap-2">
                            <button
                              onClick={onPauseToggle}
                              className={`flex-1 py-2 text-sm rounded-lg font-bold ${
                                timer.isRunning && !timer.isPaused
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {timer.isRunning && !timer.isPaused
                                ? '⏸ 일시정지'
                                : timer.isPaused
                                ? '▶ 재개'
                                : '▶ 시작'}
                            </button>
                            <button
                              onClick={onNextStage}
                              disabled={!canGoNextTimerStep}
                              className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40 hover:bg-indigo-700"
                            >
                              {nextTimerLabel}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {mySideId === 'evaluator' && (
                    <EvaluatorFinalCommentForm session={session} />
                  )}
                  {/* ③ 참관 판사도 모둠 판결문을 작성·게시할 수 있게 */}
                  {mySideId === 'evaluator' && isVerdictTrialSession && myStudentId && (
                    <VerdictTrialDraftPanel
                      session={session}
                      groupId={myGroupId}
                      groups={groups}
                      sections={verdictSections}
                      myStudentId={myStudentId}
                      myNickname={myNickname}
                    />
                  )}
                </>
              )}
              {tab === 'post' && (
                <>
                  {/* 토론 후 여론조사 */}
                  {showPostPoll && stancePolls?.post && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                        📊 토론 후 여론조사
                      </h3>
                      <StancePoll session={session} pollId="post" poll={stancePolls.post} prePoll={stancePolls.pre} />
                    </div>
                  )}

                  {/* 토론 준비 카드 복습 — 내가 쓴 카드 + 모둠원 카드 */}
                  {prepCards.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-amber-700 flex items-center gap-1">
                        📝 우리가 쓴 토론카드 복습
                      </h3>
                      <DebatePrepCard
                        session={session}
                        prepCards={prepCards}
                        isPublic={true}
                        mode="view"
                      />
                    </div>
                  )}

                  {/* 전후 비교 그래프 */}
                  {pollCompare && pollCompare.sumPost > 0 && (
                    <div className="bg-white rounded-2xl border-2 border-violet-200 p-3 space-y-2">
                      <p className="text-xs font-bold text-violet-700">📊 토론 전후 비교</p>
                      {pollCompare.options.map((o) => {
                        const prePct = pollCompare.sumPre ? Math.round((pollCompare.preC[o] / pollCompare.sumPre) * 100) : 0
                        const postPct = pollCompare.sumPost ? Math.round((pollCompare.postC[o] / pollCompare.sumPost) * 100) : 0
                        const delta = postPct - prePct
                        const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–'
                        const arrowCls = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-400'
                        return (
                          <div key={o} className="text-xs">
                            <div className="flex items-baseline justify-between">
                              <span className="font-semibold">{o}</span>
                              <span className="tabular-nums">
                                {prePct}% → {postPct}%{' '}
                                <span className={`font-bold ${arrowCls}`}>{arrow} {Math.abs(delta)}%p</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-400" style={{ width: `${prePct}%` }} />
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500" style={{ width: `${postPct}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500 text-center">
                        <span>토론 전 ({pollCompare.sumPre}명)</span>
                        <span>토론 후 ({pollCompare.sumPost}명)</span>
                      </div>
                    </div>
                  )}

                  {/* 누적 발언 평가 결과 — 단계별 숫자 + 종합 삼각형 */}
                  {stageEvalGroups.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-violet-700">📚 단계별 평가 결과</p>

                      {/* 단계별 — 숫자만, 2열 그리드 */}
                      <div className="grid grid-cols-2 gap-2">
                      {stageEvalGroups.map(({ stageIdx, stageLabel, mergedTargets }) => (
                        <div key={stageIdx} className="bg-white rounded-xl border border-violet-200 p-2.5 space-y-1.5">
                          <p className="text-[11px] font-black text-violet-700">{stageLabel}</p>
                          {mergedTargets.length === 0 ? (
                            <p className="text-[10px] text-gray-400">제출된 평가 없음</p>
                          ) : mergedTargets.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 py-0.5 border-b border-violet-50 last:border-0">
                              <span className="text-[11px] font-bold text-gray-700 w-24 truncate shrink-0">{t.label}</span>
                              <div className="flex gap-2 flex-1">
                                {EVAL_AXES.map((axis, i) => (
                                  <span key={axis} className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-gray-400">{axis.slice(0, 2)}</span>
                                    <span className="text-xs font-black text-violet-700 tabular-nums">
                                      {t.n > 0 ? t.avgs[i].toFixed(1) : '-'}
                                    </span>
                                  </span>
                                ))}
                              </div>
                              <span className="text-[9px] text-gray-400 shrink-0">{t.n}명</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      </div>

                      {/* 종합 평균 — 대상별 삼각형 */}
                      {overallByTarget.length > 0 && (
                        <div className="bg-violet-50 rounded-xl border-2 border-violet-300 p-3 space-y-2">
                          <p className="text-xs font-black text-violet-800">🏆 종합 평균 (전 단계 평균)</p>
                          <div className={`grid gap-3 ${
                            overallByTarget.length === 1 ? 'grid-cols-1'
                            : overallByTarget.length === 2 ? 'grid-cols-2'
                            : 'grid-cols-3'
                          }`}>
                            {overallByTarget.map((t) => (
                              <div key={t.id} className="text-center">
                                <p className="text-[11px] font-bold text-violet-700 truncate mb-1">{t.label}</p>
                                <div className="flex justify-center">
                                  <MiniRadar values={t.avgs} size={130} />
                                </div>
                                <div className="flex justify-around pt-0.5">
                                  {EVAL_AXES.map((axis, i) => (
                                    <div key={axis} className="text-center">
                                      <div className="text-[8px] text-gray-400">{axis.slice(0, 2)}</div>
                                      <div className="text-xs font-black text-violet-700">{t.avgs[i].toFixed(1)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 토론 결과 참고 */}
                  <DebateRefPanel />

                  {/* 여론판 기사 참고 */}
                  <ArticleRefPanel />

                  {/* 토론 후 기사 쓰기 */}
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-3 space-y-2">
                    <p className="text-xs font-bold text-blue-800">📰 토론 후 기사 쓰기</p>
                    <p className="text-[10px] text-gray-500">
                      방금 토론한 내용을 우리 모둠 기사로 정리해서 여론판에 게시하세요.
                    </p>
                    {/* 기사 작성 참고용 — 내가 쓴 최종 평가 */}
                    <MyFinalEvalRecap session={session} />
                    <ArticleSection />
                  </div>

                  {/* 빈 상태 */}
                  {!showPostPoll && speechEvals.filter((e) => !e.isOpen).length === 0 && (
                    <p className="text-[11px] text-gray-400 text-center pt-2">
                      선생님이 토론 후 여론조사를 열면 위쪽에 표시됩니다.
                    </p>
                  )}
                  {mySideId === 'evaluator' && (
                    <EvaluatorFinalCommentForm session={session} />
                  )}
                </>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-4 py-2.5 border-t bg-white flex justify-end">
              <button
                onClick={() => setDismissedKey(toolSignature)}
                className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
              >
                닫기 (좌하단 버튼으로 다시 열기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2) 닫혔을 때 우하단 플로팅 버튼 — 다시 열기
            SessionFinishButton(bottom-4) + Phase 3 ExpertCallButton(bottom-24) 와
            겹치지 않게 bottom-44 위치에 배치
            선거 투표 진행/종료 중에는 선거 토론 플로팅 버튼도 숨김 */}
      {!showFullModal && !electionModalSuppressed && (
        <button
          type="button"
          onClick={() => setDismissedKey(null)}
          className={`fixed bottom-44 right-4 z-30 px-3.5 py-2.5 rounded-full text-white shadow-lg flex items-center gap-1.5 font-bold text-sm transition ${
            anyToolActive ? 'bg-indigo-600 hover:bg-indigo-700 animate-pulse ring-4 ring-indigo-200' : 'bg-indigo-400 hover:bg-indigo-500'
          }`}
          title={anyToolActive ? `🎙️ 토론 진행 중 — ${session.title}` : session.title}
        >
          💬 토론 도구
          {anyToolActive && (
            <span className="text-[9px] px-1.5 py-0.5 bg-rose-500 text-white rounded-full font-bold animate-pulse">
              진행 중
            </span>
          )}
          {isChair && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-300 text-amber-900 rounded-full">{modeSideLabels.chair}</span>
          )}
        </button>
      )}
    </>
  )
}

/**
 * 평가단 전용 단계 네비게이션 바.
 * 타이머 아래에 표시되며, 각 단계를 클릭해 평가 항목으로 이동한다.
 * 현재 토론 진행 단계는 크게 강조("현재단계" 뱃지).
 */
function EvaluatorStageNav({ timerStages, currentDebateStage, selectedStage, onSelect, evalItemsByStage, myStudentId }) {
  return (
    <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-3 space-y-2">
      <p className="text-[10px] font-black text-violet-700 uppercase tracking-wide">
        단계별 평가 현황 — 클릭해서 이동
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {timerStages.map((stage, idx) => {
          const items = evalItemsByStage[idx] || []
          const hasItems = items.length > 0
          const submitted = hasItems && items.every((item) => !!item.results?.[myStudentId])
          const isCurrent = idx === currentDebateStage
          const isSelected = idx === selectedStage

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={[
                'flex-shrink-0 rounded-xl border-2 transition-all text-center cursor-pointer',
                isSelected
                  ? 'border-violet-600 bg-violet-100 shadow-md'
                  : 'border-violet-200 bg-white hover:border-violet-400 hover:bg-violet-50',
                isCurrent ? 'ring-2 ring-violet-400 ring-offset-1' : '',
                isCurrent ? 'px-3 py-2.5 min-w-[80px]' : 'px-2.5 py-2 min-w-[64px]',
              ].filter(Boolean).join(' ')}
            >
              {isCurrent && (
                <div className="text-[8px] font-black text-white bg-violet-600 rounded px-1 py-0.5 mb-1">
                  현재단계
                </div>
              )}
              <div className={`font-bold ${isCurrent ? 'text-sm text-violet-900' : 'text-xs text-gray-700'}`}>
                {stage.label || `${idx + 1}단계`}
              </div>
              <div className={`text-[9px] mt-0.5 font-bold ${
                !hasItems ? 'text-gray-300'
                : submitted ? 'text-emerald-600'
                : 'text-amber-600'
              }`}>
                {!hasItems ? '—' : submitted ? '✅ 완료' : '○ 미제출'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 현재 단계 평가 패널 (학생용 — 토론 중 탭, 타이머 위).
 * 평가 입력/대기/제출 현황을 타이머 흐름 안에 붙여 보여준다.
 */
function CurrentStageEvalPanel({ evalItems = [], activeEvalId, evaluatorCount, session, stageLabel, roundInfo }) {
  if (!evalItems.length) return null
  const evaluatorLabel = session?.sideLabelOverrides?.evaluator || '평가단'

  return (
    <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-violet-700 uppercase tracking-wide">
            현재 단계 평가
          </p>
          <p className="text-sm font-black text-violet-950 truncate">
            {stageLabel}
            {roundInfo?.isRound ? ` · ${roundInfo.teamLabel}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-white border border-violet-200 text-violet-700 font-black">
          {evaluatorLabel} {evaluatorCount}명
        </span>
      </div>

      <div className="space-y-2">
        {evalItems.map((item) => {
          const submitted = Object.keys(item.results || {}).length
          const pct = evaluatorCount > 0 ? Math.min(100, Math.round((submitted / evaluatorCount) * 100)) : 0
          const isActive = item.id === activeEvalId && item.isOpen
          const agg = aggregateEval(item)
          const avg = agg.n > 0 ? ((agg.avgs[0] + agg.avgs[1] + agg.avgs[2]) / 3).toFixed(1) : '0.0'

          return (
            <div key={item.id} className={`rounded-xl border bg-white overflow-hidden ${isActive ? 'border-violet-300 shadow-sm' : 'border-violet-100'}`}>
              <div className="px-3 py-2 border-b border-violet-100 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-violet-600 text-white animate-pulse' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isActive ? '평가 중' : '평가 기록'}
                  </span>
                  <span className="text-xs font-bold text-slate-800 flex-1 truncate">{item.targetLabel}</span>
                  <span className="text-[10px] text-violet-700 font-black tabular-nums">
                    {submitted}/{evaluatorCount}명
                  </span>
                </div>
                <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {isActive ? (
                <div className="p-2">
                  <SpeechEval key={`${item.id}_${JSON.stringify(item.targets || [])}`} evalItem={item} session={session} mode="live" />
                </div>
              ) : (
                <div className="px-3 py-2 text-[11px] text-gray-500 flex justify-between">
                  <span>이 단계 평가가 저장되어 있어요.</span>
                  <span className="font-bold text-violet-700">평균 ★{avg}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 평가 진행 상황 표시 (학생용 — 현재는 보조 컴포넌트로 보존).
 */
function EvalProgressBar({ activeEval, allEvals, evaluatorCount }) {
  const totalEvals = (allEvals || []).length

  // 진행 중 평가가 있으면 그 진행 상황을 강조
  if (activeEval) {
    const submitted = Object.keys(activeEval.results || {}).length
    const pct = evaluatorCount > 0 ? Math.round((submitted / evaluatorCount) * 100) : 0
    return (
      <div className="bg-violet-50 border-2 border-violet-300 rounded-xl p-3 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-violet-600 text-white animate-pulse">
            평가 진행 중
          </span>
          <span className="text-xs font-semibold text-violet-900 truncate flex-1">
            {activeEval.targetLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-violet-700">
            {submitted} / {evaluatorCount}명
          </span>
        </div>
        <p className="text-[10px] text-violet-600">평가단의 별점·코멘트 제출 현황</p>
      </div>
    )
  }

  // 진행 중 평가 없지만 누적 기록 있으면 요약만
  if (totalEvals > 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-[11px] text-gray-600 text-center">
        💬 지금까지 평가단 단계 평가 <b>{totalEvals}</b>건 누적 ·
        평가단 <b>{evaluatorCount}</b>명
      </div>
    )
  }

  return null
}

// 토론 후 기사 쓰기 구역 상단 — 내가 저장한 최종 평가를 참고용으로 표시(읽기 전용)
function MyFinalEvalRecap({ session }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!roomCode || !session?.id || !myStudentId) return
    const u = subscribe(roomCode, `debateSessions/${session.id}/finalEvaluations/${myStudentId}`, (d) => {
      setText(d ? (typeof d === 'string' ? d : d.content || d.comment || '') : '')
    })
    return () => u?.()
  }, [roomCode, session?.id, myStudentId])

  if (!text.trim()) return null
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
      <p className="text-[11px] font-black text-violet-800 mb-1">🧑‍⚖️ 내가 쓴 최종 평가 (기사 참고용)</p>
      <p className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">{text}</p>
    </div>
  )
}

function EvaluatorFinalCommentForm({ session }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [memo, setMemo] = useState('')

  // 쟁점·재판 활동 메모(개인 단위) — '불러오기'에 함께 포함
  useEffect(() => {
    const caseId = session?.relatedCaseId
    if (!roomCode || !caseId || !myStudentId) return
    const u = subscribe(roomCode, `judicialIssues/${caseId}/${myStudentId}`, (d) => setMemo(d?.body || ''))
    return () => u?.()
  }, [roomCode, session?.relatedCaseId, myStudentId])

  // Load existing final evaluation
  useEffect(() => {
    if (!roomCode || !session?.id || !myStudentId) return
    getOnce(roomCode, `debateSessions/${session.id}/finalEvaluations/${myStudentId}`).then((d) => {
      if (d) {
        setCommentText(typeof d === 'string' ? d : d.content || d.comment || '')
      }
    })
  }, [roomCode, session?.id, myStudentId])

  const handleImportAll = () => {
    const evals = Object.values(session?.speechEvals || {})
    const evalLines = []

    evals.forEach((ev) => {
      const myRes = ev.results?.[myStudentId]
      if (!myRes) return

      // Single target
      if (ev.targetLabel && myRes.scores) {
        const scoresStr = myRes.scores.map((s, idx) => `${EVAL_AXES[idx]}: ${s}점`).join(', ')
        evalLines.push(`• [${ev.targetLabel}] (${scoresStr})`)
        if (myRes.comment) {
          evalLines.push(`  └ 의견: ${myRes.comment}`)
        }
      }

      // Multi target
      if (myRes.perTarget) {
        Object.entries(myRes.perTarget).forEach(([tid, d]) => {
          const target = ev.targets?.find((t) => t.id === tid)
          const targetLabel = target ? target.label : tid
          const scoresStr = d.scores.map((s, idx) => `${EVAL_AXES[idx]}: ${s}점`).join(', ')
          evalLines.push(`• [${ev.targetLabel} - ${targetLabel}] (${scoresStr})`)
          if (d.comment) {
            evalLines.push(`  └ 의견: ${d.comment}`)
          }
        })
      }
    })

    if (!memo.trim() && evalLines.length === 0) {
      alert('아직 작성한 메모나 개별 발언 평가가 없습니다.')
      return
    }

    const lines = []
    if (memo.trim()) {
      lines.push('【쟁점·재판 메모】', memo.trim())
    }
    if (evalLines.length > 0) {
      if (lines.length > 0) lines.push('')
      lines.push('【개별 평가】', ...evalLines)
    }

    const merged = lines.join('\n')
    setCommentText((prev) => prev ? `${prev}\n\n${merged}` : merged)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await setAt(roomCode, `debateSessions/${session.id}/finalEvaluations/${myStudentId}`, {
        content: commentText,
        updatedAt: Date.now(),
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 p-4 border-2 border-violet-300 rounded-2xl bg-violet-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-violet-850 flex items-center gap-1">
          ⚖️ {session?.sideLabelOverrides?.evaluator || '평가단'} 최종 종합 평가
        </h4>
        <button
          type="button"
          onClick={handleImportAll}
          className="px-2.5 py-1.5 text-[10px] font-black text-violet-700 bg-white border border-violet-300 rounded-xl hover:bg-violet-100 transition active:scale-95 cursor-pointer shadow-2xs"
        >
          📥 메모 + 개별평가 모두 불러오기
        </button>
      </div>
      <p className="text-[10px] text-gray-500">
        토론 전체 과정에 대한 최종 평가 의견을 자유롭게 기록하세요. 불러오기를 누르면 쟁점·재판 메모와 지금까지 남긴 발언별 별점·한줄 의견이 자동 정리되어 추가됩니다.
      </p>
      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        rows={6}
        placeholder="종합 평가 내용을 작성해 주세요..."
        className="w-full p-3 text-xs bg-white border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent leading-relaxed"
      />
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !commentText.trim()}
          className={`w-full py-3 rounded-xl font-black text-sm shadow-md transition active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            saveSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
          }`}
        >
          {saving ? '저장 중...' : saveSuccess ? '✓ 저장 완료!' : '💾 최종 평가 저장하기'}
        </button>
        <span className="block text-[9px] text-gray-400 leading-tight text-center">작성한 평가는 나의 발자취(여정) 및 캔바 카드뉴스 참고란에 연동됩니다.</span>
      </div>
    </div>
  )
}

export default DebateToolPanel
