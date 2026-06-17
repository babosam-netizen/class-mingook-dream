import { useEffect, useRef } from 'react'

/**
 * 워크플로 강조 박스 — 떠 있는 카드 효과 + active 전환 시 자동 스크롤.
 *
 * 학생 화면에서 교사가 [다음] 누르면 다음 활성 섹션으로 부드럽게 스크롤한다.
 *
 * props:
 *   active: 이 섹션이 현재 강조 대상인가
 *   anyHighlight: 페이즈 전체에 강조 단계가 활성화 됐는가 (아니면 효과 미적용)
 *   children
 *   scrollBlock: 스크롤 위치 (start | center | end | nearest)
 */
function HighlightBox({ active, anyHighlight, children, className = '', previewMode = false, scrollBlock = 'center' }) {
  const ref = useRef(null)
  const wasActive = useRef(false)

  // active가 false → true 전이 또는 첫 마운트 시 active=true → scrollIntoView
  useEffect(() => {
    if (active && !wasActive.current && ref.current) {
      // DOM이 transform/scale을 적용한 뒤 스크롤하도록 약간 지연
      const t = setTimeout(() => {
        if (previewMode) {
          // [Antigravity] 미리보기 모드에서는 전체 페이지 스크롤(shake) 방지를 위해 타겟 컨테이너만 직접 스크롤
          const container = document.querySelector('[data-preview-container="true"]')
          if (container) {
            // scale(0.5) 감안하여 계산 (반으로 줄어든 좌표계)
            const offsetTop = ref.current.offsetTop * 0.5
            const scrollPos = scrollBlock === 'center' 
              ? offsetTop - (container.clientHeight / 2) + (ref.current.clientHeight * 0.25)
              : offsetTop - 90 // 상단 여백 (180px * 0.5)
            
            container.scrollTo({
              top: Math.max(0, scrollPos),
              behavior: 'smooth'
            })
          }
        } else {
          // 일반 학생 화면은 표준 scrollIntoView 사용
          ref.current?.scrollIntoView({
            behavior: 'smooth',
            block: scrollBlock,
          })
        }
      }, 100)
      return () => clearTimeout(t)
    }
    wasActive.current = active
  }, [active, previewMode, scrollBlock])

  if (!anyHighlight) {
    return <div ref={ref} className={className}>{children}</div>
  }

  if (active) {
    return (
      <div
        ref={ref}
        className={`relative z-20 my-6 p-3 transform scale-[1.06] transition-all duration-500 rounded-3xl bg-white/40
                    shadow-[0_30px_60px_-15px_rgba(99,102,241,0.45),0_0_40px_-5px_rgba(99,102,241,0.3)]
                    ${className}`}
        style={{ scrollMarginTop: '180px', scrollMarginBottom: '40px' }}
      >
        {children}
      </div>
    )
  }

  return null
}

export default HighlightBox
