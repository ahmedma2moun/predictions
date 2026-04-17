const fs = require('fs');
const path = require('path');

const files = [
  'src/lib/services/prediction-service.ts',
  'src/lib/services/match-service.ts',
  'src/lib/results-processor.ts',
  'src/lib/matches-processor.ts',
  'src/app/api/mobile/matches/[matchId]/predictions/route.ts',
  'src/app/api/mobile/matches/[matchId]/h2h/route.ts',
  'src/app/api/matches/[matchId]/h2h/route.ts',
  'src/app/api/cron/prediction-reminder/route.ts',
  'src/app/api/cron/daily-reminder/route.ts',
  'src/app/api/admin/test-email/route.ts',
  'src/app/api/admin/recalculate/route.ts',
  'src/app/api/admin/results/route.ts',
  'src/app/api/admin/matches/route.ts',
  'src/app/(app)/predictions/page.tsx',
  'src/app/(app)/matches/page.tsx',
  'src/app/(app)/admin/page.tsx',
  'src/lib/leaderboard.ts'
];

for (const rel of files) {
  const p = path.join('d:\\Antigravity\\Matches Prediction\\football-predictions', rel);
  if (!fs.existsSync(p)) continue;
  
  let content = fs.readFileSync(p, 'utf-8');
  let changed = false;

  let needsMatch = false;
  let needsPred = false;

  if (content.includes('prisma.match.')) {
    content = content.replace(/prisma\.match\./g, 'MatchRepository.');
    needsMatch = true;
    changed = true;
  }
  
  if (content.includes('prisma.prediction.')) {
    content = content.replace(/prisma\.prediction\./g, 'PredictionRepository.');
    needsPred = true;
    changed = true;
  }

  if (changed) {
    const imports = [];
    if (needsMatch && !content.includes('@/lib/repositories/match-repository')) {
      imports.push(`import { MatchRepository } from '@/lib/repositories/match-repository';`);
    }
    if (needsPred && !content.includes('@/lib/repositories/prediction-repository')) {
      imports.push(`import { PredictionRepository } from '@/lib/repositories/prediction-repository';`);
    }

    if (imports.length > 0) {
      const lines = content.split('\n');
      let insertIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('use client') || lines[i].includes('use server')) {
          insertIdx = i + 1;
        } else if (lines[i].startsWith('import ')) {
          insertIdx = i + 1;
        }
      }
      lines.splice(insertIdx, 0, ...imports);
      content = lines.join('\n');
    }

    fs.writeFileSync(p, content, 'utf-8');
    console.log('Updated ' + rel);
  }
}
