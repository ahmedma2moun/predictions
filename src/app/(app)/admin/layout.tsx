import { auth, isSessionAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) redirect("/dashboard");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">⚙️ Admin</h1>
      <AdminNav />
      {children}
    </div>
  );
}
