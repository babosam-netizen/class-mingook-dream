import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, removeAt, updateAt } from '../../lib/rtdb-helpers'

const PERSONA_OPTIONS = [
  { key: 'villain',    label: '😈 악덕기업주' },
  { key: 'evader',     label: '🎭 책임 회피형' },
  { key: 'righteous',  label: '⚖️ 정의로운 위반자' },
  { key: 'victim',     label: '🤕 구조적 피해자' },
]
const PERSONA_LABEL = Object.fromEntries(PERSONA_OPTIONS.map((p) => [p.key, p.label]))

/**
 * NPC 사건 카드 — 교사가 투입한 사건이 학생 화면에 카드로 노출.
 * 사법 차시에서 변론·판결의 출발점이 됨.
 *
 * 교사 권한:
 *  - ✏️ 수정: 사건명·페르소나·시나리오 텍스트 인라인 편집
 *  - 🗑️ 삭제: 영구 제거
 */
function NpcEventBoard() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const [events, setEvents] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ scenarioId: '', persona: 'villain', scenarioText: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'npcEvents', (d) => setEvents(d || {}))
    return () => u?.()
  }, [roomCode])

  const list = Object.entries(events)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.launchedAt || 0) - (a.launchedAt || 0))

  if (list.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-6 text-center text-gray-400 text-sm">
        아직 투입된 NPC 사건이 없어요.
        {role === 'teacher' && ' 교사 대시보드의 Phase 3 운영 패널에서 투입할 수 있습니다.'}
      </div>
    )
  }

  const startEdit = (e) => {
    setEditingId(e.id)
    setDraft({
      scenarioId: e.scenarioId || '',
      persona: e.persona || 'villain',
      scenarioText: e.scenarioText || '',
    })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft({ scenarioId: '', persona: 'villain', scenarioText: '' })
  }
  const saveEdit = async (id) => {
    if (!draft.scenarioId.trim() || !draft.scenarioText.trim()) {
      alert('사건명과 시나리오를 모두 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      await updateAt(roomCode, `npcEvents/${id}`, {
        scenarioId: draft.scenarioId.trim(),
        persona: draft.persona,
        scenarioText: draft.scenarioText.trim(),
        updatedAt: Date.now(),
      })
      cancelEdit()
    } finally {
      setBusy(false)
    }
  }

  const onRemove = (e) => {
    if (!confirm(`'${e.scenarioId || e.id}' 사건을 영구 삭제할까요?\n관련 변론·판결문 데이터는 별도 노드에 그대로 남아 있습니다.`)) return
    removeAt(roomCode, `npcEvents/${e.id}`)
  }

  return (
    <div className="space-y-3">
      {list.map((e) => {
        const isEditing = editingId === e.id
        return (
          <article
            key={e.id}
            className={`bg-white rounded-2xl shadow-sm border-2 p-4 ${
              isEditing ? 'border-amber-400' : 'border-slate-300'
            }`}
          >
            {isEditing ? (
              // ===== 수정 모드 =====
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-amber-700">✏️ NPC 사건 수정 중</p>
                <input
                  type="text"
                  value={draft.scenarioId}
                  onChange={(e2) => setDraft({ ...draft, scenarioId: e2.target.value })}
                  placeholder="사건명"
                  className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 font-bold"
                />
                <select
                  value={draft.persona}
                  onChange={(e2) => setDraft({ ...draft, persona: e2.target.value })}
                  className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
                >
                  {PERSONA_OPTIONS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                <textarea
                  value={draft.scenarioText}
                  onChange={(e2) => setDraft({ ...draft, scenarioText: e2.target.value })}
                  placeholder="시나리오 텍스트"
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelEdit}
                    disabled={busy}
                    className="px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(e.id)}
                    disabled={busy}
                    className="px-3 py-1 text-xs rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busy ? '저장 중...' : '수정 저장'}
                  </button>
                </div>
              </div>
            ) : (
              // ===== 읽기 모드 =====
              <>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">📂 {e.scenarioId || e.id}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                    {PERSONA_LABEL[e.persona] || e.persona || '페르소나 미정'}
                  </span>
                </div>
                {e.scenarioText && (
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {e.scenarioText}
                  </p>
                )}
                <div className="mt-2 text-xs text-gray-400 flex items-baseline gap-2">
                  <span>
                    투입:{' '}
                    {e.launchedAt
                      ? new Date(e.launchedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                  {e.updatedAt && e.updatedAt !== e.launchedAt && (
                    <span className="text-amber-600">
                      · 수정됨 ({new Date(e.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
                {role === 'teacher' && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => startEdit(e)}
                      className="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
                    >
                      ✏️ 수정
                    </button>
                    <button
                      onClick={() => onRemove(e)}
                      className="text-xs px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default NpcEventBoard
