import { useState } from 'react'
import useGameStore from '../../store/gameStore'

const NPC_PRESETS = [
  {
    scenarioId: '폐수 방류 사건',
    persona: 'villain',
    scenarioText:
      '한 화학공장이 야간에 정화처리 없이 폐수를 강에 방류한 정황이 포착됐습니다. 환경부 점검 결과 수질 오염 기준치의 8배가 검출되었습니다.',
  },
  {
    scenarioId: '야간 강제근무 사건',
    persona: 'evader',
    scenarioText:
      '한 물류회사가 직원들에게 동의 없이 야간 강제 근무를 시키고 수당을 지급하지 않은 사실이 내부 고발로 드러났습니다.',
  },
  {
    scenarioId: '담합 사건',
    persona: 'righteous',
    scenarioText:
      '대기업 4곳이 1년간 입찰 단가를 사전에 협의해 시장 가격을 인위적으로 올려왔다는 혐의가 제기됐습니다.',
  },
  {
    scenarioId: '개인정보 유출 사건',
    persona: 'victim',
    scenarioText:
      '대형 쇼핑몰의 보안 취약점 때문에 회원 50만 명의 개인정보가 유출됐습니다. 회사는 보안 투자에 인색했다는 비판을 받습니다.',
  },
]

/**
 * 교사 대시보드 — Phase 3 운영용 컨트롤
 * - 야당 연합 1분 타이머 시작
 * - NPC 사건 투입 (프리셋 4종 + 자유 입력)
 */
function Phase3Controls() {
  const startAllianceTimer = useGameStore((s) => s.startAllianceTimer)
  const stopAllianceTimer = useGameStore((s) => s.stopAllianceTimer)
  const launchNpcEvent = useGameStore((s) => s.launchNpcEvent)

  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState({
    scenarioId: '',
    persona: 'villain',
    scenarioText: '',
  })

  const launchPreset = (preset) => {
    if (!confirm(`'${preset.scenarioId}' 사건을 투입할까요?`)) return
    launchNpcEvent(preset)
  }
  const launchCustom = () => {
    if (!custom.scenarioId.trim() || !custom.scenarioText.trim()) {
      alert('사건명·시나리오를 입력해 주세요.')
      return
    }
    launchNpcEvent({ ...custom })
    setCustom({ scenarioId: '', persona: 'villain', scenarioText: '' })
  }

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-indigo-700">Phase 3 운영</h2>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => startAllianceTimer(60)}
          className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
        >
          ⏱️ 야당 연합 1분 타이머
        </button>
        <button
          onClick={stopAllianceTimer}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          타이머 종료
        </button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-3 py-2 text-sm text-left bg-slate-50 hover:bg-slate-100 font-semibold flex items-center justify-between"
        >
          <span>📂 NPC 사건 투입</span>
          <span className="text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {open && (
          <div className="p-3 space-y-3 bg-white">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">
                기본 프리셋 4종
              </p>
              <div className="grid grid-cols-2 gap-2">
                {NPC_PRESETS.map((p) => (
                  <button
                    key={p.scenarioId}
                    onClick={() => launchPreset(p)}
                    className="text-left p-2 rounded-lg border hover:border-slate-400 text-xs"
                  >
                    <div className="font-bold">{p.scenarioId}</div>
                    <div className="text-gray-500 line-clamp-2 mt-0.5">
                      {p.scenarioText}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t space-y-1">
              <p className="text-xs font-semibold text-gray-600">자유 입력</p>
              <input
                type="text"
                value={custom.scenarioId}
                onChange={(e) =>
                  setCustom({ ...custom, scenarioId: e.target.value })
                }
                placeholder="사건명"
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
              />
              <select
                value={custom.persona}
                onChange={(e) =>
                  setCustom({ ...custom, persona: e.target.value })
                }
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
              >
                <option value="villain">😈 악덕기업주</option>
                <option value="evader">🎭 책임 회피형</option>
                <option value="righteous">⚖️ 정의로운 위반자</option>
                <option value="victim">🤕 구조적 피해자</option>
              </select>
              <textarea
                value={custom.scenarioText}
                onChange={(e) =>
                  setCustom({ ...custom, scenarioText: e.target.value })
                }
                placeholder="시나리오 텍스트"
                rows={3}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 resize-none"
              />
              <button
                onClick={launchCustom}
                className="w-full py-1.5 text-sm rounded bg-slate-700 text-white font-semibold hover:bg-slate-800"
              >
                사건 투입
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Phase3Controls
