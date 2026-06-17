import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder } from '../../lib/rtdb-helpers'

const COLORS = [
  { id: 'yellow', cls: 'bg-yellow-100 border-yellow-300', label: '노랑' },
  { id: 'pink',   cls: 'bg-pink-100 border-pink-300',     label: '핑크' },
  { id: 'sky',    cls: 'bg-sky-100 border-sky-300',       label: '하늘' },
  { id: 'lime',   cls: 'bg-lime-100 border-lime-300',     label: '연두' },
  { id: 'violet', cls: 'bg-violet-100 border-violet-300', label: '보라' },
  { id: 'amber',  cls: 'bg-amber-100 border-amber-300',   label: '주황' },
]

/**
 * 정리 글 작성 — 5박스 + 마치며 글쓰기 + 카드 색상 + 비공개 옵션.
 */
function ReflectionEditor() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)

  const [participation, setParticipation] = useState('')
  const [feelings, setFeelings] = useState('')
  const [mostImpressive, setMostImpressive] = useState('')
  const [newLearnings, setNewLearnings] = useState('')
  const [pledge, setPledge] = useState('')
  const [finalEssay, setFinalEssay] = useState('')

  const [color, setColor] = useState('yellow')
  const [isPrivate, setIsPrivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const fields = [participation, feelings, mostImpressive, newLearnings, pledge, finalEssay]
    if (fields.every((v) => !v.trim())) {
      setError('박스 중 하나라도 작성해 주세요.')
      return
    }
    setBusy(true)
    try {
      await pushUnder(roomCode, 'reflections', {
        // 신 5박스 + 마치며
        participation: participation.trim(),
        feelings: feelings.trim(),
        mostImpressive: mostImpressive.trim(),
        newLearnings: newLearnings.trim(),
        pledge: pledge.trim(),
        finalEssay: finalEssay.trim(),
        // 호환성: 구 3박스 필드도 일부 채움
        impressive: mostImpressive.trim() || participation.trim(),
        revisit: feelings.trim(),

        color,
        isPrivate,
        authorStudentId: myStudentId,
        authorNumber: myNumber,
        authorNickname: myNickname,
        status: 'pending',
        empathy: { heart: 0, clap: 0, lightbulb: 0, thumbsup: 0 },
      })
      setParticipation(''); setFeelings(''); setMostImpressive('');
      setNewLearnings(''); setPledge(''); setFinalEssay('');
      setColor('yellow'); setIsPrivate(false)
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-pink-200 shadow-sm space-y-3"
    >
      <h3 className="font-bold text-pink-800">📝 프로젝트 정리 글</h3>
      <p className="text-xs text-gray-500">
        20차시를 함께 돌아봐요. 5가지 질문에 답한 뒤, 마지막에 하나로 묶어 글을 써 보세요.
      </p>

      {[
        ['1️⃣ 나는 어떤 활동을 어떻게 참여하였나? (사실)', participation, setParticipation],
        ['2️⃣ 그때 나의 인상이나 느낌, 생각은?', feelings, setFeelings],
        ['3️⃣ 가장 인상 깊었던 활동은? 그 이유는?', mostImpressive, setMostImpressive],
        ['4️⃣ 새롭게 알게 된 점들 — 구체적으로', newLearnings, setNewLearnings],
        ['5️⃣ 민주 시민으로서 나의 한 줄 다짐', pledge, setPledge],
      ].map(([label, val, setter]) => (
        <div key={label}>
          <label className="text-xs font-semibold text-gray-700">{label}</label>
          <textarea
            value={val}
            onChange={(e) => setter(e.target.value)}
            rows={2}
            maxLength={250}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
          />
        </div>
      ))}

      <div className="border-t pt-3">
        <label className="text-xs font-semibold text-pink-700">
          📜 마치며 — 위 다섯 가지를 참고해 ‘민국이의 꿈 프로젝트를 마치며’ 글을 써 보세요
        </label>
        <textarea
          value={finalEssay}
          onChange={(e) => setFinalEssay(e.target.value)}
          rows={6}
          maxLength={1500}
          placeholder="시민단체 활동부터 선거·국정·사법까지의 경험을 한 편의 글로 정리해 보세요."
          className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-pink-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
        />
        <p className="text-xs text-gray-400 text-right">
          {finalEssay.length} / 1500자
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">카드 색상</p>
        <div className="flex gap-1 flex-wrap">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setColor(c.id)}
              className={`w-8 h-8 rounded-full border-2 transition ${c.cls} ${
                color === c.id ? 'ring-2 ring-offset-2 ring-pink-500' : ''
              }`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <span>🔒 부끄러우니 선생님만 볼 수 있게 (비공개)</span>
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          ✓ 정리 글이 제출됐어요. 선생님 승인을 기다려 주세요.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2 rounded-lg bg-pink-600 text-white font-semibold disabled:opacity-50 hover:bg-pink-700"
      >
        {busy ? '제출 중...' : '제출'}
      </button>
    </form>
  )
}

export default ReflectionEditor

export { COLORS as REFLECTION_COLORS }
