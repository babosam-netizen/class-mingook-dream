import { useEffect, useState, useRef, useCallback } from 'react'
import useGameStore from '../../store/gameStore'
import { getOnce, pushUnder, updateAt } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

export { COLORS as REFLECTION_COLORS }

const COLORS = [
  { id: 'yellow', cls: 'bg-yellow-100 border-yellow-300 text-yellow-800', label: '노랑' },
  { id: 'pink',   cls: 'bg-pink-100 border-pink-300 text-pink-800',     label: '핑크' },
  { id: 'sky',    cls: 'bg-sky-100 border-sky-300 text-sky-800',       label: '하늘' },
  { id: 'lime',   cls: 'bg-lime-100 border-lime-300 text-lime-800',     label: '연두' },
  { id: 'violet', cls: 'bg-violet-100 border-violet-300 text-violet-800', label: '보라' },
  { id: 'amber',  cls: 'bg-amber-100 border-amber-300 text-amber-800',   label: '주황' },
]

// 문장에 [사실]/[의견] 태그 토글 버튼 - 복수 체크 허용 (쉼표 구분)
function SentenceTagButton({ value = '', onChange }) {
  const tags = value ? value.split(',') : []
  const isFact = tags.includes('fact')
  const isOpinion = tags.includes('opinion')

  const handleToggle = (type) => {
    let nextTags = [...tags]
    if (nextTags.includes(type)) {
      nextTags = nextTags.filter(t => t !== type)
    } else {
      nextTags.push(type)
    }
    onChange(nextTags.filter(Boolean).join(','))
  }

  return (
    <div className="flex gap-2 mt-1.5">
      <button
        type="button"
        onClick={() => handleToggle('fact')}
        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 ${
          isFact 
            ? 'bg-blue-600 text-white shadow-sm scale-105' 
            : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
        }`}
      >
        📊 사실
      </button>
      <button
        type="button"
        onClick={() => handleToggle('opinion')}
        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 ${
          isOpinion 
            ? 'bg-orange-600 text-white shadow-sm scale-105' 
            : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
        }`}
      >
        💬 의견
      </button>
    </div>
  )
}

