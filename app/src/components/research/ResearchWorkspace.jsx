import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, removeAt, subscribe } from '../../lib/rtdb-helpers'
import { fetchLinkMeta } from '../../lib/fetch-link-meta'

const DEFAULT_TARGET_GOAL = 2
const RESEARCH_CONTEXT_PRESETS = {
  phase2_election: {
    label: '공약 준비자료',
    roleLabel: '후보 캠프',
    purpose: '국민들의 요구와 공감 포인트를 찾아 공약을 설득력 있게 만듭니다.',
    targetSuggestions: ['국민들의 불편사항', '설문조사 결과', '국민들이 바라는 점', '인기 있는 제안'],
    memoPrompt: '이 자료를 통해 떠오른 공약 아이디어는 무엇인가요?',
  },
  phase3_legislative: {
    label: '입법 준비자료',
    roleLabel: '국회의원',
    purpose: '문제의 심각성과 근본 원인을 밝혀 법안의 필요성을 증명합니다.',
    targetSuggestions: ['피해 규모 통계', '전문가의 원인 분석', '다른 나라의 법률 사례', '사회적 문제 뉴스'],
    memoPrompt: '이 자료가 보여주는 문제의 원인이나 심각성은 무엇인가요?',
  },
  phase3_executive: {
    label: '정책 준비자료',
    roleLabel: '정부/장관',
    purpose: '정책을 실제로 실행할 수 있는지 예산, 인력, 장애물을 따져 봅니다.',
    targetSuggestions: ['필요한 예산·물가 정보', '예상되는 반대 의견', '과거 정책 실패 사례', '행정 인력·시간 계산'],
    memoPrompt: '정책을 실행할 때 준비할 점이나 장애물은 무엇인가요?',
  },
  phase3_judicial: {
    label: '재판 준비자료',
    roleLabel: '법원/재판 참여자',
    purpose: '판단에 필요한 사실, 증거, 기준을 객관적으로 확인합니다.',
    targetSuggestions: ['과거의 비슷한 판결', '법률 위반 증거 기사', '피해자의 진술', '피고인의 변론 자료'],
    memoPrompt: '이 자료가 보여주는 사실이나 판단 근거는 무엇인가요?',
  },
}

const REFERENCE_LINKS = [
  { label: '🔗 네이버뉴스', href: 'https://news.naver.com' },
  { label: '🔗 선생님 자료', href: 'https://padlet.com/appletree128909/padlet-1vb4794g2zw7acy7' },
  { label: '🔗 한국 부정적 이슈', href: 'https://www.triplelight.co/insight/2024-korean-social-problems-report-58di01' },
]

const SOURCE_TYPE_OPTIONS = [
  '사실·통계',
  '사례·인터뷰',
  '전문가 의견',
  '찬반 주장',
  '법·제도 사례',
]

const sanitizeUrl = (value) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

const getStudentLabel = (student) => {
  if (!student) return '모둠원'
  const number = student.number ? `${student.number}번 ` : ''
  return `${number}${student.nickname || student.name || '모둠원'}`
}

