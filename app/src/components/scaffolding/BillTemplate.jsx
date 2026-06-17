import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'
import PlaceholderField, { isFieldComplete } from './PlaceholderField'
import { DEFAULT_TEMPLATES } from '../../lib/scaffolding-data'
import { normalizeBillStatus } from '../../lib/bill-status'
import ResearchReferencePanel from '../research/ResearchReferencePanel'

function buildBillBodyText(bill) {
  if (bill?.body) return bill.body
  const data = bill?.templateData || {}
  const lines = []
  if (data.purpose) lines.push(`제1조 (목적) ${data.purpose}`)
  if (data.definition) lines.push(`제2조 (정의) ${data.definition}`)
  if (data.duty) lines.push(`제3조 (의무) ${data.duty}`)
  if (data.penalty) lines.push(`제4조 (벌칙) ${data.penalty}`)
  if (lines.length) return lines.join('\n\n')
  return ''
}

function extractSection(body, label, nextLabel) {
  if (!body) return ''
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nextPattern = nextLabel
    ? `(?=\\n\\s*제\\d+조\\s*\\(${nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\))`
    : '$'
  const match = body.match(new RegExp(`제\\d+조\\s*\\(${escapedLabel}\\)\\s*([\\s\\S]*?)${nextPattern}`, 'm'))
  return match?.[1]?.trim() || ''
}

function valuesFromBill(bill) {
  const values = {
    title: bill?.title || '',
    ...(bill?.templateData || {}),
  }
  if (!bill || bill.templateData) return values

  const body = buildBillBodyText(bill).trim()
  if (!body) return values

  const parsed = {
    purpose: extractSection(body, '목적', '정의'),
    definition: extractSection(body, '정의', '의무'),
    duty: extractSection(body, '의무', '벌칙'),
    penalty: extractSection(body, '벌칙'),
  }
  if (Object.values(parsed).some(Boolean)) return { ...values, ...parsed }

  return { ...values, purpose: body }
}

/**
 * 법안 템플릿 — 4 필드(목적·정의·의무·벌칙) + 제목.
 *
 * 동작:
 *  - 우리 모둠이 이미 발의한 토의 단계(discussion) 법안이 있으면 읽기 모드로 노출 + [수정] 버튼
 *  - 수정 모드 → 기존 4조항을 폼에 로드해서 편집 → 저장 시 같은 billId 를 update
 *  - 정식 상정(tabled) 이후에는 수정 잠금 — 표결 무결성 보장
 *  - 신규 발의: pushUnder 로 새 bill 생성
 *
 * props:
 *   groupId
 *   dataPath  RTDB 컬렉션 경로 (기본값: 'bills'). RoundTabShell 에서 주입 가능.
 */
