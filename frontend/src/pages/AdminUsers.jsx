import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, ShieldCheck, ShieldAlert, Trash2, RefreshCw,
  AlertTriangle, CheckCircle2, Loader2, UserCheck, Video
} from 'lucide-react';

export const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/admin/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load user management records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (u) => {
    const newRole = u.role === 'ROLE_ADMIN' ? 'ROLE_USER' : 'ROLE_ADMIN';
    if (!window.confirm(`Change role of user "${u.username}" to ${newRole}?`)) {
      return;
    }

    try {
      setActionLoading(u.id);
      const updated = await api.put(`/admin/users/${u.id}/role`, { role: newRole });
      setUsers(prev => prev.map(item => item.id === u.id ? updated : item));
    } catch (err) {
      alert('Role update failed: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === user.id) {
      alert('Cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user "${u.username}" and all associated videos?`)) {
      return;
    }

    try {
      setActionLoading(u.id);
      await api.delete(`/admin/users/${u.id}`);
      setUsers(prev => prev.filter(item => item.id !== u.id));
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl flex items-center gap-3">
            <Users className="h-7 w-7 text-brand-400" />
            System User Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Administrative governance: monitor platform members, manage RBAC privileges, and audit usage.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-300 hover:text-white border border-slate-800 transition-all self-start"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-950/30 border border-rose-900/30 p-4 text-sm text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-900 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Videos</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      {u.username}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        u.role === 'ROLE_ADMIN'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {u.role.replace('ROLE_', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-semibold">{u.videoCount || 0}</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={actionLoading === u.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors disabled:opacity-50"
                        >
                          {u.role === 'ROLE_ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={actionLoading === u.id}
                            className="p-1.5 rounded-lg bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 border border-rose-900/30 transition-colors disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};