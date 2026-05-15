import React, { useState, useMemo } from 'react';
import { HouseColor, Gender, EventType, Participant, WinnerProfile, PointsConfig, HouseStats, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import {
  activeEvents,
  activeHouseIds,
  formatCompetitionGroupLabel,
  getEventCompetitionGroup,
  getEventGenders,
  getHouseName,
} from '../utils/systemConfig';
import { Save, Search, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Flag, Calculator, Dumbbell, RotateCcw, Table, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResultsEntryProps {
  onSaveResult: (eventId: string, year: number, gender: Gender, positions: WinnerProfile[]) => void;
  existingResults: Record<string, WinnerProfile[]>;
  registrations: Record<string, Participant[]>;
  stats?: HouseStats[];
  pointsConfig?: PointsConfig;
  systemConfig?: SystemConfig;
}

interface RaceDefinition {
  uniqueKey: string; eventId: string; eventName: string;
  year: number; gender: Gender; type: EventType;
}

interface Candidate {
  id: string; label: string; house: HouseColor;
  name: string; className: string; teamMembers?: Participant[];
}

const HS: Record<HouseColor, { hex: string; glow: string }> = {
  [HouseColor.MERAH]:  { hex: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  [HouseColor.BIRU]:   { hex: '#3b82f6', glow: 'rgba(59,130,246,0.35)' },
  [HouseColor.HIJAU]:  { hex: '#22c55e', glow: 'rgba(34,197,94,0.35)' },
  [HouseColor.KUNING]: { hex: '#eab308', glow: 'rgba(234,179,8,0.35)' },
  [HouseColor.UNGU]:   { hex: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  [HouseColor.OREN]:   { hex: '#f97316', glow: 'rgba(249,115,22,0.35)' },
};

const getHouseEmoji = (house: HouseColor) => {
  switch (house) {
    case HouseColor.MERAH: return '🔴'; case HouseColor.BIRU: return '🔵';
    case HouseColor.HIJAU: return '🟢'; case HouseColor.KUNING: return '🟡';
    case HouseColor.UNGU: return '🟣'; case HouseColor.OREN: return '🟠';
    default: return '⚪';
  }
};

const ResultsEntry: React.FC<ResultsEntryProps> = ({ onSaveResult, existingResults, registrations, stats = [], pointsConfig, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterYear, setFilterYear] = useState<string>('SEMUA');
  const [filterGender, setFilterGender] = useState<string>('SEMUA');
  const [filterEvent, setFilterEvent] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRace, setExpandedRace] = useState<string | null>(null);

  const allRaces = useMemo(() => {
    const races: RaceDefinition[] = [];
    activeEvents(systemConfig).forEach(event => {
      const group = getEventCompetitionGroup(event);
      getEventGenders(event).forEach(gender => {
        races.push({ uniqueKey: `${event.id}_${group.key}_${gender}`, eventId: event.id, eventName: event.name, year: group.key, gender, type: event.type });
      });
    });
    return races;
  }, [systemConfig]);

  const uniqueEventNames = useMemo(() => { const n = new Set<string>(); allRaces.forEach(r => n.add(r.eventName)); return Array.from(n).sort(); }, [allRaces]);

  const filteredRaces = useMemo(() => {
    return allRaces.filter(race => {
      const isKhas = race.type === EventType.KHUSUS;
      if (filterCategory==='TAHAP 1') { if (race.eventName.includes('Tahap 2')) return false; if (!isKhas && ![1,2,3,8].includes(race.year)) return false; }
      if (filterCategory==='TAHAP 2') { if (race.eventName.includes('Tahap 1')) return false; if (!isKhas && ![4,5,6,10,12].includes(race.year)) return false; }
      if (filterYear!=='SEMUA' && race.year!==parseInt(filterYear)) return false;
      if (filterGender!=='SEMUA' && race.gender!==filterGender && race.gender!==Gender.CAMPURAN) return false;
      if (filterEvent!=='SEMUA' && race.eventName!==filterEvent) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const g = race.gender===Gender.LELAKI?'Lelaki':race.gender===Gender.PEREMPUAN?'Perempuan':'Terbuka';
        const y = formatCompetitionGroupLabel(race.year);
        if (!`${race.eventName} ${y} ${g}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allRaces, filterCategory, filterYear, filterGender, filterEvent, searchQuery]);

  const getCandidates = (race: RaceDefinition): Candidate[] => {
    if (race.eventId==='khas_tariktali') return activeHouseIds(systemConfig).map(house=>({ id:`${house}_TEAM_TARIKTALI`, label:`${getHouseEmoji(house)} Pasukan Tarik Tali`, house, name:`Pasukan ${getHouseName(systemConfig, house)}`, className:'Tarik Tali' }));
    if (race.type===EventType.KHUSUS) return [];
    const candidates: Candidate[] = [];
    activeHouseIds(systemConfig).forEach(house => {
      const regKey = `${house}_${race.year}_${race.gender}_${race.eventId}`;
      const valid = (registrations[regKey]||[]).filter(p=>p&&p.name&&p.name.trim().length>0);
      if (valid.length>0) {
        if (race.type===EventType.RELAY) candidates.push({ id:`${house}_TEAM`, label:`${getHouseEmoji(house)} Pasukan (${valid.length} pelari)`, house, name:`Pasukan ${getHouseName(systemConfig, house)}`, className:`${valid.length} Pelari`, teamMembers:valid });
        else valid.forEach((p,idx)=>candidates.push({ id:`${house}_${idx}_${p.name.replace(/\s/g,'')}`, label:`${getHouseEmoji(house)} ${p.name} (${p.className||'-'})`, house, name:p.name, className:p.className }));
      }
    });
    return candidates;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">

        <div className="p-6 border-b border-gray-200 bg-slate-50">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <CheckCircle className="w-6 h-6 mr-2 text-green-600"/>Masuk Keputusan Acara
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"/>
              <input type="text" placeholder="Cari... (Contoh: 100m Bawah 10)" className="pl-10 w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
            </div>
            <div className="relative">
              <Dumbbell className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none"/>
              <select className="pl-10 w-full rounded-md border-gray-300 shadow-sm border p-2 bg-white text-sm" value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}>
                <option value="SEMUA">Semua Acara</option>
                {uniqueEventNames.map(n=>(<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <select className="rounded-md border-gray-300 shadow-sm border p-2 bg-white text-sm" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
              <option value="SEMUA">Semua Tahap</option>
              <option value="TAHAP 1">Tahap 1</option>
              <option value="TAHAP 2">Tahap 2</option>
            </select>
            <select className="rounded-md border-gray-300 shadow-sm border p-2 bg-white text-sm" value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
              <option value="SEMUA">Semua Kategori</option>
              {[8,10,12,0].map(y=>(<option key={y} value={y}>{formatCompetitionGroupLabel(y)}</option>))}
            </select>
          </div>
        </div>
        <div className="divide-y divide-gray-200 bg-gray-50">
          {filteredRaces.length===0?(
            <div className="p-12 text-center text-gray-500"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="text-base">Tiada acara dijumpai.</p></div>
          ):(
            filteredRaces.map(race=>(
                <RaceRow key={race.uniqueKey} race={race} candidates={getCandidates(race)} currentResults={existingResults[race.uniqueKey]||[]}
                systemConfig={systemConfig}
                isExpanded={expandedRace===race.uniqueKey} onToggle={()=>setExpandedRace(expandedRace===race.uniqueKey?null:race.uniqueKey)}
                onSave={(positions,shouldClose=true)=>{ onSaveResult(race.eventId,race.year,race.gender,positions); if(shouldClose)setExpandedRace(null); }}/>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

// Sub-component
const RaceRow: React.FC<{
  race: RaceDefinition;
  candidates: Candidate[];
  currentResults: WinnerProfile[];
  systemConfig: SystemConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (positions: WinnerProfile[], shouldClose?: boolean) => void;
}> = ({ race, candidates, currentResults, systemConfig, isExpanded, onToggle, onSave }) => {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(Array(6).fill(''));
  const [houseScores, setHouseScores] = useState<Record<HouseColor, number>>({
    [HouseColor.MERAH]: 0, [HouseColor.BIRU]: 0, [HouseColor.HIJAU]: 0,
    [HouseColor.KUNING]: 0, [HouseColor.UNGU]: 0, [HouseColor.OREN]: 0,
  });
  const isManualScoreEntry = race.type === EventType.KHUSUS && race.eventId !== 'khas_tariktali';

  React.useEffect(() => {
    if (isExpanded) {
      if (isManualScoreEntry) {
        const scores = activeHouseIds(systemConfig).reduce((acc, house) => ({ ...acc, [house]: 0 }), {} as Record<HouseColor, number>);
        currentResults.forEach(r => { scores[r.house] = r.customScore || 0; });
        setHouseScores(scores);
      } else {
        const initial = Array(6).fill('');
        currentResults.forEach((winner, idx) => {
          if (idx < 6) {
            const match = candidates.find(c => c.house === winner.house && c.name === winner.name);
            if (match) initial[idx] = match.id;
            else initial[idx] = `${winner.house}_GENERIC`;
            if (!match && race.eventId === 'khas_tariktali') initial[idx] = `${winner.house}_TEAM_TARIKTALI`;
          }
        });
        setSelectedCandidates(initial);
      }
    }
  }, [isExpanded, currentResults, candidates, isManualScoreEntry, race.eventId]);

  const handleKhususReset = () => {
    setHouseScores(activeHouseIds(systemConfig).reduce((acc, house) => ({ ...acc, [house]: 0 }), {} as Record<HouseColor, number>));
    onSave([], false);
  };
  const handleStandardReset = () => { setSelectedCandidates(Array(6).fill('')); onSave([], false); };

  const handleStandardSave = () => {
    const positions: WinnerProfile[] = [];
    selectedCandidates.forEach(candId => {
      if (!candId) return;
      const candidate = candidates.find(c => c.id === candId);
      if (candidate) {
        const profile: WinnerProfile = { house: candidate.house, name: candidate.name, className: candidate.className };
        if (candidate.teamMembers) profile.teamMembers = candidate.teamMembers;
        positions.push(profile);
      }
    });
    if (positions.length === 0) { alert("Sila pilih sekurang-kurangnya seorang pemenang."); return; }
    onSave(positions);
  };

  const handleKhususSave = () => {
    const positions: WinnerProfile[] = Object.entries(houseScores).map(([houseStr, score]) => ({
      house: houseStr as HouseColor, name: `Rumah ${getHouseName(systemConfig, houseStr)}`, className: 'Acara Khas', customScore: Number(score)
    }));
    onSave(positions);
  };

  const hasResult = currentResults.length > 0;

  return (
    <div className={`bg-white transition-all ${isExpanded ? 'shadow-md z-10 relative my-1' : 'border-b border-gray-100'}`}>
      <div onClick={onToggle} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 min-h-[70px]">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${hasResult ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            {hasResult ? <CheckCircle className="w-5 h-5"/> : <div className="w-5 h-5 rounded-full border-2 border-current"/>}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {race.eventName}
              {race.type === EventType.KHUSUS && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200 flex items-center gap-1">
                  <Flag className="w-3 h-3"/> Khas
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500">
              {race.year === 0 ? 'Kategori Terbuka' : formatCompetitionGroupLabel(race.year)} • 
              {race.gender === Gender.LELAKI ? ' Lelaki' : race.gender === Gender.PEREMPUAN ? ' Perempuan' : ' Campuran'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400"/> : <ChevronDown className="w-5 h-5 text-gray-400"/>}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-gray-100 bg-slate-50">
          {isManualScoreEntry ? (
            <div>
              <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-lg flex items-center gap-3 border border-blue-200 text-sm">
                <Calculator className="w-5 h-5"/>
                <span className="font-semibold">Masukkan jumlah mata yang diperolehi oleh setiap rumah untuk acara ini.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeHouseIds(systemConfig).map(house => (
                  <div key={house} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded shadow-sm ${HOUSE_CONFIG[house].color} border-2 border-white ring-1 ring-gray-100`}></div>
                      <span className="font-bold text-base text-gray-800">{getHouseName(systemConfig, house)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Mata</span>
                      <input type="number" min="0" className="w-20 p-2 text-center font-bold text-lg border border-gray-300 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                        value={houseScores[house]} onChange={e=>setHouseScores(prev=>({...prev,[house]:Number(e.target.value)}))}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-6 mt-2 gap-3">
                <button onClick={handleKhususReset} className="flex items-center px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm font-bold">
                  <RotateCcw className="w-4 h-4 mr-2"/>Reset
                </button>
                <button onClick={handleKhususSave} className="flex items-center px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg text-sm font-bold">
                  <Save className="w-4 h-4 mr-2"/>Simpan Keputusan Khas
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {[0,1,2,3,4,5].map(placeIndex => {
                  const selectedInOtherDropdowns = selectedCandidates.filter((_,idx)=>idx!==placeIndex);
                  const availableCandidates = candidates.filter(c=>!selectedInOtherDropdowns.includes(c.id));
                  return (
                    <div key={placeIndex} className="relative bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Tempat Ke-{placeIndex+1}{placeIndex<3&&<span className="text-yellow-500 ml-1">★</span>}
                      </label>
                      <select className={`w-full p-2.5 rounded border focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium transition-all ${selectedCandidates[placeIndex]?'border-blue-500 bg-blue-50 text-blue-900':'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}
                        value={selectedCandidates[placeIndex]} onChange={e=>{ const n=[...selectedCandidates]; n[placeIndex]=e.target.value; setSelectedCandidates(n); }}>
                        <option value="">-- Pilih Pemenang --</option>
                        {availableCandidates.map(c=>(<option key={c.id} value={c.id}>{c.label}</option>))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200 gap-3">
                <button onClick={handleStandardReset} className="flex items-center px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm font-bold">
                  <RotateCcw className="w-4 h-4 mr-2"/>Reset
                </button>
                <button onClick={handleStandardSave} className="flex items-center px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg text-sm font-bold">
                  <Save className="w-4 h-4 mr-2"/>Simpan Keputusan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsEntry;
