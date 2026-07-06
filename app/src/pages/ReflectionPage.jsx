import { useEffect, useMemo, useState } from 'react'
import RoomBar from '../components/shared/RoomBar'
import MyJourneyTimeline from '../components/phase4/MyJourneyTimeline'
import CanvaCardNewsStep from '../components/phase4/CanvaCardNewsStep'
import ReflectionStructuredEditor from '../components/phase4/ReflectionStructuredEditor'
import ReflectionCard from '../components/phase4/ReflectionCard'
import ReflectionApprovalQueue from '../components/phase4/ReflectionApprovalQueue'
import ClassJourneyFinale from '../components/phase4/ClassJourneyFinale'
import useGameStore from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'
import { PHASE_META, CARD } from '../styles/tokens'
import SessionFinishButton from '../components/shared/SessionFinishButton'
import PollFeed from '../components/shared/PollFeed'
import DiscussionPrompt from '../components/shared/DiscussionPrompt'
import StudentWorkflowProgress from '../components/shared/StudentWorkflowProgress'
import HighlightBox from '../components/shared/HighlightBox'
import { useWorkflow } from '../lib/use-workflow'

const SORTS = [
  { id: 'recent',  label: '최신순' },
  { id: 'empathy', label: '공감 많은 순' },
]

// 워크플로 단계 → 학생용 안내 라벨
const STEP_GUIDE = {
  timeline:  { icon: '📅', title: '나의 여정 돌아보기', desc: '1·2·3여정 활동에 별점을 매겨 보세요.' },
  canvanews: { icon: '🎨', title: '캔바 카드뉴스 제작', desc: '별점 높은 활동을 중심으로 카드뉴스를 만들어 URL을 제출하세요.' },
  reflect:   { icon: '📝', title: '정리글 작성', desc: '카드뉴스를 참고해 개요·중심문장·뒷받침문장으로 정리글을 완성하세요.' },
  approve:   { icon: '⏳', title: '선생님 검토 중', desc: '선생님께서 정리글을 확인하고 계세요. 잠시 기다려 주세요.' },
  gallery:   { icon: '🖼️', title: '친구들 정리글 감상', desc: '친구들의 카드뉴스와 정리글을 읽고 이모지 공감과 댓글을 남겨 보세요.' },
  closing:   { icon: '🎬', title: '우리 반의 여정 마무리', desc: '우리 반의 여정을 함께 돌아보며 프로젝트를 마무리해요.' },
}

