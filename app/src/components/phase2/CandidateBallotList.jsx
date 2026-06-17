import { useState } from 'react'
import CandidateCard from './CandidateCard'

/**
 * 7단계 투표용 — 컴팩트 후보 카드 + 자세히 보기 모달.
 *
 * 학생이 본 투표 시 보는 화면:
 *  - 후보 기호·이름·모둠만 표시 (포스터 썸네일은 있으면 노출)
 *  - [자세히 보기] → 모달로 전체 캠프 자료(공약·포스터·카드뉴스·영상·지지선언·아고라) 표시
 *  - [투표하기] → 부모의 onVote 호출
 *
 * props:
 *   candidates: [{ groupId, candidateNumber, leaderNumber, leaderNickname, posterUrl, posterCanvaUrl, ... }]
 *   groups: { [groupId]: { name, ... } }
 *   myVote: 내가 투표한 candidateGroupId (null 가능)
 *   onVote(candidate): 투표 모달 트리거 함수
 *   supportByGroup: { [groupId]: [지지선언, ...] }  — 자세히 모달에서 노출
 *   votingActive: 본 투표 활성 여부 (false면 투표 버튼 비활성)
 */
function CandidateBallotList({
  candidates,
  groups,
  myVote,
  onVote,
  supportByGroup = {},
  votingActive = true,
}) {
  const [detailFor, setDetailFor] = useState(null)

  if (!candidates || candidates.length === 0) {
    return (
      <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-6 text-center text-amber-700 text-sm font-bold">
        ⚠️ 등록된 후보가 없습니다.
      </div>
    )
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        {candidates.map((c) => {
          const isVoted = myVote === c.groupId
          const group = groups?.[c.groupId]
          const number = c.candidateNumber ?? c.leaderNumber
          const posterThumb = c.posterUrl || null  // 캔바 임베드는 썸네일 없으니 이미지만
          return (
            <div
              key={c.groupId}
              className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col transition-all ${
                isVoted ? 'border-rose-500 ring-4 ring-rose-100' : 'border-gray-200 hover:border-rose-300'
              }`}
            >
              {/* 상단: 기호 + 이름 + 모둠 */}
              <div className="p-4 flex items-center gap-3">
                <div className="shrink-0 w-14 h-14 rounded-full bg-rose-600 text-white flex flex-col items-center justify-center shadow">
                  <span className="text-[9px] font-bold opacity-80 -mb-0.5">기호</span>
                  <span className="text-2xl font-black leading-none">{number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-gray-900 truncate">
                    {c.leaderNickname} <span className="text-xs font-medium text-gray-500">후보</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate">{group?.name || c.groupId}</p>
                  {c.status && c.status !== 'submitted' && (
                    <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      선관위 미제출 · 작성 중
                    </p>
                  )}
                </div>
                {posterThumb && (
                  <img
                    src={posterThumb}
                    alt=""
                    className="shrink-0 w-14 h-14 rounded-xl object-cover border border-gray-100"
                  />
                )}
              </div>

              {/* 하단: 자세히 보기 + 투표 */}
              <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setDetailFor(c)}
                  className="py-3 rounded-xl text-xs font-bold border-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                >
                  📋 자세히 보기
                </button>
                <button
                  type="button"
                  disabled={!votingActive}
                  onClick={() => votingActive && onVote?.(c)}
                  className={`py-3 rounded-xl text-xs font-black transition shadow ${
                    isVoted
                      ? 'bg-rose-600 text-white shadow-rose-200'
                      : votingActive
                      ? 'bg-white text-rose-700 border-2 border-rose-300 hover:bg-rose-50'
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {isVoted ? '🗳️ 투표 완료' : votingActive ? '🗳️ 투표하기' : '⏸️ 대기'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 자세히 보기 모달 — 기존 CandidateCard 재사용 (전체 자료) */}
      {detailFor && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetailFor(null)}
        >
          <div
            className="bg-gray-50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  후보 상세 자료
                </p>
                <p className="text-sm font-black text-gray-900">
                  기호 {detailFor.candidateNumber ?? detailFor.leaderNumber}번 · {detailFor.leaderNickname} 후보
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailFor(null)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CandidateCard
                candidate={detailFor}
                group={groups?.[detailFor.groupId]}
                previewMode={true}   /* 모달 내부에는 투표 버튼 숨김 — 컴팩트 카드로만 투표 */
                myVote={myVote}
                supportStatements={supportByGroup[detailFor.groupId] || []}
              />
            </div>
            <div className="px-5 py-3 bg-white border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailFor(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                닫기
              </button>
              {votingActive && (
                <button
                  type="button"
                  onClick={() => {
                    const cand = detailFor
                    setDetailFor(null)
                    onVote?.(cand)
                  }}
                  className={`px-4 py-2 text-xs font-black rounded-lg shadow ${
                    myVote === detailFor.groupId
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {myVote === detailFor.groupId ? '✅ 이미 투표함' : '🗳️ 이 후보에게 투표하기'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CandidateBallotList
