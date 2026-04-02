import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { 
  BookOpen, 
  LayoutDashboard, 
  LogOut, 
  Shield,
  User as UserIcon,
  Moon,
  Sun
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    // Default to dark mode if checking system preference isn't available
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/' },
    { label: 'My Curriculum', icon: BookOpen, path: '/courses' },
  ];

  return (
    <div className="flex bg-slate-50 dark:bg-[#0c0e12] min-h-screen font-sans text-left text-slate-900 dark:text-[#f0f2f5] w-full transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-[#13151a] border-r border-slate-200 dark:border-[#242830] hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#242830]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">LogicBox</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                  active 
                    ? "bg-blue-50 dark:bg-[#1e2a3d] text-blue-600 dark:text-blue-400" 
                    : "text-slate-600 dark:text-[#8b95a2] hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#1a1d24] dark:hover:text-[#f0f2f5]"
                }`}
              >
                <item.icon size={18} className={active ? "text-blue-600 dark:text-blue-400" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#242830] space-y-2">
          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-[#8b95a2] hover:bg-slate-100 dark:hover:bg-[#1a1d24] transition-colors"
          >
            <div className="flex items-center gap-3">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
          </button>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#1a1d24] border border-slate-200 dark:border-[#242830]">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#242830] flex items-center justify-center shrink-0">
              <UserIcon size={16} className="text-slate-500 dark:text-[#5a6474]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-[#f0f2f5]">{user?.name || 'Student'}</p>
              <p className="text-xs text-slate-500 dark:text-[#5a6474] truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-[#242830] text-slate-700 dark:text-[#8b95a2] hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-[#2d0f0f] dark:hover:text-[#ef4444] dark:hover:border-[#7f1d1d] transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-[#13151a] border-b border-slate-200 dark:border-[#242830] flex items-center px-8 sticky top-0 z-10 w-full shrink-0">
          <h1 className="text-xl font-semibold m-0 p-0 tracking-tight text-slate-900 dark:text-[#f0f2f5]">
            {navItems.find(i => location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path)))?.label || 'Student Portal'}
          </h1>
        </header>
        <div className="flex-1 overflow-auto p-8 scroll-smooth">
          <div className="max-w-6xl mx-auto pb-12 w-full content-wrapper text-left text-base page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