function ResearchWorkspace({
  contextKey,
  groupId,
  title = '근거 자료실',
  description = '찾고 싶은 자료를 입력하고, 기사 자료를 수집하세요.',
  defaultTargets = [],
  accent = 'emerald',
  compact = false,
  referenceLinks = [], // [{ label, url, hint }] — 기사자료수집 상단에 참고 링크로 표시
}) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const students = useGameStore((s) => s.students)
  const groups = useGameStore((s) => s.groups)

  const [workspace, setWorkspace] = useState({})
  const [targetInput, setTargetInput] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [url, setUrl] = useState('')
  const [itemTitle, setItemTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [idea, setIdea] = useState('')
  const [source, setSource] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [stanceType, setStanceType] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const preset = RESEARCH_CONTEXT_PRESETS[contextKey] || {
    label: '자료 수집',
    roleLabel: '우리 역할',
    purpose: '활동에 필요한 자료를 목적에 맞게 모읍니다.',
    targetSuggestions: defaultTargets,
    memoPrompt: '왜 필요한 자료인지 한 줄로 적어 주세요.',
  }
  const basePath = contextKey && groupId ? `researchPlans/${contextKey}/${groupId}` : null
  const myStudent = myStudentId ? students?.[myStudentId] : null
  const isStudent = role === 'student'
  const canEdit = isStudent && !!groupId && !!basePath
  const groupName = groupId ? groups?.[groupId]?.name : ''

  useEffect(() => {
    if (!roomCode || !basePath) {
      setWorkspace({})
      return undefined
    }
    return subscribe(roomCode, basePath, (data) => setWorkspace(data || {}))
  }, [basePath, roomCode])

  const targets = useMemo(() => {
    return Object.entries(workspace.targets || {})
      .map(([id, target]) => ({ id, goalCount: DEFAULT_TARGET_GOAL, ...target }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  }, [workspace.targets])

  const items = useMemo(() => {
    return Object.entries(workspace.items || {})
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [workspace.items])

  const itemsByTarget = useMemo(() => {
    return items.reduce((acc, item) => {
      const key = item.targetId || 'uncategorized'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {})
  }, [items])

  useEffect(() => {
    if ((!selectedTargetId || !targets.some((t) => t.id === selectedTargetId)) && targets[0]?.id) {
      setSelectedTargetId(targets[0].id)
    }
  }, [selectedTargetId, targets])

  const addTarget = async () => {
    if (!canEdit || busy) return
    const text = targetInput.trim()
    if (!text) {
      setMessage('찾을 자료 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await pushUnder(roomCode, `${basePath}/targets`, {
        title: text,
        goalCount: DEFAULT_TARGET_GOAL,
        createdBy: myStudentId,
        creatorLabel: getStudentLabel(myStudent),
      })
      setTargetInput('')
    } catch (error) {
      setMessage(`저장에 실패했어요: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const fillMeta = async () => {
    const cleanUrl = sanitizeUrl(url)
    if (!cleanUrl) {
      setMessage('http:// 또는 https:// 로 시작하는 기사 링크를 입력해 주세요.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const meta = await fetchLinkMeta(cleanUrl)
      setItemTitle((meta.title || '').slice(0, 120))
      setSummary((meta.description || '').slice(0, 260))
      setSource(meta.source || '')
      setMessage('기사 제목과 출처를 불러왔어요. 필요하면 고쳐서 저장하세요.')
    } catch (error) {
      setSource(() => {
        try {
          return new URL(cleanUrl).hostname.replace(/^www\./, '')
        } catch {
          return ''
        }
      })
      setMessage(error.message || '자동 추출에 실패했어요. 제목과 출처를 직접 입력해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const addItem = async () => {
    if (!canEdit || busy) return
    const cleanUrl = sanitizeUrl(url)
    if (!selectedTargetId) {
      setMessage('먼저 위에서 찾을 자료를 입력하고 선택해 주세요.')
      return
    }
    if (!cleanUrl) {
      setMessage('http:// 또는 https:// 로 시작하는 기사 링크를 입력해 주세요.')
      return
    }
    if (!itemTitle.trim()) {
      setMessage('기사 제목을 입력해 주세요.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await pushUnder(roomCode, `${basePath}/items`, {
        targetId: selectedTargetId,
        type: 'news',
        url: cleanUrl,
        title: itemTitle.trim(),
        summary: summary.trim(),
        source: source.trim(),
        idea: idea.trim(),
        sourceType,
        stanceType,
        groupId,
        submitterStudentId: myStudentId,
        submitterLabel: getStudentLabel(myStudent),
      })
      setUrl('')
      setItemTitle('')
      setSummary('')
      setIdea('')
      setSource('')
      setSourceType('')
      setStanceType('')
      setMessage('기사 자료를 저장했어요.')
    } catch (error) {
      setMessage(`기사 저장에 실패했어요: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteItem = async (item) => {
    const isMine = item.submitterStudentId && item.submitterStudentId === myStudentId
    if (!canEdit || !isMine) return
    if (!window.confirm('내가 저장한 이 기사 자료를 삭제할까요?')) return
    await removeAt(roomCode, `${basePath}/items/${item.id}`)
  }

  const deleteTarget = async (target) => {
    const isMine = target.createdBy && target.createdBy === myStudentId
    const linkedItems = itemsByTarget[target.id] || []
    if (!canEdit || !isMine) return
    if (linkedItems.length > 0) {
      setMessage('이 자료 목록에 연결된 기사가 있어요. 기사 자료를 먼저 삭제하면 목록도 삭제할 수 있습니다.')
      return
    }
    if (!window.confirm('내가 만든 이 자료 목록을 삭제할까요?')) return
    await removeAt(roomCode, `${basePath}/targets/${target.id}`)
    setMessage('자료 목록을 삭제했어요.')
  }

  const accentClass = {
    emerald: 'border-emerald-300 bg-emerald-50/40 text-emerald-900',
    rose: 'border-rose-300 bg-rose-50/40 text-rose-900',
    indigo: 'border-indigo-300 bg-indigo-50/40 text-indigo-900',
    amber: 'border-amber-300 bg-amber-50/40 text-amber-900',
    slate: 'border-slate-300 bg-slate-50/60 text-slate-900',
  }[accent] || 'border-emerald-300 bg-emerald-50/40 text-emerald-900'

  if (!groupId) {
    return (
      <section className={`border-2 rounded-2xl p-4 ${accentClass}`}>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm mt-2">모둠 배정이 완료되면 자료수집 창이 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section className={`border-2 rounded-2xl p-4 space-y-4 ${accentClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">📚 {title}</h2>
          <p className="text-xs opacity-80 mt-1">{description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groupName && <span className="text-[11px] px-2 py-1 bg-white/80 border rounded-full font-bold">현재 모둠: {groupName}</span>}
            <span className="text-[11px] px-2 py-1 bg-white/80 border rounded-full font-bold">현재 준비: {preset.label}</span>
            <span className="text-[11px] px-2 py-1 bg-white/80 border rounded-full font-bold">역할 관점: {preset.roleLabel}</span>
          </div>
          <p className="text-[11px] opacity-75 mt-2">{preset.purpose}</p>
        </div>
        <span className="self-start text-[10px] px-2 py-1 bg-white/80 border rounded-full font-bold">
          자료 {items.length}개 수집
        </span>
      </div>

      {canEdit && (
        <div className="space-y-4">
          {/* A. 어떤 자료를 찾으실건가요? */}
          <div className="bg-white/80 border rounded-xl p-3 space-y-2.5">
            <h3 className="text-sm font-bold">🔍 어떤 자료를 찾으실건가요?</h3>
            <div className="flex gap-2">
              <input
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="예: 환경 오염 관련 통계, 전문가 의견..."
                maxLength={80}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTarget() } }}
              />
              <button
                type="button"
                onClick={addTarget}
                disabled={busy}
                className="shrink-0 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50"
              >
                추가
              </button>
            </div>

            {targets.length > 0 && (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {targets.map((target) => {
                  const targetItems = itemsByTarget[target.id] || []
                  const isMine = target.createdBy && target.createdBy === myStudentId
                  return (
                    <div key={target.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="text-[10px] px-1.5 py-0.5 bg-white border rounded-full text-gray-500 shrink-0 whitespace-nowrap">
                        {target.creatorLabel || '모둠원'}
                      </span>
                      <span className="flex-1 text-gray-800 break-words">{target.title}</span>
                      <span className="shrink-0 text-[10px] text-gray-400">{targetItems.length}개</span>
                      {isMine && targetItems.length === 0 && (
                        <button
                          type="button"
                          onClick={() => deleteTarget(target)}
                          className="shrink-0 text-[11px] px-2 py-0.5 rounded bg-white border text-gray-500 hover:text-rose-700"
                        >
                          삭제
                        </button>
                      )}
                      {isMine && targetItems.length > 0 && (
                        <span className="shrink-0 text-[10px] text-gray-400">기사 삭제 후 가능</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {targets.length === 0 && (
              <p className="text-[11px] text-gray-400">아직 아무도 찾을 자료를 입력하지 않았어요. 먼저 입력해 보세요!</p>
            )}
          </div>

          {/* B. 기사자료수집 */}
          <div className="bg-white/80 border rounded-xl p-3 space-y-3">
            <h3 className="text-sm font-bold">📰 기사자료수집</h3>

            {referenceLinks.length > 0 && (
              <div className="space-y-1">
                {referenceLinks.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                  >
                    {l.label}
                    {l.hint && <span className="text-[10px] font-normal text-sky-500">— {l.hint}</span>}
                  </a>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] text-gray-500 mb-1">위에서 입력한 항목 중 어느 것과 관련된 기사인가요?</p>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                disabled={targets.length === 0}
              >
                {targets.length === 0 ? (
                  <option value="">먼저 위에서 찾을 자료를 입력해주세요</option>
                ) : (
                  targets.map((target) => (
                    <option key={target.id} value={target.id}>{target.title}</option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm"
                  placeholder="기사 링크 붙여넣기"
                />
                <button
                  type="button"
                  onClick={fillMeta}
                  disabled={busy || !url.trim()}
                  className="shrink-0 px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  불러오기
                </button>
              </div>
              <div className="flex flex-wrap gap-3 pt-0.5">
                {REFERENCE_LINKS.map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="기사 제목"
              maxLength={120}
            />
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="출처 예: 신문사, 기관명"
              maxLength={80}
            />

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-700 w-28">📌 이 자료의 성격</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSourceType((prev) => prev === option ? '' : option)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                        sourceType === option
                          ? 'bg-slate-900 text-white border-slate-900 font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-700 w-28">⚖️ 우리 주장과 관계</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {[
                    ['긍정적', 'bg-emerald-600 text-white border-emerald-600 font-bold', 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'],
                    ['부정적', 'bg-rose-600 text-white border-rose-600 font-bold', 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'],
                    ['중립적', 'bg-slate-700 text-white border-slate-700 font-bold', 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'],
                  ].map(([option, activeClass, inactiveClass]) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStanceType((prev) => prev === option ? '' : option)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                        stanceType === option ? activeClass : inactiveClass
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[70px]"
              placeholder={preset.memoPrompt}
              maxLength={260}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={busy || targets.length === 0}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
            >
              기사 자료 저장
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="text-xs bg-white/80 border rounded-lg px-3 py-2 text-gray-700">{message}</p>
      )}

      {/* 수집한 기사자료 모음 */}
      <div className="grid lg:grid-cols-2 gap-3">
        {targets.map((target) => {
          const targetItems = itemsByTarget[target.id] || []
          const goal = target.goalCount || DEFAULT_TARGET_GOAL
          const done = targetItems.length >= goal
          const isTargetMine = target.createdBy && target.createdBy === myStudentId
          return (
            <article key={target.id} className="bg-white border rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 break-words">{target.title}</h3>
                  <p className={`text-[11px] mt-0.5 ${done ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {targetItems.length}/{goal}개 수집 {done ? '완료' : '진행 중'}
                  </p>
                </div>
                {isTargetMine && targetItems.length === 0 && (
                  <button
                    type="button"
                    onClick={() => deleteTarget(target)}
                    className="shrink-0 text-[11px] px-2 py-0.5 rounded bg-white border text-gray-500 hover:text-rose-700"
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (targetItems.length / goal) * 100)}%` }}
                />
              </div>
              {targetItems.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">아직 연결된 기사 자료가 없어요.</p>
              ) : (
                <div className="space-y-2">
                  {targetItems.map((item) => {
                    const isMine = item.submitterStudentId && item.submitterStudentId === myStudentId
                    return (
                      <div key={item.id} className="border rounded-lg p-2 text-xs bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-sky-700 hover:underline break-words min-w-0"
                          >
                            {item.title}
                          </a>
                          {isMine && (
                            <button
                              type="button"
                              onClick={() => deleteItem(item)}
                              className="shrink-0 text-[11px] px-2 py-0.5 rounded bg-white border text-gray-500 hover:text-rose-700"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {item.source || '출처 미입력'} · {item.submitterLabel || '모둠원'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.sourceType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border text-slate-600 font-bold">
                              {item.sourceType}
                            </span>
                          )}
                          {item.stanceType && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${
                              item.stanceType === '긍정적' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              item.stanceType === '부정적' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {item.stanceType} 입장
                            </span>
                          )}
                        </div>
                        <ResearchItemNotes item={item} />
                      </div>
                    )
                  })}
                </div>
              )}
            </article>
          )
        })}
        {targets.length === 0 && (
          <div className="lg:col-span-2 bg-white/80 border border-dashed rounded-xl p-5 text-center text-sm text-gray-500">
            아직 수집된 자료가 없습니다. 위에서 찾을 자료를 입력하고 기사를 추가해 보세요.
          </div>
        )}
      </div>
    </section>
  )
}

function ResearchItemNotes({ item }) {
  const idea = item.idea || item.memo || item.note || ''
  const summary = item.summary || ''
  return (
    <div className="mt-1 space-y-1">
      {summary && idea && (
        <p className="text-[11px] text-gray-500 whitespace-pre-wrap">
          <span className="font-bold text-gray-600">기사 요약: </span>{summary}
        </p>
      )}
      {idea && (
        <p className="text-gray-700 whitespace-pre-wrap">
          <span className="font-bold text-emerald-700">떠오른 아이디어: </span>{idea}
        </p>
      )}
      {!idea && summary && (
        <p className="text-gray-700 whitespace-pre-wrap">
          <span className="font-bold text-emerald-700">떠오른 아이디어/메모: </span>{summary}
        </p>
      )}
    </div>
  )
}

export default ResearchWorkspace
