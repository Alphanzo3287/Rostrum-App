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
  { children: ReactNode; resetKey?: string; label?: string; fill?: boolean },
  { failed: boolean; key?: string; msg?: string }
> {
  state = { failed: false, key: this.props.resetKey, msg: '' };
  static getDerivedStateFromError(err: any) { return { failed: true, msg: String(err?.message ?? err) }; }
  static getDerivedStateFromProps(props: any, state: any) {
    if (props.resetKey !== state.key) return { failed: false, key: props.resetKey, msg: '' };
    return null;
  }
  componentDidCatch(e: any) { console.error('panel error:', e); }
  render() {
    if (this.state.failed) {
      // IMPORTANT: the fallback is rendered IN FLOW (never position:absolute),
      // so it can never escape its box and cover the host's dock / controls.
      // `fill` makes it grow to fill a positioned parent (used for the video
      // preview box); otherwise it stays compact so siblings remain usable.
      return (
        <div style={{
          position: this.props.fill ? 'absolute' : 'relative',
          inset: this.props.fill ? 0 : undefined,
          display: 'grid', placeItems: 'center', gap: 4,
          background: C.base, color: C.faint, fontFamily: ui, fontSize: 12.5, textAlign: 'center',
          padding: this.props.fill ? 16 : '10px 12px', borderRadius: 8 }}>
          <div>
            <div style={{ color: C.dim, fontWeight: 600 }}>{this.props.label ?? 'This panel'} hiccuped — your controls still work</div>
            {this.state.msg && (
              <div style={{ marginTop: 4, fontSize: 10.5, color: C.faint, opacity: 0.8, maxWidth: 520,
                wordBreak: 'break-word', fontFamily: 'JetBrains Mono, monospace' }}>{this.state.msg}</div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
