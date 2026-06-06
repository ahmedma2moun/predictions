import { auth } from "@/lib/auth";
import { SeasonService } from "@/lib/services/season-service";
import { SeasonsAdminClient } from "./SeasonsAdminClient";

export default async function AdminSeasonsPage() {
  await auth();
  const seasons = await SeasonService.getAllSeasons();

  return (
    <SeasonsAdminClient
      initialSeasons={seasons.map(s => ({
        ...s,
        id: s.id.toString(),
        startDate: s.startDate.toISOString(),
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        oddsEnabled: s.oddsEnabled,
        oddsMin: Number(s.oddsMin),
        oddsMax: Number(s.oddsMax),
      }))}
    />
  );
}
