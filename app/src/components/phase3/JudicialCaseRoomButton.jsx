/**
 * JudicialCaseRoomButton.jsx
 *
 * 어느 단계에서든 사건 자료실을 버튼 클릭으로 모달로 열 수 있게 해주는 컴포넌트.
 * - JudicialTab: 준비 단계 이후 상단에 고정 노출
 * - DebateToolPanel: 토론 도구 내에서도 접근 가능
 */

import { useState } from 'react'
import JudicialCaseRoom from './JudicialCaseRoom'

export default function JudicialCaseRoomButton({ currentStage = 3, label = '📖 사건 자료실 보기' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors"
      >
        {label}
      </button>

      {/* 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-rose-100 bg-rose-50 rounded-t-2xl flex-shrink-0">
              <h2 className="text-sm font-bold text-rose-800">📖 사건 자료실</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-rose-400 hover:text-rose-700 text-lg leading-none font-bold"
              >
                ✕
              </button>
            </div>

            {/* 본문 스크롤 영역 */}
            <div className="overflow-y-auto flex-1 p-4">
              <JudicialCaseRoom currentStage={currentStage} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
