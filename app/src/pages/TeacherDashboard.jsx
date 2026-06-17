import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import RoomBar from '../components/shared/RoomBar'
import ClassroomConfigEditor from '../components/teacher/ClassroomConfigEditor'
import BranchConfigEditor from '../components/teacher/BranchConfigEditor'
import LinkApprovalQueue from '../components/teacher/LinkApprovalQueue'
import Phase3Controls from '../components/teacher/Phase3Controls'
import PhaseWorkflow from '../components/teacher/PhaseWorkflow'

import StudentActivityMonitor from '../components/teacher/StudentActivityMonitor'
import GroupFormationMonitor from '../components/teacher/GroupFormationMonitor'
import StudentScreenPreview from '../components/teacher/StudentScreenPreview'
import Phase3LegislativeQuickPanel from '../components/teacher/Phase3LegislativeQuickPanel'
import Phase3ExecutiveQuickPanel from '../components/teacher/Phase3ExecutiveQuickPanel'
import Phase3JudicialQuickPanel from '../components/teacher/Phase3JudicialQuickPanel'
import Phase2ElectionQuickPanel from '../components/teacher/Phase2ElectionQuickPanel'
import Phase2RoleControlPanel from '../components/teacher/Phase2RoleControlPanel'
import SubmissionStatusQuickPanel from '../components/teacher/SubmissionStatusQuickPanel'
import ExpertCallNotifier from '../components/scaffolding/ExpertCallNotifier'
import PetitionAdmin from '../components/petition/PetitionAdmin'
import TeacherDebateControl from '../components/debate/TeacherDebateControl'
import SubmissionMonitor from '../components/teacher/SubmissionMonitor'
import useDebateStore from '../store/debateStore'
import useGameStore, { getDefaultConfig } from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'
import { useWorkflow } from '../lib/use-workflow'

const PHASE_TITLES = {
  1: '시민 광장 — 시민단체 결성·캠페인·1차 여론조사',
  2: '선거 — 후보 등록·토론·투표·결과 발표',
  3: '국정 포털 — 입법·행정·사법부 활동',
  4: '시사회 — 정리글·갤러리 워크',
}

