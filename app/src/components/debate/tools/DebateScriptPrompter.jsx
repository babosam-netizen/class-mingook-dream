import { useState, useMemo } from 'react'

/**
 * 토론 대본 프롬프트 (학생용 - 토론 중).
 * - 뉴스 앵커 프롬프트 스타일 UI
 * - 가독성 높은 폰트 사이즈 및 줄 간격
 * - 내 진영 대본 자동 표시
 * 
 * @param {{ scripts, mySideId, sideLabel }} props
 */
function DebateScriptPrompter({ scripts = {}, mySideId, sideLabel }) {
  const script = scripts[mySideId]?.body || ''
  const [fontSize, setFontSize] = useState(16)

  const lines = useMemo(() => {
    return script.split('\n').filter(l => l.trim() !== '')
  }, [script])

  if (mySideId === 'none') {
    return null
  }

  if (!script) {
    return (
      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-dashed border-slate-200 text-center">
        <p className="text-[11px] text-slate-400 font-bold">
          작성된 대본이 없습니다. 토론 전 단계에서 대본을 작성해 주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
      {/* 프롬프트 헤더 */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            {sideLabel} News Prompter
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setFontSize(s => Math.max(12, s - 2))}
            className="text-slate-400 hover:text-white text-xs font-bold w-6 h-6 rounded bg-slate-700 flex items-center justify-center"
          >
            A-
          </button>
          <button 
            onClick={() => setFontSize(s => Math.min(32, s + 2))}
            className="text-slate-400 hover:text-white text-xs font-bold w-6 h-6 rounded bg-slate-700 flex items-center justify-center"
          >
            A+
          </button>
        </div>
      </div>

      {/* 프롬프트 본문 */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-black/40">
        <div className="space-y-6 max-w-2xl mx-auto">
          {lines.map((line, i) => {
            const isHeader = line.startsWith('[') && line.endsWith(']')
            // 다른 역할 차례(축약된 "화자: …" 줄)는 흐리게 — 내 대사만 또렷하게.
            const isOther = /:\s*…\s*$/.test(line)
            return (
              <p
                key={i}
                style={{ fontSize: isHeader ? fontSize * 0.8 : (isOther ? fontSize * 0.8 : fontSize) }}
                className={`leading-relaxed transition-all duration-300 ${
                  isHeader
                    ? 'text-blue-400 font-black border-b border-blue-900/50 pb-1 mt-8 first:mt-0'
                    : isOther
                      ? 'text-slate-500 font-normal italic'
                      : 'text-slate-100 font-bold'
                }`}
              >
                {line}
              </p>
            )
          })}
          <div className="h-20" /> {/* 하단 여백 - 읽기 편하게 */}
        </div>
      </div>

      {/* 안내선 (앵커가 보는 위치 표시용 - 시각적 요소) */}
      <div className="absolute top-1/2 left-0 w-full h-px bg-blue-500/10 pointer-events-none"></div>
    </div>
  )
}

export default DebateScriptPrompter
