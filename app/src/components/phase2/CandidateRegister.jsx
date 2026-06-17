import { useState, useEffect, useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import { removeAt, setAt } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'
import CandidateCard from './CandidateCard'
import { extractCanvaUrl } from '../../lib/canva-embed'
import ResearchReferencePanel from '../research/ResearchReferencePanel'

const NO_CANDIDATE_ID = '__no_candidate__'

/**
 * 후보자 등록 폼 — 후보자 선택/출마선언/공약/홍보자료를 단계별 저장 후 선관위에 최종 제출한다.
 */
function CandidateRegister({ groupId, coreIssueLabel = '최우선과제', initialData, onSuccess }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const students = useGameStore((s) => s.students)
  const groups = useGameStore((s) => s.groups)

  const groupMembers = useMemo(() => {
    const g = groups[groupId]
    if (!g || !g.members) return []
    return Object.keys(g.members)
      .map((sid) => ({ id: sid, ...students[sid] }))
      .filter((s) => s.nickname)
  }, [groupId, groups, students])

  const makeSavedMarks = (data) => ({
    candidateSavedAt: data?.candidateSavedAt || (data?.registeredAt && data?.leaderStudentId ? data.registeredAt : null),
    introSavedAt: data?.introSavedAt || (data?.registeredAt && data?.pamphlet ? data.registeredAt : null),
    pledgesSavedAt: data?.pledgesSavedAt || (data?.registeredAt && data?.pledges?.length ? data.registeredAt : null),
    mediaSavedAt: data?.mediaSavedAt || (data?.registeredAt && (data?.posterCanvaUrl || data?.canvaUrl || data?.videoCanvaUrl) ? data.registeredAt : null),
    submittedAt: data?.submittedAt || data?.registeredAt || null,
    status: data?.status || (data?.registeredAt ? 'submitted' : 'drafting'),
  })

  const [leaderId, setLeaderId] = useState(initialData?.leaderStudentId || myStudentId)
  const [pledges, setPledges] = useState(initialData?.pledges || ['', '', ''])
  const [posterCanvaUrl, setPosterCanvaUrl] = useState(initialData?.posterCanvaUrl || '')
  const [pamphlet, setPamphlet] = useState(initialData?.pamphlet || '')
  const [canvaUrl, setCanvaUrl] = useState(initialData?.canvaUrl || '')
  const [videoCanvaUrl, setVideoCanvaUrl] = useState(initialData?.videoCanvaUrl || '')
  const [savedMarks, setSavedMarks] = useState(() => makeSavedMarks(initialData))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    setLeaderId(initialData?.leaderStudentId || myStudentId)
    setPledges(initialData?.pledges || ['', '', ''])
    setPosterCanvaUrl(initialData?.posterCanvaUrl || '')
    setPamphlet(initialData?.pamphlet || '')
    setCanvaUrl(initialData?.canvaUrl || '')
    setVideoCanvaUrl(initialData?.videoCanvaUrl || '')
    setSavedMarks(makeSavedMarks(initialData))
  }, [initialData?.updatedAt, initialData?.submittedAt, initialData?.registeredAt, myStudentId])

  useEffect(() => {
    if (DraftSaver.load('candidate_reg')) setHasDraft(true)
  }, [])

  const selectedLeader = useMemo(() => groupMembers.find((m) => m.id === leaderId), [groupMembers, leaderId])
  const selectedNone = leaderId === NO_CANDIDATE_ID

  const onSaveDraft = () => {
    DraftSaver.save('candidate_reg', { leaderId, pledges, posterCanvaUrl, pamphlet, canvaUrl, videoCanvaUrl })
    setHasDraft(true)
    alert('임시저장되었습니다.')
  }

  const onLoadDraft = () => {
    const d = DraftSaver.load('candidate_reg')
    if (d?.data) {
      setLeaderId(d.data.leaderId || myStudentId)
      setPledges(d.data.pledges || ['', '', ''])
      setPosterCanvaUrl(d.data.posterCanvaUrl || '')
      setPamphlet(d.data.pamphlet || '')
      setCanvaUrl(d.data.canvaUrl || '')
      setVideoCanvaUrl(d.data.videoCanvaUrl || '')
      alert('임시저장된 내용을 불러왔습니다.')
    }
  }

  const handleCanvaInput = (val, setter) => setter(extractCanvaUrl(val))

  const buildBasePayload = (extra = {}) => ({
    ...(initialData || {}),
    ...savedMarks,
    groupId,
    leaderStudentId: selectedLeader?.id || leaderId || '',
    leaderNumber: selectedLeader?.number || '',
    leaderNickname: selectedLeader?.nickname || '',
    pledges: pledges.map((p) => p.trim()),
    posterCanvaUrl: posterCanvaUrl.trim() || null,
    canvaUrl: canvaUrl.trim() || null,
    videoCanvaUrl: videoCanvaUrl.trim() || null,
    pamphlet: pamphlet.trim() || null,
    updatedAt: Date.now(),
    ...extra,
  })

  const saveCandidateName = async () => {
    if (!selectedLeader) return setError('후보자를 선택해 주세요.')
    setBusy(true)
    setError('')
    try {
      const now = Date.now()
      await setAt(roomCode, `candidates/${groupId}`, buildBasePayload({
        status: savedMarks.status === 'submitted' ? 'submitted' : 'drafting',
        candidateSavedAt: now,
      }))
      setSavedMarks((prev) => ({ ...prev, candidateSavedAt: now }))
      alert('후보자 이름을 저장했습니다.')
    } catch (err) {
      setError('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveJournalistChoice = async () => {
    if (!roomCode || !groupId) return
    if (!confirm('후보를 내지 않고 선거 기자단으로 활동할까요?')) return
    setBusy(true)
    setError('')
    try {
      await setAt(roomCode, `electionJournalists/${groupId}`, {
        groupId,
        groupName: groups?.[groupId]?.name || '',
        registeredAt: Date.now(),
      })
      if (initialData) await removeAt(roomCode, `candidates/${groupId}`)
      DraftSaver.clear('candidate_reg')
      setHasDraft(false)
      alert('선거 기자단으로 등록했습니다.')
      onSuccess?.()
    } catch (err) {
      setError('기자단 등록 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveIntro = async () => {
    if (!selectedLeader) return setError('후보자를 먼저 등록해 주세요.')
    if (!pamphlet.trim()) return setError('후보 소개 및 출마 선언을 작성해 주세요.')
    setBusy(true)
    setError('')
    try {
      const now = Date.now()
      await setAt(roomCode, `candidates/${groupId}`, buildBasePayload({
        status: savedMarks.status === 'submitted' ? 'submitted' : 'drafting',
        candidateSavedAt: savedMarks.candidateSavedAt || now,
        introSavedAt: now,
      }))
      setSavedMarks((prev) => ({ ...prev, candidateSavedAt: prev.candidateSavedAt || now, introSavedAt: now }))
      alert('출마 선언서를 저장했습니다.')
    } catch (err) {
      setError('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const savePledges = async () => {
    if (!selectedLeader) return setError('후보자를 먼저 등록해 주세요.')
    if (!pledges.some((p) => p.trim())) return setError('최우선과제 해결 공약을 1개 이상 입력해 주세요.')
    setBusy(true)
    setError('')
    try {
      const now = Date.now()
      await setAt(roomCode, `candidates/${groupId}`, buildBasePayload({
        status: savedMarks.status === 'submitted' ? 'submitted' : 'drafting',
        candidateSavedAt: savedMarks.candidateSavedAt || now,
        pledgesSavedAt: now,
      }))
      setSavedMarks((prev) => ({ ...prev, candidateSavedAt: prev.candidateSavedAt || now, pledgesSavedAt: now }))
      alert('공약을 저장했습니다.')
    } catch (err) {
      setError('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveMedia = async () => {
    if (!selectedLeader) return setError('후보자를 먼저 등록해 주세요.')
    setBusy(true)
    setError('')
    try {
      const now = Date.now()
      await setAt(roomCode, `candidates/${groupId}`, buildBasePayload({
        status: savedMarks.status === 'submitted' ? 'submitted' : 'drafting',
        candidateSavedAt: savedMarks.candidateSavedAt || now,
        mediaSavedAt: now,
      }))
      setSavedMarks((prev) => ({ ...prev, candidateSavedAt: prev.candidateSavedAt || now, mediaSavedAt: now }))
      alert('홍보자료 링크를 저장했습니다.')
    } catch (err) {
      setError('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitToElectionCommission = async () => {
    if (!selectedLeader) return setError('후보자를 선택해 주세요.')
    if (!pamphlet.trim()) return setError('후보 소개 및 출마 선언을 작성해 주세요.')
    if (!pledges.some((p) => p.trim())) return setError('최우선과제 해결 공약을 1개 이상 입력해 주세요.')
    if (!confirm('미리보기를 확인했나요? 이 내용으로 선관위에 제출할까요?')) return
    setBusy(true)
    setError('')
    try {
      const now = Date.now()
      await setAt(roomCode, `candidates/${groupId}`, buildBasePayload({
        status: 'submitted',
        candidateSavedAt: savedMarks.candidateSavedAt || now,
        introSavedAt: savedMarks.introSavedAt || now,
        pledgesSavedAt: savedMarks.pledgesSavedAt || now,
        mediaSavedAt: savedMarks.mediaSavedAt || now,
        submittedAt: now,
        registeredAt: now,
      }))
      setSavedMarks((prev) => ({
        ...prev,
        candidateSavedAt: prev.candidateSavedAt || now,
        introSavedAt: prev.introSavedAt || now,
        pledgesSavedAt: prev.pledgesSavedAt || now,
        mediaSavedAt: prev.mediaSavedAt || now,
        submittedAt: now,
        status: 'submitted',
      }))
      DraftSaver.clear('candidate_reg')
      setHasDraft(false)
      alert('선관위에 후보 등록 내용을 제출했습니다.')
      onSuccess?.()
    } catch (err) {
      setError('제출 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border-2 border-rose-200 shadow-sm space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-rose-800 text-lg">🎤 후보 캠프 등록 및 수정</h3>
            <p className="text-[10px] text-gray-500 mt-1">
              후보를 내면 후보 캠프, 없음으로 저장하면 선거 기자단으로 활동합니다.
            </p>
          </div>
          <div className="flex gap-1">
            {hasDraft && !initialData && (
              <button type="button" onClick={onLoadDraft} className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold hover:bg-amber-200">📂 불러오기</button>
            )}
            {!initialData && (
              <button type="button" onClick={onSaveDraft} className="text-[10px] px-2 py-1 bg-rose-50 text-rose-700 rounded border border-rose-100 font-bold hover:bg-rose-100">💾 임시저장</button>
            )}
          </div>
        </header>

        <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-900">
          이번 선거의 기준: <strong>{coreIssueLabel}</strong>을 가장 잘 해결할 후보인가?
        </div>

        <section className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
          <label className="block text-xs font-bold text-gray-700">① 후보자 선택 및 후보 이름 저장</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {groupMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLeaderId(m.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  leaderId === m.id ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200'
                }`}
              >
                {m.number}번 {m.nickname}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLeaderId(NO_CANDIDATE_ID)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                selectedNone ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
              }`}
            >
              없음
            </button>
          </div>
          {groupMembers.length === 0 && <p className="text-[10px] text-gray-400">모둠원이 없습니다.</p>}

          {selectedNone ? (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-black">📰 후보를 내지 않으면 선거 기자단으로 활동합니다.</p>
              <ul className="list-disc pl-5 text-xs leading-relaxed text-blue-800">
                <li>후보들의 공약과 홍보자료를 비교해 기사로 정리합니다.</li>
                <li>토론을 지켜보고 질문거리와 쟁점을 찾아 보도합니다.</li>
                <li>유권자가 후보를 판단할 수 있도록 사실과 의견을 구분해 전달합니다.</li>
                <li>여러 선거 캠프에서 일어나는 일들을 육하원칙에 맞게 생생하게 전달합니다.(이때 이름가리기 사용)</li>
                <li>주제와 관련된 사항을 쉽고, 빠르고 정확하게 알려줍니다.</li>
                <li>기자의 직업 윤리를 생각하며 여러 사람에게 두루 도움이 되는 기사를 작성합니다.</li>
              </ul>
              <button type="button" onClick={saveJournalistChoice} disabled={busy} className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 disabled:opacity-50">
                없음 저장하고 선거 기자단으로 활동하기
              </button>
            </div>
          ) : (
            <button type="button" onClick={saveCandidateName} disabled={busy} className="w-full py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50">
              ① 후보 이름 저장
            </button>
          )}
        </section>

        {!selectedNone && (
          <>
            <section className="space-y-2 rounded-2xl border border-rose-100 bg-white p-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">② 후보 소개 및 출마 선언서 저장</label>
              <textarea
                value={pamphlet}
                onChange={(e) => setPamphlet(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={`${coreIssueLabel} 해결을 위해 출마했습니다...`}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
              <button type="button" onClick={saveIntro} disabled={busy} className="w-full py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50">
                ② 출마 선언서 저장
              </button>
            </section>

            <section className="space-y-2 rounded-2xl border border-rose-100 bg-white p-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">③ 최우선과제 해결 공약 저장</label>
              <ResearchReferencePanel
                contextKey="phase2_election"
                groupId={groupId}
                title="공약 자료실 — 참고하며 공약을 작성하세요"
                emptyMessage="아직 공약 개발용 자료가 없습니다. 앞 단계의 공약 전략 자료실에서 자료 목록과 기사 자료를 모으면 여기에 표시됩니다."
                accent="rose"
                compact
              />
              {pledges.map((p, i) => (
                <input
                  key={i}
                  type="text"
                  value={p}
                  onChange={(e) => {
                    const next = [...pledges]
                    next[i] = e.target.value
                    setPledges(next)
                  }}
                  placeholder={`해결 공약 ${i + 1}`}
                  maxLength={50}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              ))}
              <button type="button" onClick={savePledges} disabled={busy} className="w-full py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50">
                ③ 공약 저장
              </button>
            </section>

            <section className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">④ 선거 홍보자료 저장</label>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🖼️ 선거 포스터 캔바 링크</label>
                <input type="text" value={posterCanvaUrl} onChange={(e) => handleCanvaInput(e.target.value, setPosterCanvaUrl)} placeholder="포스터 임베드 코드나 링크를 붙여넣으세요" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🎨 공약 카드뉴스 캔바 링크</label>
                <input type="text" value={canvaUrl} onChange={(e) => handleCanvaInput(e.target.value, setCanvaUrl)} placeholder="공약 카드뉴스 임베드 코드나 링크를 붙여넣으세요" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🎬 홍보영상 캔바 링크</label>
                <input type="text" value={videoCanvaUrl} onChange={(e) => handleCanvaInput(e.target.value, setVideoCanvaUrl)} placeholder="홍보영상 임베드 코드나 링크를 붙여넣으세요" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
              <button type="button" onClick={saveMedia} disabled={busy} className="w-full py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50">
                ④ 홍보자료 저장
              </button>
            </section>
          </>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}
      </div>

      {!selectedNone && (
        <section className="space-y-3">
          <header className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-widest">실시간 미리보기</h4>
          </header>
          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 opacity-90 scale-[0.98] origin-top transition-all">
            <CandidateCard
              candidate={{
                leaderNumber: selectedLeader?.number || '?',
                leaderNickname: selectedLeader?.nickname || '후보 미선택',
                pledges,
                posterCanvaUrl,
                canvaUrl,
                videoCanvaUrl,
                pamphlet,
                status: savedMarks.status,
              }}
              group={{ name: '우리 모둠' }}
              previewMode={true}
            />
          </div>
          <CandidateSubmissionChecklist
            candidateSaved={!!savedMarks.candidateSavedAt}
            introSaved={!!savedMarks.introSavedAt}
            pledgesSaved={!!savedMarks.pledgesSavedAt}
            mediaSaved={!!savedMarks.mediaSavedAt}
            finalSubmitted={savedMarks.status === 'submitted'}
            introReady={!!selectedLeader && !!pamphlet.trim()}
            pledgesReady={pledges.some((p) => p.trim())}
            mediaReady={!!(posterCanvaUrl || canvaUrl || videoCanvaUrl)}
          />
          <button type="button" onClick={submitToElectionCommission} disabled={busy} className="w-full py-3 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50">
            {busy ? '제출 중...' : '미리보기 확인 후 선관위에 제출하기'}
          </button>
        </section>
      )}
    </div>
  )
}

function CandidateSubmissionChecklist({ candidateSaved, introSaved, pledgesSaved, mediaSaved, finalSubmitted, introReady, pledgesReady, mediaReady }) {
  const rows = [
    ['후보 이름 등록', candidateSaved, true],
    ['후보 소개·출마 선언', introSaved, introReady],
    ['최우선과제 해결 공약', pledgesSaved, pledgesReady],
    ['선거 포스터·공약 카드뉴스·홍보영상', mediaSaved, mediaReady],
    ['선관위 최종 제출', finalSubmitted, finalSubmitted],
  ]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-black text-slate-700 mb-2">온라인 토론용 미리보기 제출 상태</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {rows.map(([label, saved, ready]) => (
          <div key={label} className={`rounded-xl border px-3 py-2 text-xs ${saved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ready ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{label}</span>
              <span className="font-black">{saved ? '제출' : ready ? '작성됨·저장 필요' : '미제출'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CandidateRegister
