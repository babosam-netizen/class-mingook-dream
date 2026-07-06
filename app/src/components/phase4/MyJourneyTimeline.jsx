import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'
import PosterMedia from '../phase1/PosterMedia'
import { calculateRanks } from '../../lib/election'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { resolveImageUrl } from '../../lib/legacy-image'
import { getDebatePrepCardConfig } from '../debate/tools/DebatePrepCard'
import { getStudentJudicialSide } from '../../lib/judicial-teams'

// 사법 역할별 '내 대본' 발화자 (JudicialVerdictTab과 동일)
const JUD_SCRIPT_SPEAKERS = { judge: ['judge'], prosecution: ['prosecution', 'witness'], defense: ['defense', 'defendant'] }
const JUD_SPEAKER_LABEL = { judge: '⚖️ 판사', prosecution: '👨‍💼 검사', defense: '🛡️ 변호인', witness: '👤 증인', defendant: '🙍 피고인' }

/**
 * 1단계: 민국에서 나의 발자취 돌아보기
 * - 학생이 수행하여 '학생 분석'에 수집되는 활동들을 1->2->3여정 단계 순서대로 노드로 시각화
 * - 꼬불꼬불(snake) 경로 위에 활동 노드 배치
 * - 노드 클릭 → 카드 모달(활동 전체 펼침 + 우측 상단 별점 + 이전/다음 네비게이션)
 */

