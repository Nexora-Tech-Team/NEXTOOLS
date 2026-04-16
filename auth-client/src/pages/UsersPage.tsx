import { useEffect, useState } from 'react';
import {
  Users, Plus, Pencil, Trash2, X, Check, Shield, User as UserIcon,
  Search, RefreshCw,
} from 'lucide-react';
import { usersApi } from '../api/users';
import { authApi } from '../api/auth';
import type { User, UpdateUserRequest, RegisterRequest } from '../types';
import { useAuth } from '../context/useAuth';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<RegisterRequest>({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll();
      setUsers(res.data || []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showMsg = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.register(addForm);
      showMsg('User added successfully');
      setShowAdd(false);
      setAddForm({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showMsg(msg || 'Failed to add user', true);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await usersApi.update(editingUser.id, editForm);
      showMsg('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showMsg(msg || 'Failed to update user', true);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    try {
      await usersApi.delete(id);
      showMsg('User deleted');
      fetchUsers();
    } catch {
      showMsg('Failed to delete user', true);
    }
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active });
  };

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) ||
           u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">User Management</h1>
            <p className="text-slate-400 text-sm">{users.length} total users</p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={fetchUsers} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-700 px-3 text-slate-300 transition-colors hover:bg-slate-600 sm:flex-none" aria-label="Refresh users">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 sm:flex-none"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Toast messages */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-slate-500">No users found</div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/30">
                    <span className="text-sm font-medium text-indigo-300">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{u.name}</div>
                    <div className="truncate text-xs text-slate-400">{u.email}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(u)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    aria-label={`Edit ${u.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {isAdmin && u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Delete ${u.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Role</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    u.role === 'admin'
                      ? 'border border-purple-500/30 bg-purple-500/15 text-purple-300'
                      : 'border border-slate-600 bg-slate-700 text-slate-300'
                  }`}>
                    {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    {u.role}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    u.is_active
                      ? 'border border-green-500/30 bg-green-500/15 text-green-400'
                      : 'border border-red-500/30 bg-red-500/15 text-red-400'
                  }`}>
                    {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Created</p>
                  <p className="text-sm text-slate-300">{new Date(u.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-700 bg-slate-800 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3.5">User</th>
              <th className="text-left px-5 py-3.5">Role</th>
              <th className="text-left px-5 py-3.5">Status</th>
              <th className="text-left px-5 py-3.5">Created</th>
              <th className="text-right px-5 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-500">No users found</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-400 font-medium text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{u.name}</div>
                        <div className="text-slate-400 text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : 'bg-slate-700 text-slate-300 border border-slate-600'
                    }`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.is_active
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <Modal title="Add New User" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <Field label="Name">
              <input required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className={inputCls} placeholder="Full name" />
            </Field>
            <Field label="Email">
              <input required type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className={inputCls} placeholder="user@example.com" />
            </Field>
            <Field label="Password">
              <input required type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className={inputCls} placeholder="Min. 6 characters" />
            </Field>
            <Field label="Role">
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value as 'admin' | 'user' })} className={inputCls}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">Add User</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <Modal title={`Edit: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Name">
              <input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label="New Password (optional)">
              <input type="password" value={editForm.password || ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className={inputCls} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="Role">
              <select value={editForm.role || 'user'} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })} className={inputCls}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={editForm.is_active ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })} className={inputCls}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Shared sub-components
const inputCls = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white" aria-label="Close modal"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
