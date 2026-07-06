import { useMemo, useState, useEffect } from 'react'
import { DEFAULT_TOPICS } from '../../store/gameStore'
import { TOPIC_COLOR_OPTIONS, topicBg } from '../../styles/tokens'
import { ref, update, remove } from 'firebase/database'
import { database } from '../../lib/firebase'
import useGameStore from '../../store/gameStore'
import SubmissionDetailModal from './SubmissionDetailModal'
import { subscribe } from '../../lib/rtdb-helpers'
import PosterMedia from '../phase1/PosterMedia'

/**
 * 국민청원 말머리 편집기 (로컬 상태 관리)
 */
function PetitionPrefixEditor({ value, onChange }) {
  const defaultOptions = ['환경', '노동', '주거', '인권', '교육', '안전', '기타']
  const [text, setText] = useState((value || defaultOptions).join(', '))

  return (
    <div className="flex flex-col gap-1 mt-2">
      <label className="text-[10px] font-bold text-amber-800">청원 말머리 (쉼표로 구분)</label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            e.target.blur()
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          const arr = text.split(',').map((s) => s.trim()).filter(Boolean)
          if (arr.length === 0) {
            setText(defaultOptions.join(', '))
            onChange(defaultOptions)
          } else {
            setText(arr.join(', '))
            onChange(arr)
          }
        }}
        className="w-full text-xs p-2 rounded border border-amber-200 bg-white focus:ring-2 focus:ring-amber-300"
        placeholder="환경, 노동, 주거, 인권..."
      />
      <p className="text-[9px] text-gray-500">쉼표(,)로 구분하여 입력 후 바깥을 클릭(또는 엔터)하면 저장됩니다.</p>
    </div>
  )
}

/**
 * 선거 등수별 직책 편집기 — 1위, 2위, 3위... 각각 라벨·이모지 편집
 *
 * props:
 *   value: [{ rank, label, emoji }] (없으면 기본값 사용)
 *   onChange(arr): 변경 핸들러
 */
const DEFAULT_ELECTION_ROLES = [
  { rank: 1, label: '대통령',   emoji: '🇰🇷' },
  { rank: 2, label: '국회의장', emoji: '🏛️' },
  { rank: 3, label: '대법원장', emoji: '⚖️' },
]

