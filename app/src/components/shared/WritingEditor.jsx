import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, updateAt } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'

const DEFAULT_COPY = {
  accent: 'emerald',
  formTitle: '주장하는 글 쓰기',
  badge: '개인별 작성',
  description: '해결책을 제안하기 전에, 왜 이 문제가 중요하게 다뤄져야 하는지 설득력 있게 알려 주세요.',
  editNotice: '기존에 작성한 내용은 그대로 불러왔어요. 필요한 부분만 새 양식에 맞게 다듬어 주세요.',
  titleLabel: '제목',
  titlePlaceholder: '글의 제목을 정해 주세요',
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
}

const ACCENT_CLASS = {
  emerald: {
    border: 'border-emerald-200',
    title: 'text-emerald-800',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    ring: 'focus:ring-emerald-400',
    softBorder: 'border-emerald-100',
    label: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    successText: 'text-emerald-700',
    successBg: 'bg-emerald-50',
  },
  rose: {
    border: 'border-rose-200',
    title: 'text-rose-800',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    ring: 'focus:ring-rose-400',
    softBorder: 'border-rose-100',
    label: 'text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700',
    successText: 'text-rose-700',
    successBg: 'bg-rose-50',
  },
}

/**
 * Shared writing engine for student-authored structured texts.
 * Phase-specific wrappers provide labels, storage path, and extra metadata.
 */
function WritingEditor({
  groupId,
  storagePath = 'essays',
  editingId,
  writingData,
  onSuccess,
  onCancel,
  copy = {},
  extraData = {},
}) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const merged = { ...DEFAULT_COPY, ...copy }
  const accent = ACCENT_CLASS[merged.accent] || ACCENT_CLASS.emerald

  const [title, setTitle] = useState('')
  const [claim, setClaim] = useState('')
  const [evidence, setEvidence] = useState('')
  const [impact, setImpact] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingId && writingData) {
      setTitle(writingData.title || '')
      setClaim(writingData.claim || '')
      setEvidence(writingData.evidence || '')
      setImpact(writingData.impact || '')
    }
  }, [editingId, writingData])

  const draftKey = `writing_${storagePath}`
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    if (DraftSaver.load(draftKey)) setHasDraft(true)
  }, [draftKey])

  const onSaveDraft = () => {
    DraftSaver.save(draftKey, { title, claim, evidence, impact })
    setHasDraft(true)
    alert('임시저장되었습니다.')
  }

  const onLoadDraft = () => {
    const d = DraftSaver.load(draftKey)
    if (d && d.data) {
      setTitle(d.data.title || '')
      setClaim(d.data.claim || '')
      setEvidence(d.data.evidence || '')
      setImpact(d.data.impact || '')
      alert('임시저장된 내용을 불러왔습니다.')
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim() || !claim.trim() || !evidence.trim()) {
      setError(merged.requiredMessage)
      return
    }

    setBusy(true)
    try {
      const data = {
        ...extraData,
        groupId,
        title: title.trim(),
        claim: claim.trim(),
        evidence: evidence.trim(),
        impact: impact.trim(),
        authorStudentId: myStudentId,
        authorNumber: myNumber,
        authorNickname: myNickname,
        updatedAt: Date.now(),
      }

      if (editingId) {
        await updateAt(roomCode, `${storagePath}/${editingId}`, data)
      } else {
        data.createdAt = Date.now()
        await pushUnder(roomCode, storagePath, data)
      }

      setTitle('')
      setClaim('')
      setEvidence('')
      setImpact('')
      DraftSaver.clear(draftKey)
      setHasDraft(false)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      onSuccess?.()
    } catch (err) {
      setError('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`bg-white p-5 rounded-2xl shadow-sm border-2 ${accent.border} space-y-4`}
    >
      <header>
        <div className="flex items-center justify-between w-full">
          <h3 className={`font-bold ${accent.title} flex items-center gap-1 text-lg`}>
            {editingId && <span className="text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mr-2">글 수정 중...</span>}
            {merged.formTitle}
            {merged.badge && (
              <span className={`text-[9px] ${accent.badgeBg} ${accent.badgeText} px-1.5 py-0.5 rounded-sm ml-1`}>
                {merged.badge}
              </span>
            )}
          </h3>
          <div className="flex gap-1">
            {hasDraft && !editingId && (
              <button
                type="button"
                onClick={onLoadDraft}
                className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold hover:bg-amber-200"
              >
                📂 불러오기
              </button>
            )}
            {!editingId && (
              <button
                type="button"
                onClick={onSaveDraft}
                className={`text-[10px] px-2 py-1 ${accent.badgeBg} ${accent.badgeText} rounded border ${accent.softBorder} font-bold hover:opacity-80`}
              >
                💾 임시저장
              </button>
            )}
          </div>
        </div>
        {merged.description && <p className="text-xs text-gray-500 mt-1">{merged.description}</p>}
        {editingId && merged.editNotice && (
          <p className="text-[11px] text-indigo-600 mt-1">{merged.editNotice}</p>
        )}
      </header>

      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">{merged.titleLabel}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={merged.titlePlaceholder}
          maxLength={40}
          className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 ${accent.ring} font-semibold`}
        />
      </div>

      <div>
        <label className={`block text-xs font-bold ${accent.label} mb-1`}>{merged.claimLabel}</label>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder={merged.claimPlaceholder}
          rows={2}
          maxLength={merged.claimMaxLength || 120}
          className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 ${accent.ring} resize-none`}
        />
      </div>

      <div className={`space-y-4 pt-4 mt-2 border-t ${accent.softBorder}`}>
        <div>
          <label className={`block text-xs font-bold ${accent.label} mb-1`}>{merged.evidenceLabel}</label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={merged.evidencePlaceholder}
            rows={4}
            maxLength={merged.evidenceMaxLength || 400}
            className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 ${accent.ring} resize-none`}
          />
        </div>

        <div>
          <label className={`block text-xs font-bold ${accent.label} mb-1`}>{merged.impactLabel}</label>
          <textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder={merged.impactPlaceholder}
            rows={2}
            maxLength={merged.impactMaxLength || 240}
            className={`w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 ${accent.ring} resize-none`}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        {done && <p className={`text-sm ${accent.successText} ${accent.successBg} px-3 py-2 rounded`}>✓ {merged.successMessage}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className={`flex-1 py-3 rounded-xl ${accent.button} text-white font-bold disabled:opacity-50 transition shadow-sm text-base`}
          >
            {busy ? (editingId ? '수정 중...' : '등록 중...') : (editingId ? merged.editSubmitLabel : merged.submitLabel)}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition shadow-sm text-base"
            >
              취소
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

export default WritingEditor
