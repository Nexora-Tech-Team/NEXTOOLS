import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Calendar, User as UserIcon, Flag, Trash2,
  ChevronDown, AlertCircle, Search, ChevronLeft, Check, GripVertical,
  SquarePlus, History, Clock3, Pencil, Users,
} from 'lucide-react';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import { membersApi } from '../api/members';
import { useAuth } from '../context/AuthContext';
import type { Project, Task, User, ProjectMember, CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskPriority, TaskHistoryEntry } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColDef = {
  key: TaskStatus;
  label: string;
  border: string;
  badge: string;
  dot: string;
  priorityBorder?: string;
};

// ─── Column definitions ───────────────────────────────────────────────────────

const BASE_COLUMNS: ColDef[] = [
  { key: 'backlog',     label: 'Backlog',     border: 'border-slate-500',  badge: 'bg-slate-700 text-slate-300',      dot: 'bg-slate-400'  },
  { key: 'todo',        label: 'To Do',       border: 'border-blue-500',   badge: 'bg-blue-500/20 text-blue-300',     dot: 'bg-blue-400'   },
  { key: 'in_progress', label: 'In Progress', border: 'border-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400' },
  { key: 'review',      label: 'Review',      border: 'border-purple-500', badge: 'bg-purple-500/20 text-purple-300', dot: 'bg-purple-400' },
  { key: 'done',        label: 'Done',        border: 'border-green-500',  badge: 'bg-green-500/20 text-green-300',   dot: 'bg-green-400'  },
];

// ─── Custom column color palette ─────────────────────────────────────────────

