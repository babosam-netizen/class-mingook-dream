import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>앗! 화면을 그리는 중 오류가 발생했습니다. (백화현상 방지)</h1>
          <p style={{ marginBottom: '20px' }}>선생님, 이 화면을 캡처해서 개발자에게 전달해 주세요!</p>
          <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', overflow: 'auto', border: '1px solid #f87171' }}>
            <h2 style={{ fontWeight: 'bold', marginBottom: '5px' }}>Error:</h2>
            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error && this.state.error.toString()}
            </pre>
            <h2 style={{ fontWeight: 'bold', marginTop: '15px', marginBottom: '5px' }}>Component Stack:</h2>
            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#4b5563' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('class-democra-student-session'); // 혹시 모를 로컬스토리지 충돌 방지용 임시 정리 (실제 운영환경에선 조심)
              window.location.href = '/class_democra/app/';
            }}
            style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            초기 화면으로 강제 이동하기
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
