import { useState } from 'react'
import { CandidateSupportStatementList } from './CandidateSupportStatements'
import StanceComments from './StanceComments'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { resolveImageUrl } from '../../lib/legacy-image'

/**
 * 클릭-to-play 동영상 임베드
 * - 오버레이 클릭(사용자 제스처) → iframe 마운트 + autoplay
 * - Canva는 플레이어 시작에 신뢰된 제스처가 필요해 이 방식이 가장 안정적
 */
function CanvaVideoEmbed({ url, title = '홍보영상' }) {
  const [active, setActive] = useState(false)
  const src = formatCanvaEmbedUrl(url)

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-100 bg-gray-900">
      {active ? (
        <iframe
          src={src}
          allowFullScreen
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 w-full h-full border-0"
          title={title}
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 group w-full"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-gray-800 ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-white/60 text-xs font-semibold">눌러서 영상 재생</span>
        </button>
      )}
    </div>
  )
}

/**
 * 후보 카드 — 선거 페이즈에서 각 후보의 정보를 보여주는 컴포넌트.
 *
 * props:
 *   candidate: { groupId, leaderNickname, leaderNumber, pledges: [], posterUrl, posterCanvaUrl, canvaUrl, videoCanvaUrl, pamphlet }
 *   group: { name }
 *   previewMode: true일 경우 투표 버튼 비활성
 *   myVote: 내가 투표한 candidateGroupId (null 가능)
 *   onVote(groupId): 투표 핸들러
 *   tally: { count, rank, total } 결과 발표용
 *   supportStatements: [] 지지 선언문 목록
 */

function CandidateCard({
  candidate,
  group,
  previewMode = false,
  myVote = null,
  onVote,
  tally,
  supportStatements = [],
}) {
  const isVoted = myVote === candidate.groupId

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      {/* 1. 상단: 후보 이름 및 기호 */}
      <header className="p-5 bg-gradient-to-br from-rose-50 to-white border-b border-rose-100 flex items-center justify-between">
        <div>
          <span className="inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold mb-1">
            기호 {candidate.candidateNumber ?? candidate.leaderNumber}번
          </span>
          <h3 className="text-xl font-black text-gray-900 leading-tight">
            {candidate.leaderNickname} <span className="text-sm font-medium text-gray-500">후보</span>
          </h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{group?.name}</p>
          {candidate.status && candidate.status !== 'submitted' && (
            <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
              선관위 미제출 · 작성 중
            </p>
          )}
        </div>
        
        {/* 결과 발표용 수치 (있을 경우) */}
        {tally && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase">득표수</p>
            <p className="text-2xl font-black text-rose-600 leading-none">{tally.count}</p>
          </div>
        )}
      </header>

      <div className="p-5 space-y-6">
        {/* 2. 출마 선언 (Pamphlet) */}
        {candidate.pamphlet && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">📢 출마 선언</p>
            <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">
              "{candidate.pamphlet}"
            </div>
          </section>
        )}

        {/* 3. 선거 포스터 (Canva 또는 이미지) */}
        {(candidate.posterCanvaUrl || candidate.posterUrl) && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">🖼️ 선거 포스터</p>
            {candidate.posterCanvaUrl ? (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                <iframe
                  src={formatCanvaEmbedUrl(candidate.posterCanvaUrl)}
                  loading="lazy"
                  allowFullScreen
                  allow="fullscreen; autoplay"
                  className="absolute inset-0 w-full h-full border-0"
                  title="선거 포스터"
                />
              </div>
            ) : (
              <img
                src={resolveImageUrl(candidate.posterUrl)}
                alt="선거 포스터"
                className="w-full rounded-2xl border border-gray-100 shadow-sm"
              />
            )}
          </section>
        )}

        {/* 4. 공약 (Pledges) */}
        <section>
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">✅ 최우선과제 해결 공약</p>
          <ul className="space-y-2">
            {(candidate.pledges || []).filter(Boolean).map((p, i) => (
              <li key={i} className="flex items-start gap-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm font-semibold text-rose-900">{p}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. 카드뉴스 (Canva) */}
        {candidate.canvaUrl && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">🎨 공약 카드뉴스</p>
            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
              <iframe
                src={formatCanvaEmbedUrl(candidate.canvaUrl)}
                loading="lazy"
                allowFullScreen
                allow="fullscreen; autoplay"
                className="absolute inset-0 w-full h-full border-0"
                title="Canva 카드뉴스"
              />
            </div>
            <a
              href={candidate.canvaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] text-indigo-600 font-bold hover:underline"
            >
              캔바에서 크게 보기 ↗
            </a>
          </section>
        )}

        {/* 6. 홍보영상 (Canva) */}
        {candidate.videoCanvaUrl && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">🎬 홍보영상</p>
            <CanvaVideoEmbed url={candidate.videoCanvaUrl} title="홍보영상" />
            <a
              href={candidate.videoCanvaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] text-indigo-600 font-bold hover:underline"
            >
              캔바에서 크게 보기 ↗
            </a>
          </section>
        )}

        {/* 7. 지지 선언문 */}
        <section className="pt-4 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest">🤝 지지 선언 ({supportStatements.length})</p>
          <div className="max-h-40 overflow-y-auto custom-scrollbar">
            <CandidateSupportStatementList
              statements={supportStatements}
              compact={true}
              showEmpty={true}
            />
          </div>
        </section>

        {/* 8. 아고라 (Stance Comments) */}
        <section className="pt-4 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest">🏛️ 후보 비교 아고라</p>
          <StanceComments targetType="candidate" targetId={candidate.groupId} />
        </section>
      </div>

      {/* 투표 버튼 (Preview 모드 아닐 때) */}
      {!previewMode && (
        <div className="p-5 bg-gray-50 mt-auto border-t border-gray-100">
          <button
            onClick={() => onVote?.(candidate.groupId)}
            className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-lg ${
              isVoted
                ? 'bg-rose-600 text-white shadow-rose-200'
                : 'bg-white text-rose-600 border-2 border-rose-100 hover:border-rose-300'
            }`}
          >
            {isVoted ? '🗳️ 나의 투표 완료' : '이 후보에게 투표하기'}
          </button>
        </div>
      )}
    </div>
  )
}

export default CandidateCard
