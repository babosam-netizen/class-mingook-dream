/**
 * JudicialCaseRoom.jsx
 * 학생용 사건 자료실 — activeCase 데이터를 단계별로 표시
 *
 * 표시 내용:
 *  - 사건 배경 (항상)
 *  - 역할별 힌트 (내 역할에 맞는 것만)
 *  - 증거 목록 (revealedAtStage ≤ currentStage)
 *  - 증인 진술서 (내 측 또는 심문 단계 이후)
 *  - 피고인 진술서 (변호측 또는 심문 단계 이후)
 *  - 단계별 학생 안내문
 */

import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { JUDICIAL_PRESETS, PERSONA_LABEL } from '../../lib/judicial-case-data'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { resolveImageUrl } from '../../lib/legacy-image'

// 역할 key → 사법 역할 분류
function classifyJudicialRole(roleKey) {
  if (!roleKey) return 'jury'
  const k = roleKey.toLowerCase()
  if (k.includes('judge') || k === 'judge') return 'judges'
  if (k.includes('prosecutor') || k === 'prosecutor') return 'prosecution'
  if (k.includes('defender') || k === 'defender' || k.includes('defense')) return 'defense'
  if (k.includes('juror') || k === 'juror') return 'jury'
  if (k.includes('witness')) return 'witness'
  if (k.includes('defendant')) return 'defendant'
  if (k.includes('reporter') || k.includes('press')) return 'press'
  return 'jury'
}

const SIDE_COLOR = {
  prosecution: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: '검사측' },
  defense:     { bg: 'bg-sky-50',  border: 'border-sky-200',  badge: 'bg-sky-100 text-sky-700',  label: '변호측' },
  both:        { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', label: '공통' },
}

function EvidenceCard({ ev }) {
  const s = SIDE_COLOR[ev.side] || SIDE_COLOR.both
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${s.bg} ${s.border}`}>
      <div className="flex items-start gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${s.badge}`}>{s.label}</span>
        <p className="text-xs font-bold text-slate-800">{ev.title}</p>
      </div>
      <p className="text-[11px] text-slate-600 leading-relaxed">{ev.description}</p>
      {ev.canvaUrl ? (
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-md border border-current/20 bg-white">
          <iframe
            src={formatCanvaEmbedUrl(ev.canvaUrl)}
            allowFullScreen
            allow="fullscreen"
            className="absolute inset-0 w-full h-full border-0"
            title={ev.title || '증거 자료'}
          />
        </div>
      ) : ev.imageUrl ? (
        <div className="overflow-hidden rounded-md border border-current/20 bg-white">
          <img
            src={resolveImageUrl(ev.imageUrl)}
            alt={ev.title || '증거 사진'}
            className="w-full max-h-52 object-contain bg-white"
          />
        </div>
      ) : null}
      {ev.imageHint && (
        <p className="text-[10px] text-slate-400 italic">📎 {ev.imageHint}</p>
      )}
      {ev.sampleContent && (
        <div className="bg-white/80 rounded p-2 border border-current/20">
          <p className="text-[10px] font-bold text-slate-500 mb-1">자료에 적힌 내용</p>
          <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">{ev.sampleContent}</p>
        </div>
      )}
    </div>
  )
}

