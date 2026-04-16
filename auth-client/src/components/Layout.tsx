import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';

const NAV = [
  { path: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects',   label: 'Projects',  icon: FolderKanban },
  { path: '/users',      label: 'Users',     icon: Users },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const goTo = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <>
      <nav className="space-y-1">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => goTo(path)}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/70 ${
                active
                  ? 'bg-indigo-600/15 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/20">
            <span className="text-sm font-semibold text-indigo-300">{user?.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{user?.name}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          </div>
        </div>
        <img src="/nexora-logo.png" alt="Nexora" className="h-6 w-auto object-contain opacity-40" />
        <p className="text-[10px] text-slate-600">Part of CBQA Global Group</p>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200 transition-colors hover:border-slate-700 hover:text-white lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          <img src="/nexora-logo.png" alt="Nexora" className="h-8 w-auto object-contain" />
          <div className="hidden h-5 w-px bg-slate-700 sm:block" />
          <span className="truncate text-sm font-semibold tracking-wide text-slate-200">Nex PM Tools</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/30">
              <span className="text-xs font-medium text-indigo-300">{user?.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="max-w-36 truncate text-slate-300">{user?.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${user?.role === 'admin' ? 'border-purple-500/30 bg-purple-500/15 text-purple-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950 px-4 py-4 lg:flex lg:flex-col">
          {sidebarContent}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-auto">
          {children}
        </main>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-full max-w-[18.5rem] flex-col border-r border-slate-800 bg-slate-950 px-4 py-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide text-slate-100">Navigation</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </div>
  );
}
