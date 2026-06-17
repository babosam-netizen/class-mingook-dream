import { useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { removeAt } from '../../lib/rtdb-helpers'
import WritingEditor from '../shared/WritingEditor'

export function CandidateSupportStatementList({ statements = [], compact = false, showEmpty = true }) {
  if (statements.length === 0) {
    if (!showEmpty) return null
    return (
      <div className="rounded-xl border border-dashed border-rose-200 bg-white/60 p-3 text-center text-xs text-gray-400">
        아직 작성된 지지 선언문이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {statements.map((statement) => (
        <article key={statement.id} className="rounded-xl border border-rose-100 bg-white/80 p-3 shadow-sm space-y-2">
          <header className="flex items-start justify-between gap-2 border-b border-rose-50 pb-1">
            <div className="min-w-0">
              <h5 className="text-xs font-black text-rose-900 truncate">{statement.title}</h5>
              <p className="text-[10px] text-gray-400">
                {statement.authorNumber ? `${statement.authorNumber}번 ` : ''}{statement.authorNickname || '작성자'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600">
              지지 선언
            </span>
          </header>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-rose-700 leading-none">[내가 지지하는 후보]</p>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} leading-tight text-gray-800 whitespace-pre-wrap`}>{statement.claim}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-rose-700 leading-none">[지지 이유]</p>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} leading-tight text-gray-700 whitespace-pre-wrap`}>{statement.evidence}</p>
          </div>
          {statement.impact && (
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-rose-700 leading-none">[유권자에게 전하는 말]</p>
              <p className={`${compact ? 'text-[11px]' : 'text-xs'} leading-tight text-gray-700 whitespace-pre-wrap`}>{statement.impact}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

/**
 * 지지 선언문 작성/수정 컴포넌트.
 * allCandidates: [{ groupId, leaderNickname, leaderNumber, groupName, ... }]
 * allSupportByGroup: { [candidateGroupId]: [statement, ...] }
 * 학생은 allCandidates 중 한 명을 골라 지지 선언문을 씁니다.
 */
function CandidateSupportStatements({ groupId, allCandidates = [], allSupportByGroup = {}, editable = false }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [editingId, setEditingId] = useState(null)
  const [selectedCandidateGid, setSelectedCandidateGid] = useState(null)

  // 내 선언문 전체에서 탐색
  const myStatement = useMemo(() => {
    for (const statements of Object.values(allSupportByGroup)) {
      const found = statements.find((s) => s.authorStudentId === myStudentId)
      if (found) return found
    }
    return null
  }, [allSupportByGroup, myStudentId])

  // 수정 중일 때 데이터
  const editingData = editingId
    ? Object.values(allSupportByGroup).flat().find((s) => s.id === editingId) || null
    : null

  // 현재 선택된(또는 내 선언문의) 후보 groupId
  const activeCandidateGid = editingId
    ? (myStatement?.candidateGroupId || selectedCandidateGid)
    : (myStatement?.candidateGroupId || selectedCandidateGid)

  const onDeleteMine = async () => {
    if (!myStatement?.id) return
    if (!confirm('내 지지 선언문을 삭제할까요?')) return
    try {
      await removeAt(roomCode, `candidateSupportStatements/${myStatement.id}`)
      setEditingId(null)
      setSelectedCandidateGid(null)
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  const onSuccess = () => {
    setEditingId(null)
    setSelectedCandidateGid(null)
  }

  if (!editable) return null

  // 후보가 없으면
  if (allCandidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-rose-200 bg-white/60 p-3 text-center text-xs text-gray-400">
        아직 등록된 후보가 없습니다. 후보 등록 후 지지 선언문을 작성할 수 있어요.
      </div>
    )
  }

  // 선택된 후보 객체
  const targetCandidate = allCandidates.find((c) => c.groupId === activeCandidateGid) || null
  const candidateName = targetCandidate
    ? `${targetCandidate.leaderNumber || ''}번 ${targetCandidate.leaderNickname || targetCandidate.groupName || '후보'}`.trim()
    : '후보'

  const showEditor = !myStatement || editingId

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-rose-800">📝 후보 지지 선언문</h3>
      </div>

      {/* 내 선언문이 있고 수정 중이 아닐 때 */}
      {myStatement && !editingId && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-rose-900">
              <span className="font-bold">{targetCandidate
                ? `${candidateName} 후보`
                : '후보'}</span>를 지지하는 선언문이 등록되어 있어요.
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setEditingId(myStatement.id)}
                className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
              >
                수정
              </button>
              <button
                type="button"
                onClick={onDeleteMine}
                className="px-2 py-1 rounded-lg bg-white border border-red-200 text-[11px] font-bold text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
          <CandidateSupportStatementList statements={[myStatement]} compact />
        </div>
      )}

      {/* 작성/수정 폼 */}
      {showEditor && (
        <div className="space-y-3">
          {/* 후보 선택 */}
          {!myStatement && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">지지할 후보를 선택하세요</p>
              <div className="flex flex-wrap gap-2">
                {allCandidates.map((c) => {
                  const isSelected = selectedCandidateGid === c.groupId
                  return (
                    <button
                      key={c.groupId}
                      type="button"
                      onClick={() => setSelectedCandidateGid(c.groupId)}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      {c.leaderNumber ? `${c.leaderNumber}번 ` : ''}{c.leaderNickname || c.groupName || '후보'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 선택된 후보가 있을 때만 에디터 표시 */}
          {activeCandidateGid && (
            <WritingEditor
              groupId={groupId}
              storagePath="candidateSupportStatements"
              editingId={editingId}
              writingData={editingData}
              onSuccess={onSuccess}
              onCancel={() => { setEditingId(null); setSelectedCandidateGid(null) }}
              extraData={{ candidateGroupId: activeCandidateGid, writingType: 'candidateSupport' }}
              copy={{
                accent: 'rose',
                formTitle: '📝 후보 지지 선언문 쓰기',
                badge: '개인별 작성',
                description: `유권자의 입장이 되어 왜 ${candidateName} 후보를 지지하는지 분명하게 선언해 보세요.`,
                editNotice: '기존 선언문을 불러왔어요. 후보 지지 이유가 더 잘 드러나게 다듬어 주세요.',
                titleLabel: '선언문 제목',
                titlePlaceholder: `${candidateName} 후보를 지지하는 이유`,
                claimLabel: '[내가 지지하는 후보] 내가 지지하는 후보는 누구인가요?',
                claimPlaceholder: `저는 ${candidateName} 후보를 지지합니다.`,
                evidenceLabel: '[지지 이유] 왜 이 후보를 지지하나요?',
                evidencePlaceholder: '공약, 태도, 문제 해결 의지, 토론 내용 등을 근거로 지지 이유를 적어 주세요.',
                impactLabel: '[유권자에게 전하는 말] 투표 전에 꼭 봐 주었으면 하는 점은? (선택)',
                impactPlaceholder: '다른 친구들이 이 후보를 선택할 때 생각해 보면 좋을 점을 적어 주세요.',
                requiredMessage: '제목, 지지 후보, 지지 이유를 모두 작성해 주세요.',
                successMessage: '지지 선언문이 등록되었습니다!',
                submitLabel: '지지 선언문 등록',
                editSubmitLabel: '지지 선언문 수정 완료',
                claimMaxLength: 140,
                evidenceMaxLength: 400,
                impactMaxLength: 240,
              }}
            />
          )}
        </div>
      )}
    </section>
  )
}

export default CandidateSupportStatements
