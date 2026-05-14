/* global React, tokens, sans, mono, StatusBar, Logo, Avatar, Pill, Card, LiveDot, IconBtn, TabBar, AppHeader, SectionTitle */

// ─────────────────────────────────────────────────────────────
// MatchesScreen — upcoming fixtures list
// ─────────────────────────────────────────────────────────────
function MatchesScreen() {
  const matches = [
    { id: 1, comp: 'Premier League',  day: 'Today · 20:00',     home: 'Arsenal',    away: 'Chelsea',   homePos: 2, awayPos: 4, homePts: 64, awayPts: 51, countdown: '3h 12m', status: 'open' },
    { id: 2, comp: 'UCL · SF · Leg 2',day: 'Tomorrow · 21:00',  home: 'Real Madrid',away: 'Bayern',    homePos: null,awayPos: null, countdown: '1d 4h', status: 'open',  prediction: { home: 2, away: 1 } },
    { id: 3, comp: 'Premier League',  day: 'Sat · 17:30',       home: 'Liverpool',  away: 'Man City',  homePos: 1, awayPos: 3, homePts: 71, awayPts: 60, live: { home: 1, away: 1, minute: "67'" }, status: 'live', prediction: { home: 2, away: 1 } },
    { id: 4, comp: 'La Liga · MD 34', day: 'Sun · 21:00',       home: 'Barcelona',  away: 'Atlético',  homePos: 1, awayPos: 4, homePts: 78, awayPts: 65, countdown: '2d 5h', status: 'locked' },
  ];

  return (
    <div style={{ background: tokens.bg, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <StatusBar/>
      <AppHeader
        title="Matches"
        subtitle="4 fixtures · 2 still open"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn glyph="filter"/>
            <Avatar name="Aria Khan" size={36}/>
          </div>
        }
      />

      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8, overflow: 'hidden' }}>
        {['All', 'Today', 'Tomorrow', 'This week', 'Next week'].map((c, i) => (
          <div key={c} style={{
            padding: '7px 14px', borderRadius: tokens.pill,
            background: i === 0 ? tokens.brand : 'transparent',
            color: i === 0 ? '#031A11' : tokens.fgMuted,
            border: i === 0 ? 'none' : `1px solid ${tokens.border}`,
            fontFamily: sans, fontSize: 12, fontWeight: 600,
            letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>{c}</div>
        ))}
      </div>

      <div style={{ padding: '4px 16px 110px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {matches.map(m => <MatchCard key={m.id} m={m}/>)}
      </div>

      <TabBar active="matches"/>
    </div>
  );
}

function MatchCard({ m }) {
  const isLive = m.status === 'live';
  const isLocked = m.status === 'locked';
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }} glow={isLive}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px 9px',
        borderBottom: `1px solid ${tokens.border}`,
        background: isLive ? 'linear-gradient(180deg, rgba(255,77,109,0.06), transparent)' : 'transparent',
      }}>
        <span style={{
          fontFamily: sans, fontSize: 10.5, fontWeight: 700,
          color: tokens.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, marginRight: 8,
        }}>{m.comp}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isLive && <Pill tone="live" size="sm" icon={<LiveDot/>}>LIVE {m.live.minute}</Pill>}
          {!isLive && isLocked && <Pill tone="ghost" size="sm">LOCKED</Pill>}
          {!isLive && !isLocked && m.prediction && <Pill tone="brand" size="sm">PICKED</Pill>}
        </div>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
          <TeamSide team={m.home} pos={m.homePos} pts={m.homePts}/>
          <ScoreCenter m={m} isLive={isLive}/>
          <TeamSide team={m.away} pos={m.awayPos} pts={m.awayPts} align="right"/>
        </div>
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: `1px dashed ${tokens.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: sans, fontSize: 11.5, color: tokens.fgMuted, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            {m.day}
          </span>
          {!isLive && !isLocked && (
            <span style={{
              fontFamily: mono, fontSize: 11, color: tokens.amber, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>
              </svg>
              {m.countdown} to predict
            </span>
          )}
          {isLive && m.prediction && (
            <span style={{ fontFamily: sans, fontSize: 11.5, color: tokens.fgMuted, whiteSpace: 'nowrap' }}>
              Your pick: <span style={{ color: tokens.fg, fontFamily: mono, fontWeight: 600 }}>{m.prediction.home}–{m.prediction.away}</span>
            </span>
          )}
          {isLocked && (
            <span style={{ fontFamily: sans, fontSize: 11.5, color: tokens.fgDim, whiteSpace: 'nowrap' }}>
              No prediction submitted
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function TeamSide({ team, pos, pts, align = 'left' }) {
  const isRight = align === 'right';
  return (
    <div style={{
      display: 'flex', flexDirection: isRight ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 10, minWidth: 0,
    }}>
      <Logo name={team} size={36}/>
      <div style={{ minWidth: 0, textAlign: isRight ? 'right' : 'left' }}>
        <div style={{
          fontFamily: sans, fontSize: 14, fontWeight: 600,
          color: tokens.fg, letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{team}</div>
        {pos != null && (
          <div style={{ fontFamily: mono, fontSize: 10.5, color: tokens.fgMuted, marginTop: 2, fontWeight: 500 }}>
            #{pos} · {pts} pts
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCenter({ m, isLive }) {
  if (isLive) {
    return (
      <div style={{
        textAlign: 'center', padding: '4px 14px', minWidth: 70,
        background: tokens.bgElev, borderRadius: tokens.radiusMd,
        border: `1px solid ${tokens.border}`,
      }}>
        <div style={{
          fontFamily: mono, fontSize: 22, fontWeight: 700,
          color: tokens.fg, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>{m.live.home}–{m.live.away}</div>
      </div>
    );
  }
  if (m.prediction) {
    return (
      <div style={{
        textAlign: 'center', padding: '4px 12px', minWidth: 70,
        border: `1px solid ${tokens.brandSoftBorder}`,
        background: tokens.brandSoft, borderRadius: tokens.radiusMd,
      }}>
        <div style={{
          fontFamily: mono, fontSize: 20, fontWeight: 700,
          color: tokens.brand, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>{m.prediction.home}–{m.prediction.away}</div>
      </div>
    );
  }
  return (
    <div style={{
      fontFamily: sans, fontSize: 11, color: tokens.fgDim,
      fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '8px 4px', minWidth: 40, textAlign: 'center',
    }}>vs</div>
  );
}

// ─────────────────────────────────────────────────────────────
// MatchDetailScreen — predict + h2h + group comparison
// ─────────────────────────────────────────────────────────────
function MatchDetailScreen() {
  const [home, setHome] = React.useState(2);
  const [away, setAway] = React.useState(1);
  return (
    <div style={{ background: tokens.bg, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <StatusBar/>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: tokens.card, border: `1px solid ${tokens.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.fg} strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </div>
        <div style={{
          fontFamily: sans, fontSize: 11.5, fontWeight: 700, color: tokens.fgMuted,
          letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>MD 35 · Premier League</div>
        <div style={{ width: 36 }}/>
      </div>

      <div style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '20px 20px 24px',
            background: 'radial-gradient(120% 100% at 50% 0%, rgba(16,224,137,0.10), transparent 70%)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{
                fontFamily: sans, fontSize: 11, color: tokens.fgMuted,
                fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>Sat 17 May · 20:00</span>
              <Pill tone="amber" size="sm" icon={
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>
                </svg>
              }>3h 12m left</Pill>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
              <TeamPicker name="Arsenal" pos={2} pts={64} value={home} onChange={setHome}/>
              <div style={{ fontFamily: mono, fontSize: 24, color: tokens.fgDim, fontWeight: 600, padding: '0 8px' }}>–</div>
              <TeamPicker name="Chelsea" pos={4} pts={51} value={away} onChange={setAway}/>
            </div>
            <div style={{ marginTop: 18, textAlign: 'center', fontFamily: sans, fontSize: 12, color: tokens.fgMuted }}>
              Your call:{' '}
              <span style={{ color: tokens.fg, fontWeight: 600 }}>
                {home > away ? 'Arsenal wins' : away > home ? 'Chelsea wins' : 'Draw'}
              </span>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1, height: 48, borderRadius: tokens.radiusMd,
                background: tokens.brand, color: '#031A11',
                fontFamily: sans, fontSize: 15, fontWeight: 700, border: 'none',
                letterSpacing: '-0.01em',
                boxShadow: `0 0 0 1px rgba(16,224,137,0.4), 0 8px 24px -8px rgba(16,224,137,0.5)`,
              }}>Save prediction</button>
              <button style={{
                width: 48, height: 48, borderRadius: tokens.radiusMd,
                background: tokens.card, color: tokens.fgMuted,
                border: `1px solid ${tokens.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Head to head</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 4, marginBottom: 12 }}>
            <HHCol num="4" label="Arsenal" tone={tokens.fg}/>
            <HHCol num="2" label="Draw" tone={tokens.fgMuted}/>
            <HHCol num="4" label="Chelsea" tone={tokens.fg}/>
          </div>
          <div style={{ height: 6, borderRadius: tokens.pill, overflow: 'hidden', display: 'flex', background: tokens.bgElev }}>
            <div style={{ width: '40%', background: tokens.brand }}/>
            <div style={{ width: '20%', background: tokens.fgDim, opacity: 0.6 }}/>
            <div style={{ width: '40%', background: 'hsl(210 60% 55%)' }}/>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['Sun 12 Jan', 'Chelsea', 2, 1, 'Arsenal'],
              ['Sat 28 Sep', 'Arsenal', 1, 1, 'Chelsea'],
              ['Wed 12 Apr', 'Arsenal', 3, 0, 'Chelsea'],
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderTop: i === 0 ? `1px solid ${tokens.border}` : 'none',
                borderBottom: i < 2 ? `1px solid ${tokens.border}` : 'none',
              }}>
                <span style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, width: 72 }}>{r[0]}</span>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: tokens.fg, flex: 1, textAlign: 'right' }}>{r[1]}</span>
                <span style={{
                  margin: '0 10px', fontFamily: mono, fontSize: 12.5, fontWeight: 700, color: tokens.fg,
                  fontVariantNumeric: 'tabular-nums',
                }}>{r[2]}–{r[3]}</span>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: tokens.fg, flex: 1 }}>{r[4]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle nomargin>Your group · Office</SectionTitle>
            <span style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              Switch
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </span>
          </div>
          {[
            ['Aria Khan', 2, 1, 'you'],
            ['Jules Cabrera', 1, 0, null],
            ['Sam Reyes', 3, 2, null],
            ['Mira Patel', null, null, null],
          ].map(([n, h, a, tag], i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${tokens.border}`,
            }}>
              <Avatar name={n} size={28}/>
              <span style={{ flex: 1, fontFamily: sans, fontSize: 13, color: tokens.fg, fontWeight: 500 }}>
                {n}
                {tag && (
                  <span style={{
                    marginLeft: 6, fontFamily: sans, fontSize: 10, color: tokens.brand,
                    fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>· {tag}</span>
                )}
              </span>
              {h != null ? (
                <span style={{
                  fontFamily: mono, fontSize: 13, fontWeight: 700,
                  color: tokens.fg, fontVariantNumeric: 'tabular-nums',
                }}>{h}–{a}</span>
              ) : (
                <span style={{ fontFamily: sans, fontSize: 11, fontStyle: 'italic', color: tokens.fgDim }}>
                  No pick
                </span>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function TeamPicker({ name, pos, pts, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Logo name={name} size={48}/>
      <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: tokens.fg, letterSpacing: '-0.01em' }}>
        {name}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: tokens.fgMuted }}>
        #{pos} · {pts} pts
      </div>
      <div style={{
        marginTop: 4, display: 'flex', alignItems: 'center',
        background: tokens.bgElev, border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusMd, padding: 4,
      }}>
        <Stepper symbol="−" onClick={() => onChange(Math.max(0, value - 1))}/>
        <div style={{
          width: 44, textAlign: 'center', fontFamily: mono, fontSize: 22, fontWeight: 700,
          color: tokens.fg, fontVariantNumeric: 'tabular-nums',
        }}>{value}</div>
        <Stepper symbol="+" onClick={() => onChange(Math.min(15, value + 1))}/>
      </div>
    </div>
  );
}

function Stepper({ symbol, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 30, height: 30, borderRadius: tokens.radiusSm,
      background: tokens.card, color: tokens.fg, border: 'none', cursor: 'pointer',
      fontFamily: sans, fontSize: 18, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{symbol}</button>
  );
}

function HHCol({ num, label, tone }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: mono, fontSize: 26, fontWeight: 700, color: tone,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
      }}>{num}</div>
      <div style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

Object.assign(window, { MatchesScreen, MatchDetailScreen });
