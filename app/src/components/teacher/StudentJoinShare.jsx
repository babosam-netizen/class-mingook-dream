import { useState } from 'react'
import useGameStore from '../../store/gameStore'

// 공유/QR 링크 = 앱이 실제 로드된 주소(해시 라우트·쿼리 제외). 포크해서 어디에 배포하든 그 주소를 가리킨다.
// (서브경로/Cloudflare Pages 루트/임의 서브경로 모두 대응). VITE_APP_URL로 덮어쓰기 가능.
function resolveAppUrl() {
  if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL
  return window.location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '')
}
const APP_URL = resolveAppUrl()

/**
 * 교사 대시보드 — 학생들에게 ‘반 코드 + 접속 URL + QR’을 한 번에 안내.
 *
 * QR은 외부 무료 API(qrserver.com)로 생성. 라이브러리 추가 불필요.
 */
function StudentJoinShare() {
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.className)
  const [open, setOpen] = useState(false)

  if (!roomCode) return null

  const url = APP_URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    url,
  )}&size=320x320&margin=10`

  const onCopy = () => {
    navigator.clipboard.writeText(url).then(
      () => alert(`복사됨:\n${url}`),
      () => prompt('이 주소를 복사해 주세요:', url),
    )
  }
  const onCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(
      () => alert(`반 코드 복사됨: ${roomCode}`),
      () => prompt('반 코드:', roomCode),
    )
  }
  const openLargeView = () => {
    window.open(`${APP_URL}#/__share?code=${roomCode}`, '_blank', 'width=900,height=700')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold hover:bg-emerald-200"
      >
        📱 학생 입장 안내 (QR + 코드)
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-emerald-800">
              학생 입장 안내
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {className || '학급'}
            </p>

            <div className="mt-4">
              <img
                src={qrUrl}
                alt="학생 입장 QR 코드"
                className="mx-auto rounded-lg border-4 border-emerald-100"
                width={280}
                height={280}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">접속 주소</p>
                <p className="text-sm font-mono break-all">{url}</p>
                <button
                  onClick={onCopy}
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                >
                  주소 복사
                </button>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">반 코드</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-emerald-800">
                  {roomCode}
                </p>
                <button
                  onClick={onCopyCode}
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                >
                  코드 복사
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              학생은 QR을 스캔해 접속하거나, 위 주소로 들어가서 반 코드·번호·이름을 입력합니다.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.open(qrUrl, '_blank')}
                className="flex-1 py-2 text-sm rounded-lg bg-white border hover:bg-gray-50"
              >
                QR 새 창으로 크게
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 text-sm rounded-lg bg-gray-800 text-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default StudentJoinShare
