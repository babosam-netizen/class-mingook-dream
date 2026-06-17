import { useState, useEffect } from 'react'
import useGameStore from '../../../store/gameStore'
import { updateAt } from '../../../lib/rtdb-helpers'
import { DraftSaver } from '../../../lib/draft-saver'

/**
 * 토론 대본 작성 도구 (학생용).
 * - 진영별 공동 대본 작성
 * - 찬성/반대측 대본 양식 제공 (빈칸 채우기 형식)
 * 
 * @param {{ session, scripts, mySideId, sideLabel }} props
 */
function DebateScriptEditor({ session, scripts = {}, mySideId, sideLabel }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myNickname = useGameStore((s) => s.myNickname)

  const remoteScript = scripts[mySideId]?.body || ''
  const [body, setBody] = useState(remoteScript)
  const [busy, setBusy] = useState(false)

  // 원격 데이터가 바뀌면 (다른 팀원이 저장하면) 동기화
  useEffect(() => {
    setBody(remoteScript)
  }, [remoteScript])

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      await updateAt(roomCode, `debateSessions/${session.id}/scripts/${mySideId}`, {
        body: body.trim(),
        lastAuthor: myNickname,
        updatedAt: Date.now(),
      })
      alert('대본이 저장되었습니다. 우리 진영 모두가 함께 봅니다.')
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const applyTemplate = () => {
    let template = ''
    const type = session?.type || 'general'
    const stanceLabel = mySideId === 'pro' ? '찬성' : mySideId === 'con' ? '반대' : '( 찬성 / 반대 )'
    const topic = session.topic || '이 논제'

    if (mySideId === 'evaluator') {
      if (type === 'trial') {
        template = `배심원단 대표: 양측의 진술을 신중하게 들었습니다. 

검사 측은 (                                                                           ) 증거를 잘 보여주었고, 
변호인 측은 (                                                                           ) 설명이 설득력이 있었습니다. 

저희 배심원들은 토론 내용을 바탕으로, 이번 사건에 대해 ( 죄가 있다 / 죄가 없다 ) 라고 결정하였습니다.`
      } else if (type === 'consultative') {
        template = `조정위원: 양측의 입장을 모두 들었습니다. 

서로의 공통점은 (                                                                           ) 이며, 
서로 다른 점은 (                                                                           ) 이었습니다. 

저희는 서로 조금씩 양보하여 (                                           ) 방향으로 합의하기를 권고합니다.`
      } else {
        template = `평가단 대표: 양측의 토론을 공정하게 평가했습니다. 

찬성 측은 (                                                                           ) 점이 훌륭했고, 
반대 측은 (                                                                           ) 점이 돋보였습니다. 

평가 기준에 따라 객관적인 근거를 제시하고 논리적으로 설득한 (          ) 측이 이번 토론을 더 잘 이끌었다고 평가합니다.`
      }
    } else {
      // 참여자용
      if (type === 'multi_party') {
        template = `[1단계: 우리 팀의 입장 발표]
저희 ${sideLabel} 팀은 '${topic}'에 대해 다음과 같은 입장을 가지고 있습니다.
저희가 중요하게 생각하는 것은 (                                    ) 입니다.
이를 위해 (                                    ) 방안을 제안합니다.

[2단계: 다른 팀 질의 및 반론]
- A팀의 생각 중 (            ) 부분은 다음과 같이 질문하거나 반론하겠습니다.
- B팀의 생각 중 (            ) 부분은 다음과 같이 질문하거나 반론하겠습니다.

[3단계: 협력 및 최종 결론]
다른 팀의 의견을 들어보니 (                                    ) 점을 보충하면 더 좋을 것 같습니다.
저희 ${sideLabel} 팀은 (                                    ) 하는 방향이 가장 바람직하다고 생각합니다.`
      } else if (type === 'trial') {
        const roleName = mySideId === 'pro' ? '검사' : mySideId === 'con' ? '변호인' : sideLabel
        template = `[처음 말하기]
판사님, 그리고 배심원 여러분. 저희 ${roleName} 측은 이번 사건에 대해 다음과 같이 진술합니다.
피고인이 (                                    ) 행동을 하였으므로, 저희는 ( 죄가 있다 / 죄가 없다 ) 고 주장합니다.

[증거 보여주기]
가장 중요한 증거는 (                                    ) 입니다.
이 증거는 (                                    ) 사실을 확실히 보여줍니다.

[최종 변론]
지금까지의 내용을 합쳐볼 때, 피고인에게는 ( 벌을 주어야 / 용서해 주어야 ) 합니다.
이상으로 ${roleName} 측의 진술을 마치겠습니다.`
      } else if (type === 'consultative') {
        template = `[1단계: 우리의 입장과 요구]
저희 ${sideLabel} 측이 이번 협의에서 가장 중요하게 생각하는 것은 (                ) 입니다.
이를 위해 저희는 (                                    ) 조건을 꼭 지키고자 합니다.

[2단계: 서로 조금씩 양보하기]
상대방이 원하는 것 중 (                ) 부분은 저희도 이해합니다.
대신 저희는 (                                    ) 부분에서 양보할 의사가 있습니다.

[3단계: 합의안 제안]
서로의 이익을 위해 저희는 최종적으로 (                                    ) 하는 약속을 제안합니다.
이 약속을 통해 (                                    ) 효과를 기대할 수 있습니다.`
      } else {
        // 일반 토론 (사용자가 주신 원문 유지, 모양만 정돈)
        template = `1단계: 주장 펼치기 (우리 측 논리 세우기)
우리 측의 주장, 이유, 근거가 논리적으로 잘 연결되도록 작성합니다.

주장: 우리는 '${topic}' 에 ${stanceLabel} 합니다.
이유: 왜냐하면 ___________________________________________________________ 이기 때문입니다.
근거 (통계, 전문가 의견 등 객관적 자료): 이를 뒷받침하는 자료로 ___________________________________________________________ 가 있습니다. (자료 출처: ________________________ )

2단계: 반론하기 (공격과 방어 구상)
상대방이 어떤 주장을 할지, 우리의 주장에 어떤 반론을 제기할지 미리 예상하고 답변을 촘촘하게 구상합니다.

[공격] 상대측 예상 주장/근거: 상대측은 __________________________________ 라고 주장할 것이다.
[공격] 우리 측 반론: 그 주장에 대해 우리는 __________________________________ 라고 반론할 것이다.
[방어] 상대측 예상 반론: 상대측은 우리 주장에 대해 ____________________________ 라고 반론할 것이다.
[방어] 우리 측 답변: 그 반론에 대해 우리는 __________________________________ 라고 답변할 것이다.

3단계: 주장 다지기 (최종 요약)
앞서 다룬 내용을 바탕으로 우리 측의 주장을 가장 강력하고 인상 깊게 요약합니다.

최종 주장 정리: 지금까지 논의한 바와 같이 _________________________________________________ 하므로, 우리는 '${topic}' 에 강력히 ${stanceLabel} 합니다.`
      }
    }
    
    if (body.trim() && !confirm('현재 작성 중인 내용이 사라집니다. 양식을 불러올까요?')) return
    setBody(template)
  }

  if (mySideId === 'none') {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200">
        <p className="text-sm text-gray-500 font-bold">
          대본 작성은 토론 참여자 또는 평가단만 가능합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-lg p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400"></div>
      
      <div className="flex items-center justify-between">
        <h3 className="font-black text-blue-800 flex items-center gap-2">
          <span className="bg-blue-100 p-1.5 rounded-lg text-lg">📝</span>
          {sideLabel} 대본 작성
        </h3>
        <button
          type="button"
          onClick={applyTemplate}
          className="text-[11px] px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-black hover:bg-blue-100 transition-all"
        >
          📋 기본 양식 불러오기
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">대본 내용 (빈칸을 채워보세요)</label>
          {scripts[mySideId]?.lastAuthor && (
            <span className="text-[10px] text-indigo-400 font-bold">
              마지막 수정: {scripts[mySideId].lastAuthor}
            </span>
          )}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="여기에 대본을 작성하세요..."
          rows={12}
          className="w-full px-4 py-4 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all resize-none leading-relaxed font-medium"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !body.trim()}
          className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-30 disabled:shadow-none active:scale-95"
        >
          {busy ? '저장 중...' : '💾 우리 진영 공동 대본 저장하기'}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center leading-relaxed">
        ※ 저장한 대본은 같은 진영 친구들 모두에게 실시간으로 공유됩니다.<br/>
        토론 중에는 이 대본이 타이머 아래 '뉴스 프롬프트' 형태로 나타납니다.
      </p>
    </div>
  )
}

export default DebateScriptEditor
