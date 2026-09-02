import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Videos",
  "/dashboard/analytics": "Analytics",
  "/dashboard/videos": "Video details",
};

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard/videos/")) return "Video details";
  return PAGE_TITLES[pathname] ?? "Workspace";
}

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={pageTitle(location.pathname)} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
