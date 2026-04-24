import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Football Predictions",
  description: "Predict football match scores and compete with friends",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const htmlClass = theme;

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
