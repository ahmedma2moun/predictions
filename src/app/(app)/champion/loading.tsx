export default function ChampionLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted rounded-[14px] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
