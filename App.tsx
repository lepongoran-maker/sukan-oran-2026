import React, { useState, useEffect, useMemo } from 'react';
import { LockKeyhole } from 'lucide-react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Navigation from './components/Navigation';
import ResultsList from './components/ResultsList';
import ParticipantList from './components/ParticipantList';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { 
  AccessConfig, AccessSession, Gender, HouseColor, HouseStats, Participant, WinnerProfile, PointsConfig, EventLimitsConfig, SystemConfig, StudentRosterEntry 
} from './types';
import { 
  DEFAULT_ACCESS_CONFIG, DEFAULT_SYSTEM_CONFIG, POINTS_INDIVIDUAL, POINTS_RELAY, POINTS_TARIK_TALI
} from './constants';
import { activeEvents, activeHouseIds, eventById, getHouseName, normalizeSystemConfig } from './utils/systemConfig';
import { calculateHouseStats, normalizeResultPositions } from './utils/scoring';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accessSession, setAccessSession] = useState<AccessSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('sk_oran_access_session') || 'null') as AccessSession | null;
    } catch {
      return null;
    }
  });
  
  const [registrations, setRegistrations] = useState<Record<string, Participant[]>>({});
  const [studentRoster, setStudentRoster] = useState<StudentRosterEntry[]>([]);
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
  const [accessConfig, setAccessConfig] = useState<AccessConfig>(DEFAULT_ACCESS_CONFIG);

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

    const unsubStudentRoster = onSnapshot(doc(db, 'appData', 'studentRoster'), (docSnap) => {
      if (docSnap.exists()) setStudentRoster(docSnap.data().data || []);
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

    const unsubAccessConfig = onSnapshot(doc(db, 'appData', 'accessConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<AccessConfig>;
        setAccessConfig({
          ...DEFAULT_ACCESS_CONFIG,
          ...data,
          housePasswords: {
            ...DEFAULT_ACCESS_CONFIG.housePasswords,
            ...(data.housePasswords || {}),
          },
        });
      }
    });

    return () => { unsubRegs(); unsubResults(); unsubStudentRoster(); unsubPoints(); unsubLimits(); unsubSystemConfig(); unsubAccessConfig(); };
  }, []);

  const handleUpdateRegistration = async (key: string, participants: Participant[]) => {
    if (accessSession?.role === 'house_teacher' && accessSession.house && !key.startsWith(`${accessSession.house}_`)) {
      alert('Akses guru hanya dibenarkan untuk rumah sukan sendiri sahaja.');
      return;
    }
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

  const handleImportStudentRoster = async (newRoster: StudentRosterEntry[]) => {
    const rosterMap = new Map<string, StudentRosterEntry>();
    [...studentRoster, ...newRoster].forEach((student) => {
      const key = `${student.house}_${student.year || 'ALL'}_${student.gender || 'ALL'}_${student.name.trim().toLowerCase()}_${student.className.trim().toLowerCase()}`;
      rosterMap.set(key, student);
    });
    const mergedRoster = Array.from(rosterMap.values()).sort((a, b) =>
      String(a.house).localeCompare(String(b.house)) ||
      (a.year || 0) - (b.year || 0) ||
      a.name.localeCompare(b.name)
    );
    setStudentRoster(mergedRoster);
    try { await setDoc(doc(db, 'appData', 'studentRoster'), { data: mergedRoster }); }
    catch (error) { console.error("Error saving student roster:", error); }
  };

  const handleUpdateStudentRoster = async (newRoster: StudentRosterEntry[]) => {
    const cleanedRoster = newRoster
      .filter(student => student?.name?.trim() && student?.house)
      .map(student => ({
        ...student,
        name: student.name.trim(),
        className: (student.className || '').trim(),
      }))
      .sort((a, b) =>
        String(a.house).localeCompare(String(b.house)) ||
        (a.year || 0) - (b.year || 0) ||
        a.name.localeCompare(b.name)
      );
    setStudentRoster(cleanedRoster);
    try { await setDoc(doc(db, 'appData', 'studentRoster'), { data: cleanedRoster }); }
    catch (error) { console.error("Error saving student roster:", error); }
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
    const eventDef = eventById(systemConfig, eventId);
    const cleanedPositions = normalizeResultPositions(eventDef, positions);
    const newRes = { ...results, [key]: cleanedPositions };
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

  const handleUpdateAccessConfig = async (config: AccessConfig) => {
    const normalized = {
      ...DEFAULT_ACCESS_CONFIG,
      ...config,
      housePasswords: {
        ...DEFAULT_ACCESS_CONFIG.housePasswords,
        ...(config.housePasswords || {}),
      },
    };
    setAccessConfig(normalized);
    try { await setDoc(doc(db, 'appData', 'accessConfig'), normalized); }
    catch (error) { console.error("Error saving access config:", error); }
  };

  const handleAccessLogin = (password: string) => {
    const cleanPassword = password.trim();
    if (!cleanPassword) return false;

    let session: AccessSession | null = null;
    if (cleanPassword === accessConfig.adminPassword) {
      session = { role: 'admin' };
    } else {
      const house = activeHouseIds(systemConfig).find(houseId =>
        (accessConfig.housePasswords?.[houseId] || '').trim() === cleanPassword
      );
      if (house) session = { role: 'house_teacher', house };
    }

    if (!session) return false;
    setAccessSession(session);
    localStorage.setItem('sk_oran_access_session', JSON.stringify(session));
    return true;
  };

  const handleAccessLogout = () => {
    setAccessSession(null);
    localStorage.removeItem('sk_oran_access_session');
  };

  const handleResetData = async (type: 'participants' | 'results' | 'all') => {
    try {
      if (type === 'participants' || type === 'all') {
        setRegistrations({});
        setStudentRoster([]);
        await setDoc(doc(db, 'appData', 'registrations'), { data: {} });
        await setDoc(doc(db, 'appData', 'studentRoster'), { data: [] });
      }
      if (type === 'results' || type === 'all') {
        setResults({});
        await setDoc(doc(db, 'appData', 'results'), { data: {} });
      }
    } catch (error) { console.error("Error clearing Firebase data:", error); }
    setTimeout(() => window.location.reload(), 500);
  };

  const stats: HouseStats[] = useMemo(
    () => calculateHouseStats(results, pointsConfig, systemConfig),
    [results, pointsConfig, systemConfig]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-grow pb-20 md:pb-0">
        {activeTab === 'dashboard' && <Dashboard stats={stats} results={results} pointsConfig={pointsConfig} systemConfig={systemConfig}/>}
        {activeTab === 'participants' && <ParticipantList registrations={registrations} systemConfig={systemConfig}/>}
        {activeTab === 'results_list' && <ResultsList results={results} stats={stats} pointsConfig={pointsConfig} systemConfig={systemConfig}/>}
        {activeTab === 'settings' && !accessSession && (
          <AccessLogin
            systemConfig={systemConfig}
            onLogin={handleAccessLogin}
          />
        )}
        {activeTab === 'settings' && accessSession && (
          <Settings
            pointsConfig={pointsConfig}
            onUpdatePoints={handleUpdatePoints}
            eventLimits={eventLimits}
            onUpdateEventLimits={handleUpdateEventLimits}
            systemConfig={systemConfig}
            onUpdateSystemConfig={handleUpdateSystemConfig}
            accessConfig={accessConfig}
            onUpdateAccessConfig={handleUpdateAccessConfig}
            accessSession={accessSession}
            onLogout={handleAccessLogout}
            registrations={registrations}
            onUpdateRegistration={handleUpdateRegistration}
            onBulkRegistration={handleBulkRegistration}
            onBulkOverride={handleBulkOverride}
            studentRoster={studentRoster}
            onImportStudentRoster={handleImportStudentRoster}
            onUpdateStudentRoster={handleUpdateStudentRoster}
            results={results}
            onSaveResult={handleSaveResult}
            onResetData={handleResetData}
            stats={stats}
          />
        )}
      </main>
    </div>
  );
}

const AccessLogin = ({
  systemConfig,
  onLogin,
}: {
  systemConfig: SystemConfig;
  onLogin: (password: string) => boolean;
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (onLogin(password)) {
      setPassword('');
      setError('');
      return;
    }
    setError('Password tidak sah. Sila semak password admin atau guru rumah sukan.');
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-2xl items-center justify-center p-4">
      <form onSubmit={submit} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-slate-900 p-6 text-white">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-slate-950">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black">Akses Admin / Guru Rumah</h2>
          <p className="mt-1 text-sm text-slate-300">Masukkan password untuk mengurus pendaftaran peserta.</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="font-black">Tahap akses</div>
            <p className="mt-1">Admin boleh kawal semua tetapan. Guru rumah sukan hanya boleh daftar peserta rumah masing-masing.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Masukkan password"
              autoFocus
            />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          <button type="submit" className="w-full rounded-xl bg-slate-900 px-5 py-3 font-black text-white shadow-lg transition-colors hover:bg-slate-800">
            Masuk
          </button>
          <div className="text-xs leading-relaxed text-slate-500">
            Rumah aktif sekarang: {activeHouseIds(systemConfig).map(house => getHouseName(systemConfig, house)).join(', ')}
          </div>
        </div>
      </form>
    </div>
  );
};

export default App;
