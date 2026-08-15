import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { getQStashClient } from '@/lib/qstash';

/**
 * Idempotent: each schedule has a fixed scheduleId, so re-running this
 * updates the existing schedule instead of creating duplicates.
 *
 * Requires QSTASH_TOKEN and NEXTAUTH_URL (pointing at the deployed app,
 * not localhost — QStash calls a public HTTPS URL) in the environment.
 * Auth on the destination routes is via QStash's own request signature
 * (see src/lib/cron-auth.ts), so no secret header is needed here.
 */
async function main() {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error('NEXTAUTH_URL is not set');

  const client = getQStashClient();

  const schedules = [
    {
      scheduleId:  'predictions-fetch-matches',
      destination: `${baseUrl.replace(/\/$/, '')}/api/cron/fetch-matches`,
      cron:        'CRON_TZ=Africa/Cairo 0 20 * * 4', // every Thursday, 8 PM Cairo local (DST-aware)
      method:      'GET' as const,
    },
    {
      scheduleId:  'predictions-daily-reminder',
      destination: `${baseUrl.replace(/\/$/, '')}/api/cron/daily-reminder`,
      cron:        '0 9 * * *', // daily, 09:00 UTC
      method:      'GET' as const,
    },
    {
      scheduleId:  'predictions-db-export',
      destination: `${baseUrl.replace(/\/$/, '')}/api/cron/db-export`,
      cron:        '0 9 * * *', // daily, 09:00 UTC
      method:      'GET' as const,
    },
  ];

  for (const schedule of schedules) {
    const { scheduleId } = await client.schedules.create(schedule);
    console.log(`OK  ${schedule.scheduleId} -> ${schedule.destination} (${schedule.cron}) [${scheduleId}]`);
  }
}

main()
  .then(() => console.log('Done — verify at console.upstash.com/qstash/schedules'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
