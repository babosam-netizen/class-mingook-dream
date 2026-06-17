import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import Phase1Page from '../../pages/Phase1Page'
import Phase2Page from '../../pages/Phase2Page'
import Phase3Page from '../../pages/Phase3Page'
import ReflectionPage from '../../pages/ReflectionPage'

// Phase 3 의 highlight 키 → 탭 매핑 (자동 전환용)
const PHASE3_TAB_KEYS = ['legislative', 'executive', 'judicial']

function getPhase3PreviewTab(step) {
  const stepId = step?.id || ''
  if (stepId === 'article1' || stepId === 'poll2') return 'legislative'
  if (stepId === 'article2' || stepId === 'poll3') return 'executive'
  if (stepId === 'article3' || stepId === 'poll4') return 'judicial'
  if (stepId.startsWith('legislative-')) return 'legislative'
  if (stepId.startsWith('executive-')) return 'executive'
  if (stepId.startsWith('judicial-') || stepId === 'judicial') return 'judicial'
  if (PHASE3_TAB_KEYS.includes(step?.highlight)) return step.highlight
  return null
}

/**
 * 교사 대시보드 — 학생 화면 미리보기 패널.
 *
 * - 현재 페이즈에 해당하는 학생 핵심 콘텐츠를 읽기 전용으로 임베드
 * - 입력·액션은 자동 비활성, 데이터만 표시
 *
 * Phase 1 / 2 / 4 는 간소 데이터 요약 (포스터·청원·후보·정리글 카운트 등).
 * Phase 3 는 입법/행정/사법 각 탭 컴포넌트에 previewMode 전달.
 */
function StudentScreenPreview() {
  const currentPhase = useGameStore((s) => s.currentPhase)
  const wf = useWorkflow()
  const highlight = wf.currentStep?.highlight
  const [phase3Tab, setPhase3Tab] = useState('legislative')

  // 교사 워크플로 단계 id 기준으로 미리보기 탭을 고정한다.
  // article/poll 단계는 highlight가 article/poll이라 이전 탭이 남을 수 있어 stepId로 먼저 판정한다.
  useEffect(() => {
    if (currentPhase !== 3) return
    const nextTab = getPhase3PreviewTab(wf.currentStep)
    if (nextTab) {
      setPhase3Tab(nextTab)
    }
  }, [highlight, wf.currentStep?.id, currentPhase])

  return (
    <div className="bg-white rounded-2xl shadow border flex flex-col h-full overflow-hidden">
      <header className="p-4 border-b bg-indigo-50/50 flex items-center gap-2">
        <span className="text-xl">📺</span>
        <h2 className="font-bold text-indigo-700">
          학생 화면 실시간 미리보기
        </h2>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-indigo-600 text-white rounded-full">LIVE</span>
      </header>

      <div className="px-4 pb-4 pt-2 space-y-3">
        {/* 안내 헤더 */}
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-900">
          <p className="font-bold">📺 학생들이 지금 보는 화면입니다 (읽기 전용)</p>
          <p className="text-[11px] text-indigo-700 mt-0.5">
            교사 미리보기 모드 — 입력 폼·추천·표결 등 학생 액션은 비활성됩니다. 데이터만 그대로 노출.
          </p>
        </div>

        {/* 현재 활동 안내 — 워크플로 highlight 표시 */}
        {wf.currentStep && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 text-xs">
            <span className="font-bold text-rose-800">▶ 지금 활동:</span>
            <span className="text-rose-700 ml-1">{wf.currentStep.studentLabel || wf.currentStep.label}</span>
            {wf.currentStep.session && (
              <span className="text-rose-500 ml-2 text-[10px]">{wf.currentStep.session}</span>
            )}
          </div>
        )}

        {/* 실제 학생 화면을 줌 아웃하여 스크린샷처럼 보여줌 (현재 활동 섹션으로 자동 스크롤 지원) */}
        <div 
          data-preview-container="true"
          className="relative w-full overflow-y-auto bg-gray-100 rounded-xl border shadow-inner" 
          style={{ height: '450px' }}
        >
          <div 
            className="absolute top-0 left-0 pointer-events-none"
            style={{ 
              width: '200%', 
              height: '400%', // 높이는 더 길게 해서 스크롤 영역 확보 (하지만 container가 자름)
              transform: 'scale(0.5)', 
              transformOrigin: 'top left',
              backgroundColor: '#f8fafc'
            }}
          >
            <div className="w-full h-full">
              {currentPhase === 1 && <Phase1Page previewMode />}
              {currentPhase === 2 && <Phase2Page previewMode />}
              {currentPhase === 3 && <Phase3Page previewMode forcedTab={phase3Tab} />}
              {currentPhase === 4 && <ReflectionPage previewMode />}
            </div>
          </div>
          
          {/* 클릭 방지 오버레이 */}
          <div className="absolute inset-0 z-10 cursor-default" />
        </div>

        <div className="text-[10px] text-gray-400 text-right italic">
          * Phase {currentPhase} 학생 화면 (50% 축소)
        </div>
      </div>
    </div>
  )
}

export default StudentScreenPreview