// 단락 에디터: 중심문장 + 뒷받침문장 2개
function ParagraphEditor({ 
  title, 
  accent, 
  outlineCard, 
  mainSentence, setMain, mainTag, setMainTag, 
  supportA, setSupportA, supportATag, setSupportATag, 
  supportB, setSupportB, supportBTag, setSupportBTag 
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 space-y-4 shadow-sm transition-all duration-300 ${accent}`}>
      <div className="flex items-center justify-between border-b pb-2">
        <p className="font-bold text-base text-gray-800">{title}</p>
      </div>

      {/* 상위 개요 카드 노출 */}
      {outlineCard && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-gray-200 shadow-inner">
          <p className="text-xs font-bold text-gray-500 mb-1">📋 내가 세운 개요</p>
          <p className="text-sm text-gray-700 italic font-medium">"{outlineCard}"</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">중심 문장 (이 단락의 핵심 주장)</label>
          <textarea
            value={mainSentence}
            onChange={(e) => setMain(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="한 문장으로 핵심을 분명하게 쓰세요."
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition resize-none"
          />
          <SentenceTagButton value={mainTag} onChange={setMainTag} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">뒷받침 문장 ①</label>
          <textarea
            value={supportA}
            onChange={(e) => setSupportA(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="중심 문장을 구체적인 사실이나 경험으로 뒷받침해 주세요."
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition resize-none"
          />
          <SentenceTagButton value={supportATag} onChange={setSupportATag} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">뒷받침 문장 ②</label>
          <textarea
            value={supportB}
            onChange={(e) => setSupportB(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="또 다른 근거나 사례를 추가해 주세요. (선택)"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition resize-none"
          />
          <SentenceTagButton value={supportBTag} onChange={setSupportBTag} />
        </div>
      </div>
    </div>
  )
}

/**
 * 3단계: 구조적 정리글 작성 에디터 (대개편)
 * - 탭 구분 상태 관리 (activeTab: 1~5)
 * - 저장 시 reflections 컬렉션에 status: 'writing' 임시저장
 * - 5단계: 최종본 작성하기 (글 제목, 에세이, 카드 색상, 비공개)
 * - 모두 불러오기 기능
 * - 오토사이징 본문 textarea
 * - 자가 진단 및 3점 척도 평가 모달
 */
export default function ReflectionStructuredEditor({ existingReflection, onEditDone }) {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber    = useGameStore((s) => s.myNumber)
  const myNickname  = useGameStore((s) => s.myNickname)

  const isEdit = !!existingReflection
  const existing = existingReflection || {}

  // Firebase 키 관리
  const [tempId, setTempId] = useState(existing.id || null)

  // 탭 상태 (1:개요, 2:도입, 3:전개, 4:마무리, 5:최종글)
  const [activeTab, setActiveTab] = useState(existing.progressStep || 1)

  // 캔바 미리보기
  const [canvaUrl, setCanvaUrlLocal] = useState('')
  const [showCanva, setShowCanva] = useState(false)

  // 5단계 최종 설정
  const [title,     setTitle]     = useState(existing.title     || '')
  const [color,     setColor]     = useState(existing.color     || 'yellow')

  // 개요
  const [intro,      setIntro]      = useState(existing.outline?.intro      || '')
  const [body,       setBody]       = useState(existing.outline?.body       || '')
  const [conclusion, setConclusion] = useState(existing.outline?.conclusion || '')

  // 단락 1 (도입)
  const [p1Main,       setP1Main]       = useState(existing.p1?.main       || '')
  const [p1MainTag,    setP1MainTag]    = useState(existing.p1?.mainTag    || '')
  const [p1SupportA,   setP1SupportA]   = useState(existing.p1?.supportA   || '')
  const [p1SupportATag,setP1SupportATag]= useState(existing.p1?.supportATag|| '')
  const [p1SupportB,   setP1SupportB]   = useState(existing.p1?.supportB   || '')
  const [p1SupportBTag,setP1SupportBTag]= useState(existing.p1?.supportBTag|| '')

  // 단락 2 (전개)
  const [p2Main,       setP2Main]       = useState(existing.p2?.main       || '')
  const [p2MainTag,    setP2MainTag]    = useState(existing.p2?.mainTag    || '')
  const [p2SupportA,   setP2SupportA]   = useState(existing.p2?.supportA   || '')
  const [p2SupportATag,setP2SupportATag]= useState(existing.p2?.supportATag|| '')
  const [p2SupportB,   setP2SupportB]   = useState(existing.p2?.supportB   || '')
  const [p2SupportBTag,setP2SupportBTag]= useState(existing.p2?.supportBTag|| '')

  // 단락 3 (마무리)
  const [p3Main,       setP3Main]       = useState(existing.p3?.main       || '')
  const [p3MainTag,    setP3MainTag]    = useState(existing.p3?.mainTag    || '')
  const [p3SupportA,   setP3SupportA]   = useState(existing.p3?.supportA   || '')
  const [p3SupportATag,setP3SupportATag]= useState(existing.p3?.supportATag|| '')
  const [p3SupportB,   setP3SupportB]   = useState(existing.p3?.supportB   || '')
  const [p3SupportBTag,setP3SupportBTag]= useState(existing.p3?.supportBTag|| '')

  // 최종본
  const [finalEssay, setFinalEssay] = useState(existing.finalEssay || '')

  // 모달 상태
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selfCheck, setSelfCheck] = useState(false)
  const [score1, setScore1] = useState(0) // 글의 짜임새
  const [score2, setScore2] = useState(0) // 사실/의견 구분
  const [score3, setScore3] = useState(0) // 주장/근거 타당성
  const [hasWarning, setHasWarning] = useState(false)

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [error, setError] = useState('')

  const textareaRef = useRef(null)

  // 최신 상태값을 ref로 추적 — 언마운트/타이머 콜백에서 stale 클로저 방지
  const stateRef = useRef({})
  useEffect(() => {
    stateRef.current = {
      title, color, intro, body, conclusion,
      p1Main, p1MainTag, p1SupportA, p1SupportATag, p1SupportB, p1SupportBTag,
      p2Main, p2MainTag, p2SupportA, p2SupportATag, p2SupportB, p2SupportBTag,
      p3Main, p3MainTag, p3SupportA, p3SupportATag, p3SupportB, p3SupportBTag,
      finalEssay, activeTab,
    }
  })

  // roomCode/myStudentId ref — 언마운트 시 최신 값 참조용
  const roomCodeRef = useRef(roomCode)
  const myStudentIdRef = useRef(myStudentId)
  const myNumberRef = useRef(myNumber)
  const myNicknameRef = useRef(myNickname)
  const tempIdRef = useRef(tempId)
  // 서버에 저장된 현재 상태 추적 — 임시저장/언마운트 자동저장이 제출·승인 상태를
  // 실수로 'writing'으로 되돌리지 않도록 보존한다. Firebase 구독으로 상태가 바뀌면 동기화.
  const serverStatusRef = useRef(existing.status || null)
  useEffect(() => { roomCodeRef.current = roomCode }, [roomCode])
  useEffect(() => { myStudentIdRef.current = myStudentId }, [myStudentId])
  useEffect(() => { myNumberRef.current = myNumber }, [myNumber])
  useEffect(() => { myNicknameRef.current = myNickname }, [myNickname])
  useEffect(() => { tempIdRef.current = tempId }, [tempId])
  useEffect(() => {
    if (existingReflection?.status) serverStatusRef.current = existingReflection.status
  }, [existingReflection?.status])

  // 본문 오토사이징
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [finalEssay, activeTab])

  // 내 캔바 URL 로드
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}/canvaCardNewsUrl`).then((url) => {
      if (url) setCanvaUrlLocal(formatCanvaEmbedUrl(url))
    })
  }, [roomCode, myStudentId])

  // ── 헬퍼: r(Firebase 레코드 또는 localStorage 파싱 객체)로 state 일괄 복원
  const applyRecord = useCallback((id, r) => {
    if (id) setTempId(id)
    if (r.progressStep) setActiveTab(r.progressStep)
    if (r.title)        setTitle(r.title)
    if (r.color)        setColor(r.color)
    if (r.outline?.intro)      setIntro(r.outline.intro)
    if (r.outline?.body)       setBody(r.outline.body)
    if (r.outline?.conclusion) setConclusion(r.outline.conclusion)
    if (r.p1?.main)        setP1Main(r.p1.main)
    if (r.p1?.mainTag)     setP1MainTag(r.p1.mainTag)
    if (r.p1?.supportA)    setP1SupportA(r.p1.supportA)
    if (r.p1?.supportATag) setP1SupportATag(r.p1.supportATag)
    if (r.p1?.supportB)    setP1SupportB(r.p1.supportB)
    if (r.p1?.supportBTag) setP1SupportBTag(r.p1.supportBTag)
    if (r.p2?.main)        setP2Main(r.p2.main)
    if (r.p2?.mainTag)     setP2MainTag(r.p2.mainTag)
    if (r.p2?.supportA)    setP2SupportA(r.p2.supportA)
    if (r.p2?.supportATag) setP2SupportATag(r.p2.supportATag)
    if (r.p2?.supportB)    setP2SupportB(r.p2.supportB)
    if (r.p2?.supportBTag) setP2SupportBTag(r.p2.supportBTag)
    if (r.p3?.main)        setP3Main(r.p3.main)
    if (r.p3?.mainTag)     setP3MainTag(r.p3.mainTag)
    if (r.p3?.supportA)    setP3SupportA(r.p3.supportA)
    if (r.p3?.supportATag) setP3SupportATag(r.p3.supportATag)
    if (r.p3?.supportB)    setP3SupportB(r.p3.supportB)
    if (r.p3?.supportBTag) setP3SupportBTag(r.p3.supportBTag)
    if (r.finalEssay)      setFinalEssay(r.finalEssay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마운트 시 복원:
  //   - existingReflection(Firebase)과 localStorage를 타임스탬프 비교
  //   - localStorage가 더 최신이면 localStorage로 덮어씀 (새로고침 직전 미저장분 복구)
  //   - existingReflection이 없으면 Firebase 직접 조회 후 동일 비교
  const hasLoadedFromDB = useRef(false)
  useEffect(() => {
    if (hasLoadedFromDB.current) return
    if (!roomCode || !myStudentId) return
    hasLoadedFromDB.current = true

    const lKey = `reflection_draft_${myStudentId}`
    let localData = null
    let localTs = 0
    try {
      const raw = localStorage.getItem(lKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        localTs = parsed.savedAt || 0
        localData = parsed
      }
    } catch {/* 무시 */}

    if (existing && existing.id) {
      // existingReflection이 이미 있음 (Firebase 구독에서 내려온 데이터)
      // → localStorage와 타임스탬프 비교하여 더 최신을 사용
      const dbTs = existing.updatedAt || existing.createdAt || 0
      if (localData && localTs > dbTs) {
        // 새로고침 직전 입력분이 localStorage에만 남아있는 경우
        applyRecord(localData.tempId || existing.id, localData)
      }
      // dbTs >= localTs 면 existingReflection으로 초기화된 상태 그대로 유지
      return
    }

    // existingReflection 없음 → localStorage 즉시 복원 후 Firebase에서 최신 확인
    if (localData) {
      applyRecord(localData.tempId || null, localData)
    }

    getOnce(roomCode, 'reflections').then((all) => {
      if (!all) return
      const myEntry = Object.entries(all).find(
        ([, r]) => r.authorStudentId === myStudentId
      )
      if (!myEntry) return
      const [id, r] = myEntry
      const dbTs = r.updatedAt || r.createdAt || 0
      if (dbTs >= localTs) {
        applyRecord(id, r)
      } else {
        setTempId(id) // localStorage가 더 최신 — Firebase 키만 동기화
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myStudentId])

  const buildPayload = () => ({
    title: title.trim(),
    color,
    isPrivate: false,
    canvaUrl: canvaUrl || '',
    outline: { intro: intro.trim(), body: body.trim(), conclusion: conclusion.trim() },
    p1: { main: p1Main.trim(), mainTag: p1MainTag, supportA: p1SupportA.trim(), supportATag: p1SupportATag, supportB: p1SupportB.trim(), supportBTag: p1SupportBTag },
    p2: { main: p2Main.trim(), mainTag: p2MainTag, supportA: p2SupportA.trim(), supportATag: p2SupportATag, supportB: p2SupportB.trim(), supportBTag: p2SupportBTag },
    p3: { main: p3Main.trim(), mainTag: p3MainTag, supportA: p3SupportA.trim(), supportATag: p3SupportATag, supportB: p3SupportB.trim(), supportBTag: p3SupportBTag },
    finalEssay: finalEssay.trim(),
    // 하위 호환 필드
    participation: intro.trim(),
    feelings:      p1Main.trim(),
    mostImpressive:p2Main.trim(),
    newLearnings:  p2SupportA.trim(),
    pledge:        p3Main.trim(),
    impressive:    p2Main.trim(),
    revisit:       p1Main.trim(),
  })

  // ── localStorage 백업 키
  const localKey = myStudentId ? `reflection_draft_${myStudentId}` : null

  // localStorage에 현재 상태 백업
  const saveToLocal = useCallback(() => {
    if (!localKey) return
    const s = stateRef.current
    try {
      localStorage.setItem(localKey, JSON.stringify({
        tempId: tempIdRef.current,
        savedAt: Date.now(),
        ...s,
      }))
    } catch {/* 용량 초과 등 무시 */}
  }, [localKey])

  // 임시 저장 처리 (Firebase)
  const saveDraft = useCallback(async (stepToSave) => {
    const rc = roomCodeRef.current
    const sid = myStudentIdRef.current
    if (!rc || !sid) return
    const s = stateRef.current
    const tid = tempIdRef.current
    // 이미 제출(pending)·승인(approved)된 글은 임시저장이 상태를 낮추지 않도록 보존.
    // (그 외 신규/작성중/반려 상태는 'writing'으로 임시저장)
    const keepStatus = serverStatusRef.current
    const draftStatus = (keepStatus === 'approved' || keepStatus === 'pending') ? keepStatus : 'writing'
    const payload = {
      title: (s.title || '').trim(),
      color: s.color || 'yellow',
      isPrivate: false,
      canvaUrl: canvaUrl || '',
      outline: {
        intro: (s.intro || '').trim(),
        body: (s.body || '').trim(),
        conclusion: (s.conclusion || '').trim(),
      },
      p1: {
        main: (s.p1Main || '').trim(), mainTag: s.p1MainTag || '',
        supportA: (s.p1SupportA || '').trim(), supportATag: s.p1SupportATag || '',
        supportB: (s.p1SupportB || '').trim(), supportBTag: s.p1SupportBTag || '',
      },
      p2: {
        main: (s.p2Main || '').trim(), mainTag: s.p2MainTag || '',
        supportA: (s.p2SupportA || '').trim(), supportATag: s.p2SupportATag || '',
        supportB: (s.p2SupportB || '').trim(), supportBTag: s.p2SupportBTag || '',
      },
      p3: {
        main: (s.p3Main || '').trim(), mainTag: s.p3MainTag || '',
        supportA: (s.p3SupportA || '').trim(), supportATag: s.p3SupportATag || '',
        supportB: (s.p3SupportB || '').trim(), supportBTag: s.p3SupportBTag || '',
      },
      finalEssay: (s.finalEssay || '').trim(),
      participation: (s.intro || '').trim(),
      feelings: (s.p1Main || '').trim(),
      mostImpressive: (s.p2Main || '').trim(),
      newLearnings: (s.p2SupportA || '').trim(),
      pledge: (s.p3Main || '').trim(),
      impressive: (s.p2Main || '').trim(),
      revisit: (s.p1Main || '').trim(),
      progressStep: stepToSave ?? (s.activeTab || 1),
      status: draftStatus,
      updatedAt: Date.now(),
    }
    // localStorage에도 백업
    saveToLocal()
    try {
      if (tid) {
        await updateAt(rc, `reflections/${tid}`, payload)
      } else {
        const newKey = await pushUnder(rc, 'reflections', {
          ...payload,
          authorStudentId: sid,
          authorNumber: myNumberRef.current,
          authorNickname: myNicknameRef.current,
          createdAt: Date.now(),
          empathy: { heart: 0, clap: 0, lightbulb: 0, thumbsup: 0 },
        })
        setTempId(newKey)
        tempIdRef.current = newKey
        serverStatusRef.current = draftStatus
        // localStorage 백업에 새 키 반영
        if (localKey) {
          try {
            const raw = localStorage.getItem(localKey)
            if (raw) {
              const parsed = JSON.parse(raw)
              localStorage.setItem(localKey, JSON.stringify({ ...parsed, tempId: newKey }))
            }
          } catch {/* 무시 */}
        }
      }
      return true
    } catch (err) {
      console.warn('[ReflectionEditor] 임시저장 오류:', err.message)
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvaUrl, localKey, saveToLocal])

  // UI용 saveDraft 래퍼 (버튼 클릭 등에서 사용)
  const saveDraftUI = async (stepToSave) => {
    if (!roomCode || !myStudentId) return
    setBusy(true)
    setError('')
    try {
      const ok = await saveDraft(stepToSave)
      if (ok !== false) {
        setSaveDone(true)
        setTimeout(() => setSaveDone(false), 1500)
      } else {
        setError('임시 저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setBusy(false)
    }
  }

  // ── debounced 자동 저장 (2초 유휴 후)
  const autoSaveTimerRef = useRef(null)
  useEffect(() => {
    // 아직 방/학생 정보가 없으면 스킵
    if (!roomCode || !myStudentId) return
    // 제출 완료 상태면 자동저장 안 함
    if (done) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft(activeTab).then((ok) => {
        if (ok !== false) {
          setSaveDone(true)
          setTimeout(() => setSaveDone(false), 1200)
        }
      })
    }, 2000)
    return () => clearTimeout(autoSaveTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title, color, intro, body, conclusion,
    p1Main, p1MainTag, p1SupportA, p1SupportATag, p1SupportB, p1SupportBTag,
    p2Main, p2MainTag, p2SupportA, p2SupportATag, p2SupportB, p2SupportBTag,
    p3Main, p3MainTag, p3SupportA, p3SupportATag, p3SupportB, p3SupportBTag,
    finalEssay,
  ])

  // ── 언마운트 시 마지막 저장 (뒤로가기 / 페이지 이탈 시)
  useEffect(() => {
    return () => {
      // cleanup: 타이머 취소 후 즉시 저장
      clearTimeout(autoSaveTimerRef.current)
      // 동기적 localStorage 백업은 확실하게
      saveToLocal()
      // Firebase 저장은 비동기 — fire-and-forget
      const s = stateRef.current
      saveDraft(s.activeTab || 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 탭 변경
  const handleTabChange = async (targetStep) => {
    clearTimeout(autoSaveTimerRef.current)
    await saveDraftUI(activeTab)
    setActiveTab(targetStep)
  }

  // 위에서 작성한 내용 모두 불러오기
  const handleLoadAllContent = () => {
    const sentences = [
      p1Main, p1SupportA, p1SupportB,
      p2Main, p2SupportA, p2SupportB,
      p3Main, p3SupportA, p3SupportB
    ]
    const validSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        if (s && !/[.!?]$/.test(s)) {
          return s + '.'
        }
        return s
      })
    
    const merged = validSentences.join(' ')
    setFinalEssay(merged)
  }

  // 미리보기 및 검토 열기
  const handlePreviewAndReview = () => {
    setError('')
    if (!title.trim()) {
      setError('글의 제목을 입력해 주세요.')
      return
    }
    if (!finalEssay.trim()) {
      setError('본문 내용을 입력해 주세요.')
      return
    }
    setSelfCheck(false)
    setScore1(0)
    setScore2(0)
    setScore3(0)
    setHasWarning(false)
    setShowReviewModal(true)
  }

  // 최종 제출 수행
  const handleFinalSubmit = async (force = false) => {
    setError('')

    // 유효성 체크
    if (!selfCheck) {
      setHasWarning(true)
      return
    }
    if (score1 === 0 || score2 === 0 || score3 === 0) {
      setHasWarning(true)
      return
    }

    // 자가 평가 점수 미달 조건 (총점 6점 미만 또는 1점짜리가 있는 경우)
    const isBelowStandard = (score1 + score2 + score3) < 6 || score1 === 1 || score2 === 1 || score3 === 1

    if (isBelowStandard && !force) {
      setHasWarning(true)
      return
    }

    setBusy(true)
    try {
      const wasApproved = existing.status === 'approved'
      const payload = {
        ...buildPayload(),
        progressStep: 5,
        status: wasApproved ? 'approved' : 'pending',
        updatedAt: Date.now(),
        isModified: wasApproved,
        selfAssessment: {
          selfCheck,
          score1,
          score2,
          score3,
          totalScore: score1 + score2 + score3
        }
      }

      const timeout = (ms) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('네트워크가 느려 제출이 지연되고 있어요. 인터넷 연결을 확인하고 다시 시도해 주세요.')), ms)
      )

      if (tempId) {
        await Promise.race([updateAt(roomCode, `reflections/${tempId}`, payload), timeout(15000)])
      } else {
        const newKey = await Promise.race([pushUnder(roomCode, 'reflections', {
          ...payload,
          authorStudentId: myStudentId,
          authorNumber: myNumber,
          authorNickname: myNickname,
          createdAt: Date.now(),
          empathy: { heart: 0, clap: 0, lightbulb: 0, thumbsup: 0 },
        }), timeout(15000)])
        setTempId(newKey)
        tempIdRef.current = newKey
      }
      // 제출 상태를 즉시 ref에 반영 — 언마운트/자동저장이 'writing'으로 되돌리지 않도록
      serverStatusRef.current = payload.status

      setDone(true)
      setShowReviewModal(false)
      setTimeout(() => {
        setDone(false)
        onEditDone?.()
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-4 border border-pink-200 flex items-center justify-between">
        <div>
          <h2 className="font-black text-pink-800 text-lg mb-1">
            {isEdit ? '✏️ 정리글 수정' : '📝 정리글 작성'}
          </h2>
          <p className="text-sm text-gray-600">
            5단계를 차례대로 완성하고 임시 저장하며 나만의 글을 다듬어 보세요.
          </p>
        </div>
        {saveDone && (
          <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-full font-bold animate-pulse">
            💾 실시간 임시저장 완료!
          </span>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex justify-between border-b border-gray-200 pb-2 flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((step) => {
          const labels = ['개요 작성', '도입 단락', '전개 단락', '마무리 단락', '최종본 작성']
          const isActive = activeTab === step
          return (
            <button
              key={step}
              type="button"
              onClick={() => handleTabChange(step)}
              className={`flex-1 min-w-[70px] px-2 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 ${
                isActive
                  ? 'bg-pink-600 text-white shadow-md scale-105'
                  : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className={`text-[10px] w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'bg-pink-800 text-white' : 'bg-gray-200 text-gray-600'}`}>{step}</span>
              <span>{labels[step - 1]}</span>
            </button>
          )
        })}
      </div>

      {/* 내 캔바 카드뉴스 미리보기 */}
      {canvaUrl && (
        <div className="bg-white border border-violet-200 rounded-xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setShowCanva((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50 transition"
          >
            <span className="flex items-center gap-1.5">🎨 내 캔바 카드뉴스 참고하기</span>
            <span>{showCanva ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showCanva && (
            <div className="aspect-video border-t border-violet-100 bg-gray-50">
              <iframe src={canvaUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="내 카드뉴스" />
            </div>
          )}
        </div>
      )}

      {/* 탭 콘텐츠 분기 */}
      <div className="space-y-4">
        {/* 1단계: 개요 작성 */}
        {activeTab === 1 && (
          <div className="bg-white border-2 border-pink-100 rounded-2xl p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="font-extrabold text-pink-800 text-base mb-1">📋 개요작성 - 한줄로만 정리하기</h3>
              <p className="text-xs text-gray-500">본격적인 글쓰기 전 도입, 전개, 마무리를 각 한 줄씩 간단하게 핵심만 요약해 봅니다.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-extrabold text-blue-700 block mb-1">도입 — 이 프로젝트에서 무엇을 했나요?</label>
                <textarea 
                  value={intro} 
                  onChange={(e) => setIntro(e.target.value)} 
                  rows={2} 
                  maxLength={200}
                  placeholder="시민단체 활동부터 선거, 국정 활동까지 한 줄로 소개하세요."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition resize-none" 
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-emerald-700 block mb-1">전개 — 가장 의미 있었던 경험과 배움</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  rows={2} 
                  maxLength={200}
                  placeholder="인상 깊었던 활동, 새롭게 알게 된 것, 어려웠던 점 등"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent transition resize-none" 
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-pink-700 block mb-1">마무리 — 민주 시민으로서 다짐</label>
                <textarea 
                  value={conclusion} 
                  onChange={(e) => setConclusion(e.target.value)} 
                  rows={2} 
                  maxLength={200}
                  placeholder="이 경험이 나에게 남긴 것, 앞으로의 다짐"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition resize-none" 
                />
              </div>
            </div>
          </div>
        )}

        {/* 2단계: 도입 단락 */}
        {activeTab === 2 && (
          <ParagraphEditor
            title="📘 도입 단락 — 중심문장 · 뒷받침문장 작성하기"
            accent="border-blue-200 bg-blue-50/20"
            outlineCard={intro}
            mainSentence={p1Main} setMain={setP1Main} mainTag={p1MainTag} setMainTag={setP1MainTag}
            supportA={p1SupportA} setSupportA={setP1SupportA} supportATag={p1SupportATag} setSupportATag={setP1SupportATag}
            supportB={p1SupportB} setSupportB={setP1SupportB} supportBTag={p1SupportBTag} setSupportBTag={setP1SupportBTag}
          />
        )}

        {/* 3단계: 전개 단락 */}
        {activeTab === 3 && (
          <ParagraphEditor
            title="📗 전개 단락 — 중심문장 · 뒷받침문장 작성하기"
            accent="border-emerald-200 bg-emerald-50/20"
            outlineCard={body}
            mainSentence={p2Main} setMain={setP2Main} mainTag={p2MainTag} setMainTag={setP2MainTag}
            supportA={p2SupportA} setSupportA={setP2SupportA} supportATag={p2SupportATag} setSupportATag={setP2SupportATag}
            supportB={p2SupportB} setSupportB={setP2SupportB} supportBTag={p2SupportBTag} setSupportBTag={setP2SupportBTag}
          />
        )}

        {/* 4단계: 마무리 단락 */}
        {activeTab === 4 && (
          <ParagraphEditor
            title="📕 마무리 단락 — 중심문장 · 뒷받침문장 작성하기"
            accent="border-pink-200 bg-pink-50/20"
            outlineCard={conclusion}
            mainSentence={p3Main} setMain={setP3Main} mainTag={p3MainTag} setMainTag={setP3MainTag}
            supportA={p3SupportA} setSupportA={setP3SupportA} supportATag={p3SupportATag} setSupportATag={setP3SupportATag}
            supportB={p3SupportB} setSupportB={setP3SupportB} supportBTag={p3SupportBTag} setSupportBTag={setP3SupportBTag}
          />
        )}

        {/* 5단계: 최종본 작성 */}
        {activeTab === 5 && (
          <div className="bg-white border-2 border-pink-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="font-extrabold text-pink-800 text-base mb-1">📜 최종본 작성하기</h3>
              <p className="text-xs text-gray-500">각 단계에서 구상한 내용을 바탕으로 완성도 있는 한 편의 글을 작성하세요.</p>
            </div>

            {/* 글 제목 추가 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">글 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="글의 멋진 제목을 지어주세요."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition"
              />
            </div>

            {/* 불러오기 및 에세이 작성 영역 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-pink-700 block">본문 정리</label>
                <button
                  type="button"
                  onClick={handleLoadAllContent}
                  className="px-3 py-1 text-xs bg-pink-50 text-pink-700 border border-pink-200 rounded-lg font-bold hover:bg-pink-100 transition duration-200 flex items-center gap-1"
                >
                  📥 위에서 작성한 내용 모두 불러오기
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={finalEssay}
                onChange={(e) => setFinalEssay(e.target.value)}
                rows={8}
                maxLength={3000}
                placeholder="시민단체 활동부터 선거·국정·사법까지의 경험을 한 편의 글로 정리해 보세요."
                className="w-full px-4 py-3 rounded-xl border border-pink-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition duration-200"
              />
              <p className="text-xs text-gray-400 text-right">{finalEssay.length} / 3000자</p>
            </div>

            {/* 카드 색상 선택 */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-700 mb-2">기록 카드 색상</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button 
                    type="button" 
                    key={c.id} 
                    onClick={() => setColor(c.id)}
                    className={`w-10 h-10 rounded-xl border-2 transition-all duration-200 shadow-sm ${c.cls} ${
                      color === c.id 
                        ? 'ring-2 ring-offset-2 ring-pink-500 scale-110 border-transparent font-extrabold' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    title={c.label}
                  >
                    {color === c.id ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{error}</p>}
      {done  && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">✓ {isEdit ? '정리글이 성공적으로 수정되었어요!' : '제출 완료! 선생님의 승인을 기다려 주세요.'}</p>}

      {/* 하단 제어 버튼 */}
      <div className="flex gap-3 pt-2">
        {isEdit && (
          <button 
            type="button" 
            onClick={onEditDone}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition"
          >
            취소
          </button>
        )}

        <button 
          type="button"
          onClick={async () => {
            if (activeTab < 5) {
              await handleTabChange(activeTab + 1)
            } else {
              handlePreviewAndReview()
            }
          }}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white font-black shadow-md hover:bg-pink-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {busy ? '자동 저장 중...' : activeTab < 5 ? '임시 저장하고 다음 단계로 👉' : '🔍 미리보기 및 검토'}
        </button>
      </div>

      {/* ─────────────────── 자가 진단 및 3점 평가 미리보기 모달 ─────────────────── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-pink-50 border-b border-pink-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-pink-900 text-base">🔍 정리글 최종 검토 및 자가 진단</h3>
                <p className="text-xs text-pink-700">제출하기 전에 본인의 글을 직접 검토하고 평가해 보세요.</p>
              </div>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors flex items-center justify-center font-bold text-lg border border-gray-200"
              >
                ✕
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* 좌측: 글 미리보기 */}
              <div className="flex-1 p-6 space-y-4 bg-gray-50/50">
                <div className={`p-6 rounded-2xl border-2 shadow-sm ${
                  color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  color === 'pink' ? 'bg-pink-50 border-pink-200' :
                  color === 'sky' ? 'bg-sky-50 border-sky-200' :
                  color === 'lime' ? 'bg-lime-50 border-lime-200' :
                  color === 'violet' ? 'bg-violet-50 border-violet-200' :
                  'bg-amber-50 border-amber-200'
                }`}>
                  <div className="border-b border-gray-200/60 pb-3 mb-4">
                    <span className="text-xs font-bold text-pink-600 block mb-1">정리글 카드 프리뷰</span>
                    <h1 className="text-xl font-black text-gray-900">{title}</h1>
                    <p className="text-xs text-gray-500 mt-1">글쓴이: {myNickname} ({myNumber}번)</p>
                  </div>
                  <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap max-h-[45vh] overflow-y-auto pr-2">
                    {finalEssay}
                  </div>
                </div>
              </div>

              {/* 우측: 평가 및 서브밋 */}
              <div className="w-full md:w-[400px] p-6 flex flex-col justify-between space-y-5 bg-white">
                <div className="space-y-4">
                  {/* 자가 검토 체크 */}
                  <div className="bg-pink-50/30 border border-pink-100 rounded-2xl p-4">
                    <h4 className="font-extrabold text-gray-800 text-sm mb-2 flex items-center gap-1">📋 스스로 검토하기</h4>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-gray-700 leading-tight">
                      <input 
                        type="checkbox" 
                        checked={selfCheck}
                        onChange={(e) => setSelfCheck(e.target.checked)}
                        className="rounded text-pink-600 focus:ring-pink-400 border-gray-300 mt-0.5 w-4 h-4"
                      />
                      <span>문맥상 말이 되는지 스스로 글을 꼼꼼하게 다시 읽고 다듬었습니까?</span>
                    </label>
                  </div>

                  {/* 3점 척도 자가 평가 */}
                  <div className="space-y-3.5">
                    <h4 className="font-extrabold text-gray-800 text-sm flex items-center gap-1 border-b pb-1">🎯 3점 척도 자가 평가</h4>
                    
                    {/* 평가 1 */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-600 block">1. 글의 짜임새 (도입-전개-마무리 구성이 잘 나뉘었나요?)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScore1(val)}
                            className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all duration-150 ${
                              score1 === val
                                ? 'bg-pink-600 text-white border-transparent shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            {val === 1 ? '아쉬움 (1점)' : val === 2 ? '보통 (2점)' : '우수 (3점)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 평가 2 */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-600 block">2. 사실과 의견의 구분 (사실과 의견을 알맞게 구분하여 썼나요?)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScore2(val)}
                            className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all duration-150 ${
                              score2 === val
                                ? 'bg-pink-600 text-white border-transparent shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            {val === 1 ? '아쉬움 (1점)' : val === 2 ? '보통 (2점)' : '우수 (3점)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 평가 3 */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-600 block">3. 주장과 근거의 타당성 (내 주장에 맞는 근거가 잘 제시되었나요?)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScore3(val)}
                            className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all duration-150 ${
                              score3 === val
                                ? 'bg-pink-600 text-white border-transparent shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            {val === 1 ? '아쉬움 (1점)' : val === 2 ? '보통 (2점)' : '우수 (3점)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 하단 제어 & 워닝 */}
                <div className="space-y-3.5 border-t pt-4">
                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{error}</p>
                  )}

                  {hasWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 leading-normal space-y-1.5">
                      <p className="font-extrabold flex items-center gap-1 text-xs">⚠️ 알림</p>
                      <p>자가 진단 체크가 누락되었거나 평가 결과에 아쉬운(1점) 항목이 있거나 총점이 6점 미만입니다. 최종본을 다시 수정 보완해 보는 것을 권장합니다.</p>
                      <div className="flex gap-2 pt-1 border-t border-amber-200/50">
                        <button
                          type="button"
                          onClick={() => handleFinalSubmit(true)}
                          disabled={busy}
                          className="flex-1 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 transition disabled:opacity-50"
                        >
                          {busy ? '제출 중...' : '그대로 제출하기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHasWarning(false)
                            setShowReviewModal(false)
                          }}
                          disabled={busy}
                          className="flex-1 py-1 rounded bg-white text-gray-600 border border-gray-300 font-bold hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          다시 최종본 수정하기
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(false)}
                      disabled={busy}
                      className="flex-1 py-2 text-xs rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      다시 읽고 수정하기
                    </button>
                    {!hasWarning && (
                      <button
                        type="button"
                        onClick={() => handleFinalSubmit(false)}
                        disabled={busy}
                        className="flex-1 py-2 text-xs rounded-xl bg-pink-600 text-white font-black shadow-md hover:bg-pink-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {busy ? '⏳ 제출 처리 중...' : '🚀 정리글 최종 제출'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
