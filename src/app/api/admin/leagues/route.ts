import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { fetchLeagues } from '@/lib/football-api';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const leagues = await League.find().sort({ name: 1 }).lean();
  return NextResponse.json(leagues.map(l => ({ ...l, _id: l._id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const body = await req.json();

  if (body.action === 'fetch') {
    const apiLeagues = await fetchLeagues();
    const results = await Promise.allSettled(
      apiLeagues.flatMap(l =>
        l.seasons.filter(s => s.current).map(s =>
          League.findOneAndUpdate(
            { externalId: l.league.id },
            { externalId: l.league.id, name: l.league.name, country: l.country.name, logo: l.league.logo, season: s.year },
            { upsert: true, new: true }
          )
        )
      )
    );
    return NextResponse.json({ synced: results.filter(r => r.status === 'fulfilled').length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const { id, isActive } = await req.json();
  const league = await League.findByIdAndUpdate(id, { isActive }, { new: true });
  return NextResponse.json({ ...league?.toObject(), _id: league?._id.toString() });
}
