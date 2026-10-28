import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Last line of defence: a render crash shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('iConnecto crashed while rendering:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="auth">
        <div className="glass auth__card" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">The app hit an unexpected problem. Reloading usually fixes it.</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <details className="small faint" style={{ marginTop: 12 }} open>
            <summary>Technical details (send this to the developer)</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, userSelect: 'text' }}>
              {String(this.state.error.message || this.state.error)}
              {'\n'}
              {(this.state.error.stack || '').split('\n').slice(0, 6).join('\n')}
              {'\n'}
              {navigator.userAgent}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
