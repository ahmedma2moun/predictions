/* global React, tokens, sans, mono */

// Claude Code handoff sheet — design tokens + implementation pointers
function HandoffSheet() {
  const swatches = [
    ['background',          tokens.bg,         '#07090E'],
    ['backgroundElevated',  tokens.bgElev,     '#0E121B'],
    ['card',                tokens.card,       '#141925'],
    ['cardElevated',        tokens.cardElev,   '#1B2230'],
    ['border',              tokens.border,     'rgba(255,255,255,0.06)'],
    ['foreground',          tokens.fg,         '#F2F5FA'],
    ['mutedForeground',     tokens.fgMuted,    '#8A95A8'],
    ['primary',             tokens.brand,      '#10E089'],
    ['primaryDeep',         tokens.brandDeep,  '#0B9A66'],
    ['primarySoft',         tokens.brandSoft,  'rgba(16,224,137,0.12)'],
    ['warning',             tokens.amber,      '#F2B544'],
    ['live',                tokens.live,       '#FF4D6D'],
  ];

  const typeScale = [
    ['display',  'Inter 700 28px / -0.025em', 28, 700, '-0.025em'],
    ['title',    'Inter 700 17px',            17, 700, '-0.01em'],
    ['body',     'Inter 500 14px',            14, 500, '-0.01em'],
    ['caption',  'Inter 600 11px UPPER',      11, 600, '0.08em'],
    ['number',   'JetBrains Mono 700 20px',   20, 700, '-0.02em',  mono],
  ];

  return (
    <div style={{
      background: tokens.bg, color: tokens.fg,
      padding: 32, fontFamily: sans,
      height: '100%', overflow: 'auto',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: sans, fontSize: 32, fontWeight: 700,
        letterSpacing: '-0.03em',
      }}>Handoff — Pitch Premium</div>
      <div style={{ color: tokens.fgMuted, fontSize: 13, marginTop: 6, marginBottom: 24, maxWidth: 600 }}>
        Drop-in replacements for tokens & components in <code style={{ fontFamily: mono, color: tokens.brand }}>predictions/mobile/src/</code>.
        Existing API shapes from <code style={{ fontFamily: mono, color: tokens.brand }}>theme/colors.ts</code> stay the same — only values change.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* COLORS */}
        <Section title="Colors" subtitle="theme/colors.ts → palettes.dark">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {swatches.map(([k, v, hex]) => (
              <div key={k} style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 10, padding: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: v,
                  border: `1px solid ${tokens.borderStrong}`, flexShrink: 0,
                }}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: tokens.fg, fontWeight: 600 }}>
                    {k}
                  </div>
                  <div style={{
                    fontFamily: mono, fontSize: 10, color: tokens.fgMuted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* TYPE */}
        <Section title="Type scale" subtitle="Inter + JetBrains Mono for stats">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {typeScale.map(([k, label, size, w, ls, fam]) => (
              <div key={k} style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 10, padding: 14,
              }}>
                <div style={{
                  fontFamily: fam || sans, fontSize: size, fontWeight: w,
                  color: tokens.fg, letterSpacing: ls,
                  textTransform: k === 'caption' ? 'uppercase' : 'none',
                }}>
                  {k === 'number' ? '297' : 'Predict the beautiful game'}
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 10, color: tokens.fgMuted, marginTop: 6,
                }}>{k} — {label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* RADII + SPACING */}
        <Section title="Geometry" subtitle="radius, spacing">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['radius.sm', 8],
              ['radius.md', 14],
              ['radius.lg', 20],
              ['radius.xl', 28],
            ].map(([k, r]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, background: tokens.card,
                  border: `1px solid ${tokens.borderStrong}`,
                  borderRadius: r,
                }}/>
                <div style={{ fontFamily: mono, fontSize: 10, color: tokens.fgMuted, marginTop: 6 }}>
                  {k}<br/>{r}px
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontFamily: mono, fontSize: 11, color: tokens.fgMuted, lineHeight: 1.6 }}>
            spacing.xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32
          </div>
        </Section>

        {/* COMPONENTS */}
        <Section title="Components" subtitle="src/components/* updates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Impl file="components/ui.tsx" notes="Card: padding 16, radius 20, border rgba(255,255,255,0.06). Add Pill atom (replaces Badge). LiveDot atom for pulsing live state."/>
            <Impl file="components/PredictionCard.tsx" notes="Refactor to ScoreTile pattern: kickoff caption, teams row, Pick/Final cells, big points chip on right (brandSoft if exact, neutral else)."/>
            <Impl file="components/LeaderboardRow.tsx" notes="Add medal podium for ranks 1-3 on first render; rows 4+ become compact list; brandSoft surface for isMe row."/>
            <Impl file="components/AccuracyStatsCard.tsx" notes="Convert to hero stat: 44px number, +delta chip, 10-bar weekly sparkline, 3-col stat strip below."/>
            <Impl file="components/LeaderboardFilters.tsx" notes="Replace with segmented control (Week/Month/Season/All) using brand bg for active segment."/>
            <Impl file="(tabs)/_layout.tsx" notes="Tab bar: 86% opacity card + 24px backdrop blur, brand color on active, hairline top border."/>
            <Impl file="app/login.tsx" notes="Centered logo tile, large display copy, two full-width buttons with brand shadow under primary."/>
          </div>
        </Section>

        {/* ELEVATION + BREAKING CHANGES */}
        <Section title="Behaviour notes" subtitle="What changes besides skin">
          <Note tone="brand">
            <b>No drop-shadows.</b> Depth = hairline borders + tinted gradients on hero surfaces.
            Set <code>shadowColor: 'transparent'</code> on Cards; rely on contrast.
          </Note>
          <Note tone="amber">
            <b>Locked / Live / Picked states</b> are exposed via Pill, not text. Pill tones:
            <code> brand</code> (picked), <code>live</code> (in-play), <code>amber</code> (countdown),
            <code> ghost</code> (locked).
          </Note>
          <Note tone="neutral">
            <b>Numbers use mono.</b> Wrap every score / point / rank in <code>fontFamily: mono</code> +
            <code>fontVariant: ['tabular-nums']</code> so columns align.
          </Note>
          <Note tone="neutral">
            <b>Live pulse</b> — 7px dot, animation <code>pulse 1.6s ease-out infinite</code>
            (scale 1→1.6, opacity 1→0 on the box-shadow ring).
          </Note>
          <Note tone="brand">
            <b>Light palette</b> mirrors the same hex shifts: bg <code>#F4F6FA</code>, card <code>#FFFFFF</code>,
            brand <code>#0DB87A</code>. All other tokens proportionally lifted.
          </Note>
        </Section>

        {/* IMPLEMENTATION CHECKLIST */}
        <Section title="Claude Code checklist" subtitle="ship order">
          <ol style={{
            margin: 0, paddingLeft: 18, fontFamily: sans, fontSize: 12.5,
            color: tokens.fg, lineHeight: 1.7,
          }}>
            <li>Update <code style={{ fontFamily: mono, color: tokens.brand }}>theme/colors.ts</code> palette values (dark + light).</li>
            <li>Add <code style={{ fontFamily: mono, color: tokens.brand }}>fontFamily.mono</code> + load JetBrains Mono via expo-font.</li>
            <li>Replace <code>Badge</code> with <code>Pill</code> in components/ui.tsx (keep export named Badge for back-compat or add aliasing).</li>
            <li>Refactor <code>MatchCard</code>, <code>PredictionCard</code>, <code>LeaderboardRow</code> to match mockups.</li>
            <li>Bring tab bar in (_layout.tsx) up to glass spec.</li>
            <li>Add hero stats card + bar-sparkline to predictions screen.</li>
            <li>Add podium row + segmented period filter to leaderboard screen.</li>
            <li>Restyle login screen with full-width buttons + pitch line decoration.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: tokens.bgElev,
      border: `1px solid ${tokens.border}`,
      borderRadius: 16, padding: 18,
    }}>
      <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: tokens.fg, letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: tokens.fgMuted, marginTop: 2, marginBottom: 14 }}>
        {subtitle}
      </div>
      {children}
    </div>
  );
}

function Impl({ file, notes }) {
  return (
    <div style={{
      background: tokens.card, border: `1px solid ${tokens.border}`,
      borderRadius: 10, padding: 10,
    }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: tokens.brand, fontWeight: 700 }}>
        {file}
      </div>
      <div style={{ fontFamily: sans, fontSize: 11.5, color: tokens.fgMuted, marginTop: 4, lineHeight: 1.5 }}>
        {notes}
      </div>
    </div>
  );
}

function Note({ children, tone }) {
  const t = {
    brand:   { bd: tokens.brandSoftBorder, bg: tokens.brandSoft },
    amber:   { bd: 'rgba(242,181,68,0.30)', bg: tokens.amberSoft },
    neutral: { bd: tokens.border, bg: tokens.card },
  }[tone];
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.bd}`,
      borderRadius: 10, padding: 10, marginBottom: 8,
      fontFamily: sans, fontSize: 12, color: tokens.fg, lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

Object.assign(window, { HandoffSheet });
