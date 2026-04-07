import { Card, CardContent } from "@/components/ui/card";

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-28 bg-muted rounded animate-pulse" />
          <div className="h-5 w-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-3 w-8 bg-muted rounded animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
            <div className="h-7 w-14 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-3 w-8 bg-muted rounded animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PredictionsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 bg-muted rounded animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="h-10 w-full bg-muted rounded animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