function TeacherDashboard() {
  const navigate = useNavigate()
  const wf = useWorkflow()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.className)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const setPhase = useGameStore((s) => s.setPhase)
  const destroyRoom = useGameStore((s) => s.destroyRoom)
  const students = useGameStore((s) => s.students)
  const config = useGameStore((s) => s.config)
  const updateConfig = useGameStore((s) => s.updateConfig)
  const groups = useGameStore((s) => s.groups)

  const [linksModal, setLinksModal] = useState(null) // null | 'pending' | 'approved' | 'all'
  const [configModal, setConfigModal] = useState(false)
  const [petitionModal, setPetitionModal] = useState(false)
  const [debateModal, setDebateModal] = useState(false)
  const [submissionsModal, setSubmissionsModal] = useState(false)
  const [linkCounts, setLinkCounts] = useState({ pending: 0, approved: 0, total: 0 })
  const [petitionCounts, setPetitionCounts] = useState({ pending: 0, approved: 0, rejected: 0 })

  // 토론 활성 세션 상태(상단 바 배지용)
  const debateSession = useDebateStore((s) => s.currentSession)
  const debateAttach = useDebateStore((s) => s.attachListener)
  const myStudentId = useGameStore((s) => s.myStudentId)
  useEffect(() => {
    if (roomCode) debateAttach(roomCode, myStudentId)
  }, [roomCode, myStudentId, debateAttach])

  // 링크 카운트 구독 — 대기·승인 뱃지 + 깜박 효과용
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'links', (d) => {
      const arr = Object.values(d || {})
      const c = { pending: 0, approved: 0, total: arr.length }
      for (const l of arr) c[l.status] = (c[l.status] || 0) + 1
      setLinkCounts(c)
    })
    return () => u?.()
  }, [roomCode])

  // 청원 카운트 구독 — 대기·게시·반려 뱃지
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'petitions', (d) => {
      const arr = Object.values(d || {})
      const c = { pending: 0, approved: 0, rejected: 0 }
      for (const p of arr) c[p.status] = (c[p.status] || 0) + 1
      setPetitionCounts(c)
    })
    return () => u?.()
  }, [roomCode])

  const onlineCount = Object.values(students).filter((s) => s?.isOnline).length
  const totalCount = Object.keys(students).length
  const onlineStudentList = Object.values(students).filter((s) => s?.isOnline)
  const finishedCount = onlineStudentList.filter(
    (s) => s?.sessionFinishedAtPhase === currentPhase,
  ).length
  const allFinished =
    onlineStudentList.length > 0 && finishedCount === onlineStudentList.length

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow text-center max-w-md">
          <h2 className="text-xl font-bold text-red-700">접근 권한이 없습니다</h2>
          <p className="text-sm text-gray-500 mt-2">
            교사 계정으로만 접근할 수 있는 화면입니다.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-800 text-white"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  const handleDestroy = async () => {
    if (
      !window.confirm(
        `정말 방 ${roomCode} 를 영구 삭제할까요?\n모든 학생 활동 기록이 사라지며 복구할 수 없습니다.`,
      )
    )
      return
    await destroyRoom()
    navigate('/')
  }

  const openQrShare = () => {
    const qs = new URLSearchParams({
      code: roomCode,
      className: className || '학급',
    })
    window.open(
      `${window.location.origin}${window.location.pathname}#/share?${qs.toString()}`,
      '_blank',
      'width=900,height=900,resizable=yes',
    )
  }

  // 다음 페이즈로 이동
  const goNextPhase = () => {
    if (currentPhase >= 4) {
      alert('이미 마지막 페이즈입니다.')
      return
    }
    if (!allFinished && onlineStudentList.length > 0) {
      const remain = onlineStudentList.length - finishedCount
      if (
        !window.confirm(
          `아직 ${remain}명이 ‘차시 끝’을 누르지 않았습니다.\n그래도 다음 페이즈(Phase ${currentPhase + 1})로 넘어가시겠습니까?`,
        )
      )
        return
    }
    setPhase(currentPhase + 1)
  }

  const onConfigChange = (next) => updateConfig(next)
  const onResetConfig = () => {
    if (!confirm('설정을 기본값으로 되돌릴까요?')) return
    updateConfig(getDefaultConfig())
  }

  return (
    <div className="min-h-screen bg-indigo-50">
      <RoomBar />

      {/* 우상단 도구 바 — 링크 관리 / 학급 설정 / 입장QR / 갤러리 / 분석 / 영구 삭제 */}
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 pt-3 flex items-center justify-end gap-1 flex-wrap">
        {/* 링크 관리 — 대기 / 승인 / 전체 (각각 모달) */}
        <div className="flex items-center gap-0.5 mr-1 bg-white rounded-lg shadow-sm p-1">
          <span className="text-[11px] text-gray-500 px-1 font-semibold">📎 링크</span>
          <button
            onClick={() => setLinksModal('pending')}
            className={`text-xs px-2 py-1 rounded font-semibold transition ${
              linkCounts.pending > 0
                ? 'bg-amber-500 text-white animate-pulse hover:bg-amber-600'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
            title="대기 중인 링크 확인"
          >
            대기 {linkCounts.pending}
          </button>
          <button
            onClick={() => setLinksModal('approved')}
            className="text-xs px-2 py-1 rounded font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            title="승인된 링크 확인"
          >
            승인 {linkCounts.approved}
          </button>
          <button
            onClick={() => setLinksModal('all')}
            className="text-xs px-2 py-1 rounded font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="모든 링크 보기"
          >
            전체 {linkCounts.total}
          </button>
        </div>
        {/* 청원 관리 — 대기 N건 깜박 (config.petitionEnabled) */}
        {config?.petitionEnabled !== false && (
          <button
            onClick={() => setPetitionModal(true)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              petitionCounts.pending > 0
                ? 'bg-amber-500 text-white animate-pulse hover:bg-amber-600'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
            title="국민청원 관리"
          >
            📜 청원 {petitionCounts.pending > 0 ? `· 대기 ${petitionCounts.pending}` : `· ${petitionCounts.approved}`}
          </button>
        )}
        {/* 토론 도구 — 활성 세션 있으면 강조 (config.debateToolEnabled) */}
        {config?.debateToolEnabled !== false && (
          <button
            onClick={() => setDebateModal(true)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              debateSession
                ? 'bg-violet-600 text-white animate-pulse hover:bg-violet-700'
                : 'bg-violet-500 text-white hover:bg-violet-600'
            }`}
            title="토론 도구 제어"
          >
            🎙️ 토론 도구{debateSession ? ' · 진행 중' : ''}
          </button>
        )}
        <button
          onClick={() => setSubmissionsModal(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600"
          title="모든 학생 제출물 열람"
        >
          🔍 제출물 열람
        </button>
        <button
          onClick={() => setConfigModal(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700"
          title="학급 설정 열기"
        >
          ⚙️ 학급 설정
        </button>
        <button
          onClick={openQrShare}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          title="학생 입장 QR을 새 창에서 크게 보기"
        >
          📱 입장 QR
        </button>
        <Link
          to="/gallery"
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
        >
          📷 갤러리
        </Link>
        <Link
          to="/analytics"
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          📊 학생 분석
        </Link>
        <button
          onClick={handleDestroy}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
          title="이 방 영구 삭제"
        >
          🗑️ 영구 삭제
        </button>
      </div>

      <main className="max-w-screen-2xl mx-auto p-4 lg:p-6 space-y-6">
        {/* ===== 메인 컬럼 ===== */}
        <div className="space-y-6">
        {/* 상단 통합 대시보드: 좌측(학급·시민단체 요약) + 우측(학생 화면 미리보기) */}
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="flex flex-col gap-4">
            {/* 1. 학급 요약 섹션 */}
            <section className="bg-white rounded-2xl shadow p-5 border-t-4 border-indigo-500">
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="text-lg">🏫</span> 학급 정보 요약
                </h3>
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-mono">
                  CODE: {roomCode}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-lg font-black text-indigo-900 truncate" title={config?.countryName || className}>
                    {config?.countryName || className || '우리 반'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">현재 단계</p>
                  <p className="text-lg font-black text-indigo-600">
                    {currentPhase === 1 ? '첫 번째' : currentPhase === 2 ? '두 번째' : currentPhase === 3 ? '세 번째' : '네 번째'} 여정
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">접속 현황</p>
                  <p className="text-lg font-black text-emerald-600">
                    {onlineCount}<span className="text-xs text-gray-400 font-normal ml-0.5">/{totalCount}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">완료 인원</p>
                  <p className="text-lg font-black text-amber-600">
                    {finishedCount}<span className="text-xs text-gray-400 font-normal ml-0.5">/{onlineStudentList.length}</span>
                  </p>
                </div>
              </div>
            </section>

            {/* 2. 모둠 구성 및 학생 현황 섹션 (좌측 하단 배치) [Antigravity] 통합 모니터링 */}
            <section className="bg-white rounded-2xl shadow p-5 flex-1 border-t-4 border-emerald-500">
              <GroupFormationMonitor />
            </section>
          </div>

          {/* 우측: 학생 화면 실시간 미리보기 (450px 고정 폭 사이드바 느낌) */}
          <div className="lg:h-full">
            <StudentScreenPreview />
          </div>
        </div>

        {/* 2. 페이즈 4그룹 — 4열 가로 배치 (각 열: [Phase 버튼] → [활동]) */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((p) => {
            const isCurrent = currentPhase === p
            const isDone = currentPhase > p
            return (
              <div key={p} className="space-y-2 flex flex-col">
                {/* Phase 버튼 */}
                <button
                  onClick={() => setPhase(p)}
                  className={`w-full text-left rounded-2xl px-3 py-2.5 font-bold transition shadow ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-300'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={PHASE_TITLES[p]}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-sm">
                      {isDone ? '✓ ' : isCurrent ? '▶ ' : ''}
                      {p === 1 ? '첫 번째' : p === 2 ? '두 번째' : p === 3 ? '세 번째' : '네 번째'} 여정
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white text-indigo-700 rounded-full font-semibold">
                        진행 중
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] font-normal mt-0.5 leading-tight ${
                      isCurrent ? 'text-indigo-100' : 'text-gray-500'
                    }`}
                  >
                    {PHASE_TITLES[p]}
                  </p>
                </button>

                {/* Phase 활동 패널 */}
                <section
                  className={`bg-white rounded-2xl shadow p-4 flex-1 ${
                    isCurrent
                      ? 'border-2 border-indigo-400 shadow-lg'
                      : 'border border-gray-200 opacity-90'
                  }`}
                >
                  <PhaseWorkflow phase={p} embedded />

                  {isCurrent && p === 3 && (
                    <div className="mt-4 pt-4 border-t">
                      <Phase3Controls />
                    </div>
                  )}
                </section>
              </div>
            )
          })}
        </div>

        {/* 4. 다음 페이즈 이동 버튼 */}
        {currentPhase < 4 && (
          <div className="flex justify-center">
            <button
              onClick={goNextPhase}
              className={`px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition ${
                allFinished
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {allFinished ? '✓ ' : ''}
              {currentPhase === 1 ? '두 번째' : currentPhase === 2 ? '세 번째' : '네 번째'} 여정으로 이동 →
            </button>
          </div>
        )}

        {/* 제 3 여정 입법/행정 빠른 제어 — 해당 부 활동 단계일 때만 노출 (이때만 페이지 스크롤) */}
        {currentPhase === 2 && wf.currentStep?.id === 'register' && (
          <Phase2RoleControlPanel />
        )}
        {currentPhase === 2 && ['prepoll', 'debatePrep', 'debateEval', 'vote', 'finalNews', 'nextJourney'].includes(wf.currentStep?.id) && (
          <Phase2ElectionQuickPanel onOpenDebateTool={() => setDebateModal(true)} />
        )}
        {currentPhase === 3 && wf.currentStep?.highlight === 'legislative' && (
          <Phase3LegislativeQuickPanel onOpenDebateTool={() => setDebateModal(true)} />
        )}
        {currentPhase === 3 && wf.currentStep?.highlight === 'executive' && <Phase3ExecutiveQuickPanel />}
        {currentPhase === 3 && (wf.currentStep?.highlight === 'judicial' || wf.currentStep?.id?.startsWith('judicial-')) && (
          <Phase3JudicialQuickPanel onOpenDebateTool={() => setDebateModal(true)} />
        )}
        <SubmissionStatusQuickPanel />

        </div> {/* /메인 컬럼 */}

        {/* 특수 상황 알림 (기존 사이드바 내용 통합) */}
        {currentPhase === 3 && (
          <section className="bg-white rounded-2xl shadow-lg border-2 border-indigo-100 p-4 animate-in slide-in-from-bottom-2 duration-300">
            <ExpertCallNotifier />
          </section>
        )}
      </main>

      {/* 링크 관리 모달 */}
      {linksModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-6 relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLinksModal(null)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none"
              title="닫기"
            >
              ✕
            </button>
            <LinkApprovalQueue initialFilter={linksModal} />
          </div>
        </div>
      )}

      {/* 토론 도구 제어 모달 */}
      {debateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDebateModal(false)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none"
              title="닫기"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold text-violet-700 mb-3">🎙️ 토론 도구 관리 화면</h2>
            <TeacherDebateControl />
          </div>
        </div>
      )}

      {/* 청원 관리 모달 */}
      {petitionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPetitionModal(false)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none"
              title="닫기"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold text-amber-700 mb-3">📜 국민청원 관리</h2>
            <PetitionAdmin />
          </div>
        </div>
      )}

      {/* 학급 설정 모달 */}
      {configModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setConfigModal(false)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none"
              title="닫기"
            >
              ✕
            </button>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold text-indigo-700">⚙️ 학급 설정</h2>
              <button
                onClick={onResetConfig}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
              >
                기본값 리셋
              </button>
            </div>
            <ClassroomConfigEditor
              value={config || getDefaultConfig()}
              onChange={onConfigChange}
              students={students}
              groups={groups}
            />
            <hr className="my-4 border-gray-200" />
            <BranchConfigEditor
              value={(config || getDefaultConfig()).branchConfig}
              onChange={(nextBranch) => onConfigChange({ ...(config || getDefaultConfig()), branchConfig: nextBranch })}
            />
          </div>
        </div>
      )}
 
      {/* 제출물 열람 모달 */}
      {submissionsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSubmissionsModal(false)}
        >
          <div
            className="bg-slate-50 rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col p-6 relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSubmissionsModal(false)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none z-10"
              title="닫기"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-4">
               <h2 className="text-xl font-black text-indigo-900">🔍 학생 제출물 전체 열람</h2>
               <span className="text-xs text-slate-400 font-bold">우리 반 모든 기록을 한눈에 확인하세요</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <SubmissionMonitor />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherDashboard
