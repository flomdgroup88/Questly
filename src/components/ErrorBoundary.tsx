import { Component, type ReactNode, type ErrorInfo } from "react";
import { T } from "../theme.js";

interface Props   { children: ReactNode }
interface State   { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("⚠️ Questly ErrorBoundary:", err, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, padding: 32, textAlign: "center",
        }}>
          <div style={{ fontSize: 52 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.rose }}>
            Что-то пошло не так
          </div>
          <div style={{ fontSize: 13, color: T.sub, maxWidth: 260 }}>
            {this.state.error?.message ?? "Неизвестная ошибка"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: "10px 28px", borderRadius: 14,
              border: "none", background: T.purp, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
