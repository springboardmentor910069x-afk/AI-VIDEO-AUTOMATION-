import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome, {user?.full_name ?? user?.username}!</p>
      <p className="mt-1 text-sm text-gray-400">Role: {user?.role}</p>
    </div>
  );
}
