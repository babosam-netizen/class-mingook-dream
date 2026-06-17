import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import ArticleEditor from './ArticleEditor'
import ArticleApprovalQueue from './ArticleApprovalQueue'

const STATUS_BADGE = {
  approved: { label: '게시 중',  cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: '승인 대기', cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: '반려됨',   cls: 'bg-red-100 text-red-600' },
}

/**
 * 각 페이즈 페이지 하단에 삽입하는 기사 작성 영역.
 *
 * - 학생: 에디터(좌) + 우리 모둠이 제출한 기사 목록(우)
 * - 교사: 기사 승인 큐 인라인
 */
function ArticleSection() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const [articlesMap, setArticlesMap] = useState({})

  // [Antigravity] 기사 수정 모드 상태 추가
  const [editingArticleId, setEditingArticleId] = useState(null)

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'articles', (d) => setArticlesMap(d || {}))
    return () => { u1?.() }
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (!myStudentId || !groups) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [myStudentId, groups])

  const myGroupArticles = useMemo(() => {
    if (!myGroupId) return []
    return Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => {
        if (a.authorGroupId !== myGroupId) return false
        if (a.status === 'deleted') return false
        const articlePhase = a.phase ?? 1
        return articlePhase === currentPhase
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [articlesMap, myGroupId, currentPhase])

  if (role === 'teacher') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <ArticleApprovalQueue />
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">

      <ArticleEditor 
        editingArticleId={editingArticleId}
        articleData={myGroupArticles.find(a => a.id === editingArticleId)}
        onSuccess={() => setEditingArticleId(null)}
        onCancel={() => setEditingArticleId(null)}
      />

      <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-sm space-y-2 h-fit">
        <h3 className="font-bold text-blue-800 text-sm">
          📋 우리 모둠 기사 ({myGroupArticles.length}개)
        </h3>
        {myGroupArticles.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">
            아직 작성된 기사가 없어요.
          </p>
        ) : (
          myGroupArticles.map((a) => {
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
            return (
              <div key={a.id} className="border rounded-lg p-2.5 space-y-1 bg-gray-50 relative group/article">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {a.authorNumber}번 {a.authorNickname}
                    </span>
                  </div>
                  {a.authorStudentId === myStudentId && (
                    <div className="flex gap-1">{/* 항상 표시 — 태블릿(터치)엔 hover가 없어 hover-reveal이면 안 보임 */}
                      <button 
                        onClick={() => setEditingArticleId(a.id)}
                        className="w-5 h-5 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-gray-50"
                        title="수정"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm('정말 삭제할까요?')) return
                          try {
                            const { removeAt } = await import('../../lib/rtdb-helpers')
                            await removeAt(roomCode, `articles/${a.id}`)
                          } catch (err) {
                            alert('삭제 실패: ' + err.message)
                          }
                        }}
                        className="w-5 h-5 bg-white border border-red-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-red-50 text-red-500"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold leading-tight">{a.headline}</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{a.body}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}


export default ArticleSection
