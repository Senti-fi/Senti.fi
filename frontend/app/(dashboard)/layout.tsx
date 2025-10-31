// src/app/dashboard/layout.tsx
import AuthGuardClient from "@/components/AuthGuardClient";
import { Sidebar } from "@/components/dashboard";
import BottomNav from "@/components/dashboard/BottomNav";
import TopNav from "@/components/dashboard/topnav";
// import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuardClient>
      <div className="flex h-screen bg-zinc-900 text-white">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col relative max-md:pb-20">
          <TopNav />
          {children}
        </div>

        {/* Mobile bottom nav (fixed) */}
        <div className="md:hidden fixed inset-x-0 bottom-0">
          <BottomNav />
        </div>
      </div>
    </AuthGuardClient>
  );
}
