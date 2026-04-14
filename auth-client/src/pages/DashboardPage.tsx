import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, CheckCircle2, Clock, AlertCircle, Loader2,
  ArrowRight, RefreshCw, TrendingUp, Users, ShieldAlert,
  LayoutDashboard, Flame, Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import type { Project, Task, User } from '../types';

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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [stats,       setStats]       = useState<ProjectStat[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedId,  setSelectedId]  = useState<number | null>(null); // null = semua project

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
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
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <div className="flex-1 flex items-center justify-center text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutDashboard className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold">Project Dashboard</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Selamat datang, <span className="text-slate-300 font-medium">{user?.name}</span>
              {' '}·{' '}
              <span className="text-slate-600">
                Update: {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Project selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1">
              <button
                onClick={() => setSelectedId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedId === null
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Semua
              </button>
              {stats.map(s => (
                <button
                  key={s.project.id}
                  onClick={() => setSelectedId(s.project.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors max-w-[140px] truncate ${
                    selectedId === s.project.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={s.project.name}
                >
                  {s.project.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(true)} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Project context banner (saat project dipilih) ── */}
        {selectedProj && (
          <div className="flex items-center justify-between bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <FolderKanban className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-indigo-200 font-semibold text-sm">{selectedProj.name}</p>
                {selectedProj.description && (
                  <p className="text-indigo-400/60 text-xs">{selectedProj.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate(`/projects/${selectedProj.id}`)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-200 transition-colors border border-indigo-500/30 px-2.5 py-1 rounded-lg"
            >
              Buka Kanban <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Metrics Bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

        {/* ── Row 2: Project Health + Team Workload ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Project Health (2/3) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{project.name}</span>
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
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0 ml-3"
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
                              <div key={key} className="flex items-center gap-2.5 text-xs">
                                <span className={`w-24 flex-shrink-0 ${cfg.text}`}>{label}</span>
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${barPct}%` }} />
                                </div>
                                <span className="text-slate-400 w-4 text-right flex-shrink-0">{count}</span>
                                <span className="text-slate-600 w-8 text-right flex-shrink-0">
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

          {/* Team Workload (1/3) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <SectionHeader icon={<Users className="w-4 h-4 text-purple-400" />} title="Beban Kerja Tim" />

            <div className="mt-4 space-y-4">
              {activeUsers.map(u => {
                const userTasks = assigneeGroups[String(u.id)] ?? [];
                const uDone   = userTasks.filter(t => t.status === 'done').length;
                const uActive = userTasks.filter(t => t.status === 'in_progress').length;
                const uOverdue = userTasks.filter(isOverdue).length;
                const uPct    = userTasks.length ? Math.round((uDone / userTasks.length) * 100) : 0;

                return (
                  <div key={u.id} className="border border-slate-800 rounded-xl p-3.5">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
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
                          <div
                            className={`h-full rounded-full ${uPct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${uPct}%` }}
                          />
                        </div>
                      </>
                    )}

                    {userTasks.length === 0 && (
                      <p className="text-slate-600 text-xs text-center py-1">Tidak ada task</p>
                    )}
                  </div>
                );
              })}

              {activeUsers.length === 0 && (
                <EmptyState label={selectedId ? 'Tidak ada assignee di project ini' : 'Belum ada user'} action="Kelola users →" onClick={() => navigate('/users')} />
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Status Distribution + Priority ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Status Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
                        <div key={key} className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.bar}`} />
                          <span className={`text-sm flex-1 ${cfg.text}`}>{label}</span>
                          <div className="flex items-center gap-3">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <SectionHeader
              icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
              title="Perlu Perhatian Segera"
              badge={overdueTasks.length + dueSoonTasks.length}
            />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                              <div className="w-5 h-5 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
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
                              {over && ' ⚠'}
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
          )}
        </div>

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
  const borderCls = highlight === 'red' ? 'border-red-500/30' : highlight === 'green' ? 'border-green-500/30' : highlight === 'orange' ? 'border-orange-500/30' : 'border-slate-800';
  const valueCls  = highlight === 'red' ? 'text-red-400' : highlight === 'green' ? 'text-green-400' : highlight === 'orange' ? 'text-orange-400' : 'text-white';
  return (
    <div className={`bg-slate-900 border ${borderCls} rounded-2xl p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <p className="text-slate-400 text-xs leading-tight">{label}</p>
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${valueCls}`}>{value}</p>
        {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
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
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
      )}
    </div>
  );
}

function EmptyState({ label, action, onClick }: { label: string; action?: string; onClick?: () => void }) {
  return (
    <div className="text-center py-6 text-slate-600 text-sm">
      {label}
      {action && onClick && (
        <> — <button onClick={onClick} className="text-indigo-400 hover:underline">{action}</button></>
      )}
    </div>
  );
}
