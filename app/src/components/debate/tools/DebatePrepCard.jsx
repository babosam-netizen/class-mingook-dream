import { useMemo, useState, useEffect, useRef } from 'react'
import useGameStore from '../../../store/gameStore'
import { pushUnder, updateAt } from '../../../lib/rtdb-helpers'
import { DraftSaver } from '../../../lib/draft-saver'
import { STANCE_BG } from './StancePoll'

const getSideLabels = (session) => {
  const type = session?.type || 'general'
  const base = {
    general: { pro: '찬성', con: '반대', evaluator: '평가단' },
    trial: { pro: '검사', con: '변호/피고', evaluator: '배심원' },
    multi_party: { pro: 'A팀', con: 'B팀', evaluator: '평가단' },
    consultative: { pro: '제안측', con: '조율측', evaluator: '관찰자' },
  }[type] || { pro: '찬성', con: '반대', evaluator: '평가단' }
  const labels = { ...base, ...(session?.sideLabelOverrides || {}) }
  Object.entries(session?.extraSides || {}).forEach(([sideId, side]) => {
    labels[sideId] = side?.label || sideId
  })
  return labels
}

const unique = (items) => [...new Set(items.filter(Boolean))]
const CARD_TEXT_LIMIT = 500
const SOURCE_TITLE_LIMIT = 60
const MAX_SOURCE_COUNT = 5
const emptySource = () => ({ title: '', url: '' })

export const normalizeDebatePrepSources = (sources = []) => {
  if (!Array.isArray(sources)) return []
  return sources
    .map((source) => ({
      title: String(source?.title || '').trim(),
      url: String(source?.url || '').trim(),
    }))
    .filter((source) => source.title || source.url)
    .map((source) => ({
      title: source.title || '출처',
      url: source.url,
    }))
}

export const getDebatePrepCardConfig = (session) => {
  const type = session?.type || 'general'
  const labels = getSideLabels(session)
  const sideOptions = unique([
    labels.pro,
    labels.con,
    ...Object.entries(session?.extraSides || {}).map(([, side]) => side?.label),
  ])

  if (type === 'trial') {
    return {
      stances: unique([`${labels.pro} 측`, `${labels.con} 측`, `${labels.evaluator} 관점`, '판단 유보']),
      fields: {
        mainClaim: {
          label: '사건에 대한 판단',
          placeholder: '이 사건은 유죄/무죄라고 생각합니다. 왜냐하면...',
          shortLabel: '판단',
        },
        evidence: {
          label: '증거와 법적 근거',
          placeholder: '그 판단을 뒷받침하는 증거, 법 조항, 증언은...',
          shortLabel: '증거',
        },
        rebuttal: {
          label: '상대 진술의 허점',
          placeholder: '상대측 진술에서 사실과 다르거나 부족한 점은...',
          shortLabel: '상대 허점',
        },
        counterRebuttal: {
          label: '예상 질문과 답변',
          placeholder: '판사나 배심원이 ○○라고 물으면, 우리는 이렇게 답할 수 있습니다...',
          shortLabel: '예상 답변',
        },
      },
    }
  }

  if (type === 'multi_party') {
    return {
      stances: unique([...sideOptions, labels.evaluator, '중립/관찰']),
      fields: {
        mainClaim: {
          label: '우리 팀의 핵심 입장',
          placeholder: '우리 팀은 이 문제에 대해 ○○한 입장입니다. 그 이유는...',
          shortLabel: '팀 입장',
        },
        evidence: {
          label: '우리 팀의 근거와 자료',
          placeholder: '우리 팀의 입장을 뒷받침하는 사례, 자료, 현장 의견은...',
          shortLabel: '근거',
        },
        rebuttal: {
          label: '다른 팀 주장에 대한 반박',
          placeholder: '다른 팀이 주장할 수 있는 내용 중 보완하거나 반박할 점은...',
          shortLabel: '타팀 반박',
        },
        counterRebuttal: {
          label: '협력 또는 대응 전략',
          placeholder: '다른 팀의 질문이나 비판에 대해 우리 팀은 이렇게 대응하겠습니다...',
          shortLabel: '대응 전략',
        },
      },
    }
  }

  if (type === 'consultative') {
    return {
      stances: unique([labels.pro, labels.con, '수정 제안', '합의 가능', '보류/우려']),
      fields: {
        mainClaim: {
          label: '우리의 요구 또는 제안',
          placeholder: '우리가 협의에서 꼭 반영하고 싶은 제안은...',
          shortLabel: '제안',
        },
        evidence: {
          label: '필요한 이유와 근거',
          placeholder: '이 제안이 필요한 이유와 실제 근거는...',
          shortLabel: '필요 이유',
        },
        rebuttal: {
          label: '예상되는 우려와 쟁점',
          placeholder: '상대가 걱정할 수 있는 점이나 충돌할 수 있는 조건은...',
          shortLabel: '우려',
        },
        counterRebuttal: {
          label: '조정안과 양보 가능 지점',
          placeholder: '합의를 위해 조정하거나 양보할 수 있는 부분은...',
          shortLabel: '조정안',
        },
      },
    }
  }

  return {
    stances: ['찬성', '반대', '중립'],
    fields: {
      mainClaim: {
        label: '내 주장',
        placeholder: '나는 ○○해야 한다고 주장합니다. 왜냐하면...',
        shortLabel: '주장',
      },
      evidence: {
        label: '뒷받침하는 근거',
        placeholder: '이를 뒷받침하는 사실, 통계, 사례는...',
        shortLabel: '근거',
      },
      rebuttal: {
        label: '상대측 주장에 대한 반론',
        placeholder: '상대방의 주장에서 논리적으로 부족하거나 잘못된 점은...',
        shortLabel: '상대 반론',
      },
      counterRebuttal: {
        label: '상대측 반론 예상과 우리 팀의 대응',
        placeholder: '상대방이 우리 주장(1번)에 대해 ○○라고 공격할 경우, 우리는...',
        shortLabel: '우리 대응',
      },
    },
  }
}