const CUSTOM_COLORS = [
  { border: 'border-pink-500',   badge: 'bg-pink-500/20 text-pink-300',     dot: 'bg-pink-400'   },
  { border: 'border-orange-500', badge: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400' },
  { border: 'border-cyan-500',   badge: 'bg-cyan-500/20 text-cyan-300',     dot: 'bg-cyan-400'   },
  { border: 'border-teal-500',   badge: 'bg-teal-500/20 text-teal-300',     dot: 'bg-teal-400'   },
  { border: 'border-rose-500',   badge: 'bg-rose-500/20 text-rose-300',     dot: 'bg-rose-400'   },
  { border: 'border-amber-500',  badge: 'bg-amber-500/20 text-amber-300',   dot: 'bg-amber-400'  },
  { border: 'border-lime-500',   badge: 'bg-lime-500/20 text-lime-300',     dot: 'bg-lime-400'   },
  { border: 'border-violet-500', badge: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400' },
];

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; text: string; bg: string; cardBorder: string }> = {
  low:    { label: 'Low',    dot: 'bg-slate-400',  text: 'text-slate-400',  bg: 'bg-slate-700',     cardBorder: 'border-l-slate-500'  },
  medium: { label: 'Medium', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', cardBorder: 'border-l-yellow-500' },
  high:   { label: 'High',   dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10',    cardBorder: 'border-l-red-500'    },
};

const EMPTY_FORM: CreateTaskRequest = {
  title: '', description: '', assignee_id: undefined,
  status: 'backlog', priority: 'medium', due_date: '',
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Task History ─────────────────────────────────────────────────────────────

// interface HistoryChange { field: string; from: string; to: string }
// interface HistoryEntry {
//  id: string;
//  ts: string;
//  userId: number;
//  userName: string;
//  action: 'created' | 'updated';
//  changes: HistoryChange[];
// }

// function lsGetHistory(taskId: number): HistoryEntry[] {
// return lsGet(`task-hist-${taskId}`, []);
// }
// function lsAddHistory(taskId: number, entry: Omit<HistoryEntry, 'id'>) {
// const hist = lsGetHistory(taskId);
// hist.unshift({ ...entry, id: `${Date.now()}-${Math.random()}` });
// lsSet(`task-hist-${taskId}`, hist.slice(0, 50));
// }
function fmtTs(ts: string) {
  return new Date(ts).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const { user } = useAuth();

  // core data
  const [project,  setProject]  = useState<Project | null>(null);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [members,  setMembers]  = useState<ProjectMember[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  // RBAC helpers
  const isAdmin      = user?.role === 'admin';
  const myMembership = members.find(m => m.user_id === user?.id);
  const isOwner      = myMembership?.role === 'owner';
  const canManageProject = isAdmin || isOwner; // delete project, manage members
  const canEditTask  = (task: Task) => isAdmin || task.creator_id === user?.id || task.assignee_id === user?.id;

  // modals / panels
  const [showAddTask,      setShowAddTask]      = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [editTask,         setEditTask]         = useState<Task | null>(null);
  const [selectedTask,     setSelectedTask]     = useState<Task | null>(null);
  const [form,             setForm]             = useState<CreateTaskRequest>(EMPTY_FORM);

  // column customisation (localStorage per project)
  const [colLabels, setColLabels] = useState<Record<string, string>>(
    () => lsGet(`proj-${projectId}-labels`, {}),
  );
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(
    () => new Set(lsGet<string[]>(`proj-${projectId}-collapsed`, [])),
  );
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingLabel,  setEditingLabel]  = useState('');

  // custom columns (localStorage per project)
  const [customCols, setCustomCols] = useState<ColDef[]>(
    () => lsGet(`proj-${projectId}-custom-cols`, []),
  );
  const [addingCol,    setAddingCol]    = useState(false);
  const [newColLabel,  setNewColLabel]  = useState('');

  const columns = [...BASE_COLUMNS, ...customCols];

  // quick-add per column
  const [quickAddCol,   setQuickAddCol]   = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // drag & drop
  const [dragTaskId,  setDragTaskId]  = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // filters
  const [search,          setSearch]          = useState('');
  const [filterPriority,  setFilterPriority]  = useState<TaskPriority | 'all'>('all');
  const [filterAssignee,  setFilterAssignee]  = useState<number | 'all'>('all');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  const refreshTasks = useCallback(async () => {
    try {
      const res = await tasksApi.getByProject(projectId);
      const list = res.data || [];
      setTasks(list);
      setSelectedTask(prev => prev ? (list.find(t => t.id === prev.id) ?? null) : null);
    } catch {}
  }, [projectId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, taskRes, userRes, memberRes] = await Promise.all([
        projectsApi.getById(projectId),
        tasksApi.getByProject(projectId),
        usersApi.getAll(),
        membersApi.getByProject(projectId),
      ]);
      setProject(proj.data);
      setTasks(taskRes.data || []);
      setUsers(userRes.data || []);
      setMembers(memberRes.data || []);
    } catch { navigate('/projects'); }
    finally { setLoading(false); }
  }, [projectId, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Column helpers ─────────────────────────────────────────────────────────

  const getLabel = (col: ColDef) => colLabels[col.key] || col.label;

  const startRenameCol = (col: ColDef) => {
    setEditingColKey(col.key);
    setEditingLabel(getLabel(col));
  };

  const saveColRename = () => {
    if (editingColKey && editingLabel.trim()) {
      const next = { ...colLabels, [editingColKey]: editingLabel.trim() };
      setColLabels(next);
      lsSet(`proj-${projectId}-labels`, next);
    }
    setEditingColKey(null);
  };

  const toggleCollapse = (key: string) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      lsSet(`proj-${projectId}-collapsed`, [...next]);
      return next;
    });
  };

  const handleAddColumn = () => {
    const label = newColLabel.trim();
    if (!label) { setAddingCol(false); return; }
    const color = CUSTOM_COLORS[customCols.length % CUSTOM_COLORS.length];
    const newCol: ColDef = { key: `custom_${Date.now()}`, label, ...color };
    const next = [...customCols, newCol];
    setCustomCols(next);
    lsSet(`proj-${projectId}-custom-cols`, next);
    setNewColLabel('');
    setAddingCol(false);
  };

  const handleDeleteColumn = (key: string) => {
    const count = tasks.filter(t => t.status === key).length;
    if (count > 0) {
      showToast(`Pindahkan atau hapus ${count} task di kolom ini dulu`, false);
      return;
    }
    const next = customCols.filter(c => c.key !== key);
    setCustomCols(next);
    lsSet(`proj-${projectId}-custom-cols`, next);
  };

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tasksApi.create(projectId, { ...form, assignee_id: form.assignee_id || undefined, due_date: form.due_date || '' });
      showToast('Task created!');
      setShowAddTask(false);
      setForm(EMPTY_FORM);
      refreshTasks();
    } catch { showToast('Failed to create task', false); }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    try {
      await tasksApi.update(editTask.id, {
        title: form.title, description: form.description,
        status: form.status, priority: form.priority,
        due_date: form.due_date ?? '',
        assignee_id: form.assignee_id || undefined,
        clear_assignee: !form.assignee_id,
      });
      showToast('Task updated!');
      setEditTask(null);
      refreshTasks();
    } catch { showToast('Failed to update task', false); }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await tasksApi.delete(task.id);
      showToast('Task deleted');
      if (selectedTask?.id === task.id) setSelectedTask(null);
      refreshTasks();
    } catch { showToast('Failed to delete task', false); }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status } : prev);
    try {
      await tasksApi.update(task.id, { status });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      showToast('Failed to update status', false);
    }
  };

  const handleDueDateChange = async (task: Task, due_date: string) => {
   // const oldDate = task.due_date ? String(task.due_date).substring(0, 10) : '';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date: due_date || undefined } : t));
    try {
      await tasksApi.update(task.id, { due_date });
    } catch { refreshTasks(); showToast('Failed to update due date', false); }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setForm({
      title: task.title, description: task.description,
      assignee_id: task.assignee_id, status: task.status, priority: task.priority,
      due_date: task.due_date ? String(task.due_date).substring(0, 10) : '',
    });
  };

  // ── Member management ──────────────────────────────────────────────────────

  const handleAddMember = async (userId: number) => {
    try {
      await membersApi.add(projectId, userId);
      const res = await membersApi.getByProject(projectId);
      setMembers(res.data || []);
      showToast('Member added!');
    } catch { showToast('Failed to add member', false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await membersApi.remove(projectId, userId);
      const res = await membersApi.getByProject(projectId);
      setMembers(res.data || []);
      showToast('Member removed');
    } catch { showToast('Failed to remove member', false); }
  };

  // ── Quick add ──────────────────────────────────────────────────────────────

  const handleQuickAdd = async (colKey: string) => {
    if (!quickAddTitle.trim()) { setQuickAddCol(null); return; }
    try {
      await tasksApi.create(projectId, { title: quickAddTitle.trim(), status: colKey as TaskStatus, priority: 'medium' });
      setQuickAddTitle('');
      setQuickAddCol(null);
      refreshTasks();
    } catch { showToast('Failed to create task', false); }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDrop = (colKey: string) => {
    if (dragTaskId === null) return;
    const task = tasks.find(t => t.id === dragTaskId);
    if (task && task.status !== colKey) handleStatusChange(task, colKey as TaskStatus);
    setDragTaskId(null);
    setDragOverCol(null);
  };

  // ── Filters ────────────────────────────────────────────────────────────────

  const hasFilter = filterPriority !== 'all' || filterAssignee !== 'all' || search !== '';

  const filteredTasks = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !(t.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && t.assignee_id !== filterAssignee) return false;
    return true;
  });

  const tasksByStatus = (key: string) => filteredTasks.filter(t => t.status === key);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Loading...</div>
  );

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-white font-bold">{project?.name}</h1>
            {project?.description && <p className="text-slate-400 text-xs mt-0.5">{project.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {hasFilter ? `${filteredTasks.length}/` : ''}{tasks.length} tasks
          </span>
          <button
            onClick={() => setShowMembersPanel(true)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Users className="w-4 h-4" />
            Members
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded-full leading-none">
              {members.length}
            </span>
          </button>
          <button
            onClick={() => { setShowAddTask(true); setForm(EMPTY_FORM); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="px-6 py-2 border-b border-slate-700/50 flex items-center gap-2 flex-shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg pl-8 pr-8 py-1.5 text-xs w-48 focus:outline-none focus:border-indigo-500 focus:w-64 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Priority */}
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
          className={`bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors ${filterPriority !== 'all' ? 'border-indigo-500 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
        >
          <option value="all">All Priority</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>

        {/* Assignee */}
        <select
          value={filterAssignee === 'all' ? '' : String(filterAssignee)}
          onChange={e => setFilterAssignee(e.target.value ? Number(e.target.value) : 'all')}
          className={`bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors ${filterAssignee !== 'all' ? 'border-indigo-500 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
        >
          <option value="">All Members</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setFilterPriority('all'); setFilterAssignee('all'); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-600 hidden lg:block">
          Double-click column header to rename
        </span>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`mx-6 mt-3 text-sm rounded-lg px-4 py-2.5 border flex-shrink-0 ${toast.ok
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-x-auto p-5 pb-6">
        <div className="flex gap-3 h-full">
          {columns.map(col => {
            const colTasks    = tasksByStatus(col.key);
            const isCollapsed = collapsedCols.has(col.key);
            const isDragOver  = dragOverCol === col.key;
            const label       = getLabel(col);

            /* ── Collapsed column ── */
            if (isCollapsed) {
              return (
                <div
                  key={col.key}
                  onClick={() => toggleCollapse(col.key)}
                  title={`Expand "${label}"`}
                  className={`flex-shrink-0 w-10 flex flex-col items-center gap-3 cursor-pointer rounded-xl border-2 ${col.border} bg-slate-800/30 hover:bg-slate-800/70 transition-colors py-3`}
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${col.badge}`}>
                    {colTasks.length}
                  </span>
                  <span
                    className="text-slate-400 text-xs font-semibold select-none"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em' }}
                  >
                    {label}
                  </span>
                </div>
              );
            }

            /* ── Expanded column ── */
            return (
              <div
                key={col.key}
                className="flex flex-col w-64 flex-shrink-0"
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={() => handleDrop(col.key)}
              >
                {/* Column header */}
                <div className={`flex items-center gap-1.5 px-3 py-2 mb-3 rounded-lg border-l-4 transition-colors ${col.border} ${isDragOver ? 'bg-slate-700/80' : 'bg-slate-800/50'}`}>
                  {editingColKey === col.key ? (
                    <input
                      autoFocus
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      onBlur={saveColRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  saveColRename();
                        if (e.key === 'Escape') setEditingColKey(null);
                      }}
                      className="flex-1 bg-transparent text-white text-sm font-semibold outline-none border-b border-indigo-500 min-w-0"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startRenameCol(col)}
                      className="flex-1 text-slate-200 text-sm font-semibold cursor-default select-none min-w-0 truncate"
                      title="Double-click to rename"
                    >
                      {label}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${col.badge}`}>
                    {colTasks.length}
                  </span>
                  {customCols.some(c => c.key === col.key) && (
                    <button
                      onClick={() => handleDeleteColumn(col.key)}
                      title="Hapus kolom"
                      className="p-0.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleCollapse(col.key)}
                    title="Collapse"
                    className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Task list */}
                <div className={`flex flex-col gap-2 flex-1 overflow-y-auto min-h-[60px] rounded-xl transition-all ${isDragOver ? 'bg-slate-700/25 ring-2 ring-dashed ring-slate-500' : ''}`}>
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      columns={columns}
                      colLabels={colLabels}
                      isDragging={dragTaskId === task.id}
                      canEdit={canEditTask(task)}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                      onClick={() => setSelectedTask(task)}
                      onEdit={e => { e.stopPropagation(); openEdit(task); }}
                      onDelete={e => { e.stopPropagation(); handleDeleteTask(task); }}
                      onStatusChange={s => handleStatusChange(task, s)}
                      onDueDateChange={d => handleDueDateChange(task, d)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-slate-700/50 rounded-xl h-14 flex items-center justify-center">
                      <span className="text-slate-600 text-xs">
                        {isDragOver ? 'Release to drop' : 'No tasks'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick-add */}
                <div className="mt-2">
                  {quickAddCol === col.key ? (
                    <div className="bg-slate-800 border border-slate-600 rounded-xl p-2.5 space-y-2">
                      <input
                        autoFocus
                        value={quickAddTitle}
                        onChange={e => setQuickAddTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  { e.preventDefault(); handleQuickAdd(col.key); }
                          if (e.key === 'Escape') { setQuickAddCol(null); setQuickAddTitle(''); }
                        }}
                        placeholder="Task title… (Enter to add)"
                        className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleQuickAdd(col.key)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                        >
                          <Check className="w-3 h-3" /> Add
                        </button>
                        <button
                          onClick={() => { setQuickAddCol(null); setQuickAddTitle(''); }}
                          className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setQuickAddCol(col.key); setQuickAddTitle(''); }}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg text-xs transition-colors group"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">Add task</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Add Status button ── */}
          <div className="flex-shrink-0 w-64">
            {addingCol ? (
              <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 space-y-2">
                <input
                  autoFocus
                  value={newColLabel}
                  onChange={e => setNewColLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); handleAddColumn(); }
                    if (e.key === 'Escape') { setAddingCol(false); setNewColLabel(''); }
                  }}
                  placeholder="Nama status baru…"
                  className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAddColumn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                  >
                    <Check className="w-3 h-3" /> Tambah
                  </button>
                  <button
                    onClick={() => { setAddingCol(false); setNewColLabel(''); }}
                    className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xs transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCol(true)}
                className="w-full h-10 flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm transition-colors"
              >
                <SquarePlus className="w-4 h-4" />
                Add Status
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Task modal ── */}
      {(showAddTask || editTask) && (
        <TaskFormModal
          title={editTask ? 'Edit Task' : 'New Task'}
          form={form}
          users={users}
          columns={columns}
          colLabels={colLabels}
          onChange={setForm}
          onSubmit={editTask ? handleUpdateTask : handleAddTask}
          onClose={() => { setShowAddTask(false); setEditTask(null); }}
          submitLabel={editTask ? 'Save Changes' : 'Create Task'}
        />
      )}

      {/* ── Task detail panel ── */}
      <TaskDetailPanel
        task={selectedTask}
        users={users}
        columns={columns}
        colLabels={colLabels}
        canEdit={selectedTask ? canEditTask(selectedTask) : false}
        onClose={() => setSelectedTask(null)}
        onUpdate={async (taskId, payload) => {
          await tasksApi.update(taskId, payload);
          await refreshTasks();
        }}
        onDelete={handleDeleteTask}
        showToast={showToast}
      />

      {/* ── Members panel ── */}
      {showMembersPanel && (
        <MembersPanel
          members={members}
          users={users}
          canManage={canManageProject}
          onClose={() => setShowMembersPanel(false)}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />
      )}
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, columns, colLabels, isDragging, canEdit,
  onDragStart, onDragEnd, onClick, onEdit, onDelete, onStatusChange, onDueDateChange,
}: {
  task: Task;
  columns: ColDef[];
  colLabels: Record<string, string>;
  isDragging: boolean;
  canEdit: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (s: TaskStatus) => void;
  onDueDateChange: (d: string) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef      = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const pc         = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const dueDateStr = task.due_date ? String(task.due_date).substring(0, 10) : '';
  const isOverdue  = !!dueDateStr && new Date(dueDateStr) < new Date() && task.status !== 'done';
  const currentCol = columns.find(c => c.key === task.status);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
    };
    if (showStatusMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showStatusMenu]);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-slate-800 border border-slate-700/80 border-l-4 ${pc.cardBorder} rounded-xl p-3.5 transition-all group cursor-pointer
        ${isDragging ? 'opacity-40 scale-95 shadow-none' : 'hover:border-slate-600 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-px'}`}
    >
      {/* Title row */}
      <div className="flex items-start gap-2 mb-1.5">
        <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        <p className="text-white text-sm font-medium leading-snug flex-1 min-w-0">{task.title}</p>
        {canEdit && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit}
              className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={onDelete}
              className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-slate-400 text-xs mb-2.5 line-clamp-2 leading-relaxed pl-5">{task.description}</p>
      )}

      {/* Priority badge */}
      <div className="pl-5 mb-2.5">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
          <Flag className="w-2.5 h-2.5" />
          {pc.label}
        </span>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700/60 pt-2.5 flex items-center justify-between gap-2">
        {/* Assignee */}
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assignee ? (
            <>
              <div className="w-5 h-5 rounded-full bg-indigo-600/40 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-300 text-[10px] font-bold">
                  {task.assignee.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-slate-400 text-xs truncate max-w-[70px]">{task.assignee.name}</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-slate-600 text-xs">
              <UserIcon className="w-3 h-3" /> Unassigned
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Due date */}
          <button
            onClick={e => { e.stopPropagation(); dateInputRef.current?.showPicker(); }}
            className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
              isOverdue      ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
              : dueDateStr   ? 'text-slate-400 hover:text-white hover:bg-slate-700'
              : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'
            }`}
          >
            {isOverdue && <AlertCircle className="w-3 h-3" />}
            <Calendar className="w-3 h-3" />
            {dueDateStr
              ? new Date(dueDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              : 'Set date'}
          </button>
          <input
            ref={dateInputRef} type="date" value={dueDateStr}
            onChange={e => { e.stopPropagation(); onDueDateChange(e.target.value); }}
            onClick={e => e.stopPropagation()}
            className="sr-only"
          />

          {/* Status pill */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setShowStatusMenu(v => !v); }}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors hover:opacity-80 ${currentCol?.badge ?? 'bg-slate-700 text-slate-300'}`}
            >
              {colLabels[task.status] || currentCol?.label || task.status}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 bottom-full mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-20 py-1 w-40 overflow-hidden">
                {columns.map(c => (
                  <button
                    key={c.key}
                    onClick={e => { e.stopPropagation(); onStatusChange(c.key); setShowStatusMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                      task.status === c.key ? 'text-indigo-400 bg-indigo-600/10' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {colLabels[c.key] || c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({
  task, users, columns, colLabels, canEdit, onClose, onUpdate, onDelete, showToast,
}: {
  task: Task | null;
  users: User[];
  columns: ColDef[];
  colLabels: Record<string, string>;
  canEdit: boolean;
  onClose: () => void;
  onUpdate: (id: number, payload: UpdateTaskRequest) => Promise<void>;
  onDelete: (task: Task) => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [editTitle,    setEditTitle]    = useState('');
  const [editDesc,     setEditDesc]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [history,      setHistory]      = useState<TaskHistoryEntry[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const prevIdRef = useRef<number | null>(null);

  const loadHistory = async (taskId: number) => {
    setHistLoading(true);
    try {
      const res = await tasksApi.getHistory(taskId);
      setHistory((res.data || []).filter(e => e.action === 'updated'));
    } catch {} finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (task && task.id !== prevIdRef.current) {
      setEditTitle(task.title);
      setEditDesc(task.description ?? '');
      loadHistory(task.id);
      prevIdRef.current = task.id;
    }
    if (!task) prevIdRef.current = null;
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldChange = async (payload: UpdateTaskRequest) => {
    if (!task) return;
    try {
      await onUpdate(task.id, payload);
      await loadHistory(task.id);
    } catch { showToast('Failed to update', false); }
  };

  const saveText = async () => {
    if (!task) return;
    setSaving(true);
    const newTitle = editTitle.trim() || task.title;
    const newDesc  = editDesc;
    try {
      await onUpdate(task.id, { title: newTitle, description: newDesc });
      await loadHistory(task.id);
      showToast('Tersimpan!');
    } catch { showToast('Failed to save', false); }
    finally { setSaving(false); }
  };

  const textChanged = task && (editTitle !== task.title || editDesc !== (task.description ?? ''));
  const pc          = task ? (PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium) : null;
  const dueDateStr  = task?.due_date ? String(task.due_date).substring(0, 10) : '';

  return (
    <div className={`fixed top-0 right-0 h-full w-[440px] bg-slate-900 border-l border-slate-700/80 shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${task ? 'translate-x-0' : 'translate-x-full'}`}>
      {task && (
        <>
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              {pc && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} />}
              <span className="text-xs text-slate-500 font-mono tracking-wider">TASK-{task.id}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-indigo-400 font-medium">Edit Mode</span>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && (
                <button onClick={() => onDelete(task)} title="Hapus task"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Edit section */}
            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className={panelLbl}>Judul Task</label>
                <textarea
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  rows={2}
                  placeholder="Judul task…"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white text-base font-semibold rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-indigo-500 transition-colors leading-snug"
                />
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={panelLbl}>Status</label>
                  <select
                    value={task.status}
                    onChange={e => fieldChange({ status: e.target.value as TaskStatus })}
                    className={panelSel}
                  >
                    {columns.map(c => (
                      <option key={c.key} value={c.key}>{colLabels[c.key] || c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={panelLbl}>Priority</label>
                  <select
                    value={task.priority}
                    onChange={e => fieldChange({ priority: e.target.value as TaskPriority })}
                    className={panelSel}
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </div>
                <div>
                  <label className={panelLbl}>Assignee</label>
                  <select
                    value={task.assignee_id ?? ''}
                    onChange={e => fieldChange({
                      assignee_id: e.target.value ? Number(e.target.value) : undefined,
                      clear_assignee: !e.target.value,
                    })}
                    className={panelSel}
                  >
                    <option value="">— Unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={panelLbl}>Due Date</label>
                  <input
                    type="date"
                    value={dueDateStr}
                    onChange={e => fieldChange({ due_date: e.target.value })}
                    className={`${panelSel} [color-scheme:dark]`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={panelLbl}>Deskripsi</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={4}
                  placeholder="Tambah deskripsi…"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Save title/desc */}
              {textChanged && (
                <button
                  onClick={saveText}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 border-t border-slate-800" />

            {/* ── History Section ── */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Riwayat Aktivitas
                </span>
                {history.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{history.length}</span>
                )}
                {histLoading && <span className="text-[10px] text-slate-600 animate-pulse">loading…</span>}
              </div>

              <div className="space-y-3">
                {/* Created entry — from task data */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 text-[10px] font-bold">
                        {task.creator?.name?.charAt(0).toUpperCase() ?? '?'}
                      </span>
                    </div>
                    {history.length > 0 && <div className="w-px flex-1 bg-slate-800 mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-xs text-slate-300">
                      <span className="font-semibold text-green-400">{task.creator?.name ?? 'Unknown'}</span>
                      {' '}membuat task ini
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      {fmtTs(task.created_at)}
                    </p>
                  </div>
                </div>

                {/* Edit history entries from DB */}
                {history.map((entry, i) => {
                  const isLast = i === history.length - 1;
                  const name = entry.changed_by?.name ?? 'Unknown';
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-400 text-[10px] font-bold">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1" />}
                      </div>
                      <div className={`flex-1 ${!isLast ? 'pb-3' : ''}`}>
                        <p className="text-xs text-slate-300">
                          <span className="font-semibold text-indigo-400">{name}</span>
                          {' '}mengubah task
                        </p>
                        <div className="mt-1.5">
                          <div className="flex items-start gap-1.5 text-[11px]">
                            <span className="text-slate-500 flex-shrink-0 capitalize">{entry.field}:</span>
                            {entry.old_value && (
                              <span className="text-slate-500 line-through truncate max-w-[80px]">{entry.old_value}</span>
                            )}
                            {entry.old_value && <span className="text-slate-600">→</span>}
                            <span className="text-slate-300 font-medium truncate max-w-[80px]">{entry.new_value ?? '—'}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                          <Clock3 className="w-3 h-3" />
                          {fmtTs(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {!histLoading && history.length === 0 && (
                  <p className="text-xs text-slate-700 text-center py-2">Belum ada riwayat perubahan</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const panelLbl = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5';
const panelSel = 'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors';

// ─── Task Form Modal ──────────────────────────────────────────────────────────

function TaskFormModal({
  title, form, users, columns, colLabels, onChange, onSubmit, onClose, submitLabel,
}: {
  title: string;
  form: CreateTaskRequest;
  users: User[];
  columns: ColDef[];
  colLabels: Record<string, string>;
  onChange: (f: CreateTaskRequest) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={lbl}>Title *</label>
            <input required value={form.title}
              onChange={e => onChange({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              className={inp} />
          </div>

          <div>
            <label className={lbl}>Description</label>
            <textarea value={form.description}
              onChange={e => onChange({ ...form, description: e.target.value })}
              placeholder="Optional details…" rows={2}
              className={`${inp} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}><UserIcon className="w-3 h-3 inline mr-1" />Assign to</label>
              <select value={form.assignee_id ?? ''}
                onChange={e => onChange({ ...form, assignee_id: e.target.value ? Number(e.target.value) : undefined })}
                className={inp}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}><Calendar className="w-3 h-3 inline mr-1" />Due Date</label>
              <input type="date" value={form.due_date ?? ''}
                onChange={e => onChange({ ...form, due_date: e.target.value })}
                className={`${inp} [color-scheme:dark]`} />
            </div>

            <div>
              <label className={lbl}>Status</label>
              <select value={form.status}
                onChange={e => onChange({ ...form, status: e.target.value as TaskStatus })}
                className={inp}>
                {columns.map(c => (
                  <option key={c.key} value={c.key}>{colLabels[c.key] || c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}><Flag className="w-3 h-3 inline mr-1" />Priority</label>
              <select value={form.priority}
                onChange={e => onChange({ ...form, priority: e.target.value as TaskPriority })}
                className={inp}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inp = "w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

// ─── Members Panel ────────────────────────────────────────────────────────────

function MembersPanel({
  members, users, canManage, onClose, onAdd, onRemove,
}: {
  members: ProjectMember[];
  users: User[];
  canManage: boolean;
  onClose: () => void;
  onAdd: (userId: number) => Promise<void>;
  onRemove: (userId: number) => Promise<void>;
}) {
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [adding,     setAdding]     = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const memberUserIds = new Set(members.map(m => m.user_id));
  const nonMembers    = users.filter(u => !memberUserIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try { await onAdd(Number(selectedUserId)); setSelectedUserId(''); }
    finally { setAdding(false); }
  };

  const handleRemove = async (userId: number) => {
    setRemovingId(userId);
    try { await onRemove(userId); }
    finally { setRemovingId(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold">Project Members</h2>
            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{members.length}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add member (only for owners/admins) */}
        {canManage && nonMembers.length > 0 && (
          <div className="mb-4 flex gap-2">
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select user to add…</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedUserId || adding}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-slate-900/50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-sm font-bold">
                    {(m.user?.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.user?.name ?? 'Unknown'}</p>
                  <p className="text-slate-500 text-xs truncate">{m.user?.email ?? ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  m.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                </span>
                {canManage && m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    disabled={removingId === m.user_id}
                    title="Remove member"
                    className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">No members yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
