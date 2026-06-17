import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { extractCanvaUrl, formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { pushUnder, removeAt, setAt, subscribe, updateAt } from '../../lib/rtdb-helpers'
import MultiAxisRating from '../shared/MultiAxisRating'

const NEWSPAPER_RATING_AXES = [
  { key: 'relevance', full: '📰 정보가 정확한가?', short: '📰 정확', color: 'bg-sky-500' },
  { key: 'feasibility', full: '🧭 구성이 읽기 쉬운가?', short: '🧭 구성', color: 'bg-emerald-500' },
  { key: 'logic', full: '💬 선거 판단에 도움이 되는가?', short: '💬 도움', color: 'bg-amber-500' },
]

const EMPTY_RATING = { relevance: 0, feasibility: 0, logic: 0 }

const NEWSPAPER_LAYOUT_TYPES = [
  { key: 'lead', label: '머리기사', hint: '가장 크게 다룰 핵심 기사' },
  { key: 'support', label: '보조기사', hint: '머리기사를 뒷받침하는 기사' },
  { key: 'analysis', label: '분석기사', hint: '공약·쟁점을 자세히 살피는 기사' },
  { key: 'interview', label: '인터뷰/의견', hint: '질문, 의견, 현장 반응 기사' },
  { key: 'brief', label: '짧은 기사', hint: '작게 넣을 기사' },
  { key: 'unused', label: '이번 신문에는 제외', hint: '회의 후 싣지 않기로 한 기사' },
]

const statusLabel = (status) => status === 'submitted' ? '제출 완료' : '작성 중'

function getStudentGroupId(groups, studentId) {
  if (!studentId) return null
  for (const [gid, group] of Object.entries(groups || {})) {
    if (group?.members?.[studentId]) return gid
  }
  return null
}

function getArticleStatusLabel(status) {
  if (status === 'approved') return '게시 중'
  if (status === 'rejected') return '반려됨'
  if (status === 'deleted') return '삭제됨'
  return '승인 대기'
}

function normalizeLayoutAssignment(value) {
  if (value && typeof value === 'object') {
    const slot = NEWSPAPER_LAYOUT_TYPES.some((item) => item.key === value.slot) ? value.slot : 'brief'
    if (slot === 'unused') return { slot, page: 0 }
    const page = slot === 'unused' ? 0 : Number(value.page || 1)
    return { slot, page: page === 2 ? 2 : 1 }
  }
  const oldSlot = typeof value === 'string' ? value : 'brief'
  const slot = NEWSPAPER_LAYOUT_TYPES.some((item) => item.key === oldSlot) ? oldSlot : 'brief'
  if (slot === 'unused') return { slot, page: 0 }
  return { slot, page: ['analysis', 'interview'].includes(slot) ? 2 : 1 }
}

function normalizeTotalPages(value) {
  return Number(value) === 2 ? 2 : 1
}

function normalizeAssignmentsForTotalPages(assignments = {}, totalPages = 1) {
  if (normalizeTotalPages(totalPages) === 2) return assignments || {}
  return Object.fromEntries(Object.entries(assignments || {}).map(([id, value]) => {
    const current = normalizeLayoutAssignment(value)
    return [id, { slot: current.slot, page: current.slot === 'unused' ? 0 : 1 }]
  }))
}

function buildLayoutItems(selectedArticleIds = [], assignments = {}, articleMap = {}, totalPages = 1) {
  const normalizedTotalPages = normalizeTotalPages(totalPages)
  return selectedArticleIds.map((id) => ({
    articleId: id,
    headline: articleMap[id]?.headline || '제목 없는 기사',
    ...(() => {
      const current = normalizeLayoutAssignment(assignments[id])
      if (current.slot === 'unused') return current
      return { ...current, page: normalizedTotalPages === 2 ? current.page : 1 }
    })(),
  }))
}

function getLayoutGroups(layoutItems = []) {
  const groups = {
    1: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    2: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    unused: [],
  }
  ;(layoutItems || []).forEach((item) => {
    const { slot, page } = normalizeLayoutAssignment(item)
    if (slot === 'unused') groups.unused.push(item)
    else groups[page === 2 ? 2 : 1][slot].push(item)
  })
  return groups
}

export function JournalistNewspaperEditor({ groupId, articles = [] }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const [paper, setPaper] = useState(null)
  const [title, setTitle] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [selectedArticleIds, setSelectedArticleIds] = useState([])
  const [layoutAssignments, setLayoutAssignments] = useState({})
  const [totalPages, setTotalPages] = useState(1)
  const [layoutPlan, setLayoutPlan] = useState('')
  const [canvaUrl, setCanvaUrl] = useState('')
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!roomCode || !groupId) return undefined
    return subscribe(roomCode, `journalistNewspapers/${groupId}`, (data) => {
      const next = data || null
      setPaper(next)
      setTitle(next?.title || '')
      setMeetingNotes(next?.meetingNotes || '')
      setSelectedArticleIds(next?.selectedArticleIds || [])
      setLayoutAssignments(next?.layoutAssignments || {})
      setTotalPages(normalizeTotalPages(next?.totalPages))
      setLayoutPlan(next?.layoutPlan || '')
      setCanvaUrl(next?.canvaUrl || '')
    })
  }, [roomCode, groupId])

  const articleMap = useMemo(() => Object.fromEntries((articles || []).map((a) => [a.id, a])), [articles])
  const submitted = paper?.status === 'submitted'

  const buildPayload = (extra = {}) => ({
    ...(paper || {}),
    groupId,
    groupName: groups?.[groupId]?.name || '',
    title: title.trim(),
    meetingNotes: meetingNotes.trim(),
    selectedArticleIds,
    layoutAssignments,
    totalPages,
    layoutItems: buildLayoutItems(selectedArticleIds, layoutAssignments, articleMap, totalPages),
    layoutPlan: layoutPlan.trim(),
    canvaUrl: extractCanvaUrl(canvaUrl),
    updatedAt: Date.now(),
    status: paper?.status || 'drafting',
    ...extra,
  })

  const updateLayoutDraft = async (nextSelectedArticleIds, nextAssignments, nextTotalPages = totalPages) => {
    if (!roomCode || !groupId) return
    const normalizedTotalPages = normalizeTotalPages(nextTotalPages)
    const normalizedAssignments = normalizeAssignmentsForTotalPages(nextAssignments, normalizedTotalPages)
    const layoutItems = buildLayoutItems(nextSelectedArticleIds, normalizedAssignments, articleMap, normalizedTotalPages)
    await updateAt(roomCode, `journalistNewspapers/${groupId}`, {
      groupId,
      groupName: groups?.[groupId]?.name || '',
      selectedArticleIds: nextSelectedArticleIds,
      layoutAssignments: normalizedAssignments,
      totalPages: normalizedTotalPages,
      layoutItems,
      layoutDraftSavedAt: Date.now(),
      updatedAt: Date.now(),
      status: submitted ? 'submitted' : (paper?.status || 'drafting'),
    })
  }

  const saveTitle = async () => {
    if (!title.trim()) return setMessage('신문 이름을 입력해 주세요.')
    setBusy(true)
    setMessage('')
    try {
      await setAt(roomCode, `journalistNewspapers/${groupId}`, buildPayload({ titleSavedAt: Date.now(), status: submitted ? 'submitted' : 'drafting' }))
      setMessage('신문 이름을 저장했어요.')
    } catch (error) {
      setMessage(`저장 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const saveMeeting = async () => {
    if (!meetingNotes.trim() && !layoutPlan.trim() && selectedArticleIds.length === 0) return setMessage('편집회의 결과를 입력하거나 배치할 기사를 선택해 주세요.')
    setBusy(true)
    setMessage('')
    try {
      await setAt(roomCode, `journalistNewspapers/${groupId}`, buildPayload({ meetingSavedAt: Date.now(), status: submitted ? 'submitted' : 'drafting' }))
      setMessage('편집회의 결과를 저장했어요.')
    } catch (error) {
      setMessage(`저장 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const saveCanva = async () => {
    if (!extractCanvaUrl(canvaUrl)) return setMessage('캔바 임베드 코드나 링크를 입력해 주세요.')
    setBusy(true)
    setMessage('')
    try {
      await setAt(roomCode, `journalistNewspapers/${groupId}`, buildPayload({ canvaSavedAt: Date.now(), status: submitted ? 'submitted' : 'drafting' }))
      setMessage('캔바 신문 링크를 저장했어요.')
    } catch (error) {
      setMessage(`저장 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const submitPaper = async () => {
    if (!title.trim()) return setMessage('신문 이름 저장이 필요합니다.')
    if (!meetingNotes.trim() && !layoutPlan.trim() && selectedArticleIds.length === 0) return setMessage('편집회의 결과 저장이 필요합니다.')
    if (!extractCanvaUrl(canvaUrl)) return setMessage('캔바 임베드 저장이 필요합니다.')
    if (!confirm('이 신문을 제출할까요? 제출 후에도 다시 저장해 수정할 수 있지만, 친구들에게 공개됩니다.')) return
    setBusy(true)
    setMessage('')
    try {
      const now = Date.now()
      await setAt(roomCode, `journalistNewspapers/${groupId}`, buildPayload({
        titleSavedAt: paper?.titleSavedAt || now,
        meetingSavedAt: paper?.meetingSavedAt || now,
        canvaSavedAt: paper?.canvaSavedAt || now,
        submittedAt: now,
        status: 'submitted',
      }))
      setMessage('기자단 신문을 제출했어요.')
    } catch (error) {
      setMessage(`제출 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleArticle = (id) => {
    setSelectedArticleIds((prev) => {
      if (prev.includes(id)) {
        const nextSelected = prev.filter((x) => x !== id)
        setLayoutAssignments((old) => {
          const next = { ...old }
          delete next[id]
          updateLayoutDraft(nextSelected, next).catch((error) => setMessage(`배치 반영 실패: ${error.message}`))
          return next
        })
        return nextSelected
      }
      const nextSelected = [...prev, id]
      setLayoutAssignments((old) => {
        const next = { ...old, [id]: old[id] || { page: 1, slot: 'brief' } }
        updateLayoutDraft(nextSelected, next).catch((error) => setMessage(`배치 반영 실패: ${error.message}`))
        return next
      })
      return nextSelected
    })
  }

  const saveLayout = async (nextAssignments) => {
    if (selectedArticleIds.length === 0) return setMessage('먼저 배치할 기사를 선택해 주세요.')
    const normalizedAssignments = normalizeAssignmentsForTotalPages(nextAssignments, totalPages)
    setLayoutAssignments(normalizedAssignments)
    setBusy(true)
    setMessage('')
    try {
      const layoutItems = buildLayoutItems(selectedArticleIds, normalizedAssignments, articleMap, totalPages)
      await setAt(roomCode, `journalistNewspapers/${groupId}`, buildPayload({
        layoutAssignments: normalizedAssignments,
        totalPages,
        layoutItems,
        meetingSavedAt: Date.now(),
        status: submitted ? 'submitted' : 'drafting',
      }))
      setLayoutOpen(false)
      setMessage('신문 배치안을 저장했어요.')
    } catch (error) {
      setMessage(`배치 저장 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const changeLayoutLive = (nextAssignments) => {
    const normalizedAssignments = normalizeAssignmentsForTotalPages(nextAssignments, totalPages)
    setLayoutAssignments(normalizedAssignments)
    updateLayoutDraft(selectedArticleIds, normalizedAssignments).catch((error) => setMessage(`실시간 배치 반영 실패: ${error.message}`))
  }

  const currentLayoutItems = useMemo(
    () => buildLayoutItems(selectedArticleIds, layoutAssignments, articleMap, totalPages),
    [selectedArticleIds, layoutAssignments, articleMap, totalPages],
  )

  const setNewspaperTotalPages = (pages) => {
    const nextTotalPages = normalizeTotalPages(pages)
    const nextAssignments = normalizeAssignmentsForTotalPages(layoutAssignments, nextTotalPages)
    setTotalPages(nextTotalPages)
    setLayoutAssignments(nextAssignments)
    updateLayoutDraft(selectedArticleIds, nextAssignments, nextTotalPages).catch((error) => setMessage(`신문 면수 반영 실패: ${error.message}`))
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border-2 border-blue-100 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-blue-900">🗞️ 기자단 마무리 신문 제출</h3>
            <p className="mt-1 text-xs text-slate-500">우리 기자단이 쓴 기사들을 모아 편집회의를 하고, 캔바 신문으로 완성해 제출합니다.</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {statusLabel(paper?.status)}
          </span>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
          <label className="block text-xs font-black text-blue-900">① 신문 이름 정하기</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="예: 민국 선거신문, 후보 공약 돋보기"
            className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm"
          />
          <button type="button" onClick={saveTitle} disabled={busy} className="w-full rounded-xl bg-blue-600 py-2 text-sm font-black text-white disabled:opacity-50">신문 이름 저장</button>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-slate-100 bg-white p-4 space-y-3">
        <div>
          <h3 className="font-black text-slate-900">② 신문편집회의</h3>
          <p className="mt-1 text-xs text-slate-500">우리 모둠 기자단이 쓴 기사들을 보며 어떤 기사를 어느 쪽에 배치할지 정합니다.</p>
        </div>

        {articles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">아직 우리 기자단이 작성한 기사가 없습니다.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {articles.map((article) => {
              const checked = selectedArticleIds.includes(article.id)
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => toggleArticle(article.id)}
                  className={`rounded-xl border p-3 text-left transition ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-200'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${checked ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border'}`}>{checked ? '배치 선택' : '선택'}</span>
                    <span className="text-[10px] font-bold text-slate-400">{getArticleStatusLabel(article.status)}</span>
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-900">{article.headline || '제목 없는 기사'}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{article.body}</p>
                </button>
              )
            })}
          </div>
        )}

        {selectedArticleIds.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black text-slate-700">선택한 기사 {selectedArticleIds.length}개</p>
              <button
                type="button"
                onClick={() => setLayoutOpen(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm"
              >
                신문편집 미리보기
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <p className="font-black text-slate-700">신문의 총 면수를 먼저 정하세요</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[1, 2].map((pages) => (
                  <button
                    key={pages}
                    type="button"
                    onClick={() => setNewspaperTotalPages(pages)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      totalPages === pages
                        ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    <p className="text-sm font-black">{pages}면 신문</p>
                    <p className={`mt-1 text-[11px] ${totalPages === pages ? 'text-blue-100' : 'text-slate-400'}`}>
                      {pages === 1 ? '한 장에 핵심 기사만 압축합니다.' : '1면과 2면으로 나누어 더 많은 기사를 배치합니다.'}
                    </p>
                  </button>
                ))}
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {selectedArticleIds.map((id) => <li key={id}>{articleMap[id]?.headline || '기사'}</li>)}
              </ul>
            </div>
            {currentLayoutItems.length > 0 && <NewspaperLayoutSummary layoutItems={currentLayoutItems} totalPages={totalPages} compact />}
          </div>
        )}

        <textarea
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          rows={4}
          maxLength={700}
          placeholder="편집회의 결과: 1면에는 어떤 기사, 2면에는 어떤 기사, 제목과 강조 문구는 어떻게 할지 적어 보세요."
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <textarea
          value={layoutPlan}
          onChange={(e) => setLayoutPlan(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="배치 계획 예: 왼쪽 위-후보 비교 기사 / 오른쪽-토론 쟁점 / 아래-기자단 논평"
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={saveMeeting} disabled={busy} className="w-full rounded-xl bg-slate-900 py-2 text-sm font-black text-white disabled:opacity-50">편집회의 결과 저장</button>
      </section>

      {layoutOpen && (
        <NewspaperLayoutPlanner
          articles={selectedArticleIds.map((id) => articleMap[id]).filter(Boolean)}
          assignments={layoutAssignments}
          totalPages={totalPages}
          onLiveChange={changeLayoutLive}
          onClose={() => setLayoutOpen(false)}
          onSave={saveLayout}
          busy={busy}
        />
      )}

      <section className="rounded-2xl border-2 border-indigo-100 bg-white p-4 space-y-3">
        <label className="block text-sm font-black text-indigo-900">③ 캔바 임베디드 저장</label>
        <input
          value={canvaUrl}
          onChange={(e) => setCanvaUrl(extractCanvaUrl(e.target.value))}
          placeholder="캔바 신문 임베드 코드나 링크를 붙여넣으세요"
          className="w-full rounded-xl border border-indigo-100 px-3 py-2 text-sm"
        />
        {canvaUrl && <NewspaperCanvaFrame url={canvaUrl} title={title || '기자단 신문 미리보기'} />}
        <button type="button" onClick={saveCanva} disabled={busy} className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-black text-white disabled:opacity-50">캔바 임베디드 저장</button>
      </section>

      <section className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 space-y-3">
        <NewspaperChecklist paper={paper} title={title} meetingReady={!!(meetingNotes.trim() || layoutPlan.trim() || selectedArticleIds.length)} canvaUrl={canvaUrl} />
        {message && <p className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-700">{message}</p>}
        <button type="button" onClick={submitPaper} disabled={busy} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow disabled:opacity-50">
          기자단 신문 제출하기
        </button>
      </section>
    </div>
  )
}

function NewspaperLayoutPlanner({ articles = [], assignments = {}, totalPages = 1, onLiveChange, onClose, onSave, busy }) {
  const normalizedTotalPages = normalizeTotalPages(totalPages)
  const [draft, setDraft] = useState(() => {
    const next = {}
    articles.forEach((article) => {
      next[article.id] = normalizeLayoutAssignment(assignments[article.id])
    })
    return normalizeAssignmentsForTotalPages(next, normalizedTotalPages)
  })

  useEffect(() => {
    setDraft((prev) => {
      const next = {}
      articles.forEach((article) => {
        next[article.id] = normalizeLayoutAssignment(assignments[article.id] || prev[article.id])
      })
      return normalizeAssignmentsForTotalPages(next, normalizedTotalPages)
    })
  }, [articles, assignments, normalizedTotalPages])

  const changeAssignment = (articleId, patch) => {
    const current = normalizeLayoutAssignment(draft[articleId])
    const nextItem = normalizeLayoutAssignment({ ...current, ...patch })
    const next = normalizeAssignmentsForTotalPages({ ...draft, [articleId]: nextItem }, normalizedTotalPages)
    setDraft(next)
    onLiveChange?.(next)
  }

  const layoutItems = useMemo(() => buildLayoutItems(articles.map((a) => a.id), draft, Object.fromEntries(articles.map((a) => [a.id, a])), normalizedTotalPages), [articles, draft, normalizedTotalPages])
  const backdrop = (event) => { if (event.target === event.currentTarget) onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={backdrop}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-blue-500">신문편집 미리보기</p>
            <h3 className="text-lg font-black text-slate-950">{normalizedTotalPages}면 신문에 어떤 기사로 실을지 함께 정해요</h3>
            <p className="mt-1 text-xs text-slate-500">선택을 바꾸면 같은 기자단 친구들의 화면에도 실시간으로 반영됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-lg font-black text-slate-500 hover:bg-slate-200">×</button>
        </header>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-3 border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black text-slate-500">기사별 배치 선택</p>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <p className="text-xs font-black text-blue-900">기사 종류 안내</p>
              <div className="mt-2 grid gap-1.5 text-[11px] leading-relaxed text-blue-900 sm:grid-cols-2">
                {NEWSPAPER_LAYOUT_TYPES.map((type) => (
                  <div key={type.key} className="rounded-lg bg-white/80 px-2 py-1.5">
                    <span className="font-black">{type.label}</span>
                    <span className="text-blue-700">: {type.hint}</span>
                  </div>
                ))}
              </div>
            </div>
            {articles.map((article) => (
              <div key={article.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="line-clamp-2 text-sm font-black text-slate-900">{article.headline || '제목 없는 기사'}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{article.body}</p>
                <div className={`mt-2 grid gap-2 ${normalizedTotalPages === 2 ? 'grid-cols-[0.8fr_1.2fr]' : 'grid-cols-1'}`}>
                  {normalizedTotalPages === 2 ? (
                    <select
                      value={normalizeLayoutAssignment(draft[article.id]).page || 1}
                      disabled={normalizeLayoutAssignment(draft[article.id]).slot === 'unused'}
                      onChange={(event) => changeAssignment(article.id, { page: Number(event.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value={1}>1면</option>
                      <option value={2}>2면</option>
                    </select>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500">1면 신문</div>
                  )}
                  <select
                    value={normalizeLayoutAssignment(draft[article.id]).slot}
                    onChange={(event) => changeAssignment(article.id, { slot: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    {NEWSPAPER_LAYOUT_TYPES.map((slot) => (
                      <option key={slot.key} value={slot.key}>{slot.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </section>

          <section className="bg-gradient-to-br from-slate-50 to-blue-50/60 p-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b-4 border-slate-900 pb-2">
                <p className="text-xl font-black tracking-tight text-slate-950">우리 기자단 신문</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">실시간 배치안</p>
              </div>
              <NewspaperLayoutSummary layoutItems={layoutItems} totalPages={normalizedTotalPages} />
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">선택은 실시간 반영되고, 배치 저장을 누르면 편집회의 완료 상태로 기록됩니다.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">닫기</button>
            <button type="button" onClick={() => onSave(draft)} disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white shadow disabled:opacity-50">배치 저장</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function NewspaperLayoutSummary({ layoutItems = [], totalPages = 1, compact = false }) {
  const normalizedTotalPages = normalizeTotalPages(totalPages)
  const groups = getLayoutGroups(layoutItems)
  const hasPage = (page) => NEWSPAPER_LAYOUT_TYPES.some((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length)
  const hasUnused = groups.unused.length > 0
  if (!hasPage(1) && !hasPage(2) && !hasUnused && normalizedTotalPages < 1) return null

  return (
    <div className="mt-3 space-y-3">
      {[1, 2].map((page) => (page <= normalizedTotalPages || hasPage(page)) && (
        <div key={page} className="rounded-3xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="mb-2 border-b-2 border-slate-900 pb-1">
            <p className="text-sm font-black text-slate-950">{page}면</p>
          </div>
          {hasPage(page) ? (
            <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
              {NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length).map((slot) => (
              <div
                key={`${page}-${slot.key}`}
                className={`rounded-2xl border bg-slate-50 p-3 ${
                  slot.key === 'lead' ? 'border-slate-900 sm:col-span-2' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-900">{slot.label}</p>
                  {!compact && <span className="text-[10px] font-bold text-slate-400">{slot.hint}</span>}
                </div>
                <ul className="mt-2 space-y-1">
                  {groups[page][slot.key].map((item) => (
                    <li key={item.articleId} className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-slate-700">
                      {item.headline}
                    </li>
                  ))}
                </ul>
              </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs font-bold text-slate-400">아직 이 면에 배치된 기사가 없습니다.</p>
          )}
        </div>
      ))}
      {hasUnused && (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 opacity-70">
          <p className="text-xs font-black text-slate-700">이번 신문에는 제외</p>
          <ul className="mt-2 space-y-1">
            {groups.unused.map((item) => (
              <li key={item.articleId} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-500">
                {item.headline}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NewspaperChecklist({ paper, title, meetingReady, canvaUrl }) {
  const rows = [
    ['신문 이름', !!(paper?.titleSavedAt || title?.trim())],
    ['편집회의 결과', !!(paper?.meetingSavedAt || meetingReady)],
    ['캔바 신문', !!(paper?.canvaSavedAt || canvaUrl)],
    ['최종 제출', paper?.status === 'submitted'],
  ]
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {rows.map(([label, ok]) => (
        <div key={label} className={`rounded-xl border px-3 py-2 text-xs ${ok ? 'border-emerald-200 bg-white text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{label}</span>
            <span className="font-black">{ok ? '완료' : '필요'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function NewspaperCanvaFrame({ url, title }) {
  if (!url) return null
  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      <iframe
        src={formatCanvaEmbedUrl(url)}
        loading="lazy"
        allowFullScreen
        allow="fullscreen; autoplay"
        className="absolute inset-0 h-full w-full border-0"
        title={title}
      />
    </div>
  )
}

export function JournalistNewspaperGallery({ groups = {}, currentGroupId = null }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const [newspapersMap, setNewspapersMap] = useState({})

  useEffect(() => {
    if (!roomCode) return undefined
    return subscribe(roomCode, 'journalistNewspapers', (data) => setNewspapersMap(data || {}))
  }, [roomCode])

  const newspapers = useMemo(() => Object.entries(newspapersMap || {})
    .map(([gid, paper]) => ({ id: gid, ...paper }))
    .filter((paper) => paper.status === 'submitted')
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)), [newspapersMap])

  if (newspapers.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-5 text-center text-sm text-blue-700">
        아직 제출된 기자단 신문이 없습니다. 기자단이 신문을 제출하면 이곳에서 읽고 질문·의견·평점을 남길 수 있습니다.
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-black text-blue-900">🗞️ 선거 기자단 신문 읽기</h2>
        <p className="mt-1 text-xs text-slate-500">선거 전에 기자단 신문을 읽고 질문, 의견, 평점을 남겨 보세요. 이곳에는 찬반 선택이 없습니다.</p>
      </header>
      <div className="grid lg:grid-cols-2 gap-4">
        {newspapers.map((paper) => (
          <JournalistNewspaperCard
            key={paper.id}
            paper={paper}
            group={groups[paper.groupId || paper.id]}
            isMine={currentGroupId && currentGroupId === (paper.groupId || paper.id)}
          />
        ))}
      </div>
    </section>
  )
}

function JournalistNewspaperCard({ paper, group, isMine }) {
  return (
    <article className="rounded-3xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <header className="border-b border-blue-50 bg-gradient-to-br from-blue-50 to-white p-4">
        <p className="text-[11px] font-bold text-blue-500">{group?.name || paper.groupName || '선거 기자단'}</p>
        <h3 className="mt-1 text-xl font-black text-slate-900">{paper.title || '이름 없는 신문'}</h3>
        {paper.meetingNotes && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">편집회의: {paper.meetingNotes}</p>}
      </header>
      <div className="p-4 space-y-4">
        {paper.canvaUrl ? <NewspaperCanvaFrame url={paper.canvaUrl} title={paper.title || '기자단 신문'} /> : <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">캔바 신문이 아직 없습니다.</p>}
        {paper.layoutPlan && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-black text-slate-700">배치 계획</p>
            <p className="mt-1 whitespace-pre-wrap">{paper.layoutPlan}</p>
          </div>
        )}
        {paper.layoutItems?.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-black text-slate-700">신문편집 배치안</p>
            <NewspaperLayoutSummary layoutItems={paper.layoutItems} totalPages={paper.totalPages} compact />
          </div>
        )}
        <NewspaperFeedback targetId={paper.groupId || paper.id} targetGroupId={paper.groupId || paper.id} isMine={isMine} />
      </div>
    </article>
  )
}

function NewspaperFeedback({ targetId, targetGroupId, isMine }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const myGroupId = useMemo(() => getStudentGroupId(groups, myStudentId), [groups, myStudentId])
  const [feedbackMap, setFeedbackMap] = useState({})
  const [kind, setKind] = useState('의견')
  const [body, setBody] = useState('')
  const [ratings, setRatings] = useState(EMPTY_RATING)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return undefined
    return subscribe(roomCode, 'journalistNewspaperFeedback', (data) => setFeedbackMap(data || {}))
  }, [roomCode])

  const feedback = useMemo(() => Object.entries(feedbackMap || {})
    .map(([id, item]) => ({ id, ...item }))
    .filter((item) => item.targetId === targetId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [feedbackMap, targetId])
  const myFeedback = feedback.find((item) => item.authorStudentId === myStudentId)
  const canWrite = role === 'student' && !isMine && myGroupId !== targetGroupId
  const showForm = canWrite && (!myFeedback || editing)

  const avg = useMemo(() => {
    if (!feedback.length) return null
    const sums = { relevance: 0, feasibility: 0, logic: 0 }
    let count = 0
    feedback.forEach((item) => {
      const r = item.ratings || {}
      if ((r.relevance || r.feasibility || r.logic)) {
        sums.relevance += Number(r.relevance || 0)
        sums.feasibility += Number(r.feasibility || 0)
        sums.logic += Number(r.logic || 0)
        count += 1
      }
    })
    if (!count) return null
    return { relevance: sums.relevance / count, feasibility: sums.feasibility / count, logic: sums.logic / count }
  }, [feedback])

  const startEdit = () => {
    if (!myFeedback) return
    setKind(myFeedback.kind || '의견')
    setBody(myFeedback.body || '')
    setRatings(myFeedback.ratings || EMPTY_RATING)
    setEditing(true)
  }

  const resetForm = () => {
    setKind('의견')
    setBody('')
    setRatings(EMPTY_RATING)
    setEditing(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    try {
      const payload = {
        targetId,
        targetGroupId,
        kind,
        body: body.trim(),
        ratings,
        authorStudentId: myStudentId,
        authorNumber: myNumber,
        authorNickname: myNickname,
        updatedAt: Date.now(),
      }
      if (editing && myFeedback) await updateAt(roomCode, `journalistNewspaperFeedback/${myFeedback.id}`, payload)
      else await pushUnder(roomCode, 'journalistNewspaperFeedback', { ...payload, createdAt: Date.now() })
      resetForm()
    } finally {
      setBusy(false)
    }
  }

  const removeMine = async () => {
    if (!myFeedback) return
    if (!confirm('내 신문 의견을 삭제할까요?')) return
    await removeAt(roomCode, `journalistNewspaperFeedback/${myFeedback.id}`)
    resetForm()
  }

  return (
    <section className="border-t border-slate-100 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">💬 질문·의견·평점 ({feedback.length})</p>
        {avg && <MultiAxisRating value={avg} readOnly compact axes={NEWSPAPER_RATING_AXES} />}
      </div>
      {role === 'student' && isMine && <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">우리 기자단 신문에는 질문·의견을 남기지 않고, 다른 기자단 신문을 읽고 평가합니다.</p>}
      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
          <div className="flex gap-1">
            {['의견', '질문'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-full px-3 py-1 text-xs font-black ${kind === option ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-100'}`}
              >
                {option}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={250}
            placeholder="신문을 읽고 궁금한 점이나 의견을 적어 보세요."
            className="w-full resize-none rounded-lg border border-blue-100 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MultiAxisRating value={ratings} onChange={setRatings} compact axes={NEWSPAPER_RATING_AXES} />
            <button disabled={busy || !body.trim()} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-black text-white disabled:opacity-50">{editing ? '수정 저장' : '남기기'}</button>
          </div>
        </form>
      )}
      {canWrite && myFeedback && !editing && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-700">이미 의견을 남겼어요.</span>
          <button onClick={startEdit} className="rounded bg-amber-100 px-2 py-1 font-bold text-amber-800">수정</button>
          <button onClick={removeMine} className="rounded bg-rose-100 px-2 py-1 font-bold text-rose-700">삭제</button>
        </div>
      )}
      {feedback.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-400">아직 질문이나 의견이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {feedback.slice(0, 6).map((item) => (
            <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-700">{item.kind || '의견'} · {item.authorNumber}번 {item.authorNickname}</span>
                <MultiAxisRating value={item.ratings || EMPTY_RATING} readOnly compact axes={NEWSPAPER_RATING_AXES} />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
