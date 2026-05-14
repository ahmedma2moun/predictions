/* global React, tokens, sans, mono, StatusBar, Avatar, Card, IconBtn, TabBar, AppHeader */

// ─────────────────────────────────────────────────────────────
// MyScoreScreen
// ─────────────────────────────────────────────────────────────
function MyScoreScreen() {
  return (
    <div style={{ background: tokens.bg, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <StatusBar/>
      <AppHeader
        title="My Score"
        subtitle="Season 24/25 · 1,284 pts career"
        right={<Avatar name="Aria Khan" size={36}/>}
      />

      <div style={{ padding: '0 16px 110px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '18px 20px',
            background: `linear-gradient(135deg, ${tokens.brandSoft}, transparent 60%)`,
            borderBottom: `1px solid ${tokens.border}`,
          }}>
            <div style={{
              fontFamily: sans, fontSize: 11, color: tokens.fgMuted,
              fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 6,
            }}>This week</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <span style={{
                  fontFamily: sans, fontSize: 44, fontWeight: 700,
                  color: tokens.brand, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
                }}>24</span>
                <span style={{ fontFamily: sans, fontSize: 14, color: tokens.fgMuted, marginLeft: 6 }}>pts</span>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                color: tokens.brand, fontFamily: mono, fontSize: 12, fontWeight: 700,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l5-5 5 5M7 11l5-5 5 5"/>
                </svg>
                +8 vs last week
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-end', gap: 6, height: 36 }}>
              {[8, 4, 0, 6, 0, 6, 12, 2, 0, 4].map((v, i) => (
                <div key={i} style={{
                  flex: 1, height: `${(v / 12) * 100}%`, minHeight: 3,
                  background: v >= 6 ? tokens.brand : v > 0 ? `${tokens.brand}55` : tokens.borderStrong,
                  borderRadius: 2,
                }}/>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              ['62%', 'Outcome',  tokens.fg],
              ['18%', 'Exact',    tokens.brand],
              ['4',   'Streak',   tokens.amber],
            ].map(([v, l, c], i) => (
              <div key={l} style={{
                padding: '14px 12px',
                borderRight: i < 2 ? `1px solid ${tokens.border}` : 'none',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: mono, fontSize: 20, fontWeight: 700, color: c,
                  letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
                }}>{v}</div>
                <div style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 4px',
        }}>
          <NavArrow dir="left"/>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: tokens.fg, letterSpacing: '-0.01em' }}>
            Mon 12 May · Sun 18 May
          </div>
          <NavArrow dir="right"/>
        </div>

        {[
          { home: 'Arsenal',   away: 'Brighton',  pick: '2-1', actual: '2-1', pts: 12, day: 'Sun · 16:30', exact: true },
          { home: 'Liverpool', away: 'Tottenham', pick: '3-0', actual: '4-2', pts: 4,  day: 'Sun · 14:00', exact: false },
          { home: 'Newcastle', away: 'Fulham',    pick: '1-2', actual: '2-0', pts: 0,  day: 'Sat · 17:30', exact: false },
        ].map((p, i) => <ScoreTile key={i} p={p}/>)}
      </div>

      <TabBar active="predictions"/>
    </div>
  );
}

function NavArrow({ dir }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 16,
      background: tokens.card, border: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.fg,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
      </svg>
    </div>
  );
}

function ScoreTile({ p }) {
  const colorPts = p.exact ? tokens.brand : p.pts > 0 ? tokens.amber : tokens.fgDim;
  return (
    <Card style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, marginBottom: 4 }}>{p.day}</div>
          <div style={{
            fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: tokens.fg,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
          }}>
            {p.home} <span style={{ color: tokens.fgDim, fontWeight: 400 }}>vs</span> {p.away}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <ScoreCell label="Pick" value={p.pick} dim/>
            <ScoreCell label="Final" value={p.actual} bold/>
          </div>
        </div>
        <div style={{
          textAlign: 'center', minWidth: 72, padding: '10px 8px',
          background: p.exact ? tokens.brandSoft : 'rgba(255,255,255,0.03)',
          border: `1px solid ${p.exact ? tokens.brandSoftBorder : tokens.border}`,
          borderRadius: tokens.radiusMd,
        }}>
          <div style={{
            fontFamily: mono, fontSize: 22, fontWeight: 700, color: colorPts,
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{p.pts > 0 ? `+${p.pts}` : '0'}</div>
          <div style={{
            fontFamily: sans, fontSize: 9.5, color: tokens.fgMuted, marginTop: 4,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          }}>{p.exact ? 'Exact' : 'pts'}</div>
        </div>
      </div>
    </Card>
  );
}

function ScoreCell({ label, value, dim, bold }) {
  return (
    <div>
      <span style={{
        fontFamily: sans, fontSize: 10.5, color: tokens.fgMuted,
        letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
      }}>{label} </span>
      <span style={{
        fontFamily: mono, fontSize: 12.5, fontWeight: bold ? 700 : 500,
        color: dim ? tokens.fgMuted : tokens.fg, fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LeaderboardScreen
// ─────────────────────────────────────────────────────────────
function LeaderboardScreen() {
  const rows = [
    { rank: 1, name: 'Jules Cabrera', pts: 312, picks: 84, streak: 6, exact: 4 },
    { rank: 2, name: 'Aria Khan',     pts: 297, picks: 82, streak: 4, exact: 3, isMe: true },
    { rank: 3, name: 'Sam Reyes',     pts: 281, picks: 78, streak: 2, exact: 2 },
    { rank: 4, name: 'Mira Patel',    pts: 254, picks: 80, streak: 0, exact: 1 },
    { rank: 5, name: 'Theo Sundberg', pts: 238, picks: 76, streak: 0, exact: 1 },
    { rank: 6, name: 'Pari Verma',    pts: 219, picks: 70, streak: 1, exact: 0 },
    { rank: 7, name: 'Luca Bianchi',  pts: 207, picks: 72, streak: 0, exact: 0 },
  ];
  return (
    <div style={{ background: tokens.bg, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <StatusBar/>
      <AppHeader
        title="Leaders"
        subtitle="Office · 14 players"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn glyph="filter"/>
            <Avatar name="Aria Khan" size={36}/>
          </div>
        }
      />

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          background: tokens.card, borderRadius: tokens.radiusMd,
          border: `1px solid ${tokens.border}`, padding: 4,
        }}>
          {['Week', 'Month', 'Season', 'All'].map((p, i) => (
            <div key={p} style={{
              padding: '8px 0', textAlign: 'center', borderRadius: tokens.radiusSm,
              background: i === 2 ? tokens.brand : 'transparent',
              color: i === 2 ? '#031A11' : tokens.fgMuted,
              fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
            }}>{p}</div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px 110px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr',
          alignItems: 'end', gap: 8, marginBottom: 8, padding: '8px 4px',
        }}>
          <PodiumCol r={rows[1]} place={2} h={62}/>
          <PodiumCol r={rows[0]} place={1} h={86}/>
          <PodiumCol r={rows[2]} place={3} h={48}/>
        </div>

        {rows.slice(3).map((r) => <LbRow key={r.rank} r={r}/>)}

        <Card style={{
          padding: 0,
          borderColor: tokens.brandSoftBorder,
          background: 'linear-gradient(180deg, rgba(16,224,137,0.08), transparent 80%)',
        }}>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28, textAlign: 'center', fontFamily: mono,
              fontSize: 14, fontWeight: 700, color: tokens.brand,
            }}>2</span>
            <Avatar name="Aria Khan" size={34}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: sans, fontSize: 13.5, fontWeight: 700, color: tokens.fg, letterSpacing: '-0.01em',
              }}>
                Aria Khan
                <span style={{ color: tokens.brand, fontSize: 11, marginLeft: 6 }}>· you</span>
              </div>
              <div style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, marginTop: 1 }}>
                82 picks · 4 streak · 🎯 3 exact
              </div>
            </div>
            <span style={{
              fontFamily: mono, fontSize: 16, fontWeight: 700, color: tokens.brand,
              fontVariantNumeric: 'tabular-nums',
            }}>297</span>
          </div>
        </Card>
      </div>

      <TabBar active="leaderboard"/>
    </div>
  );
}

