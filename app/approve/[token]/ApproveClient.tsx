"use client";

import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("[APPROVE ERROR]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui", color: "#111" }}>
          <h2 style={{ margin: 0 }}>Approve page crashed</h2>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default function ApproveClient({ token }: { token: string }) {
  return (
    <ErrorBoundary>
      <div style={{ padding: 24, fontFamily: "system-ui", color: "#111" }}>
        <h1 style={{ margin: 0 }}>Approve route alive ✅</h1>
        <div style={{ marginTop: 12 }}>
          <strong>Token:</strong>{" "}
          <span style={{ wordBreak: "break-all" }}>{token || "(empty)"}</span>
        </div>

        <div style={{ marginTop: 16, opacity: 0.7 }}>
          If token is NOT empty, routing is correct. Next step will re-enable the
          real approval logic safely.
        </div>
      </div>
    </ErrorBoundary>
  );
}
