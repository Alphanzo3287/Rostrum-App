// =====================================================================
// The Rostrum · src/components/ErrorBoundary.tsx
// Catches a render/runtime error in any screen and shows a readable card
// instead of unmounting the whole app to a black void.
// =====================================================================
import { Component, type ReactNode } from 'react';
import { C, ui, display } from '../lib/theme';

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('Screen error:', err); }
  reset = () => this.setState({ err: null });

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:24, background:C.base }}>
        <div style={{ maxWidth:440, textAlign:'center' }}>
          <h2 style={{ fontFamily:display, fontSize:26, color:C.ink, margin:'0 0 8px' }}>Something broke on this screen</h2>
          <p style={{ fontFamily:ui, fontSize:13.5, color:C.dim, lineHeight:1.5, margin:'0 0 18px' }}>
            The rest of the app is fine — you can head back and try again.
          </p>
          <pre style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, color:C.faint, whiteSpace:'pre-wrap',
            textAlign:'left', background:C.panel, border:`1px solid ${C.hair}`, borderRadius:8, padding:'10px 12px',
            maxHeight:140, overflow:'auto' }}>{String(this.state.err?.message ?? this.state.err)}</pre>
          <button onClick={this.reset} style={{ marginTop:16, padding:'10px 18px', borderRadius:6, border:'none',
            cursor:'pointer', fontFamily:ui, fontWeight:700, color:C.base,
            background:`linear-gradient(180deg, ${C.goldHi}, ${C.gold})` }}>Try again</button>
          <a href="/" style={{ display:'inline-block', marginTop:16, marginLeft:10, padding:'10px 18px', borderRadius:6,
            textDecoration:'none', fontFamily:ui, fontWeight:700, color:C.ink, border:`1px solid ${C.hair}` }}>
            Leave &amp; go home
          </a>
        </div>
      </div>
    );
  }
}
