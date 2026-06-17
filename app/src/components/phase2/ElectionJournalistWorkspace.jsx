import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, removeAt } from '../../lib/rtdb-helpers'
import ArticleEditor from '../news/ArticleEditor'
import CandidateCard from './CandidateCard'
import ResearchReferencePanel from '../research/ResearchReferencePanel'
import CandidateSupportStatements from './CandidateSupportStatements'
import { JournalistNewspaperEditor } from './JournalistNewspaper'

const STATUS_BADGE = {
  approved: { label: '게시 중',   cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: '승인 대기', cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: '반려됨',   cls: 'bg-red-100 text-red-600' },
}

const PERSPECTIVE_LABEL = {
  critical:   { label: '비판', cls: 'text-rose-600' },
  supportive: { label: '옹호', cls: 'text-emerald-600' },
  neutral:    { label: '중립', cls: 'text-gray-500' },
}

/**
 * 선거 기자단 활동 워크스페이스
 * - 기사 작성 + 내 기사 관리
 * - 후보 공약 비교 (읽기 전용)
 * - 다른 모둠 승인 기사 보기
 */
function ElectionJournalistWorkspace({ groupId, candidatesList = [], supportByGroup = {}, groups = {}, myVote = null, showJournalistSupport = false }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const currentPhase = useGameStore((s) => s.currentPhase)

  const [articlesMap, setArticlesMap] = useState({})
  const [editingArticleId, setEditingArticleId] = useState(null)
  const [activeTab, setActiveTab] = useState('write')

  useEffect(() => {
    if (!roomCode) return
    return subscribe(roomCode, 'articles', (d) => setArticlesMap(d || {}))
  }, [roomCode])

  // 내 모둠 기사 (현재 페이즈, deleted 제외)
  const myArticles = useMemo(() =>
    Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.authorGroupId === groupId && a.status !== 'deleted' && (a.phase ?? 1) === currentPhase)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  [articlesMap, groupId, currentPhase])

  // 다른 모둠 승인 기사 (현재 페이즈)
  const otherArticles = useMemo(() =>
    Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.authorGroupId !== groupId && a.status === 'approved' && (a.phase ?? 1) === currentPhase)
      .sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0)),
  [articlesMap, groupId, currentPhase])

  const tabs = [
    { id: 'write',      label: '✏️ 기사 작성', badge: myArticles.length || null },
    { id: 'newspaper',  label: '🗞️ 신문 마무리', badge: null },
    { id: 'candidates', label: '🔍 후보 비교', badge: candidatesList.length || null },
    { id: 'others',     label: '📋 다른 모둠 기사', badge: otherArticles.length || null },
    ...(showJournalistSupport ? [{ id: 'support', label: '🤝 지지 선언문', badge: null }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* 탭 메뉴 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
              activeTab === t.id
                ? 'bg-white text-blue-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge != null && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 기사 작성 ── */}
      {activeTab === 'write' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* 에디터 */}
          <div className="space-y-3">
            <ResearchReferencePanel
              contextKey="phase2_election"
              groupId={groupId}
              title="우리 기자단 공약 자료실 — 기사 작성 참고자료"
              emptyMessage="이전 공약 자료실에서 모은 자료가 아직 없습니다. 자료가 있으면 기사 작성 전에 여기에서 확인할 수 있습니다."
              accent="rose"
              compact
            />
            <ArticleEditor
              editingArticleId={editingArticleId}
              articleData={myArticles.find((a) => a.id === editingArticleId)}
              onSuccess={() => setEditingArticleId(null)}
              onCancel={() => setEditingArticleId(null)}
            />
          </div>

          {/* 내 기사 목록 */}
          <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-sm space-y-2 h-fit">
            <h3 className="font-bold text-blue-800 text-sm">
              📋 우리 모둠 기사 ({myArticles.length}개)
            </h3>
            {myArticles.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">
                아직 작성된 기사가 없어요.
              </p>
            ) : (
              myArticles.map((a) => {
                const badge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
                const persp = PERSPECTIVE_LABEL[a.perspective] || PERSPECTIVE_LABEL.neutral
                return (
                  <div key={a.id} className="border rounded-lg p-2.5 space-y-1 bg-gray-50 relative group/art">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className={`text-[10px] font-bold ${persp.cls}`}>{persp.label}</span>
                      </div>
                      {a.authorStudentId === myStudentId && (
                        <div className="flex gap-1 opacity-0 group-hover/art:opacity-100 transition">
                          <button
                            onClick={() => setEditingArticleId(a.id)}
                            className="text-[10px] px-2 py-0.5 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50"
                          >
                            ✏️ 수정
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('내 기사를 삭제할까요?')) return
                              try { await removeAt(roomCode, `articles/${a.id}`) }
                              catch (err) { alert('삭제 실패: ' + err.message) }
                            }}
                            className="text-[10px] px-2 py-0.5 bg-white border border-red-200 rounded shadow-sm text-red-500 hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">{a.headline}</p>
                    <p className="text-[11px] text-gray-500 leading-tight line-clamp-2">{a.body}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── 탭 2: 신문 마무리 ── */}
      {activeTab === 'newspaper' && (
        <JournalistNewspaperEditor groupId={groupId} articles={myArticles} />
      )}

      {/* ── 탭 3: 후보 비교 ── */}
      {activeTab === 'candidates' && (
        <div className="space-y-3">
          {candidatesList.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8 border border-dashed rounded-xl">
              아직 등록된 후보가 없습니다.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {candidatesList.map((c) => (
                <div key={c.groupId} className="space-y-2">
                  <ResearchReferencePanel
                    contextKey="phase2_election"
                    groupId={c.groupId}
                    title={`${groups[c.groupId]?.name || '후보 캠프'} 공약 자료실`}
                    emptyMessage="이 후보 캠프가 이전 공약 자료실에서 모은 자료가 아직 없습니다."
                    accent="rose"
                    defaultOpen={false}
                    compact
                  />
                  <CandidateCard
                    candidate={c}
                    group={groups[c.groupId]}
                    previewMode={true}
                    myVote={myVote}
                    supportStatements={supportByGroup[c.groupId] || []}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭 4: 다른 모둠 기사 ── */}
      {activeTab === 'others' && (
        <div className="space-y-3">
          {otherArticles.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8 border border-dashed rounded-xl">
              아직 게시된 기사가 없습니다. 다른 모둠의 기사가 승인되면 여기에 표시됩니다.
            </div>
          ) : (
            otherArticles.map((a) => {
              const persp = PERSPECTIVE_LABEL[a.perspective] || PERSPECTIVE_LABEL.neutral
              const groupName = groups[a.authorGroupId]?.name || '알 수 없는 모둠'
              return (
                <article key={a.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className={`font-bold ${persp.cls}`}>[{persp.label}]</span>
                    <span className="font-semibold text-gray-600">{groupName}</span>
                    <span>·</span>
                    <span>{a.authorNumber}번 {a.authorNickname}</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 leading-tight">{a.headline}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                </article>
              )
            })
          )}
        </div>
      )}

      {/* ── 탭 5: 지지 선언문 (교사 허용 시) ── */}
      {activeTab === 'support' && showJournalistSupport && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 font-semibold">
            📣 선생님이 기자단에도 지지선언문 작성을 허용했습니다. 후보를 선택하고 지지 이유를 작성해 보세요.
          </div>
          <CandidateSupportStatements
            groupId={groupId}
            allCandidates={candidatesList}
            allSupportByGroup={supportByGroup}
            editable={true}
          />
        </div>
      )}
    </div>
  )
}

export default ElectionJournalistWorkspace