function ReflectionPage({ previewMode = false }) {
  const meta        = PHASE_META[4]
  const role        = useGameStore((s) => s.role)
  const wf          = useWorkflow()
  const isStudent   = role === 'student' || previewMode
  const isTeacher   = role === 'teacher' && !previewMode
  const anyHL       = isStudent && !!wf.currentStep?.highlight

  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [reflectionsMap, setReflectionsMap] = useState({})
  const [reflectionsLoaded, setReflectionsLoaded] = useState(false)
  const [sort, setSort] = useState('recent')

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'reflections', (d) => {
      setReflectionsMap(d || {})
      setReflectionsLoaded(true)
    })
    return () => u?.()
  }, [roomCode])

  const currentStepId = wf.currentStep?.id || 'timeline'

  // 내 정리글
  const myReflection = useMemo(() =>
    Object.entries(reflectionsMap)
      .map(([id, r]) => ({ id, ...r }))
      .find((r) => r.authorStudentId === myStudentId),
    [reflectionsMap, myStudentId]
  )

  // 갤러리용 필터 + 정렬
  const reflections = useMemo(() => {
    const arr = Object.entries(reflectionsMap).map(([id, r]) => ({ id, ...r }))
    const visible = arr.filter((r) => {
      if (isTeacher)                     return true
      if (r.status !== 'approved')        return r.authorStudentId === myStudentId
      if (r.isPrivate)                    return r.authorStudentId === myStudentId
      return true
    })
    if (sort === 'empathy') {
      return visible.sort((a, b) => {
        const aSum = Object.values(a.empathy || {}).reduce((s, n) => s + (n || 0), 0)
        const bSum = Object.values(b.empathy || {}).reduce((s, n) => s + (n || 0), 0)
        return bSum - aSum
      })
    }
    return visible.sort((a, b) =>
      (b.approvedAt || b.updatedAt || b.createdAt || 0) - (a.approvedAt || a.updatedAt || a.createdAt || 0)
    )
  }, [reflectionsMap, isTeacher, myStudentId, sort])

  // 단계별 학생 UI 렌더
  const renderStudentStep = () => {
    const guide = STEP_GUIDE[currentStepId] || STEP_GUIDE.timeline

    return (
      <div className="space-y-5">
        {/* 단계 안내 배너 — 타임라인 단계는 MyJourneyTimeline 자체 헤더가 있어 중복이라 숨김 */}
        {currentStepId !== 'timeline' && (
          <div className="bg-white rounded-2xl border-2 border-pink-200 shadow-sm p-4 flex items-start gap-3">
            <span className="text-3xl">{guide.icon}</span>
            <div>
              <p className="font-black text-pink-800">{guide.title}</p>
              <p className="text-sm text-gray-600 mt-0.5">{guide.desc}</p>
            </div>
          </div>
        )}

        {/* 1단계: 나의 여정 타임라인 */}
        {currentStepId === 'timeline' && (
          <HighlightBox active={wf.isHighlight('timeline')} anyHighlight={anyHL} previewMode={previewMode}>
            <MyJourneyTimeline />
          </HighlightBox>
        )}

        {/* 2단계: 캔바 카드뉴스 */}
        {currentStepId === 'canvanews' && (
          <HighlightBox active={wf.isHighlight('canva')} anyHighlight={anyHL} previewMode={previewMode}>
            <CanvaCardNewsStep />
          </HighlightBox>
        )}

        {/* 3단계: 정리글 작성 / 수정 */}
        {currentStepId === 'reflect' && (
          <HighlightBox active={wf.isHighlight('editor')} anyHighlight={anyHL} previewMode={previewMode}>
            {/* Firebase 첫 로드 전: 로딩 표시 (key 플리커 방지) */}
            {!reflectionsLoaded ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
                <span className="animate-spin text-xl">⏳</span>
                <span>불러오는 중...</span>
              </div>
            ) : !myReflection || myReflection.status === 'writing' ? (
              <ReflectionStructuredEditor
                key={myReflection?.id ?? 'new'}
                existingReflection={myReflection}
              />
            ) : myReflection.status === 'rejected' ? (
              <div className="space-y-4">
                {/* 반려 상태 표시 */}
                <div className="p-4 rounded-2xl border-2 bg-red-50 border-red-200 shadow-sm animate-pulse">
                  <div>
                    <p className="font-bold text-sm text-red-800">
                      ✗ 반려됨 — 수정이 필요해요
                    </p>
                    {myReflection.rejectMemo && (
                      <p className="text-xs text-red-700 mt-1 bg-white border border-red-100 rounded-xl px-3 py-2 font-medium shadow-sm leading-relaxed">
                        💬 선생님 피드백: {myReflection.rejectMemo}
                      </p>
                    )}
                  </div>
                </div>
                {/* 반려 시 에디터를 접지 않고 바로 밑에 노출 */}
                <ReflectionStructuredEditor
                  key={myReflection?.id ?? 'new'}
                  existingReflection={myReflection}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* 제출 완료 또는 승인 완료 상태 표시 */}
                <div className={`p-4 rounded-2xl border-2 shadow-sm ${
                  myReflection.status === 'approved' ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">
                        {myReflection.status === 'approved' ? '✓ 승인됨 — 게시 중' : '⏳ 승인 대기 중'}
                      </p>
                      {myReflection.isModified && (
                        <p className="text-xs text-amber-700 mt-0.5">✏️ 수정됨 (선생님이 확인할 수 있어요)</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 수정 에디터 인라인 */}
                <details className="bg-white rounded-2xl border-2 border-pink-200 shadow-sm">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-pink-700 hover:bg-pink-50 rounded-2xl">
                    ✏️ 내 정리글 수정하기
                  </summary>
                  <div className="p-4 pt-2">
                    <ReflectionStructuredEditor
                      key={myReflection?.id ?? 'new'}
                      existingReflection={myReflection}
                    />
                  </div>
                </details>
              </div>
            )}
          </HighlightBox>
        )}

        {/* 4단계: 선생님 검토 대기 (학생은 미리보기만) */}
        {currentStepId === 'approve' && (
          <HighlightBox active={wf.isHighlight('approve')} anyHighlight={anyHL} previewMode={previewMode}>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5 text-center space-y-2">
                <p className="text-3xl">⏳</p>
                <p className="font-bold text-yellow-800">선생님께서 정리글을 검토하고 있어요</p>
                <p className="text-sm text-gray-600">승인이 완료되면 친구들의 정리글을 볼 수 있어요.</p>
              </div>
              {/* 내 글 수정은 여전히 가능 */}
              {myReflection && (
                <details className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-2xl">
                    ✏️ 내 정리글 미리 수정하기
                  </summary>
                  <div className="p-4 pt-2">
                    <ReflectionStructuredEditor
                      key={myReflection?.id ?? 'new'}
                      existingReflection={myReflection}
                    />
                  </div>
                </details>
              )}
            </div>
          </HighlightBox>
        )}

        {/* 5단계: 갤러리 워크 */}
        {currentStepId === 'gallery' && (
          <HighlightBox active={wf.isHighlight('gallery')} anyHighlight={anyHL} previewMode={previewMode}>
            <ReflectionGallery reflections={reflections} sort={sort} setSort={setSort} role={role} />
          </HighlightBox>
        )}

        {/* 6단계: 피날레 */}
        {currentStepId === 'closing' && (
          <HighlightBox active={wf.isHighlight('finale')} anyHighlight={anyHL} previewMode={previewMode}>
            <ClassJourneyFinale />
          </HighlightBox>
        )}
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${meta.pageBg}`}>
      <RoomBar />
      <main className="max-w-6xl mx-auto p-4 lg:p-6 space-y-5">
        <StudentWorkflowProgress tone="pink" />

        <header className="space-y-2">
          <h1 className={`text-2xl font-bold ${meta.titleText}`}>🎬 네 번째 여정 — 시사회</h1>
          <p className="text-sm text-gray-600">
            우리가 만든 작은 대한민국을 돌아보고, 나의 이야기를 정리글로 완성해 봐요.
          </p>
          {isStudent && currentStepId !== 'timeline' && (
            <DiscussionPrompt
              tone="pink"
              question="이 프로젝트가 나에게 남긴 것은 무엇인가?"
              subline="여정을 돌아보고, 카드뉴스를 만들고, 나만의 글로 마무리해 봐요."
            />
          )}
        </header>

        {/* 교사: 항상 승인 큐 + 전체 갤러리 표시 */}
        {isTeacher && (
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <ReflectionApprovalQueue />
              </div>
            </div>
            <div className="lg:col-span-3">
              <ReflectionGallery reflections={reflections} sort={sort} setSort={setSort} role={role} showAll />
            </div>
          </div>
        )}

        {/* 학생: 단계별 분기 */}
        {isStudent && renderStudentStep()}

        {/* 여론조사 피드 (모든 단계) */}
        <HighlightBox active={wf.isHighlight('poll')} anyHighlight={anyHL} previewMode={previewMode}>
          <div className="mt-2">
            <PollFeed />
          </div>
        </HighlightBox>
      </main>
      <SessionFinishButton />
    </div>
  )
}

// ── 공용 갤러리 서브컴포넌트
function ReflectionGallery({ reflections, sort, setSort, role, showAll }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        {SORTS.map((s) => (
          <button key={s.id} onClick={() => setSort(s.id)}
            className={`px-3 py-1 text-sm rounded-lg ${sort === s.id ? 'bg-pink-600 text-white' : 'bg-white border hover:border-pink-400'}`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{reflections.length}개 글</span>
      </div>
      {reflections.length === 0 ? (
        <div className={CARD.ghost}>
          아직 정리 글이 없어요.{' '}
          {role === 'student' && '선생님 승인 후 친구들 글이 여기 나타나요.'}
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {reflections.map((r) => (
            <ReflectionCard key={r.id} reflection={r} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ReflectionPage
