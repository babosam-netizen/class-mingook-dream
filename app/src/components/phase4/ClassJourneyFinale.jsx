import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'

/**
 * 6단계: 학급 여정 피날레
 * - 전체 학생 별점 집계 → 여정별 최고·차상위 활동 선정
 * - 학급 여정 타임라인 카드
 * - 마무리 메시지 (기본값 + 교사 직접 편집)
 */

const JOURNEY_COLORS = [
  { phase: 1, label: '첫 번째 여정', sub: '시민 광장', emoji: '🏙️',
    from: 'from-amber-400', to: 'to-yellow-300', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  { phase: 2, label: '두 번째 여정', sub: '선거',      emoji: '🗳️',
    from: 'from-rose-400',  to: 'to-pink-300',   bg: 'bg-rose-50',  border: 'border-rose-300',  text: 'text-rose-800'  },
  { phase: 3, label: '세 번째 여정', sub: '국정 포털', emoji: '🏛️',
    from: 'from-slate-500', to: 'to-blue-400',   bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-800' },
  { phase: 4, label: '네 번째 여정', sub: '시사회',    emoji: '🎬',
    from: 'from-pink-500',  to: 'to-violet-400', bg: 'bg-pink-50',  border: 'border-pink-300',  text: 'text-pink-800'  },
]

const ACTIVITY_LABEL = {
  phase1_essay:      '📝 주장하는 글',
  phase1_poster:     '🖼️ 포스터',
  phase2_candidate:  '🗳️ 후보 등록·공약',
  phase2_support:    '📣 지지 선언문',
  phase2_article:    '📰 선거 기사',
  phase3_bill:       '🏛️ 입법 법안',
  phase3_executive:  '🏢 행정 정책',
  phase3_judicial:   '⚖️ 사법 활동',
  phase3_article:    '📰 국정 기사',
}

function getActivityPhase(key) {
  if (key.startsWith('phase1_')) return 1
  if (key.startsWith('phase2_')) return 2
  if (key.startsWith('phase3_')) return 3
  return 0
}

function getActivityBaseKey(key) {
  // phase1_essay_abc123 → phase1_essay
  const m = key.match(/^(phase\d_[a-z]+)/)
  return m ? m[1] : key
}

function StarBar({ score, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < Math.round(score) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{score.toFixed(1)}</span>
    </div>
  )
}

export default function ClassJourneyFinale() {
  const roomCode   = useGameStore((s) => s.roomCode)
  const role       = useGameStore((s) => s.role)
  const roomData   = useGameStore((s) => s.roomData)
  const students   = useGameStore((s) => s.students)
  const coreIssue  = roomData?.coreIssue || ''
  const countryName = roomData?.config?.countryName || '우리 반'
  const className  = roomData?.className || ''

  const [reflections, setReflections] = useState({})
  const [finaleConfig, setFinaleConfig] = useState(null)
  const [editingMsg, setEditingMsg] = useState(false)
  const [msgDraft, setMsgDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'reflections', (d) => setReflections(d || {})),
      subscribe(roomCode, 'finaleConfig', (d) => setFinaleConfig(d || null)),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  // 학생별 별점 집계 → 활동별 평균
  const activityScores = useMemo(() => {
    const totals = {}   // { activityBaseKey: { sum, count } }
    Object.values(students || {}).forEach((s) => {
      if (!s.journeyRatings) return
      Object.entries(s.journeyRatings).forEach(([key, score]) => {
        if (!score) return
        const base = getActivityBaseKey(key)
        if (!totals[base]) totals[base] = { sum: 0, count: 0 }
        totals[base].sum   += score
        totals[base].count += 1
      })
    })
    return Object.entries(totals)
      .map(([key, { sum, count }]) => ({
        key, avg: sum / count, count,
        label: ACTIVITY_LABEL[key] || key,
        phase: getActivityPhase(key),
      }))
      .sort((a, b) => b.avg - a.avg)
  }, [students])

  // 여정별 TOP 2 활동
  const highlightsByPhase = useMemo(() => {
    const byPhase = { 1: [], 2: [], 3: [] }
    activityScores.forEach((act) => {
      if (byPhase[act.phase]) byPhase[act.phase].push(act)
    })
    return byPhase
  }, [activityScores])

  // 반려되지 않은 정리글 수
  const approvedCount = Object.values(reflections).filter((r) => r.status === 'approved').length

  // 기본 마무리 메시지 생성
  const defaultMessage = useMemo(() => {
    const top1 = activityScores[0]
    const top2 = activityScores[1]
    const highlights = [top1, top2].filter(Boolean).map((a) => a.label).join(', ')
    const issueText = coreIssue ? `"${coreIssue}" 문제를 중심으로 ` : ''
    return `우리 반 ${countryName}(${className})은 ${issueText}${highlights || '다양한 시민 활동'}을 통해 더 나은 나라를 함께 만들었습니다.\n\n앞으로 여러분이 살아갈 이 대한민국에서도 함께 문제들을 슬기롭게 해결하며, 모두가 행복한 나라를 만들어 가길 바랍니다. 🇰🇷`
  }, [activityScores, coreIssue, countryName, className])

  const displayMessage = finaleConfig?.customMessage || defaultMessage

  const startEdit = () => { setMsgDraft(displayMessage); setEditingMsg(true) }
  const saveMessage = async () => {
    setSaving(true)
    await updateAt(roomCode, 'finaleConfig', { customMessage: msgDraft })
    setSaving(false)
    setEditingMsg(false)
  }
  const resetMessage = async () => {
    await updateAt(roomCode, 'finaleConfig', { customMessage: null })
    setEditingMsg(false)
  }

  return (
    <div className="space-y-8">
      {/* 피날레 헤더 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 via-violet-500 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="absolute text-3xl" style={{ top: `${Math.random() * 90}%`, left: `${Math.random() * 90}%` }}>
              {['⭐','🎉','🏆','✨','🌟'][i % 5]}
            </span>
          ))}
        </div>
        <div className="relative z-10 text-center">
          <p className="text-4xl mb-2">🎬</p>
          <h2 className="text-2xl font-black mb-1">우리 반의 여정 마무리</h2>
          <p className="text-pink-100 text-sm">{countryName} · {className}</p>
          {approvedCount > 0 && (
            <p className="mt-2 text-sm font-semibold bg-white/20 inline-block px-3 py-1 rounded-full">
              정리글 {approvedCount}편 완성! 🎊
            </p>
          )}
        </div>
      </div>

      {/* 학급 타임라인 */}
      <section>
        <h3 className="font-black text-gray-800 text-lg mb-4">📅 우리 반 여정 타임라인</h3>
        <div className="relative">
          {/* 연결선 */}
          <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-amber-300 via-rose-300 to-violet-300 hidden md:block" />

          <div className="space-y-6">
            {JOURNEY_COLORS.map(({ phase, label, sub, emoji, bg, border, text, from, to }) => {
              const highlights = (highlightsByPhase[phase] || []).slice(0, 2)

              // 4여정은 정리글 완성 수 표시
              if (phase === 4) {
                return (
                  <div key={phase} className="flex gap-4 items-start">
                    <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center text-xl shadow-lg`}>
                      {emoji}
                    </div>
                    <div className={`flex-1 ${bg} border-2 ${border} rounded-2xl p-4`}>
                      <p className={`font-black text-base ${text}`}>{label} — {sub}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        우리 반 {className} 학생들이 <strong>{approvedCount}편</strong>의 정리글과 카드뉴스를 완성했습니다!
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div key={phase} className="flex gap-4 items-start">
                  <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center text-xl shadow-lg`}>
                    {emoji}
                  </div>
                  <div className={`flex-1 ${bg} border-2 ${border} rounded-2xl p-4 space-y-2`}>
                    <p className={`font-black text-base ${text}`}>{label} — {sub}</p>
                    {phase === 1 && coreIssue && (
                      <p className="text-sm text-gray-700">
                        🎯 최우선 과제: <strong className="text-amber-700">{coreIssue}</strong>
                      </p>
                    )}
                    {highlights.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-gray-500">우리 반 하이라이트 활동</p>
                        {highlights.map((act, i) => (
                          <div key={act.key} className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-3 py-1.5">
                            <span className="text-sm">
                              {i === 0 ? '🥇' : '🥈'} {act.label}
                            </span>
                            <StarBar score={act.avg} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">별점 데이터를 집계 중이에요...</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 마무리 메시지 */}
      <section className="bg-gradient-to-br from-indigo-50 to-pink-50 border-2 border-indigo-200 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-indigo-800 text-lg">💌 마무리 메시지</h3>
          {role === 'teacher' && !editingMsg && (
            <button onClick={startEdit}
              className="text-xs px-3 py-1 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100 font-semibold">
              ✏️ 수정
            </button>
          )}
        </div>

        {editingMsg ? (
          <div className="space-y-3">
            <textarea
              value={msgDraft}
              onChange={(e) => setMsgDraft(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border-2 border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={saveMessage} disabled={saving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-indigo-700">
                {saving ? '저장 중...' : '💾 저장'}
              </button>
              <button onClick={resetMessage}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                기본값
              </button>
              <button onClick={() => setEditingMsg(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                취소
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-base font-medium text-center">
            {displayMessage}
          </p>
        )}

        <div className="text-center text-3xl pt-2">🇰🇷✨</div>
      </section>
    </div>
  )
}
