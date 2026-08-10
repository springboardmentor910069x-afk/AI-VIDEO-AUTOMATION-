import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
