import { useState, useEffect, useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import RoleWorkspace from '../scaffolding/RoleWorkspace'
import RoleAssigner from '../scaffolding/RoleAssigner'
import GroupRoleSummary from '../scaffolding/GroupRoleSummary'
import OtherGroupsRoleSummary from '../scaffolding/OtherGroupsRoleSummary'
import CommentList from '../phase1/CommentList'
import HighlightBox from '../shared/HighlightBox'

/**
 * RoundTabShell — 8단계 라운드 제네릭 껍데기.
 *
 * 새로운 라운드를 만들 때 LegislativeTab처럼 처음부터 짜는 대신,
 * 이 컴포넌트에 config를 주입해서 사용합니다.
 *
 * 고정 공통 단계 (이 쉘이 직접 처리):
 *   ① 역할 배정       — RoleAssigner (kind prop)
 *   ② 개인 미션작업   — RoleWorkspace (kind prop)
 *   ④ 온라인 토의     — 제출된 결과물에 CommentList로 의견
 *   ⑦ 결과 발표       — ResultDisplay 컴포넌트 (주입)
 *
 * 교체 가능한 가변 단계 (props로 주입):
 *   ③ 모둠 결과 제출  — SubmissionForm 컴포넌트
 *   ⑦ 결과 발표       — ResultDisplay 컴포넌트 (없으면 생략)
 *
 * ⑤ 토론주제 상정, ⑥ 오프토론 : Phase3Page의 교사 제어 + DebateTool이 담당 (탭 밖)
 * ⑧ 기사작성         : Phase3Page의 ArticleSection이 담당 (탭 밖)
 *
 * @param {{
 *   kind: string,               — 'legislative'|'executive'|'judicial'|custom
 *   sessionId: string,          — 역할 세션 ID (예: 'legislative-default')
 *   color: string,              — Tailwind 색상 키 (예: 'emerald', 'violet', 'amber')
 *   submissionLabel: string,    — 제출 섹션 제목 (예: '법안 제출', '정책보고서 제출')
 *   offlineLabel: string,       — 오프토론 섹션 이름 (예: '본회의', '국무회의', '법정토론')
 *   dataPath: string,           — RTDB 경로 (제출물 읽기·댓글 targetType에 사용)
 *   SubmissionForm: Component,  — ③ 결과제출 폼 컴포넌트
 *   ResultDisplay?: Component,  — ⑦ 결과발표 컴포넌트 (없으면 생략)
 *   teacherNote?: string,       — ② 단계 교사 안내 문구
 * }} props
 */
function RoundTabShell({
  kind,
  sessionId,
  color = 'indigo',
  submissionLabel = '모둠 결과 제출',
  offlineLabel = '오프라인 토론',
  dataPath,
  SubmissionForm,
  ResultDisplay = null,
  teacherNote = '',
}) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const wf = useWorkflow()

  // dataPath 경로의 제출물 구독
  const [submissionsMap, setSubmissionsMap] = useState({})
  useEffect(() => {
    if (!roomCode || !dataPath) return
    const u = subscribe(roomCode, dataPath, (d) => setSubmissionsMap(d || {}))
    return () => u?.()
  }, [roomCode, dataPath])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 내 모둠 제출물
  const mySubmission = myGroupId ? submissionsMap[myGroupId] : null
  // 제출된 모둠 목록 (status === 'submitted' 인 것)
  const submittedGroups = Object.entries(submissionsMap)
    .filter(([, s]) => s?.status === 'submitted')
    .map(([gid, s]) => ({ groupId: gid, ...s }))

  // Tailwind 색상 맵 (동적 클래스는 런타임에 결정되므로 미리 선언)
  const colorMap = {
    emerald: { bg: 'bg-emerald-50/30', border: 'border-emerald-300', title: 'text-emerald-900', badge: 'bg-emerald-600', light: 'bg-emerald-50 border-emerald-200' },
    violet:  { bg: 'bg-violet-50/30',  border: 'border-violet-300',  title: 'text-violet-900',  badge: 'bg-violet-600',  light: 'bg-violet-50 border-violet-200'   },
    amber:   { bg: 'bg-amber-50/30',   border: 'border-amber-300',   title: 'text-amber-900',   badge: 'bg-amber-600',   light: 'bg-amber-50 border-amber-200'     },
    slate:   { bg: 'bg-slate-50/30',   border: 'border-slate-300',   title: 'text-slate-900',   badge: 'bg-slate-600',   light: 'bg-slate-50 border-slate-200'     },
    indigo:  { bg: 'bg-indigo-50/30',  border: 'border-indigo-300',  title: 'text-indigo-900',  badge: 'bg-indigo-600',  light: 'bg-indigo-50 border-indigo-200'   },
  }
  const c = colorMap[color] || colorMap.indigo

  return (
    <div className="space-y-4">

      {/* === ①② 역할 배정 + 개인 미션 작업 === */}
      {role === 'student' && myGroupId && (() => {
        const myGroup = groups[myGroupId]
        const myRoleKey = myGroup?.sessionRoles?.[sessionId]?.[myStudentId]
        const groupRoles = myGroup?.sessionRoles?.[sessionId] || {}
        const hasGroupRoles = Object.values(groupRoles).filter(Boolean).length > 0
        const memberCount = myGroup?.members ? Object.keys(myGroup.members).length : 0

        return (
          <section className={`${c.bg} border-2 ${c.border} rounded-2xl p-4`}>
            <h2 className={`text-lg font-bold ${c.title} mb-3 flex items-baseline gap-2`}>
              <span className={`${c.badge} text-white text-xs px-2 py-0.5 rounded-full`}>①②</span>
              역할 배정 · 개인 미션 작업
            </h2>

            {/* 역할 배정 (미배정 시 펼침) */}
            <details
              open={!myRoleKey}
              className={`rounded-xl mb-3 ${myRoleKey ? `bg-white border-2 ${c.border}` : 'bg-amber-50 border-2 border-amber-400'}`}
            >
              <summary className="cursor-pointer p-3 font-bold flex items-center gap-2 select-none">
                {myRoleKey ? (
                  <span className={c.title}>🎭 모둠 4역할 배정 — 변경하려면 펼치기</span>
                ) : (
                  <span className="text-amber-900">🎭 먼저 4역할을 배정해야 임무 입력창이 나타나요 (펼치기)</span>
                )}
              </summary>
              <div className="px-3 pb-3 space-y-2">
                <p className="text-sm text-gray-700">
                  모둠원 {memberCount}명에게 역할을 1:1로 배정하세요.
                  {hasGroupRoles && !myRoleKey ? ' 아직 본인 역할만 비어 있어요.' : ''}
                </p>
                <div className="bg-white border border-gray-200 rounded-xl p-2">
                  <RoleAssigner groupId={myGroupId} sessionId={sessionId} kind={kind} />
                </div>
              </div>
            </details>

            {/* 개인 미션 작업 공간 */}
            <div className="grid lg:grid-cols-2 gap-4">
              <RoleWorkspace groupId={myGroupId} sessionId={sessionId} kind={kind} />
              <div className="space-y-3">
                <GroupRoleSummary groupId={myGroupId} sessionId={sessionId} kind={kind} />
                <OtherGroupsRoleSummary myGroupId={myGroupId} sessionId={sessionId} kind={kind} />
              </div>
            </div>
          </section>
        )
      })()}

      {/* 교사 화면 안내 */}
      {role === 'teacher' && teacherNote && (
        <div className={`${c.light} border rounded-xl p-3 text-sm`}>
          <p className={c.title}>👩‍🏫 {teacherNote}</p>
        </div>
      )}

      {/* === ③ 모둠 결과 제출 — SubmissionForm 주입 === */}
      {SubmissionForm && (
        <section className={`${c.bg} border-2 ${c.border} rounded-2xl p-4`}>
          <h2 className={`text-lg font-bold ${c.title} mb-3 flex items-baseline gap-2`}>
            <span className={`${c.badge} text-white text-xs px-2 py-0.5 rounded-full`}>③</span>
            {submissionLabel}
          </h2>
          {role === 'student' && myGroupId ? (
            <SubmissionForm
              groupId={myGroupId}
              dataPath={dataPath}
              sessionId={sessionId}
              kind={kind}
            />
          ) : role === 'teacher' ? (
            <div className={`${c.light} border rounded-xl p-3 text-xs text-gray-600`}>
              👩‍🏫 학생 화면에서 각 모둠이 {submissionLabel}을 작성합니다.
              제출 완료: {submittedGroups.length}개 모둠
            </div>
          ) : (
            <p className="text-sm text-gray-400">모둠 가입 후 이용 가능합니다.</p>
          )}
        </section>
      )}

      {/* === ④ 온라인 토의 — 제출된 결과물에 CommentList === */}
      {submittedGroups.length > 0 && (
        <section className="bg-amber-50/50 border-2 border-amber-300 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-amber-900 mb-3 flex items-baseline gap-2">
            <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">④</span>
            온라인 토의 — 다른 모둠 결과물 평가
          </h2>
          <p className="text-xs text-amber-800 mb-3">
            제출된 모둠의 결과물을 보고 의견을 남기세요.
          </p>
          <div className="space-y-4">
            {submittedGroups.map(({ groupId, ...sub }) => {
              const groupName = groups[groupId]?.name || groupId
              const isMyGroup = groupId === myGroupId
              return (
                <div key={groupId} className="bg-white rounded-xl border p-3">
                  <p className="text-xs font-bold text-gray-600 mb-2">
                    {groupName} {isMyGroup ? '(우리 모둠)' : ''}
                  </p>
                  {sub.summary && (
                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{sub.summary}</p>
                  )}
                  <CommentList
                    targetType={dataPath}
                    targetId={groupId}
                    readOnly={isMyGroup}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* === ⑤⑥ 토론 상정 + 오프토론 안내 === */}
      <section className="bg-indigo-50/50 border-2 border-indigo-300 rounded-2xl p-4">
        <h2 className="text-lg font-bold text-indigo-900 mb-2 flex items-baseline gap-2">
          <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">⑤⑥</span>
          {offlineLabel} (오프라인)
        </h2>
        <p className="text-sm text-indigo-800">
          {role === 'teacher'
            ? `👩‍🏫 교사 제어 패널에서 토론 도구를 활성화하고 ${offlineLabel}을 진행하세요.`
            : `🎙️ 선생님의 안내에 따라 ${offlineLabel}에 참여합니다.`}
        </p>
      </section>

      {/* === ⑦ 결과 발표 — ResultDisplay 주입 (없으면 생략) === */}
      {ResultDisplay && (
        <section className="bg-white border-2 border-gray-200 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-baseline gap-2">
            <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">⑦</span>
            결과 발표
          </h2>
          <ResultDisplay dataPath={dataPath} groups={groups} />
        </section>
      )}

    </div>
  )
}

export default RoundTabShell