const PHASE_META = {
  1: { label: '첫 번째 여정', sub: '시민 광장', emoji: '🏙️', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  2: { label: '두 번째 여정', sub: '선거',      emoji: '🗳️', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
  3: { label: '세 번째 여정', sub: '국정 포털', emoji: '🏛️', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b' },
  4: { label: '네 번째 여정', sub: '시사회',    emoji: '🎬', color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
}

// 여정 섹션 — 3여정(국정포털)은 입법·행정·사법으로 나눠서 보여준다. 각 섹션에 간단한 설명 포함.
const SECTIONS = [
  { key: 'p1', phase: 1, ...PHASE_META[1], label: '첫번째 여정 - 시민광장', emoji: '🏙️',
    desc: '우리 사회의 문제를 찾아 시민으로서 목소리를 내는 단계예요. 슬로건·주장하는 글·국민청원·포스터로 문제를 알리고, 함께 풀 핵심 의제를 정했습니다.' },
  { key: 'p2', phase: 2, ...PHASE_META[2], label: '두번째 여정 - 선거', emoji: '🗳️',
    desc: '우리를 대표할 대통령을 뽑는 단계. 후보 등록·공약·지지 선언·선거 보도를 하고, 한 표를 행사해 민주적 대표 선출을 경험했습니다.' },
  { key: 'p3-leg', phase: 3, branch: 'legislative', ...PHASE_META[3], label: '세번째 여정1 - 입법부', sub: '국회', emoji: '🏛️',
    color: '#0ea5e9', border: '#bae6fd', bg: '#f0f9ff', text: '#075985',
    desc: '국회의 역할. 문제 해결을 위한 법안을 만들고, 본회의에서 토론·표결로 통과시키는 입법 활동입니다.' },
  { key: 'p3-exe', phase: 3, branch: 'executive', ...PHASE_META[3], label: '세번째 여정2 - 행정부', sub: '정부', emoji: '🏢',
    color: '#10b981', border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46',
    desc: '정부의 역할. 통과된 법을 실제로 집행할 정책·시행령·예산을 만들고, 부처끼리 조정했습니다.' },
  { key: 'p3-jud', phase: 3, branch: 'judicial', ...PHASE_META[3], label: '세번째 여정3 - 사법부', sub: '법원', emoji: '⚖️',
    color: '#f43f5e', border: '#fecdd3', bg: '#fff1f2', text: '#9f1239',
    desc: '법원의 역할. 사건을 두고 재판하며 증거·변론·판결로 옳고 그름과 책임을 따져보았습니다.' },
  { key: 'p4', phase: 4, ...PHASE_META[4], label: '네번째 여정 - 시사회', emoji: '🎬',
    desc: '지나온 1~3여정을 돌아보며 내 활동을 정리하고, 카드뉴스로 우리의 이야기를 나누는 단계입니다.' },
]

// 작성 날짜 표기: 5/12(월)
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
function fmtDate(ts) {
  if (!ts || typeof ts !== 'number') return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY[d.getDay()]})`
}

const COLS = 4 // 한 행에 놓이는 노드 수

// ── 별점 컴포넌트
function Stars({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0)
  const sz = size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          className={`${sz} transition-transform hover:scale-125 focus:outline-none leading-none`}
          title={`${n}점`}
        >
          <span style={{ color: (hover || value) >= n ? '#facc15' : '#d1d5db' }}>★</span>
        </button>
      ))}
    </div>
  )
}

// ── 활동 카드 모달
function ActivityModal({ activities, index, ratings, onRate, onClose, onPrev, onNext, myStudentId, candidatesMap, groups }) {
  const act = activities[index]
  if (!act) return null
  const meta = PHASE_META[act.phase]

  // 키보드 ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative z-10 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        style={{ background: meta.bg, border: `3px solid ${meta.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 & 별점 영역 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100/50 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-2xl">{act.icon || meta.emoji}</span>
              <span className="text-[11px] font-black px-3 py-1 rounded-full uppercase border-2 shadow-sm"
                style={{ background: meta.bg, borderColor: meta.color, color: meta.color }}>
                ✨ 발자취 {act.globalStep} · {act.stepLabel}
              </span>
              {fmtDate(act.ts) && (
                <span className="text-[11px] font-bold text-gray-400">🗓 {fmtDate(act.ts)}</span>
              )}
            </div>
            <h3 className="font-black text-base md:text-lg leading-snug text-gray-800">
              {act.title}
            </h3>
          </div>
          
          {/* 우측 상단 별점 + 닫기 영역 */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* 별점 컴포넌트 */}
              <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-2xl border border-gray-200/50 shadow-sm flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-gray-500 leading-none">별점 평가</span>
                <Stars value={ratings[act.key] || 0} onChange={(v) => onRate(act.key, v)} size="md" />
              </div>
              
              {/* 닫기 버튼 */}
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-sm shadow-sm transition active:scale-95">
                ✕
              </button>
            </div>
            {ratings[act.key] > 0 && (
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                평가함: ⭐{ratings[act.key]}점
              </span>
            )}
          </div>
        </div>

        {/* 중앙 본문 (전체 펼침 상태 및 시각화 지원) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          
          {/* 1. 포스터인 경우 미디어 미리보기 */}
          {act.type === 'poster' && act.poster && (
            <div className="rounded-2xl overflow-hidden shadow border bg-white aspect-[4/3] relative">
              <PosterMedia 
                poster={act.poster} 
                className="w-full h-full"
                imageClassName="w-full h-full object-contain bg-slate-50"
              />
            </div>
          )}

          {/* 2. 링크(뉴스/영상/캔바)인 경우 카드 형태 시각화 */}
          {act.type === 'link' && act.link && (() => {
            const l = act.link
            const isCanva = l.url && l.url.toLowerCase().includes('canva.')
            return (
              <div className="space-y-3">
                {/* 캔바 임베드 또는 썸네일 지원 */}
                {isCanva ? (
                  <div className="rounded-2xl overflow-hidden shadow border bg-slate-50 aspect-[4/3] relative">
                    <PosterMedia 
                      poster={{ posterCanvaUrl: l.url }} 
                      className="w-full h-full"
                    />
                  </div>
                ) : l.thumbnail ? (
                  <img src={l.thumbnail} alt="기사 썸네일" className="w-full h-40 object-cover rounded-2xl shadow-sm border bg-white" />
                ) : null}

                <div className="bg-white/85 p-4 rounded-2xl border flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-2 py-0.5 rounded-full">
                      {l.type === 'news' ? '📰 신문기사' : '🎬 영상·캔바'}
                    </span>
                    {l.source && (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        출처: {l.source}
                      </span>
                    )}
                  </div>
                  
                  <a href={l.url} target="_blank" rel="noreferrer" 
                    className="text-xs font-black text-blue-600 hover:underline break-all flex items-center gap-1">
                    🔗 원본 자료 링크 바로가기 ↗
                  </a>
                </div>
              </div>
            )
          })()}

          {/* 3. 후보자 등록 정보 전체 시각화 */}
          {act.type === 'candidate' && act.candidate && (() => {
            const c = act.candidate
            const group = groups?.[c.groupId]
            return (
              <div className="space-y-4">
                {/* 기호 및 모둠 정보 */}
                <div className="bg-white/95 border-2 border-rose-200 rounded-2xl p-5 flex justify-between items-center shadow-md">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wide shadow-2xs">
                        기호 {c.candidateNumber ?? c.leaderNumber ?? '?'}번
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${
                        c.status === 'submitted' 
                          ? 'bg-emerald-55 border-emerald-200 text-emerald-700' 
                          : 'bg-amber-55 border-amber-200 text-amber-700'
                      }`}>
                        {c.status === 'submitted' ? '✓ 최종 제출 완료' : '✍️ 임시 저장 중'}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-gray-900 flex items-center gap-1">
                      👑 {c.leaderNickname || c.candidateName || '미지정'} 후보
                    </h4>
                    {group && <p className="text-xs text-rose-500 font-bold mt-1">🏷️ 모둠: {group.name}</p>}
                  </div>
                </div>

                {/* 출마 선언문 */}
                {c.pamphlet && (
                  <div className="bg-white/95 rounded-2xl p-4 border border-rose-100/50 text-xs text-gray-700 leading-relaxed italic shadow-inner">
                    <span className="block text-[9px] font-bold text-rose-500 not-italic uppercase mb-1.5 tracking-wider">📢 출마 선언문</span>
                    "{c.pamphlet}"
                  </div>
                )}

                {/* 선거 포스터 */}
                {(c.posterCanvaUrl || c.posterUrl) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-gray-500 uppercase block tracking-wider">🖼️ 선거 캠페인 포스터</span>
                    {c.posterCanvaUrl ? (
                      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border bg-slate-50 shadow">
                        <iframe
                          src={formatCanvaEmbedUrl(c.posterCanvaUrl)}
                          loading="lazy"
                          allowFullScreen
                          allow="fullscreen; autoplay"
                          className="absolute inset-0 w-full h-full border-0"
                          title="선거 포스터"
                        />
                      </div>
                    ) : (
                      <img src={resolveImageUrl(c.posterUrl)} alt="선거 포스터" className="w-full rounded-2xl border bg-white shadow-sm" />
                    )}
                  </div>
                )}

                {/* 최우선과제 해결 공약 */}
                {Array.isArray(c.pledges) && c.pledges.filter(Boolean).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase block tracking-wider">✅ 최우선과제 해결 공약</span>
                    <ul className="space-y-2">
                      {c.pledges.filter(Boolean).map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50 shadow-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-black flex items-center justify-center">
                            {i + 1}
                          </span>
                          <p className="text-xs font-semibold text-rose-900 leading-relaxed">{p}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 공약 카드뉴스 */}
                {c.canvaUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-gray-500 uppercase block tracking-wider">🎨 공약 카드뉴스 (자료집)</span>
                    <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border bg-slate-50 shadow">
                      <iframe
                        src={formatCanvaEmbedUrl(c.canvaUrl)}
                        loading="lazy"
                        allowFullScreen
                        allow="fullscreen; autoplay"
                        className="absolute inset-0 w-full h-full border-0"
                        title="공약 카드뉴스"
                      />
                    </div>
                  </div>
                )}

                {/* 홍보영상 */}
                {c.videoCanvaUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-gray-500 uppercase block tracking-wider">🎬 후보 홍보 동영상</span>
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border bg-slate-900 shadow">
                      <iframe
                        src={formatCanvaEmbedUrl(c.videoCanvaUrl)}
                        allowFullScreen
                        allow="fullscreen; autoplay; encrypted-media"
                        className="absolute inset-0 w-full h-full border-0"
                        title="홍보영상"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* 4. 설문 여론조사 결과 시각화 (나의 선택 + 전체 결과) */}
          {act.type === 'poll' && act.rawPoll && (() => {
            const p = act.rawPoll
            const votes = p.votes || {}
            const totalVotes = Object.keys(votes).length
            const normalizedOptions = (p.options || []).map((opt, index) => {
              if (typeof opt === 'string') return { id: `opt_${index}`, label: opt }
              return { id: opt.id || `opt_${index}`, label: opt.label || opt.id || '' }
            })
            
            const counts = {}
            Object.values(votes).forEach((v) => {
              if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
            })

            const myVoteData = votes[myStudentId]
            const myVoteId = myVoteData?.optionId

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>📊 전체 설문 조사 결과</span>
                  <span>총 {totalVotes}명 참여</span>
                </div>
                <div className="space-y-3.5">
                  {normalizedOptions.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myVoteId === o.id
                    return (
                      <div key={o.id} className={`space-y-1.5 p-3 rounded-2xl border transition-all duration-300 ${
                        isMine 
                          ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-100 shadow-md transform scale-[1.01]' 
                          : 'bg-white/40 border-gray-150'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-700 font-black text-[13px] flex items-center gap-1' : 'flex items-center gap-1'}>
                            {isMine && <span className="text-indigo-500">✨</span>}
                            {o.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isMine && (
                              <span className="text-[9px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2 py-0.5 rounded-full font-black shadow-xs tracking-wider">
                                내 선택
                              </span>
                            )}
                            <span className={`font-mono ${isMine ? 'text-indigo-800 text-sm font-black' : 'text-gray-500'}`}>
                              {cnt}표 ({pct}%)
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full h-4 bg-gray-150 rounded-full overflow-hidden border border-gray-200">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            isMine 
                              ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600' 
                              : 'bg-indigo-400'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 5. 토론 여론조사 (사전/사후) 비교 시각화 */}
          {act.type === 'debate_poll' && act.debateSession && (() => {
            const s = act.debateSession
            const prePoll = s.stancePoll?.pre || {}
            const postPoll = s.stancePoll?.post || {}
            
            const baseOptions = Array.isArray(prePoll.options) && prePoll.options.length 
              ? prePoll.options 
              : ['찬성', '반대', '중립']
            const options = baseOptions.map(o => typeof o === 'string' ? o : o.label || o.id || '')

            const preVotes = prePoll.votes || {}
            const postVotes = postPoll.votes || {}
            const preTotal = Object.keys(preVotes).length
            const postTotal = Object.keys(postVotes).length

            const preCounts = {}
            const postCounts = {}
            options.forEach(o => { preCounts[o] = 0; postCounts[o] = 0 })

            Object.values(preVotes).forEach(v => { if (v?.option && preCounts[v.option] !== undefined) preCounts[v.option]++ })
            Object.values(postVotes).forEach(v => { if (v?.option && postCounts[v.option] !== undefined) postCounts[v.option]++ })

            const myPre = preVotes[myStudentId]?.option || null
            const myPost = postVotes[myStudentId]?.option || null
            const postReason = postVotes[myStudentId]?.reason || ''

            const STANCE_COLOR_MAP = {
              '찬성': 'bg-emerald-500', '유죄': 'bg-emerald-500',
              '반대': 'bg-rose-500', '무죄': 'bg-rose-500',
              '중립': 'bg-slate-400', '기타': 'bg-slate-400'
            }

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 토론 전 */}
                  <div className="bg-white/80 border p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                      <span>🗳️ 토론 전 입장</span>
                      <span>참여 {preTotal}명</span>
                    </div>
                    <div className="space-y-3.5">
                      {options.map((o) => {
                        const cnt = preCounts[o] || 0
                        const pct = preTotal ? Math.round((cnt / preTotal) * 100) : 0
                        const isMine = myPre === o
                        return (
                          <div key={o} className={`space-y-1.5 p-2 rounded-xl border transition-all duration-300 ${
                            isMine 
                              ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-50 shadow-sm' 
                              : 'bg-white/40 border-gray-100'
                          }`}>
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className={isMine ? 'text-indigo-700 font-black text-xs flex items-center gap-1' : 'flex items-center gap-1'}>
                                {isMine && <span className="text-indigo-500">✨</span>}
                                {o}
                              </span>
                              <div className="flex items-center gap-1">
                                {isMine && (
                                  <span className="text-[8px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-1.5 py-0.5 rounded font-black shadow-2xs">
                                    내 선택
                                  </span>
                                )}
                                <span className={`font-mono ${isMine ? 'text-indigo-800 font-black' : 'text-gray-500'}`}>
                                  {cnt}표 ({pct}%)
                                </span>
                              </div>
                            </div>
                            <div className="relative w-full h-3 bg-gray-150 rounded-full overflow-hidden border border-gray-100">
                              <div className={`h-full rounded-full transition-all duration-1000 ${
                                isMine 
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500' 
                                  : STANCE_COLOR_MAP[o] || 'bg-indigo-400'
                              }`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 토론 후 */}
                  <div className="bg-white/80 border p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                      <span>🗳️ 토론 후 입장</span>
                      <span>참여 {postTotal}명</span>
                    </div>
                    <div className="space-y-3.5">
                      {options.map((o) => {
                        const cnt = postCounts[o] || 0
                        const pct = postTotal ? Math.round((cnt / postTotal) * 100) : 0
                        const isMine = myPost === o
                        return (
                          <div key={o} className={`space-y-1.5 p-2 rounded-xl border transition-all duration-300 ${
                            isMine 
                              ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-50 shadow-sm' 
                              : 'bg-white/40 border-gray-100'
                          }`}>
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className={isMine ? 'text-indigo-700 font-black text-xs flex items-center gap-1' : 'flex items-center gap-1'}>
                                {isMine && <span className="text-indigo-500">✨</span>}
                                {o}
                              </span>
                              <div className="flex items-center gap-1">
                                {isMine && (
                                  <span className="text-[8px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-1.5 py-0.5 rounded font-black shadow-2xs">
                                    내 선택
                                  </span>
                                )}
                                <span className={`font-mono ${isMine ? 'text-indigo-800 font-black' : 'text-gray-500'}`}>
                                  {cnt}표 ({pct}%)
                                </span>
                              </div>
                            </div>
                            <div className="relative w-full h-3 bg-gray-150 rounded-full overflow-hidden border border-gray-100">
                              <div className={`h-full rounded-full transition-all duration-1000 ${
                                isMine 
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500' 
                                  : STANCE_COLOR_MAP[o] || 'bg-indigo-400'
                              }`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* 내 생각 변화 요약 */}
                {myPost && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-800">📊 내 생각의 변화</h4>
                    <div className="flex items-center gap-2 text-sm justify-center py-1">
                      <div className="bg-white px-4 py-2 rounded-xl border font-bold text-gray-600 text-center min-w-[100px]">
                        <span className="block text-[9px] text-gray-400 font-bold mb-0.5">토론 전</span>
                        {myPre || '미참여'}
                      </div>
                      <span className="text-indigo-400 font-bold text-xl">→</span>
                      <div className="bg-white px-4 py-2 rounded-xl border border-indigo-300 font-black text-indigo-700 text-center min-w-[100px] shadow-sm">
                        <span className="block text-[9px] text-indigo-400 font-bold mb-0.5">토론 후</span>
                        {myPost}
                      </div>
                    </div>
                    {myPre && myPre !== myPost && (
                      <p className="text-[10px] text-emerald-600 text-center font-black">
                        🔄 토론을 통해 생각이 바뀌었어요!
                      </p>
                    )}
                    {postReason && (
                      <div className="bg-white/80 p-3 rounded-xl border text-xs text-gray-600 mt-2 leading-relaxed">
                        <span className="font-bold text-indigo-800 block mb-1">💡 작성했던 생각(이유):</span>
                        "{postReason}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 6. 대통령 선거 투표 결과 시각화 */}
          {act.type === 'election' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const totalVotes = Object.keys(votes).length
            const ranks = calculateRanks(candidatesMap || {}, votes)
            const myVoteGroupId = votes[myStudentId]?.candidateGroupId

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>🏆 대통령 선거 득표 현황</span>
                  <span>총 투표수 {totalVotes}표</span>
                </div>
                <div className="space-y-3.5">
                  {ranks.map((r, idx) => {
                    const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
                    const isMine = myVoteGroupId === r.groupId
                    const isWinner = idx === 0 && r.count > 0
                    const group = groups?.[r.groupId]
                    
                    return (
                      <div key={r.groupId} className={`space-y-1.5 p-3 rounded-2xl border transition-all duration-300 ${
                        isMine 
                          ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-100 shadow-md transform scale-[1.01]' 
                          : 'bg-white/40 border-gray-150'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-700 font-black text-[13px] flex items-center gap-1' : 'flex items-center gap-1'}>
                            {isWinner && '👑 '}
                            {r.candidateNumber}번 {r.leaderNickname} 후보 ({group?.name || '후보'})
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isMine && (
                              <span className="text-[9px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2 py-0.5 rounded-full font-black shadow-xs">
                                내 투표
                              </span>
                            )}
                            <span className={`font-mono ${isMine ? 'text-indigo-800 text-sm font-black' : 'text-gray-500'}`}>
                              {r.count}표 ({pct}%)
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full h-4 bg-gray-150 rounded-full overflow-hidden border border-gray-200">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            isMine 
                              ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600' 
                              : 'bg-rose-500'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 7. 의회 법안 의결 표결 결과 시각화 */}
          {act.type === 'billvote' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const myChoice = votes[myStudentId]
            const totalVotes = Object.keys(votes).length
            
            const counts = { pro: 0, con: 0, abstain: 0 }
            Object.values(votes).forEach(v => {
              if (counts[v] !== undefined) counts[v]++
            })

            const options = [
              { id: 'pro', label: '✅ 찬성', bg: 'bg-emerald-500' },
              { id: 'con', label: '❌ 반대', bg: 'bg-rose-500' },
              { id: 'abstain', label: '⚪ 기권', bg: 'bg-slate-400' },
            ]

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>🏛️ 법안 표결 집계</span>
                  <span>총 {totalVotes}표</span>
                </div>
                <div className="space-y-3.5">
                  {options.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myChoice === o.id
                    return (
                      <div key={o.id} className={`space-y-1.5 p-3 rounded-2xl border transition-all duration-300 ${
                        isMine 
                          ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-100 shadow-md transform scale-[1.01]' 
                          : 'bg-white/40 border-gray-150'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-700 font-black text-[13px] flex items-center gap-1' : 'flex items-center gap-1'}>
                            {o.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isMine && (
                              <span className="text-[9px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2 py-0.5 rounded-full font-black shadow-xs">
                                내 투표
                              </span>
                            )}
                            <span className={`font-mono ${isMine ? 'text-indigo-800 text-sm font-black' : 'text-gray-500'}`}>
                              {cnt}표 ({pct}%)
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full h-4 bg-gray-150 rounded-full overflow-hidden border border-gray-200">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            isMine 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : o.bg
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 8. 재판 배심원 표결 결과 시각화 */}
          {act.type === 'juryvote' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const myChoice = votes[myStudentId]
            const totalVotes = Object.keys(votes).length

            const counts = { pro: 0, con: 0 }
            Object.values(votes).forEach(v => {
              if (counts[v] !== undefined) counts[v]++
            })

            const options = [
              { id: 'pro', label: '⚖️ 유죄', bg: 'bg-amber-500' },
              { id: 'con', label: '🛡️ 무죄', bg: 'bg-sky-500' },
            ]

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>⚖️ 배심원 평결 집계</span>
                  <span>총 {totalVotes}표</span>
                </div>
                <div className="space-y-3.5">
                  {options.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myChoice === o.id
                    return (
                      <div key={o.id} className={`space-y-1.5 p-3 rounded-2xl border transition-all duration-300 ${
                        isMine 
                          ? 'bg-indigo-50/80 border-indigo-400/80 ring-2 ring-indigo-100 shadow-md transform scale-[1.01]' 
                          : 'bg-white/40 border-gray-150'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-700 font-black text-[13px] flex items-center gap-1' : 'flex items-center gap-1'}>
                            {o.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isMine && (
                              <span className="text-[9px] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2 py-0.5 rounded-full font-black shadow-xs">
                                내 투표
                              </span>
                            )}
                            <span className={`font-mono ${isMine ? 'text-indigo-800 text-sm font-black' : 'text-gray-500'}`}>
                              {cnt}표 ({pct}%)
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full h-4 bg-gray-150 rounded-full overflow-hidden border border-gray-200">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            isMine 
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                              : o.bg
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 9-1. 토론 준비 카드 */}
          {act.type === 'debate_prep' && act.debateCard && (() => {
            const card = act.debateCard
            const s = act.debateSession
            const config = getDebatePrepCardConfig(s)
            const fields = config?.fields || {}
            return (
              <div className="space-y-3">
                <div className="bg-white/95 border-2 border-indigo-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide">
                      입장: {card.stance || '미정'}
                    </span>
                  </div>
                  {Object.entries(fields).map(([key, f]) => {
                    const val = card[key]
                    if (!val) return null
                    return (
                      <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                        <span className="block text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">💡 {f.label}</span>
                        <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">{val}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 9-2. 평가단 최종 종합 평가 */}
          {act.type === 'debate_final_eval' && (
            <div className="bg-white/95 border-2 border-violet-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                <span>⚖️ 평가단 최종 종합 평가</span>
              </div>
              <p className="text-xs font-semibold text-slate-850 leading-relaxed whitespace-pre-wrap">
                {act.content}
              </p>
            </div>
          )}

          {/* 9. 일반 텍스트 콘텐츠 */}
          {act.content && act.type !== 'comment' && act.type !== 'debate_prep' && act.type !== 'debate_final_eval' ? (
            <div className="rounded-2xl p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner border border-gray-100 max-h-[30vh] overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.75)' }}>
              {act.content}
            </div>
          ) : (
            !act.content && act.type !== 'candidate' && act.type !== 'comment' && act.type !== 'debate_prep' && act.type !== 'debate_final_eval' && act.type !== 'polls_group' && act.type !== 'comments_group' && (
              <div className="text-center py-8 text-gray-400 text-xs select-none">
                상세 활동 내용이 없습니다.
              </div>
            )
          )}

          {/* 10. 댓글 및 다축 평가 상세 시각화 */}
          {act.type === 'comment' && (
            <div className="space-y-3.5">
              {/* 1. 작성한 댓글 내용 (가장 위) */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 shadow-inner">
                <span className="block text-[9px] font-bold text-indigo-700 uppercase tracking-wider mb-1">✍️ 작성한 댓글 내용</span>
                <p className="text-sm leading-relaxed text-indigo-950 font-bold">
                  "{act.commentBody}"
                </p>
              </div>

              {/* 2. 원글보기 (작은 라벨 + 원글 제목) */}
              <div className="bg-white/90 border border-indigo-150 rounded-2xl p-3.5 shadow-sm">
                <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">🔍 원글보기</p>
                <h4 className="text-xs font-black text-indigo-900 leading-snug">
                  {act.targetTitle}
                </h4>
              </div>
              
              {/* 3. 3축 평가 점수 */}
              {act.ratings && Object.keys(act.ratings).length > 0 && (
                <div className="bg-white/90 border rounded-2xl p-4 shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-gray-500">📊 내가 매긴 3축 평가 점수</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {Object.entries(act.ratings).map(([axis, val]) => {
                      const labelMap = { relevance: '공익/정확', feasibility: '실행/배려', logic: '타당/설득' }
                      return (
                        <div key={axis} className="bg-slate-50 border p-2 rounded-xl">
                          <span className="block text-[9px] text-gray-400 font-bold mb-0.5">{labelMap[axis] || axis}</span>
                          <span className="font-mono text-amber-550 font-black text-sm">★ {val}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 11. 설문·투표 모음 (여정별 한 묶음) */}
          {act.type === 'polls_group' && Array.isArray(act.polls) && (
            <div className="space-y-2">
              {act.polls.map((p, i) => (
                <div key={i} className="bg-white/85 border rounded-2xl p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black text-slate-700">{p.title}</span>
                    {typeof p.total === 'number' && <span className="text-[10px] text-slate-400 shrink-0">참여 {p.total}명</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black">내 선택</span>
                    <span className="text-sm font-bold text-indigo-800">{p.myChoice || '—'}</span>
                  </div>
                  {p.reason && (
                    <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border">💡 {p.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 12. 댓글 모음 (여정별 한 묶음) — 원글 + 내 댓글 + 평가 */}
          {act.type === 'comments_group' && Array.isArray(act.comments) && (
            <div className="space-y-3">
              {act.comments.map((c, i) => (
                <div key={i} className="bg-white/90 border rounded-2xl p-3.5 shadow-sm space-y-2">
                  {c.targetBody ? (
                    <details className="bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 group/og">
                      <summary className="cursor-pointer list-none">
                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">🔍 원글 (눌러서 내용 보기)</span>
                        <p className="text-xs font-black text-slate-800 leading-snug">{c.targetTitle}</p>
                      </summary>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t border-slate-200">{c.targetBody}</p>
                    </details>
                  ) : (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider mb-0.5">🔍 원글</p>
                      <p className="text-xs font-black text-slate-800 leading-snug">{c.targetTitle}</p>
                    </div>
                  )}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2">
                    <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider mb-0.5">✍️ 내 댓글</p>
                    <p className="text-sm leading-relaxed text-indigo-950 font-semibold">"{c.body}"</p>
                  </div>
                  {c.ratings && Object.keys(c.ratings).length > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {Object.entries(c.ratings).map(([axis, val]) => {
                        const labelMap = { relevance: '공익/정확', feasibility: '실행/배려', logic: '타당/설득' }
                        return (
                          <div key={axis} className="bg-slate-50 border p-1.5 rounded-lg">
                            <span className="block text-[9px] text-gray-400 font-bold">{labelMap[axis] || axis}</span>
                            <span className="font-mono text-amber-550 font-black text-sm">★ {val}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-6 pb-6 pt-3 flex items-center justify-between gap-4 border-t border-gray-100/50 bg-white/30">
          <button onClick={onPrev} disabled={index === 0}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-2xl text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none hover:brightness-95 active:scale-[0.98]"
            style={{ background: meta.color + '15', color: meta.color }}>
            ← 이전 활동
          </button>
          
          <span className="text-xs font-bold text-gray-500 shrink-0 bg-white/60 px-3 py-1.5 rounded-full border">
            {index + 1} / {activities.length}
          </span>
          
          <button onClick={onNext} disabled={index === activities.length - 1}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-2xl text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none hover:brightness-95 active:scale-[0.98]"
            style={{ background: meta.color + '15', color: meta.color }}>
            다음 활동 →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Snake 경로 커넥터 (행 사이 U/N 곡선)
function SnakeConnector({ direction, color = '#d1d5db' }) {
  return (
    <div className="flex items-stretch my-0" style={{ height: 48 }}>
      {direction === 'right' ? (
        <>
          <div className="flex-1" />
          <div style={{
            width: 40, height: 48,
            borderRight: `3px dashed ${color}`,
            borderBottom: `3px dashed ${color}`,
            borderBottomRightRadius: 24,
          }} />
        </>
      ) : (
        <>
          <div style={{
            width: 40, height: 48,
            borderLeft: `3px dashed ${color}`,
            borderBottom: `3px dashed ${color}`,
            borderBottomLeftRadius: 24,
          }} />
          <div className="flex-1" />
        </>
      )}
    </div>
  )
}

// ── 노드 원형 버튼
function Node({ act, index, ratings, isActive, onClick }) {
  const meta = PHASE_META[act.phase]
  const score = ratings[act.key] || 0
  return (
    <div className="flex flex-col items-center gap-2 relative animate-fade-in" style={{ minWidth: 76 }}>
      {/* 내 발자취 순서 번호 표시 */}
      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition-all duration-200"
        style={{ background: meta.bg, borderColor: meta.color, color: meta.text }}>
        발자취 {act.globalStep}
      </span>

      {/* 원형 노드 */}
      <button
        onClick={() => onClick(index)}
        className="relative w-15 h-15 rounded-full flex items-center justify-center text-3xl shadow-md transition-all duration-300 hover:scale-115 hover:shadow-lg focus:outline-none cursor-pointer"
        style={{
          background: isActive ? meta.color : `linear-gradient(135deg, #ffffff 0%, ${meta.bg} 100%)`,
          border: `3px solid ${isActive ? '#ffffff' : meta.color}`,
          boxShadow: isActive ? `0 0 14px 4px ${meta.color}77` : '0 4px 6px -1px rgba(0,0,0,0.08)',
        }}
        title={act.title}
      >
        <span className={isActive ? 'scale-110 transition-transform duration-300' : ''}>{act.icon}</span>
        {/* 별점 표시 (알약 모양 ⭐ 뱃지) */}
        {score > 0 && (
          <span className="absolute -top-1 -right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-[9px] font-black flex items-center gap-0.5 shadow-md border border-white">
            ⭐{score}
          </span>
        )}
      </button>

      {/* 짧은 제목 */}
      <span className="text-[10px] text-center text-gray-700 font-extrabold leading-tight max-w-[76px] line-clamp-2 px-0.5">
        {act.shortTitle}
      </span>
      {/* 작성 날짜 */}
      {fmtDate(act.ts) && (
        <span className="text-[9px] text-gray-400 font-bold leading-none">{fmtDate(act.ts)}</span>
      )}
    </div>
  )
}

// ── 행 간 연결선
function HConnector({ reversed, color = '#d1d5db' }) {
  return (
    <div className="flex-1 flex items-center mx-1" style={{ minWidth: 8, maxWidth: 32 }}>
      <div className="w-full border-t-3 border-dashed" style={{ borderColor: color }} />
      {!reversed && <span className="text-xs ml-0.5 font-bold" style={{ color }}>›</span>}
      {reversed  && <span className="text-xs mr-0.5 order-first font-bold" style={{ color }}>‹</span>}
    </div>
  )
}

export default function MyJourneyTimeline() {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const candidatesMap = useGameStore((s) => s.candidates) || {}
  const config      = useGameStore((s) => s.config)

  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [essays,          setEssays]          = useState({})
  const [posters,         setPosters]         = useState({})
  const [candidates,      setCandidates]      = useState({})
  const [supports,        setSupports]        = useState({})
  const [articles,        setArticles]        = useState({})
  const [branchData,      setBranchData]      = useState({})
  const [branchDrafts,    setBranchDrafts]    = useState({})
  const [billsMap,        setBillsMap]        = useState({})
  const [policiesMap,     setPoliciesMap]     = useState({})
  const [links,           setLinks]           = useState({})
  const [polls,           setPolls]           = useState({})
  const [pollReasons,     setPollReasons]     = useState({})
  const [electionVotes,   setElectionVotes]   = useState({})
  const [billVotes,       setBillVotes]       = useState({})
  const [juryVotes,       setJuryVotes]       = useState({})
  const [debateSessions,  setDebateSessions]  = useState({})
  const [commentsMap,     setCommentsMap]     = useState({})
  const [reflectionsMap,  setReflectionsMap]  = useState({})
  const [petitions,       setPetitions]       = useState({})
  const [verdicts,        setVerdicts]        = useState({})
  const [ratings,         setRatings]         = useState({})
  const [groupHistory,    setGroupHistory]    = useState({})
  const [savingKey,  setSavingKey]  = useState(null)
  const [activeIdx,  setActiveIdx]  = useState(null)

  // 내가 '그때' 속했던 모둠 id 집합 — 모둠 변경 이력 로그가 없으므로,
  // 내가 직접 남긴 기록(포스터·슬로건·후보 등록·에세이·기사 등)의 모둠 스냅샷으로 역추론한다.
  // 이렇게 하면 지금 모둠이 바뀌었어도 '이전 모둠'에서 한 모둠 활동까지 발자취에 함께 모인다.
  // ⚠️ 반드시 위 useState 선언들 '아래'에 둔다(상태 변수 참조 → TDZ 방지).
  const myGroupIds = useMemo(() => {
    // ① 모둠 변경 이력(groupHistory)이 있으면 그것만 신뢰 — 추측 없이 정확.
    //    내 from/to 모둠 + 현재 모둠의 합집합 = 내가 실제로 거쳐간 모둠 전부.
    const myHist = groupHistory?.[myStudentId]
    if (myHist && Object.keys(myHist).length > 0) {
      const ids = new Set()
      if (myGroupId) ids.add(myGroupId)
      Object.values(myHist).forEach((h) => {
        if (h?.from) ids.add(h.from)
        if (h?.to) ids.add(h.to)
      })
      return ids
    }
    // ② 이력이 없으면(레거시) 기존 스냅샷 추론으로 폴백.
    const ids = new Set()
    if (myGroupId) ids.add(myGroupId)
    // 현재 members에 내가 남아있는 모둠 전부 (이동 후 이전 모둠 members가 정리 안 된 경우 포함)
    // + 슬로건(groups/{gid}/slogans) 작성한 모둠
    Object.entries(groups || {}).forEach(([gid, g]) => {
      if (g?.members?.[myStudentId]) ids.add(gid)
      if (Object.values(g?.slogans || {}).some((s) => s?.authorStudentId === myStudentId)) ids.add(gid)
    })
    // 포스터 / 에세이 (내가 작성 → 그 groupId)
    Object.values(posters || {}).forEach((p) => { if (p?.authorStudentId === myStudentId && p.groupId) ids.add(p.groupId) })
    Object.values(essays || {}).forEach((e) => { if (e?.authorStudentId === myStudentId && e.groupId) ids.add(e.groupId) })
    // 후보 등록 (내가 대표 leader인 모둠)
    Object.entries(candidates || {}).forEach(([gid, c]) => { if (c?.leaderStudentId === myStudentId) ids.add(gid) })
    // 기사 / 지지선언 (authorGroupId 스냅샷)
    Object.values(articles || {}).forEach((a) => { if (a?.authorStudentId === myStudentId && a.authorGroupId) ids.add(a.authorGroupId) })
    Object.values(supports || {}).forEach((s) => { if (s?.authorStudentId === myStudentId && s.authorGroupId) ids.add(s.authorGroupId) })
    // 국정포털 단위(branchData)에서 내가 작성/대표인 경우 그 모둠
    Object.values(branchData || {}).forEach((u) => {
      if (!u?.groupId) return
      const mine = u.representativeStudentId === myStudentId ||
        Object.values(u.sections || {}).some((s) => s?.authorStudentId === myStudentId) ||
        Boolean(u.memberNotes?.[myStudentId])
      if (mine) ids.add(u.groupId)
    })
    return ids
  }, [groups, posters, essays, candidates, articles, supports, branchData, groupHistory, myStudentId, myGroupId])

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'essays',            (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',           (d) => setPosters(d || {})),
      subscribe(roomCode, 'candidates',        (d) => setCandidates(d || {})),
      subscribe(roomCode, 'supportStatements', (d) => setSupports(d || {})),
      subscribe(roomCode, 'articles',          (d) => setArticles(d || {})),
      subscribe(roomCode, 'branchUnits',       (d) => setBranchData(d || {})),
      subscribe(roomCode, 'branchDrafts',      (d) => setBranchDrafts(d || {})),
      subscribe(roomCode, 'bills',             (d) => setBillsMap(d || {})),
      subscribe(roomCode, 'policies',          (d) => setPoliciesMap(d || {})),
      subscribe(roomCode, 'links',             (d) => setLinks(d || {})),
      subscribe(roomCode, 'polls',             (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons',     (d) => setPollReasons(d || {})),
      subscribe(roomCode, 'electionVotes',     (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'billVotes',         (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes',         (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'debateSessions',    (d) => setDebateSessions(d || {})),
      subscribe(roomCode, 'comments',          (d) => setCommentsMap(d || {})),
      subscribe(roomCode, 'reflections',       (d) => setReflectionsMap(d || {})),
      subscribe(roomCode, 'groupHistory',      (d) => setGroupHistory(d || {})),
      subscribe(roomCode, 'petitions',         (d) => setPetitions(d || {})),
      subscribe(roomCode, 'verdicts',          (d) => setVerdicts(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}/journeyRatings`).then((d) => {
      if (d) setRatings(d)
    })
  }, [roomCode, myStudentId])

  const handleRate = async (key, value) => {
    setSavingKey(key)
    const next = { ...ratings, [key]: value }
    setRatings(next)
    await updateAt(roomCode, `students/${myStudentId}`, { journeyRatings: next })
    setSavingKey(null)
  }

  // 전체 활동 목록 (순서: 1여정 → 2여정 → 3여정)
  const activities = useMemo(() => {
    const acts = []
    // 댓글·투표(설문)는 개별로 흩뿌리지 않고 '여정(phase)별 한 묶음'으로 모은다.
    // 섹션 키로 모음(3여정은 입법/행정/사법으로 분리)
    const voteBuckets = {}
    const commentBuckets = {}
    const sectionKey = (phase, branch) => {
      if (Number(phase) === 3) {
        if (branch === 'executive') return 'p3-exe'
        if (branch === 'judicial') return 'p3-jud'
        return 'p3-leg'
      }
      return `p${phase}`
    }
    const pushVote = (sec, item) => { (voteBuckets[sec] = voteBuckets[sec] || []).push(item) }
    const pushComment = (sec, item) => { (commentBuckets[sec] = commentBuckets[sec] || []).push(item) }
    // 토론 세션 → 부(府) 추론
    const sessionBranch = (s) => {
      if (!s) return null
      const sid = String(s.sourceStepId || '')
      if (s.type === 'trial' || s.relatedCaseId || sid.startsWith('judicial') || sid.startsWith('verdict')) return 'judicial'
      if (s.relatedExecutiveMeeting || s.type === 'multi_party' || sid.startsWith('executive')) return 'executive'
      if (s.relatedBillId || sid.startsWith('legislative')) return 'legislative'
      return null
    }

    // ── 모둠 변경 경계(컷오프) 기반 모둠 판정 ──
    // 단계 랭크: 1여정=10, 2여정=20, 3여정 입법=31·행정=32·사법=33, 4여정=40
    // groupHistory 항목 {from,to,cutoff}: 'cutoff 단계부터 to 모둠'. 그 이전 단계는 from 모둠.
    const myTrans = Object.values(groupHistory?.[myStudentId] || {})
      .filter((h) => h && typeof h.cutoff === 'number' && (h.from || h.to))
      .sort((a, b) => a.cutoff - b.cutoff)
    const studentGroupAt = (rank) => {
      if (!myTrans.length) return null
      let g = myTrans[0].from
      for (const t of myTrans) { if (rank >= t.cutoff) g = t.to }
      return g
    }
    // 모둠 결과물(내가 직접 작성 안 한 것)을 '그 단계에서 내 모둠이었는지'로 판정.
    // 컷오프 이력이 있으면 단계 기준, 없으면 기존 합집합(myGroupIds) 폴백.
    const groupOkAt = (gid, rank) => {
      if (!gid) return false
      if (myTrans.length) return studentGroupAt(rank) === gid
      return myGroupIds.has(gid)
    }

    // ── 1여정 (첫 번째 여정 - 시민 광장) ──
    
    // 1-1. 슬로건
    Object.entries(groups || {}).forEach(([gid, g]) => {
      const ss = g?.slogans || {}
      Object.entries(ss).forEach(([sid, s]) => {
        if (s?.authorStudentId === myStudentId) {
          acts.push({
            key: `phase1_slogan_${gid}_${sid}`,
            phase: 1,
            type: 'slogan',
            ts: s.createdAt,
            icon: '💬',
            shortTitle: '슬로건',
            stepLabel: '슬로건 제출',
            title: `시민광장 슬로건`,
            content: `내가 제출한 슬로건:\n"${s.text}"`
          })
        }
      })
    })

    // 1-2. 주장하는 글 (에세이)
    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`, phase: 1,
        type: 'essay', ts: e.createdAt,
        icon: '📝', shortTitle: '주장글',
        stepLabel: '나의 주장글(에세이) 작성',
        title: e.title || '주장하는 글',
        content: [
          e.claim ? `[주장] ${e.claim}` : '',
          e.evidence ? `[근거] ${e.evidence}` : '',
          e.impact ? `[해결 방안 및 기대 효과] ${e.impact}` : ''
        ].filter(Boolean).join('\n\n'),
      })
    })

    // 1-2b. 국민청원 (내가 올린 청원) — 1여정 시민광장
    Object.entries(petitions).forEach(([id, p]) => {
      if (p?.studentId !== myStudentId) return
      acts.push({
        key: `phase1_petition_${id}`, phase: 1,
        type: 'petition', ts: p.createdAt,
        icon: '📜', shortTitle: '국민청원',
        stepLabel: '국민청원 작성',
        title: `${p.prefixTag ? `[${p.prefixTag}] ` : ''}${p.title || '국민청원'}`,
        content: [
          p.claim ? `[주장] ${p.claim}` : '',
          p.evidence ? `[근거] ${p.evidence}` : '',
          p.mediaSummary ? `[미디어 요약] ${p.mediaSummary}` : '',
          p.mediaUrl ? `[자료 링크] ${p.mediaUrl}` : '',
          Array.isArray(p.hashTags) && p.hashTags.length ? `${p.hashTags.map((h) => `#${h}`).join(' ')}` : '',
          typeof p.likeCount === 'number' ? `\n👍 공감 ${p.likeCount}` : '',
        ].filter(Boolean).join('\n\n'),
      })
    })

    // 1-3. 포스터 (모둠 결과물 → 1여정(랭크10) 단계 모둠 기준)
    Object.entries(posters).forEach(([id, p]) => {
      if (p.authorStudentId !== myStudentId && !groupOkAt(p.groupId, 10)) return
      const isMyUpload = p.authorStudentId === myStudentId
      acts.push({
        key: `phase1_poster_${id}`, phase: 1,
        type: 'poster', ts: p.createdAt,
        poster: p,
        icon: '🖼️', shortTitle: isMyUpload ? '내포스터' : '모둠포스터',
        stepLabel: isMyUpload ? '내 포스터 제작' : '모둠 포스터 제작',
        title: p.title || p.caption || (isMyUpload ? '내가 올린 포스터' : '우리 모둠 포스터'), 
        content: p.caption || p.description || '',
      })
    })

    // 1-4. 시민광장 설문조사 투표 및 사유
    Object.entries(polls).forEach(([pid, p]) => {
      const isPhase1 = pid.startsWith('phase1') || (typeof p?.tag === 'string' && p.tag.includes('시민'))
      if (!isPhase1) return
      const v = p?.votes?.[myStudentId]
      if (!v) return

      const optIdx = parseInt(v.optionId?.replace('opt_', '') || '', 10)
      const opt = p.options?.[optIdx] || p.options?.[v.optionId]
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.id || v.optionId)
      const reason = pollReasons[pid]?.[myStudentId] || ''

      pushVote('p1', {
        kind: 'poll',
        title: p.question || '시민광장 설문조사',
        myChoice: label,
        reason,
        total: Object.keys(p.votes || {}).length,
      })
    })

    // ── 2여정 (두 번째 여정 - 선거) ──

    // 2-1. 후보 등록 — 내가 '직접 출마(leaderStudentId===나)'한 후보를 우선 포함하고,
    //      그 외엔 내가 그때 속했던 모둠의 후보를 포함(모둠 변경 전 등록도 따라옴).
    Object.entries(candidates).forEach(([gid, c]) => {
      const isMine = c?.leaderStudentId === myStudentId   // 내가 후보 당사자
      if (!isMine && !groupOkAt(gid, 20)) return           // 선거=2여정(랭크20)
      const candName = c.leaderNickname || c.candidateName
      acts.push({
        key: `phase2_candidate_${gid}`, phase: 2,
        type: 'candidate', ts: c.candidateSavedAt || c.registeredAt || c.updatedAt,
        candidate: c,
        icon: '🗳️',
        shortTitle: isMine ? '내 후보등록' : (candName ? `후보: ${candName}` : '모둠 후보'),
        stepLabel: isMine ? '내가 등록한 대통령 후보' : '우리 모둠 대통령 후보',
        title: isMine
          ? `내가 등록한 대통령 후보${candName ? ` (${candName})` : ''}`
          : (candName ? `우리 모둠 대통령 후보 (${candName})` : '우리 모둠 대통령 후보'),
        content: c.pamphlet ? `[출마선언문]\n${c.pamphlet}` : '대통령 후보 등록 완료',
      })
    })

    // 2-2. 지지 선언문
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`, phase: 2,
        type: 'support', ts: s.createdAt || s.updatedAt,
        icon: '📣', shortTitle: '지지선언',
        stepLabel: '대통령 후보 지지선언문',
        title: '대통령 후보 지지 선언문',
        content: s.content || s.statement || '',
      })
    })

    // 2-3. 선거 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`, phase: 2,
        type: 'article', ts: a.createdAt || a.updatedAt,
        icon: '📰', shortTitle: '선거기사',
        stepLabel: '선거 보도 기사 작성',
        title: a.headline || a.title || '선거 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 2-4. 대통령 선거 투표 참여 → 설문모음으로
    if (electionVotes[myStudentId]) {
      const votedGid = electionVotes[myStudentId]?.candidateGroupId
      const votedCand = votedGid ? candidates[votedGid] : null
      const votedName = votedCand ? (votedCand.leaderNickname || votedCand.candidateName || '후보') : null
      pushVote('p2', {
        kind: 'election',
        title: '대통령 선거 투표',
        myChoice: votedName ? `${votedName} 후보` : '투표함',
        total: Object.keys(electionVotes || {}).length,
      })
    }

    // 2-5. 공유 뉴스 기사 (type: news인 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type !== 'news') return
      acts.push({
        key: `phase2_news_${id}`, phase: 2,
        type: 'link',
        link: l,
        icon: '🔗', shortTitle: '뉴스공유',
        stepLabel: '선거 관련 뉴스 공유',
        title: l.title || '공유한 뉴스기사',
        content: l.summary ? `[요약]\n${l.summary}` : '',
      })
    })

    // ── 3여정 (세 번째 여정 - 국정 포털) — 실제 데이터(branchDrafts/policies/bills/verdicts) ──
    const bc = config?.branchConfig || {}
    const sectionText = (content) =>
      typeof content === 'object' ? (content?.policyFields?.text || content?.text || '') : (content || '')
    const budgetLines = (items) => {
      const arr = Array.isArray(items) ? items : Object.values(items || {})
      return arr.filter(Boolean).map((it) => `${it.name || it.label || '항목'}: ${it.amount ?? it.budget ?? 0}억`)
    }

    // 3-1. 입법부 — 내 조항 초안 + 우리 모둠 법안
    ;(bc.legislative?.units || []).forEach((unit) => {
      if (!unit?.unitId || !groupOkAt(unit.groupId, 31)) return
      const draft = branchDrafts?.[unit.unitId]
      Object.entries(draft?.sections || {}).forEach(([sk, s]) => {
        if (s?.authorStudentId !== myStudentId) return
        const txt = sectionText(s.content)
        if (!txt.trim()) return
        acts.push({
          key: `phase3_legsec_${unit.unitId}_${sk}`, phase: 3, section: 'p3-leg', ts: s.updatedAt,
          type: 'legdraft', icon: '✍️', shortTitle: '내 조항초안',
          stepLabel: '입법 — 내 조항(역할) 초안 작성',
          title: `내 입법 초안 · ${sk}`,
          content: txt,
        })
      })
    })
    Object.entries(billsMap || {}).forEach(([bid, b]) => {
      if (!groupOkAt(b?.proposerGroupId, 31)) return
      const statusKo = b.status === 'passed' ? '✅ 통과' : '❌ 부결'
      acts.push({
        key: `phase3_bill_${bid}`, phase: 3, section: 'p3-leg', ts: b.updatedAt || b.createdAt,
        type: 'bill', icon: '🏛️', shortTitle: '모둠법안',
        stepLabel: '우리 모둠 법안',
        title: `${b.title || '법안'} (${statusKo})`,
        content: `${b.body || ''}${b.voteResult ? `\n\n[표결] 찬성 ${b.voteResult.yesCount ?? b.voteResult.yes} · 반대 ${b.voteResult.noCount ?? b.voteResult.no}` : ''}`,
      })
    })

    // 3-2. 행정부 — 내 시행령·예산 초안(역할별) + 우리 부처 정책 완성본
    const exeUnits = [...(bc.executive?.units || [])]
    if (bc.executive?.presidentGroupId) exeUnits.push({ unitId: 'exe-president', groupId: bc.executive.presidentGroupId, ministryName: '대통령실' })
    exeUnits.forEach((unit) => {
      if (!unit?.unitId || !groupOkAt(unit.groupId, 32)) return
      const draft = branchDrafts?.[unit.unitId]
      Object.entries(draft?.sections || {}).forEach(([sk, s]) => {
        if (s?.authorStudentId !== myStudentId) return
        const txt = sectionText(s.content)
        const budget = budgetLines(s?.content?.budgetItems)
        if (!txt.trim() && budget.length === 0) return
        acts.push({
          key: `phase3_exesec_${unit.unitId}_${sk}`, phase: 3, section: 'p3-exe', ts: s.updatedAt,
          type: 'exedraft', icon: '✍️', shortTitle: '내 시행령',
          stepLabel: '행정 — 내 시행령·예산(역할) 작성',
          title: `내 시행령·예산 · ${sk}`,
          content: `${txt}${budget.length ? `\n\n[예산]\n${budget.join('\n')}` : ''}`,
        })
      })
    })
    Object.entries(policiesMap || {}).forEach(([gid, p]) => {
      if (!groupOkAt(gid, 32)) return
      const arr = Array.isArray(p?.budgetItems) ? p.budgetItems : Object.values(p?.budgetItems || {})
      const sum = Number(p?.requestedBudget) || arr.reduce((s, it) => s + (Number(it?.amount) || Number(it?.total) || 0), 0)
      acts.push({
        key: `phase3_policy_${gid}`, phase: 3, section: 'p3-exe', ts: p.updatedAt || p.policySubmittedAt,
        type: 'policy', icon: '🏢', shortTitle: '모둠정책',
        stepLabel: '우리 부처 정책 완성본(시행령·예산)',
        title: `${p.policyFields?.title || p.policyName || '정책'}${sum ? ` · ${sum}억` : ''}`,
        content: `${p.policyFields?.ordinance || p.ordinance || p.impact || ''}`,
      })
    })

    // 3-3. 사법부 — 우리 모둠 판결문
    {
      const byGroup = {}
      for (const byCase of Object.values(verdicts || {})) {
        if (typeof byCase !== 'object') continue
        for (const v of Object.values(byCase)) {
          if (!v?.body) continue
          const g = v.judgeGroupId || v.groupId
          if (!g || !groupOkAt(g, 33)) continue
          if (!byGroup[g] || (v.createdAt || 0) > (byGroup[g].createdAt || 0)) byGroup[g] = v
        }
      }
      Object.entries(byGroup).forEach(([g, v]) => {
        acts.push({
          key: `phase3_verdict_${g}`, phase: 3, section: 'p3-jud', ts: v.createdAt,
          type: 'judicial', icon: '⚖️', shortTitle: '모둠판결문',
          stepLabel: '우리 모둠 판결문',
          title: `우리 모둠 판결 — ${v.decision === 'guilty' ? '유죄' : '무죄'}`,
          content: `${v.sentence ? `[선고] ${v.sentence}\n\n` : ''}${v.body || ''}`,
        })
      })
    }

    // 3-3b. 재판 전 대본 — 내 역할(검사/변호/판사)이 맡은 대본 라인
    {
      const jc = bc.judicial
      const activeCase = jc?.activeCase
      const side = getStudentJudicialSide(myStudentId, jc, groups)
      const allow = JUD_SCRIPT_SPEAKERS[side] || []
      const script = Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : []
      const myLines = allow.length
        ? [...script].filter((l) => allow.includes(l?.speaker)).sort((a, b) => (a.order || 0) - (b.order || 0))
        : []
      if (myLines.length) {
        acts.push({
          key: 'phase3_jud_script', phase: 3, section: 'p3-jud',
          type: 'judscript', icon: '🎭', shortTitle: '재판 대본',
          stepLabel: '재판 전 — 내 역할 대본',
          title: `내 역할 대본 (${myLines.length}줄)`,
          content: myLines.map((l) => `[${JUD_SPEAKER_LABEL[l.speaker] || l.speaker}${l.scene ? ` · ${l.scene}` : ''}]\n${l.text || ''}`).join('\n\n'),
        })
      }
    }

    // 3-3c. 재판 중 연설 평가 — 내가 매긴 speechEvals 결과
    {
      const evalLines = []
      Object.values(debateSessions || {}).forEach((s) => {
        if (!s || s.type !== 'trial') return
        Object.values(s.speechEvals || {}).forEach((ev) => {
          const r = ev?.results?.[myStudentId]
          if (!r) return
          const tgt = ev.targetName || ev.speakerName || ev.label || ev.title || ev.targetSpeaker || '연설'
          const scoreStr = r.scores && typeof r.scores === 'object'
            ? Object.values(r.scores).map((x) => `★${x}`).join(' ') : ''
          evalLines.push(`• ${tgt}: ${scoreStr}${r.comment ? `\n  "${r.comment}"` : ''}`)
        })
      })
      if (evalLines.length) {
        acts.push({
          key: 'phase3_jud_speecheval', phase: 3, section: 'p3-jud',
          type: 'speecheval', icon: '📋', shortTitle: '재판 중 평가',
          stepLabel: '재판 중 — 내가 한 연설 평가',
          title: `재판 중 연설 평가 (${evalLines.length}건)`,
          content: evalLines.join('\n\n'),
        })
      }
    }

    // 3-4. 국정 기사 (재판 후/여정 기사 포함) — target 없으면 토론 세션 종류로 부 추론
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 3) return
      let branch = (a.target && ['legislative', 'executive', 'judicial'].includes(a.target)) ? a.target : null
      if (!branch && a.debateSessionId) branch = sessionBranch(debateSessions?.[a.debateSessionId])
      acts.push({
        key: `phase3_article_${id}`, phase: 3,
        type: 'article', _branch: branch, ts: a.createdAt || a.updatedAt,
        icon: '📰', shortTitle: a.contextType === 'debate' ? '재판후기사' : '국정기사',
        stepLabel: a.contextType === 'debate' ? '재판/토론 후 기사' : '국정 여정 기사',
        title: a.headline || a.title || '국정 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 3-5. 법안 투표 참여 → 설문모음으로
    Object.entries(billVotes).forEach(([bid, votes]) => {
      const mv = votes && votes[myStudentId]
      if (!mv) return
      // bills 노드 우선(정식 법안), 없으면 branchUnits 폴백
      let billTitle = billsMap?.[bid]?.title || ''
      if (!billTitle) {
        for (const unit of Object.values(branchData)) {
          if (unit.type === 'legislative' && unit.bills) {
            const matched = Object.values(unit.bills).find(b => (b.title && b.title.includes(bid)) || (b.content && b.content.includes(bid)))
            if (matched) { billTitle = matched.title; break }
          }
        }
      }
      if (!billTitle) billTitle = '법안'
      pushVote('p3-leg', {
        kind: 'billvote',
        title: `법안 표결: ${billTitle}`,
        myChoice: mv === 'pro' ? '✅ 찬성' : mv === 'con' ? '❌ 반대' : '⚪ 기권',
        total: Object.keys(votes).length,
      })
    })

    // 3-6. 배심원 재판 투표 참여 → 설문모음으로
    Object.entries(juryVotes).forEach(([cid, votes]) => {
      const mv = votes && votes[myStudentId]
      if (!mv) return
      pushVote('p3-jud', {
        kind: 'juryvote',
        title: '배심원 평결',
        myChoice: mv === 'pro' ? '⚖️ 유죄' : mv === 'con' ? '🕊️ 무죄' : String(mv),
        total: Object.keys(votes).length,
      })
    })

    // 3-7. 공유 영상/캔바 링크 (type이 news가 아닌 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type === 'news') return
      acts.push({
        key: `phase3_video_${id}`, phase: 3,
        type: 'link',
        link: l,
        icon: '🎬', shortTitle: '영상공유',
        stepLabel: '영상/캔바 자료 공유',
        title: l.title || '공유한 영상/캔바',
        content: '',
      })
    })

    // ── 3-8. 토론 여론조사 및 토론 활동 ──
    Object.entries(debateSessions).forEach(([sid, s]) => {
      const preVote = s.stancePoll?.pre?.votes?.[myStudentId]
      const postVote = s.stancePoll?.post?.votes?.[myStudentId]
      // phase: 세션 phase 우선, 없으면 선거 토론 단서(플래그·제목)로 2여정 추론, 그래도 없으면 3
      const elecHint = s.relatedElectionDebate || s.sourceStepId === 'debatePrep' ||
        /후보|대통령|선거/.test(`${s.title || ''} ${s.topic || ''}`)
      const phase = Number(s.phase) || (elecHint ? 2 : 3)

      // 토론 사전/사후 입장(투표) → 설문모음으로(부별)
      if (preVote || postVote) {
        const pre = preVote?.option || preVote || null
        const post = postVote?.option || postVote || null
        pushVote(sectionKey(phase, sessionBranch(s)), {
          kind: 'debate_poll',
          title: `토론 입장: ${s.title || s.topic || '토론'}`,
          myChoice: post ? (pre && pre !== post ? `${pre} → ${post}` : post) : (pre || '참여'),
          total: Object.keys(s.stancePoll?.post?.votes || s.stancePoll?.pre?.votes || {}).length,
        })
      }

      // ── 3-8-1. 토론전 카드 (Debate Prep Card) — 개별 노드(내용이므로 유지) ──
      const cardsObj = s.prepCards || {}
      Object.values(cardsObj).forEach((card) => {
        if (card.studentId === myStudentId) {
          acts.push({
            key: `debate_prep_${sid}_${card.studentId}`,
            phase,
            section: sectionKey(phase, sessionBranch(s)),
            ts: card.updatedAt || card.createdAt,
            type: 'debate_prep',
            icon: '📇',
            shortTitle: '토론전카드',
            stepLabel: '토론 준비 카드 작성',
            title: `토론 준비 카드 (${s.title || '토론'})`,
            debateCard: card,
            debateSession: s,
            content: `[입장] ${card.stance || '미정'}\n\n[주장/판단] ${card.mainClaim || ''}\n\n[근거] ${card.evidence || ''}\n\n[반박] ${card.rebuttal || ''}\n\n[대응] ${card.counterRebuttal || ''}`
          })
        }
      })

      // ── 3-8-2. 평가단 최종 종합 평가 (Debate Final Evaluation) ──
      const finalEvals = s.finalEvaluations || {}
      const myEval = finalEvals[myStudentId]
      if (myEval) {
        acts.push({
          key: `debate_final_eval_${sid}_${myStudentId}`,
          phase,
          section: sectionKey(phase, sessionBranch(s)),
          type: 'debate_final_eval',
          icon: '⚖️',
          shortTitle: '최종평가',
          stepLabel: '평가단 최종 종합 평가 제출',
          title: `평가단 최종 종합 평가 (${s.title || '토론'})`,
          content: typeof myEval === 'string' ? myEval : myEval.content || myEval.comment || '',
        })
      }
    })

    // ── 4. 내가 작성한 댓글 및 동료 평가 ── (원글 제목 + 원글 내용 함께 보관)
    Object.entries(commentsMap).forEach(([cid, c]) => {
      if (c.authorStudentId !== myStudentId || c.parentId) return

      let targetTitle = '원글 자료'
      let targetBody = ''
      let phase = 1
      let branch = null

      if (c.targetType === 'poster') {
        const p = posters[c.targetId]
        targetTitle = p ? `🖼️ 포스터: "${p.title || p.caption || '제목 없음'}"` : '🖼️ 친구의 포스터'
        targetBody = p?.caption || p?.description || ''
        phase = p?.phase || 1
      } else if (c.targetType === 'article') {
        const a = articles[c.targetId]
        targetTitle = a ? `📰 기사: "${a.headline || a.title || '제목 없음'}"` : '📰 친구의 기사'
        targetBody = a?.body || ''
        phase = Number(a?.phase) || 2
        branch = a?.target || null
      } else if (c.targetType === 'bill') {
        const b = billsMap?.[c.targetId]
        let matchedTitle = b?.title || ''
        targetBody = b?.body || ''
        if (!matchedTitle) {
          for (const unit of Object.values(branchData)) {
            if (unit.type === 'legislative' && unit.bills) {
              const bill = Object.values(unit.bills).find(bb => bb.id === c.targetId || bb.title === c.targetId)
              if (bill) { matchedTitle = bill.title; targetBody = bill.content || bill.body || ''; break }
            }
          }
        }
        targetTitle = matchedTitle ? `🏛️ 법안: "${matchedTitle}"` : '🏛️ 의회 법안'
        phase = 3; branch = 'legislative'
      } else if (c.targetType === 'trial') {
        targetTitle = '⚖️ 사법 재판'
        phase = 3; branch = 'judicial'
      } else if (c.targetType === 'policy') {
        const pol = policiesMap?.[c.targetId] || branchData[c.targetId]
        const pname = pol?.policyFields?.title || pol?.policyName || pol?.ministryName
        targetTitle = pname ? `🏢 행정 정책: "${pname}"` : '🏢 행정 정책'
        targetBody = pol?.policyFields?.ordinance || pol?.ordinance || pol?.impact || ''
        phase = 3; branch = 'executive'
      } else if (c.targetType === 'reflection') {
        const r = reflectionsMap[c.targetId]
        targetTitle = r ? `📝 정리글: "${r.title || '친구의 글'}"` : '📝 친구의 정리글'
        targetBody = r?.finalEssay || r?.body || ''
        phase = 4
      }

      pushComment(sectionKey(phase, branch), {
        targetTitle,
        targetBody,
        body: c.body,
        ratings: c.ratings || {},
        targetType: c.targetType,
      })
    })

    // ── 5. 섹션별 '설문 모음' / '댓글 모음' 단일 노드로 합치기 ──
    const sectionPhase = (sec) => sec.startsWith('p3') ? 3 : Number(sec.replace('p', ''))
    Object.entries(voteBuckets).forEach(([sec, items]) => {
      if (!items.length) return
      acts.push({
        key: `polls_group_${sec}`, phase: sectionPhase(sec), section: sec,
        type: 'polls_group',
        polls: items,
        icon: '📊', shortTitle: '설문모음',
        stepLabel: '투표·설문 참여 모음',
        title: `설문·투표 모음 (${items.length}건)`,
        content: '',
      })
    })
    Object.entries(commentBuckets).forEach(([sec, items]) => {
      if (!items.length) return
      acts.push({
        key: `comments_group_${sec}`, phase: sectionPhase(sec), section: sec,
        type: 'comments_group',
        comments: items,
        icon: '💬', shortTitle: '댓글모음',
        stepLabel: '동료 평가·댓글 모음',
        title: `댓글 모음 (${items.length}건)`,
        content: '',
      })
    })

    // 여정 순서 → 같은 여정 안에서는 작성 시각(ts) 순. 시각 없는 항목(요약·투표 등)은 뒤로.
    const tsOf = (a) => (typeof a.ts === 'number' ? a.ts : Number.MAX_SAFE_INTEGER)
    acts.sort((a, b) => ((a.phase || 0) - (b.phase || 0)) || (tsOf(a) - tsOf(b)))

    // 섹션 부여(미지정 시 type/branch로 추론) + 전역 발자취 번호
    const sectionFor = (act) => {
      if (act.section) return act.section
      if (Number(act.phase) !== 3) return `p${act.phase}`
      if (act.type === 'bill') return 'p3-leg'
      if (act.type === 'policy') return 'p3-exe'
      if (act.type === 'judicial') return 'p3-jud'
      if (act._branch) return sectionKey(3, act._branch)
      return 'p3-leg'
    }
    const processedActs = acts.map((act, idx) => ({
      ...act,
      section: sectionFor(act),
      globalStep: idx + 1,
    }))

    return processedActs
  }, [essays, posters, candidates, supports, articles, branchData, branchDrafts, config, billsMap, policiesMap, verdicts, links, polls, pollReasons, electionVotes, billVotes, juryVotes, debateSessions, commentsMap, reflectionsMap, petitions, groupHistory, myStudentId, myGroupId, myGroupIds, groups])

  // Snake 행으로 분할
  const rows = useMemo(() => {
    const result = []
    for (let i = 0; i < activities.length; i += COLS) {
      result.push(activities.slice(i, i + COLS))
    }
    return result
  }, [activities])

  const phaseCompleted = useMemo(() => {
    const comp = { 1: false, 2: false, 3: false }
    for (const p of [1, 2, 3]) {
      const pActs = activities.filter(a => a.phase === p)
      if (pActs.length > 0) {
        comp[p] = pActs.every(a => (ratings[a.key] || 0) > 0)
      }
    }
    return comp
  }, [activities, ratings])

  const totalRated = Object.values(ratings).filter((v) => v > 0).length

  // 모둠명 헬퍼
  const gName = (gid) => groups?.[gid]?.name || gid || '모둠'

  // ── 코넬노트 왼쪽 cue: 각 여정의 '학급 전체 이모저모' 요약 ──
  const renderCue = (m) => {
    if (m.key === 'p1') {
      const cnt = (obj, pred) => Object.values(obj || {}).filter(pred).length
      const items = [
        ['🖼️ 포스터', Object.keys(posters || {}).length],
        ['💬 슬로건', Object.values(groups || {}).reduce((n, g) => n + Object.keys(g?.slogans || {}).length, 0)],
        ['📝 주장하는 글', Object.keys(essays || {}).length],
        ['📜 국민청원', cnt(petitions, () => true)],
      ]
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-600 leading-relaxed">우리 반 시민광장에서 함께 만든 것들이에요. 이 중 내가 한 건 오른쪽에 ⭐로 남겼어요.</p>
          <ul className="text-[11px] font-bold text-slate-700 space-y-0.5">
            {items.map(([l, n]) => <li key={l} className="flex justify-between"><span>{l}</span><span className="text-slate-400">{n}건</span></li>)}
          </ul>
        </div>
      )
    }
    if (m.key === 'p2') {
      const list = Object.entries(candidates || {})
        .map(([gid, c]) => ({ gid, ...c }))
        .sort((a, b) => (Number(a.candidateNumber ?? a.leaderNumber) || 99) - (Number(b.candidateNumber ?? b.leaderNumber) || 99))
      if (!list.length) return <p className="text-[11px] text-gray-400">후보 등록 정보가 없어요.</p>
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-rose-700">🗳️ 후보 현황</p>
          <ul className="space-y-1.5">
            {list.map((c) => {
              const thumb = resolveImageUrl(c.posterUrl)
              const num = c.candidateNumber ?? c.leaderNumber
              return (
                <li key={c.gid} className="flex items-center gap-1.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black flex items-center justify-center">{num ?? '?'}</span>
                  {thumb
                    ? <img src={thumb} alt="" className="shrink-0 w-7 h-7 rounded object-cover border" />
                    : <span className="shrink-0 w-7 h-7 rounded bg-rose-50 border flex items-center justify-center text-[10px]">👤</span>}
                  <span className="text-[11px] font-bold text-slate-700 truncate">{c.leaderNickname || c.candidateName || '후보'}<span className="text-slate-400"> · {gName(c.gid)}</span></span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }
    if (m.key === 'p3-leg') {
      const list = Object.entries(billsMap || {}).map(([id, b]) => ({ id, ...b }))
      if (!list.length) return <p className="text-[11px] text-gray-400">상정된 법안이 없어요.</p>
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-sky-700">🏛️ 본회의 법안 상정·의결</p>
          <ul className="text-[11px] space-y-1">
            {list.map((b) => (
              <li key={b.id} className="text-slate-700">
                <span className="font-bold truncate">{b.title || '법안'}</span>
                {/* 통과 외에는 모두 부결(상임위 미통과 포함) */}
                <span className={`ml-1 font-black ${b.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {b.status === 'passed' ? '✅통과' : '❌부결'}
                </span>
                {b.voteResult && <span className="block text-[10px] text-slate-400">찬성 {b.voteResult.yesCount ?? b.voteResult.yes} · 반대 {b.voteResult.noCount ?? b.voteResult.no}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    }
    if (m.key === 'p3-exe') {
      const list = Object.entries(policiesMap || {}).map(([gid, p]) => ({ gid, ...p }))
      if (!list.length) return <p className="text-[11px] text-gray-400">제출된 시행령이 없어요.</p>
      const sum = (p) => {
        if (Number(p?.requestedBudget)) return Number(p.requestedBudget)
        const arr = Array.isArray(p?.budgetItems) ? p.budgetItems : Object.values(p?.budgetItems || {})
        return arr.reduce((s, it) => s + (Number(it?.amount) || Number(it?.total) || 0), 0)
      }
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-emerald-700">🏢 국무회의 시행령·예산</p>
          <ul className="text-[11px] space-y-1">
            {list.map((p) => (
              <li key={p.gid} className="text-slate-700">
                <span className="font-bold">{p.policyFields?.title || p.policyName || '정책'}</span>
                <span className="text-slate-400"> · {gName(p.gid)}{sum(p) ? ` · ${sum(p)}억` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    if (m.key === 'p3-jud') {
      // 모둠별 최신 판결문
      const byGroup = {}
      for (const byCase of Object.values(verdicts || {})) {
        if (typeof byCase !== 'object') continue
        for (const v of Object.values(byCase)) {
          if (!v?.body) continue
          const g = v.judgeGroupId || v.groupId
          if (!g) continue
          if (!byGroup[g] || (v.createdAt || 0) > (byGroup[g].createdAt || 0)) byGroup[g] = v
        }
      }
      const list = Object.entries(byGroup)
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-rose-700">⚖️ 형사재판 — 모둠별 판결</p>
          {list.length === 0
            ? <p className="text-[11px] text-gray-400">게시된 판결문이 없어요.</p>
            : <ul className="text-[11px] space-y-1">
                {list.map(([g, v]) => (
                  <li key={g} className="text-slate-700">
                    <span className="font-bold">{gName(g)}</span>
                    <span className={`ml-1 font-black ${v.decision === 'guilty' ? 'text-rose-600' : 'text-sky-600'}`}>{v.decision === 'guilty' ? '⚖️유죄' : '🕊️무죄'}</span>
                  </li>
                ))}
              </ul>}
        </div>
      )
    }
    if (m.key === 'p4') {
      return <p className="text-[11px] text-gray-600 leading-relaxed">지나온 활동을 돌아보며 별점을 매기고, 카드뉴스로 정리해 보세요.</p>
    }
    return null
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.88; transform: scale(1.003); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2.5s infinite ease-in-out;
        }
      `}</style>
      {/* 헤더 */}
      <div className="rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)' }}>
        <div className="absolute right-4 top-4 text-6xl opacity-10 select-none">🗺️</div>
        <h2 className="font-black text-xl mb-1">민국에서 나의 발자취 돌아보기</h2>
        <p className="text-pink-100 text-sm">
          1·2·3여정 내 활동들을 따라가며 각각 별점을 매겨 보세요.
        </p>
        {activities.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-yellow-300 transition-all duration-500"
                style={{ width: `${(totalRated / activities.length) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-white/80">
              {totalRated}/{activities.length}개 평가
            </span>
          </div>
        )}
      </div>

      {/* 여정 범례 — 섹션 단위(3여정은 입법/행정/사법) */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((m) => {
          const secActs = activities.filter((a) => a.section === m.key)
          if (secActs.length === 0) return null
          const isCompleted = secActs.every((a) => (ratings[a.key] || 0) > 0)
          return (
            <span key={m.key} className="relative overflow-visible flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-2xs transition-all"
              style={{
                background: isCompleted ? '#f0fdf4' : m.bg,
                border: isCompleted ? '1.5px solid #bbf7d0' : `1.5px solid ${m.border}`,
                color: isCompleted ? '#166534' : m.text
              }}>
              {m.emoji} {m.label}
              {isCompleted && (
                <span className="text-[8px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-1.5 py-0.5 rounded font-black rotate-[-4deg] shadow-xs border border-white ml-0.5">
                  완료
                </span>
              )}
            </span>
          )
        })}
      </div>

      {/* 여정별 그룹 경로 */}
      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">아직 활동 기록이 없어요.</p>
          <p className="text-sm mt-1">1~4 여정에서 작성한 활동이 여기 표시됩니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-6">
          {SECTIONS.map((m) => {
            const phaseActs = activities.filter(act => act.section === m.key)
            if (phaseActs.length === 0) return null

            // 5개씩 쪼개기
            const phaseRows = []
            for (let i = 0; i < phaseActs.length; i += 5) {
              phaseRows.push(phaseActs.slice(i, i + 5))
            }

            const isCompleted = phaseActs.every(a => (ratings[a.key] || 0) > 0)

            return (
              <div key={m.key} className="space-y-4">
                {/* 여정 구분선 라벨 + 설명 */}
                <div className="relative overflow-visible px-3 py-2.5 rounded-2xl shadow-sm border"
                  style={{
                    background: isCompleted ? '#f0fdf4' : m.bg,
                    borderColor: isCompleted ? '#bbf7d0' : m.border
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-base sm:text-lg font-black tracking-tight" style={{ color: isCompleted ? '#166534' : m.text }}>
                      {m.label}
                    </span>
                    <div className="flex-1 h-[2px] border-t border-dashed" style={{ borderColor: isCompleted ? '#bbf7d0' : m.border }} />
                    {isCompleted && (
                      <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg border border-white shadow-sm shrink-0">🏷️ 평가 완료</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed font-semibold" style={{ color: m.text, opacity: 0.85 }}>
                    {m.desc}
                  </p>
                </div>

                {/* 코넬노트식: 왼쪽 cue(이모저모 요약) + 오른쪽 내 활동 노드 */}
                <div className="flex flex-col lg:flex-row gap-3 pt-1">
                  <aside className="lg:w-44 shrink-0 rounded-2xl border border-dashed p-3 h-fit"
                    style={{ borderColor: m.border, background: `${m.bg}` }}>
                    <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: m.text }}>
                      📋 이 여정의 이모저모
                    </p>
                    {renderCue(m)}
                  </aside>
                  <div className="flex-1 space-y-4 min-w-0">
                  {phaseRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex items-start">
                      {row.map((act, colIdx) => {
                        const globalIdx = activities.findIndex(a => a.key === act.key)
                        return (
                          <div key={act.key} className="flex items-center" style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex flex-col items-center" style={{ flex: 1 }}>
                              <Node
                                act={act}
                                index={globalIdx}
                                ratings={ratings}
                                isActive={activeIdx === globalIdx}
                                onClick={(i) => setActiveIdx(activeIdx === i ? null : i)}
                              />
                            </div>
                            {/* 수평 연결선 (마지막 칸이 아닐 때만) */}
                            {colIdx < row.length - 1 && (
                              <HConnector reversed={false} color={m.color} />
                            )}
                          </div>
                        )
                      })}
                      {/* 행이 5개보다 짧으면 빈 공간으로 채움 */}
                      {row.length < 5 && Array.from({ length: 5 - row.length }).map((_, i) => (
                        <div key={`empty-${i}`} style={{ flex: 1 }} />
                      ))}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 저장 중 표시 */}
      {savingKey && (
        <p className="text-center text-xs text-pink-500 animate-pulse">별점 저장 중...</p>
      )}

      {/* 전체 평가 완료 메시지 */}
      {totalRated > 0 && (
        <div className="rounded-xl border p-3 text-center text-sm font-semibold"
          style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
          ✓ 별점 {totalRated}개 저장됨 — 2단계에서 캔바 카드뉴스를 만들 때 참고하세요!
        </div>
      )}

      {/* 카드 모달 */}
      {activeIdx !== null && (
        <ActivityModal
          activities={activities}
          index={activeIdx}
          ratings={ratings}
          onRate={handleRate}
          onClose={() => setActiveIdx(null)}
          onPrev={() => setActiveIdx((i) => Math.max(0, i - 1))}
          onNext={() => setActiveIdx((i) => Math.min(activities.length - 1, i + 1))}
          myStudentId={myStudentId}
          candidatesMap={candidatesMap}
          groups={groups}
        />
      )}
    </div>
  )
}
