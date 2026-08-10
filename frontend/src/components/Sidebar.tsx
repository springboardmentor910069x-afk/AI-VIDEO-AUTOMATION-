import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import Avatar from "@/components/ui/Avatar";
import Menu, { MenuItem } from "@/components/ui/Menu";
import { FilmIcon, LogoutIcon, XMarkIcon } from "@/components/Icons";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    {
      to: "/dashboard",
      label: "Videos",
      icon: FilmIcon,
      current: location.pathname === "/dashboard",
    },
  ];

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <FilmIcon className="h-5 w-5" />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
            ClipMind<span className="text-brand-600 dark:text-brand-400"> AI</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          aria-label="Close navigation"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Workspace
        </p>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              item.current
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            )}
            aria-current={item.current ? "page" : undefined}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
        <Menu
          label="Account menu"
          trigger={
            <span className="flex min-w-0 items-center gap-3 py-1.5 pl-1.5 pr-2">
              <Avatar name={user?.full_name || user?.username || "User"} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user?.full_name || user?.username}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {user?.email}
                </span>
              </span>
            </span>
          }
        >
          <MenuItem danger onClick={logout}>
            <LogoutIcon className="h-4 w-4" />
            Log out
          </MenuItem>
        </Menu>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        {body}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden dark:border-slate-800 dark:bg-slate-900",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {body}
      </div>
    </>
  );
}
