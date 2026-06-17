import { topicBg } from '../../styles/tokens'
import { MiniLinkList } from './GroupShowcase'

/**
 * 우리 모둠 활동 미리보기 — 학생들이 올린 포스터, 글, 영상이 다른 친구들에게 어떻게 보일지 미리 확인하는 창.
 * 
 * props:
 *   group, posters, essays, articles, links, topicMeta, config, onEditPoster
 */
import PosterMedia from './PosterMedia'

function MyGroupActivityPreview({ group, posters = [], essays = [], articles = [], links = [], topicMeta, config, myStudentId, roomCode, onEditEssay, onEditLink }) {
  const acts = config?.phase1Activities || { poster: true, essay: true, news: true, video: true, article: true }
  const color = topicMeta?.color || group?.color || 'indigo'
  const latestPoster = posters[0]
  const myEssay = myStudentId
    ? essays.find((essay) => essay.authorStudentId === myStudentId)
    : null
  
  // 기사와 영상 분류
  const newsLinks = links.filter(l => l.type === 'news')
  const videoLinks = links.filter(l => l.type !== 'news')

  if (posters.length === 0 && essays.length === 0 && links.length === 0 && articles.length === 0) {
    return (
      <div className={`p-6 rounded-2xl border-2 border-dashed border-gray-300 text-center text-gray-400 ${topicBg(color)} bg-opacity-30`}>
        <p className="text-sm">아직 활동 결과물이 없어요.<br/>아래에서 포스터나 글을 등록해 보세요!</p>
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-2xl border-2 shadow-sm ${topicBg(color)}`}>
      <header className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">우리 모둠 활동 미리보기 (실시간)</h4>
        <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded-full text-gray-500">다른 친구들에게 보이는 화면입니다</span>
      </header>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* 좌측: 시각 자료 (포스터) [Antigravity] */}
        {acts.poster && (
          <div className="space-y-3">
            {latestPoster ? (
              <div className="space-y-1.5 relative">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">🖼️ 캠페인 포스터</p>
                  {/* 포스터 관리 버튼 (항상 노출) */}
                  {myStudentId && (
                    <div className="flex gap-1">
                      <button 
                        onClick={async () => {
                          if (!confirm('포스터를 삭제할까요?')) return
                          try {
                            const { removeAt } = await import('../../lib/rtdb-helpers')
                            await removeAt(roomCode, `posters/${latestPoster.id}`)
                          } catch (err) {
                            alert('삭제 실패: ' + err.message)
                          }
                        }}
                        className="w-5 h-5 bg-white border border-red-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-red-50 text-red-500"
                        title="포스터 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white border flex items-center justify-center shadow-inner relative group">
                  <PosterMedia
                    poster={latestPoster}
                    className="w-full h-full"
                    imageClassName="max-w-full max-h-full object-contain"
                  />
                  {/* 포스터는 업로드 폼이 바로 아래 있으므로 삭제만 지원하거나 안내 문구 추가 */}
                </div>
                {latestPoster.caption && <p className="text-[11px] text-gray-600 italic px-1">"{latestPoster.caption}"</p>}
              </div>
            ) : (
              <div className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-white/40">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-[10px]">포스터가 없습니다</span>
              </div>
            )}
          </div>
        )}
 
        {/* 우측: 텍스트 및 링크 자료 [Antigravity] */}
        <div className="space-y-4">
          {/* 주장하는 글 */}
          {acts.essay && (
            essays.length > 0 ? (
              <div className="space-y-1.5 relative">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    ✍️ 주장하는 글 {essays.length}개
                  </p>
                  {myEssay && (
                    <div className="flex gap-1">
                      <button 
                        onClick={() => onEditEssay?.(myEssay.id)}
                        className="w-5 h-5 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-gray-50"
                        title="내가 쓴 글 수정"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm('주장하는 글을 삭제할까요?')) return
                          try {
                            const { removeAt } = await import('../../lib/rtdb-helpers')
                            await removeAt(roomCode, `essays/${myEssay.id}`)
                          } catch (err) {
                            alert('삭제 실패: ' + err.message)
                          }
                        }}
                        className="w-5 h-5 bg-white border border-red-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-red-50 text-red-500"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {essays.map((essay) => {
                    const mine = essay.authorStudentId === myStudentId
                    return (
                      <div key={essay.id} className={`bg-white/80 p-3 rounded-lg border space-y-2 shadow-sm ${mine ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-emerald-100'}`}>
                        <div className="flex items-start justify-between gap-2 border-b border-emerald-50 pb-1">
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold truncate">{essay.title}</h5>
                            <p className="text-[9px] text-gray-400">
                              {essay.authorNumber ? `${essay.authorNumber}번 ` : ''}{essay.authorNickname || '작성자'}
                              {mine && <span className="ml-1 text-emerald-600 font-bold">· 내 글</span>}
                            </p>
                          </div>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => onEditEssay?.(essay.id)}
                              className="shrink-0 text-[10px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 font-bold"
                            >
                              수정
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-emerald-600 leading-none">[문제 제기]</p>
                          <p className="text-[11px] leading-tight text-gray-800">{essay.claim}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-emerald-600 leading-none">[문제 근거]</p>
                          <p className="text-[11px] leading-tight text-gray-700 whitespace-pre-wrap">{essay.evidence}</p>
                        </div>
                        {essay.impact && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-emerald-600 leading-none">[실제 상황/피해]</p>
                            <p className="text-[11px] leading-tight text-gray-700 whitespace-pre-wrap">{essay.impact}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 text-center text-gray-400">
                <p className="text-[10px]">등록된 주장글이 없습니다</p>
              </div>
            )
          )}

          {/* 기사/영상 링크 (카드 스타일) */}
          <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/60">
            {acts.news && (
              <div>
                <p className="text-[11px] font-bold text-blue-800 mb-1.5">📰 기사 링크 ({newsLinks.length})</p>
                <MiniLinkList items={newsLinks} max={1} emptyText="제출된 기사 없음" accent="blue" myStudentId={myStudentId} roomCode={roomCode} onEditLink={onEditLink} />
              </div>
            )}
            {acts.video && (
              <div>
                <p className="text-[11px] font-bold text-rose-800 mb-1.5">🎬 영상 자료 ({videoLinks.length})</p>
                <MiniLinkList items={videoLinks} max={1} emptyText="제출된 영상 없음" accent="rose" myStudentId={myStudentId} roomCode={roomCode} onEditLink={onEditLink} />
              </div>
            )}
          </div>

          {/* 작성한 기사 (뉴스보드용) */}
          {acts.article && articles.length > 0 && (
            <div className="pt-2 border-t border-white/60">
              <p className="text-[11px] font-bold text-indigo-800 mb-1.5">📋 작성한 기사 ({articles.length})</p>
              <div className="space-y-1">
                {articles.slice(0, 2).map(a => (
                  <div key={a.id} className="bg-white/80 p-2 rounded border text-[11px] shadow-sm">
                    <span className="font-bold text-indigo-700">[{a.perspective === 'pro' ? '옹호' : a.perspective === 'con' ? '비판' : '중립'}]</span> {a.headline}
                  </div>
                ))}
                {articles.length > 2 && <p className="text-[9px] text-gray-400 text-right">+ {articles.length - 2}개 더 있음</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyGroupActivityPreview
