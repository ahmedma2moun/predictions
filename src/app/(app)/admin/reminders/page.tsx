import { getReminderHealth } from '@/lib/reminders/health';
import { auth, isSessionAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Authorization is enforced by the admin layout. This page is read-only.
export default async function ReminderHealthPage() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) redirect('/dashboard');
  const health = await getReminderHealth();
  return <section className="space-y-6">
    <div><h2 className="text-xl font-semibold">Reminder health</h2><p className="text-muted-foreground">{health.note} Reload for current status.</p></div>
    <p role="status">Overdue unfinished jobs: <strong>{health.overdue}</strong></p>
    <div className="grid gap-6 sm:grid-cols-2">
      {[{ title: 'Jobs', rows: health.jobs }, { title: 'Deliveries', rows: health.deliveries }].map(group => <div key={group.title}>
        <h3 className="font-semibold mb-2">{group.title}</h3>
        <table className="w-full text-sm"><thead><tr><th className="text-left">Status</th><th className="text-right">Count</th></tr></thead>
          <tbody>{group.rows.map(row => <tr key={row.status}><td>{row.status}</td><td className="text-right">{row._count}</td></tr>)}</tbody>
        </table>{!group.rows.length && <p>No records yet.</p>}
      </div>)}
    </div>
    <div><h3 className="font-semibold mb-2">Recent problems</h3>
      <ul className="space-y-2">{health.recentProblems.map(job => <li className="rounded border p-3 break-words" key={job.id}>
        Job {job.id} · Match {job.matchId} · {job.kind} · {job.status}<br />{job.lastError ?? 'Reminder expired before completion'}
      </li>)}</ul>{!health.recentProblems.length && <p>No recorded problems.</p>}
    </div>
    <div><h3 className="font-semibold mb-2">Fixture refresh requests</h3>
      <ul className="space-y-2">{health.refreshes.map(row => <li key={row.leagueId} className="rounded border p-3 break-words">
        League {row.leagueId} · Completed revision {row.completedRevision} of {row.revision}<br />
        {row.lastError ?? 'No recorded error'} · Updated {row.updatedAt.toISOString()}
      </li>)}</ul>
    </div>
  </section>;
}
