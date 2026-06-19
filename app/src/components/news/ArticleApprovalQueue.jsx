import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'

const STATUS_BADGE = {
  approved: { label: '승인됨',  cls: 'text-emerald-700' },
  rejected: { label: '반려됨',  cls: 'text-amber-600' },
  pending:  { label: '대기 중', cls: 'text-blue-600' },
  deleted:  { label: '삭제됨',  cls: 'text-gray-400' },
}

function ArticleApprovalQueue() {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups   = useGameStore((s) => s.groups)

  const [articlesMap, setArticlesMap] = useState({})
  const [filter, setFilter] = useState('pending')
  const [openBodyId, setOpenBodyId] = useState(null) // 본문 전체 펼쳐보기

  // 인라인 수정 상태
  const [editingId, setEditingId]       = useState(null)
  const [editHeadline, setEditHeadline] = useState('')
  const [editBody, setEditBody]         = useState('')
  const [editBusy, setEditBusy]         = useState(false)

  // 소프트 삭제 상태
  const [deletingId, setDeletingId]         = useState(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [delBusy, setDelBusy]               = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'articles', (d) => setArticlesMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const allArticles = useMemo(() =>
    Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  [articlesMap])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, reported: 0, deleted: 0 }
    for (const a of allArticles) {
      if (a.status === 'deleted') { c.deleted++; continue }
      c[a.status] = (c[a.status] || 0) + 1
      if (Object.keys(a.reports || {}).length > 0) c.reported++
    }
    return c
  }, [allArticles])

  const articles = useMemo(() => {
    if (filter === 'reported')
      return allArticles.filter((a) => a.status !== 'deleted' && Object.keys(a.reports || {}).length > 0)
    if (filter === 'deleted')
      return allArticles.filter((a) => a.status === 'deleted')
    if (filter === 'all')
      return allArticles
    return allArticles.filter((a) => a.status === filter)
  }, [allArticles, filter])

  /* ── 액션 ── */
  const approve = (id) => updateAt(roomCode, `articles/${id}`, { status: 'approved', approvedAt: Date.now() })
  const reject  = (id) => updateAt(roomCode, `articles/${id}`, { status: 'rejected' })
  const restore = (id) => updateAt(roomCode, `articles/${id}`, { status: 'pending', deletedByTeacher: false, deletionReason: null, deletedAt: null })
  const hardDel = (id) => { if (confirm('완전히 삭제할까요? 복구 불가입니다.')) removeAt(roomCode, `articles/${id}`) }

  const openEdit = (a) => {
    setDeletingId(null)
    setEditingId(a.id)
    setEditHeadline(a.headline || '')
    setEditBody(a.body || '')
  }
  const saveEdit = async (id) => {
    if (!editHeadline.trim() || !editBody.trim()) { alert('헤드라인과 본문을 입력해 주세요.'); return }
    setEditBusy(true)
    try {
      await updateAt(roomCode, `articles/${id}`, { headline: editHeadline.trim(), body: editBody.trim(), editedByTeacherAt: Date.now() })
      setEditingId(null)
    } catch (err) { alert('수정 실패: ' + err.message) }
    finally { setEditBusy(false) }
  }

  const openDelete = (id) => {
    setEditingId(null)
    setDeletingId(id)
    setDeletionReason('')
  }
  const softDelete = async (id) => {
    if (!deletionReason.trim()) { alert('삭제 이유를 입력해 주세요.'); return }
    setDelBusy(true)
    try {
      await updateAt(roomCode, `articles/${id}`, {
        status: 'deleted',
        deletedByTeacher: true,
        deletionReason: deletionReason.trim(),
        deletedAt: Date.now(),
      })
      setDeletingId(null)
      setDeletionReason('')
    } catch (err) { alert('삭제 실패: ' + err.message) }
    finally { setDelBusy(false) }
  }

  // 단축키 (대기 첫 항목)
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const first = allArticles.find((a) => a.status === 'pending')
      if (!first) return
      if (e.key === 'Enter') { e.preventDefault(); approve(first.id) }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); reject(first.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allArticles]) // eslint-disable-line react-hooks/exhaustive-deps

  const FILTERS = [
    { v: 'pending',  label: `대기 ${counts.pending}` },
    { v: 'approved', label: `승인 ${counts.approved}` },
    { v: 'reported', label: `신고 ${counts.reported}`, highlight: counts.reported > 0 },
    { v: 'deleted',  label: `삭제 ${counts.deleted}` },
    { v: 'all',      label: '전체' },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-bold text-blue-800">📰 기사 관리</h3>
        <span className="text-xs text-gray-400 hidden sm:inline">⌘+Enter 승인 / ⌘+R 반려 (첫 대기)</span>
        <div className="flex gap-1 ml-auto text-xs flex-wrap">
          {FILTERS.map(({ v, label, highlight }) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded font-semibold ${
                filter === v
                  ? 'bg-blue-600 text-white'
                  : highlight
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
        {articles.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-6">표시할 기사가 없어요.</li>
        )}

        {articles.map((a) => {
          const group = a.authorGroupId ? groups[a.authorGroupId] : null
          const statusBadge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
          const reportCount = Object.keys(a.reports || {}).length
          const isEditing  = editingId  === a.id
          const isDeleting = deletingId === a.id

          return (
            <li key={a.id} className={`border rounded-xl p-3 text-sm space-y-2 ${
              a.status === 'deleted' ? 'bg-gray-50 opacity-70' : 'bg-white'
            }`}>
              {/* 헤더 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold leading-tight truncate">{a.headline}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.authorNumber}번 {a.authorNickname}
                    {group && ` · ${group.name}`}
                    {' · '}
                    <span className={`font-semibold ${statusBadge.cls}`}>{statusBadge.label}</span>
                  </p>
                </div>
                {reportCount > 0 && (
                  <span className="shrink-0 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                    🚩 {reportCount}건
                  </span>
                )}
              </div>

              {/* 본문 (수정 모드가 아닐 때) — 누르면 전체 펼침 */}
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setOpenBodyId(openBodyId === a.id ? null : a.id)}
                  className="w-full text-left"
                  title={openBodyId === a.id ? '접기' : '전체 보기'}
                >
                  <p className={`text-xs text-gray-600 whitespace-pre-wrap ${openBodyId === a.id ? '' : 'line-clamp-3'}`}>{a.body}</p>
                  {(a.body || '').length > 80 && (
                    <span className="text-[10px] text-blue-500 font-bold">{openBodyId === a.id ? '▲ 접기' : '▼ 전체 보기'}</span>
                  )}
                </button>
              )}

              {/* 삭제 이유 표시 */}
              {a.status === 'deleted' && a.deletionReason && (
                <p className="text-xs text-gray-500 bg-gray-100 rounded-lg px-2 py-1">
                  <span className="font-bold">삭제 이유:</span> {a.deletionReason}
                </p>
              )}

              {/* 신고 목록 */}
              {filter === 'reported' && reportCount > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 space-y-0.5">
                  {Object.entries(a.reports || {}).map(([sid, r]) => (
                    <p key={sid} className="text-[11px] text-rose-700">
                      · {r.reason}
                    </p>
                  ))}
                </div>
              )}

              {/* 인라인 수정 폼 */}
              {isEditing && (
                <div className="space-y-2 pt-1 border-t">
                  <input
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg font-bold"
                    placeholder="헤드라인"
                    maxLength={30}
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg resize-none"
                    placeholder="본문"
                    maxLength={400}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => saveEdit(a.id)}
                      disabled={editBusy}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {editBusy ? '저장 중...' : '수정 완료'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 삭제 이유 입력 폼 */}
              {isDeleting && (
                <div className="space-y-2 pt-1 border-t border-red-100">
                  <p className="text-xs font-bold text-red-700">삭제 이유 (학생에게 표시되지 않음)</p>
                  <textarea
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm border border-red-200 rounded-lg resize-none"
                    placeholder="이 기사를 삭제하는 이유를 입력하세요"
                    maxLength={200}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => softDelete(a.id)}
                      disabled={delBusy}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {delBusy ? '삭제 중...' : '삭제 확인'}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              {!isEditing && !isDeleting && (
                <div className="flex gap-1 justify-end flex-wrap pt-1 border-t border-gray-50">
                  {a.status !== 'approved' && a.status !== 'deleted' && (
                    <button onClick={() => approve(a.id)} className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      승인
                    </button>
                  )}
                  {a.status !== 'rejected' && a.status !== 'deleted' && (
                    <button onClick={() => reject(a.id)} className="px-2.5 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
                      반려
                    </button>
                  )}
                  {(a.status === 'rejected' || a.status === 'approved') && (
                    <button onClick={() => restore(a.id)} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      대기로
                    </button>
                  )}
                  {a.status === 'deleted' ? (
                    <>
                      <button onClick={() => restore(a.id)} className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                        복원
                      </button>
                      <button onClick={() => hardDel(a.id)} className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                        완전 삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openEdit(a)} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                        수정
                      </button>
                      <button onClick={() => openDelete(a.id)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                        삭제
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ArticleApprovalQueue
