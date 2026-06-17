import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * 제출물(작성물)을 날짜·시간순으로 한데 모아 보는 타임라인.
 * 여러 노드를 한 번에 구독해 { time, type, author, brief, detail }로 정규화하고,
 * 날짜별 섹션으로 묶어 시간 역순 정렬. 항목을 누르면 본문을 펼쳐 본다.
 */
const SOURCES = ['articles', 'reflections', 'bills', 'policies', 'candidates', 'links', 'debateSessions']

const pad = (n) => String(n).padStart(2, '0')
const dateKeyOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const timeLabelOf = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const dateLabelOf = (key) => {
  const [y, m, d] = key.split('-')
  const wk = ['일', '월', '화', '수', '목', '금', '토'][new Date(Number(y), Number(m) - 1, Number(d)).getDay()]
  return `${Number(m)}월 ${Number(d)}일 (${wk})`
}

const timeOf = (item) => Number(
  item.submittedAt || item.finalizedAt || item.registeredAt || item.approvedAt || item.createdAt || item.updatedAt || item.at || 0
)

export default function SubmissionTimeline() {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const [data, setData] = useState({})
  const [dateFilter, setDateFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    if (!roomCode) return undefined
    const unsubs = SOURCES.map((src) => subscribe(roomCode, src, (d) => setData((prev) => ({ ...prev, [src]: d || {} }))))
    return () => unsubs.forEach((u) => u?.())
  }, [roomCode])

  const authorOf = (item) => {
    const sid = item.authorStudentId || item.submittedByStudentId || item.studentId || item.leaderStudentId
    if (sid && students?.[sid]) { const s = students[sid]; return `${s.number ? `${s.number}번 ` : ''}${s.nickname || ''}`.trim() }
    if (item.studentName) return `${item.studentNumber ? `${item.studentNumber}번 ` : ''}${item.studentName}`
    if (item.authorNickname) return item.authorNickname
    if (item.leaderNickname) return item.leaderNickname
    if (item.lastAuthor) return item.lastAuthor
    const gid = item.authorGroupId || item.groupId || item.proposerGroupId
    if (gid && groups?.[gid]) return groups[gid].name || '모둠'
    return '익명'
  }

  const items = useMemo(() => {
    const out = []
    const push = (id, type, item, brief, detail) => {
      const time = timeOf(item)
      if (!time) return
      out.push({ id, type, time, author: authorOf(item), brief: brief || '(제목 없음)', detail: detail || '' })
    }
    // 단순 노드들
    Object.entries(data.articles || {}).forEach(([id, a]) => { if (a?.status !== 'deleted') push('art_' + id, '📰 기사', a, a.headline, a.body) })
    Object.entries(data.reflections || {}).forEach(([id, a]) => push('ref_' + id, '📝 정리글', a, a.title || '정리글', a.finalEssay || a.body || a.pledge))
    Object.entries(data.bills || {}).forEach(([id, a]) => push('bill_' + id, '📜 법안', a, a.title, a.body))
    Object.entries(data.policies || {}).forEach(([id, a]) => {
      const f = a.policyFields || {}
      push('pol_' + id, '🏢 정책·시행령', a, f.title || a.ministryName || '정책안', [f.problem, f.ordinance || f.content].filter(Boolean).join('\n'))
    })
    Object.entries(data.candidates || {}).forEach(([id, a]) => push('cand_' + id, '🎤 후보등록', a, `${a.leaderNickname || '후보'} 캠프`, (a.pledges || []).filter(Boolean).join('\n')))
    Object.entries(data.links || {}).forEach(([id, a]) => push('link_' + id, '📎 자료링크', a, a.title || a.url, a.url))
    // 토론 세션 내부: 준비카드 + 대본
    Object.values(data.debateSessions || {}).forEach((session) => {
      const stitle = session?.title || '토론'
      Object.entries(session?.prepCards || {}).forEach(([id, c]) => push('prep_' + id, '📝 토론카드', c, `${stitle} — ${c.mainClaim || '주장'}`, [c.mainClaim, c.evidence, c.rebuttal, c.counterRebuttal].filter(Boolean).join('\n')))
      Object.entries(session?.scripts || {}).forEach(([sid, sc]) => push('scr_' + sid, '🎙️ 토론대본', sc, `${stitle} — 대본`, sc.body))
    })
    return out.sort((a, b) => b.time - a.time)
  }, [data, students, groups]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateKeys = useMemo(() => {
    const set = new Set(items.map((x) => dateKeyOf(x.time)))
    return Array.from(set).sort().reverse()
  }, [items])

  const visible = useMemo(() => (dateFilter === 'all' ? items : items.filter((x) => dateKeyOf(x.time) === dateFilter)), [items, dateFilter])

  const byDate = useMemo(() => {
    const map = {}
    visible.forEach((x) => { const k = dateKeyOf(x.time); (map[k] = map[k] || []).push(x) })
    return map
  }, [visible])
  const orderedDates = useMemo(() => Object.keys(byDate).sort().reverse(), [byDate])

  return (
    <div className="flex flex-col gap-3">
      {/* 날짜 필터 */}
      {dateKeys.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 mr-1">날짜</span>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${dateFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            전체 ({items.length})
          </button>
          {dateKeys.map((k) => (
            <button
              key={k}
              onClick={() => setDateFilter(k)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${dateFilter === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              {dateLabelOf(k)} ({items.filter((x) => dateKeyOf(x.time) === k).length})
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[400px]">
        {orderedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic">
            <span className="text-4xl mb-2">🕒</span>
            <p>아직 작성된 제출물이 없습니다.</p>
          </div>
        ) : (
          orderedDates.map((dk) => (
            <div key={dk} className="space-y-2">
              <div className="sticky top-0 bg-white/95 backdrop-blur z-10 py-1">
                <h3 className="text-sm font-black text-indigo-900 flex items-center gap-2">
                  📅 {dateLabelOf(dk)}
                  <span className="text-[11px] font-bold text-slate-400">{byDate[dk].length}건</span>
                </h3>
              </div>
              <ul className="space-y-1.5">
                {byDate[dk].map((x) => {
                  const open = openId === x.id
                  return (
                    <li key={x.id}>
                      <button
                        onClick={() => setOpenId(open ? null : x.id)}
                        className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] font-black text-slate-400 tabular-nums w-10">{timeLabelOf(x.time)}</span>
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{x.type}</span>
                          <span className="shrink-0 text-[11px] font-bold text-slate-600">{x.author}</span>
                          <span className="text-xs text-slate-800 truncate flex-1">{x.brief}</span>
                          <span className="shrink-0 text-[10px] text-slate-300">{open ? '▲' : '▼'}</span>
                        </div>
                        {open && (
                          <p className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {(x.detail || '').trim() || '(내용 없음)'}
                          </p>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
