import { useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { topicBg } from '../../styles/tokens'
import StudentActivityMonitor from './StudentActivityMonitor'
import SubmissionDetailModal from './SubmissionDetailModal'

/**
 * 모둠별 학생 현황 모니터.
 * '모둠 구성 현황' + '학생 모니터링'을 결합한 버전.
 */
function GroupFormationMonitor() {
  const groups = useGameStore((s) => s.groups) || {}
  const config = useGameStore((s) => s.config) || {}
  const students = useGameStore((s) => s.students) || {}
  const currentPhase = useGameStore((s) => s.currentPhase)
  
  const [detailOpen, setDetailOpen] = useState(false)
  const [viewingPoster, setViewingPoster] = useState(null) // { groupName, url }
  
  const classSize = Number(config.classSize || 0)
  const assignedSlots = config.assignedSlots || {}

  // 1. 가공 데이터: 접속한 학생들 가공
  const joinedStudents = useMemo(() => {
    return Object.entries(students).map(([sid, s]) => ({
      sid,
      ...s,
      isOnline: !!s.isOnline || (!!s.lastSeen && (Date.now() - Number(s.lastSeen) < 45000)),
      isTabActive: s.isTabActive !== false,
      status: 'joined'
    }))
  }, [students])

  // 2. 미접속 학생 중 지정된 학생들 가공
  const missingAssigned = useMemo(() => {
    if (classSize <= 0) return []
    const joinedNumbers = new Set(joinedStudents.map(s => s.number))
    const missing = []
    for (const [numStr, tid] of Object.entries(assignedSlots)) {
      const num = Number(numStr)
      if (num <= classSize && !joinedNumbers.has(num)) {
        missing.push({ number: num, groupId: tid, status: 'missing-assigned' })
      }
    }
    return missing
  }, [assignedSlots, joinedStudents, classSize])

  // 3. 시민단체별 멤버 (접속 + 미접속 지정 포함)
  const groupsWithMembers = useMemo(() => {
    const topics = config.topics || {}
    return Object.entries(topics).map(([tid, t]) => {
      const g = groups[tid]
      const joined = joinedStudents.filter(s => s.groupId === tid)
      const missing = missingAssigned.filter(m => m.groupId === tid)
      
      const allMembers = [...joined, ...missing].sort((a, b) => (a.number || 0) - (b.number || 0))

      return {
        tid,
        topic: t,
        group: g,
        members: allMembers,
        formed: !!g || joined.length > 0
      }
    })
  }, [config.topics, groups, joinedStudents, missingAssigned])

  // 4. 미지정 학생 (로그인은 했으나 모둠 미합류)
  const unassignedStudents = useMemo(() => {
    return joinedStudents
      .filter(s => !s.groupId)
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [joinedStudents])

  // 5. 나머지 미접속 (지정 안 된 번호 중 미접속)
  const missingUnassigned = useMemo(() => {
    if (classSize <= 0) return []
    const joinedNumbers = new Set(joinedStudents.map(s => s.number))
    const assignedNumbers = new Set(Object.keys(assignedSlots).map(Number))
    const missing = []
    for (let i = 1; i <= classSize; i++) {
      if (!joinedNumbers.has(i) && !assignedNumbers.has(i)) {
        missing.push(i)
      }
    }
    return missing.sort((a, b) => a - b)
  }, [classSize, joinedStudents, assignedSlots])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span>👥</span> 시민단체 현황
        </h3>
        <button
          onClick={() => setDetailOpen(!detailOpen)}
          className={`text-xs px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
            detailOpen 
              ? 'bg-indigo-600 text-white shadow-inner' 
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          {detailOpen ? '활동 상세 접기 ▲' : '활동 상세 펼치기 ▼'}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 모둠별 카드 */}
        {groupsWithMembers.map(({ tid, topic, group, members, formed }) => (
          <div 
            key={tid} 
            className={`p-3 rounded-2xl border-2 transition ${
              formed 
                ? `${topicBg(topic.color)} border-white/50 shadow-sm` 
                : 'bg-gray-50 border-dashed border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => group?.posterUrl && setViewingPoster({ name: group.name, url: group.posterUrl })}
                className={`font-bold text-sm truncate text-left ${group?.posterUrl ? 'hover:underline hover:text-indigo-600 cursor-pointer' : ''}`}
                title={group?.posterUrl ? '클릭하여 포스터 보기' : ''}
              >
                {topic.emoji} {group?.name || topic.name}
                {group?.posterUrl && <span className="ml-1 text-xs">🖼️</span>}
              </button>
              <span className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded-full font-bold">
                {members.length}명
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5">
              {members.map(s => (
                <StudentTag key={s.sid || `missing-${s.number}`} student={s} currentPhase={currentPhase} />
              ))}
              {members.length === 0 && (
                <span className="col-span-2 text-[10px] text-gray-400 italic text-center py-1">멤버 없음</span>
              )}
            </div>
          </div>
        ))}

      </div>

      {/* 하단 부가 정보 섹션 (가로 와이드) */}
      <div className="space-y-3 pt-2">
        {/* 미지정 학생 (로그인은 했으나 모둠 미합류) */}
        {unassignedStudents.length > 0 && (
          <div className="p-4 rounded-2xl border-2 bg-amber-50 border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-sm text-amber-800 flex items-center gap-1">
                <span>👤</span> 미지정 학생
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-white text-amber-700 rounded-full font-bold border border-amber-200">
                {unassignedStudents.length}명
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unassignedStudents.map(s => (
                <StudentTag key={s.sid} student={s} currentPhase={currentPhase} />
              ))}
            </div>
          </div>
        )}

        {/* 미접속 학생 (학급 인원 중 지정도 안 되고 로그인도 안 한 번호) */}
        {missingUnassigned.length > 0 && (
          <div className="p-4 rounded-2xl border-2 bg-gray-50 border-gray-200 opacity-80 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-sm text-gray-500 flex items-center gap-1">
                <span>🚪</span> 미접속 (지정 외)
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-white text-gray-400 rounded-full font-bold border border-gray-200">
                {missingUnassigned.length}명
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingUnassigned.map(num => (
                <div key={num} className="px-3 py-1 bg-white text-gray-400 border border-gray-200 rounded-lg text-[10px] font-bold shadow-sm min-w-[50px] text-center">
                  {num}번
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {detailOpen && (
        <div className="mt-2 p-5 bg-white rounded-3xl border-2 border-indigo-100 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-2 mb-4 text-indigo-900 border-b pb-2">
            <span className="text-lg">📊</span>
            <h4 className="font-bold">학생별 활동 상세 현황</h4>
          </div>
          <StudentActivityMonitor />
        </div>
      )}

      {viewingPoster && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setViewingPoster(null)}
          title={`${viewingPoster.name}의 캠페인 포스터`}
          items={[viewingPoster.url]}
          renderItem={(url) => (
            <img src={url} alt="포스터" className="w-full rounded-2xl shadow-lg" />
          )}
        />
      )}
    </div>
  )
}

function StudentTag({ student: s, currentPhase }) {
  const isFinished = s.sessionFinishedAtPhase === currentPhase
  const isMissingAssigned = s.status === 'missing-assigned'
  
  if (isMissingAssigned) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 text-gray-400 text-[10px] font-bold w-full overflow-hidden">
        <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0" />
        <span className="truncate flex-1">{s.number}. 미접속</span>
      </div>
    )
  }

  return (
    <div 
      className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[11px] font-bold transition shadow-sm w-full overflow-hidden ${
        s.isOnline 
          ? 'bg-white border-emerald-200 text-gray-700' 
          : 'bg-gray-100 border-gray-200 text-gray-400 grayscale'
      }`}
      title={`${s.nickname} (${s.isOnline ? '접속 중' : '오프라인'})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
      <span className="shrink-0">{s.number}.</span>
      <span className="truncate flex-1">{s.nickname}</span>
      {s.isOnline && !s.isTabActive && <span className="text-[10px] shrink-0" title="다른 창 보는 중">💤</span>}
      {isFinished && <span className="text-emerald-500 text-[10px] shrink-0" title="차시 활동 완료">✓</span>}
    </div>
  )
}

export default GroupFormationMonitor
