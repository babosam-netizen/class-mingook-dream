import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // 서브 경로 및 가상 호스트(루트 도메인) 양쪽에서 모두 동작하도록 상대 경로('./') 지정
  base: process.env.NODE_ENV === 'production' ? './' : '/',
})
