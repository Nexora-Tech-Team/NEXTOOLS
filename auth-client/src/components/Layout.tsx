import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

const NAV = [
  { path: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects',   label: 'Projects',  icon: FolderKanban },
  { path: '/users',      label: 'Users',     icon: Users },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Topbar */}
      <header className="border-b border-slate-700 bg-slate-900 px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/nexora-logo.png" alt="Nexora" className="h-8 w-auto object-contain" />
          <div className="h-5 w-px bg-slate-700" />
          <span className="font-semibold text-slate-300 text-sm tracking-wide">Nex PM Tools</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center">
              <span className="text-indigo-400 font-medium text-xs">{user?.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-slate-300 hidden sm:block">{user?.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${user?.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-slate-700 text-slate-400'}`}>
              {user?.role}
            </span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-slate-700 bg-slate-900 p-3 flex-shrink-0 flex flex-col">
          <nav className="space-y-0.5">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <img src="/nexora-logo.png" alt="Nexora" className="h-6 w-auto object-contain opacity-40" />
            <p className="text-slate-700 text-[10px] mt-1">Part of CBQA Global Group</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
