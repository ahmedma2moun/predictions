"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      toast.error("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6">
      {/* Logo tile */}
      <div className="mt-8 w-14 h-14 rounded-2xl border border-primary-soft-border bg-primary-soft flex items-center justify-center">
        <span className="text-2xl">⚽</span>
      </div>

      {/* Hero */}
      <h1 className="text-[36px] font-bold tracking-[-0.035em] leading-[1.1] mt-8">
        Predict the<br />beautiful game.
      </h1>
      <p className="text-[14.5px] text-muted-foreground leading-relaxed mt-3">
        Score your picks against friends across the Premier League, UCL and more.
      </p>

      {/* Spacer */}
      <div className="flex-1 min-h-8" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-[54px] w-full rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-[0_0_20px_rgba(16,224,137,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-[11.5px] text-muted-foreground text-center mt-6 mb-8">
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </div>
  );
}
