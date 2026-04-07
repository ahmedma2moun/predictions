import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matches = await prisma.match.findMany({
    where: { status: "finished" },
    orderBy: { kickoffTime: "desc" },
    include: {
      predictions: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { pointsAwarded: "desc" },
      },
    },
    take: 100,
  });

  const serialized = matches.map((m) => ({
    id: m.id.toString(),
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    kickoffTime: m.kickoffTime.toISOString(),
    resultHomeScore: m.resultHomeScore,
    resultAwayScore: m.resultAwayScore,
    predictions: m.predictions.map((p) => ({
      id: p.id.toString(),
      userId: p.userId.toString(),
      userName: p.user.name,
      userEmail: p.user.email,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      pointsAwarded: p.pointsAwarded,
      scoringBreakdown: (p.scoringBreakdown as { rules: { ruleName: string; pointsAwarded: number; matched: boolean }[] } | null)?.rules ?? null,
    })),
  }));

  return NextResponse.json({ matches: serialized });
}
