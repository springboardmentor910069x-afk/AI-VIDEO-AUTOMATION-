import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-bold">
            ClipMind AI
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm hover:underline">
                  Dashboard
                </Link>
                <span className="text-sm text-gray-500">{user.username}</span>
                <button onClick={logout} className="text-sm text-red-600 hover:underline">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm hover:underline">
                  Login
                </Link>
                <Link to="/register" className="text-sm hover:underline">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