// 평가단 전용 준비 카드 필드 정의
const EVALUATOR_PREP_FIELDS = {
  viewpoint: {
    label: '살펴볼 핵심 관점',
    placeholder: '어떤 기준으로 토론을 볼 건가요?\n예: 공약의 실현 가능성 중심 / 논거의 논리적 타당성 중심 / 주제(핵심 쟁점) 관련성 중심',
    shortLabel: '관점',
    color: 'violet',
  },
  criteria: {
    label: '나의 평가 기준',
    placeholder: '각 후보를 어떤 기준으로 비교·평가할 건가요?\n예: ① 공약 실현 가능성 ② 근거의 구체성 ③ 발표 태도 ④ 반론 대응력\n각 기준에서 어떤 모습을 높게 평가할지 적어주세요.',
    shortLabel: '기준',
    color: 'blue',
  },
  focus: {
    label: '중점 관찰 사항',
    placeholder: '토론에서 특히 주의 깊게 볼 것은 무엇인가요?\n예: 상대 주장에 대한 반론이 얼마나 구체적인지 / 수치나 사례를 근거로 사용하는지 / 감정적 호소보다 논리적 설명에 집중하는지',
    shortLabel: '관찰',
    color: 'amber',
  },
  prediction: {
    label: '사전 예상 및 이유',
    placeholder: '지금 생각에는 어떤 후보(또는 입장)가 더 설득력 있어 보이나요? 그 이유는 무엇인가요?\n(토론 후 생각이 바뀌면 어떤 점이 달라졌는지도 비교해 볼 수 있어요)',
    shortLabel: '예상',
    color: 'emerald',
  },
}

/**
 * 토론 준비 카드 (학생용).
 * - 입장 + 주장 + 근거 + 반론 대비 3칸 입력
 * - 평가단: 관점·기준·관찰·예상 4칸 입력
 * - 1인 1카드: 이미 제출한 카드가 있으면 수정 모드로 전환
 * - 공개 토글은 교사가 제어 (isPublic). isPublic=false 일 때 다른 학생 카드 미노출.
 *
 * @param {{session, prepCards: PrepCard[], isPublic: boolean, mode: 'edit'|'view'}} props
 */