function PodiumCol({ r, place, h }) {
  const medal = { 1: '#F2C744', 2: '#C5CDD9', 3: '#CB8C5C' }[place];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <Avatar name={r.name} size={place === 1 ? 48 : 40}/>
      <div style={{
        fontFamily: sans, fontSize: place === 1 ? 12.5 : 11.5, fontWeight: 600,
        color: tokens.fg, textAlign: 'center', letterSpacing: '-0.01em',
        whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{r.name.split(' ')[0]}</div>
      <div style={{
        fontFamily: mono, fontSize: place === 1 ? 18 : 15, fontWeight: 700,
        color: tokens.fg, fontVariantNumeric: 'tabular-nums',
      }}>{r.pts}</div>
      <div style={{
        width: '100%', height: h,
        background: `linear-gradient(180deg, ${medal}33, ${medal}11)`,
        border: `1px solid ${medal}55`, borderBottom: 'none',
        borderTopLeftRadius: tokens.radiusMd, borderTopRightRadius: tokens.radiusMd,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: medal, fontFamily: sans, fontSize: 20, fontWeight: 800,
      }}>{place}</div>
    </div>
  );
}

function LbRow({ r }) {
  const isMe = r.isMe;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      background: isMe ? tokens.brandSoft : tokens.card,
      border: `1px solid ${isMe ? tokens.brandSoftBorder : tokens.border}`,
      borderRadius: tokens.radiusMd,
    }}>
      <span style={{
        width: 26, textAlign: 'center', fontFamily: mono,
        fontSize: 13, fontWeight: 700, color: tokens.fgMuted,
      }}>{r.rank}</span>
      <Avatar name={r.name} size={32}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: sans, fontSize: 13, fontWeight: 600, color: tokens.fg,
          letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {r.name}
          {r.streak >= 3 && <span style={{ fontFamily: sans, fontSize: 10, color: tokens.amber }}>🔥{r.streak}</span>}
          {r.exact >= 2 && <span style={{ fontFamily: sans, fontSize: 10 }}>🎯{r.exact}</span>}
        </div>
        <div style={{ fontFamily: sans, fontSize: 11, color: tokens.fgMuted, marginTop: 1 }}>
          {r.picks} picks
        </div>
      </div>
      <span style={{
        fontFamily: mono, fontSize: 14, fontWeight: 700, color: tokens.fg,
        fontVariantNumeric: 'tabular-nums',
      }}>{r.pts}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div style={{
      background: tokens.bg, height: '100%', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <StatusBar/>
      <svg style={{ position: 'absolute', top: 0, right: 0, opacity: 0.06 }}
           width="390" height="500" viewBox="0 0 390 500" fill="none">
        <circle cx="350" cy="120" r="120" stroke={tokens.brand} strokeWidth="1"/>
        <circle cx="350" cy="120" r="60"  stroke={tokens.brand} strokeWidth="1"/>
        <line x1="0" y1="120" x2="390" y2="120" stroke={tokens.brand} strokeWidth="1"/>
      </svg>

      <div style={{ padding: '48px 32px 0', position: 'relative' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(135deg, ${tokens.brand}, ${tokens.brandDeep})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 32px -8px ${tokens.brand}66`,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="13" stroke="#031A11" strokeWidth="2"/>
            <path d="M16 3l2.5 6 6.5 1.5-2.5 5.5 2.5 5.5-6.5 1.5L16 29l-2.5-6L7 21.5l2.5-5.5L7 10.5 13.5 9z"
                  stroke="#031A11" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
          </svg>
        </div>

        <div style={{
          marginTop: 36,
          fontFamily: sans, fontSize: 36, fontWeight: 700,
          color: tokens.fg, letterSpacing: '-0.035em', lineHeight: 1.05,
        }}>
          Predict the<br/>beautiful game.
        </div>
        <div style={{
          marginTop: 12,
          fontFamily: sans, fontSize: 14.5, color: tokens.fgMuted,
          letterSpacing: '-0.01em', lineHeight: 1.45,
        }}>
          Score your picks against friends across the Premier League, UCL and more.
        </div>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{
          height: 54, borderRadius: tokens.radiusLg,
          background: tokens.brand, color: '#031A11',
          fontFamily: sans, fontSize: 16, fontWeight: 700,
          border: 'none', letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 12px 32px -10px ${tokens.brand}77`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9c-.2 1.4-1 2.6-2.2 3.4v2.8h3.6c2.1-2 3.2-4.8 3.2-8.3z"/>
            <path d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.8c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.4v2.8C4.2 20.6 7.8 23 12 23z" opacity=".85"/>
          </svg>
          Continue with Google
        </button>
        <button style={{
          height: 54, borderRadius: tokens.radiusLg,
          background: tokens.card, color: tokens.fg,
          border: `1px solid ${tokens.border}`,
          fontFamily: sans, fontSize: 16, fontWeight: 600,
          letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.5 12.5c0-2.7 2.2-4 2.3-4-1.3-1.9-3.2-2.1-3.9-2.1-1.7-.2-3.2 1-4.1 1-.8 0-2.1-1-3.5-.9-1.8 0-3.4 1-4.4 2.7-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 2 2.7 3.4 2.7 1.4-.1 1.9-.9 3.5-.9 1.7 0 2.1.9 3.5.9 1.5 0 2.4-1.3 3.3-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-2.8-1.1-2.9-4.5zM14.9 4.6c.8-.9 1.3-2.2 1.1-3.5-1.1.1-2.4.7-3.2 1.6-.7.8-1.3 2.1-1.2 3.4 1.3.1 2.5-.6 3.3-1.5z"/>
          </svg>
          Continue with Apple
        </button>
        <div style={{
          marginTop: 8, textAlign: 'center',
          fontFamily: sans, fontSize: 11.5, color: tokens.fgDim,
          letterSpacing: '-0.01em', lineHeight: 1.4,
        }}>
          By continuing, you agree to our Terms and Privacy Policy.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MyScoreScreen, LeaderboardScreen, LoginScreen });
