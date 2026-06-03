import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import { AuthWrapper } from "@/components/auth-wrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CollabNotes — Real-Time Collaborative Workspace",
  description: "Create, share, and collaborate on notes in real-time with your team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.variable} font-sans min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased`}
      >
        <AuthProvider>
          <AuthWrapper>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