function DebatePrepCard({ session, prepCards = [], isPublic = false, mode = 'edit' }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const myNumber = useGameStore((s) => s.myNumber)
  const groups = useGameStore((s) => s.groups)

  const myCard = useMemo(
    () => prepCards.find((c) => c.studentId === myStudentId) || null,
    [prepCards, myStudentId],
  )

  const myGroupName = useMemo(() => {
    if (!myStudentId) return ''
    for (const [, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return g.name || ''
    }
    return ''
  }, [groups, myStudentId])

  // 내 진영 찾기
  const mySideId = useMemo(() => {
    if (!session || !myStudentId) return 'none'
    if (session.proStudents?.[myStudentId]) return 'pro'
    if (session.conStudents?.[myStudentId]) return 'con'
    if (session.evaluators?.[myStudentId]) return 'evaluator'
    if (session.extraSides) {
      for (const [sideId, side] of Object.entries(session.extraSides)) {
        if (side?.students?.[myStudentId]) return sideId
      }
    }
    return 'none'
  }, [session, myStudentId])

  const isEvaluator = mySideId === 'evaluator'

  const [stance, setStance] = useState(myCard?.stance || '찬성')
  const [mainClaim, setMainClaim] = useState(myCard?.mainClaim || '')
  const [evidence, setEvidence] = useState(myCard?.evidence || '')
  const [rebuttal, setRebuttal] = useState(myCard?.rebuttal || '')
  const [counterRebuttal, setCounterRebuttal] = useState(myCard?.counterRebuttal || '')
  // 평가단 전용 state
  const [evalViewpoint, setEvalViewpoint] = useState(myCard?.evalViewpoint || '')
  const [evalCriteria, setEvalCriteria] = useState(myCard?.evalCriteria || '')
  const [evalFocus, setEvalFocus] = useState(myCard?.evalFocus || '')
  const [evalPrediction, setEvalPrediction] = useState(myCard?.evalPrediction || '')
  const [sources, setSources] = useState(myCard?.sources?.length ? myCard.sources : [emptySource()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const prepConfig = useMemo(() => getDebatePrepCardConfig(session), [session])
  const STANCES = prepConfig.stances
  const cleanSources = useMemo(() => normalizeDebatePrepSources(sources), [sources])

  const [autoSavedAt, setAutoSavedAt] = useState(null) // 마지막 자동저장 시각
  const autoSaveTimer = useRef(null)

  // 마운트 시 임시저장본 자동 복원 (제출 완료 전이고 내용이 없을 때만)
  useEffect(() => {
    if (myCard) return // 이미 제출했으면 복원 불필요
    const d = DraftSaver.load('debate_prep')
    if (!d?.data) return
    const { stance: s, mainClaim: mc, evidence: ev, rebuttal: rb, counterRebuttal: cr, sources: src,
            evalViewpoint: evp, evalCriteria: evc, evalFocus: evf, evalPrediction: evpr } = d.data
    if (mc || ev || rb || cr || evp || evc) {
      if (s) setStance(s)
      setMainClaim(mc || '')
      setEvidence(ev || '')
      setRebuttal(rb || '')
      setCounterRebuttal(cr || '')
      setSources(Array.isArray(src) && src.length ? src : [emptySource()])
      if (evp) setEvalViewpoint(evp)
      if (evc) setEvalCriteria(evc)
      if (evf) setEvalFocus(evf)
      if (evpr) setEvalPrediction(evpr)
      setAutoSavedAt(d.timestamp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 마운트 1회만

  // 필드 변경 시 1.5초 디바운스 자동저장
  useEffect(() => {
    if (myCard) return // 제출 완료 후엔 저장 불필요
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      DraftSaver.save('debate_prep', {
        stance, mainClaim, evidence, rebuttal, counterRebuttal, sources,
        evalViewpoint, evalCriteria, evalFocus, evalPrediction,
      })
      setAutoSavedAt(Date.now())
    }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [stance, mainClaim, evidence, rebuttal, counterRebuttal, sources,
      evalViewpoint, evalCriteria, evalFocus, evalPrediction, myCard])

  useEffect(() => {
    if (!STANCES.includes(stance)) {
      setStance(myCard?.stance && STANCES.includes(myCard.stance) ? myCard.stance : STANCES[0])
    }
  }, [STANCES, stance, myCard?.stance])

  const updateSource = (index, patch) => {
    setSources((prev) => prev.map((source, sourceIndex) => (
      sourceIndex === index ? { ...source, ...patch } : source
    )))
  }

  const addSource = () => {
    setSources((prev) => (prev.length >= MAX_SOURCE_COUNT ? prev : [...prev, emptySource()]))
  }

  const removeSource = (index) => {
    setSources((prev) => (prev.length <= 1 ? [emptySource()] : prev.filter((_, sourceIndex) => sourceIndex !== index)))
  }

  const validEvaluator =
    evalViewpoint.trim().length > 0 && evalCriteria.trim().length > 0

  const valid = isEvaluator
    ? validEvaluator
    : (mainClaim.trim() && evidence.trim() && rebuttal.trim() && counterRebuttal.trim() &&
       mainClaim.length <= CARD_TEXT_LIMIT &&
       evidence.length <= CARD_TEXT_LIMIT &&
       rebuttal.length <= CARD_TEXT_LIMIT &&
       counterRebuttal.length <= CARD_TEXT_LIMIT)

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      const payload = isEvaluator
        ? {
            studentId: myStudentId,
            studentName: myNickname,
            studentNumber: Number(myNumber) || null,
            groupName: myGroupName,
            stance: '평가단',
            isEvaluatorCard: true,
            evalViewpoint: evalViewpoint.trim(),
            evalCriteria: evalCriteria.trim(),
            evalFocus: evalFocus.trim(),
            evalPrediction: evalPrediction.trim(),
            createdAt: myCard?.createdAt || Date.now(),
          }
        : {
            studentId: myStudentId,
            studentName: myNickname,
            studentNumber: Number(myNumber) || null,
            groupName: myGroupName,
            stance,
            mainClaim: mainClaim.trim(),
            evidence: evidence.trim(),
            rebuttal: rebuttal.trim(),
            counterRebuttal: counterRebuttal.trim(),
            sources: cleanSources,
            createdAt: myCard?.createdAt || Date.now(),
          }
      if (myCard?.id) {
        await updateAt(roomCode, `debateSessions/${session.id}/prepCards/${myCard.id}`, payload)
      } else {
        await pushUnder(roomCode, `debateSessions/${session.id}/prepCards`, payload)
      }
      DraftSaver.clear('debate_prep')
      setAutoSavedAt(null)
    } catch (err) {
      setError(err.message || '제출 실패')
    } finally {
      setBusy(false)
    }
  }

  // 가시성 필터링된 카드 목록
  const visibleCards = useMemo(() => {
    return prepCards.filter((c) => {
      if (isPublic) return true
      if (c.studentId === myStudentId) return true

      // 상대방 진영 판별
      let sideId = 'none'
      if (session.proStudents?.[c.studentId]) sideId = 'pro'
      else if (session.conStudents?.[c.studentId]) sideId = 'con'
      else if (session.evaluators?.[c.studentId]) sideId = 'evaluator'
      else if (session.extraSides) {
        for (const [sid, side] of Object.entries(session.extraSides)) {
          if (side?.students?.[c.studentId]) { sideId = sid; break; }
        }
      }

      // 같은 진영이면 노출
      return sideId !== 'none' && sideId === mySideId
    })
  }, [prepCards, isPublic, myStudentId, mySideId, session])

  const isStudent = role === 'student'
  const ITEMS_PER_PAGE = mode === 'view' ? 999 : 4
  const totalPages = Math.max(1, Math.ceil(visibleCards.length / ITEMS_PER_PAGE))
  const paginatedCards = visibleCards.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      {/* 학생 본인 입력 폼 */}
      {isStudent && mode === 'edit' && (
        <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-5 space-y-4 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300"></div>
          <div className="flex items-center justify-between">
            <h3 className="font-black text-amber-800 flex items-center gap-2">
              <span className="bg-amber-100 p-1.5 rounded-lg text-lg">📝</span>
              토론 준비 카드 작성
            </h3>
            <div className="flex gap-1 items-center">
              {!myCard && autoSavedAt && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-400 font-bold">
                  💾 자동저장됨
                </span>
              )}
              {myCard && (
                <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-500 text-white font-black shadow-sm">
                  제출 완료
                </span>
              )}
            </div>
          </div>

          {/* 소속 + 역할 표시 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-bold">
              {myGroupName || '시민단체 미가입'}
            </span>
            {isEvaluator && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-bold border border-violet-200">
                ⚖️ 평가단 카드
              </span>
            )}
          </div>

          {/* 평가단 전용 폼 */}
          {isEvaluator ? (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-700 border border-violet-200">
                평가단은 어느 한 편을 들지 않고, 공정한 관점에서 후보들의 주장과 근거를 평가합니다. 아래 항목을 작성해 토론 중 집중할 부분을 미리 정해 두세요.
              </div>
              {Object.entries(EVALUATOR_PREP_FIELDS).map(([key, field], idx) => {
                const colorMap = {
                  violet: { label: 'text-violet-700', border: 'focus:border-violet-400', num: 'bg-violet-600' },
                  blue:   { label: 'text-blue-700',   border: 'focus:border-blue-400',   num: 'bg-blue-600' },
                  amber:  { label: 'text-amber-700',  border: 'focus:border-amber-400',  num: 'bg-amber-600' },
                  emerald:{ label: 'text-emerald-700',border: 'focus:border-emerald-400',num: 'bg-emerald-600' },
                }[field.color] || {}
                const vals = { viewpoint: evalViewpoint, criteria: evalCriteria, focus: evalFocus, prediction: evalPrediction }
                const setters = { viewpoint: setEvalViewpoint, criteria: setEvalCriteria, focus: setEvalFocus, prediction: setEvalPrediction }
                return (
                  <div key={key}>
                    <label className={`text-[11px] font-black mb-1 flex items-center gap-1 ${colorMap.label}`}>
                      <span className={`w-4 h-4 ${colorMap.num} text-white rounded-full flex items-center justify-center text-[10px]`}>{idx + 1}</span>
                      {field.label}
                    </label>
                    <textarea
                      value={vals[key]}
                      onChange={(e) => setters[key](e.target.value)}
                      maxLength={CARD_TEXT_LIMIT}
                      rows={3}
                      placeholder={field.placeholder}
                      className={`w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:outline-none transition-all resize-none leading-relaxed ${colorMap.border}`}
                    />
                    <p className="text-[10px] text-gray-400 text-right mt-0.5 font-mono">{vals[key].length}/{CARD_TEXT_LIMIT}</p>
                  </div>
                )
              })}
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="text-[11px] font-black text-gray-500 mb-1 block">내 입장</label>
              <select
                value={stance}
                onChange={(e) => setStance(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-amber-400 focus:outline-none transition-all font-bold"
              >
                {STANCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-4">
            <div className="group">
              <label className="text-[11px] font-black text-amber-700 mb-1 block flex items-center gap-1">
                <span className="w-4 h-4 bg-amber-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                {prepConfig.fields.mainClaim.label}
              </label>
              <textarea
                value={mainClaim}
                onChange={(e) => setMainClaim(e.target.value)}
                maxLength={CARD_TEXT_LIMIT}
                rows={3}
                placeholder={prepConfig.fields.mainClaim.placeholder}
                className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-amber-400 focus:outline-none transition-all resize-none leading-relaxed"
              />
              <p className="text-[10px] text-gray-400 text-right mt-1 font-mono">{mainClaim.length}/{CARD_TEXT_LIMIT}</p>
            </div>

            <div className="group">
              <label className="text-[11px] font-black text-blue-700 mb-1 block flex items-center gap-1">
                <span className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                {prepConfig.fields.evidence.label}
              </label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                maxLength={CARD_TEXT_LIMIT}
                rows={3}
                placeholder={prepConfig.fields.evidence.placeholder}
                className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all resize-none leading-relaxed"
              />
              <p className="text-[10px] text-gray-400 text-right mt-1 font-mono">{evidence.length}/{CARD_TEXT_LIMIT}</p>
            </div>

            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-black text-blue-800">출처</p>
                  <p className="text-[10px] text-blue-500">간략한 제목과 링크를 함께 적어 주세요. 선택 입력입니다.</p>
                </div>
                <button
                  type="button"
                  onClick={addSource}
                  disabled={sources.length >= MAX_SOURCE_COUNT}
                  className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-black hover:bg-blue-700 disabled:opacity-40"
                >
                  + 출처 추가
                </button>
              </div>
              <div className="space-y-2">
                {sources.map((source, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={source.title}
                      onChange={(e) => updateSource(index, { title: e.target.value })}
                      maxLength={SOURCE_TITLE_LIMIT}
                      placeholder="출처 제목 예: 환경부 통계"
                      className="w-full px-3 py-2 text-xs rounded-xl border-2 border-blue-100 bg-white focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="url"
                      value={source.url}
                      onChange={(e) => updateSource(index, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-xs rounded-xl border-2 border-blue-100 bg-white focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeSource(index)}
                      className="w-full sm:w-auto px-3 py-2 text-[10px] rounded-xl border border-blue-100 bg-white text-blue-500 font-bold hover:bg-blue-100"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="group">
              <label className="text-[11px] font-black text-rose-700 mb-1 block flex items-center gap-1">
                <span className="w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                {prepConfig.fields.rebuttal.label}
              </label>
              <textarea
                value={rebuttal}
                onChange={(e) => setRebuttal(e.target.value)}
                maxLength={CARD_TEXT_LIMIT}
                rows={3}
                placeholder={prepConfig.fields.rebuttal.placeholder}
                className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-rose-400 focus:outline-none transition-all resize-none leading-relaxed"
              />
              <p className="text-[10px] text-gray-400 text-right mt-1 font-mono">{rebuttal.length}/{CARD_TEXT_LIMIT}</p>
            </div>

            <div className="group">
              <label className="text-[11px] font-black text-purple-700 mb-1 block flex items-center gap-1">
                <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px]">4</span>
                {prepConfig.fields.counterRebuttal.label}
              </label>
              <textarea
                value={counterRebuttal}
                onChange={(e) => setCounterRebuttal(e.target.value)}
                maxLength={CARD_TEXT_LIMIT}
                rows={3}
                placeholder={prepConfig.fields.counterRebuttal.placeholder}
                className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-purple-400 focus:outline-none transition-all resize-none leading-relaxed"
              />
              <p className="text-[10px] text-gray-400 text-right mt-1 font-mono">{counterRebuttal.length}/{CARD_TEXT_LIMIT}</p>
            </div>
          </div>
          </>
          )} {/* end 일반 폼 분기 */}

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 animate-pulse">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black shadow-lg hover:shadow-amber-200 transition-all disabled:opacity-30 disabled:shadow-none active:scale-95"
          >
            {busy ? '카드 저장 중...' : myCard ? '✨ 카드 수정 저장하기' : '🚀 토론 준비 카드 제출'}
          </button>
        </div>
      )}

      {/* 친구들 카드 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-gray-600 flex items-center gap-2">
            {mode === 'view' ? '📑 우리가 작성한 토론카드' : (isPublic ? '📋 전체 공개된 카드' : '📋 우리 진영 친구들의 카드')}
            <span className="bg-white px-2 py-0.5 rounded-full border text-[10px] text-indigo-600">{visibleCards.length}장</span>
          </h3>
          {mode === 'edit' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white border shadow-sm disabled:opacity-30"
              >
                ◀
              </button>
              <span className="text-[10px] font-black text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white border shadow-sm disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {visibleCards.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-10 flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-3xl">📭</span>
            <p className="text-xs font-bold">아직 볼 수 있는 카드가 없어요.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {paginatedCards.map((c) => {
              const stanceCls = STANCE_BG[c.stance] || 'bg-gray-50 text-gray-700 border-gray-300'
              const mine = c.studentId === myStudentId
              const cardSources = normalizeDebatePrepSources(c.sources)
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl p-4 text-xs space-y-2.5 border-2 transition-all shadow-sm hover:shadow-md ${
                    mine ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border-2 ${stanceCls}`}>
                      {c.stance}
                    </span>
                    <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                      {c.studentNumber ? `${c.studentNumber}번 ` : ''}{c.studentName}
                      {mine && ' (나)'}
                    </span>
                  </div>
                  {c.isEvaluatorCard ? (
                    /* 평가단 카드 표시 */
                    <div className="space-y-1.5">
                      {c.evalViewpoint && (
                        <div className="bg-violet-50/60 p-2 rounded-xl">
                          <p className="leading-relaxed"><b className="text-violet-800 text-[10px] mr-1">관점</b> {c.evalViewpoint}</p>
                        </div>
                      )}
                      {c.evalCriteria && (
                        <div className="bg-blue-50/60 p-2 rounded-xl">
                          <p className="leading-relaxed text-gray-700"><b className="text-blue-800 text-[10px] mr-1">기준</b> {c.evalCriteria}</p>
                        </div>
                      )}
                      {c.evalFocus && (
                        <div className="bg-amber-50/60 p-2 rounded-xl">
                          <p className="leading-relaxed text-gray-700"><b className="text-amber-800 text-[10px] mr-1">관찰</b> {c.evalFocus}</p>
                        </div>
                      )}
                      {c.evalPrediction && (
                        <div className="bg-emerald-50/60 p-2 rounded-xl">
                          <p className="leading-relaxed text-gray-700"><b className="text-emerald-800 text-[10px] mr-1">예상</b> {c.evalPrediction}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="space-y-1.5">
                    <div className="bg-amber-50/50 p-2 rounded-xl">
                      <p className="leading-relaxed"><b className="text-amber-800 text-[10px] uppercase mr-1">{prepConfig.fields.mainClaim.shortLabel}</b> {c.mainClaim}</p>
                    </div>
                    <div className="bg-blue-50/50 p-2 rounded-xl">
                      <p className="leading-relaxed text-gray-700"><b className="text-blue-800 text-[10px] uppercase mr-1">{prepConfig.fields.evidence.shortLabel}</b> {c.evidence}</p>
                    </div>
                    {cardSources.length > 0 && (
                      <div className="bg-sky-50/70 p-2 rounded-xl border border-sky-100">
                        <p className="text-sky-800 text-[10px] font-black mb-1">출처</p>
                        <div className="space-y-1">
                          {cardSources.map((source, sourceIndex) => (
                            source.url ? (
                              <a
                                key={`${source.title}-${sourceIndex}`}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] text-sky-700 underline break-all"
                              >
                                {source.title}
                              </a>
                            ) : (
                              <p key={`${source.title}-${sourceIndex}`} className="text-[10px] text-sky-700 break-all">{source.title}</p>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-rose-50/50 p-2 rounded-xl">
                      <p className="leading-relaxed text-gray-700"><b className="text-rose-800 text-[10px] uppercase mr-1">{prepConfig.fields.rebuttal.shortLabel}</b> {c.rebuttal || '(내용 없음)'}</p>
                    </div>
                    <div className="bg-purple-50/50 p-2 rounded-xl">
                      <p className="leading-relaxed text-gray-700"><b className="text-purple-800 text-[10px] uppercase mr-1">{prepConfig.fields.counterRebuttal.shortLabel}</b> {c.counterRebuttal}</p>
                    </div>
                  </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DebatePrepCard
