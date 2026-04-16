import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Trash2, Pencil, X, ChevronRight, ListTodo } from 'lucide-react';
import { projectsApi } from '../api/projects';
import type { Project, CreateProjectRequest } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectRequest>({ name: '', description: '' });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.getAll();
      setProjects(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectsApi.create(form);
      showToast('Project created!');
      setShowAdd(false);
      setForm({ name: '', description: '' });
      fetchProjects();
    } catch {
      showToast('Failed to create project', false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject) return;
    try {
      await projectsApi.update(editProject.id, form);
      showToast('Project updated!');
      setEditProject(null);
      fetchProjects();
    } catch {
      showToast('Failed to update project', false);
    }
  };

  const handleDelete = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    try {
      await projectsApi.delete(p.id);
      showToast('Project deleted');
      fetchProjects();
    } catch {
      showToast('Failed to delete project', false);
    }
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setForm({ name: p.name, description: p.description });
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-slate-400 text-sm">{projects.length} project aktif</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm({ name: '', description: '' }); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-3 border ${toast.ok
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Belum ada project. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-indigo-500 transition-colors group cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{p.name}</h3>
                  <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">
                    {p.description || <span className="italic">No description</span>}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5" /> {p.task_count} tasks
                  </span>
                  {p.owner && (
                    <span className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-indigo-600/40 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
                        {p.owner.name.charAt(0).toUpperCase()}
                      </div>
                      {p.owner.name}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAdd || editProject) && (
        <Modal
          title={editProject ? `Edit: ${editProject.name}` : 'New Project'}
          onClose={() => { setShowAdd(false); setEditProject(null); }}
        >
          <form onSubmit={editProject ? handleUpdate : handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. DevTrack v2"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowAdd(false); setEditProject(null); }} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                {editProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
