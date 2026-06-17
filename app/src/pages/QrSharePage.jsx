import { useEffect, useState } from 'react'

/**
 * 학생 입장 QR — 새 창으로 띄우는 큰 디스플레이.
 *
 * URL: #/share?code=AB3C5K&className=6%ED%95%99%EB%85%84%209%EB%B0%98
 *
 * 화면 크기에 맞춰 QR이 자동으로 커진다(80vmin).
 */
// 앱이 실제 로드된 주소(해시·쿼리 제외) = QR 대상. 포크해서 어디에 배포하든 그 주소를 가리킨다.
// (서브경로/Cloudflare Pages 루트/임의 서브경로 모두 대응). VITE_APP_URL로 덮어쓰기 가능.
function resolveAppUrl() {
  if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL
  return window.location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '')
}
const APP_URL = resolveAppUrl()

function QrSharePage() {
  const url = APP_URL
  // useSearchParams 없이 hash query 파싱
  const [params, setParams] = useState(() => parseQuery())
  useEffect(() => {
    const onHash = () => setParams(parseQuery())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const code = params.get('code') || ''
  const className = params.get('className') || '학급'

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    url,
  )}&size=1000x1000&margin=20`

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <header className="text-center mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-indigo-800">
          {className}
        </h1>
        <p className="text-sm text-gray-500 mt-1">학생 입장 안내</p>
      </header>

      <img
        src={qrUrl}
        alt="학생 입장 QR"
        className="w-[80vmin] h-[80vmin] max-w-full max-h-[70vh] rounded-2xl border-8 border-indigo-100"
      />

      <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-2xl w-full">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">접속 주소</p>
          <p className="text-base sm:text-lg font-mono break-all mt-1">{url}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-700 uppercase tracking-wide">
            반 코드
          </p>
          <p className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-emerald-800 mt-1">
            {code}
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-500 text-center max-w-md">
        학생은 QR을 스캔해 접속하거나, 위 주소로 들어가서{' '}
        <strong>반 코드·번호·이름</strong>을 입력합니다.
        <br />
        창 크기를 조정하면 QR도 함께 커집니다.
      </p>
    </div>
  )
}

function parseQuery() {
  const hash = window.location.hash || ''
  const idx = hash.indexOf('?')
  if (idx < 0) return new URLSearchParams()
  return new URLSearchParams(hash.slice(idx + 1))
}

export default QrSharePage
