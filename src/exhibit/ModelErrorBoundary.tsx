import { Component, type ErrorInfo, type ReactNode } from "react"

type ModelErrorBoundaryProps = {
  children: ReactNode
  fallback: (error: Error) => ReactNode
  onError?: (error: Error) => void
}

type ModelErrorBoundaryState = { error: Error | null }

export class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ModelErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError?.(error)
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error)
    return this.props.children
  }
}
