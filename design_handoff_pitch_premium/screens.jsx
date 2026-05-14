/* global React */
// Modern "Pitch Premium" redesign — screen components for the preds app.

const tokens = {
  bg:           '#07090E',
  bgElev:       '#0E121B',
  card:         '#141925',
  cardElev:     '#1B2230',
  border:       'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  fg:           '#F2F5FA',
  fgMuted:      '#8A95A8',
  fgDim:        '#5A6478',
  brand:        '#10E089',
  brandDeep:    '#0B9A66',
  brandSoft:    'rgba(16,224,137,0.12)',
  brandSoftBorder: 'rgba(16,224,137,0.30)',
  live:         '#FF4D6D',
  amber:        '#F2B544',
  amberSoft:    'rgba(242,181,68,0.14)',
  loss:         '#5A6478',
  radiusSm: 8, radiusMd: 14, radiusLg: 20, radiusXl: 28, pill: 999,
};

const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const sans = '"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif';

function StatusBar({ time = '9:41', tint = tokens.fg }) {
  return (
    <div style={{
      height: 50, padding: '14px 24px 0', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      fontFamily: sans, color: tint, fontSize: 15, fontWeight: 600,
      letterSpacing: '-0.01em',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><g fill={tint}>
          <rect x="0" y="7" width="3" height="4" rx="0.5"/>
          <rect x="5" y="5" width="3" height="6" rx="0.5"/>
          <rect x="10" y="2" width="3" height="9" rx="0.5"/>
          <rect x="15" y="0" width="3" height="11" rx="0.5"/>
        </g></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill={tint}>
          <path d="M8 0a13.6 13.6 0 0 1 8 2.9l-1.5 1.6A11.5 11.5 0 0 0 8 2.1c-2.5 0-4.8.9-6.5 2.4L0 2.9A13.6 13.6 0 0 1 8 0Zm0 4a9.6 9.6 0 0 1 5.5 1.8l-1.6 1.7A7.5 7.5 0 0 0 8 6.1c-1.5 0-2.8.4-3.9 1.4L2.5 5.8A9.6 9.6 0 0 1 8 4Zm0 4c.9 0 1.8.3 2.5.9L8 11 5.5 8.9A4 4 0 0 1 8 8Z"/>
        </svg>
        <div style={{
          width: 26, height: 11, border: `1px solid ${tint}66`,
          borderRadius: 3, position: 'relative', padding: 1,
        }}>
          <div style={{ width: '78%', height: '100%', background: tint, borderRadius: 1 }}/>
          <div style={{
            position: 'absolute', right: -3, top: 3, width: 2, height: 5,
            background: `${tint}66`, borderRadius: 1,
          }}/>
        </div>
      </div>
    </div>
  );
}

function Logo({ size = 28, name = 'Team' }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `repeating-linear-gradient(45deg, hsl(${hue} 45% 40%) 0 4px, hsl(${hue} 35% 30%) 4px 8px)`,
      border: `1px solid ${tokens.border}`, flexShrink: 0,
    }}/>
  );
}

function Avatar({ name, size = 36 }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, hsl(${hue} 40% 32%), hsl(${(hue+30)%360} 40% 22%))`,
      color: tokens.fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, fontSize: size * 0.36, fontWeight: 600, letterSpacing: '0.02em',
      border: `1px solid ${tokens.border}`, flexShrink: 0,
    }}>{initials}</div>
  );
}

function Pill({ children, tone = 'neutral', size = 'md', icon }) {
  const styleMap = {
    brand:   { bg: tokens.brandSoft, fg: tokens.brand, bd: tokens.brandSoftBorder },
    live:    { bg: 'rgba(255,77,109,0.15)', fg: tokens.live, bd: 'rgba(255,77,109,0.35)' },
    amber:   { bg: tokens.amberSoft, fg: tokens.amber, bd: 'rgba(242,181,68,0.30)' },
    neutral: { bg: 'rgba(255,255,255,0.05)', fg: tokens.fg, bd: tokens.border },
    ghost:   { bg: 'transparent', fg: tokens.fgMuted, bd: tokens.border },
  }[tone];
  const sizes = { sm: { px: 8, py: 2, fs: 10.5 }, md: { px: 10, py: 4, fs: 11.5 } }[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${sizes.py}px ${sizes.px}px`,
      background: styleMap.bg, color: styleMap.fg,
      border: `1px solid ${styleMap.bd}`, borderRadius: tokens.pill,
      fontFamily: sans, fontSize: sizes.fs, fontWeight: 600,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>{icon}{children}</span>
  );
}

function Card({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: tokens.card, border: `1px solid ${tokens.border}`,
      borderRadius: tokens.radiusLg, padding: 16,
      ...(glow && { boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px ${tokens.brandSoftBorder}` }),
      ...style,
    }}>{children}</div>
  );
}

function LiveDot() {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', background: tokens.live,
      boxShadow: `0 0 0 0 ${tokens.live}88`,
      animation: 'pulse 1.6s ease-out infinite',
      display: 'inline-block',
    }}/>
  );
}

function IconBtn({ glyph }) {
  const paths = {
    filter: 'M3 6h18M6 12h12M10 18h4',
    bell:   'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M9 21a3 3 0 0 0 6 0',
    plus:   'M12 5v14M5 12h14',
  };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 18,
      background: tokens.card, border: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.fg,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[glyph]}/>
      </svg>
    </div>
  );
}

function TabBar({ active = 'matches' }) {
  const items = [
    { id: 'matches',     label: 'Matches', icon: 'M4 7h16M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M8 3v4M16 3v4M8 12h2M14 12h2M8 16h2M14 16h2' },
    { id: 'predictions', label: 'My Score', icon: 'M3 17l6-6 4 4 8-8M21 7v6M21 7h-6' },
    { id: 'leaderboard', label: 'Leaders', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM3 4h4v3a3 3 0 0 1-3 3M21 4h-4v3a3 3 0 0 0 3 3' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(10,12,18,0.86)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderTop: `1px solid ${tokens.border}`,
      padding: '8px 20px 28px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => {
        const isActive = it.id === active;
        return (
          <div key={it.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: isActive ? tokens.brand : tokens.fgMuted, flex: 1,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.icon}/>
            </svg>
            <span style={{ fontFamily: sans, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em' }}>
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AppHeader({ title, subtitle, right }) {
  return (
    <div style={{
      padding: '8px 20px 16px', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: sans, fontSize: 28, fontWeight: 700,
          color: tokens.fg, letterSpacing: '-0.025em', lineHeight: 1.1,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontFamily: sans, fontSize: 13, color: tokens.fgMuted,
            marginTop: 4, letterSpacing: '-0.01em',
          }}>{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  );
}

function SectionTitle({ children, nomargin }) {
  return (
    <div style={{
      fontFamily: sans, fontSize: 13, fontWeight: 700,
      color: tokens.fg, letterSpacing: '-0.01em',
      marginBottom: nomargin ? 0 : 12,
    }}>{children}</div>
  );
}

Object.assign(window, {
  tokens, sans, mono,
  StatusBar, Logo, Avatar, Pill, Card, LiveDot, IconBtn, TabBar, AppHeader, SectionTitle,
});
