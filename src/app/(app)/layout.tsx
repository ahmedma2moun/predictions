import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-12 md:pt-16 md:pb-0 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
