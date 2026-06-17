import useGameStore from '../../store/gameStore'
import WritingEditor from '../shared/WritingEditor'

/**
 * 주장하는 글 쓰기 에디터 — 공용 글쓰기 엔진에 Phase 1 문제 제기형 껍데기를 씌운다.
 *
 * props:
 *   groupId (필수)
 */
function EssayEditor({ groupId, editingEssayId, essayData, onSuccess, onCancel }) {
  const config = useGameStore((s) => s.config)

  return (
    <WritingEditor
      groupId={groupId}
      storagePath="essays"
      editingId={editingEssayId}
      writingData={essayData}
      onSuccess={onSuccess}
      onCancel={onCancel}
      copy={{
        accent: 'emerald',
        formTitle: '✍️ 주장하는 글 쓰기',
        badge: '개인별 작성',
        description: '해결책을 제안하기 전에, 왜 이 문제가 중요하게 다뤄져야 하는지 설득력 있게 알려 주세요.',
        editNotice: '기존에 작성한 내용은 그대로 불러왔어요. 필요한 부분만 새 양식에 맞게 다듬어 주세요.',
        titleLabel: '제목',
        titlePlaceholder: `글의 제목을 정해 주세요 (예: ${config?.countryName || '우리 반'} 쓰레기 문제는 심각합니다)`,
        claimLabel: '[문제 제기] 무엇이 문제인가요?',
        claimPlaceholder: '이것이 왜 문제인지 한 문장으로 분명하게 주장해 주세요.',
        evidenceLabel: '[문제 근거] 왜 문제라고 생각하나요?',
        evidencePlaceholder: '관찰한 사실, 경험, 기사, 통계처럼 문제라고 볼 수 있는 근거를 적어주세요.',
        impactLabel: '[실제 상황/피해] 지금 어떤 일들이 벌어지고 있나요? (선택)',
        impactPlaceholder: '지금 생기는 피해, 불편, 갈등, 위험, 반복되는 장면을 구체적으로 적어주세요.',
        requiredMessage: '제목, 문제 제기, 문제 근거를 모두 작성해 주세요.',
        successMessage: '글이 성공적으로 등록되었습니다!',
        submitLabel: '글 작성 완료 및 등록',
        editSubmitLabel: '수정 완료',
      }}
    />
  )
}

export default EssayEditor
