import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-brand-600 dark:bg-slate-950 dark:text-brand-400">
        <Spinner className="h-6 w-6" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