function WitnessCard({ w, isMyGroup }) {
  const [open, setOpen] = useState(isMyGroup)
  const s = w.side === 'prosecution' ? SIDE_COLOR.prosecution : SIDE_COLOR.defense
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${s.badge}`}>{s.label}</span>
          <div>
            <p className="text-xs font-bold text-slate-800">{w.name}</p>
            <p className="text-[10px] text-slate-500">{w.role}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded border border-current text-slate-500 hover:text-slate-700"
        >
          {open ? '접기 ▲' : '진술서 ▼'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500 italic">💡 {w.keyPoint}</p>
      {open && (
        <div className="bg-white/80 rounded p-2 border border-current/20 text-[11px] text-slate-700 leading-relaxed space-y-2">
          <div className="whitespace-pre-wrap">{w.statement}</div>
          {(w.saw || w.heard || w.knows?.length > 0) && (
            <div className="grid gap-1">
              {w.saw && <p><b>직접 본 것:</b> {w.saw}</p>}
              {w.heard && <p><b>직접 들은 말:</b> {w.heard}</p>}
              {w.knows?.length > 0 && (
                <div>
                  <b>알고 있는 사실:</b>
                  <ul className="list-disc ml-4 mt-0.5">
                    {w.knows.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {w.answerGuide && (
            <div className="rounded bg-amber-50 border border-amber-100 px-2 py-1">
              <p className="text-[10px] font-bold text-amber-700">심문 답변 가이드</p>
              <p className="mt-0.5">{w.answerGuide}</p>
            </div>
          )}
          {w.expectedQuestions?.length > 0 && (
            <div className="rounded bg-slate-50 border border-slate-100 px-2 py-1">
              <p className="text-[10px] font-bold text-slate-600">예상 질문과 답변</p>
              <div className="mt-1 space-y-1">
                {w.expectedQuestions.map((qa, i) => (
                  <div key={i}>
                    <p className="font-semibold text-slate-700">Q. {qa.question}</p>
                    <p className="text-slate-600">A. {qa.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function JudicialCaseRoom({ currentStage = 1, hideEvidence = false, hideRoleHints = false }) {
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const myRole = useGameStore((s) => s.role)

  // activeCase 결정 (Firebase 저장 우선, fallback → 로컬 프리셋)
  const storedActiveCase = branchConfig?.judicial?.activeCase
  const storedActiveCaseId = branchConfig?.judicial?.activeCaseId || 'byeolbit_2024'
  const caseData = storedActiveCase
    || JUDICIAL_PRESETS.find((p) => p.id === storedActiveCaseId)
    || JUDICIAL_PRESETS[0]

  const stage = Math.max(1, Math.min(7, currentStage))

  // 내 역할 분류
  const myRoleClass = classifyJudicialRole(myRole?.key || myRole)

  // 이 단계에서 공개된 증거만 필터
  const visibleEvidence = (caseData.evidence || []).filter((ev) => ev.revealedAtStage <= stage)

  // 내 측 증인 진술서 (논고 카드 단계부터), 심문 단계 이후엔 모든 증인
  const myRoleSide = (myRoleClass === 'prosecution' || myRoleClass === 'witness') ? 'prosecution'
    : (myRoleClass === 'defense' || myRoleClass === 'defendant') ? 'defense' : null
  const visibleWitnesses = (caseData.witnesses || []).filter((w) => {
    if (stage >= 5) return true       // 심문 단계부터 모든 증인 공개
    if (stage >= 2 && myRoleSide) return w.side === myRoleSide  // 논고 단계부터 내 측만
    return false
  })

  // 피고인 진술서 공개 조건
  const showDefendantScript = caseData.defendant?.script && (
    myRoleClass === 'defense' || myRoleClass === 'defendant' || stage >= 5
  )

  // 내 역할 힌트
  const myHint = caseData.roleHints?.[myRoleClass] || caseData.roleHints?.jury || ''

  // 현재 단계 학생 안내
  const stageGuide = (caseData.stageGuides || []).find((g) => g.stage === stage)

  const [activeTab, setActiveTab] = useState('case')

  const tabs = [
    { key: 'case',      label: '📋 사건 배경' },
    ...(hideEvidence ? [] : [{ key: 'evidence',  label: `🗂️ 증거 (${visibleEvidence.length})` }]),
    ...(visibleWitnesses.length > 0 ? [{ key: 'witnesses', label: `👤 증인 (${visibleWitnesses.length})` }] : []),
    ...(showDefendantScript ? [{ key: 'defendant', label: '🧑‍💼 피고인 진술' }] : []),
    ...((myHint && !hideRoleHints) ? [{ key: 'hint', label: '💡 내 역할 힌트' }] : []),
  ]

  if (!caseData) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-400">
        교사가 사건을 설정하면 이 공간에 자료가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 단계 안내 */}
      {stageGuide?.studentNote && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800">
            <span className="font-bold">📌 {stage}단계 안내: </span>
            {stageGuide.studentNote}
          </p>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
              activeTab === t.key
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {/* 사건 배경 */}
        {activeTab === 'case' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-rose-100 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-black text-rose-800">{caseData.title}</h3>
                {caseData.subtitle && (
                  <p className="text-[11px] text-rose-600 mt-0.5">{caseData.subtitle}</p>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{caseData.summary}</p>

              {/* 사전 이야기 — 사건 배경 / 있었던 일 (동화·소설처럼) */}
              {(caseData.story?.background || caseData.story?.incident) && (
                <div className="space-y-2">
                  {caseData.story?.background && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                      <p className="text-[10px] font-black text-amber-700">📖 사건 배경</p>
                      <p className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{caseData.story.background}</p>
                    </div>
                  )}
                  {caseData.story?.incident && (
                    <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 space-y-1">
                      <p className="text-[10px] font-black text-sky-700">📅 있었던 일</p>
                      <p className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{caseData.story.incident}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 피고인 기본 정보 */}
              {caseData.defendant && (
                <div className="bg-slate-50 rounded-lg p-2.5 space-y-1">
                  <p className="text-[10px] font-black text-slate-600">피고인</p>
                  <p className="text-xs font-bold text-slate-800">
                    {caseData.defendant.name}
                    {caseData.defendant.age ? ` (${caseData.defendant.age}세)` : ''}
                    {caseData.defendant.occupation ? ` · ${caseData.defendant.occupation}` : ''}
                  </p>
                  <span className="inline-block text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {PERSONA_LABEL[caseData.defendant.persona] || ''}
                  </span>
                </div>
              )}

              {/* 피해자 */}
              {caseData.victims?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-600">피해자</p>
                  {caseData.victims.map((v, i) => (
                    <div key={i} className="bg-red-50 rounded p-2">
                      <p className="text-xs font-semibold text-slate-800">{v.name} · {v.role}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{v.experience}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 죄목 */}
              {caseData.charges?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-600">죄목</p>
                  {caseData.charges.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold shrink-0">{c.law}</span>
                      <span className="text-[10px] text-slate-600">{c.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 핵심 쟁점 */}
              {caseData.keyIssues?.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-2.5 space-y-1">
                  <p className="text-[10px] font-black text-amber-700">핵심 쟁점</p>
                  {caseData.keyIssues.map((q, i) => (
                    <p key={i} className="text-[11px] text-amber-800">• {q}</p>
                  ))}
                </div>
              )}

              {/* 검사 구형 (변론 단계 이후) */}
              {stage >= 6 && caseData.prosecutionDemand && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <p className="text-[10px] font-black text-red-700">검사 구형</p>
                  <p className="text-xs text-red-800 mt-0.5 font-semibold">{caseData.prosecutionDemand}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 증거 */}
        {activeTab === 'evidence' && (
          <div className="space-y-2">
            {visibleEvidence.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                이 단계에서 공개된 증거가 없습니다.
              </div>
            ) : (
              <>
                {['prosecution', 'both', 'defense'].map((side) => {
                  const list = visibleEvidence.filter((ev) => ev.side === side)
                  if (!list.length) return null
                  const label = side === 'prosecution' ? '🔴 검사측 증거' : side === 'defense' ? '🔵 변호측 증거' : '🟣 공통 자료'
                  return (
                    <div key={side}>
                      <p className="text-[10px] font-black text-gray-500 mb-1">{label}</p>
                      <div className="space-y-2">
                        {list.map((ev) => <EvidenceCard key={ev.id} ev={ev} />)}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* 증인 */}
        {activeTab === 'witnesses' && (
          <div className="space-y-2">
            {visibleWitnesses.map((w) => (
              <WitnessCard
                key={w.id}
                w={w}
                isMyGroup={myRoleSide === w.side}
              />
            ))}
          </div>
        )}

        {/* 피고인 진술 */}
        {activeTab === 'defendant' && caseData.defendant && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">피고인 진술서</span>
              <p className="text-xs font-bold text-slate-800">{caseData.defendant.name}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
              {caseData.defendant.script}
            </div>
            {caseData.defendant.scriptHint && (myRoleClass === 'defense' || myRoleClass === 'defendant') && (
              <div className="bg-sky-50 border border-sky-100 rounded p-2">
                <p className="text-[10px] font-bold text-sky-700">💡 변호 전략 힌트 (변호팀만 볼 수 있어요)</p>
                <p className="text-[10px] text-sky-800 mt-0.5">{caseData.defendant.scriptHint}</p>
              </div>
            )}
          </div>
        )}

        {/* 역할 힌트 */}
        {activeTab === 'hint' && myHint && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-black text-amber-800">💡 내 역할 가이드</p>
            <p className="text-[11px] text-amber-900 leading-relaxed">{myHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default JudicialCaseRoom
