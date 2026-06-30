// =====================================================================
// The Rostrum · GlobalActivityMap.tsx
// Faithful React recreation of the "Global Debate Activity" animation
// designed in Claude Design. Animated SVG world map:
//   · real country shapes (world-atlas TopoJSON, fetched at runtime)
//   · 10 glowing city nodes with radar-pulse rings
//   · 12 animated comet arcs between cities
//   · twinkling starfield + vignette
// Build-safe: topojson + atlas are fetched at runtime from a CDN, so
// there is NO build-time dependency. If the fetch fails it degrades
// gracefully to nodes + arcs over the gradient backdrop.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';

// ── injected keyframes (once) ─────────────────────────────────────────
const KEYFRAMES = `
@keyframes gda-radar { 0% { transform: scale(0.45); opacity: 0.65; } 70% { opacity: 0; } 100% { transform: scale(3.6); opacity: 0; } }
@keyframes gda-core  { 0%,100% { transform: scale(1); } 50% { transform: scale(1.22); } }
@keyframes gda-glow  { 0%,100% { opacity: 0.5; } 50% { opacity: 0.95; } }
@keyframes gda-comet { 0% { stroke-dashoffset: 1; opacity: 0; } 10% { opacity: 1; } 88% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes gda-twinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.85; } }
@keyframes gda-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
`;
function useKeyframes() {
  useEffect(() => {
    const id = 'gda-keyframes';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id; el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);
}

// ── city nodes + arcs (from the Claude Design source) ─────────────────
type Node = { id: string; name: string; lng: number; lat: number; color: string };
const NODES: Node[] = [
  { id: 'dc',  name: 'Washington', lng: -77.0, lat: 38.9, color: '#22d3ee' },
  { id: 'mex', name: 'Mexico City', lng: -99.1, lat: 19.4, color: '#f59e0b' },
  { id: 'sao', name: 'São Paulo', lng: -46.6, lat: -23.5, color: '#3b82f6' },
  { id: 'lon', name: 'London',    lng: -0.1,  lat: 51.5, color: '#67e8f9' },
  { id: 'afr', name: 'Nairobi',   lng: 32.0,  lat: -3.0, color: '#d946ef' },
  { id: 'dxb', name: 'Dubai',     lng: 55.3,  lat: 25.2, color: '#a855f7' },
  { id: 'del', name: 'New Delhi', lng: 77.2,  lat: 28.6, color: '#8b5cf6' },
  { id: 'bej', name: 'Beijing',   lng: 116.4, lat: 39.9, color: '#e879f9' },
  { id: 'bkk', name: 'Bangkok',   lng: 100.5, lat: 13.7, color: '#fb923c' },
  { id: 'syd', name: 'Sydney',    lng: 151.2, lat: -33.9, color: '#67e8f9' },
];
const ARCS: [string, string, string][] = [
  ['dc', 'lon', '#2dd4bf'], ['dc', 'mex', '#38bdf8'], ['dc', 'sao', '#3b82f6'],
  ['lon', 'bej', '#22d3ee'], ['lon', 'afr', '#d946ef'], ['lon', 'sao', '#5eead4'],
  ['afr', 'dxb', '#c084fc'], ['dxb', 'bej', '#a855f7'], ['del', 'bej', '#8b5cf6'],
  ['bej', 'syd', '#38bdf8'], ['bkk', 'syd', '#fb923c'], ['bej', 'bkk', '#f472b6'],
];

// equirectangular projection → 1000×500 viewBox space
function project(lng: number, lat: number): [number, number] {
  return [(lng + 180) * (1000 / 360), (90 - lat) * (500 / 180)];
}

function makeStars() {
  const out: { x: number; y: number; r: number; dur: string; delay: string }[] = [];
  for (let i = 0; i < 150; i++) {
    out.push({
      x: +(Math.random() * 1000).toFixed(1),
      y: +(18 + Math.random() * 400).toFixed(1),
      r: +(0.3 + Math.random() * 0.9).toFixed(2),
      dur: (2 + Math.random() * 4).toFixed(2),
      delay: (Math.random() * 5).toFixed(2),
    });
  }
  return out;
}

export function GlobalActivityMap({
  showLabels = false,
  showCaption = true,
  captionText = 'Live debate activity',
  glowStrength = 1.4,
  arcSpeed = 6,
}: {
  showLabels?: boolean; showCaption?: boolean; captionText?: string;
  glowStrength?: number; arcSpeed?: number;
}) {
  useKeyframes();
  const [paths, setPaths] = useState<string[]>([]);
  const stars = useRef(makeStars()).current;

  // Runtime-fetch the world atlas — no build dependency.
  useEffect(() => {
    let alive = true;
    function ringPath(coords: number[][]) {
      let d = '';
      for (let i = 0; i < coords.length; i++) {
        const [x, y] = project(coords[i][0], coords[i][1]);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      return d + 'Z';
    }
    function geoToPath(geom: any) {
      let d = '';
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      for (const poly of polys) for (const ring of poly) d += ringPath(ring);
      return d;
    }
    function loadScript(src: string): Promise<void> {
      return new Promise((res, rej) => {
        if ((window as any).topojson) return res();
        const s = document.createElement('script');
        s.src = src; s.onload = () => res(); s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    (async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
        const topo = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
        const fc = (window as any).topojson.feature(topo, topo.objects.countries);
        const ps = fc.features.map((f: any) => geoToPath(f.geometry));
        if (alive) setPaths(ps);
      } catch (e) {
        console.warn('[GDA] map data failed to load, showing nodes only', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // node geometry + per-node animation styles
  const nodes = useMemo(() => NODES.map((n, i) => {
    const [x, y] = project(n.lng, n.lat);
    const d = i * 0.45;
    return {
      ...n, x: +x.toFixed(1), y: +y.toFixed(1),
      haloStyle: { transformBox: 'fill-box', transformOrigin: 'center', opacity: 0.25 * glowStrength, animation: 'gda-glow 3s ease-in-out infinite', animationDelay: `${d}s` } as React.CSSProperties,
      radar1Style: { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gda-radar 3.2s ease-out infinite', animationDelay: `${d}s` } as React.CSSProperties,
      radar2Style: { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gda-radar 3.2s ease-out infinite', animationDelay: `${(d + 1.6).toFixed(2)}s` } as React.CSSProperties,
      coreStyle: { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gda-core 2.4s ease-in-out infinite', animationDelay: `${d}s` } as React.CSSProperties,
    };
  }), [glowStrength]);

  // arc geometry (quadratic curve lifted off the straight line)
  const arcs = useMemo(() => {
    const by: Record<string, typeof nodes[number]> = {};
    nodes.forEach(n => { by[n.id] = n; });
    return ARCS.map(([a, b, color], i) => {
      const A = by[a], B = by[b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const dist = Math.hypot(dx, dy);
      let nx = -dy, ny = dx;
      const L = Math.hypot(nx, ny) || 1;
      nx /= L; ny /= L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const lift = dist * 0.24;
      const cx = (A.x + B.x) / 2 + nx * lift;
      const cy = (A.y + B.y) / 2 + ny * lift;
      return {
        color,
        d: `M${A.x} ${A.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${B.x} ${B.y}`,
        style: { strokeDasharray: '0.12 0.88', animation: `gda-comet ${arcSpeed}s linear infinite`, animationDelay: `${(i * 0.55).toFixed(2)}s` } as React.CSSProperties,
      };
    });
  }, [nodes, arcSpeed]);

  return (
    <div style={{ position:'relative', width:'100%', aspectRatio:'1000 / 400', overflow:'hidden',
      borderRadius:14,
      background:'radial-gradient(ellipse 75% 90% at 50% 42%, #0a1838 0%, #060e22 46%, #03070f 78%, #01030a 100%)',
      fontFamily:"'Inter', system-ui, sans-serif" }}>
      <svg viewBox="0 18 1000 400" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"
        style={{ display:'block', position:'absolute', inset:0 }}>
        <defs>
          <filter id="gda-arcGlow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="gda-soft" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="gda-mapGlow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <radialGradient id="gda-vig" cx="50%" cy="44%" r="62%">
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#01030a" stopOpacity="0.85" />
          </radialGradient>
        </defs>

        {/* starfield */}
        <g>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#bcd4ff"
              style={{ animation:`gda-twinkle ${s.dur}s ease-in-out infinite`, animationDelay:`${s.delay}s` }} />
          ))}
        </g>

        {/* country shapes */}
        <g filter="url(#gda-mapGlow)">
          {paths.map((d, i) => (
            <path key={i} d={d} style={{ fill:'#0d2a5e', fillOpacity:0.5, stroke:'#2563c4', strokeWidth:0.45, strokeOpacity:0.4 }} />
          ))}
        </g>

        {/* comet arcs */}
        <g filter="url(#gda-arcGlow)">
          {arcs.map((a, i) => (
            <g key={i}>
              <path d={a.d} fill="none" stroke={a.color} strokeWidth={0.8} strokeOpacity={0.28} strokeLinecap="round" />
              <path d={a.d} fill="none" stroke={a.color} strokeWidth={1.7} strokeLinecap="round" pathLength={1} style={a.style} />
            </g>
          ))}
        </g>

        {/* city nodes */}
        <g>
          {nodes.map(n => (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <circle r={13} fill={n.color} filter="url(#gda-soft)" style={n.haloStyle} />
              <circle r={5.2} fill="none" stroke={n.color} strokeWidth={0.9} style={n.radar1Style} />
              <circle r={5.2} fill="none" stroke={n.color} strokeWidth={0.9} style={n.radar2Style} />
              <circle r={3.6} fill={n.color} style={n.coreStyle} />
              <circle r={1.8} fill="#ffffff" />
              {showLabels && (
                <text x={0} y={-11} textAnchor="middle" fill="#dbe7ff"
                  style={{ fontSize:'7px', fontWeight:500, letterSpacing:'0.6px', textTransform:'uppercase' }}>
                  {n.name}
                </text>
              )}
            </g>
          ))}
        </g>

        <rect x={0} y={18} width={1000} height={400} fill="url(#gda-vig)" pointerEvents="none" />
      </svg>

      {showCaption && (
        <div style={{ position:'absolute', left:'3.2%', bottom:'7%', display:'flex', alignItems:'center', gap:9,
          color:'#aebfe0', fontSize:'clamp(9px,1.05vw,13px)', fontWeight:500, letterSpacing:2, textTransform:'uppercase' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#34d399',
            boxShadow:'0 0 10px 2px #34d399', animation:'gda-blink 1.8s ease-in-out infinite' }} />
          <span>{captionText}</span>
        </div>
      )}
    </div>
  );
}
