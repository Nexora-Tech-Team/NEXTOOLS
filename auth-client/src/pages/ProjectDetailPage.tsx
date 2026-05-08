import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardColumnSkeleton, Spinner } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Calendar, User as UserIcon, Trash2,
  ChevronDown, AlertCircle, Search, ChevronLeft, Check, GripVertical,
  SquarePlus, History, Clock3, Pencil, Users, Play, Square, Timer,
  Paperclip, ListTodo, PenLine, Upload, FileText,
} from 'lucide-react';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import { membersApi } from '../api/members';
import { useAuth } from '../context/useAuth';
import type { Project, Task, User, ProjectMember, CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskPriority, TaskHistoryEntry, CustomColumn, TaskTimeLog, TaskTimeLogsResponse, TaskAttachment } from '../types';

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

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; text: string; bg: string; cardBorder: string; icon: string }> = {
  low:    { label: 'Low',    dot: 'bg-slate-400',  text: 'text-slate-400',  bg: 'bg-slate-700',     cardBorder: 'border-l-slate-500',  icon: '▼' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', cardBorder: 'border-l-yellow-500', icon: '▶' },
  high:   { label: 'High',   dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10',    cardBorder: 'border-l-red-500',    icon: '▲' },
};

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const EMPTY_FORM: CreateTaskRequest = {
  title: '', description: '', category: '', assignee_ids: [],
  status: 'backlog', priority: 'medium', due_date: '',
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (error) { console.warn('Unable to persist project view settings', error); }
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
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [users,         setUsers]         = useState<User[]>([]);
  const [members,       setMembers]       = useState<ProjectMember[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeLogs,    setActiveLogs]    = useState<TaskTimeLog[]>([]);
  const [myActiveLog,   setMyActiveLog]   = useState<TaskTimeLog | null>(null);

  // RBAC helpers
  const isAdmin      = user?.role === 'admin';
  const myMembership = members.find(m => m.user_id === user?.id);
  const isOwner      = myMembership?.role === 'owner';
  const canManageProject = isAdmin || isOwner; // delete project, manage members
  const canEditTask  = (task: Task) => isAdmin || task.creator_id === user?.id || (task.assignees ?? []).some(a => a.id === user?.id);

  // modals / panels
  const [showAddTask,      setShowAddTask]      = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [editTask,         setEditTask]         = useState<Task | null>(null);
  const [selectedTask,     setSelectedTask]     = useState<Task | null>(null);
  const [form,             setForm]             = useState<CreateTaskRequest>(EMPTY_FORM);
  const [taskSaving,       setTaskSaving]       = useState(false);

  // column customisation — loaded from API, cached in localStorage for instant display
  const [colLabels, setColLabels] = useState<Record<string, string>>(
    () => lsGet(`proj-${projectId}-labels`, {}),
  );
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(
    () => new Set(lsGet<string[]>(`proj-${projectId}-collapsed`, [])),
  );
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingLabel,  setEditingLabel]  = useState('');

  // custom columns — loaded from API, cached in localStorage
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

  // pagination
  const [colPage, setColPage] = useState<Record<string, number>>({});
  const PAGE_SIZE = 10;

  // debounce refs for status updates
  const statusTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // filters
  const [search,          setSearch]          = useState('');
  const [filterPriority,  setFilterPriority]  = useState<TaskPriority | 'all'>('all');
  const [filterAssignee,  setFilterAssignee]  = useState<number | 'all'>('all');

  const { showToast } = useToast();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const refreshActiveLogs = useCallback(async () => {
    try {
      const [projLogs, myLog] = await Promise.all([
        tasksApi.getActiveLogsByProject(projectId),
        tasksApi.getMyActiveLog(),
      ]);
      setActiveLogs(projLogs.data ?? []);
      setMyActiveLog(myLog.data ?? null);
    } catch { /* non-critical */ }
  }, [projectId]);

  const refreshTasks = useCallback(async () => {
    try {
      const res = await tasksApi.getByProject(projectId);
      const list = res.data || [];
      setTasks(list);
      setSelectedTask(prev => prev ? (list.find(t => t.id === prev.id) ?? null) : null);
      refreshActiveLogs();
    } catch (error) {
      console.error('Failed to refresh tasks', error);
    }
  }, [projectId, refreshActiveLogs]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, taskRes, userRes, memberRes, colCfg, activeRes, myActiveRes] = await Promise.all([
        projectsApi.getById(projectId),
        tasksApi.getByProject(projectId),
        usersApi.getAll(),
        membersApi.getByProject(projectId),
        projectsApi.getColumnConfig(projectId).catch(() => null),
        tasksApi.getActiveLogsByProject(projectId).catch(() => ({ data: [] })),
        tasksApi.getMyActiveLog().catch(() => ({ data: null })),
      ]);
      setProject(proj.data);
      setTasks(taskRes.data || []);
      setUsers(userRes.data || []);
      setMembers(memberRes.data || []);
      setActiveLogs(activeRes.data ?? []);
      setMyActiveLog(myActiveRes.data ?? null);
      if (colCfg) {
        // API wins over localStorage — sync both
        const labels = colCfg.labels || {};
        const cols = (colCfg.custom_cols || []) as ColDef[];
        setColLabels(labels);
        setCustomCols(cols);
        lsSet(`proj-${projectId}-labels`, labels);
        lsSet(`proj-${projectId}-custom-cols`, cols);
      }
      } catch {
        navigate('/projects');
      }
    finally { setLoading(false); }
  }, [projectId, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Column helpers ─────────────────────────────────────────────────────────

  const getLabel = (col: ColDef) => colLabels[col.key] || col.label;

  /** Persist column config to API + localStorage */
  const saveColumnConfig = useCallback(
    async (labels: Record<string, string>, cols: ColDef[]) => {
      lsSet(`proj-${projectId}-labels`, labels);
      lsSet(`proj-${projectId}-custom-cols`, cols);
      try {
        await projectsApi.updateColumnConfig(projectId, {
          labels,
          custom_cols: cols as CustomColumn[],
        });
      } catch {
        showToast('Gagal menyimpan konfigurasi kolom', 'error');
      }
    },
    [projectId],
  );

  const startRenameCol = (col: ColDef) => {
    setEditingColKey(col.key);
    setEditingLabel(getLabel(col));
  };

  const saveColRename = () => {
    if (editingColKey && editingLabel.trim()) {
      const next = { ...colLabels, [editingColKey]: editingLabel.trim() };
      setColLabels(next);
      saveColumnConfig(next, customCols);
    }
    setEditingColKey(null);
  };

  const toggleCollapse = (key: string) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
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
    saveColumnConfig(colLabels, next);
    setNewColLabel('');
    setAddingCol(false);
  };

  const handleDeleteColumn = (key: string) => {
    const count = tasks.filter(t => t.status === key).length;
    if (count > 0) {
      showToast('Pindahkan atau hapus task di kolom ini dulu', 'error');
      return;
    }
    const next = customCols.filter(c => c.key !== key);
    setCustomCols(next);
    saveColumnConfig(colLabels, next);
  };

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  const handleAddTask = async (e: React.FormEvent, pendingImages: PendingImage[], subtasks: string[]) => {
    e.preventDefault();
    setTaskSaving(true);
    try {
      const res = await tasksApi.create(projectId, { ...form, assignee_ids: form.assignee_ids ?? [], due_date: form.due_date || '' });
      const taskId = res.data.id;
      for (const img of pendingImages) {
        await tasksApi.createAttachment(taskId, img.filename, img.mimeType, img.data);
      }
      for (const title of subtasks) {
        await tasksApi.createSubtask(projectId, taskId, title);
      }
      showToast('Task created!');
      setShowAddTask(false);
      setForm(EMPTY_FORM);
      refreshTasks();
    } catch { showToast('Failed to create task', 'error'); }
    finally { setTaskSaving(false); }
  };

  const handleUpdateTask = async (e: React.FormEvent, pendingImages: PendingImage[]) => {
    e.preventDefault();
    if (!editTask) return;
    setTaskSaving(true);
    try {
      const assigneeIds = form.assignee_ids ?? [];
      await tasksApi.update(editTask.id, {
        title: form.title, description: form.description,
        category: form.category,
        status: form.status, priority: form.priority,
        due_date: form.due_date ?? '',
        assignee_ids: assigneeIds,
        clear_assignees: assigneeIds.length === 0,
      });
      for (const img of pendingImages) {
        await tasksApi.createAttachment(editTask.id, img.filename, img.mimeType, img.data);
      }
      showToast('Task updated!');
      setEditTask(null);
      refreshTasks();
    } catch { showToast('Failed to update task', 'error'); }
    finally { setTaskSaving(false); }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await tasksApi.delete(task.id);
      showToast('Task deleted');
      if (selectedTask?.id === task.id) setSelectedTask(null);
      refreshTasks();
    } catch { showToast('Failed to delete task', 'error'); }
  };

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    // Optimistic update immediately
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status } : prev);
    // Debounce API call — only fires 600ms after last change for this task
    const existing = statusTimersRef.current.get(task.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      statusTimersRef.current.delete(task.id);
      try {
        await tasksApi.update(task.id, { status });
      } catch {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
        showToast('Failed to update status', 'error');
      }
    }, 600);
    statusTimersRef.current.set(task.id, timer);
  };

  const handleDueDateChange = async (task: Task, due_date: string) => {
   // const oldDate = task.due_date ? String(task.due_date).substring(0, 10) : '';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date: due_date || undefined } : t));
    try {
      await tasksApi.update(task.id, { due_date });
    } catch { refreshTasks(); showToast('Failed to update due date', 'error'); }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setForm({
      title: task.title, description: task.description, category: task.category ?? '',
      assignee_ids: (task.assignees ?? []).map(a => a.id),
      status: task.status, priority: task.priority,
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
    } catch { showToast('Failed to add member', 'error'); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await membersApi.remove(projectId, userId);
      const res = await membersApi.getByProject(projectId);
      setMembers(res.data || []);
      showToast('Member removed');
    } catch { showToast('Failed to remove member', 'error'); }
  };

  // ── Quick add ──────────────────────────────────────────────────────────────

  const handleQuickAdd = async (colKey: string) => {
    if (!quickAddTitle.trim()) { setQuickAddCol(null); return; }
    try {
      await tasksApi.create(projectId, { title: quickAddTitle.trim(), status: colKey as TaskStatus, priority: 'medium' });
      setQuickAddTitle('');
      setQuickAddCol(null);
      refreshTasks();
    } catch { showToast('Failed to create task', 'error'); }
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
    if (filterAssignee !== 'all' && !(t.assignees ?? []).some(a => a.id === filterAssignee)) return false;
    return true;
  });

  const tasksByStatus = (key: string) => filteredTasks.filter(t => t.status === key);

  const pagedTasksByStatus = (key: string) => {
    const all = tasksByStatus(key);
    const limit = (colPage[key] ?? 1) * PAGE_SIZE;
    return { visible: all.slice(0, limit), total: all.length };
  };

  if (loading) return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-700 px-6 py-4">
        <div className="w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded bg-slate-800 animate-pulse" />
          <div className="h-3 w-24 rounded bg-slate-800 animate-pulse" />
        </div>
      </div>
      {/* Board skeleton */}
      <div className="flex-1 overflow-x-auto px-6 pt-5 bg-[#141925]">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => <BoardColumnSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">

      {/* ── Header ── */}
      <div className="flex flex-shrink-0 flex-col gap-4 border-b border-slate-700 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button onClick={() => navigate('/projects')}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-white">{project?.name}</h1>
            {project?.description && <p className="text-slate-500 text-xs mt-0.5">{project.description}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <span className="text-xs text-slate-500">
            {hasFilter ? `${filteredTasks.length}/` : ''}{tasks.length} tasks
          </span>
          <button
            onClick={() => setShowMembersPanel(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600"
          >
            <Users className="w-4 h-4" />
            Members
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded-full leading-none">
              {members.length}
            </span>
          </button>
          <button
            onClick={() => { setShowAddTask(true); setForm(EMPTY_FORM); }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-shrink-0 flex-col gap-2 border-b border-slate-700/50 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative w-full lg:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-8 pr-8 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 lg:w-64"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:ml-auto lg:flex lg:w-auto lg:grid-cols-none">
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
            className={`rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors ${filterPriority !== 'all' ? 'border-indigo-500 bg-slate-800 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
          >
            <option value="all">All Priority</option>
            {PRIORITY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={filterAssignee === 'all' ? '' : String(filterAssignee)}
            onChange={e => setFilterAssignee(e.target.value ? Number(e.target.value) : 'all')}
            className={`rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors ${filterAssignee !== 'all' ? 'border-indigo-500 bg-slate-800 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
          >
            <option value="">All Members</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setFilterPriority('all'); setFilterAssignee('all'); }}
              className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        <span className="hidden text-xs text-slate-600 lg:ml-auto lg:block">
          Double-click column header to rename
        </span>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-x-auto px-4 pb-6 pt-4 sm:px-6 bg-[#141925]">
        <div className="flex h-full gap-4">
          {columns.map(col => {
            const { visible: colTasks, total: colTotal } = pagedTasksByStatus(col.key);
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
                  className={`flex h-fit w-10 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-xl border-2 py-3 transition-colors ${col.border} bg-slate-800/30 hover:bg-slate-800/70`}
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${col.badge}`}>
                    {colTotal}
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
                className="flex w-[min(17rem,calc(100vw-3.75rem))] flex-shrink-0 flex-col sm:w-68 bg-[#1a2035]/60 rounded-xl px-2 pb-3 pt-1 shadow-md shadow-black/30"
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={() => handleDrop(col.key)}
              >
                {/* Column header — JIRA style */}
                <div className={`flex items-center gap-2 px-2 py-2 mb-2 transition-colors ${isDragOver ? 'opacity-80' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${col.dot}`} />
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
                      className="flex-1 bg-transparent text-slate-200 text-xs font-bold uppercase tracking-wider outline-none border-b border-indigo-500 min-w-0"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startRenameCol(col)}
                      className="flex-1 text-slate-400 text-xs font-bold uppercase tracking-wider cursor-default select-none min-w-0 truncate"
                      title="Double-click to rename"
                    >
                      {label}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-semibold flex-shrink-0">{colTotal}</span>
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
                <div className={`flex flex-col gap-2 flex-1 overflow-y-auto min-h-[60px] rounded-lg transition-all ${isDragOver ? 'bg-indigo-500/5 ring-1 ring-dashed ring-indigo-500/30' : ''}`}>
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      columns={columns}
                      colLabels={colLabels}
                      isDragging={dragTaskId === task.id}
                      canEdit={canEditTask(task)}
                      activeLog={activeLogs.find(l => l.task_id === task.id)}
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
                    <div className={`rounded-xl h-20 flex flex-col items-center justify-center gap-1 transition-all border border-dashed ${
                      isDragOver
                        ? 'border-indigo-500/60 bg-indigo-500/5'
                        : 'border-slate-700/30 bg-slate-800/10'
                    }`}>
                      {isDragOver
                        ? <span className="text-indigo-400 text-xs font-medium">Lepas di sini</span>
                        : <>
                            <span className="text-slate-700 text-[11px]">Tidak ada task</span>
                          </>
                      }
                    </div>
                  )}
                </div>

                {/* Load more */}
                {colTasks.length < colTotal && (
                  <button
                    onClick={() => setColPage(prev => ({ ...prev, [col.key]: (prev[col.key] ?? 1) + 1 }))}
                    className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 rounded-lg transition-colors"
                  >
                    Load more ({colTotal - colTasks.length} lagi)
                  </button>
                )}

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
                      className="group flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-800/50 hover:text-slate-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">Add task</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Add Status button ── */}
          <div className="w-[min(18rem,calc(100vw-3.75rem))] flex-shrink-0 sm:w-72">
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
          saving={taskSaving}
        />
      )}

      {/* ── Task detail panel ── */}
      <TaskDetailPanel
        task={selectedTask}
        users={users}
        columns={columns}
        colLabels={colLabels}
        canEdit={selectedTask ? canEditTask(selectedTask) : false}
        myActiveLog={myActiveLog}
        activeLog={selectedTask ? activeLogs.find(l => l.task_id === selectedTask.id) : undefined}
        onClose={() => setSelectedTask(null)}
        onUpdate={async (taskId, payload) => {
          await tasksApi.update(taskId, payload);
          await refreshTasks();
        }}
        onDelete={handleDeleteTask}
        onClockChange={refreshActiveLogs}
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
  task, columns, colLabels, isDragging, canEdit, activeLog,
  onDragStart, onDragEnd, onClick, onEdit, onDelete, onStatusChange, onDueDateChange,
}: {
  task: Task;
  columns: ColDef[];
  colLabels: Record<string, string>;
  isDragging: boolean;
  canEdit: boolean;
  activeLog?: TaskTimeLog;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (s: TaskStatus) => void;
  onDueDateChange: (d: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef      = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const pc         = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const dueDateStr = task.due_date ? String(task.due_date).substring(0, 10) : '';
  const isOverdue  = !!dueDateStr && new Date(dueDateStr) < new Date() && task.status !== 'done';
  const isDone     = task.status === 'done';

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`animate-fade-in group relative bg-[#1e2330] rounded-lg cursor-pointer transition-all shadow-sm shadow-black/40
        ${activeLog ? 'border border-green-500/40' : 'border border-[#2a3147]'}
        ${isDragging ? 'opacity-30 scale-95' : 'hover:border-[#3d4f7c] hover:shadow-lg hover:shadow-black/50 hover:-translate-y-0.5'}`}
    >
      {/* Priority stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg ${pc.cardBorder.replace('border-l-', 'bg-')}`} />

      <div className="px-3 pt-3 pb-2.5 pl-4">
        {/* Top row: ID + active indicator + actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 tracking-wide">TASK-{task.id}</span>
            {activeLog && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                {activeLog.user?.name?.split(' ')[0] ?? 'Someone'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && <>
              <button onClick={onEdit}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={onDelete}
                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </>}
            <button
              onClick={e => { e.stopPropagation(); dateInputRef.current?.showPicker(); }}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
              <GripVertical className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Title */}
        <p className={`text-sm font-medium leading-snug mb-2.5 ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
          {task.title}
        </p>

        {/* Description preview */}
        {task.description && (
          <p className="text-slate-500 text-xs mb-2.5 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* Chips row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* Priority chip */}
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${pc.bg} ${pc.text}`}>
            <span className="text-[9px]">{pc.icon}</span>
            {pc.label}
          </span>

          {/* Subtask count */}
          {(task.subtask_count > 0) && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
              <ListTodo className="w-2.5 h-2.5" />
              {task.subtask_count}
            </span>
          )}

          {/* Due date */}
          {dueDateStr && (
            <button
              onClick={e => { e.stopPropagation(); dateInputRef.current?.showPicker(); }}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {isOverdue && <AlertCircle className="w-2.5 h-2.5" />}
              <Calendar className="w-2.5 h-2.5" />
              {new Date(dueDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </button>
          )}
        </div>

        {/* Bottom row: assignee + status */}
        <div className="flex items-center justify-between gap-2">
          {/* Assignee avatars */}
          {(task.assignees ?? []).length > 0 ? (
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex -space-x-1.5">
                {(task.assignees ?? []).slice(0, 3).map(a => (
                  <div key={a.id} title={a.name} className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 ring-1 ring-[#1e2330]">
                    <span className="text-white text-[9px] font-bold leading-none">{a.name.charAt(0).toUpperCase()}</span>
                  </div>
                ))}
                {(task.assignees ?? []).length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 ring-1 ring-[#1e2330]">
                    <span className="text-slate-300 text-[8px] font-bold">+{(task.assignees ?? []).length - 3}</span>
                  </div>
                )}
              </div>
              {(task.assignees ?? []).length === 1 && (
                <span className="text-slate-500 text-[11px] truncate max-w-[70px]">{task.assignees![0].name}</span>
              )}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-slate-600 flex items-center justify-center">
              <UserIcon className="w-2.5 h-2.5 text-slate-600" />
            </div>
          )}

          {/* Status dropdown */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide transition-colors hover:opacity-80 ${
                task.status === 'done' ? 'bg-green-500/20 text-green-400' :
                task.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                task.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
                task.status === 'todo' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-700 text-slate-400'
              }`}
            >
              {colLabels[task.status] || columns.find(c => c.key === task.status)?.label || task.status}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 bg-[#1a2035] border border-[#2a3147] rounded-lg shadow-2xl z-20 py-1 w-40 overflow-hidden">
                {columns.map(c => (
                  <button
                    key={c.key}
                    onClick={e => { e.stopPropagation(); onStatusChange(c.key); setShowMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                      task.status === c.key ? 'text-indigo-400 bg-indigo-600/10' : 'text-slate-300 hover:bg-slate-700/50'
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

      {/* Hidden date input */}
      <input
        ref={dateInputRef} type="date" value={dueDateStr}
        onChange={e => { e.stopPropagation(); onDueDateChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="sr-only"
      />
    </div>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({
  task, users, columns, colLabels, canEdit, myActiveLog, activeLog, onClose, onUpdate, onDelete, onClockChange,
}: {
  task: Task | null;
  users: User[];
  columns: ColDef[];
  colLabels: Record<string, string>;
  canEdit: boolean;
  myActiveLog?: TaskTimeLog | null;
  activeLog?: TaskTimeLog;
  onClose: () => void;
  onUpdate: (id: number, payload: UpdateTaskRequest) => Promise<void>;
  onDelete: (task: Task) => void;
  onClockChange?: () => void;
}) {
  const { showToast } = useToast();
  // ESC to close panel
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && task) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [task, onClose]);

  const [activeTab,    setActiveTab]    = useState<'details' | 'subtasks' | 'timelogs' | 'history'>('details');
  const [editTitle,    setEditTitle]    = useState('');
  const [editDesc,     setEditDesc]     = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [history,      setHistory]      = useState<TaskHistoryEntry[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [timeLogs,     setTimeLogs]     = useState<TaskTimeLogsResponse | null>(null);
  const [timeLoading,  setTimeLoading]  = useState(false);
  const [clockTick,    setClockTick]    = useState(0);
  const [attachments,  setAttachments]  = useState<TaskAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [subtasks,     setSubtasks]     = useState<Task[]>([]);
  const [newSubtask,   setNewSubtask]   = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const prevIdRef      = useRef<number | null>(null);
  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedTabsRef  = useRef<Set<string>>(new Set());
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const loadHistory = async (taskId: number) => {
    setHistLoading(true);
    try {
      const res = await tasksApi.getHistory(taskId);
      setHistory((res.data || []).filter(e => e.action === 'updated'));
    } catch (error) {
      console.error('Failed to load task history', error);
    } finally {
      setHistLoading(false);
    }
  };

  const loadTimeLogs = async (taskId: number) => {
    setTimeLoading(true);
    try {
      const res = await tasksApi.getTimeLogs(taskId);
      setTimeLogs(res.data);
    } catch (error) {
      console.error('Failed to load time logs', error);
    } finally {
      setTimeLoading(false);
    }
  };

  const loadAttachments = async (taskId: number) => {
    try {
      const res = await tasksApi.getAttachments(taskId);
      setAttachments(res.data ?? []);
    } catch { /* silent */ }
  };

  const loadSubtasks = async (taskId: number) => {
    try {
      const res = await tasksApi.getByProject(task!.project_id);
      setSubtasks((res.data ?? []).filter((t: Task) => t.parent_task_id === taskId));
    } catch { /* silent */ }
  };

  // Live ticker for active clock-in
  useEffect(() => {
    if (timeLogs?.active_log) {
      tickRef.current = setInterval(() => setClockTick(t => t + 1), 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [timeLogs?.active_log]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (!task || loadedTabsRef.current.has(`${task.id}-${tab}`)) return;
    loadedTabsRef.current.add(`${task.id}-${tab}`);
    if (tab === 'details') loadAttachments(task.id);
    if (tab === 'subtasks') loadSubtasks(task.id);
    if (tab === 'timelogs') loadTimeLogs(task.id);
    if (tab === 'history')  loadHistory(task.id);
  };

  useEffect(() => {
    if (task && task.id !== prevIdRef.current) {
      setEditTitle(task.title);
      setEditDesc(task.description ?? '');
      setEditCategory(task.category ?? '');
      setSubtasks([]);
      setAttachments([]);
      setTimeLogs(null);
      setHistory([]);
      setActiveTab('details');
      loadedTabsRef.current = new Set([`${task.id}-details`]);
      loadAttachments(task.id);
      prevIdRef.current = task.id;
    }
    if (!task) {
      prevIdRef.current = null;
      setTimeLogs(null);
      setAttachments([]);
      setSubtasks([]);
      setHistory([]);
      loadedTabsRef.current = new Set();
    }
  }, [task]);

  const handleClockIn = async (manualTime?: string) => {
    if (!task) return;
    try {
      await tasksApi.clockIn(task.id, manualTime);
      await loadTimeLogs(task.id);
      showToast('Clock in berhasil!');
      onClockChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg || 'Gagal clock in', 'error');
    }
  };

  const handleClockOut = async (manualTime?: string) => {
    if (!task) return;
    try {
      await tasksApi.clockOut(task.id, manualTime);
      await loadTimeLogs(task.id);
      showToast('Clock out berhasil!');
      onClockChange?.();
    } catch { showToast('Gagal clock out', 'error'); }
  };

  const handleManualTimeLog = async (clockIn: string, clockOut: string) => {
    if (!task) return;
    try {
      await tasksApi.createManualTimeLog(task.id, clockIn, clockOut);
      await loadTimeLogs(task.id);
      showToast('Time log ditambahkan!');
    } catch { showToast('Gagal tambah time log', 'error'); }
  };

  const handleDeleteTimeLog = async (logId: number) => {
    if (!task) return;
    try {
      await tasksApi.deleteTimeLog(task.id, logId);
      await loadTimeLogs(task.id);
      showToast('Time log dihapus');
    } catch { showToast('Gagal hapus time log', 'error'); }
  };

  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      await tasksApi.createSubtask(task.project_id, task.id, newSubtask.trim());
      setNewSubtask('');
      await loadSubtasks(task.id);
      showToast('Subtask ditambahkan!');
    } catch { showToast('Gagal tambah subtask', 'error'); }
    finally { setAddingSubtask(false); }
  };

  const handleDeleteAttachment = async (attachId: number) => {
    if (!task) return;
    try {
      await tasksApi.deleteAttachment(task.id, attachId);
      await loadAttachments(task.id);
      showToast('Lampiran dihapus');
    } catch { showToast('Gagal hapus lampiran', 'error'); }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!task || !files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve((ev.target?.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await tasksApi.createAttachment(task.id, file.name, file.type, base64);
      }
      await loadAttachments(task.id);
      showToast(files.length > 1 ? `${files.length} file dilampirkan!` : 'File dilampirkan!');
    } catch { showToast('Gagal upload file', 'error'); }
    finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteInPanel = async (e: React.ClipboardEvent) => {
    if (!task) return;
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const best = imageItems.find(i => i.type === 'image/png') ?? imageItems[0];
    const file = best.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      try {
        await tasksApi.createAttachment(task.id, `paste-${Date.now()}.png`, 'image/png', base64);
        await loadAttachments(task.id);
        showToast('Gambar dilampirkan!');
      } catch { showToast('Gagal lampirkan gambar', 'error'); }
    };
    reader.readAsDataURL(file);
  };

  const fieldChange = async (payload: UpdateTaskRequest) => {
    if (!task) return;
    try {
      await onUpdate(task.id, payload);
      await loadHistory(task.id);
    } catch { showToast('Failed to update', 'error'); }
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
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const textChanged = task && (editTitle !== task.title || editDesc !== (task.description ?? ''));
  const pc          = task ? (PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium) : null;
  const dueDateStr  = task?.due_date ? String(task.due_date).substring(0, 10) : '';

  return (
    <>
      {task && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close task details"
        />
      )}
      <div className={`fixed top-0 right-0 z-40 flex h-full w-full max-w-full flex-col border-l border-slate-700/80 bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out sm:w-[440px] ${task ? 'translate-x-0' : 'translate-x-full'}`}>
        {task && (
          <>
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              {pc && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} />}
              <span className="text-xs text-slate-500 font-mono tracking-wider">TASK-{task.id}</span>
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

          {/* ── Tabs ── */}
          <div className="flex border-b border-slate-700 flex-shrink-0 px-1">
            {([
              { key: 'details',  label: 'Details',      icon: <PenLine className="w-3 h-3" /> },
              { key: 'subtasks', label: 'Child Issues',  icon: <ListTodo className="w-3 h-3" /> },
              { key: 'timelogs', label: 'Time',          icon: <Timer className="w-3 h-3" /> },
              { key: 'history',  label: 'History',       icon: <History className="w-3 h-3" /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Details Tab ── */}
            {activeTab === 'details' && (
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      {PRIORITY_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={panelLbl}>Assignee</label>
                    <div className="flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-2 max-h-36 overflow-y-auto">
                      {users.map(u => {
                        const checked = (task.assignees ?? []).some(a => a.id === u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-700/50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const current = (task.assignees ?? []).map(a => a.id);
                                const next = checked ? current.filter(id => id !== u.id) : [...current, u.id];
                                fieldChange({ assignee_ids: next, clear_assignees: next.length === 0 });
                              }}
                              className="accent-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-xs text-slate-300">{u.name}</span>
                          </label>
                        );
                      })}
                    </div>
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
                  <div className="sm:col-span-2">
                    <label className={panelLbl}>Category</label>
                    <input
                      type="text"
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      onBlur={() => { if (editCategory !== (task.category ?? '')) fieldChange({ category: editCategory }); }}
                      placeholder="e.g. Bug Fix, Development…"
                      className={panelSel}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={panelLbl}>Deskripsi</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onPaste={handlePasteInPanel}
                    rows={4}
                    placeholder="Tambah deskripsi… (Ctrl+V untuk tempel gambar)"
                    className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={panelLbl}><Paperclip className="w-3 h-3 inline mr-1" />Lampiran {attachments.length > 0 && `(${attachments.length})`}</label>
                    {canEdit && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={e => handleUploadFiles(e.target.files)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAttachment}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                          {uploadingAttachment ? <Spinner className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                          {uploadingAttachment ? 'Uploading…' : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>
                  {attachments.length === 0 && !uploadingAttachment ? (
                    <div
                      className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-slate-500 transition-colors"
                      onClick={() => canEdit && fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={e => { e.preventDefault(); canEdit && handleUploadFiles(e.dataTransfer.files); }}
                    >
                      <Upload className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-600">{canEdit ? 'Klik atau drag file ke sini' : 'Belum ada lampiran'}</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">Atau paste gambar (Ctrl+V)</p>
                    </div>
                  ) : (
                    <div
                      className="flex flex-wrap gap-2"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); canEdit && handleUploadFiles(e.dataTransfer.files); }}
                    >
                      {attachments.map(a => {
                        const isImage = a.mime_type.startsWith('image/');
                        const dataUrl = `data:${a.mime_type};base64,${a.data}`;
                        return (
                          <div key={a.id} className="relative group">
                            {isImage ? (
                              <img
                                src={dataUrl}
                                alt={a.filename}
                                className="h-20 w-20 object-cover rounded-lg border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors"
                                onClick={() => window.open(dataUrl, '_blank')}
                              />
                            ) : (
                              <a
                                href={dataUrl}
                                download={a.filename}
                                className="flex flex-col items-center justify-center h-20 w-20 rounded-lg border border-slate-700 bg-slate-800 hover:border-slate-500 transition-colors gap-1 px-1"
                              >
                                <FileText className="w-6 h-6 text-slate-400" />
                                <span className="text-[9px] text-slate-500 text-center leading-tight truncate w-full text-center">{a.filename}</span>
                              </a>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteAttachment(a.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {uploadingAttachment && (
                        <div className="flex items-center justify-center h-20 w-20 rounded-lg border border-slate-700 bg-slate-800/50">
                          <Spinner className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                    </div>
                  )}
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
            )}

            {/* ── Child Issues Tab ── */}
            {activeTab === 'subtasks' && (
              <div className="px-5 py-4">
                <div className="space-y-1.5 mb-3">
                  {subtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-slate-800/50">
                      <div className="w-4 h-4 rounded-sm bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
                        <ListTodo className="w-2.5 h-2.5 text-indigo-400" />
                      </div>
                      <span className={`flex-1 truncate text-sm ${st.status === 'done' ? 'line-through text-slate-500' : 'text-slate-300'}`}>{st.title}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${st.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/60 text-slate-500'}`}>
                        {st.status}
                      </span>
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <div className="flex flex-col items-center py-6 gap-1.5">
                      <ListTodo className="w-6 h-6 text-slate-700" />
                      <p className="text-xs text-slate-600 font-medium">Belum ada child issue</p>
                      <p className="text-[11px] text-slate-700">Tambahkan subtask di bawah</p>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <input
                      value={newSubtask}
                      onChange={e => setNewSubtask(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                      placeholder="Tambah child issue…"
                      className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleAddSubtask}
                      disabled={addingSubtask || !newSubtask.trim()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Time Logs Tab ── */}
            {activeTab === 'timelogs' && (
              <div className="px-5 py-4">
                {timeLoading && !timeLogs && (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-16 rounded-xl bg-slate-800/60" />
                    <div className="h-10 rounded-lg bg-slate-800/40" />
                    <div className="h-10 rounded-lg bg-slate-800/40" />
                  </div>
                )}
                {(!timeLoading || timeLogs) && <TimeTrackingSection
                  timeLogs={timeLogs}
                  loading={timeLoading}
                  tick={clockTick}
                  myActiveLog={myActiveLog}
                  taskActiveLog={activeLog}
                  onClockIn={handleClockIn}
                  onClockOut={handleClockOut}
                  onManualLog={handleManualTimeLog}
                  onDeleteLog={handleDeleteTimeLog}
                />}
              </div>
            )}

            {/* ── History Tab ── */}
            {activeTab === 'history' && (
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  {histLoading && <span className="text-[10px] text-slate-600 animate-pulse">loading…</span>}
                </div>
                <div className="space-y-3">
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
                    <div className="flex flex-col items-center py-6 gap-1.5">
                      <History className="w-6 h-6 text-slate-700" />
                      <p className="text-xs text-slate-600 font-medium">Belum ada perubahan</p>
                      <p className="text-[11px] text-slate-700">Riwayat edit akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Time Tracking Section ────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
}

function TimeTrackingSection({
  timeLogs, loading, tick, myActiveLog, taskActiveLog, onClockIn, onClockOut, onManualLog, onDeleteLog,
}: {
  timeLogs: TaskTimeLogsResponse | null;
  loading: boolean;
  tick: number;
  myActiveLog?: TaskTimeLog | null;
  taskActiveLog?: TaskTimeLog;
  onClockIn: (manualTime?: string) => Promise<void>;
  onClockOut: (manualTime?: string) => Promise<void>;
  onManualLog: (clockIn: string, clockOut: string) => Promise<void>;
  onDeleteLog: (logId: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualMode, setManualMode] = useState<'clock-in' | 'clock-out' | 'add'>('add');
  const [manualTime, setManualTime] = useState('');
  const [manualIn, setManualIn] = useState('');
  const [manualOut, setManualOut] = useState('');

  const liveSec = timeLogs?.active_log
    ? Math.floor((Date.now() - new Date(timeLogs.active_log.clock_in).getTime()) / 1000) + (tick * 0)
    : 0;
  const total = (timeLogs?.total_duration ?? 0) + liveSec;
  const isActive = !!timeLogs?.active_log;
  // User sedang aktif di task lain (bukan task ini)
  const myActiveElsewhere = myActiveLog && myActiveLog.task_id !== taskActiveLog?.task_id && !isActive ? myActiveLog : null;

  const handle = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const handleManualSubmit = async () => {
    if (manualMode === 'clock-in') {
      await handle(() => onClockIn(manualTime));
    } else if (manualMode === 'clock-out') {
      await handle(() => onClockOut(manualTime));
    } else {
      if (!manualIn || !manualOut) return;
      await handle(() => onManualLog(manualIn, manualOut));
      setManualIn('');
      setManualOut('');
    }
    setShowManual(false);
    setManualTime('');
  };

  if (loading) return (
    <div className="text-xs text-slate-600 animate-pulse py-2">Memuat data waktu…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 space-y-3">
      {/* Total + clock buttons */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-slate-500 mb-0.5">Total waktu</p>
          <p className={`text-base font-mono font-semibold ${isActive ? 'text-green-400' : 'text-white'}`}>
            {fmtDuration(total)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <button
              onClick={() => handle(() => onClockOut())}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Square className="w-3 h-3 fill-current" />
              Clock Out
            </button>
          ) : (
            <button
              onClick={() => handle(() => onClockIn())}
              disabled={busy || !!myActiveElsewhere}
              title={myActiveElsewhere ? `Sedang aktif di: ${myActiveElsewhere.task_title ?? 'task lain'}` : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3 h-3 fill-current" />
              Clock In
            </button>
          )}
          <button
            onClick={() => { setShowManual(v => !v); setManualMode(isActive ? 'clock-out' : 'add'); }}
            title="Input manual"
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active session indicator */}
      {isActive && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Sedang berjalan · {fmtDuration(liveSec)}
        </div>
      )}

      {/* Warning: user is clocked in on another task */}
      {myActiveElsewhere && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-xs text-amber-400">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <span>
            Kamu sedang aktif di task lain
            {myActiveElsewhere.task_title ? `: "${myActiveElsewhere.task_title}"` : ''}
            . Clock out dulu sebelum pindah.
          </span>
        </div>
      )}

      {/* Manual input panel */}
      {showManual && (
        <div className="border border-slate-700 rounded-lg p-3 space-y-2.5 bg-slate-900/60">
          <div className="flex gap-1.5">
            {(['add', 'clock-in', 'clock-out'] as const).map(m => (
              <button
                key={m}
                onClick={() => setManualMode(m)}
                className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${manualMode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {m === 'add' ? 'Tambah Log' : m === 'clock-in' ? 'Clock In Manual' : 'Clock Out Manual'}
              </button>
            ))}
          </div>
          {manualMode === 'add' ? (
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Mulai</p>
                <input type="datetime-local" value={manualIn} onChange={e => setManualIn(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 [color-scheme:dark] focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Selesai</p>
                <input type="datetime-local" value={manualOut} onChange={e => setManualOut(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 [color-scheme:dark] focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Waktu {manualMode === 'clock-in' ? 'masuk' : 'keluar'}</p>
              <input type="datetime-local" value={manualTime} onChange={e => setManualTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 [color-scheme:dark] focus:outline-none focus:border-indigo-500" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowManual(false)}
              className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
              Batal
            </button>
            <button onClick={handleManualSubmit} disabled={busy}
              className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50">
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* Log history */}
      {(timeLogs?.logs ?? []).length > 0 && (
        <div className="space-y-1 border-t border-slate-700/50 pt-2.5">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Riwayat sesi</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {timeLogs!.logs.map(log => (
              <TimeLogRow key={log.id} log={log} onDelete={onDeleteLog} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeLogRow({ log, onDelete }: { log: TaskTimeLog; onDelete: (id: number) => Promise<void> }) {
  const start = new Date(log.clock_in).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const isOpen = !log.clock_out;

  return (
    <div className="group flex items-center justify-between gap-2 text-[11px] py-1 px-1 rounded hover:bg-slate-800/50">
      <div className="flex items-center gap-1.5 min-w-0">
        {isOpen
          ? <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          : <Clock3 className="w-3 h-3 text-slate-600 flex-shrink-0" />
        }
        <span className="text-slate-400 truncate">{log.user?.name ?? 'Unknown'}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500 truncate">{start}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`font-mono ${isOpen ? 'text-green-400' : 'text-slate-300'}`}>
          {isOpen ? 'aktif' : fmtDuration(log.duration)}
        </span>
        {!isOpen && (
          <button
            onClick={() => onDelete(log.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

const panelLbl = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5';
const panelSel = 'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors';

// ─── Task Form Modal ──────────────────────────────────────────────────────────

export type PendingImage = { filename: string; mimeType: string; data: string; preview: string };

function TaskFormModal({
  title, form, users, columns, colLabels, onChange, onSubmit, onClose, submitLabel, saving = false,
}: {
  title: string;
  form: CreateTaskRequest;
  users: User[];
  columns: ColDef[];
  colLabels: Record<string, string>;
  onChange: (f: CreateTaskRequest) => void;
  onSubmit: (e: React.FormEvent, images: PendingImage[], subtasks: string[]) => void;
  onClose: () => void;
  submitLabel: string;
  saving?: boolean;
}) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [subtaskList, setSubtaskList] = useState<string[]>([]);
  const formFileInputRef = useRef<HTMLInputElement>(null);

  // ESC to close modal
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const readFileAsPendingImage = (file: File): Promise<PendingImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        resolve({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: dataUrl.split(',')[1],
          preview: dataUrl,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFormFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results = await Promise.all(Array.from(files).map(readFileAsPendingImage));
    setPendingImages(prev => [...prev, ...results]);
    if (formFileInputRef.current) formFileInputRef.current.value = '';
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    // Prefer png; Mac clipboard often has both png + tiff for the same screenshot
    const best = imageItems.find(i => i.type === 'image/png') ?? imageItems[0];
    const f = best.getAsFile();
    if (!f) return;
    const file = new File([f], `paste-${Date.now()}.png`, { type: 'image/png' });
    const result = await readFileAsPendingImage(file);
    setPendingImages(prev => [...prev, result]);
  };

  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtaskList(prev => [...prev, t]);
    setNewSubtask('');
  };

  const pc = PRIORITY_CONFIG[form.priority ?? 'medium'] ?? PRIORITY_CONFIG.medium;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[calc(100vh-1.5rem)] flex flex-col rounded-xl border border-[#2a3147] bg-[#1a2035] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a3147] flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SquarePlus className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400 font-medium">{title}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <form onSubmit={e => onSubmit(e, pendingImages, subtaskList)} onPaste={handlePaste}
          className="flex flex-col flex-1 min-h-0 overflow-hidden">

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: main content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-w-0">

              {/* Summary / Title */}
              <div>
                <input
                  required
                  value={form.title}
                  onChange={e => onChange({ ...form, title: e.target.value })}
                  placeholder="Summary"
                  className="w-full bg-transparent text-white text-lg font-semibold placeholder-slate-600 border-b border-[#2a3147] pb-2 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <textarea
                  value={form.description}
                  onChange={e => onChange({ ...form, description: e.target.value })}
                  onPaste={handlePaste}
                  placeholder="Add a description… (Ctrl+V untuk tempel gambar)"
                  rows={5}
                  className="w-full bg-[#141925] border border-[#2a3147] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Paperclip className="w-3 h-3 inline mr-1" />Attachments {pendingImages.length > 0 && `(${pendingImages.length})`}
                  </p>
                  <button type="button" onClick={() => formFileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    <Upload className="w-3 h-3" /> Upload file
                  </button>
                </div>
                <input ref={formFileInputRef} type="file" multiple className="hidden"
                  onChange={e => handleFormFileSelect(e.target.files)} />
                {pendingImages.length > 0 ? (
                  <div className="flex flex-wrap gap-2"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFormFileSelect(e.dataTransfer.files); }}>
                    {pendingImages.map((img, i) => (
                      <div key={i} className="relative group">
                        {img.mimeType.startsWith('image/') ? (
                          <img src={img.preview} className="h-20 w-20 object-cover rounded-lg border border-[#2a3147]" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-20 w-20 rounded-lg border border-[#2a3147] bg-slate-800 gap-1 px-1">
                            <FileText className="w-6 h-6 text-slate-400" />
                            <span className="text-[9px] text-slate-500 truncate w-full text-center">{img.filename}</span>
                          </div>
                        )}
                        <button type="button"
                          onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => formFileInputRef.current?.click()}
                      className="h-20 w-20 rounded-lg border-2 border-dashed border-[#2a3147] hover:border-slate-600 flex flex-col items-center justify-center text-slate-600 hover:text-slate-400 text-xs text-center leading-tight transition-colors gap-1">
                      <Upload className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-[#2a3147] hover:border-slate-600 rounded-lg p-4 text-center cursor-pointer transition-colors"
                    onClick={() => formFileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFormFileSelect(e.dataTransfer.files); }}
                  >
                    <Upload className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                    <p className="text-xs text-slate-600">Klik, drag file, atau paste gambar (Ctrl+V)</p>
                  </div>
                )}
              </div>

              {/* Child Issues (Subtasks) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Child Issues {subtaskList.length > 0 && <span className="text-slate-600 normal-case font-normal">({subtaskList.length})</span>}
                  </p>
                </div>

                {/* Subtask rows — JIRA child issue style */}
                {subtaskList.length > 0 && (
                  <div className="mb-3 rounded-lg border border-[#2a3147] overflow-hidden divide-y divide-[#2a3147]">
                    {subtaskList.map((st, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-[#141925] hover:bg-[#1a2035] group transition-colors">
                        {/* Issue type icon (subtask) */}
                        <div className="w-4 h-4 rounded-sm bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
                          <ListTodo className="w-2.5 h-2.5 text-indigo-400" />
                        </div>
                        {/* Summary */}
                        <span className="flex-1 text-sm text-slate-300 truncate">{st}</span>
                        {/* Status badge */}
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded flex-shrink-0">
                          Open
                        </span>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setSubtaskList(prev => prev.filter((_, j) => j !== i))}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create child issue input */}
                <button
                  type="button"
                  onClick={() => document.getElementById('subtask-input')?.focus()}
                  className="w-full text-left text-xs text-slate-500 hover:text-slate-300 flex items-center gap-2 py-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create child issue
                </button>
                <div className="flex gap-2 mt-1">
                  <input
                    id="subtask-input"
                    type="text"
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                    placeholder="What needs to be done?"
                    className="flex-1 bg-[#141925] border border-[#2a3147] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button type="button" onClick={addSubtask}
                    disabled={!newSubtask.trim()}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-40 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: metadata sidebar */}
            <div className="w-56 flex-shrink-0 border-l border-[#2a3147] overflow-y-auto px-4 py-4 space-y-4">

              {/* Status */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</p>
                <select
                  value={form.status}
                  onChange={e => onChange({ ...form, status: e.target.value as TaskStatus })}
                  className={jinp}
                >
                  {columns.map(c => (
                    <option key={c.key} value={c.key}>{colLabels[c.key] || c.label}</option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assignee</p>
                <div className="flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-2 max-h-36 overflow-y-auto">
                  {users.map(u => {
                    const checked = (form.assignee_ids ?? []).includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-700/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = form.assignee_ids ?? [];
                            const next = checked ? current.filter(id => id !== u.id) : [...current, u.id];
                            onChange({ ...form, assignee_ids: next });
                          }}
                          className="accent-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-slate-300">{u.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</p>
                <select
                  value={form.priority}
                  onChange={e => onChange({ ...form, priority: e.target.value as TaskPriority })}
                  className={jinp}
                >
                  {PRIORITY_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${pc.text}`}>
                  <span>{pc.icon}</span>
                  <span>{pc.label} priority</span>
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category</p>
                <input
                  type="text"
                  value={form.category ?? ''}
                  onChange={e => onChange({ ...form, category: e.target.value })}
                  placeholder="e.g. Bug Fix, Development"
                  className={jinp}
                />
              </div>

              {/* Due Date */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</p>
                <input
                  type="date"
                  value={form.due_date ?? ''}
                  onChange={e => onChange({ ...form, due_date: e.target.value })}
                  className={`${jinp} [color-scheme:dark]`}
                />
              </div>

              {/* Tip */}
              <div className="pt-2 border-t border-[#2a3147]">
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Tip: drag &amp; drop, klik Upload, atau paste gambar (<kbd className="bg-slate-700 text-slate-500 px-1 rounded text-[9px] font-mono">Ctrl+V</kbd>)
                </p>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#2a3147] flex-shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-700 text-slate-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
              {saving && <Spinner className="w-3.5 h-3.5" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const jinp = "w-full rounded-md border border-[#2a3147] bg-[#141925] px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors";

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

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

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
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select user to add…</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedUserId || adding}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {members.map(m => (
            <div key={m.id} className="flex flex-col gap-3 rounded-xl bg-slate-900/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-sm font-bold">
                    {(m.user?.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.user?.name ?? 'Unknown'}</p>
                  <p className="text-slate-500 text-xs truncate">{m.user?.email ?? ''}</p>
                </div>
              </div>
              <div className="ml-0 flex items-center gap-2 sm:ml-2 sm:flex-shrink-0">
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
