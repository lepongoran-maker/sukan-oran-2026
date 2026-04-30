import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Navigation from './components/Navigation';
import ResultsList from './components/ResultsList';
import ParticipantList from './components/ParticipantList';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Lock, LogOut, ShieldCheck } from 'lucide-react';
import { 
  HouseColor, Gender, HouseStats, EventType, Participant, WinnerProfile, PointsConfig, EventLimitsConfig, SystemConfig 
} from './types';
import { 
  DEFAULT_SYSTEM_CONFIG, POINTS_INDIVIDUAL, POINTS_RELAY, POINTS_TARIK_TALI
} from './constants';
import { activeHouseIds, activeEvents, eventById, normalizeSystemConfig } from './utils/systemConfig';

const ADMIN_PASSWORD = 'SKORANADMIN206';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminUnlocked, setAdminUnlocked] = useState(() => sessionStorage.getItem('skOranAdminUnlocked') === 'true');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  
  const [registrations, setRegistrations] = useState<Record<string, Participant[]>>({});
  const [results, setResults] = useState<Record<string, WinnerProfile[]>>({});
  
  const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
    individu: POINTS_INDIVIDUAL,
    relay: POINTS_RELAY,
    tarikTali: POINTS_TARIK_TALI
  });

  const [eventLimits, setEventLimits] = useState<EventLimitsConfig>({
    maxIndividual: 3,
    maxRelay: 2,
    eventSlots: {}
  });

  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDoc(doc(db, 'appData', 'connection_test'));
      } catch (error: any) {
        if (error.message && error.message.includes('offline')) {
          alert("Ralat: Tidak dapat menyambung ke pangkalan data (Offline).");
        } else {
          alert("Ralat Sambungan Firebase: " + error.message);
        }
      }
    };
    testConnection();

    const unsubRegs = onSnapshot(doc(db, 'appData', 'registrations'), (docSnap) => {
      if (docSnap.exists()) setRegistrations(docSnap.data().data || {});
    }, (error) => alert("Ralat Firebase: " + error.message));

    const unsubResults = onSnapshot(doc(db, 'appData', 'results'), (docSnap) => {
      if (docSnap.exists()) setResults(docSnap.data().data || {});
    });

    const unsubPoints = onSnapshot(doc(db, 'appData', 'pointsConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPointsConfig({ individu: data.individu || POINTS_INDIVIDUAL, relay: data.relay || POINTS_RELAY, tarikTali: data.tarikTali || POINTS_TARIK_TALI });
      }
    });

    const unsubLimits = onSnapshot(doc(db, 'appData', 'eventLimits'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEventLimits({ 
          maxIndividual: data.maxIndividual ?? 3, 
          maxRelay: data.maxRelay ?? 2,
          eventSlots: data.eventSlots || {}
        });
      }
    });

    const unsubSystemConfig = onSnapshot(doc(db, 'appData', 'systemConfig'), (docSnap) => {
      if (docSnap.exists()) {
        setSystemConfig(normalizeSystemConfig(docSnap.data() as Partial<SystemConfig>));
      }
    });

    return () => { unsubRegs(); unsubResults(); unsubPoints(); unsubLimits(); unsubSystemConfig(); };
  }, []);

  const handleUpdateRegistration = async (key: string, participants: Participant[]) => {
    const newRegs = { ...registrations, [key]: participants };
    setRegistrations(newRegs);
    try { await setDoc(doc(db, 'appData', 'registrations'), { data: newRegs }); }
    catch (error: any) { alert("Gagal simpan pendaftaran: " + error.message); }
  };

  const handleBulkOverride = async (overrideRegistrations: Record<string, Participant[]>) => {
    const mergedRegs = { ...registrations, ...overrideRegistrations };
    setRegistrations(mergedRegs);
    try { await setDoc(doc(db, 'appData', 'registrations'), { data: mergedRegs }); }
    catch (error) { console.error("Error saving bulk override:", error); }
  };

  const handleBulkRegistration = async (newRegistrations: Record<string, Participant[]>) => {
    const mergedRegs = { ...registrations };
    const allEvents = activeEvents(systemConfig);
    Object.entries(newRegistrations).forEach(([key, newParticipants]) => {
      const parts = key.split('_');
      const eventId = parts.slice(3).join('_');
      const eventDef = allEvents.find(e => e.id === eventId);
      const maxParticipants = eventDef ? eventDef.maxParticipants : 99;
      if (mergedRegs[key]) {
        const existing = [...mergedRegs[key]];
        newParticipants.forEach((p) => {
          const existingIndex = existing.findIndex(e => e && e.name && p.name && e.name.toLowerCase().trim() === p.name.toLowerCase().trim());
          if (existingIndex >= 0) { existing[existingIndex] = p; }
          else {
            let inserted = false;
            for (let i = 0; i < existing.length; i++) { if (!existing[i] || !existing[i].name) { existing[i] = p; inserted = true; break; } }
            if (!inserted) { if (existing.filter(e => e && e.name).length < maxParticipants) existing.push(p); }
          }
        });
        mergedRegs[key] = existing;
      } else {
        mergedRegs[key] = newParticipants.length > maxParticipants ? newParticipants.slice(0, maxParticipants) : newParticipants;
      }
    });
    setRegistrations(mergedRegs);
    try { await setDoc(doc(db, 'appData', 'registrations'), { data: mergedRegs }); }
    catch (error) { console.error("Error saving bulk registrations:", error); }
  };

  const handleUpdateParticipantGlobal = async (oldName: string, newName: string, newClass: string) => {
    const updatedRegs = { ...registrations };
    let hasChanges = false;
    Object.keys(updatedRegs).forEach(key => {
      updatedRegs[key] = updatedRegs[key].map(p => {
        if (p?.name && p.name.trim().toLowerCase() === oldName.trim().toLowerCase()) {
          hasChanges = true;
          return { ...p, name: newName, className: newClass };
        }
        return p;
      });
    });
    
    if (hasChanges) {
      setRegistrations(updatedRegs);
      try { await setDoc(doc(db, 'appData', 'registrations'), { data: updatedRegs }); }
      catch (error) { console.error("Error updating participant global:", error); }
    }
  };

  const handleSaveResult = async (eventId: string, year: number, gender: Gender, positions: WinnerProfile[]) => {
    const key = `${eventId}_${year}_${gender}`;
    const newRes = { ...results, [key]: positions };
    setResults(newRes);
    try { await setDoc(doc(db, 'appData', 'results'), { data: newRes }); }
    catch (error) { console.error("Error saving results:", error); }
  };

  const handleUpdatePoints = async (config: PointsConfig) => {
    setPointsConfig(config);
    try { await setDoc(doc(db, 'appData', 'pointsConfig'), config); }
    catch (error) { console.error("Error saving points config:", error); }
  };

  const handleUpdateEventLimits = async (config: EventLimitsConfig) => {
    setEventLimits(config);
    try { await setDoc(doc(db, 'appData', 'eventLimits'), config); }
    catch (error) { console.error("Error saving event limits:", error); }
  };

  const handleUpdateSystemConfig = async (config: SystemConfig) => {
    const normalized = normalizeSystemConfig(config);
    setSystemConfig(normalized);
    try { await setDoc(doc(db, 'appData', 'systemConfig'), normalized); }
    catch (error) { console.error("Error saving system config:", error); }
  };

  const handleAdminLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setAdminPasswordInput('');
      setAdminPasswordError('');
      sessionStorage.setItem('skOranAdminUnlocked', 'true');
      return;
    }
    setAdminPasswordError('Password admin tidak betul.');
  };

  const handleAdminLogout = () => {
    setAdminUnlocked(false);
    setAdminPasswordInput('');
    setAdminPasswordError('');
    sessionStorage.removeItem('skOranAdminUnlocked');
  };

  const handleResetData = async (type: 'participants' | 'results' | 'all') => {
    try {
      if (type === 'participants' || type === 'all') {
        setRegistrations({});
        await setDoc(doc(db, 'appData', 'registrations'), { data: {} });
      }
      if (type === 'results' || type === 'all') {
        setResults({});
        await setDoc(doc(db, 'appData', 'results'), { data: {} });
      }
    } catch (error) { console.error("Error clearing Firebase data:", error); }
    setTimeout(() => window.location.reload(), 500);
  };

  const stats: HouseStats[] = useMemo(() => {
    const initialStats: Record<HouseColor, HouseStats> = activeHouseIds(systemConfig).reduce((acc, house) => {
      acc[house] = { house, totalPoints: 0, gold: 0, silver: 0, bronze: 0, pointsTahap1: 0, pointsTahap2: 0 };
      return acc;
    }, {} as Record<HouseColor, HouseStats>);

    (Object.entries(results) as [string, WinnerProfile[]][]).forEach(([key, positions]) => {
      const parts = key.split('_');
      const yearStr = parts[parts.length - 2];
      const year = parseInt(yearStr);
      const eventId = parts.slice(0, parts.length - 2).join('_');
      const eventDef = eventById(systemConfig, eventId);
      if (!eventDef) return;
      const isTarikTali = eventDef.id === 'khas_tariktali';
      if (eventDef.type === EventType.KHUSUS && !isTarikTali) {
        positions.forEach((p) => { if (p.customScore && initialStats[p.house]) initialStats[p.house].totalPoints += p.customScore; });
      } else {
        const isRelay = eventDef.type === EventType.RELAY;
        let pointSystem = pointsConfig.individu;
        if (isRelay) pointSystem = pointsConfig.relay;
        if (isTarikTali) pointSystem = pointsConfig.tarikTali;
        if (Array.isArray(positions)) {
          positions.forEach((winner, index) => {
            const house = winner.house;
            if (!initialStats[house]) return;
            const points = pointSystem[index] || 0;
            initialStats[house].totalPoints += points;
            if (index === 0) initialStats[house].gold++;
            if (index === 1) initialStats[house].silver++;
            if (index === 2) initialStats[house].bronze++;
            if (year <= 3 && year > 0) initialStats[house].pointsTahap1 += points;
            else if (year > 3) initialStats[house].pointsTahap2 += points;
          });
        }
      }
    });
    return Object.values(initialStats);
  }, [results, pointsConfig, systemConfig]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-grow pb-20 md:pb-0">
        {activeTab === 'dashboard' && <Dashboard stats={stats} results={results} pointsConfig={pointsConfig} systemConfig={systemConfig}/>}
        {activeTab === 'participants' && <ParticipantList registrations={registrations} systemConfig={systemConfig}/>}
        {activeTab === 'results_list' && <ResultsList results={results} stats={stats} pointsConfig={pointsConfig} systemConfig={systemConfig}/>}
        {activeTab === 'settings' && !adminUnlocked && (
          <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-slate-900 text-yellow-400 flex items-center justify-center">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Admin Sahaja</h1>
                  <p className="text-sm text-slate-500">Masukkan password untuk buka tetapan dan kemas kini data.</p>
                </div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-2">
                    Password Admin
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={adminPasswordInput}
                    onChange={(event) => {
                      setAdminPasswordInput(event.target.value);
                      setAdminPasswordError('');
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-yellow-300"
                    autoComplete="current-password"
                    autoFocus
                  />
                  {adminPasswordError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{adminPasswordError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <ShieldCheck className="h-5 w-5 text-yellow-400" />
                  Masuk Admin
                </button>
              </form>
            </div>
          </section>
        )}
        {activeTab === 'settings' && adminUnlocked && (
          <>
            <div className="print:hidden bg-emerald-50 border-b border-emerald-200">
              <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <ShieldCheck className="h-5 w-5" />
                  Admin dibuka
                </div>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Kunci Admin
                </button>
              </div>
            </div>
            <Settings
              pointsConfig={pointsConfig}
              onUpdatePoints={handleUpdatePoints}
              eventLimits={eventLimits}
              onUpdateEventLimits={handleUpdateEventLimits}
              systemConfig={systemConfig}
              onUpdateSystemConfig={handleUpdateSystemConfig}
              registrations={registrations}
              onUpdateRegistration={handleUpdateRegistration}
              onBulkRegistration={handleBulkRegistration}
              onBulkOverride={handleBulkOverride}
              results={results}
              onSaveResult={handleSaveResult}
              onResetData={() => handleResetData('all')}
              stats={stats}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
