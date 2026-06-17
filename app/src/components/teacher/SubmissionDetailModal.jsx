import { useMemo } from 'react'

export default function SubmissionDetailModal({ isOpen, onClose, title, items, renderItem }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
             <span>🔍</span> {title}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <p className="text-center py-10 text-slate-400 italic">제출된 내역이 없습니다.</p>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="bg-white border rounded-2xl p-4 shadow-sm">
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
        <footer className="px-6 py-4 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors text-sm">확인</button>
        </footer>
      </div>
    </div>
  )
}
