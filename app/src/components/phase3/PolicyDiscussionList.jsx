import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, removeAt } from '../../lib/rtdb-helpers'
import CommentList from '../phase1/CommentList'

/**
 * 행정부 ② 온라인 토의 — submitted 정책안 카드 목록.
 *
 *  - policies/{groupId} 중 status='submitted' 인 것만 표시
 *  - 자기 모둠 카드는 댓글 비활성 (안내만)
 *  - 다른 모둠 카드는 다축 별점·댓글 가능 (CommentList targetType='policy', targetId=groupId)
 */

const CATEGORIES = [
  { key: 'personnel', label: '인건비', icon: '👥' },
  { key: 'project',   label: '사업비', icon: '🏗️' },
  { key: 'education', label: '교육비', icon: '📚' },
  { key: 'pr',        label: '홍보비', icon: '📣' },
]

function PolicyDiscussionList() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const role = useGameStore((s) => s.role)
  const [policies, setPolicies] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'policies', (d) => setPolicies(d || {}))
    return () => u?.()
  }, [roomCode])

  // 내 모둠 찾기
  let myGroupId = null
  for (const [gid, g] of Object.entries(groups || {})) {
    if (g?.members?.[myStudentId]) {
      myGroupId = gid
      break
    }
  }

  const submitted = Object.entries(policies)
    .filter(([, p]) => p?.status === 'submitted' && p?.submittedBy === 'minister')
    .map(([gid, p]) => ({ gid, ...p }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))

  const removePolicy = async (gid, name) => {
    if (!confirm(`'${name}' 모둠의 제출된 정책 보고서를 영구 삭제할까요?\n관련 댓글 데이터는 보존되지만 게시판에서 사라집니다.`)) return
    await removeAt(roomCode, `policies/${gid}`)
  }

  if (submitted.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        아직 제출된 정책안이 없어요. 각 모둠의 장관이 정책안을 작성하고 최종 제출하면 토의 대상으로 올라옵니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {submitted.map((p) => {
        const groupName = p.groupName || groups?.[p.gid]?.name || '모둠'
        const isMine = p.gid === myGroupId
        const total = CATEGORIES.reduce((s, c) => s + (Number(p.budget?.[c.key]) || 0), 0)

        return (
          <article
            key={p.gid}
            className={`rounded-xl border-2 p-4 space-y-3 ${
              isMine ? 'bg-amber-50 border-amber-300' : 'bg-white border-violet-300'
            }`}
          >
            <header className="flex items-baseline justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-violet-900">
                  🏢 {groupName}부 정책안
                </h3>
                {role === 'teacher' && (
                  <button
                    onClick={() => removePolicy(p.gid, groupName)}
                    className="text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-100 transition-colors"
                  >
                    삭제
                  </button>
                )}
              </div>
              <span className="text-[11px] text-gray-500">장관: {p.ministerName || '미지정'}</span>
            </header>

            <div className="grid lg:grid-cols-2 gap-3">
              {/* 예산편성 요약 */}
              <div className="bg-violet-50/40 border border-violet-100 rounded-lg p-3">
                <p className="text-xs font-bold text-violet-900 mb-2">💰 예산편성 ({total}억)</p>
                <div className="space-y-1">
                  {CATEGORIES.map((c) => {
                    const v = Number(p.budget?.[c.key]) || 0
                    const pct = total > 0 ? (v / total) * 100 : 0
                    return (
                      <div key={c.key} className="text-xs">
                        <div className="flex items-baseline justify-between">
                          <span>{c.icon} {c.label}</span>
                          <span className="tabular-nums font-mono">{v}억 ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-1 bg-white rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 시행령 */}
              <div className="bg-white border border-violet-100 rounded-lg p-3">
                <p className="text-xs font-bold text-violet-900 mb-2">📋 시행령</p>
                <p className="text-sm whitespace-pre-wrap text-gray-800">
                  {p.decree || <span className="text-gray-400">내용 없음</span>}
                </p>
              </div>
            </div>

            {/* 댓글 + 평가 */}
            <div className="pt-3 border-t border-violet-100">
              {isMine ? (
                <p className="text-xs text-amber-700 italic">
                  ※ 우리 모둠 정책안에는 댓글·평가를 남길 수 없어요. 다른 모둠의 의견을 받아 보세요.
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-violet-900 mb-2">💬 의견 남기기</p>
                  <CommentList targetType="policy" targetId={p.gid} />
                </>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default PolicyDiscussionList
