import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt, pushUnder } from '../../lib/rtdb-helpers'

const TYPE_OPTIONS = [
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'canva',   label: 'Canva',   emoji: '🎨' },
  { id: 'news',    label: '신문',    emoji: '📰' },
  { id: 'other',   label: '기타',    emoji: '🔗' },
]

/**
 * 교사용 — 외부 링크 관리.
 * 1) 학생이 제출한 링크 승인/반려/삭제 (pending → approved/rejected)
 * 2) 교사가 직접 URL 입력해서 즉시 게시 (토글 펼침)
 */
function LinkApprovalQueue({ initialFilter = 'pending' } = {}) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const [linksMap, setLinksMap] = useState({})
  const [filter, setFilter] = useState(initialFilter) // 'pending'|'approved'|'all'

  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  // 교사 직접 추가 폼 상태
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState('youtube')
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'links', (d) => setLinksMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const links = useMemo(() => {
    const arr = Object.entries(linksMap)
      .map(([id, l]) => ({ id, ...l }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (filter === 'all') return arr
    return arr.filter((l) => l.status === filter)
  }, [linksMap, filter])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    for (const l of Object.values(linksMap)) {
      c[l.status] = (c[l.status] || 0) + 1
    }
    return c
  }, [linksMap])

  const approve = (id) => updateAt(roomCode, `links/${id}`, { status: 'approved', approvedAt: Date.now() })
  const reject = (id) => updateAt(roomCode, `links/${id}`, { status: 'rejected' })
  const restore = (id) => updateAt(roomCode, `links/${id}`, { status: 'pending' })
  const del = (id) => {
    if (!confirm('이 링크를 영구 삭제할까요?')) return
    removeAt(roomCode, `links/${id}`)
  }

  // 교사가 직접 링크 추가 → 즉시 approved
  const handleAddByTeacher = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!/^https?:\/\//.test(addUrl.trim())) {
      setAddError('https:// 또는 http:// 로 시작하는 주소를 입력해 주세요.')
      return
    }
    setAddBusy(true)
    try {
      await pushUnder(roomCode, 'links', {
        type: addType,
        url: addUrl.trim(),
        title: addTitle.trim() || '(제목 없음)',
        groupId: null,
        submitterStudentId: 'teacher',
        submitterNumber: 0,
        submitterNickname: '선생님',
        addedByTeacher: true,
        status: 'approved',
        approvedAt: Date.now(),
      })
      setAddTitle('')
      setAddUrl('')
      // 폼은 유지(연속 추가 편하게). 유형도 그대로.
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-bold text-indigo-800">📎 링크 관리</h3>
        <div className="flex gap-1 ml-auto text-xs">
          {[
            ['pending', `대기 ${counts.pending || 0}`],
            ['approved', `승인 ${counts.approved || 0}`],
            ['all', '전체'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded ${
                filter === v
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 교사 직접 추가 토글 */}
      <div className="mb-3 border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="w-full px-3 py-2 text-sm text-left bg-emerald-50 hover:bg-emerald-100 font-semibold text-emerald-800 flex items-center justify-between"
        >
          <span>+ 선생님이 직접 추가</span>
          <span className="text-xs">{addOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {addOpen && (
          <form onSubmit={handleAddByTeacher} className="p-3 space-y-2 bg-white">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">유형</p>
              <div className="grid grid-cols-3 gap-1">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setAddType(t.id)}
                    className={`py-1.5 text-xs rounded border-2 font-semibold transition ${
                      addType === t.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="제목 (예: 산업화 시대 다큐 영상)"
              maxLength={60}
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {addError && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {addError}
              </p>
            )}
            <button
              type="submit"
              disabled={addBusy || !addUrl.trim()}
              className="w-full py-1.5 text-sm rounded bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              {addBusy ? '추가 중...' : '바로 게시 (승인 절차 없이)'}
            </button>
            <p className="text-[11px] text-gray-500">
              교사가 추가한 링크는 즉시 시민광장 ‘링크 자료실’에 게시됩니다.
            </p>
          </form>
        )}
      </div>

      <ul className="space-y-2 max-h-[420px] overflow-y-auto">
        {links.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-6">
            표시할 링크가 없어요.
          </li>
        )}
        {links.map((l) => {
          const group = l.groupId ? groups[l.groupId] : null
          return (
            <li
              key={l.id}
              className="bg-white border rounded-lg p-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {l.type === 'youtube' ? '▶️' : l.type === 'canva' ? '🎨' : l.type === 'vimeo' ? '🎬' : '🔗'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{l.title}</div>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-indigo-600 truncate hover:underline"
                  >
                    {l.url}
                  </a>
                  <div className="text-xs text-gray-500 mt-1">
                    {l.addedByTeacher
                      ? '👩‍🏫 선생님 추가'
                      : `${l.submitterNumber}번 ${l.submitterNickname}`}
                    {group && ` · ${group.name}`}
                    {' · '}
                    <span
                      className={`font-semibold ${
                        l.status === 'approved'
                          ? 'text-emerald-600'
                          : l.status === 'rejected'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {l.status === 'approved'
                        ? '승인됨'
                        : l.status === 'rejected'
                        ? '반려됨'
                        : '대기 중'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex gap-1 justify-end flex-wrap">
                {l.status !== 'approved' && (
                  <button
                    onClick={() => approve(l.id)}
                    className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    승인
                  </button>
                )}
                {l.status !== 'rejected' && (
                  <button
                    onClick={() => reject(l.id)}
                    className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                  >
                    반려
                  </button>
                )}
                {l.status !== 'pending' && (
                  <button
                    onClick={() => restore(l.id)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    대기로
                  </button>
                )}
                <button
                  onClick={() => del(l.id)}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  삭제
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default LinkApprovalQueue
