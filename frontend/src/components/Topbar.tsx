import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Avatar from "@/components/ui/Avatar";
import Menu, { MenuItem } from "@/components/ui/Menu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { LogoutIcon, MenuIcon, MoonIcon, SunIcon } from "@/components/Icons";

interface TopbarProps {
  title: string;
  onOpenMobileNav: () => void;
}

export default function Topbar({ title, onOpenMobileNav }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Open navigation"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
      </button>

      <Menu
        label="Account menu"
        trigger={
          <span className="flex items-center gap-2">
            <Avatar name={user?.full_name || user?.username || "User"} size="sm" />
            <span className="hidden text-sm font-medium text-slate-700 sm:block dark:text-slate-200">
              {user?.full_name || user?.username}
            </span>
          </span>
        }
      >
        <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {user?.full_name || user?.username}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        </div>
        <MenuItem danger onClick={() => setLogoutConfirmOpen(true)}>
          <LogoutIcon className="h-4 w-4" />
          Log out
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        message="You will be signed out and will need to sign in again to access your workspace."
        confirmLabel="Log out"
        danger
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          logout();
          navigate("/login", { replace: true });
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </header>
  );
}
