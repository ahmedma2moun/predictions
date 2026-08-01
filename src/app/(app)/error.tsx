"use client";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("[app] Unhandled render error", { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="text-sm text-muted-foreground">
            This page hit an unexpected error. Try again, or head back to your matches.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => (window.location.href = "/matches")}>
              Go to Matches
            </Button>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
