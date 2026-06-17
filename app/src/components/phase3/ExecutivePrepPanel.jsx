import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, pushUnder, removeAt } from '../../lib/rtdb-helpers'
import { DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

/**
 * 행정부 역할중심 ① "역할 및 준비" 단계의 준비 활동 패널 (부처 단위).
 * 역할 보드(내가 맡을래요) 아래에 붙어 다음 순서를 진행한다.
 *   2. 워드클라우드 브레인스토밍 — 우리 부처가 법안 관련 할 수 있는 일 단어 모으기(모둠 공유)
 *   3. 우리 부서에서 할 일 정하기 (대표 작성, 나머지 읽기 전용)
 *   4. 비슷한 시행령 찾아보기 (대표 작성) + 참고자료 1개(각자)
 * 새 RTDB 노드만 사용: branchDrafts/{unitId}/prep/{brainstorm|chosenTask|similarOrdinance|references}
 * 기존 데이터(sessionRoles/policies/sections 등)는 건드리지 않는다.
 */
const PREP_SESSION = 'executive-default'

export default function ExecutivePrepPanel({ unitId, groupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const config = useGameStore((s) => s.config)

  const base = `branchDrafts/${unitId}/prep`

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])
  const isMember = role === 'teacher' || myGroupId === groupId

  // 대표(=isRepresentative 역할 보유자) 여부
  const roles = useMemo(
    () => normalizeRoleList('executive', config?.roles?.executive || config?.branchConfig?.executive?.roles || DEFAULT_ROLES.executive || []),
    [config]
  )
  const myRoleKey = groups?.[groupId]?.sessionRoles?.[PREP_SESSION]?.[myStudentId] || null
  const repKey = useMemo(() => roles.find((r) => r.isRepresentative)?.key || null, [roles])
  const repStudentId = useMemo(() => {
    const map = groups?.[groupId]?.sessionRoles?.[PREP_SESSION] || {}
    return Object.entries(map).find(([, rk]) => rk === repKey)?.[0] || null
  }, [groups, groupId, repKey])
  const isRep = role === 'teacher' || (myRoleKey && myRoleKey === repKey)
  const repName = repStudentId ? `${students?.[repStudentId]?.number || ''}번 ${students?.[repStudentId]?.nickname || ''}`.trim() : null

  // ── 구독 ──
  const [brainstorm, setBrainstorm] = useState({})
  const [chosenTask, setChosenTask] = useState(null)
  const [similar, setSimilar] = useState(null)
  const [references, setReferences] = useState({})
  useEffect(() => {
    if (!roomCode || !unitId) return
    const u1 = subscribe(roomCode, `${base}/brainstorm`, (d) => setBrainstorm(d || {}))
    const u2 = subscribe(roomCode, `${base}/chosenTask`, (d) => setChosenTask(d || null))
    const u3 = subscribe(roomCode, `${base}/similarOrdinance`, (d) => setSimilar(d || null))
    const u4 = subscribe(roomCode, `${base}/references`, (d) => setReferences(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.() }
  }, [roomCode, unitId, base])

  // ── 워드클라우드 집계 ──
  const wordCloud = useMemo(() => {
    const counts = {}
    Object.entries(brainstorm || {}).forEach(([id, w]) => {
      const word = (w?.word || '').trim()
      if (!word) return
      const key = word
      if (!counts[key]) counts[key] = { word, count: 0, ids: [] }
      counts[key].count += 1
      counts[key].ids.push({ id, by: w.by })
    })
    return Object.values(counts).sort((a, b) => b.count - a.count)
  }, [brainstorm])

  const [wordInput, setWordInput] = useState('')
  const addingRef = useRef(false)
  const addWord = async () => {
    const w = wordInput.trim()
    if (!w || !roomCode || !isMember) return
    if (addingRef.current) return // 한글 IME Enter 이중 호출 등 중복 추가 방지
    addingRef.current = true
    setWordInput('')
    try {
      await pushUnder(roomCode, `${base}/brainstorm`, { word: w, by: myStudentId, at: Date.now() })
    } finally {
      addingRef.current = false
    }
  }
  const removeMyWord = async (id) => {
    if (!roomCode) return
    await removeAt(roomCode, `${base}/brainstorm/${id}`)
  }

  // ── 할 일 / 비슷한 시행령 (대표) ──
  const [taskText, setTaskText] = useState('')
  const [similarText, setSimilarText] = useState('')
  const [taskFocused, setTaskFocused] = useState(false)
  const [simFocused, setSimFocused] = useState(false)
  useEffect(() => { if (!taskFocused) setTaskText(chosenTask?.text || '') }, [chosenTask, taskFocused])
  useEffect(() => { if (!simFocused) setSimilarText(similar?.text || '') }, [similar, simFocused])
  const saveTask = async () => { if (roomCode && isRep) await setAt(roomCode, `${base}/chosenTask`, { text: taskText, updatedAt: Date.now() }) }
  const saveSimilar = async () => { if (roomCode && isRep) await setAt(roomCode, `${base}/similarOrdinance`, { text: similarText, updatedAt: Date.now() }) }

  // ── 참고자료 (각자 여러 개 추가 가능) ──
  const [refUrl, setRefUrl] = useState('')
  const [refNote, setRefNote] = useState('')
  const addingRefRef = useRef(false)
  const addRef = async () => {
    const url = refUrl.trim()
    const note = refNote.trim()
    if (!url || !note || !roomCode || !myStudentId || !isMember) return
    if (addingRefRef.current) return
    addingRefRef.current = true
    setRefUrl('')
    setRefNote('')
    try {
      await pushUnder(roomCode, `${base}/references`, { url, note, by: myStudentId, at: Date.now() })
    } finally {
      addingRefRef.current = false
    }
  }
  const removeRef = async (id) => {
    if (!roomCode) return
    await removeAt(roomCode, `${base}/references/${id}`)
  }
  const refList = useMemo(
    () => Object.entries(references || {})
      .map(([id, r]) => ({ id, ...r }))
      .filter((r) => (r.url || '').trim())
      .sort((a, b) => (a.at || 0) - (b.at || 0)),
    [references]
  )

  const sizeFor = (count) => {
    const px = Math.min(34, 13 + count * 5)
    return { fontSize: `${px}px`, lineHeight: 1.1 }
  }

  return (
    <div className="space-y-3">
      {/* 2. 워드클라우드 브레인스토밍 */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <h4 className="text-sm font-bold text-amber-900">2. 우리 부처가 할 수 있는 일 — 단어 모으기 💭</h4>
          <p className="text-[11px] text-amber-700 mt-0.5">통과된 법안과 관련해 우리 부처에서 할 수 있는 일을 단어로 적어 보세요. 친구들 단어가 함께 모입니다.</p>
        </div>
        <div className="p-3 space-y-3">
          <div className="min-h-[64px] flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-slate-50 border border-slate-100 rounded-lg p-3">
            {wordCloud.length === 0 ? (
              <span className="text-xs text-slate-300 italic">아직 단어가 없어요. 아래에 첫 단어를 적어 보세요.</span>
            ) : (
              wordCloud.map((w) => {
                const mine = w.ids.find((x) => x.by === myStudentId)
                return (
                  <span key={w.word} style={sizeFor(w.count)} className="inline-flex items-center gap-1 font-black text-indigo-700">
                    {w.word}
                    {w.count > 1 && <span className="text-[10px] font-bold text-indigo-400 align-super">×{w.count}</span>}
                    {mine && isMember && (
                      <button onClick={() => removeMyWord(mine.id)} className="text-[10px] text-rose-400 hover:text-rose-600 ml-0.5" title="내 단어 지우기">✕</button>
                    )}
                  </span>
                )
              })
            )}
          </div>
          {isMember && (
            <div className="flex gap-2">
              <input
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addWord() } }}
                placeholder="단어를 적고 Enter (예: 안전점검, 지원금, 캠페인)"
                maxLength={20}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button onClick={addWord} className="shrink-0 px-3 py-2 text-sm font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95">추가</button>
            </div>
          )}
        </div>
      </div>

      {/* 3. 우리 부서에서 할 일 정하기 (대표) */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-amber-900">3. 우리 부서에서 할 일 정하기 🎯</h4>
          <span className="text-[10px] text-amber-600 shrink-0">{repName ? `대표: ${repName}` : '대표 역할을 먼저 정해 주세요'}</span>
        </div>
        <div className="p-3">
          {isRep ? (
            <textarea
              value={taskText}
              onFocus={() => setTaskFocused(true)}
              onBlur={() => { setTaskFocused(false); saveTask() }}
              onChange={(e) => setTaskText(e.target.value)}
              rows={3}
              placeholder="워드클라우드를 보고, 우리 부처가 이 법을 위해 실제로 할 일을 1~2가지 정해 적어 주세요."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          ) : (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">
              {chosenTask?.text?.trim() || <span className="text-slate-300 italic">대표가 아직 작성하지 않았습니다. (읽기 전용)</span>}
            </div>
          )}
        </div>
      </div>

      {/* 4. 비슷한 시행령 찾아보기 (대표) + 참고자료(각자) */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <h4 className="text-sm font-bold text-amber-900">4. 비슷한 시행령 찾아보기 🔎</h4>
          <p className="text-[11px] text-amber-700 mt-0.5">대표가 우리가 할 일과 비슷한 시행령/정책을 정리하고, 모둠원은 각자 참고자료를 1개씩 찾아 붙입니다.</p>
        </div>
        <div className="p-3 space-y-3">
          {isRep ? (
            <textarea
              value={similarText}
              onFocus={() => setSimFocused(true)}
              onBlur={() => { setSimFocused(false); saveSimilar() }}
              onChange={(e) => setSimilarText(e.target.value)}
              rows={3}
              placeholder="비슷한 시행령·정책 사례와 우리가 참고할 점을 정리해 주세요."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          ) : (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">
              {similar?.text?.trim() || <span className="text-slate-300 italic">대표가 아직 작성하지 않았습니다. (읽기 전용)</span>}
            </div>
          )}

          {/* 각자 참고자료 (여러 개 추가 가능) */}
          <div className="space-y-2">
            <p className="text-[11px] font-black text-amber-700">📎 참고자료 (각자 여러 개 추가 가능)</p>
            {isMember && (
              <div className="space-y-1.5">
                <input
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  placeholder="참고 링크 (https://...)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <div className="flex gap-2">
                  <input
                    value={refNote}
                    onChange={(e) => setRefNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addRef() } }}
                    placeholder="간단 메모 (어떤 자료인지)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    onClick={addRef}
                    disabled={!refUrl.trim() || !refNote.trim()}
                    className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 active:scale-95"
                  >
                    추가
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">링크와 메모를 모두 입력하면 [추가]를 누르세요.</p>
              </div>
            )}
            {refList.length > 0 && (
              <ul className="space-y-1">
                {refList.map((r) => {
                  // 구버전 자료는 references/{studentId} 구조라 by 필드가 없음 → id(=studentId)를 소유자로 간주
                  const ownerId = r.by || r.id
                  const canDelete = ownerId === myStudentId || role === 'teacher'
                  return (
                  <li key={r.id} className="text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">🔗 {r.url}</a>
                      {r.note && <span className="text-slate-500"> · {r.note}</span>}
                      <span className="text-slate-300"> · {students?.[ownerId]?.nickname || ''}</span>
                    </div>
                    {canDelete && (
                      <button onClick={() => removeRef(r.id)} className="shrink-0 text-[10px] text-rose-400 hover:text-rose-600" title="삭제">✕</button>
                    )}
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
