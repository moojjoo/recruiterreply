import React from "react";
import { ErrorPage } from "./ErrorPage";
interface Props { children: React.ReactNode }
interface State { hasError: boolean }
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("UI render failure", error, info); }
  render() { return this.state.hasError ? <ErrorPage status={500} onRetry={() => { this.setState({ hasError: false }); }} /> : this.props.children; }
}
