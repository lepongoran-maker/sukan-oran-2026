import React from 'react';
import { LayoutDashboard, ListOrdered, Settings, Users, Medal, ClipboardCheck } from 'lucide-react';

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
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Medal className="h-8 w-8 text-yellow-400" />
              <span className="font-bold text-xl tracking-tight">
                SukanSekolah<span className="text-yellow-400">Pro</span>
              </span>
            </div>

            {/* Desktop Links */}
            <div className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === item.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-50 print:hidden pb-safe">
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