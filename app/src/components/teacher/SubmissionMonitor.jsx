import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import SubmissionDetailModal from './SubmissionDetailModal'
import SubmissionTimeline from './SubmissionTimeline'

const TABS = [
  { id: 'timeline', label: '🕒 시간별 모아보기', path: null },
  { id: 'poster', label: '🖼️ 캠페인 포스터', path: 'groups' },
  { id: 'article', label: '📰 여론판 기사', path: 'articles' },
  { id: 'candidate', label: '🎤 후보 등록', path: 'candidates' },
  { id: 'support', label: '🤝 지지 선언', path: 'candidateSupportStatements' },
  { id: 'link', label: '📎 자료 링크', path: 'links' },
  { id: 'debatePrep', label: '📝 토론 준비카드', path: 'debateSessions' },
  { id: 'debateScript', label: '🎙️ 토론 대본', path: 'debateSessions' },
  { id: 'bill', label: '📜 법안 발의', path: 'bills' },
  { id: 'case', label: '⚖️ 소송/변론', path: 'judicialCases' },
  { id: 'reflection', label: '📝 정리글', path: 'reflections' },
]

// 빈 값은 (빈칸)으로 — 양식 항목을 모두 보여주기 위함
const blank = (v) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '(빈칸)')
const hasVal = (v) => v !== undefined && v !== null && String(v).trim() !== ''

export default function SubmissionMonitor() {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const [activeTab, setActiveTab] = useState('article')
  const [dataMap, setDataMap] = useState({})
  const [viewingPoster, setViewingPoster] = useState(null)
  const [topicFilter, setTopicFilter] = useState('all')

  useEffect(() => {
    if (!roomCode) return
    const currentTab = TABS.find(t => t.id === activeTab)
    if (!currentTab || !currentTab.path) return // 시간별 탭은 자체 구독

    const u = subscribe(roomCode, currentTab.path, (d) => setDataMap(d || {}))
    return () => u?.()
  }, [roomCode, activeTab])

  const items = useMemo(() => {
    if (activeTab === 'debatePrep') {
      const allCards = []
      Object.entries(dataMap).forEach(([sid, session]) => {
        Object.entries(session.prepCards || {}).forEach(([cid, card]) => {
          allCards.push({ id: cid, ...card, sessionTitle: session.title })
        })
      })
      return allCards.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    }
    if (activeTab === 'debateScript') {
      const allScripts = []
      Object.entries(dataMap).forEach(([sid, session]) => {
        Object.entries(session.scripts || {}).forEach(([sideId, script]) => {
          allScripts.push({ id: `${sid}_${sideId}`, ...script, sideId, sessionTitle: session.title })
        })
      })
      return allScripts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    }
    return Object.entries(dataMap)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [dataMap, activeTab])

  // 토론 주제(세션)별 필터 — 토론 준비카드/대본 탭에서 제공
  const supportsTopicFilter = activeTab === 'debatePrep' || activeTab === 'debateScript'
  const topicOptions = useMemo(() => {
    if (!supportsTopicFilter) return []
    const set = new Set()
    items.forEach((it) => { if (it.sessionTitle) set.add(it.sessionTitle) })
    return Array.from(set)
  }, [items, supportsTopicFilter])

  const visibleItems = useMemo(() => {
    if (!supportsTopicFilter || topicFilter === 'all') return items
    return items.filter((it) => (it.sessionTitle || '') === topicFilter)
  }, [items, supportsTopicFilter, topicFilter])

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 탭 바 */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setDataMap({}) // 탭 전환 시 이전 데이터 잠깐 비움
              setTopicFilter('all')
            }}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <SubmissionTimeline />
        </div>
      )}

      {/* 보조 필터 — 토론 주제(세션)별 */}
      {activeTab !== 'timeline' && supportsTopicFilter && topicOptions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap -mt-1">
          <span className="text-[10px] font-black text-slate-400 mr-1">토론 주제</span>
          <button
            onClick={() => setTopicFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
              topicFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            전체 ({items.length})
          </button>
          {topicOptions.map((title) => {
            const count = items.filter((it) => (it.sessionTitle || '') === title).length
            return (
              <button
                key={title}
                onClick={() => setTopicFilter(title)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition max-w-[220px] truncate ${
                  topicFilter === title ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
                title={title}
              >
                {title} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* 목록 영역 */}
      {activeTab !== 'timeline' && (
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[400px]">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic">
             <span className="text-4xl mb-2">💨</span>
             <p>아직 제출된 내역이 없습니다.</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <SubmissionItem
              key={item.id}
              type={activeTab}
              data={item}
              groups={groups}
              students={students}
              onExpandImage={setViewingPoster}
            />
          ))
        )}
      </div>
      )}

      {/* 이미지 확대 모달 */}
      {viewingPoster && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setViewingPoster(null)}
          title={viewingPoster.title}
          items={[viewingPoster.url]}
          renderItem={(url) => (
            <img src={url} alt="확대 이미지" className="w-full rounded-2xl shadow-xl" />
          )}
        />
      )}
    </div>
  )
}

