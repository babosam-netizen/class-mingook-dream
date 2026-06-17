import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import BriefingCard from './BriefingCard'

/**
 * Phase 3 자동 브리핑 모달
 *
 * 학생이 입법/행정/사법 탭에 처음 진입할 때 해당 브리핑을 자동 모달로 띄운다.
 * 5초간 [확인] 버튼이 비활성 → 5초 뒤 활성. 닫으면 markBriefingRead로 기록되어 다시 안 뜸.
 *
 * props:
 *   kind: 'legislative'|'executive'|'judicial'
 */
const TONE = {
  legislative: 'slate',
  executive:   'emerald',
  judicial:    'rose',
}

function BriefingAutoModal({ kind }) {
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const students = useGameStore((s) => s.students)
  const briefings = useGameStore((s) => s.config?.briefings)
  const markBriefingRead = useGameStore((s) => s.markBriefingRead)

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (role !== 'student' || !myStudentId || !kind) return
    const me = students[myStudentId]
    const already = me?.briefingsRead?.[kind]
    if (!already) setOpen(true)
  }, [role, myStudentId, students, kind])

  if (!open || !briefings || !briefings[kind]) return null

  const onClose = () => {
    markBriefingRead(kind)
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4 my-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-gray-700 leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          title="닫기"
        >
          ✕
        </button>
        <BriefingCard data={briefings[kind]} tone={TONE[kind] || 'slate'} />
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            천천히 읽어 보세요. ✕ 또는 바깥을 누르면 닫혀요.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            확인 (다시 안 뜸)
          </button>
        </div>
      </div>
    </div>
  )
}

export default BriefingAutoModal