function ElectionRoleEditor({ value, onChange }) {
  const roles = Array.isArray(value) && value.length > 0 ? value : DEFAULT_ELECTION_ROLES

  const updateRole = (rank, field, val) => {
    const next = roles.map((r) =>
      Number(r.rank) === Number(rank) ? { ...r, [field]: val } : r,
    )
    onChange(next)
  }

  const addRole = () => {
    const nextRank = roles.length > 0 ? Math.max(...roles.map((r) => Number(r.rank) || 0)) + 1 : 1
    onChange([...roles, { rank: nextRank, label: '', emoji: '🎖️' }])
  }

  const removeRole = (rank) => {
    if (!confirm(`${rank}위 직책을 삭제할까요?`)) return
    onChange(roles.filter((r) => Number(r.rank) !== Number(rank)))
  }

  const resetDefaults = () => {
    if (!confirm('기본값(1위 대통령 / 2위 국회의장 / 3위 대법원장)으로 되돌릴까요?')) return
    onChange(DEFAULT_ELECTION_ROLES)
  }

  return (
    <section className="bg-white p-5 rounded-3xl border-2 border-amber-100 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-black text-amber-900 flex items-center gap-2">
          <span className="text-xl">🏆</span> 선거 등수별 직책
        </h3>
        <button
          type="button"
          onClick={resetDefaults}
          className="text-[10px] font-bold px-3 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          ↺ 기본값으로
        </button>
      </div>
      <p className="text-[10px] font-bold text-gray-400 mb-4 ml-7">
        본 투표 결과 발표 전광판에 노출되는 등수별 직책입니다. (예: 1위 → 대통령)
      </p>

      <div className="space-y-2 ml-7">
        {roles
          .slice()
          .sort((a, b) => Number(a.rank) - Number(b.rank))
          .map((r) => (
            <div key={r.rank} className="flex items-center gap-2 bg-amber-50/60 border border-amber-100 rounded-2xl px-3 py-2">
              <div className="shrink-0 w-12 h-10 rounded-xl bg-amber-500 text-white text-sm font-black flex items-center justify-center">
                {r.rank}위
              </div>
              <input
                type="text"
                value={r.emoji || ''}
                onChange={(e) => updateRole(r.rank, 'emoji', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="🎖️"
                className="shrink-0 w-14 text-center text-lg p-2 rounded-xl border-2 border-white bg-white font-bold focus:border-amber-300 focus:outline-none"
                maxLength={4}
              />
              <input
                type="text"
                value={r.label || ''}
                onChange={(e) => updateRole(r.rank, 'label', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="직책 이름 (예: 대통령)"
                className="flex-1 text-xs p-2.5 rounded-xl border-2 border-white bg-white font-bold focus:border-amber-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeRole(r.rank)}
                title="삭제"
                className="shrink-0 w-8 h-8 rounded-lg bg-white border border-rose-100 text-rose-400 hover:bg-rose-50 text-sm font-bold"
              >
                ✕
              </button>
            </div>
          ))}

        <button
          type="button"
          onClick={addRole}
          className="w-full text-xs font-bold px-3 py-2 rounded-2xl border-2 border-dashed border-amber-200 text-amber-600 hover:bg-amber-50/40"
        >
          + 직책 추가 ({roles.length > 0 ? Math.max(...roles.map((r) => Number(r.rank) || 0)) + 1 : 1}위)
        </button>
      </div>
    </section>
  )
}

/**
 * 학급 설정 편집기 — 학급 인원 / 시민단체 종류 / 인원 배정 모드 / 번호별 배정표 / 링크 받기 토글
 *
 * props:
 *   value: config 객체 (classSize 포함)
 *   onChange(nextConfig): 변경 핸들러
 */
function ClassroomConfigEditor({ value, onChange, students = {}, groups = {} }) {
  const v = value
  const roomCode = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const topicEntries = useMemo(() => Object.entries(v.topics || {}), [v.topics])
  const classSize = Math.max(1, Math.min(40, Number(v.classSize) || 24))

  // [Antigravity] 번호별 학생 맵 (DND 및 표시용)
  const studentsByNumber = useMemo(() => {
    const map = {}
    Object.values(students || {}).forEach((s) => {
      if (s.number) map[s.number] = s
    })
    return map
  }, [students])

  // [Antigravity] 번호별 배정표 로컬 상태 관리 (저장 버튼 클릭 시에만 반영)
  const [localAssignedSlots, setLocalAssignedSlots] = useState(v.assignedSlots || {})
  // [Antigravity] 토픽(단체) 편집 로컬 상태
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [localTopicName, setLocalTopicName] = useState('')
  const [localTopicEmoji, setLocalTopicEmoji] = useState('')
  // [Antigravity] 사용자가 로컬에서 수정을 시작했는지 여부 (서버 데이터 덮어쓰기 방지)
  const [isDirty, setIsDirty] = useState(false)
  const [viewingSid, setViewingSid] = useState(null)
  const [assigningNumber, setAssigningNumber] = useState(null)
  // 과거 모둠 편성 1회 기록(발자취 보정) — 모둠 컨테이너별로 '이전 번호'를 직접 입력
  const [pastByGroup, setPastByGroup] = useState({})   // { gid: "11,18,24" }
  const [pastSeedMsg, setPastSeedMsg] = useState('')
  // 변경 경계(이 단계 '부터' 현재 모둠). 그 이전 단계 활동은 이전 모둠으로 본다.
  // 단계 랭크: 1여정=10, 2여정=20, 3여정 입법=31·행정=32·사법=33, 4여정=40
  const [pastCutoff, setPastCutoff] = useState(33)     // 기본: 사법부부터 현재 모둠
  const CUTOFF_OPTIONS = [
    { rank: 20, label: '2여정(선거)부터 현재 모둠' },
    { rank: 31, label: '3여정 입법부부터 현재 모둠' },
    { rank: 32, label: '3여정 행정부부터 현재 모둠' },
    { rank: 33, label: '3여정 사법부부터 현재 모둠' },
    { rank: 40, label: '4여정(시사회)부터 현재 모둠' },
  ]

  // 각 모둠 칸에 적은 '이전 번호'를 그 모둠으로 연결해 groupHistory를 1회 기록(기존 데이터 불변).
  const seedPastFormation = async () => {
    if (!roomCode) { setPastSeedMsg('방 정보가 없습니다.'); return }
    const numToSid = {}
    Object.entries(students || {}).forEach(([sid, s]) => { if (s?.number != null) numToSid[String(s.number)] = sid })
    const updates = {}
    let count = 0
    const missNums = []   // 그 번호의 학생을 못 찾음
    Object.entries(pastByGroup).forEach(([gid, text]) => {
      const nums = (String(text || '').match(/\d+/g) || [])
      nums.forEach((n) => {
        const sid = numToSid[String(n)]
        if (!sid) { missNums.push(n); return }
        const cur = students[sid]?.groupId
        if (cur && cur !== gid) {
          updates[`rooms/${roomCode}/groupHistory/${sid}/seed_${gid}`] = { from: gid, to: cur, at: Date.now(), cutoff: Number(pastCutoff), seeded: true }
          count++
        }
      })
    })
    const missLine = missNums.length ? ` · ⚠️ 번호 못 찾음: ${[...new Set(missNums)].join(', ')}` : ''
    if (!Object.keys(updates).length) {
      setPastSeedMsg(`기록할 모둠 변경이 없습니다(이미 같은 모둠이거나 입력 없음).${missLine}`)
      return
    }
    try {
      await update(ref(database), updates)
      setPastSeedMsg(`✅ ${count}명 이전 모둠 기록 완료.${missLine}`)
    } catch (err) {
      setPastSeedMsg(`기록 실패: ${err.message}`)
    }
  }
  
  // 제출물 데이터 구독 (상세 보기용)
  const [articles, setArticles] = useState({})
  const [posters, setPosters] = useState({})
  const [reflections, setReflections] = useState({})
  const [links, setLinks] = useState({})
  const [candidatesMap, setCandidatesMap] = useState({})   // 후보 등록(등록 당시 모둠 단서)
  const [billsMap, setBillsMap] = useState({})             // 법안(제안 모둠 단서)
  const [policiesMap, setPoliciesMap] = useState({})       // 정책(제안 모둠 단서)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'candidates', (d) => setCandidatesMap(d || {})),
      subscribe(roomCode, 'bills', (d) => setBillsMap(d || {})),
      subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !viewingSid) return
    const subs = [
      subscribe(roomCode, 'articles', (d) => setArticles(d || {})),
      subscribe(roomCode, 'posters', (d) => setPosters(d || {})),
      subscribe(roomCode, 'reflections', (d) => setReflections(d || {})),
      subscribe(roomCode, 'links', (d) => setLinks(d || {})),
    ]
    return () => subs.forEach(u => u?.())
  }, [roomCode, viewingSid])

  // 서버 데이터가 변경되었을 때(다른 곳에서 저장 등) 로컬 상태 동기화
  useEffect(() => {
    // 사용자가 로컬에서 편집 중일 때는 서버 데이터가 바뀌어도 덮어쓰지 않고 보호합니다.
    if (!isDirty) {
      setLocalAssignedSlots(v.assignedSlots || {})
    }
  }, [v.assignedSlots, isDirty])

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localAssignedSlots) !== JSON.stringify(v.assignedSlots || {})
  }, [localAssignedSlots, v.assignedSlots])

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (assigningNumber === null) return
    const handler = () => setAssigningNumber(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [assigningNumber])

  // [Antigravity] DND 관련 핸들러
  const handleDragStart = (e, type, payload) => {
    e.dataTransfer.setData('ag-dnd-type', type)
    e.dataTransfer.setData('ag-dnd-payload', JSON.stringify(payload))
    e.currentTarget.style.opacity = '0.4'
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnSlot = (e, number) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('ag-dnd-type')
    const payloadRaw = e.dataTransfer.getData('ag-dnd-payload')
    if (!type || !payloadRaw) return

    const payload = JSON.parse(payloadRaw)
    if (type === 'group') {
      // 그룹을 슬롯에 드롭 -> 해당 번호에 그룹 지정
      setSlotLocal(number, payload.id)
    }
  }

  const handleDropOnGroup = (e, topicId) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('ag-dnd-type')
    const payloadRaw = e.dataTransfer.getData('ag-dnd-payload')
    if (!type || !payloadRaw) return

    const payload = JSON.parse(payloadRaw)
    if (type === 'student') {
      // 학생을 그룹에 드롭 -> 해당 학생 번호에 그룹 지정
      setSlotLocal(payload.number, topicId)
    }
  }

  const setMode = (mode) => onChange({ ...v, assignmentMode: mode })
  const setMax = (n) =>
    onChange({ ...v, maxPerGroup: Math.max(1, Math.min(8, Number(n) || 4)) })
  const setLinksOpen = (open) => onChange({ ...v, linksOpen: open })
  const setClassSize = (n) => {
    const next = Math.max(1, Math.min(40, Number(n) || 24))
    // 학급 인원이 줄어들면 그 위 번호의 배정 슬롯은 정리
    const slots = { ...(v.assignedSlots || {}) }
    for (const num of Object.keys(slots)) {
      if (Number(num) > next) delete slots[num]
    }
    onChange({ ...v, classSize: next, assignedSlots: slots })
  }

  const updateTopic = async (id, partial) => {
    // 1. Config 업데이트
    // 1. 설정 데이터(config) 업데이트
    const nextTopics = { ...v.topics, [id]: { ...v.topics[id], ...partial } }
    onChange({ ...v, topics: nextTopics })

    // 2. 실제 그룹 데이터(groups)와 즉시 동기화 (대시보드 등에서 즉시 반영되도록)
    if (roomCode) {
      const updates = {}
      if (partial.name) updates[`rooms/${roomCode}/groups/${id}/name`] = partial.name
      if (partial.emoji) updates[`rooms/${roomCode}/groups/${id}/emoji`] = partial.emoji
      if (partial.color) updates[`rooms/${roomCode}/groups/${id}/color`] = partial.color
      
      if (Object.keys(updates).length > 0) {
        try {
          update(ref(database), updates) // 비동기 대기 없이 즉시 시도
          console.log(`[Sync] Group ${id} updated in groups branch.`)
        } catch (err) {
          console.error('[Sync] Failed to sync group name:', err)
        }
      }
    }
  }

  const startEditTopic = (id, t) => {
    setEditingTopicId(id)
    setLocalTopicName(t.name)
    setLocalTopicEmoji(t.emoji || '')
  }

  const saveTopicEdit = (id) => {
    if (!localTopicName.trim()) {
      alert('이름을 입력해 주세요.')
      return
    }
    updateTopic(id, { name: localTopicName.trim(), emoji: localTopicEmoji.trim() })
    setEditingTopicId(null)
  }

  const removeTopic = (id) => {
    if (!confirm(`'${v.topics[id]?.name}' 토픽을 삭제할까요?`)) return
    const { [id]: _, ...rest } = v.topics
    // 해당 토픽으로 배정된 슬롯도 정리
    const slots = { ...(v.assignedSlots || {}) }
    for (const num of Object.keys(slots)) {
      if (slots[num] === id) delete slots[num]
    }
    onChange({ ...v, topics: rest, assignedSlots: slots })
  }

  const addTopic = () => {
    const id = `topic_${Date.now().toString(36).slice(-4)}`
    const newTopic = { id, name: '새 단체', emoji: '✨', color: 'indigo' }
    
    // 1. 설정 데이터 업데이트
    onChange({
      ...v,
      topics: { ...v.topics, [id]: newTopic },
    })

    // 2. 실제 그룹 데이터 초기화
    if (roomCode) {
      update(ref(database), {
        [`rooms/${roomCode}/groups/${id}`]: {
          name: newTopic.name,
          emoji: newTopic.emoji,
          color: newTopic.color,
          trustScore: 0
        }
      }).catch(err => console.error('[Sync] Failed to init group:', err))
    }
  }

  const resetToDefault = () => {
    if (!confirm('기본 6대 시민단체로 되돌릴까요? 현재 설정이 사라집니다.')) return
    onChange({ ...v, topics: DEFAULT_TOPICS, assignedSlots: {} })
  }

  // [Antigravity] 배정표 로컬 업데이트 (중복 배정 허용)
  const setSlotLocal = (number, topicId, isRemove = false) => {
    setIsDirty(true)
    const next = { ...localAssignedSlots }
    const current = next[number]
    
    // 배열로 표준화
    let gids = []
    if (Array.isArray(current)) gids = [...current]
    else if (current && typeof current === 'object') gids = Object.values(current)
    else if (current) gids = [current]
    
    if (isRemove) {
      gids = gids.filter(id => id !== topicId)
    } else {
      if (topicId && !gids.includes(topicId)) {
        gids.push(topicId)
      }
    }
    
    next[number] = gids.length > 0 ? gids : null
    setLocalAssignedSlots(next)
  }

  const saveAssignments = async () => {
    // 1. 설정 저장 (assignedSlots)
    onChange({ ...v, assignedSlots: localAssignedSlots })

    // 2. [Antigravity] 번호별 지정 모드인 경우, 현재 학생들의 groupId도 강제 동기화
    if (v.assignmentMode === 'assigned' && roomCode) {
      const updates = {}
      const studentEntries = Object.entries(students)

      for (const [sid, s] of studentEntries) {
        const num = s.number
        const oldGid = s.groupId // 기존은 단일 문자열
        
        const rawLocal = localAssignedSlots[num]
        const newGids = Array.isArray(rawLocal) ? rawLocal : (rawLocal ? [rawLocal] : [])
        
        // 시뮬레이션 호환성을 위해 첫 번째 그룹을 메인 groupId로 설정
        const primaryGid = newGids[0] || null

        if (oldGid !== primaryGid) {
          // 메인 그룹 변경 시 멤버십 관리 (단순화: 여기서는 primary만 관리하거나 전체 관리)
          // 전체 관리를 위해 모든 그룹의 멤버십을 업데이트하는 것이 안전함
          updates[`rooms/${roomCode}/students/${sid}/groupId`] = primaryGid
          // ── 모둠 변경 이력 기록 (4단계 발자취가 '그때 모둠'을 정확히 판정하도록) ──
          const at = Date.now()
          // 라이브 변경: 현재 여정 시작을 컷오프로(1→10,2→20,3→31,4→40). 그 이전 단계는 이전 모둠.
          const phaseCutoff = { 1: 10, 2: 20, 3: 31, 4: 40 }[Number(currentPhase) || 1] || 10
          updates[`rooms/${roomCode}/groupHistory/${sid}/h_${at}`] = {
            from: oldGid || null,
            to: primaryGid || null,
            at,
            cutoff: phaseCutoff,
          }
        }

        // 전체 멤버십 동기화 (모든 그룹 순회)
        // 주의: 이 방식은 학생이 속하지 않은 '다른' 그룹들에서 학생을 제거하는 로직이 필요함
        // 여기선 단순하게 v.topics 전체를 돌며 포함 여부에 따라 null/true 설정
        Object.keys(v.topics || {}).forEach(tid => {
          const isMember = newGids.includes(tid)
          updates[`rooms/${roomCode}/groups/${tid}/members/${sid}`] = isMember ? true : null
        })
      }

      if (Object.keys(updates).length > 0) {
        try {
          await update(ref(database), updates)
          console.log('[Sync] Students synchronized with multiple group memberships.')
        } catch (err) {
          console.error('[Sync] Failed to synchronize students:', err)
        }
      }
      setIsDirty(false) // 저장 완료 후 다시 동기화 허용
    } else {
      setIsDirty(false) // 모드 상관없이 저장 버튼 누르면 편집 상태 해제
    }
  }

  const resetAssignments = () => {
    if (confirm('수정한 배정표를 취소하고 원래대로 되돌릴까요?')) {
      setLocalAssignedSlots(v.assignedSlots || {})
      setIsDirty(false) // 초기화 시 다시 동기화 허용
    }
  }

  return (
    <div className="space-y-6">
      {/* ⓪ 학급/나라 이름 설정 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-indigo-500 h-full"></div>
        <h3 className="font-black text-indigo-800 mb-3 flex items-center gap-2">
          <span className="text-xl">🌍</span> 학급/나라 이름 설정
        </h3>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-indigo-400 ml-1">우리가 만든 나라 이름</label>
          <input
            type="text"
            value={v.countryName || ''}
            onChange={(e) => onChange({ ...v, countryName: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') e.preventDefault()
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="나라 이름을 입력해 주세요 (예: 배곧민국, 햇살마을)"
            className="w-full text-sm p-3.5 rounded-2xl border-2 border-indigo-50 bg-indigo-50/30 focus:bg-white focus:border-indigo-400 focus:outline-none transition-all font-bold"
          />
        </div>
      </section>

      {/* ① 학급 인원과 배정 방식 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-indigo-500 h-full"></div>
        <h3 className="font-black text-indigo-800 mb-4 flex items-center gap-2">
          <span className="text-xl">👥</span> 학급 인원과 배정 방식
        </h3>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 ml-1">전체 학급 인원</label>
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border-2 border-gray-100">
              <input
                type="number"
                value={classSize}
                onChange={(e) => setClassSize(e.target.value)}
                min={1} max={40}
                className="w-16 px-2 py-1 rounded-xl border-2 border-white bg-white text-center font-black text-indigo-600 shadow-sm"
              />
              <span className="text-xs font-bold text-gray-500">명 (최대 40명)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 ml-1">모둠당 최대 인원</label>
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border-2 border-gray-100">
              <input
                type="number"
                value={v.maxPerGroup}
                onChange={(e) => setMax(e.target.value)}
                min={1} max={8}
                className="w-16 px-2 py-1 rounded-xl border-2 border-white bg-white text-center font-black text-indigo-600 shadow-sm"
              />
              <span className="text-xs font-bold text-gray-500">명 (권장 4~5명)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('free')}
            className={`group p-4 rounded-2xl border-2 text-left transition-all ${
              v.assignmentMode === 'free'
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-100 hover:border-indigo-200 bg-gray-50/50'
            }`}
          >
            <div className={`font-black text-sm mb-1 ${v.assignmentMode === 'free' ? 'text-indigo-700' : 'text-gray-600'}`}>🕊️ 자유 합류 모드</div>
            <div className="text-[10px] text-gray-400 font-bold leading-tight">학생들이 원하는 단체에 직접 합류합니다.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('assigned')}
            className={`group p-4 rounded-2xl border-2 text-left transition-all ${
              v.assignmentMode === 'assigned'
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-100 hover:border-indigo-200 bg-gray-50/50'
            }`}
          >
            <div className={`font-black text-sm mb-1 ${v.assignmentMode === 'assigned' ? 'text-indigo-700' : 'text-gray-600'}`}>🎯 번호별 지정 모드</div>
            <div className="text-[10px] text-gray-400 font-bold leading-tight">선생님이 명찰을 드래그하여 미리 배정합니다.</div>
          </button>
        </div>
      </section>

      {/* ② 시민단체 종류 및 배정 드롭존 */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-indigo-800 flex items-center gap-2">
            <span className="text-xl">🏢</span> 시민단체 종류 및 배정
          </h3>
          <div className="flex gap-2">
            <button type="button" onClick={resetToDefault} className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">기본 복원</button>
            <button type="button" onClick={addTopic} className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all">+ 단체 추가</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topicEntries.map(([id, t]) => {
            const isEditing = editingTopicId === id
            const assignedHere = Object.entries(localAssignedSlots)
              .filter(([, val]) => {
                if (Array.isArray(val)) return val.includes(id)
                if (val && typeof val === 'object') return Object.values(val).includes(id)
                return val === id
              })
              .map(([num]) => Number(num))
              .sort((a, b) => a - b)

            return (
              <div
                key={id}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, 'group', { id })}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnGroup(e, id)}
                className={`flex flex-col p-4 rounded-3xl border-2 transition-all relative group/card ${topicBg(t.color)} ${
                  isEditing ? 'ring-4 ring-indigo-200 shadow-xl z-10 scale-105' : 'border-gray-100 hover:border-indigo-400 shadow-sm min-h-[160px]'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input type="text" value={localTopicEmoji} onChange={(e) => setLocalTopicEmoji(e.target.value)} placeholder="🎨" className="w-12 text-center bg-white rounded-xl border-2 border-indigo-100 px-1 py-2 text-xl" maxLength={2} />
                      <input type="text" value={localTopicName} onChange={(e) => setLocalTopicName(e.target.value)} placeholder="단체 이름" className="flex-1 bg-white rounded-xl border-2 border-indigo-100 px-3 py-2 text-sm font-black" autoFocus />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingTopicId(null)} className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gray-100 text-gray-500">취소</button>
                      <button type="button" onClick={() => saveTopicEdit(id)} className="px-4 py-1.5 text-xs font-black rounded-xl bg-indigo-600 text-white shadow-md">저장</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl bg-white/50 w-10 h-10 flex items-center justify-center rounded-2xl shadow-inner">{t.emoji}</span>
                        <div>
                          <div className="text-sm font-black text-gray-800 leading-tight">{t.name}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter opacity-70">모둠 정원: {assignedHere.length} / {v.maxPerGroup}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" onClick={() => startEditTopic(id, t)} className="p-1.5 rounded-lg bg-white/40 text-indigo-600 hover:bg-white text-[10px] font-black transition-all">수정</button>
                        <button type="button" onClick={() => removeTopic(id)} className="p-1.5 rounded-lg bg-white/40 text-red-400 hover:text-red-600 text-[10px] transition-all">삭제</button>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        {assignedHere.length === 0 ? (
                          <div className="w-full py-4 border-2 border-dashed border-black/5 rounded-2xl flex items-center justify-center text-[10px] font-bold text-gray-400 italic">
                            명찰을 여기에 드래그하세요
                          </div>
                        ) : (
                          assignedHere.map((num) => {
                            const student = studentsByNumber[num]
                            return (
                              <div 
                                key={num} 
                                className="group/name relative px-2 py-1 bg-white/80 rounded-lg border border-black/5 shadow-sm text-[10px] font-bold flex items-center gap-1 hover:bg-white transition-colors cursor-pointer"
                                onClick={() => student?.id && setViewingSid(student.id)}
                              >
                                <span className="text-indigo-600">{num}</span>
                                <span className="truncate max-w-[60px]">{student?.nickname || student?.name || '...'}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSlotLocal(num, id, true); }}
                                  className="ml-1 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ③ 학생 명찰 리스트 (배정 모드일 때만 표시) */}
      {v.assignmentMode === 'assigned' && (
        <section className="bg-gray-100/50 p-6 rounded-[40px] border-4 border-dashed border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-gray-700 flex items-center gap-2">
                <span className="text-xl">🏷️</span> 학생 명찰 리스트
              </h3>
              <p className="text-[10px] font-bold text-gray-400 ml-7">명찰을 클릭하면 시민단체를 선택할 수 있어요. 드래그도 됩니다!</p>
            </div>
            
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <button type="button" onClick={resetAssignments} className="px-4 py-2 rounded-2xl bg-white text-gray-500 font-black text-xs border-2 border-gray-100 hover:bg-gray-50 shadow-sm transition-all">초기화</button>
              )}
              <button
                type="button"
                onClick={saveAssignments}
                disabled={!hasUnsavedChanges}
                className={`px-6 py-2 rounded-2xl font-black text-xs shadow-lg transition-all ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:scale-105 active:scale-95'
                    : 'bg-gray-300 text-gray-500 opacity-50 cursor-not-allowed'
                }`}
              >
                {hasUnsavedChanges ? '💾 배정 결과 저장하기' : '✨ 저장 완료'}
              </button>
            </div>
          </div>

          {/* 과거 모둠 편성 1회 기록 (발자취 보정) — 모둠 컨테이너별 직접 입력 */}
          <details className="mb-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-3">
            <summary className="cursor-pointer text-xs font-black text-violet-800">🕓 이전 모둠 편성 기록(과거 보정) — 모둠이 중간에 바뀐 반만</summary>
            <p className="text-[11px] text-violet-700 mt-2 leading-relaxed">
              아래는 <b>현재 모둠 목록</b>입니다(컨테이너는 그대로 유지됨). 각 모둠 칸에 <b>그 모둠이 '이전에' 가지고 있던 학생 번호</b>를 적고 [이전 편성 기록]을 누르세요.
              그러면 4단계 발자취가 그때 모둠 활동까지 정확히 모읍니다. <b>기존 활동 데이터는 바뀌지 않습니다.</b>
            </p>

            {/* 후보 등록 기록 — 등록 당시(2여정) 모둠 ↔ 후보 학생. 이전 편성 입력에 참고. */}
            {Object.keys(candidatesMap).length > 0 && (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                <p className="text-[11px] font-black text-emerald-800 mb-1">🗳️ 후보 등록 기록(2여정 당시 모둠) — 참고용</p>
                <ul className="text-[11px] text-emerald-900 space-y-0.5">
                  {Object.entries(candidatesMap).map(([gid, c]) => {
                    const gName = groups?.[gid]?.name || v.topics?.[gid]?.name || gid
                    return (
                      <li key={gid} className="flex items-center gap-1.5">
                        <span className="font-bold">{gName}</span>
                        <span className="text-emerald-400 font-mono text-[9px]">({gid})</span>
                        <span>→</span>
                        <span className="font-black">{c?.leaderNumber != null ? `${c.leaderNumber}번 ` : ''}{c?.leaderNickname || c?.candidateName || '후보'}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="text-[10px] text-emerald-600 mt-1">※ 이 학생이 지금 다른 모둠이면, 위 모둠 칸에 그 번호를 넣어 '이전 모둠'으로 기록하세요.</p>
              </div>
            )}

            {/* 법안/정책 등록 기록 — 제안 모둠(gid) 단서 */}
            {(Object.keys(billsMap).length > 0 || Object.keys(policiesMap).length > 0) && (
              <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/60 p-2.5">
                <p className="text-[11px] font-black text-sky-800 mb-1">📜 법안·정책 등록 기록(제안 모둠) — 참고용</p>
                <ul className="text-[11px] text-sky-900 space-y-0.5">
                  {Object.entries(billsMap).map(([bid, b]) => {
                    const gid = b?.proposerGroupId
                    const gName = groups?.[gid]?.name || v.topics?.[gid]?.name || gid || '미상'
                    return (
                      <li key={`b_${bid}`} className="flex items-center gap-1.5">
                        <span>🏛️</span>
                        <span className="font-black truncate max-w-[180px]">{b?.title || '법안'}</span>
                        <span>→</span>
                        <span className="font-bold">{gName}</span>
                        <span className="text-sky-400 font-mono text-[9px]">({gid || '?'})</span>
                      </li>
                    )
                  })}
                  {Object.entries(policiesMap).map(([pid, p]) => {
                    const gid = p?.proposerGroupId || pid
                    const gName = groups?.[gid]?.name || v.topics?.[gid]?.name || gid || '미상'
                    return (
                      <li key={`p_${pid}`} className="flex items-center gap-1.5">
                        <span>🏢</span>
                        <span className="font-black truncate max-w-[180px]">{p?.policyFields?.title || p?.policyName || '정책'}</span>
                        <span>→</span>
                        <span className="font-bold">{gName}</span>
                        <span className="text-sky-400 font-mono text-[9px]">({gid || '?'})</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {(() => {
                // 현재 토픽 + 실제 그룹 노드(옛/이름 바뀐 모둠 포함) 합집합, gid 중복 제거
                const seen = new Set()
                const list = []
                topicEntries.forEach(([gid, t]) => { if (!seen.has(gid)) { seen.add(gid); list.push({ gid, name: t?.name || gid, emoji: t?.emoji || '', extra: false }) } })
                Object.entries(groups || {}).forEach(([gid, g]) => { if (!seen.has(gid)) { seen.add(gid); list.push({ gid, name: g?.name || gid, emoji: g?.emoji || '', extra: true }) } })
                return list.map((c, i) => (
                  <label key={c.gid} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${c.extra ? 'bg-amber-50 border-amber-200' : 'bg-white border-violet-150'}`}>
                    <span className="shrink-0 w-40 truncate leading-tight">
                      <span className="text-xs font-black text-slate-700 block">
                        {c.extra ? '구' : `${i + 1}`}모둠 ({c.emoji}{c.name})
                      </span>
                      <span className="text-[9px] font-mono text-gray-400 block">gid: {c.gid}</span>
                    </span>
                    <input
                      type="text"
                      value={pastByGroup[c.gid] || ''}
                      onChange={(e) => setPastByGroup((prev) => ({ ...prev, [c.gid]: e.target.value }))}
                      placeholder="예: 11,18,24,23"
                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg border border-gray-200 font-mono bg-white"
                    />
                  </label>
                ))
              })()}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <label className="text-[11px] font-black text-violet-800">변경 경계:</label>
              <select
                value={pastCutoff}
                onChange={(e) => setPastCutoff(Number(e.target.value))}
                className="text-[11px] px-2 py-1 rounded-lg border border-violet-200 bg-white font-bold"
              >
                {CUTOFF_OPTIONS.map((o) => (
                  <option key={o.rank} value={o.rank}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={seedPastFormation}
                className="px-4 py-1.5 rounded-xl bg-violet-600 text-white font-black text-xs hover:bg-violet-700 transition"
              >
                이전 편성 기록
              </button>
              {pastSeedMsg && <span className="text-[11px] font-bold text-violet-800 w-full">{pastSeedMsg}</span>}
            </div>
            <p className="text-[10px] text-violet-600 mt-1">
              💡 "변경 경계"는 <b>이 단계부터 현재 모둠</b>이라는 뜻 — 그 이전 단계 활동은 이전 모둠 것으로 정리됩니다. (예: 사법부부터 바뀌었으면 입법·행정은 이전 모둠)
            </p>
          </details>

          <div className="flex flex-wrap gap-2.5">
            {Array.from({ length: classSize }, (_, i) => i + 1).map((num) => {
              const student = studentsByNumber[num]
              const rawLocal = localAssignedSlots[num]
              const assignedTopicIds = Array.isArray(rawLocal) ? rawLocal : (rawLocal ? [rawLocal] : [])
              const isAssigned = assignedTopicIds.length > 0

              return (
                <div
                  key={num}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, 'student', { number: num })}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSlot(e, num)}
                  onClick={(e) => { e.stopPropagation(); setAssigningNumber(prev => prev === num ? null : num) }}
                  className={`
                    px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer relative group/tag select-none
                    ${assigningNumber === num
                      ? 'bg-indigo-50 border-indigo-400 shadow-lg ring-2 ring-indigo-200'
                      : isAssigned
                        ? 'bg-white border-indigo-400 opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'
                        : 'bg-white border-gray-100 shadow-sm hover:border-indigo-400 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <span className="text-indigo-500 whitespace-nowrap">{num}.</span>
                    <span className="text-gray-800 truncate max-w-[80px]">
                      {student?.nickname || student?.name || '...'}
                    </span>
                    {isAssigned && (
                      <div className="ml-1 flex -space-x-1">
                        {assignedTopicIds.map(tid => (
                          <span key={tid} className="text-[12px]">{v.topics?.[tid]?.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 클릭 드롭다운 — 시민단체 선택 */}
                  {assigningNumber === num && (
                    <div
                      className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-1.5 min-w-[160px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider px-2 pt-1 pb-1.5">
                        시민단체 배정
                      </p>
                      {topicEntries.map(([id, topic]) => {
                        const isGroupAssigned = assignedTopicIds.includes(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSlotLocal(num, id, isGroupAssigned) }}
                            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                              isGroupAssigned
                                ? 'bg-indigo-100 text-indigo-800 hover:bg-red-50 hover:text-red-700'
                                : 'text-gray-700 hover:bg-indigo-50'
                            }`}
                          >
                            <span className="text-base leading-none shrink-0">{topic.emoji}</span>
                            <span className="flex-1 truncate">{topic.name}</span>
                            {isGroupAssigned && <span className="shrink-0 text-indigo-500 text-[10px]">✓</span>}
                          </button>
                        )
                      })}
                      {isAssigned && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsDirty(true)
                            setLocalAssignedSlots(prev => ({ ...prev, [num]: null }))
                            setAssigningNumber(null)
                          }}
                          className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 mt-0.5 border-t border-gray-100 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50"
                        >
                          <span className="text-[10px]">✕</span> 배정 전체 해제
                        </button>
                      )}
                      {student?.id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setViewingSid(student.id); setAssigningNumber(null) }}
                          className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold text-gray-400 hover:bg-gray-50"
                        >
                          학생 정보 보기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {hasUnsavedChanges && (
            <p className="mt-4 text-[11px] font-black text-amber-600 animate-pulse text-center">
              ⚠️ 배정표에 변화가 있습니다. 오른쪽 상단의 [배정 결과 저장하기] 버튼을 꼭 눌러주세요!
            </p>
          )}
        </section>
      )}

      {/* ②-2 시스템 활성화 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="font-black text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-xl">⚙️</span> 시스템 활성화 설정
        </h3>
        <div className="space-y-3">
          <div className="bg-amber-50/50 rounded-2xl overflow-hidden border-2 border-amber-100 transition-colors focus-within:border-amber-300">
            <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50">
              <div>
                <div className="text-sm font-black text-amber-900">📜 국민청원 시스템</div>
                <div className="text-[10px] text-amber-700 font-bold">시민단체 결합 전 문제 발굴 단계. 학생 '청원 쓰기' 탭 활성화.</div>
              </div>
              <input
                type="checkbox"
                checked={v.petitionEnabled !== false}
                onChange={(e) => onChange({ ...v, petitionEnabled: e.target.checked })}
                className="w-5 h-5 accent-amber-600 rounded-lg"
              />
            </label>
            {v.petitionEnabled !== false && (
              <div className="px-4 pb-4 pt-1">
                <PetitionPrefixEditor
                  value={v.petitionConfig?.prefixOptions}
                  onChange={(arr) => onChange({ ...v, petitionConfig: { ...(v.petitionConfig || {}), prefixOptions: arr } })}
                />
              </div>
            )}
          </div>

          <label className="flex items-center justify-between gap-3 px-4 py-3 bg-violet-50/50 rounded-2xl border-2 border-violet-100 cursor-pointer hover:bg-violet-50">
            <div>
              <div className="text-sm font-black text-violet-900">🎙️ 토론 도구</div>
              <div className="text-[10px] text-violet-700 font-bold">토론 준비카드, 발언 평가, 여론조사 시스템을 활성화합니다.</div>
            </div>
            <input
              type="checkbox"
              checked={v.debateToolEnabled !== false}
              onChange={(e) => onChange({ ...v, debateToolEnabled: e.target.checked })}
              className="w-5 h-5 accent-violet-600 rounded-lg"
            />
          </label>
        </div>
      </section>

      {/* ②-3 선거 등수별 직책 */}
      <ElectionRoleEditor
        value={v.electionRoles}
        onChange={(arr) => onChange({ ...v, electionRoles: arr })}
      />

      {/* ③ 외부 링크 제출 받기 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-emerald-100 shadow-sm">
        <h3 className="font-black text-emerald-800 mb-1 flex items-center gap-2">
          <span className="text-xl">🔗</span> 외부 링크 제출 받기
        </h3>
        <p className="text-[10px] font-bold text-gray-400 mb-4 ml-7">유튜브나 캔바 링크를 학생들에게 제출받을지 결정합니다.</p>
        <div className="flex items-center gap-4 ml-7">
          <button
            type="button"
            onClick={() => setLinksOpen(!v.linksOpen)}
            className={`px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm ${
              v.linksOpen ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {v.linksOpen ? '✅ 링크 받기 켜짐' : '⏸️ 링크 받기 닫힘'}
          </button>
          <span className="text-xs font-bold text-gray-500">{v.linksOpen ? '학생 화면에 제출 탭이 보입니다.' : '학생 화면에서 탭이 숨겨집니다.'}</span>
        </div>
      </section>

      {/* ④ 영상 업로드 안내 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2">
          <span className="text-xl">📁</span> 영상 업로드 안내 링크
        </h3>
        <p className="text-[10px] font-bold text-gray-400 mb-4 ml-7">학생들이 대용량 파일을 올릴 외부 저장소(구글 드라이브 등)를 안내합니다.</p>
        <div className="ml-7 space-y-3">
          <button
            type="button"
            onClick={() => onChange({ ...v, videoUploadHint: { ...(v.videoUploadHint || {}), enabled: !v.videoUploadHint?.enabled } })}
            className={`px-5 py-2 rounded-2xl text-xs font-black transition-all ${
              v.videoUploadHint?.enabled ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {v.videoUploadHint?.enabled ? '✅ 안내 활성화' : '⏸️ 안내 숨김'}
          </button>
          {v.videoUploadHint?.enabled && (
            <div className="grid gap-2 bg-gray-50 p-4 rounded-2xl border-2 border-gray-100">
              <input type="text" value={v.videoUploadHint?.label || ''} onChange={(e) => onChange({ ...v, videoUploadHint: { ...(v.videoUploadHint || {}), label: e.target.value } })} placeholder="안내 이름 (예: 학급 구글 드라이브)" className="text-xs p-2.5 rounded-xl border-2 border-white bg-white font-bold focus:border-indigo-200 focus:outline-none" />
              <input type="url" value={v.videoUploadHint?.url || ''} onChange={(e) => onChange({ ...v, videoUploadHint: { ...(v.videoUploadHint || {}), url: e.target.value } })} placeholder="https://drive.google.com/..." className="text-xs p-2.5 rounded-xl border-2 border-white bg-white font-bold focus:border-indigo-200 focus:outline-none" />
            </div>
          )}
        </div>
      </section>

      {/* ⑤ 자동 승인 설정 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="font-black text-gray-800 mb-4">🔔 자동 승인 설정</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: '기사 자동 승인', key: 'autoApproveArticles', icon: '📝' },
            { label: '영상 자동 승인', key: 'autoApproveVideos', icon: '📽️' },
            { label: '청원 자동 승인', key: 'petitionConfig.autoApprove', icon: '📣' },
          ].map((item) => {
            let active = false
            if (item.key.includes('.')) {
              const [p1, p2] = item.key.split('.')
              active = v[p1]?.[p2]
            } else {
              active = v[item.key]
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key.includes('.')) {
                    const [p1, p2] = item.key.split('.')
                    onChange({ ...v, [p1]: { ...(v[p1] || {}), [p2]: !active } })
                  } else {
                    onChange({ ...v, [item.key]: !active })
                  }
                }}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                  active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-50 bg-gray-50 text-gray-400'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-black leading-tight">{item.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ⑤-b 기사 댓글 평가 좋아요 기준 점수 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-blue-50 shadow-sm">
        <h3 className="font-black text-blue-900 mb-1 flex items-center gap-2">
          <span className="text-xl">👍</span> 기사 댓글 평가 — 좋아요 기준 점수
        </h3>
        <p className="text-[11px] text-gray-500 mb-4">
          기사에 달린 댓글의 3축 평가(정확성·공익성·이해도) 합산 점수가 기준을 넘으면 좋아요 배지가 붙습니다. 각 축은 최대 3점, 합산 최대 9점.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👍</span>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">좋아요 기준 (이상)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={9}
                  step={1}
                  value={v.articleRating?.likeThreshold ?? 6}
                  onChange={(e) => onChange({
                    ...v,
                    articleRating: { ...(v.articleRating || {}), likeThreshold: Math.max(1, Math.min(9, Number(e.target.value) || 6)) }
                  })}
                  className="w-16 px-2 py-1.5 text-sm text-center border border-blue-200 rounded-lg font-bold"
                />
                <span className="text-xs text-gray-500">점 이상 (최대 9점)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">👍👍</span>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">좋아요² 기준 (이상)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={9}
                  step={1}
                  value={v.articleRating?.superLikeThreshold ?? 9}
                  onChange={(e) => onChange({
                    ...v,
                    articleRating: { ...(v.articleRating || {}), superLikeThreshold: Math.max(1, Math.min(9, Number(e.target.value) || 9)) }
                  })}
                  className="w-16 px-2 py-1.5 text-sm text-center border border-pink-200 rounded-lg font-bold"
                />
                <span className="text-xs text-gray-500">점 이상 (최대 9점)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑥ Phase 1 시민활동 활성화 설정 */}
      <section className="bg-white p-5 rounded-3xl border-2 border-indigo-50 shadow-sm">
        <h3 className="font-black text-indigo-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🎨</span> Phase 1 활동 종류 설정
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'poster',  label: '포스터', icon: '🎨' },
            { id: 'essay',   label: '주장글', icon: '✍️' },
            { id: 'news',    label: '신문기사', icon: '📰' },
            { id: 'video',   label: '영상/캔바', icon: '🎬' },
            { id: 'article', label: '취재기사', icon: '📋' },
          ].map((m) => {
            const isActive = v.phase1Activities?.[m.id] !== false
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const next = { ...(v.phase1Activities || { poster: true, essay: true, news: true, video: true, article: true }) }
                  next[m.id] = !isActive
                  onChange({ ...v, phase1Activities: next })
                }}
                className={`px-4 py-2.5 rounded-2xl border-2 transition-all font-black text-xs flex items-center gap-2 ${
                  isActive ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm' : 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ⑦ 페이즈 2 전환 안내 설정 */}
      <section className="bg-indigo-900 p-6 rounded-[40px] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="font-black text-lg flex items-center gap-2">🚀 페이즈 2 전환 안내</h3>
          <button
            type="button"
            onClick={() => {
              const next = { ...(v.guidance || { showPhase2Transition: true, phase2TransitionText: "" }) }
              next.showPhase2Transition = !next.showPhase2Transition
              onChange({ ...v, guidance: next })
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${
              v.guidance?.showPhase2Transition !== false ? 'bg-white text-indigo-900' : 'bg-white/20 text-white/50'
            }`}
          >
            {v.guidance?.showPhase2Transition !== false ? '활성화' : '비활성'}
          </button>
        </div>
        {v.guidance?.showPhase2Transition !== false && (
          <textarea
            value={v.guidance?.phase2TransitionText || ''}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const next = { ...(v.guidance || { showPhase2Transition: true, phase2TransitionText: "" }) }
              next.phase2TransitionText = e.target.value
              onChange({ ...v, guidance: next })
            }}
            className="w-full text-sm p-4 rounded-3xl bg-white/10 border-2 border-white/20 focus:border-white/40 focus:outline-none transition-all min-h-[120px] font-bold placeholder-white/30 text-white"
            placeholder="학생들에게 보여줄 안내 문구를 입력하세요..."
          />
        )}
      </section>


      {/* 하단 플로팅 저장 버튼 */}
      {hasUnsavedChanges && (
        <div className="sticky bottom-4 left-0 w-full flex justify-center z-50 pointer-events-none">
          <button
            type="button"
            onClick={saveAssignments}
            className="pointer-events-auto bg-amber-500 text-white px-10 py-4 rounded-full font-black shadow-2xl hover:bg-amber-600 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 animate-bounce"
          >
            <span>💾</span>
            배정 결과 최종 저장하기
          </button>
        </div>
      )}
      {/* 학생 활동 상세 보기 모달 [Antigravity] */}
      {viewingSid && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setViewingSid(null)}
          title={`${students[viewingSid]?.number}번 ${students[viewingSid]?.nickname} 학생의 제출물`}
          items={[
            ...Object.values(articles).filter(a => a.authorStudentId === viewingSid).map(a => ({ ...a, type: 'article' })),
            ...Object.values(posters).filter(p => p.authorStudentId === viewingSid).map(p => ({ ...p, type: 'poster' })),
            ...Object.values(reflections).filter(r => r.authorStudentId === viewingSid).map(r => ({ ...r, type: 'reflection' })),
            ...Object.values(links).filter(l => l.submitterStudentId === viewingSid).map(l => ({ ...l, type: 'link' })),
          ]}
          renderItem={(item) => {
            switch (item.type) {
              case 'article': return (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-500 uppercase">기사</p>
                  <p className="text-sm font-bold">{item.headline}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{item.body}</p>
                </div>
              )
              case 'poster': return (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-emerald-500 uppercase">포스터</p>
                  <PosterMedia poster={item} className="w-20 aspect-[4/3] rounded-lg overflow-hidden" imageClassName="w-20 rounded-lg" />
                </div>
              )
              case 'reflection': return (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-amber-500 uppercase">정리글</p>
                  <p className="text-xs text-slate-600 line-clamp-3">{item.body}</p>
                </div>
              )
              case 'link': return (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-500 uppercase">링크</p>
                  <p className="text-xs font-bold text-blue-700 truncate">{item.title || item.url}</p>
                </div>
              )
              default: return null
            }
          }}
        />
      )}
    </div>
  )
}

export default ClassroomConfigEditor
