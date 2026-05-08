import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, CheckCircle2, Clock, AlertCircle, Loader2,
  ArrowRight, RefreshCw, TrendingUp, Users, ShieldAlert,
  Flame, Activity, Timer, ChevronLeft, ChevronRight,
  Users2, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { DashboardStatSkeleton, DashboardRowSkeleton } from '../components/Skeleton';
import { useAuth } from '../context/useAuth';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import type { Project, Task, User, TaskTimeLog } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectStat { project: Project; tasks: Task[] }

// ─── Status config ────────────────────────────────────────────────────────────

const BASE_STATUS_CFG: Record<string, { label: string; bar: string; text: string; ring: string }> = {
  backlog:     { label: 'Backlog',     bar: 'bg-slate-500',  text: 'text-slate-400',  ring: 'ring-slate-500'  },
  todo:        { label: 'To Do',       bar: 'bg-blue-500',   text: 'text-blue-400',   ring: 'ring-blue-500'   },
  in_progress: { label: 'In Progress', bar: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500' },
  review:      { label: 'Review',      bar: 'bg-purple-500', text: 'text-purple-400', ring: 'ring-purple-500' },
  done:        { label: 'Done',        bar: 'bg-green-500',  text: 'text-green-400',  ring: 'ring-green-500'  },
};

function getStatusCfg(key: string) {
  return BASE_STATUS_CFG[key] ?? { label: key, bar: 'bg-pink-500', text: 'text-pink-400', ring: 'ring-pink-500' };
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIO_CFG = {
  high:   { label: 'High',   dot: 'bg-red-500',    text: 'text-red-400',    bar: 'bg-red-500'    },
  medium: { label: 'Medium', dot: 'bg-yellow-500', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  low:    { label: 'Low',    dot: 'bg-slate-500',  text: 'text-slate-400',  bar: 'bg-slate-500'  },
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function getProjectStatusLabel(projectId: number, key: string): string {
  const labels: Record<string, string> = lsGet(`proj-${projectId}-labels`, {});
  if (labels[key]) return labels[key];
  if (BASE_STATUS_CFG[key]) return BASE_STATUS_CFG[key].label;
  const custom: Array<{ key: string; label: string }> = lsGet(`proj-${projectId}-custom-cols`, []);
  return custom.find(c => c.key === key)?.label ?? key;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(t: Task) {
  if (!t.due_date || t.status === 'done') return false;
  const d = new Date(String(t.due_date).substring(0, 10));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDueSoon(t: Task) {
  if (!t.due_date || t.status === 'done' || isOverdue(t)) return false;
  const d = new Date(String(t.due_date).substring(0, 10));
  const soon = new Date(); soon.setDate(soon.getDate() + 3); soon.setHours(23, 59, 59, 999);
  return d <= soon;
}

function fmtDate(s: string | undefined) {
  if (!s) return '—';
  return new Date(String(s).substring(0, 10))
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function healthScore(tasks: Task[]): { score: number; label: string; color: string } {
  if (!tasks.length) return { score: 0, label: 'No Tasks', color: 'text-slate-500' };
  const done = tasks.filter(t => t.status === 'done').length;
  const overdue = tasks.filter(isOverdue).length;
  const highBlocked = tasks.filter(t => t.priority === 'high' && t.status === 'backlog').length;
  let score = Math.round((done / tasks.length) * 100);
  score = Math.max(0, score - overdue * 15 - highBlocked * 10);
  if (score >= 70) return { score, label: 'On Track',   color: 'text-green-400'  };
  if (score >= 40) return { score, label: 'At Risk',    color: 'text-yellow-400' };
  return               { score, label: 'Off Track',  color: 'text-red-400'    };
}

function groupBy<T>(arr: T[], key: (t: T) => string) {
  return arr.reduce<Record<string, T[]>>((acc, t) => {
    const k = key(t); (acc[k] ??= []).push(t); return acc;
  }, {});
}

type WlMode = 'week' | 'month';

// ─── Excel export ─────────────────────────────────────────────────────────────

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function fmtTanggal(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtJam(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

function secsToDurasi(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h} Jam ${m} Menit`;
  if (h > 0) return `${h} Jam`;
  return `${m} Menit`;
}

async function downloadWorkloadExcel(logs: TaskTimeLog[], periodLabel: string) {
  const XLSX = await import('xlsx');

  // ── Sheet 1: Detail per sesi (format sesuai template) ──
  const detailRows = [...logs]
    .filter(l => l.clock_out) // hanya sesi yang sudah selesai
    .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
    .map(log => {
      const ci = new Date(log.clock_in);
      return {
        'Nama'            : log.user?.name ?? `User #${log.user_id}`,
        'Tanggal'         : fmtTanggal(log.clock_in),
        'Hari'            : HARI[ci.getDay()],
        'Project/System'  : log.project_name || '—',
        'Category'        : log.category || '—',
        'Task Description': log.task_title || `Task #${log.task_id}`,
        'Priority'        : log.priority || '—',
        'Status'          : log.status || '—',
        'Start'           : fmtJam(log.clock_in),
        'End'             : log.clock_out ? fmtJam(log.clock_out) : '—',
        'Duration'        : log.clock_out ? secsToDurasi(log.duration) : '—',
      };
    });

  // ── Sheet 2: Ringkasan per user ──
  const byUser = new Map<number, { name: string; logs: TaskTimeLog[] }>();
  for (const log of logs) {
    if (!byUser.has(log.user_id)) byUser.set(log.user_id, { name: log.user?.name ?? `User #${log.user_id}`, logs: [] });
    byUser.get(log.user_id)!.logs.push(log);
  }
  const summaryRows = [...byUser.values()]
    .sort((a, b) => b.logs.reduce((s, l) => s + l.duration, 0) - a.logs.reduce((s, l) => s + l.duration, 0))
    .map(({ name, logs: uLogs }) => ({
      'Nama'        : name,
      'Total Durasi': secsToDurasi(uLogs.reduce((s, l) => s + l.duration, 0)),
      'Jumlah Task' : new Set(uLogs.map(l => l.task_id)).size,
      'Jumlah Sesi' : uLogs.length,
    }));

  const wb = XLSX.utils.book_new();
  const wsDetail  = XLSX.utils.json_to_sheet(detailRows);
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  wsDetail['!cols']  = [
    { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
    { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 12 },
    { wch: 8  }, { wch: 8  }, { wch: 14 },
  ];
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(wb, wsDetail,  'Detail Sesi');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  const filename = `workload_${periodLabel.replace(/\s/g, '_').replace(/[–—]/g, '-')}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [stats,       setStats]       = useState<ProjectStat[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedId,  setSelectedId]  = useState<number | null>(null);

  // Time tracking calendar state
  const [calMonth,    setCalMonth]    = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [timeLogs,    setTimeLogs]    = useState<TaskTimeLog[]>([]);
  const [timeLoading, setTimeLoading] = useState(false);
  const [calSelDay,   setCalSelDay]   = useState<string | null>(null);

  // Team workload state
  const [wlMode,      setWlMode]      = useState<WlMode>('week');
  const [wlOffset,    setWlOffset]    = useState(0); // 0 = current, -1 = previous, etc.
  const [teamLogs,    setTeamLogs]    = useState<TaskTimeLog[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [wlExpanded,  setWlExpanded]  = useState<number | null>(null); // expanded user id
  const [activeTab,   setActiveTab]   = useState<'overview' | 'workload'>('overview');
  const [filterOpen,  setFilterOpen]  = useState(false);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-filter-dropdown]')) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [{ data: projects }, { data: allUsers }] = await Promise.all([
        projectsApi.getAll(),
        usersApi.getAll(),
      ]);
      const taskResults = await Promise.all(
        projects.map(p =>
          tasksApi.getByProject(p.id).then(r => r.data ?? []).catch(() => [] as Task[])
        )
      );
      const newStats = projects.map((p, i) => ({ project: p, tasks: taskResults[i] }));
      setStats(newStats);
      setUsers(allUsers);
      setLastRefresh(new Date());
      // Jika project yang dipilih dihapus, reset ke semua
      setSelectedId(prev => prev && !projects.find(p => p.id === prev) ? null : prev);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const { year, month } = calMonth;
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setTimeLoading(true);
    tasksApi.getMyTimeLogs(from, to)
      .then(r => setTimeLogs(r.data ?? []))
      .catch(() => setTimeLogs([]))
      .finally(() => setTimeLoading(false));
  }, [calMonth]);

  // ── Team workload date range ───────────────────────────────────────────────

  const wlRange = (() => {
    const now = new Date();
    if (wlMode === 'week') {
      const day = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7) + wlOffset * 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d: Date) => d.toISOString().substring(0, 10);
      return { from: fmt(monday), to: fmt(sunday), label: `${fmt(monday)} – ${fmt(sunday)}` };
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() + wlOffset, 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to, label: new Date(d).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
    }
  })();

  useEffect(() => {
    setTeamLoading(true);
    tasksApi.getAllTimeLogs(wlRange.from, wlRange.to)
      .then(r => setTeamLogs(r.data ?? []))
      .catch(() => setTeamLogs([]))
      .finally(() => setTeamLoading(false));
  }, [wlRange.from, wlRange.to]);

  // ── Filter berdasarkan project yang dipilih ────────────────────────────────

  const activeStats  = selectedId ? stats.filter(s => s.project.id === selectedId) : stats;
  const selectedProj = selectedId ? stats.find(s => s.project.id === selectedId)?.project : null;

  // ── Metrics (dihitung dari activeStats) ───────────────────────────────────

  const allTasks     = activeStats.flatMap(s => s.tasks);
  const totalProj    = activeStats.length;
  const totalTasks   = allTasks.length;
  const doneTasks    = allTasks.filter(t => t.status === 'done').length;
  const activeTasks  = allTasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = allTasks.filter(isOverdue);
  const dueSoonTasks = allTasks.filter(isDueSoon);
  const completionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const highPrioOpen  = allTasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  // status distribution
  const statusGroups = groupBy(allTasks, t => t.status);
  const prioGroups   = groupBy(allTasks, t => t.priority ?? 'medium');

  // team workload — hanya tampilkan user yang punya task di project aktif
  const assigneeGroups = groupBy(
    allTasks.filter(t => t.assignee_id),
    t => String(t.assignee_id)
  );
  const activeUsers = selectedId
    ? users.filter(u => assigneeGroups[String(u.id)])
    : users;

  if (loading) return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1,2,3,4].map(i => <DashboardStatSkeleton key={i} />)}
        </div>
        {/* Content rows */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><DashboardRowSkeleton /></div>
          <DashboardRowSkeleton />
        </div>
        <DashboardRowSkeleton />
        <DashboardRowSkeleton />
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Project Dashboard</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Selamat datang, <span className="text-slate-300 font-medium">{user?.name}</span>
                {' '}·{' '}
                <span className="text-slate-600">
                  Update: {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
            {/* Tabs Overview / Team Workload */}
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 ml-2">
              {([['overview', 'Overview'], ['workload', 'Team Workload']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-white shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ── Project filter dropdown ── */}
        <div className="relative w-fit" data-filter-dropdown>
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
            <span>{selectedId === null ? 'Semua Project' : (selectedProj?.name ?? '—')}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] max-w-[280px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-lg shadow-black/40">
              <button
                onClick={() => { setSelectedId(null); setFilterOpen(false); }}
                className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                  selectedId === null ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Semua Project
              </button>
              <div className="my-1 border-t border-slate-800" />
              {stats.map(s => (
                <button
                  key={s.project.id}
                  onClick={() => { setSelectedId(s.project.id); setFilterOpen(false); }}
                  className={`w-full truncate px-3 py-2 text-left text-xs transition-colors ${
                    selectedId === s.project.id ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={s.project.name}
                >
                  {s.project.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Project context banner (saat project dipilih) ── */}
        {selectedProj && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FolderKanban className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-slate-200 font-semibold text-sm">{selectedProj.name}</p>
                {selectedProj.description && (
                  <p className="text-slate-500 text-xs">{selectedProj.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate(`/projects/${selectedProj.id}`)}
              className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white sm:w-auto"
            >
              Buka Kanban <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Metrics Bar ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={<FolderKanban className="w-5 h-5 text-indigo-400" />}
            iconBg="bg-indigo-500/15"
            label={selectedId ? 'Project' : 'Total Project'}
            value={selectedId ? selectedProj?.name ?? '—' : String(totalProj)}
            sub={selectedId ? `${totalTasks} task terdaftar` : `${users.length} anggota tim`}
          />
          <MetricCard
            icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
            iconBg="bg-green-500/15"
            label="Task Selesai"
            value={`${doneTasks}/${totalTasks}`}
            sub={`${completionPct}% completion rate`}
            highlight={completionPct === 100 ? 'green' : undefined}
          />
          <MetricCard
            icon={<Activity className="w-5 h-5 text-yellow-400" />}
            iconBg="bg-yellow-500/15"
            label="Sedang Dikerjakan"
            value={String(activeTasks)}
            sub={`dari ${totalTasks} total task`}
          />
          <MetricCard
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            iconBg="bg-orange-500/15"
            label="Prioritas Tinggi"
            value={String(highPrioOpen)}
            sub="task high priority aktif"
            highlight={highPrioOpen > 0 ? 'orange' : undefined}
          />
          <MetricCard
            icon={<AlertCircle className="w-5 h-5 text-red-400" />}
            iconBg="bg-red-500/15"
            label="Overdue"
            value={String(overdueTasks.length)}
            sub={dueSoonTasks.length > 0 ? `+${dueSoonTasks.length} jatuh tempo 3 hari` : 'tidak ada yang jatuh tempo'}
            highlight={overdueTasks.length > 0 ? 'red' : undefined}
          />
        </div>

        {activeTab === 'overview' && (<>

        {/* ── Row 2: Project Health ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
            <SectionHeader
              icon={<TrendingUp className="w-4 h-4 text-indigo-400" />}
              title={selectedId ? 'Detail Project' : 'Status Setiap Project'}
            />

            {stats.length === 0 ? (
              <EmptyState label="Belum ada project" action="Buat project →" onClick={() => navigate('/projects')} />
            ) : (
              <div className="space-y-5 mt-4">
                {stats.map(({ project, tasks }) => {
                  const total   = tasks.length;
                  const done    = tasks.filter(t => t.status === 'done').length;
                  const pct     = total ? Math.round((done / total) * 100) : 0;
                  const health  = healthScore(tasks);
                  const byStatus = groupBy(tasks, t => t.status);
                  const statusKeys = Object.keys(byStatus).sort((a, b) => {
                    const o = ['backlog','todo','in_progress','review','done'];
                    return (o.indexOf(a) === -1 ? 99 : o.indexOf(a)) - (o.indexOf(b) === -1 ? 99 : o.indexOf(b));
                  });
                  const overdueCount = tasks.filter(isOverdue).length;

                  return (
                    <div key={project.id} className="border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                      {/* Project header */}
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-white font-semibold">{project.name}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 ${health.color}`}>
                              {health.label}
                            </span>
                            {overdueCount > 0 && (
                              <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                {overdueCount} overdue
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-slate-500 text-xs mt-0.5">{project.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="flex min-h-10 items-center gap-1 self-start rounded-lg border border-slate-800 px-3 py-2 text-xs text-indigo-400 transition-colors hover:border-slate-700 hover:text-indigo-300 sm:ml-3 sm:self-center"
                        >
                          Buka Board <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Overall progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                          <span>{done} dari {total} task selesai</span>
                          <span className={pct === 100 ? 'text-green-400 font-semibold' : 'text-slate-300 font-medium'}>{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Status breakdown bars */}
                      {total > 0 && (
                        <div className="space-y-1.5">
                          {statusKeys.map(key => {
                            const cfg   = getStatusCfg(key);
                            const count = byStatus[key].length;
                            const barPct = (count / total) * 100;
                            const label = getProjectStatusLabel(project.id, key);
                            return (
                              <div key={key} className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center sm:gap-2.5">
                                <div className="flex items-center justify-between gap-2 sm:block sm:w-24 sm:flex-shrink-0">
                                  <span className={cfg.text}>{label}</span>
                                  <span className="text-slate-600 sm:hidden">{count} · {Math.round(barPct)}%</span>
                                </div>
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${barPct}%` }} />
                                </div>
                                <span className="hidden w-4 flex-shrink-0 text-right text-slate-400 sm:block">{count}</span>
                                <span className="hidden w-8 flex-shrink-0 text-right text-slate-600 sm:block">
                                  {Math.round(barPct)}%
                                </span>
                              </div>
                            );
                          })}
                          {total === 0 && <p className="text-slate-600 text-xs">Belum ada task</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* ── Row 3: Status Distribution + Priority ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Status Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
            <SectionHeader icon={<Activity className="w-4 h-4 text-yellow-400" />} title="Distribusi Status Task" />

            {totalTasks === 0 ? (
              <EmptyState label="Belum ada task" />
            ) : (
              <div className="mt-4 space-y-3">
                {/* Stacked bar */}
                <div className="flex h-4 rounded-lg overflow-hidden gap-0.5">
                  {Object.keys(statusGroups)
                    .sort((a, b) => {
                      const o = ['backlog','todo','in_progress','review','done'];
                      return (o.indexOf(a) === -1 ? 99 : o.indexOf(a)) - (o.indexOf(b) === -1 ? 99 : o.indexOf(b));
                    })
                    .map(key => {
                      const pct = (statusGroups[key].length / totalTasks) * 100;
                      return (
                        <div
                          key={key}
                          className={`${getStatusCfg(key).bar} first:rounded-l-lg last:rounded-r-lg`}
                          style={{ width: `${pct}%` }}
                          title={`${getStatusCfg(key).label}: ${statusGroups[key].length} task`}
                        />
                      );
                    })}
                </div>

                {/* Legend rows */}
                <div className="space-y-2">
                  {Object.keys(statusGroups)
                    .sort((a, b) => {
                      const o = ['backlog','todo','in_progress','review','done'];
                      return (o.indexOf(a) === -1 ? 99 : o.indexOf(a)) - (o.indexOf(b) === -1 ? 99 : o.indexOf(b));
                    })
                    .map(key => {
                      const cfg   = getStatusCfg(key);
                      const count = statusGroups[key].length;
                      const pct   = Math.round((count / totalTasks) * 100);
                      const label = stats.length > 0 ? getProjectStatusLabel(stats[0].project.id, key) : cfg.label;
                      return (
                        <div key={key} className="flex flex-col gap-2 rounded-xl border border-slate-800/80 px-3 py-2 sm:flex-row sm:items-center sm:border-0 sm:px-0 sm:py-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.bar}`} />
                          <span className={`text-sm flex-1 ${cfg.text}`}>{label}</span>
                          <div className="flex items-center gap-3 sm:ml-auto">
                            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-slate-300 text-sm font-semibold w-4 text-right">{count}</span>
                            <span className="text-slate-600 text-xs w-9 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Priority Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
            <SectionHeader icon={<Flame className="w-4 h-4 text-orange-400" />} title="Distribusi Prioritas" />

            {totalTasks === 0 ? (
              <EmptyState label="Belum ada task" />
            ) : (
              <div className="mt-4 space-y-4">
                {(['high','medium','low'] as const).map(p => {
                  const tasks = prioGroups[p] ?? [];
                  const cfg   = PRIO_CFG[p];
                  const pct   = Math.round((tasks.length / totalTasks) * 100);
                  const doneCount = tasks.filter(t => t.status === 'done').length;
                  return (
                    <div key={p}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-500">{doneCount}/{tasks.length} done</span>
                          <span className="text-slate-300 font-semibold w-7 text-right">{tasks.length}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}

                {/* Summary callout */}
                <div className="mt-2 border border-slate-800 rounded-xl p-3 bg-slate-800/40">
                  <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Ringkasan Prioritas</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(['high','medium','low'] as const).map(p => {
                      const cfg = PRIO_CFG[p];
                      const openCount = (prioGroups[p] ?? []).filter(t => t.status !== 'done').length;
                      return (
                        <div key={p}>
                          <p className={`text-xl font-bold ${cfg.text}`}>{openCount}</p>
                          <p className="text-slate-600 text-xs">{cfg.label} Open</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Overdue & Due Soon Table ── */}
        {(overdueTasks.length > 0 || dueSoonTasks.length > 0) && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
            <SectionHeader
              icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
              title="Perlu Perhatian Segera"
              badge={overdueTasks.length + dueSoonTasks.length}
            />

            <div className="space-y-3 md:hidden">
              {[...overdueTasks, ...dueSoonTasks].map(task => {
                const projStat = stats.find(s => s.tasks.find(t => t.id === task.id));
                const over = isOverdue(task);
                const cfg = getStatusCfg(task.status);
                const prioCfg = PRIO_CFG[task.priority as keyof typeof PRIO_CFG] ?? PRIO_CFG.medium;
                return (
                  <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{task.title}</p>
                        <button
                          onClick={() => navigate(`/projects/${task.project_id}`)}
                          className="mt-1 text-left text-sm text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                          {projStat?.project.name ?? '—'}
                        </button>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${over ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-300'}`}>
                        {over ? 'Overdue' : 'Due soon'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Assignee</p>
                        <p className="text-slate-300">{task.assignee?.name ?? 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Due date</p>
                        <p className={over ? 'font-medium text-red-400' : 'font-medium text-yellow-300'}>{fmtDate(task.due_date)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Status</p>
                        <p className={`text-sm ${cfg.text}`}>{cfg.label}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Priority</p>
                        <p className={`text-sm ${prioCfg.text}`}>{prioCfg.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left pb-2 font-medium">Task</th>
                    <th className="text-left pb-2 font-medium">Project</th>
                    <th className="text-left pb-2 font-medium">Assignee</th>
                    <th className="text-left pb-2 font-medium">Due Date</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Priority</th>
                    <th className="text-left pb-2 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[...overdueTasks, ...dueSoonTasks].map(task => {
                    const projStat = stats.find(s => s.tasks.find(t => t.id === task.id));
                    const over     = isOverdue(task);
                    const cfg      = getStatusCfg(task.status);
                    const prioCfg  = PRIO_CFG[task.priority as keyof typeof PRIO_CFG] ?? PRIO_CFG.medium;
                    return (
                      <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 pr-3">
                          <p className="text-white font-medium truncate max-w-[160px]">{task.title}</p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <button
                            onClick={() => navigate(`/projects/${task.project_id}`)}
                            className="text-indigo-400 hover:text-indigo-300 truncate max-w-[120px] block transition-colors"
                          >
                            {projStat?.project.name ?? '—'}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-slate-400 truncate max-w-[100px] block">
                            {task.assignee?.name ?? 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`font-medium ${over ? 'text-red-400' : 'text-yellow-400'}`}>
                            {fmtDate(task.due_date)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs ${cfg.text}`}>
                            {getProjectStatusLabel(task.project_id, task.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${prioCfg.dot}`} />
                            <span className={`text-xs ${prioCfg.text}`}>{prioCfg.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          {over ? (
                            <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                              Overdue
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                              Jatuh tempo segera
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Row 5: All Tasks Summary Table ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={<Clock className="w-4 h-4 text-blue-400" />} title="Semua Task" />
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Lihat Kanban Board <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {allTasks.length === 0 ? (
            <EmptyState label="Belum ada task" action="Mulai dari Projects →" onClick={() => navigate('/projects')} />
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {allTasks.map(task => {
                const projStat = stats.find(s => s.tasks.find(t => t.id === task.id));
                const cfg = getStatusCfg(task.status);
                const prioCfg = PRIO_CFG[task.priority as keyof typeof PRIO_CFG] ?? PRIO_CFG.medium;
                const over = isOverdue(task);
                const soon = isDueSoon(task);
                return (
                  <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-3">
                      <p className="font-medium text-white">{task.title}</p>
                      {task.description && <p className="mt-1 text-sm text-slate-500">{task.description}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Project</p>
                        <button
                          onClick={() => navigate(`/projects/${task.project_id}`)}
                          className="text-left text-slate-300 transition-colors hover:text-indigo-400"
                        >
                          {projStat?.project.name ?? '—'}
                        </button>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Assignee</p>
                        <p className="text-slate-300">{task.assignee?.name ?? 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Status</p>
                        <p className={cfg.text}>{getProjectStatusLabel(task.project_id, task.status)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Priority</p>
                        <p className={prioCfg.text}>{prioCfg.label}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Due date</p>
                        <p className={task.due_date ? (over ? 'font-medium text-red-400' : soon ? 'font-medium text-yellow-300' : 'text-slate-300') : 'text-slate-600'}>
                          {task.due_date ? fmtDate(task.due_date) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left pb-2 font-medium">Task</th>
                    <th className="text-left pb-2 font-medium">Project</th>
                    <th className="text-left pb-2 font-medium">Assignee</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Priority</th>
                    <th className="text-left pb-2 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allTasks.map(task => {
                    const projStat = stats.find(s => s.tasks.find(t => t.id === task.id));
                    const cfg      = getStatusCfg(task.status);
                    const prioCfg  = PRIO_CFG[task.priority as keyof typeof PRIO_CFG] ?? PRIO_CFG.medium;
                    const over     = isOverdue(task);
                    const soon     = isDueSoon(task);
                    return (
                      <tr key={task.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-2.5 pr-3">
                          <p className="text-white group-hover:text-indigo-200 transition-colors font-medium truncate max-w-[200px]">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-slate-600 text-xs truncate max-w-[200px]">{task.description}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <button
                            onClick={() => navigate(`/projects/${task.project_id}`)}
                            className="text-slate-400 hover:text-indigo-400 transition-colors text-xs"
                          >
                            {projStat?.project.name ?? '—'}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3">
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-300 text-[10px] font-bold">
                                  {task.assignee.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-slate-400 text-xs">{task.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-medium ${cfg.text}`}>
                            {getProjectStatusLabel(task.project_id, task.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${prioCfg.dot}`} />
                            <span className={`text-xs ${prioCfg.text}`}>{prioCfg.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          {task.due_date ? (
                            <span className={`text-xs font-medium ${over ? 'text-red-400' : soon ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {fmtDate(task.due_date)}
                              {over && ' (Overdue)'}
                            </span>
                          ) : (
                            <span className="text-slate-700 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        </>)}

        {activeTab === 'workload' && (<>

        {/* ── Beban Kerja Tim ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
          <SectionHeader icon={<Users className="w-4 h-4 text-purple-400" />} title="Beban Kerja Tim" />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeUsers.length === 0 ? (
              <div className="col-span-full">
                <EmptyState label={selectedId ? 'Tidak ada assignee di project ini' : 'Belum ada user'} action="Kelola users →" onClick={() => navigate('/users')} />
              </div>
            ) : activeUsers.map(u => {
              const userTasks = assigneeGroups[String(u.id)] ?? [];
              const uDone   = userTasks.filter(t => t.status === 'done').length;
              const uActive = userTasks.filter(t => t.status === 'in_progress').length;
              const uOverdue = userTasks.filter(isOverdue).length;
              const uPct    = userTasks.length ? Math.round((uDone / userTasks.length) * 100) : 0;
              return (
                <div key={u.id} className="border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-300 text-sm font-bold">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{u.name}</p>
                      <p className="text-slate-500 text-xs capitalize">{u.role}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="text-center">
                      <p className="text-white font-bold text-base">{userTasks.length}</p>
                      <p className="text-slate-600 text-[10px]">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-yellow-400 font-bold text-base">{uActive}</p>
                      <p className="text-slate-600 text-[10px]">Aktif</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-base ${uOverdue > 0 ? 'text-red-400' : 'text-slate-600'}`}>{uOverdue}</p>
                      <p className="text-slate-600 text-[10px]">Overdue</p>
                    </div>
                  </div>
                  {userTasks.length > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Completion</span>
                        <span className={uPct === 100 ? 'text-green-400' : 'text-slate-300'}>{uPct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${uPct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${uPct}%` }} />
                      </div>
                    </>
                  )}
                  {userTasks.length === 0 && <p className="text-slate-600 text-xs text-center py-1">Tidak ada task</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Team Workload (Time Logs) ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <SectionHeader icon={<Users2 className="w-4 h-4 text-indigo-400" />} title="Team Workload" />
            <div className="flex items-center gap-2 flex-wrap">
              {/* Week / Month toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                {(['week', 'month'] as WlMode[]).map(m => (
                  <button key={m}
                    onClick={() => { setWlMode(m); setWlOffset(0); }}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${wlMode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {m === 'week' ? 'Minggu' : 'Bulan'}
                  </button>
                ))}
              </div>
              {/* Navigation */}
              <div className="flex items-center gap-1">
                <button onClick={() => setWlOffset(o => o - 1)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-300 min-w-[130px] text-center">{wlRange.label}</span>
                <button onClick={() => setWlOffset(o => Math.min(0, o + 1))}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30"
                  disabled={wlOffset >= 0}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {teamLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />}
              {/* Download Excel */}
              <button
                disabled={teamLogs.length === 0 || teamLoading}
                onClick={() => downloadWorkloadExcel(teamLogs, wlRange.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-green-500/50 hover:bg-green-500/10 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
            </div>
          </div>

          {/* Per-user cards */}
          {(() => {
            // Group logs by user
            const byUser = new Map<number, { user: TaskTimeLog['user'] & { id: number; name: string }; logs: TaskTimeLog[] }>();
            for (const log of teamLogs) {
              const uid = log.user_id;
              if (!byUser.has(uid)) byUser.set(uid, { user: log.user as any, logs: [] });
              byUser.get(uid)!.logs.push(log);
            }
            const rows = [...byUser.values()].sort((a, b) => {
              const aTotal = a.logs.reduce((s, l) => s + l.duration, 0);
              const bTotal = b.logs.reduce((s, l) => s + l.duration, 0);
              return bTotal - aTotal;
            });

            if (rows.length === 0) return (
              <p className="text-sm text-slate-600 text-center py-6">
                {teamLoading ? 'Memuat…' : 'Tidak ada aktivitas di periode ini.'}
              </p>
            );

            return (
              <div className="space-y-2">
                {rows.map(({ user, logs }) => {
                  const uid = logs[0].user_id;
                  const totalSec = logs.reduce((s, l) => s + l.duration, 0);
                  const uniqueTasks = new Set(logs.map(l => l.task_id)).size;
                  const sessions = logs.length;
                  const isExpanded = wlExpanded === uid;
                  const name = user?.name ?? `User #${uid}`;
                  const initial = name.charAt(0).toUpperCase();

                  // Max hours in this period for bar scaling
                  const maxSec = Math.max(...rows.map(r => r.logs.reduce((s, l) => s + l.duration, 0)));
                  const barPct = maxSec > 0 ? Math.round((totalSec / maxSec) * 100) : 0;

                  return (
                    <div key={uid} className="rounded-xl border border-slate-800 overflow-hidden">
                      {/* Summary row */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors text-left"
                        onClick={() => setWlExpanded(isExpanded ? null : uid)}
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-500/30">
                          <span className="text-white text-xs font-bold">{initial}</span>
                        </div>
                        {/* Name + bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-200 truncate">{name}</span>
                            <span className="text-xs font-mono font-semibold text-indigo-300 ml-2 flex-shrink-0">{fmtDur(totalSec)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                        {/* Stats chips */}
                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                            {uniqueTasks} task
                          </span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                            {sessions} sesi
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                      </button>

                      {/* Expanded detail: day → project → tasks */}
                      {isExpanded && (
                        <div className="border-t border-slate-800 bg-slate-900/60 px-4 py-3 max-h-96 overflow-y-auto">
                          {(() => {
                            // Group by date
                            const byDay = new Map<string, TaskTimeLog[]>();
                            for (const log of logs) {
                              const day = log.clock_in.substring(0, 10);
                              if (!byDay.has(day)) byDay.set(day, []);
                              byDay.get(day)!.push(log);
                            }
                            const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
                            return days.map(([day, dayLogs]) => {
                              const d = new Date(day + 'T00:00:00');
                              const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
                              const daySec = dayLogs.reduce((s, l) => s + l.duration, 0);

                              // Group by project within this day
                              const byProj = new Map<string, TaskTimeLog[]>();
                              for (const log of dayLogs) {
                                const proj = log.project_name || 'Tanpa Project';
                                if (!byProj.has(proj)) byProj.set(proj, []);
                                byProj.get(proj)!.push(log);
                              }

                              return (
                                <div key={day} className="mb-4 last:mb-0">
                                  {/* Day header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">{dayLabel}</p>
                                    <span className="text-[10px] font-mono text-indigo-300 font-semibold">{fmtDur(daySec)}</span>
                                  </div>

                                  {/* Projects */}
                                  <div className="space-y-2 pl-2">
                                    {[...byProj.entries()].map(([projName, projLogs]) => {
                                      const projSec = projLogs.reduce((s, l) => s + l.duration, 0);

                                      // Group by task within project
                                      const byTask = new Map<number, TaskTimeLog[]>();
                                      for (const log of projLogs) {
                                        if (!byTask.has(log.task_id)) byTask.set(log.task_id, []);
                                        byTask.get(log.task_id)!.push(log);
                                      }

                                      return (
                                        <div key={projName} className="rounded-lg border border-slate-800 overflow-hidden">
                                          {/* Project header */}
                                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/60">
                                            <span className="text-[11px] font-semibold text-indigo-400 truncate">{projName}</span>
                                            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 ml-2">{fmtDur(projSec)}</span>
                                          </div>
                                          {/* Tasks */}
                                          <div className="divide-y divide-slate-800/60">
                                            {[...byTask.entries()].map(([taskId, tLogs]) => {
                                              const taskTitle = tLogs[0].task_title || `Task #${taskId}`;
                                              const taskSec   = tLogs.reduce((s, l) => s + l.duration, 0);
                                              const category  = tLogs[0].category;
                                              return (
                                                <div key={taskId} className="flex items-center gap-2.5 px-3 py-2">
                                                  <div className="w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-slate-300 truncate">{taskTitle}</p>
                                                    {category && <p className="text-[10px] text-slate-600">{category}</p>}
                                                  </div>
                                                  <div className="flex-shrink-0 text-right">
                                                    <p className="text-[11px] font-mono text-slate-300 font-semibold">{fmtDur(taskSec)}</p>
                                                    <p className="text-[10px] text-slate-600">{tLogs.length} sesi</p>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Time Tracking ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm shadow-black/30">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader icon={<Timer className="w-4 h-4 text-green-400" />} title="Time Tracking" />
            <div className="flex items-center gap-2">
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-300 w-32 text-center">
                {new Date(calMonth.year, calMonth.month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              {timeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />}
            </div>
          </div>

          <TimeCalendar
            year={calMonth.year}
            month={calMonth.month}
            logs={timeLogs}
            selectedDay={calSelDay}
            onSelectDay={setCalSelDay}
          />

          {calSelDay && (() => {
            const dayLogs = timeLogs.filter(l => l.clock_in.substring(0, 10) === calSelDay);
            const totalSec = dayLogs.reduce((s, l) => s + l.duration, 0);
            return (
              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-300">
                    {new Date(calSelDay + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <span className="text-xs font-mono text-green-400 font-semibold">{fmtDur(totalSec)} total</span>
                </div>
                {dayLogs.length === 0 ? (
                  <p className="text-xs text-slate-600">Tidak ada aktivitas pada hari ini.</p>
                ) : (
                  <div className="space-y-2">
                    {dayLogs.map(log => {
                      const ci = new Date(log.clock_in);
                      const co = log.clock_out ? new Date(log.clock_out) : null;
                      const isActive = !log.clock_out;
                      return (
                        <div key={log.id} className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 font-medium truncate">
                              {log.task_title || `Task #${log.task_id}`}
                            </p>
                            {log.project_name && (
                              <p className="text-[11px] text-slate-500 truncate">{log.project_name}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400 font-mono">
                              {ci.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              {' → '}
                              {co ? co.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-400">Aktif</span>}
                            </p>
                            <p className={`text-xs font-mono font-semibold mt-0.5 ${isActive ? 'text-green-400' : 'text-slate-300'}`}>
                              {isActive ? 'Berjalan' : fmtDur(log.duration)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        </>)}

      </div>
    </div>
  );
}

// ─── Time Calendar helpers ────────────────────────────────────────────────────

function fmtDur(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}d`;
}

function TimeCalendar({ year, month, logs, selectedDay, onSelectDay }: {
  year: number;
  month: number;
  logs: TaskTimeLog[];
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
}) {
  const today = new Date().toISOString().substring(0, 10);

  // Group logs by date
  const byDay = logs.reduce<Record<string, number>>((acc, log) => {
    const day = log.clock_in.substring(0, 10);
    acc[day] = (acc[day] ?? 0) + log.duration;
    return acc;
  }, {});

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon=0
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  // max seconds in a day (for heatmap intensity)
  const maxSec = Math.max(...Object.values(byDay), 1);

  const intensity = (sec: number) => {
    const r = sec / maxSec;
    if (r === 0) return '';
    if (r < 0.25) return 'bg-green-900/60 border-green-800/40';
    if (r < 0.5)  return 'bg-green-700/60 border-green-600/40';
    if (r < 0.75) return 'bg-green-500/50 border-green-400/40';
    return 'bg-green-400/60 border-green-300/40';
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const sec = byDay[dateStr] ?? 0;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const hasWork = sec > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDay(isSelected ? null : dateStr)}
              className={`relative aspect-square rounded-lg border text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5
                ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : ''}
                ${hasWork ? intensity(sec) : 'border-slate-800 bg-slate-800/30'}
                ${isToday && !hasWork ? 'border-indigo-500/50' : ''}
                hover:brightness-125`}
            >
              <span className={`leading-none ${isToday ? 'text-indigo-400 font-bold' : hasWork ? 'text-green-100' : 'text-slate-500'}`}>
                {day}
              </span>
              {hasWork && (
                <span className="text-[9px] text-green-200/70 leading-none font-mono">{fmtDur(sec)}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[10px] text-slate-600">Kurang</span>
        {['bg-slate-800/30', 'bg-green-900/60', 'bg-green-700/60', 'bg-green-500/50', 'bg-green-400/60'].map((c, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-sm ${c} border border-slate-700`} />
        ))}
        <span className="text-[10px] text-slate-600">Lebih</span>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, iconBg, label, value, sub, highlight }: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  highlight?: 'red' | 'green' | 'orange';
}) {
  const borderCls = highlight === 'red' ? 'border-red-500/40' : highlight === 'green' ? 'border-green-500/40' : highlight === 'orange' ? 'border-orange-500/40' : 'border-slate-800';
  const valueCls  = highlight === 'red' ? 'text-red-400' : highlight === 'green' ? 'text-green-400' : highlight === 'orange' ? 'text-orange-400' : 'text-white';
  return (
    <div className={`bg-slate-900 border ${borderCls} rounded-2xl p-5 flex flex-col gap-3 shadow-sm shadow-black/30`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-slate-400 text-xs font-medium leading-tight">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight leading-none ${valueCls}`}>{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge }: {
  icon: React.ReactNode;
  title: string;
  badge?: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2 className="text-sm font-semibold text-slate-100 tracking-wide">{title}</h2>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
      )}
    </div>
  );
}

function EmptyState({ label, sub, action, onClick }: { label: string; sub?: string; action?: string; onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mb-1">
        <span className="text-slate-600 text-base">—</span>
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-600 max-w-[200px]">{sub}</p>}
      {action && onClick && (
        <button
          onClick={onClick}
          className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          {action}
        </button>
      )}
    </div>
  );
}
