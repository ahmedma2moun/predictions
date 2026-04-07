import { Card, CardContent } from "@/components/ui/card";

function SkeletonCard() {
  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          <div className="h-5 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          </div>
          <div className="px-4">
            <div className="h-5 w-8 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MatchesLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 w-40 bg-muted rounded animate-pulse" />
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
