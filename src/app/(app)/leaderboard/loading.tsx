import { Card, CardContent } from "@/components/ui/card";

export default function LeaderboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 w-36 bg-muted rounded animate-pulse" />
      <div className="h-10 w-full bg-muted rounded animate-pulse" />
      <Card>
        <CardContent className="pt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <div className="h-5 w-5 bg-muted rounded animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                <div className="h-3 w-36 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