function SubmissionItem({ type, data, groups, students, onExpandImage }) {
  const authorGroup = data.authorGroupId ? groups[data.authorGroupId] : data.groupId ? groups[data.groupId] : null
  const authorStudent = data.authorStudentId ? students[data.authorStudentId] : null
  
  // 탭별 렌더링 로직
  const renderContent = () => {
    switch (type) {
      case 'poster':
        if (!data.posterUrl) return null // 포스터 없는 모둠은 스킵
        return (
          <div className="flex gap-4">
             <div 
               className="w-24 h-32 shrink-0 bg-slate-100 rounded-lg overflow-hidden border cursor-zoom-in hover:opacity-80 transition-opacity"
               onClick={() => data.posterUrl && onExpandImage?.({ title: `${data.name} 캠페인 포스터`, url: data.posterUrl })}
             >
                <img src={data.posterUrl} alt="포스터" className="w-full h-full object-cover" />
             </div>
             <div className="flex flex-col justify-between py-1">
                <div>
                   <h4 className="font-black text-slate-900 text-sm">{data.name} 캠페인 포스터</h4>
                   <p className="text-[10px] text-slate-400 mt-1">주제: {data.topic || '없음'}</p>
                </div>
                <div className="text-[10px] text-slate-400">
                   {Object.keys(data.members || {}).length}명 활동 중
                </div>
             </div>
          </div>
        )
      case 'link':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900 text-sm truncate max-w-[200px]">{data.title}</h4>
               <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                 {data.status === 'approved' ? '승인됨' : '대기'}
               </span>
            </div>
            <a href={data.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline block truncate">
              🔗 {data.url}
            </a>
            <div className="text-[10px] text-slate-400">
              제출: {data.authorNickname || '익명'}
            </div>
          </div>
        )
      case 'debatePrep': {
        const prepFields = [
          ['핵심 주장/입장', data.mainClaim],
          ['근거·자료', data.evidence],
          ['반박/허점', data.rebuttal],
          ['예상 질문·대응', data.counterRebuttal],
        ]
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-black text-slate-900 text-sm">{data.studentNumber}번 {data.studentName} 카드</h4>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold shrink-0 max-w-[160px] truncate" title={data.sessionTitle}>{data.sessionTitle}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 mt-1">
              {prepFields.map(([label, val]) => (
                <div key={label} className="text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-600">{label}:</span>{' '}
                  <span className={hasVal(val) ? 'text-slate-800 whitespace-pre-wrap' : 'text-slate-300 italic'}>{blank(val)}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-400">
              {data.groupName || '모둠 미상'} · {blank(data.stance)} 입장
            </div>
          </div>
        )
      }
      case 'debateScript':
        return (
          <div className="space-y-2">
             <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900 text-sm">{data.sideId === 'pro' ? '찬성' : data.sideId === 'con' ? '반대' : data.sideId} 대본</h4>
               <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-bold">{data.sessionTitle}</span>
            </div>
            <p className={`text-xs whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 ${hasVal(data.body) ? 'text-slate-700' : 'text-slate-300 italic'}`}>
               {blank(data.body)}
            </p>
            <div className="text-[10px] text-slate-400">
               마지막 작성: {data.lastAuthor || '알 수 없음'}
            </div>
          </div>
        )
      case 'article':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${data.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                 {data.status === 'approved' ? '게시 중' : '대기'}
               </span>
               <h4 className="font-black text-slate-900">{data.headline}</h4>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{data.body}</p>
            <div className="text-[10px] text-slate-400 flex justify-between pt-1">
              <span>{authorGroup?.name || '모둠 미상'} · {data.authorNickname || '작성자'}</span>
              <span>{new Date(data.createdAt).toLocaleString()}</span>
            </div>
          </div>
        )
      case 'candidate':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
               <h4 className="font-black text-rose-800 text-base">🎤 {data.leaderNickname} 캠프 공약</h4>
               <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold">후보 등록</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <p className="text-[9px] font-black text-rose-400 uppercase mb-1">슬로건</p>
                <p className="text-sm font-bold text-rose-900">"{data.slogan}"</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">대표 공약</p>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{data.promise}</p>
              </div>
            </div>
            <div className="text-[10px] text-slate-400">
              {authorGroup?.name} ({data.leaderNumber}번 {data.leaderNickname})
            </div>
          </div>
        )
      case 'support':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900 text-sm">{data.title}</h4>
               <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">지지 선언</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-600 border-l-2 border-indigo-200 pl-2 py-0.5 italic">"{data.claim}"</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2.5 rounded-lg">{data.evidence}</p>
            </div>
            <div className="text-[10px] text-slate-400">
              {data.authorNumber}번 {data.authorNickname} → {groups[data.candidateGroupId]?.name || '대상 후보'}
            </div>
          </div>
        )
      case 'bill':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900">{data.title}</h4>
               <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                 {data.status === 'passed' ? '가결됨' : data.status === 'rejected' ? '부결됨' : '심사 중'}
               </span>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{data.body}</p>
            <div className="text-[10px] text-slate-400">
              발의: {groups[data.proposerGroupId]?.name || '의원'}
            </div>
          </div>
        )
      case 'reflection':
        return (
          <div className="space-y-2">
             <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900">활동 소감</h4>
               <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">정리글</span>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{data.body}</p>
            <div className="text-[10px] text-slate-400">
              {authorStudent?.number}번 {authorStudent?.nickname}
            </div>
          </div>
        )
       case 'case':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
               <h4 className="font-black text-slate-900">{data.title || '사건'}</h4>
               <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">{data.caseType === 'criminal' ? '형사' : '민사'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
              <p className="text-[10px] font-black text-slate-400">사건 내용</p>
              <p className="text-xs text-slate-700">{data.content}</p>
            </div>
            <div className="text-[10px] text-slate-400">
              {data.plaintiffName} vs {data.defendantName}
            </div>
          </div>
        )
      default:
        return <pre className="text-[10px]">{JSON.stringify(data, null, 2)}</pre>
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      {renderContent()}
    </div>
  )
}
