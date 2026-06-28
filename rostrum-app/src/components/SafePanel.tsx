// =====================================================================
// The Rostrum · src/components/SafePanel.tsx
// A LOCAL error boundary: if its child throws, it shows a compact fallback
// inside the same box instead of unmounting the whole screen. This keeps
// host controls (mic, End event) reachable even if the video composition
// crashes. Resets automatically when `resetKey` changes.
// =====================================================================
import { Component, type ReactNode } from 'react';
import { C, ui } from '../lib/theme';

export class SafePanel extends Component<
  { children: ReactNode; resetKey?: string; label?: string },
  { failed: boolean; key?: string }
> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: any, state: any) {
    if (props.resetKey !== state.key) return { failed: false, key: props.resetKey };
    return null;
  }
  componentDidCatch(e: any) { console.error('panel error:', e); }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          background: '#0E0D11', color: C.faint, fontFamily: ui, fontSize: 13, textAlign: 'center', padding: 16 }}>
          <div>
            <div style={{ color: C.dim, fontWeight: 600 }}>{this.props.label ?? 'Video'} hiccuped</div>
            <div style={{ marginTop: 4, fontSize: 11 }}>It will recover shortly — your controls still work.</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
