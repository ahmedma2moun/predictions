import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Format a UTC Date to CLT (UTC+2) human-readable string
function formatDate(date: Date): string {
  const clt = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return clt.toUTCString().replace(' GMT', '');
}

function formatShortDate(date: Date): string {
  const clt = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return clt.toISOString().slice(0, 16).replace('T', ' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchForEmail {
  homeTeamName: string;
  awayTeamName: string;
  kickoffTime: Date;
  leagueName: string;
}

export interface ResultMatchForEmail {
  homeTeamName: string;
  awayTeamName: string;
  kickoffTime: Date;
  leagueName: string;
  resultHomeScore: number;
  resultAwayScore: number;
  predictionHomeScore: number | null;
  predictionAwayScore: number | null;
  pointsAwarded: number;
  scoringBreakdown: { ruleName: string; pointsAwarded: number; matched: boolean }[] | null;
}

// ─── New Matches Email ────────────────────────────────────────────────────────

export async function sendNewMatchesEmail(to: string | null | undefined, matches: MatchForEmail[]): Promise<void> {
  if (!to) return;
  if (!matches.length) return;

  // Group by league, sorted by kickoff ascending within each league
  const grouped = new Map<string, MatchForEmail[]>();
  for (const m of [...matches].sort((a, b) => a.kickoffTime.getTime() - b.kickoffTime.getTime())) {
    const list = grouped.get(m.leagueName) ?? [];
    list.push(m);
    grouped.set(m.leagueName, list);
  }

  const leagueBlocks = [...grouped.entries()]
    .map(([league, ms]) => {
      const rows = ms
        .map(
          m => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${formatShortDate(m.kickoffTime)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${m.homeTeamName}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;">vs</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${m.awayTeamName}</td>
          </tr>`
        )
        .join('');

      return `
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;background:#f5f5f5;padding:8px 12px;border-radius:6px;">${league}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="color:#888;font-size:12px;">
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Date (CLT)</th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Home</th>
                <th style="padding:6px 12px;"></th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Away</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#22c55e;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;color:#fff;font-size:20px;">New Matches This Week</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${matches.length} match${matches.length > 1 ? 'es' : ''} added — submit your predictions!</p>
      </div>
      <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
        ${leagueBlocks}
        <div style="margin-top:16px;text-align:center;">
          <a href="${process.env.NEXTAUTH_URL}/matches" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;">Go to Matches &rarr;</a>
        </div>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `Football Predictions <${process.env.GMAIL_USER}>`,
    to,
    subject: `${matches.length} new match${matches.length > 1 ? 'es' : ''} added — place your predictions!`,
    html,
  });
}

// ─── Results Email ────────────────────────────────────────────────────────────

export async function sendResultsEmail(to: string | null | undefined, matches: ResultMatchForEmail[]): Promise<void> {
  if (!to) return;
  if (!matches.length) return;

  const totalPoints = matches.reduce((sum, m) => sum + m.pointsAwarded, 0);

  // Group by league, sorted by kickoff ascending
  const grouped = new Map<string, ResultMatchForEmail[]>();
  for (const m of [...matches].sort((a, b) => a.kickoffTime.getTime() - b.kickoffTime.getTime())) {
    const list = grouped.get(m.leagueName) ?? [];
    list.push(m);
    grouped.set(m.leagueName, list);
  }

  const leagueBlocks = [...grouped.entries()]
    .map(([league, ms]) => {
      const rows = ms
        .map(m => {
          const hasPrediction = m.predictionHomeScore !== null && m.predictionAwayScore !== null;
          const predStr = hasPrediction ? `${m.predictionHomeScore} – ${m.predictionAwayScore}` : '<em style="color:#aaa;">no prediction</em>';
          const resultStr = `${m.resultHomeScore} – ${m.resultAwayScore}`;
          const pointsBadge = hasPrediction
            ? `<span style="display:inline-block;background:${m.pointsAwarded > 0 ? '#22c55e' : '#e5e7eb'};color:${m.pointsAwarded > 0 ? '#fff' : '#555'};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;">${m.pointsAwarded} pt${m.pointsAwarded !== 1 ? 's' : ''}</span>`
            : `<span style="display:inline-block;background:#e5e7eb;color:#555;border-radius:999px;padding:2px 10px;font-size:12px;">—</span>`;

          const breakdownStr = m.scoringBreakdown
            ? m.scoringBreakdown
                .filter(r => r.matched)
                .map(r => `<span style="font-size:11px;color:#22c55e;">✓ ${r.ruleName} (+${r.pointsAwarded})</span>`)
                .join('&nbsp;&nbsp;') || '<span style="font-size:11px;color:#aaa;">no rules matched</span>'
            : '';

          return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${formatShortDate(m.kickoffTime)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:500;">${m.homeTeamName} vs ${m.awayTeamName}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;">${resultStr}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${predStr}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${pointsBadge}<br/><div style="margin-top:4px;">${breakdownStr}</div></td>
          </tr>`;
        })
        .join('');

      return `
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;background:#f5f5f5;padding:8px 12px;border-radius:6px;">${league}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="color:#888;font-size:11px;">
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Date (CLT)</th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Match</th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Result</th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Your Prediction</th>
                <th style="padding:6px 12px;text-align:left;font-weight:500;">Score</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#3b82f6;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;color:#fff;font-size:20px;">Match Results & Your Scores</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${matches.length} match${matches.length > 1 ? 'es' : ''} scored &mdash; you earned <strong>${totalPoints} point${totalPoints !== 1 ? 's' : ''}</strong> total</p>
      </div>
      <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
        ${leagueBlocks}
        <div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-radius:6px;border-left:4px solid #22c55e;">
          <strong>Total points earned this round: ${totalPoints}</strong>
        </div>
        <div style="margin-top:16px;text-align:center;">
          <a href="${process.env.NEXTAUTH_URL}/predictions" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;">View My Picks &rarr;</a>
        </div>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `Football Predictions <${process.env.GMAIL_USER}>`,
    to,
    subject: `Results in — you earned ${totalPoints} point${totalPoints !== 1 ? 's' : ''}!`,
    html,
  });
}
