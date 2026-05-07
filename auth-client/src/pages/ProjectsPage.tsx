import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Trash2, Pencil, X, ChevronRight, ListTodo } from 'lucide-react';
import { projectsApi } from '../api/projects';
import type { Project, CreateProjectRequest } from '../types';
import { useAuth } from '../context/useAuth';
import { ProjectCardSkeleton, Spinner } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectRequest>({ name: '', description: '' });

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
    setSaving(true);
    try {
      await projectsApi.create(form);
      showToast('Project created!');
      setShowAdd(false);
      setForm({ name: '', description: '' });
      fetchProjects();
    } catch {
      showToast('Failed to create project', 'error');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject) return;
    setSaving(true);
    try {
      await projectsApi.update(editProject.id, form);
      showToast('Project updated!');
      setEditProject(null);
      fetchProjects();
    } catch {
      showToast('Failed to update project', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    try {
      await projectsApi.delete(p.id);
      showToast('Project deleted');
      fetchProjects();
    } catch {
      showToast('Failed to delete project', 'error');
    }
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setForm({ name: p.name, description: p.description });
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Projects</h1>
            <p className="text-sm text-slate-400">{projects.length} active projects</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm({ name: '', description: '' }); }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 sm:w-auto"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <ProjectCardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-5">
            <FolderKanban className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-slate-300 font-semibold text-lg mb-1">Belum ada project</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">Buat project pertama untuk mulai mengelola task dan tim Anda.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Buat Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="animate-fade-in group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm shadow-black/30 transition-all hover:border-slate-600 hover:shadow-md sm:p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{p.name}</h3>
                  <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">
                    {p.description || <span className="italic">No description</span>}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white" aria-label={`Edit ${p.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400" aria-label={`Delete ${p.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
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
                <ChevronRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-indigo-400 sm:self-center" />
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
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button type="button" onClick={() => { setShowAdd(false); setEditProject(null); }} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
                {saving && <Spinner className="w-3.5 h-3.5" />}
                {editProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

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
