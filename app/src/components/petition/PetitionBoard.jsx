import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, removeAt } from '../../lib/rtdb-helpers'
import usePetitionStore, {
  applyPetitionFilters,
  topPetitions,
  hashTagFrequency,
  prefixFrequency,
} from '../../store/petitionStore'
import PetitionForm from './PetitionForm'
import PetitionCard from './PetitionCard'
import PetitionFilter from './PetitionFilter'

const DEFAULT_PREFIXES = ['환경', '노동', '주거', '인권', '교육', '안전', '기타']

function PetitionBoard() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const config = useGameStore((s) => s.config)
  const petitionConfig = config?.petitionConfig || {}
  const prefixOptions = petitionConfig.prefixOptions?.length
    ? petitionConfig.prefixOptions
    : DEFAULT_PREFIXES

  const myStudentId = useGameStore((s) => s.myStudentId)

  const prefixFilter = usePetitionStore((s) => s.prefixFilter)
  const hashTagFilter = usePetitionStore((s) => s.hashTagFilter)
  const sortBy = usePetitionStore((s) => s.sortBy)
  const setHashTagFilter = usePetitionStore((s) => s.setHashTagFilter)

  const [petitionsMap, setPetitionsMap] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'petitions', (d) => setPetitionsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  // approved만 게시판에 노출 (학생/교사 공통)
  const approved = useMemo(() => {
    return Object.entries(petitionsMap)
      .map(([id, p]) => ({ id, ...p }))
      .filter((p) => p.status === 'approved')
  }, [petitionsMap])

  const top3 = useMemo(() => topPetitions(approved, 3), [approved])
  const top3Ids = new Set(top3.map((p) => p.id))

  const filtered = useMemo(
    () => applyPetitionFilters(approved, prefixFilter, hashTagFilter, sortBy),
    [approved, prefixFilter, hashTagFilter, sortBy],
  )

  // TOP 카드는 별도 영역에 노출하므로 메인 목록에서 제외
  const listForGrid = useMemo(
    () => filtered.filter((p) => !top3Ids.has(p.id)),
    [filtered, top3Ids],
  )

  const tagFreq = useMemo(() => hashTagFrequency(approved), [approved])
  const prefixFreq = useMemo(() => prefixFrequency(approved), [approved])

  // 내 청원 목록 (승인 대기 포함)
  const myPetitions = useMemo(() => {
    if (!myStudentId) return []
    return Object.entries(petitionsMap)
      .map(([id, p]) => ({ id, ...p }))
      .filter((p) => p.studentId === myStudentId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [petitionsMap, myStudentId])

  const handleDelete = async (pid) => {
    if (!confirm('정말 이 청원을 삭제할까요?')) return
    await removeAt(roomCode, `petitions/${pid}`)
  }

  const [editingPetition, setEditingPetition] = useState(null)

  return (
    <div className="space-y-5">
      {/* 헤더 + 작성 폼(학생만) */}
      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {role === 'student' && (
          <div className="lg:col-span-1 space-y-4">
            <PetitionForm />
            {myPetitions.length > 0 && (
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                <h3 className="font-bold text-amber-800 text-sm">📝 내가 작성한 청원</h3>
                <div className="space-y-2">
                  {myPetitions.map(p => (
                    <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-gray-800 truncate" title={p.title}>
                            {p.title}
                          </h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(p.createdAt).toLocaleString('ko-KR', { 
                              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                            {p.status === 'pending' && <span className="ml-2 text-rose-500 font-bold">· 승인 대기 중</span>}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setEditingPetition(p)}
                            className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="px-2 py-1 text-[10px] bg-rose-50 text-rose-600 rounded hover:bg-rose-100 font-bold transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 수정 모달 */}
            {editingPetition && (
              <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
                  <PetitionForm 
                    editData={editingPetition} 
                    onCancel={() => setEditingPetition(null)} 
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className={role === 'student' ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          {/* TOP 3 */}
          {top3.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-bold text-amber-800">🏆 인기 청원 TOP {top3.length}</h3>
                <span className="text-[10px] text-gray-400">공감수 기준</span>
              </div>
              <div className={`grid gap-3 ${top3.length === 1 ? '' : top3.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                {top3.map((p, i) => (
                  <PetitionCard
                    key={p.id}
                    petition={p}
                    rank={i + 1}
                    onTagClick={(t) => setHashTagFilter(hashTagFilter === t ? null : t)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 필터 */}
          <section className="bg-white rounded-2xl border p-3">
            <PetitionFilter 
              prefixOptions={prefixOptions} 
              tagFreq={tagFreq} 
              prefixFreq={prefixFreq}
              totalCount={approved.length}
            />
          </section>

          {/* 전체 목록 */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-gray-700">📋 전체 청원 ({filtered.length}건)</h3>
            </div>
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-8 text-center text-gray-400 text-sm">
                {approved.length === 0
                  ? '아직 게시된 청원이 없어요. 첫 청원을 작성해 보세요!'
                  : '조건에 맞는 청원이 없어요. 필터를 해제해 보세요.'}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {listForGrid.length === 0 && filtered.every((p) => top3Ids.has(p.id)) ? (
                  <p className="text-xs text-gray-400 col-span-full text-center py-4">
                    이 조건에 해당하는 청원은 모두 위 TOP 영역에 표시되었습니다.
                  </p>
                ) : (
                  listForGrid.map((p) => (
                    <PetitionCard
                      key={p.id}
                      petition={p}
                      onTagClick={(t) => setHashTagFilter(hashTagFilter === t ? null : t)}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default PetitionBoard
