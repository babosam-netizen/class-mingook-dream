import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import CommentList from '../phase1/CommentList'
import { PERSPECTIVE_OPTIONS, TARGET_OPTIONS, ARTICLE_NATURE_OPTIONS } from './ArticleEditor'
import { setAt, updateAt } from '../../lib/rtdb-helpers'

const fmtDate = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  return `${date} ${ampm} ${h12}:${m}`
}

const PERSPECTIVE_BADGE = {
  critical:   { label: '비판', emoji: '🔍', cls: 'bg-rose-100 text-rose-700' },
  supportive: { label: '옹호', emoji: '👍', cls: 'bg-emerald-100 text-emerald-700' },
  neutral:    { label: '중립', emoji: '⚖️', cls: 'bg-gray-100 text-gray-700' },
}

const REPORT_REASONS = [
  '허위 정보',
  '욕설/비하 표현',
  '개인정보 포함',
  '관련 없는 내용',
  '기타',
]

export function ArticleDetailModal({ article, onClose, onSelectJournalist }) {
  const groups      = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const role        = useGameStore((s) => s.role)
  const roomCode    = useGameStore((s) => s.roomCode)

  const [reporting, setReporting]       = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportBusy, setReportBusy]     = useState(false)

  const group       = article.authorGroupId ? groups[article.authorGroupId] : null
  const perspective = PERSPECTIVE_BADGE[article.perspective] || PERSPECTIVE_BADGE.neutral
  const targetLabel = TARGET_OPTIONS.find((t) => t.id === article.target)?.label || ''
  const natureLbl   = ARTICLE_NATURE_OPTIONS.find((n) => n.id === article.articleNature)?.label || ''

  const isStudent   = role === 'student'
  const isMyArticle = myStudentId && myStudentId === article.authorStudentId
  const myReport    = myStudentId ? (article.reports || {})[myStudentId] : null
  const reportCount = Object.keys(article.reports || {}).length

  const submitReport = async () => {
    if (!reportReason) { alert('신고 이유를 선택해 주세요.'); return }
    setReportBusy(true)
    try {
      await setAt(roomCode, `articles/${article.id}/reports/${myStudentId}`, {
        reason: reportReason,
        reportedAt: Date.now(),
      })
      setReporting(false)
      setReportReason('')
    } catch (err) {
      alert('신고 실패: ' + err.message)
    } finally {
      setReportBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 기사를 삭제할까요?')) return
    try {
      await updateAt(roomCode, `articles/${article.id}`, {
        status: 'deleted',
        deletedByTeacher: true,
        deletedAt: Date.now(),
      })
      onClose()
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  const handleSelectJournalist = () => {
    onSelectJournalist?.({
      studentId: article.authorStudentId,
      nickname:  article.authorNickname,
      number:    article.authorNumber,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* 헤더 */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${perspective.cls}`}>
                {perspective.emoji} {perspective.label}
              </span>
              {natureLbl && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  {natureLbl}
                </span>
              )}
              {targetLabel && article.target !== 'general' && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                  {targetLabel}
                </span>
              )}
            </div>
            <h2 className="font-black text-lg leading-tight text-gray-900">{article.headline}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 기사 본문 */}
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{article.body}</p>

          {/* 기자 서명 */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">기사 작성</p>
              <p className="text-sm font-black text-gray-800">
                ✍️ {article.authorNickname} 기자
              </p>
              <p className="text-xs text-gray-500">
                {article.authorNumber}번{group && ` · ${group.name}`}
              </p>
              {(article.createdAt || article.approvedAt) && (
                <p className="text-[10px] text-gray-400 mt-1">
                  🕐 {fmtDate(article.createdAt)}
                  {article.approvedAt && article.approvedAt !== article.createdAt && (
                    <span className="ml-2 text-emerald-600">· 게시 {fmtDate(article.approvedAt)}</span>
                  )}
                </p>
              )}
            </div>
            {onSelectJournalist && (
              <button
                type="button"
                onClick={handleSelectJournalist}
                className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-xl font-bold transition leading-snug text-center"
              >
                이 기자의<br />다른 기사 →
              </button>
            )}
          </div>

          {/* 교사 관리 */}
          {role === 'teacher' && (
            <div className="flex items-center gap-2 py-2 border-t border-gray-100">
              {reportCount > 0 && (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-1">
                  🚩 신고 {reportCount}건
                </span>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="ml-auto text-xs text-gray-400 hover:text-red-500 font-bold px-2.5 py-1 rounded-lg hover:bg-red-50"
              >
                🗑️ 기사 삭제
              </button>
            </div>
          )}

          {/* 학생 신고 */}
          {isStudent && !isMyArticle && (
            <div className="border-t border-gray-100 pt-3">
              {myReport ? (
                <p className="text-xs text-rose-400 font-bold">🚩 이미 신고한 기사입니다</p>
              ) : !reporting ? (
                <button
                  type="button"
                  onClick={() => setReporting(true)}
                  className="text-xs text-gray-400 hover:text-rose-500 font-bold"
                >
                  🚩 신고하기
                </button>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-rose-800">신고 이유를 선택해 주세요</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReportReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-full border-2 font-semibold transition ${
                          reportReason === r
                            ? 'border-rose-500 bg-rose-100 text-rose-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-rose-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitReport}
                      disabled={reportBusy || !reportReason}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-40 hover:bg-rose-700"
                    >
                      {reportBusy ? '신고 중...' : '신고하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReporting(false); setReportReason('') }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 댓글 + 평가 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500 mb-3">💬 댓글 및 평가</p>
            <CommentList targetType="article" targetId={article.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ArticleCard({ article, onSelectJournalist }) {
  const groups      = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const role        = useGameStore((s) => s.role)

  const [modalOpen, setModalOpen] = useState(false)

  const group       = article.authorGroupId ? groups[article.authorGroupId] : null
  const perspective = PERSPECTIVE_BADGE[article.perspective] || PERSPECTIVE_BADGE.neutral
  const natureLbl   = ARTICLE_NATURE_OPTIONS.find((n) => n.id === article.articleNature)?.label || ''
  const reportCount = Object.keys(article.reports || {}).length
  const isMyArticle = myStudentId && myStudentId === article.authorStudentId
  const myReport    = myStudentId ? (article.reports || {})[myStudentId] : null

  return (
    <>
      <article
        className="bg-white rounded-2xl shadow-sm border p-4 space-y-2 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all active:scale-[0.98]"
        onClick={() => setModalOpen(true)}
      >
        <header>
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${perspective.cls}`}>
              {perspective.emoji} {perspective.label}
            </span>
            {natureLbl && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                {natureLbl}
              </span>
            )}
            {isMyArticle && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold">내 기사</span>
            )}
            {myReport && (
              <span className="text-rose-400 font-bold">🚩</span>
            )}
            {role === 'teacher' && reportCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold">
                🚩 {reportCount}건
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mt-1.5 leading-tight line-clamp-2">{article.headline}</h3>
        </header>

        <p className="text-sm text-gray-600 line-clamp-3">{article.body}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-gray-400">
            ✍️ {article.authorNickname} 기자{group && ` · ${group.name}`}
          </p>
          <span className="text-xs text-indigo-500 font-semibold">탭하여 열기 →</span>
        </div>
        {(article.createdAt || article.approvedAt) && (
          <p className="text-[10px] text-gray-300">
            {fmtDate(article.approvedAt || article.createdAt)}
          </p>
        )}
      </article>

      {modalOpen && (
        <ArticleDetailModal
          article={article}
          onClose={() => setModalOpen(false)}
          onSelectJournalist={onSelectJournalist}
        />
      )}
    </>
  )
}

export default ArticleCard