function BillTemplate({ groupId, dataPath = 'bills' }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const configFields = useGameStore((s) => s.config?.templates?.bill?.fields)
  const fields = configFields?.length ? configFields : DEFAULT_TEMPLATES.bill.fields

  const [billsMap, setBillsMap] = useState({})
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [editing, setEditing] = useState(false)

  // 우리 모둠이 발의한 법안 구독
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, dataPath, (d) => setBillsMap(d || {}))
    return () => u?.()
  }, [roomCode, dataPath])

  // 우리 모둠의 활성 법안 (discussion 또는 구버전 voting / tabled / passed / rejected) 중 최신 1건
  const myBill = useMemo(() => {
    const list = Object.entries(billsMap)
      .map(([id, b]) => ({ id, ...b }))
      .filter((b) => b.proposerGroupId === groupId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return list[0] || null
  }, [billsMap, groupId])

  const status = normalizeBillStatus(myBill?.status)
  const hasTablingRequest = !!myBill?.tablingRequested
  const editable = !myBill || (status === 'discussion' && !hasTablingRequest) // 상정 요청 전까지만 수정 가능
  const locked = !!myBill && (status === 'tabled' || status === 'passed' || status === 'rejected')

  // 수정 모드 진입 시 기존 값 폼에 로드
  useEffect(() => {
    if (editing && myBill) {
      const loaded = {}
      fields.forEach((f) => {
        loaded[f.id] = myBill.templateData?.[f.id] ?? ''
      })
      setValues(loaded)
    }
  }, [editing, myBill?.id])

  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    if (DraftSaver.load('bill')) setHasDraft(true)
  }, [])

  const onSaveDraft = () => {
    DraftSaver.save('bill', values)
    setHasDraft(true)
    alert('임시저장되었습니다.')
  }

  const onLoadDraft = () => {
    const d = DraftSaver.load('bill')
    if (d && d.data) {
      setValues(d.data || {})
      alert('임시저장된 내용을 불러왔습니다.')
    }
  }

  // 발의된 법안이 없으면 자동으로 입력 모드 (편집 토글 무시)
  const showAsDisplay = !!myBill && !editing

  const allComplete = fields.every((f) => isFieldComplete(values[f.id]))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!allComplete) {
      setError('빈칸이 남아 있어요. 회색 안내문을 모두 우리 단어로 채워 주세요.')
      return
    }
    setBusy(true)
    try {
      const title = values.title?.trim()
      const body = [
        `제1조 (목적) ${values.purpose}`,
        `제2조 (정의) ${values.definition}`,
        `제3조 (의무) ${values.duty}`,
        `제4조 (벌칙) ${values.penalty}`,
      ].join('\n\n')

      if (myBill && editable) {
        // 기존 법안 수정
        await updateAt(roomCode, `${dataPath}/${myBill.id}`, {
          title,
          body,
          templateData: values,
          updatedAt: Date.now(),
        })
      } else {
        // 신규 발의
        await pushUnder(roomCode, dataPath, {
          title,
          body,
          templateData: values,
          proposerGroupId: groupId,
          proposerStudentId: myStudentId,
          status: 'discussion',
          vetoUsedBy: null,
        })
      }
      setEditing(false)
      setValues({})
      DraftSaver.clear('bill')
      setHasDraft(false)
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!myBill || !editable) return
    if (!confirm(`'${myBill.title}' 법안을 정말 삭제할까요?\n기존 댓글과 추천 데이터가 모두 사라지며, 다시 작성해야 합니다.`)) return
    setBusy(true)
    try {
      await removeAt(roomCode, `${dataPath}/${myBill.id}`)
      setValues({})
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const requestTabling = async () => {
    if (!myBill || status !== 'discussion' || hasTablingRequest) return
    setBusy(true)
    try {
      await updateAt(roomCode, `${dataPath}/${myBill.id}`, {
        tablingRequested: true,
        tablingRequestedAt: Date.now(),
        tablingRequestedBy: myStudentId,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelTablingRequest = async () => {
    if (!myBill || !hasTablingRequest) return
    setBusy(true)
    try {
      await updateAt(roomCode, `${dataPath}/${myBill.id}`, {
        tablingRequested: null,
        tablingRequestedAt: null,
        tablingRequestedBy: null,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // === 읽기 전용 표시 (이미 발의된 우리 모둠 법안) ===
  if (showAsDisplay) {
    return (
      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-3">
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-slate-800">📜 우리 모둠 법안</h3>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {myBill.teacherRecommended && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700">
                교사 추천
              </span>
            )}
            {hasTablingRequest && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700">
                상정 요청
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </header>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2">
          <p className="text-base font-bold text-slate-900">{myBill.title}</p>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {buildBillBodyText(myBill)}
          </div>
          {myBill.updatedAt && myBill.updatedAt !== myBill.createdAt && (
            <p className="text-[10px] text-gray-400 pt-1 border-t border-emerald-100">
              {new Date(myBill.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 에 수정됨
            </p>
          )}
        </div>

        {status === 'discussion' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-800">
            {hasTablingRequest
              ? '상정 요청을 보냈어요. 수정하거나 삭제하려면 먼저 요청을 취소하세요.'
              : '내용이 준비되면 상정 요청을 보내 선생님께 검토를 요청할 수 있어요.'}
          </div>
        )}

        {editable ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={requestTabling}
              disabled={busy}
              className="py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold text-white text-sm transition-all disabled:opacity-50"
            >
              상정 요청
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="py-2 rounded-lg bg-white border-2 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 font-semibold text-gray-700 text-sm transition-all"
            >
              ✏️ 법안 수정
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="py-2 rounded-lg bg-white border-2 border-gray-300 hover:border-rose-400 hover:bg-rose-50 font-semibold text-rose-700 text-sm transition-all disabled:opacity-50"
            >
              🗑️ 삭제
            </button>
          </div>
        ) : hasTablingRequest && status === 'discussion' ? (
          <button
            type="button"
            onClick={cancelTablingRequest}
            disabled={busy}
            className="w-full py-2 rounded-lg bg-white border-2 border-indigo-300 hover:bg-indigo-50 font-semibold text-indigo-700 text-sm transition-all disabled:opacity-50"
          >
            상정 요청 취소하고 수정/삭제하기
          </button>
        ) : (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            🔒 정식 상정 이후에는 수정/삭제할 수 없습니다.
            {status === 'tabled' && ' 표결이 진행 중입니다.'}
            {status === 'passed' && ' 가결되어 의결이 종료되었습니다.'}
            {status === 'rejected' && ' 부결되어 의결이 종료되었습니다.'}
          </p>
        )}
      </div>
    )
  }

  // === 수정 / 신규 발의 폼 ===
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3"
    >
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800">
            📜 법안 템플릿
            {myBill && <span className="ml-1 text-xs font-normal text-amber-700">· 수정 모드</span>}
          </h3>
          <div className="flex gap-1">
            {hasDraft && !myBill && (
              <button
                type="button"
                onClick={onLoadDraft}
                className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold hover:bg-amber-200"
              >
                📂 불러오기
              </button>
            )}
            {!myBill && (
              <button
                type="button"
                onClick={onSaveDraft}
                className="text-[10px] px-2 py-1 bg-slate-50 text-slate-700 rounded border border-slate-100 font-bold hover:bg-slate-100"
              >
                💾 임시저장
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          좋은 법안의 4요소(목적·정의·의무·벌칙)를 빈칸을 채워 작성합니다.
          모든 빈칸을 우리 단어로 바꿔야 발의됩니다.
        </p>
      </header>

      <ResearchReferencePanel
        contextKey="phase3_legislative"
        groupId={groupId}
        title="입법 준비자료 — 참고하며 법안을 작성하세요"
        emptyMessage="아직 입법 준비 단계에서 모은 자료가 없습니다. 법안 근거 자료실에서 자료 목록과 기사 자료를 모으면 여기에 표시됩니다."
        accent="indigo"
        compact
      />

      {fields.map((f) => (
        <PlaceholderField
          key={f.id}
          label={f.label}
          placeholder={f.placeholder}
          value={values[f.id] || ''}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
          rows={f.rows}
          maxLength={f.maxLength}
        />
      ))}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          ✓ {myBill ? '수정 저장 완료' : '발의 완료. 의사당에 상정됐어요.'}
        </p>
      )}

      <div className="flex gap-2">
        {myBill && editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setValues({})
              setError('')
            }}
            className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold border-2 border-gray-300"
          >
            ✕ 취소
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !allComplete}
          className="flex-1 py-2 rounded-lg bg-slate-700 text-white font-semibold disabled:opacity-50 hover:bg-slate-800"
        >
          {busy
            ? '저장 중...'
            : !allComplete
            ? '⚠ 빈칸을 모두 채워 주세요'
            : myBill
            ? '수정 저장'
            : '발의 (본회의 상정)'}
        </button>
      </div>
    </form>
  )
}

function StatusBadge({ status }) {
  const map = {
    discussion: { label: '💬 토의 중',  cls: 'bg-amber-100 text-amber-800' },
    tabled:     { label: '🏛️ 정식 상정', cls: 'bg-indigo-100 text-indigo-800' },
    passed:     { label: '✅ 가결',     cls: 'bg-emerald-100 text-emerald-800' },
    rejected:   { label: '❌ 부결',     cls: 'bg-rose-100 text-rose-800' },
  }
  const m = map[status] || map.discussion
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>
      {m.label}
    </span>
  )
}

export default BillTemplate
