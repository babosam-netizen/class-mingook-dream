/**
 * 로컬스토리지를 이용한 작성 중인 글 임시저장 유틸리티
 */
export const DraftSaver = {
  save: (key, data) => {
    try {
      const payload = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(`draft_${key}`, JSON.stringify(payload))
      return true
    } catch (e) {
      console.error('Failed to save draft:', e)
      return false
    }
  },

  load: (key) => {
    try {
      const raw = localStorage.getItem(`draft_${key}`)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (e) {
      console.error('Failed to load draft:', e)
      return null
    }
  },

  clear: (key) => {
    localStorage.removeItem(`draft_${key}`)
  }
}
