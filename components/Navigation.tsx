import React from 'react';
import { LayoutDashboard, ListOrdered, Settings, Users } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard',    label: 'Dashboard Utama',    icon: LayoutDashboard },
    { id: 'participants', label: 'Senarai Peserta',     icon: Users },
    { id: 'results_list', label: 'Senarai Keputusan',  icon: ListOrdered },
    { id: 'settings',     label: 'Admin / Tetapan',     icon: Settings },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="bg-[#071527] text-white shadow-lg sticky top-0 z-50 print:hidden border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15">
                <img src="/logo-sekolah-oran-transparent.png?v=2" alt="Logo SK ORAN" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="font-black text-lg tracking-tight leading-none">SK ORAN</div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">Sports Arena</div>
              </div>
            </div>

            {/* Desktop Links */}
            <div className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === item.id
                      ? 'bg-white text-slate-950'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#071527] text-white shadow-[0_-4px_18px_rgba(0,0,0,0.35)] z-50 print:hidden pb-safe border-t border-white/10">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full gap-0.5 ${
                activeTab === item.id
                  ? 'text-yellow-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[9px] font-bold leading-none text-center">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Navigation;
