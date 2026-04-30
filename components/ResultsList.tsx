import React, { useMemo, useState, useRef } from 'react';
import { HouseColor, Gender, EventType, WinnerProfile, HouseStats, PointsConfig, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, activeHouseIds, getHouseName } from '../utils/systemConfig';
import { Trophy, Search, AlertCircle, User, Users, Flag, Star, Calendar, Dumbbell, Filter, ChevronDown, ChevronUp, ClipboardList, CheckCircle, Zap, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResultsListProps {
  results: Record<string, WinnerProfile[]>;
  stats?: HouseStats[];
  pointsConfig?: PointsConfig;
  systemConfig?: SystemConfig;
}

const SCHOOL_NAME = 'SK ORAN';
const SCHOOL_LOGO = '/logo-sekolah-oran-transparent.png?v=2';
const EVENT_TITLE = 'Kejohanan Sukan Olahraga SK ORAN 2026';

const HS: Record<HouseColor, { hex: string; glow: string; light: string; name: string }> = {
  [HouseColor.MERAH]:  { hex: '#ef4444', glow: 'rgba(239,68,68,0.3)',  light: '#fee2e2', name: 'Merah' },
  [HouseColor.BIRU]:   { hex: '#3b82f6', glow: 'rgba(59,130,246,0.3)', light: '#dbeafe', name: 'Biru'  },
  [HouseColor.HIJAU]:  { hex: '#22c55e', glow: 'rgba(34,197,94,0.3)',  light: '#dcfce7', name: 'Hijau' },
  [HouseColor.KUNING]: { hex: '#eab308', glow: 'rgba(234,179,8,0.3)',  light: '#fef9c3', name: 'Kuning'},
  [HouseColor.UNGU]:   { hex: '#a855f7', glow: 'rgba(168,85,247,0.3)', light: '#f3e8ff', name: 'Ungu'  },
  [HouseColor.OREN]:   { hex: '#f97316', glow: 'rgba(249,115,22,0.3)', light: '#ffedd5', name: 'Oren'  },
};

const ResultsList: React.FC<ResultsListProps> = ({ results, stats = [], pointsConfig, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const [activeTab, setActiveTab] = useState<'keputusan'|'zonaksi'|'sukantara'>('keputusan');
  const [searchQuery, setSearchQuery]       = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterYear, setFilterYear]         = useState<string>('SEMUA');
  const [filterGender, setFilterGender]     = useState<string>('SEMUA');
  const [filterEvent, setFilterEvent]       = useState<string>('SEMUA');
  const [tableFilter, setTableFilter]       = useState<'semua'|'selesai'|'belum'>('semua');
  const [expandedTeams, setExpandedTeams]   = useState<Record<string, boolean>>({});
  const [expandedRow, setExpandedRow]       = useState<string|null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printGroup, setPrintGroup]         = useState<'acara'|'tahun'|'rumah'>('acara');
  const [printYears, setPrintYears]         = useState<number[]>([1,2,3,4,5,6,0]);
  const [printGenders, setPrintGenders]     = useState<string[]>([Gender.LELAKI, Gender.PEREMPUAN, Gender.CAMPURAN]);
  const [printEventsFilter, setPrintEventsFilter] = useState<string[]>([]);

  const toggleTeam = (eventKey: string, idx: number) => {
    const key = `${eventKey}_${idx}`;
    setExpandedTeams(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleRow = (key: string) => setExpandedRow(prev => prev === key ? null : key);

  const eventsMatrix = useMemo(() => {
    const rows: Array<{
      eventName:string; category:string; year:number; gender:string;
      points:Record<HouseColor,number>; isCompleted:boolean; winners:WinnerProfile[]; rowKey:string;
    }> = [];
    const defs: any[] = [];
    activeEvents(systemConfig).forEach(e => {
      e.years.forEach(year => {
        const genders = year === 0 ? [Gender.CAMPURAN] : [Gender.LELAKI, Gender.PEREMPUAN];
        genders.forEach(gender => defs.push({...e, year, gender}));
      });
    });
    defs.forEach(def => {
      const key = `${def.id}_${def.year}_${def.gender}`;
      const pos = results[key] || [];
      const rp = activeHouseIds(systemConfig).reduce((acc, house) => ({ ...acc, [house]: 0 }), {} as Record<HouseColor, number>);
      const isTT = def.id === 'khas_tariktali';
      if (def.type === EventType.KHUSUS && !isTT) {
        pos.forEach((p: WinnerProfile) => { if (p.customScore && rp[p.house] !== undefined) rp[p.house] = p.customScore; });
      } else if (pointsConfig) {
        let s = pointsConfig.individu;
        if (def.type === EventType.RELAY) s = pointsConfig.relay;
        if (isTT) s = pointsConfig.tarikTali;
        pos.forEach((p: WinnerProfile, i: number) => { const pt = s[i]||0; if (rp[p.house] !== undefined) rp[p.house] += pt; });
      }
      const cat = def.year===0 ? 'Terbuka' : `Tahun ${def.year} • ${def.gender==='L'?'Lelaki':def.gender==='P'?'Perempuan':'Campuran'}`;
      rows.push({ eventName:def.name, category:cat, year:def.year, gender:def.gender, points:rp, isCompleted:pos.length>0, winners:pos, rowKey:key });
    });
    return rows;
  }, [results, pointsConfig, systemConfig]);

  const filteredMatrix = useMemo(() => {
    let arr = eventsMatrix.filter(r => !r.eventName.toLowerCase().includes('sukantara'));
    const allSku = eventsMatrix.filter(r => r.eventName.toLowerCase().includes('sukantara'));
    if (allSku.length > 0) {
      let anyCompleted = false;
      const pts = activeHouseIds(systemConfig).reduce((acc, house) => ({ ...acc, [house]: 0 }), {} as Record<HouseColor, number>);
      allSku.forEach(r => {
        if (r.isCompleted) anyCompleted = true;
        Object.keys(r.points).forEach(h => { pts[h as HouseColor] += r.points[h as HouseColor] || 0; });
      });
      arr.push({ eventName:'Sukantara', category:'Gabungan Semua Tahun', year:0, gender:'C', points:pts, isCompleted:anyCompleted, winners:[], rowKey:'sk_matrix_gabung' });
    }
    if (tableFilter==='selesai') return arr.filter(r=>r.isCompleted);
    if (tableFilter==='belum')   return arr.filter(r=>!r.isCompleted);
    return arr;
  }, [eventsMatrix, tableFilter, systemConfig]);

  const completedCount = eventsMatrix.filter(r=>r.isCompleted).length;
  const totalCount     = eventsMatrix.length;
  const progressPct    = totalCount>0?(completedCount/totalCount)*100:0;

  const allEvents = useMemo(() => {
    const events: Array<{key:string;name:string;year:number;gender:Gender;positions:WinnerProfile[];eventDef:any;isManualScore:boolean;hasResults:boolean}> = [];
    const addEvent = (eventDef: any, year: number, gender: Gender) => {
      const key = `${eventDef.id}_${year}_${gender}`;
      const positions = results[key] || [];
      const isManualScore = eventDef.type === EventType.KHUSUS && eventDef.id !== 'khas_tariktali';
      let displayPositions = [...positions];
      if (isManualScore) displayPositions = displayPositions.sort((a,b)=>(b.customScore||0)-(a.customScore||0));
      events.push({ key, name:eventDef.name, year, gender, positions:displayPositions, eventDef, isManualScore, hasResults:positions.length>0 });
    };
    activeEvents(systemConfig).forEach(e => {
      e.years.forEach(year => {
        const genders = year === 0 ? [Gender.CAMPURAN] : [Gender.LELAKI, Gender.PEREMPUAN];
        genders.forEach(gender => addEvent(e, year, gender));
      });
    });
    return events.sort((a,b) => { if(a.year!==b.year) return a.year-b.year; if(a.gender!==b.gender) return a.gender.localeCompare(b.gender); return a.name.localeCompare(b.name); });
  }, [results, systemConfig]);

  const uniqueEventNames = useMemo(() => {
    const n = new Set<string>(); let hasSku = false;
    allEvents.forEach(r => { if (r.name.toLowerCase().includes('sukantara')) hasSku = true; else n.add(r.name); });
    if (hasSku) n.add('Sukantara');
    return Array.from(n).sort();
  }, [allEvents]);

  const availablePrintEventNames = useMemo(() => {
    let filtered = allEvents;
    if (printYears.length > 0) {
      filtered = filtered.filter(e => printYears.includes(e.year));
    }
    const n = new Set<string>(); let hasSku = false;
    filtered.forEach(r => { if (r.name.toLowerCase().includes('sukantara')) hasSku = true; else n.add(r.name); });
    if (hasSku) n.add('Sukantara');
    return Array.from(n).sort();
  }, [allEvents, printYears]);

  const filteredEvents = useMemo(() => {
    const baseList = allEvents.filter(item => {
      const isKhas = item.eventDef?.type === EventType.KHUSUS;
      if (filterCategory==='TAHAP 1') { if(item.name.includes('Tahap 2'))return false; if(!isKhas&&item.year>3)return false; }
      if (filterCategory==='TAHAP 2') { if(item.name.includes('Tahap 1'))return false; if(!isKhas&&item.year<=3)return false; }
      if (filterYear!=='SEMUA'&&item.year!==parseInt(filterYear)) return false;
      if (filterGender!=='SEMUA'&&item.gender!==filterGender) return false;
      if (filterEvent!=='SEMUA') {
        if (filterEvent==='Sukantara') { if (!item.name.toLowerCase().includes('sukantara')) return false; }
        else { if (item.name!==filterEvent) return false; }
      }
      if (searchQuery) { const s=`${item.name} Tahun ${item.year} ${item.gender}`.toLowerCase(); return s.includes(searchQuery.toLowerCase()); }
      return true;
    });
    let evs = baseList.filter(r => !r.name.toLowerCase().includes('sukantara'));
    const allSku = baseList.filter(r => r.name.toLowerCase().includes('sukantara'));
    if (allSku.length > 0) {
      const skuWithResults = allSku.filter(r => r.hasResults);
      const housePoints: Record<string, number> = {};
      skuWithResults.forEach(r => { r.positions.forEach(p => { housePoints[p.house] = (housePoints[p.house]||0)+(p.customScore||0); }); });
      const positions = Object.keys(housePoints).map(h => ({ house:h as HouseColor, customScore:housePoints[h], name:'Sumbangan Keseluruhan', className:'' })).filter(p=>p.customScore>0).sort((a,b)=>b.customScore-a.customScore);
      evs.push({ key:'sk_gabung', name:'Sukantara', year:0, gender:Gender.CAMPURAN, positions, eventDef:{type:EventType.KHUSUS,id:'sk_gabung',name:'Sukantara',maxParticipants:0,years:[0]}, isManualScore:true, hasResults:positions.length>0 });
    }
    return evs.sort((a,b) => { if(a.key==='sk_gabung')return 1; if(b.key==='sk_gabung')return -1; return 0; });
  }, [allEvents, filterCategory, filterYear, filterGender, filterEvent, searchQuery]);

  const houseTotals = useMemo(() => activeHouseIds(systemConfig).map(house => ({ house, total:stats.find(s=>s.house===house)?.totalPoints||0 })).sort((a,b)=>b.total-a.total), [stats, systemConfig]);
  const maxTotal = houseTotals[0]?.total || 1;

  // ══════════════════════════════════════════════════════════════
  // ── CETAK PDF — LISTING BIASA ────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const executePrint = () => {
    let eventsToP = allEvents.filter(e => e.hasResults);
    eventsToP = eventsToP.filter(e => printYears.includes(e.year));
    eventsToP = eventsToP.filter(e => printGenders.includes(e.gender));
    eventsToP = eventsToP.filter(e => printEventsFilter.includes(e.name));
    if (eventsToP.length === 0) {
      alert('Sila pilih sekurang-kurangnya satu acara untuk dicetak (pastikan ia telah selesai).');
      return;
    }

    const posLabel = (i: number) => i===0?'Emas':i===1?'Perak':i===2?'Gangsa':`Ke-${i+1}`;
    const todayStr = new Date().toLocaleDateString('ms-MY', { day:'2-digit', month:'long', year:'numeric' });

    // ── Satu blok acara ──
    const buildEventBlock = (event: typeof eventsToP[0]) => {
      const isRelay = event.eventDef?.type === EventType.RELAY;
      const gLabel  = event.gender===Gender.LELAKI?'Lelaki':event.gender===Gender.PEREMPUAN?'Perempuan':'Campuran';
      const yLabel  = event.year===0?'Terbuka':`Tahun ${event.year}`;

      const rows = event.positions.slice(0, 6).map((w, i) => {
        const members = isRelay && w.teamMembers?.length
          ? w.teamMembers.map((m: any) => `${m.name}${m.className?' ('+m.className+')':''}`).join(', ')
          : '';
        const scoreCell = event.isManualScore && w.customScore
          ? `<td style="padding:3px 8px;text-align:right;width:60px;">${w.customScore} mata</td>`
          : `<td style="width:60px;"></td>`;
        return `
          <tr>
            <td style="padding:3px 8px;text-align:center;width:24px;border-right:1px solid #e5e7eb;">${i+1}</td>
            <td style="padding:3px 8px;width:50px;border-right:1px solid #e5e7eb;">${posLabel(i)}</td>
            <td style="padding:3px 8px;width:52px;border-right:1px solid #e5e7eb;">${getHouseName(systemConfig, w.house)}</td>
            <td style="padding:3px 8px;border-right:1px solid #e5e7eb;">
              ${w.name || 'Wakil Rumah'}
              ${members ? `<br/><span style="font-size:8px;color:#555;">${members}</span>` : ''}
            </td>
            <td style="padding:3px 8px;color:#444;border-right:1px solid #e5e7eb;">${w.className || ''}</td>
            ${scoreCell}
          </tr>`;
      }).join('');

      return `
        <div style="margin-bottom:8px;break-inside:avoid;">
          <table style="width:100%;border-collapse:collapse;font-size:9.5px;border:1px solid #aaa;">
            <thead>
              <tr style="background:#e5e7eb;">
                <th colspan="6" style="padding:4px 8px;text-align:left;font-size:10px;border-bottom:1px solid #aaa;">
                  ${event.name}${isRelay ? ' — Relay' : ''} &nbsp;|&nbsp; ${yLabel} &nbsp;|&nbsp; ${gLabel}
                </th>
              </tr>
              <tr style="background:#f3f4f6;font-size:8.5px;">
                <th style="padding:2px 8px;border:1px solid #d1d5db;">#</th>
                <th style="padding:2px 8px;border:1px solid #d1d5db;text-align:left;">Tempat</th>
                <th style="padding:2px 8px;border:1px solid #d1d5db;text-align:left;">Rumah</th>
                <th style="padding:2px 8px;border:1px solid #d1d5db;text-align:left;">Nama</th>
                <th style="padding:2px 8px;border:1px solid #d1d5db;text-align:left;">Kelas</th>
                <th style="padding:2px 8px;border:1px solid #d1d5db;text-align:right;">${event.isManualScore ? 'Mata' : ''}</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>`;
    };

    // ── Header halaman ──
    const pageHeader = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #000;">
        <img src="${SCHOOL_LOGO}" style="width:44px;height:44px;object-fit:contain;" crossorigin="anonymous"/>
        <div style="flex:1;text-align:center;">
          <div style="font-size:13px;font-weight:bold;text-transform:uppercase;">${EVENT_TITLE}</div>
          <div style="font-size:10px;">${SCHOOL_NAME}</div>
        </div>
        <div style="text-align:right;font-size:9px;">
          <div>${todayStr}</div>
          <div style="font-weight:bold;margin-top:2px;">KEPUTUSAN RASMI</div>
        </div>
      </div>`;

    // ── Bina body ──
    let bodyHTML = '';

    if (printGroup === 'acara') {
      const byName: Record<string, typeof eventsToP> = {};
      eventsToP.forEach(e => { if (!byName[e.name]) byName[e.name]=[]; byName[e.name].push(e); });
      bodyHTML = Object.entries(byName).map(([name, evs], gi) => `
        <div style="${gi>0?'page-break-before:always;':''}">
          ${pageHeader}
          <p style="font-size:9.5px;margin-bottom:6px;">Acara: <strong>${name}</strong> &mdash; ${evs.length} kategori</p>
          ${evs.map(buildEventBlock).join('')}
        </div>`).join('');

    } else if (printGroup === 'tahun') {
      const byYear: Record<string, typeof eventsToP> = {};
      eventsToP.forEach(e => {
        const k = e.year===0?'Terbuka / Khas':`Tahun ${e.year}`;
        if (!byYear[k]) byYear[k]=[];
        byYear[k].push(e);
      });
      const yearOrder = ['Tahun 1','Tahun 2','Tahun 3','Tahun 4','Tahun 5','Tahun 6','Terbuka / Khas'];
      bodyHTML = yearOrder.filter(k=>byYear[k]).map((k, gi) => `
        <div style="${gi>0?'page-break-before:always;':''}">
          ${pageHeader}
          <p style="font-size:11px;font-weight:bold;margin-bottom:6px;border-left:3px solid #000;padding-left:6px;">${k} &mdash; ${byYear[k].length} acara</p>
          ${byYear[k].map(buildEventBlock).join('')}
        </div>`).join('');

    } else {
      bodyHTML = activeHouseIds(systemConfig).map((house, gi) => {
        const wins = eventsToP.filter(e => e.positions.length>0 && e.positions[0].house===house);
        if (wins.length===0) return '';
        return `
          <div style="${gi>0?'page-break-before:always;':''}">
            ${pageHeader}
            <p style="font-size:11px;font-weight:bold;margin-bottom:6px;border-left:3px solid #000;padding-left:6px;">Rumah ${HS[house].name} &mdash; ${wins.length} kemenangan emas</p>
            ${wins.map(buildEventBlock).join('')}
          </div>`;
      }).join('');
    }

    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html lang="ms"><head><meta charset="UTF-8">
<title>Keputusan Rasmi</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:10px;background:white;color:#000; }
  tr:nth-child(even) { background:#f9fafb; }
  @page { size:A4 portrait;margin:10mm 12mm; }
  @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
</style></head><body>${bodyHTML}</body></html>`);
    win.document.close();
    setTimeout(()=>win.print(), 600);
    setShowPrintModal(false);
  };
  // ══════════════════════════════════════════════════════════════

  const handlePrintKeputusan = () => {
    setPrintEventsFilter(uniqueEventNames);
    setShowPrintModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 min-h-screen">

      {/* ── PRINT MODAL ── */}
      {showPrintModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl"><Printer className="w-5 h-5 text-white"/></div>
              <div>
                <h3 className="text-white font-black text-base">Tetapan Cetak PDF</h3>
                <p className="text-slate-400 text-xs">Format A4 Portrait</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">📅 TAHUN</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPrintYears([1,2,3,4,5,6,0])} className="text-[10px] text-blue-600 font-bold hover:underline">Pilih Semua</button>
                      <span className="text-gray-300 text-[10px]">|</span>
                      <button type="button" onClick={() => setPrintYears([])} className="text-[10px] text-red-600 font-bold hover:underline">Kosongkan</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6,0].map(y => (
                      <label key={y} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors border border-gray-100 hover:border-gray-200 shadow-sm bg-white">
                        <input
                          type="checkbox"
                          checked={printYears.includes(y)}
                          onChange={(e) => {
                            if(e.target.checked) setPrintYears(prev => [...prev, y]);
                            else setPrintYears(prev => prev.filter(x => x !== y));
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-xs font-bold text-gray-700 leading-tight">{y===0?'Terbuka':`Tahun ${y}`}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">👤 JANTINA</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPrintGenders([Gender.LELAKI, Gender.PEREMPUAN, Gender.CAMPURAN])} className="text-[10px] text-blue-600 font-bold hover:underline">Pilih Semua</button>
                      <span className="text-gray-300 text-[10px]">|</span>
                      <button type="button" onClick={() => setPrintGenders([])} className="text-[10px] text-red-600 font-bold hover:underline">Kosongkan</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[Gender.LELAKI, Gender.PEREMPUAN, Gender.CAMPURAN].map(g => (
                      <label key={g} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors border border-gray-100 hover:border-gray-200 shadow-sm bg-white">
                        <input
                          type="checkbox"
                          checked={printGenders.includes(g)}
                          onChange={(e) => {
                            if(e.target.checked) setPrintGenders(prev => [...prev, g]);
                            else setPrintGenders(prev => prev.filter(x => x !== g));
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-xs font-bold text-gray-700 leading-tight capitalize">{g.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">🏃 PILIH ACARA (MENGIKUT TAHUN)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPrintEventsFilter(availablePrintEventNames)} className="text-[10px] text-blue-600 font-bold hover:underline">Pilih Semua</button>
                      <span className="text-gray-300 text-[10px]">|</span>
                      <button type="button" onClick={() => setPrintEventsFilter([])} className="text-[10px] text-red-600 font-bold hover:underline">Kosongkan</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white p-2 grid grid-cols-2 gap-2">
                    {availablePrintEventNames.map(n => (
                      <label key={n} className="flex items-start gap-2.5 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors border border-gray-100 hover:border-gray-200 shadow-sm">
                        <input
                          type="checkbox"
                          checked={printEventsFilter.includes(n)}
                          onChange={(e) => {
                            if(e.target.checked) setPrintEventsFilter(prev => [...prev, n]);
                            else setPrintEventsFilter(prev => prev.filter(x => x !== n));
                          }}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-xs font-bold text-gray-700 leading-tight">{n}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={()=>setShowPrintModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-black text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={executePrint}
                className="flex-1 py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg"
                style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',boxShadow:'0 4px 15px rgba(59,130,246,0.4)'}}>
                <Printer className="w-4 h-4"/>Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">

        {/* ── TABS ── */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row">
            <button onClick={()=>setActiveTab('keputusan')}
              className={`flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab==='keputusan'?'border-slate-900 text-slate-900 bg-white':'border-transparent text-gray-400 hover:text-gray-700 hover:bg-white/60'}`}>
              <ClipboardList className="w-4 h-4 flex-shrink-0"/><span>Senarai Keputusan</span>
            </button>
            <button onClick={()=>setActiveTab('zonaksi')}
              className={`flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab==='zonaksi'?'border-yellow-500 text-yellow-700 bg-white':'border-transparent text-gray-400 hover:text-gray-700 hover:bg-white/60'}`}>
              <Zap className="w-4 h-4 flex-shrink-0"/><span>Kutipan Mata</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{background:'rgba(34,197,94,0.1)',color:'#16a34a',border:'1px solid rgba(34,197,94,0.25)'}}>{completedCount}/{totalCount}</span>
            </button>
            <button onClick={()=>setActiveTab('sukantara')}
              className={`flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab==='sukantara'?'border-orange-500 text-orange-700 bg-white':'border-transparent text-gray-400 hover:text-gray-700 hover:bg-white/60'}`}>
              <Flag className="w-4 h-4 flex-shrink-0"/><span>Sukantara</span>
            </button>
          </div>
        </div>

        {/* ══ TAB 1: SENARAI KEPUTUSAN ══ */}
        {activeTab==='keputusan'&&(
          <>
            <div className="p-4 lg:p-6 border-b border-gray-200 bg-slate-900 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-500 p-2 rounded-lg text-slate-900 shrink-0"><Trophy className="w-5 h-5 md:w-6 md:h-6"/></div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Senarai Keputusan Rasmi</h2>
                    <p className="text-slate-400 text-xs md:text-sm">Paparan keputusan bagi acara yang telah selesai</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Jumlah Selesai</div>
                    <div className="text-xl font-bold">{filteredEvents.filter(e=>e.hasResults).length}</div>
                  </div>
                  {/* ── BUTANG CETAK PDF ── */}
                  <button onClick={handlePrintKeputusan}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5 shadow-lg"
                    style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',color:'white',boxShadow:'0 4px 15px rgba(59,130,246,0.4)'}}>
                    <Printer className="w-4 h-4"/>
                    Cetak PDF
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-800 p-4 rounded-lg">
                <div className="relative lg:col-span-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                  <input type="text" placeholder="Cari acara..." className="pl-10 w-full rounded bg-slate-700 border-slate-600 text-white placeholder-slate-400 text-sm p-2" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
                </div>
                <div className="relative"><Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                  <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
                    <option value="SEMUA">Semua Tahap</option><option value="TAHAP 1">Tahap 1</option><option value="TAHAP 2">Tahap 2</option>
                  </select>
                </div>
                <div className="relative"><Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                  <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
                    <option value="SEMUA">Semua Tahun</option>{[1,2,3,4,5,6].map(y=><option key={y} value={y}>Tahun {y}</option>)}
                  </select>
                </div>
                <div className="relative"><Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                  <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterGender} onChange={e=>setFilterGender(e.target.value)}>
                    <option value="SEMUA">Semua Jantina</option><option value={Gender.LELAKI}>Lelaki</option><option value={Gender.PEREMPUAN}>Perempuan</option><option value={Gender.CAMPURAN}>Campuran</option>
                  </select>
                </div>
                <div className="relative"><Dumbbell className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                  <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}>
                    <option value="SEMUA">Semua Acara</option>{uniqueEventNames.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 min-h-[400px]">
              {filteredEvents.length===0?(
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-30"/><p className="text-lg">Tiada keputusan dijumpai.</p>
                </div>
              ):(
                <div className="grid grid-cols-1 gap-6 p-6">
                  {filteredEvents.map(event=>(
                    <div key={event.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">{event.name}{event.eventDef?.type===EventType.KHUSUS&&<Flag className="w-4 h-4 text-orange-600"/>}</h3>
                          <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                            {event.year===0?'Kategori Terbuka':`Tahun ${event.year}`} • {event.gender===Gender.LELAKI?' Lelaki':event.gender===Gender.PEREMPUAN?' Perempuan':' Campuran'}
                          </span>
                        </div>
                        {event.eventDef?.type===EventType.RELAY&&<span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold flex items-center gap-1"><Users className="w-3 h-3"/>RELAY</span>}
                      </div>
                      <div className="p-0">
                        {event.hasResults?(
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                            {event.positions.map((winner,idx)=>{
                              if(!event.isManualScore&&idx>5) return null;
                              const isRelay=event.eventDef?.type===EventType.RELAY;
                              const hasMembers=winner.teamMembers&&winner.teamMembers.length>0;
                              const isExpanded=expandedTeams[`${event.key}_${idx}`];
                              return (
                                <div key={idx} className={`p-4 flex flex-col gap-2 ${idx<3?'bg-white':'bg-gray-50'}`}>
                                  <div className="flex items-center gap-4">
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm border-2 border-white ${idx===0?'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200':idx===1?'bg-gray-300 text-gray-800':idx===2?'bg-orange-300 text-orange-800':'bg-slate-200 text-slate-500'}`}>{idx+1}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${HOUSE_CONFIG[winner.house].color}`}>{getHouseName(systemConfig, winner.house)}</span>
                                        {event.isManualScore?<span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500"/>{winner.customScore} Mata</span>:<span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{idx===0?'EMAS':idx===1?'PERAK':idx===2?'GANGSA':`TEMPAT KE-${idx+1}`}</span>}
                                      </div>
                                      <div className={`text-sm font-bold text-gray-900 truncate flex items-center gap-2 ${isRelay&&hasMembers?'cursor-pointer hover:text-blue-600 transition-colors':''}`} onClick={()=>isRelay&&hasMembers&&toggleTeam(event.key,idx)}>
                                        {winner.name||'Wakil Rumah'}{isRelay&&hasMembers&&(isExpanded?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>)}
                                      </div>
                                      <p className="text-xs text-gray-500 flex items-center gap-1">{isRelay?<Users className="w-3 h-3"/>:<User className="w-3 h-3"/>}{winner.className||'-'}</p>
                                    </div>
                                  </div>
                                  {isRelay&&hasMembers&&isExpanded&&(
                                    <div className="mt-2 pl-14 pr-2 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Senarai Peserta:</p>
                                      <ul className="space-y-1">{winner.teamMembers?.map((m,mi)=><li key={mi} className="text-xs text-slate-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"/><span className="font-medium">{m.name}</span><span className="text-slate-400 text-[10px]">({m.className})</span></li>)}</ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ):(
                          <div className="p-8 text-center bg-slate-50/50"><p className="text-sm text-gray-400 italic">Keputusan belum dikemaskini.</p></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TAB 2: KUTIPAN MATA ══ */}
        {activeTab==='zonaksi'&&(
          <div className="bg-gray-50 min-h-[600px]">
            <div className="bg-white border-b border-gray-200 p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-xl bg-yellow-50 border border-yellow-200 flex-shrink-0"><Zap className="w-5 h-5 text-yellow-600"/></div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 uppercase tracking-wide">Kutipan Mata Rumah Sukan</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm font-bold text-gray-700">{completedCount}<span className="text-gray-400">/{totalCount}</span> selesai</span>
                      <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${progressPct}%`}} transition={{duration:1.5,ease:'easeOut'}} className="h-full rounded-full" style={{background:'linear-gradient(90deg,#22c55e,#16a34a)'}}/>
                      </div>
                      <span className="text-xs font-bold text-green-600">{Math.round(progressPct)}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['semua','selesai','belum'] as const).map(v=>{
                    const labels={semua:'Semua',selesai:'✅ Selesai',belum:'⏳ Belum'};
                    return <button key={v} onClick={()=>setTableFilter(v)} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${tableFilter===v?'bg-yellow-500 text-white border-yellow-500 shadow-sm':'bg-white text-gray-500 border-gray-200 hover:border-yellow-300 hover:text-yellow-700'}`}>{labels[v]}</button>;
                  })}
                </div>
              </div>
              {stats.length>0&&(
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {houseTotals.map((h,i)=>{
                    const s=HS[h.house]; const pct=maxTotal>0?(h.total/maxTotal)*100:0;
                    return (
                      <div key={h.house} className="rounded-xl p-2.5 border" style={{background:s.light,borderColor:`${s.hex}40`}}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:s.hex}}/>
                            <span className="text-[11px] font-black uppercase truncate" style={{color:s.hex}}>{s.name}</span>
                          </div>
                          {i===0?<span className="text-[9px] font-black text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full flex-shrink-0">👑1</span>:<span className="text-[9px] font-bold text-gray-400 flex-shrink-0">#{i+1}</span>}
                        </div>
                        <div className="text-xl font-black leading-none mb-1" style={{color:s.hex}}>{h.total}</div>
                        <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                          <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.2,delay:i*0.1}} className="h-full rounded-full" style={{background:s.hex}}/>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5 font-bold">{Math.round(pct)}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 lg:p-5">
              <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto w-full" style={{scrollbarWidth:'thin',scrollbarColor:'#cbd5e1 transparent',WebkitOverflowScrolling:'touch'}}>
                  <table className="w-full border-collapse" style={{tableLayout:'fixed',minWidth:'700px'}}>
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-3 py-3 text-left sticky left-0 z-30 bg-gray-50" style={{width:'140px',minWidth:'140px',borderBottom:'2px solid #e5e7eb'}}>
                          <span className="text-xs font-black uppercase tracking-widest text-gray-500">Acara</span>
                        </th>
                        <th className="px-3 py-3 text-center bg-gray-50" style={{width:'110px',minWidth:'110px',borderBottom:'2px solid #e5e7eb'}}>
                          <span className="text-xs font-black uppercase tracking-widest text-gray-500">Kategori</span>
                        </th>
                        <th className="px-3 py-3 text-center bg-gray-50" style={{width:'85px',minWidth:'85px',borderBottom:'2px solid #e5e7eb'}}>
                          <span className="text-xs font-black uppercase tracking-widest text-gray-500">Status</span>
                        </th>
                        {activeHouseIds(systemConfig).map(house=>(
                          <th key={house} className="py-3 text-center bg-gray-50" style={{width:'60px',minWidth:'60px',borderBottom:'2px solid #e5e7eb'}}>
                            <div className="flex justify-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2" style={{background:HS[house].light,borderColor:HS[house].hex}}>
                                <div className="w-3 h-3 rounded-full" style={{background:HS[house].hex,boxShadow:`0 0 6px ${HS[house].glow}`}}/>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {label:'Tahap 1 — Tahun 1, 2, 3',emoji:'📋',filter:(r:any)=>r.year>=1&&r.year<=3,color:'#3b82f6',bg:'#eff6ff'},
                        {label:'Tahap 2 — Tahun 4, 5, 6',emoji:'📋',filter:(r:any)=>r.year>=4&&r.year<=6,color:'#8b5cf6',bg:'#f5f3ff'},
                        {label:'Acara Terbuka / Khas',   emoji:'🏆',filter:(r:any)=>r.year===0,          color:'#f59e0b',bg:'#fffbeb'},
                      ].map(group=>{
                        const groupRows=filteredMatrix.filter(group.filter);
                        if(groupRows.length===0) return null;
                        return (
                          <React.Fragment key={group.label}>
                            <tr>
                              <td colSpan={9} className="px-4 py-2.5 sticky left-0" style={{background:group.bg,borderTop:'1px solid #e5e7eb',borderBottom:'1px solid #e5e7eb'}}>
                                <div className="flex items-center gap-2">
                                  <span>{group.emoji}</span>
                                  <span className="text-xs font-black uppercase tracking-widest" style={{color:group.color}}>{group.label}</span>
                                  <span className="ml-auto text-xs font-bold text-gray-400">{groupRows.filter(r=>r.isCompleted).length}/{groupRows.length} selesai</span>
                                </div>
                              </td>
                            </tr>
                            {groupRows.map((row,idx)=>{
                              const allPts=Object.values(row.points).filter((p:any)=>p>0);
                              const maxRowPts=allPts.length>0?Math.max(...(allPts as number[])):0;
                              const isRowExpanded=expandedRow===row.rowKey;
                              const hasWinners=row.winners.length>0;
                              return (
                                <React.Fragment key={idx}>
                                  <motion.tr initial={{opacity:0}} animate={{opacity:1}} transition={{delay:idx*0.015}}
                                    onClick={() => { if(hasWinners) setExpandedRow(isRowExpanded ? null : row.rowKey); }}
                                    className={`group transition-colors ${hasWinners ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                    style={{borderBottom:'1px solid #f3f4f6',background:row.isCompleted?'rgba(240,253,244,0.5)':'white'}}>
                                    <td className="px-3 py-3 sticky left-0 z-10" style={{background:row.isCompleted?'rgba(240,253,244,0.95)':'white',width:'140px',maxWidth:'140px'}}>
                                      <div className="flex items-center gap-2">
                                        {row.isCompleted?<CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0"/>:<div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0"/>}
                                        <span className="text-[13px] md:text-sm font-bold text-gray-800 break-words leading-tight">{row.eventName}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      {row.category.includes('•')?<div><div className="text-sm font-bold text-gray-600 uppercase leading-tight">{row.category.split('•')[0].trim()}</div><div className="text-xs text-gray-400 uppercase">{row.category.split('•')[1].trim()}</div></div>:<span className="text-sm font-bold text-gray-500 uppercase">{row.category}</span>}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      {row.isCompleted?<span className="inline-flex items-center gap-1 text-xs font-black text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3"/>Selesai</span>:<span className="inline-flex items-center text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">Belum</span>}
                                    </td>
                                    {activeHouseIds(systemConfig).map(house=>{
                                      const pts=row.points[house]; const hs2=HS[house];
                                      const isWinner=pts>0&&pts===maxRowPts&&maxRowPts>0;
                                      return (
                                        <td key={house} className="py-3 text-center" style={{width:'60px',minWidth:'60px'}}>
                                          {pts>0?(
                                            <div className="relative inline-flex items-center justify-center">
                                              {isWinner&&<motion.div animate={{scale:[1,1.15,1]}} transition={{duration:2,repeat:Infinity}} className="absolute inset-0 rounded-xl" style={{background:hs2.hex,opacity:0.15,filter:'blur(4px)'}}/>}
                                              <div className="relative w-11 h-11 rounded-xl flex items-center justify-center text-base font-black border-2"
                                                style={{background:isWinner?hs2.hex:hs2.light,color:isWinner?'white':hs2.hex,borderColor:isWinner?hs2.hex:`${hs2.hex}40`,boxShadow:isWinner?`0 2px 12px ${hs2.glow}`:'none',transform:isWinner?'scale(1.05)':'scale(1)'}}>
                                                {pts}
                                              </div>
                                            </div>
                                          ):<span className="text-gray-300 text-base font-bold">—</span>}
                                        </td>
                                      );
                                    })}
                                  </motion.tr>
                                  <AnimatePresence>
                                    {isRowExpanded && hasWinners && (
                                      <tr>
                                        <td colSpan={9} className="p-0 border-b border-gray-100 bg-slate-50/80">
                                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="p-4 lg:pl-40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                              {row.winners.map((w: any, wIdx: number) => {
                                                const hConf = HS[w.house];
                                                return (
                                                  <div key={wIdx} className="bg-white rounded-lg p-3 shadow-sm border flex items-start gap-3" style={{borderColor: hConf.light}}>
                                                    <div className="w-8 h-8 rounded-full flex justify-center items-center font-black flex-shrink-0 text-white" style={{background: hConf.hex}}>{wIdx + 1}</div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{color: hConf.hex}}>{hConf.name}</div>
                                                      <div className="text-sm font-bold text-gray-800 leading-tight break-words">{w.name || 'Wakil Rumah'}</div>
                                                      <div className="text-xs text-gray-400 mt-0.5">{w.className || '-'}</div>
                                                      {w.teamMembers && w.teamMembers.length > 0 && (
                                                        <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-1">
                                                          {w.teamMembers.map((m: any, mI: number) => (
                                                            <div key={mI} className="text-[11px] text-gray-500 leading-tight truncate">{m.name} {m.className ? `(${m.className})` : ''}</div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        </td>
                                      </tr>
                                    )}
                                  </AnimatePresence>
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-20">
                      <tr className="bg-gray-900 border-t-2 border-gray-700">
                        <td className="px-4 py-4 sticky left-0 z-10 bg-gray-900" colSpan={3} style={{boxShadow:'4px 0 8px rgba(0,0,0,0.3)'}}>
                          <span className="text-base font-black text-yellow-400 uppercase tracking-widest">Jumlah Mata</span>
                        </td>
                        {activeHouseIds(systemConfig).map(house=>{
                          const total=stats.find(s=>s.house===house)?.totalPoints||0; const s=HS[house];
                          const isTop=stats.length>0&&total>0&&total===Math.max(...stats.map(x=>x.totalPoints));
                          return (
                            <td key={house} className="py-3 text-center" style={{width:'60px',minWidth:'60px'}}>
                              <div className="inline-flex flex-col items-center gap-0.5">
                                {isTop&&<span className="text-[8px] text-yellow-400 font-black">👑</span>}
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center border-2" style={{background:isTop?s.hex:`${s.hex}20`,borderColor:isTop?s.hex:`${s.hex}40`,boxShadow:isTop?`0 0 12px ${s.glow}`:'none'}}>
                                  <span className="text-base font-black" style={{color:isTop?'white':s.hex}}>{total}</span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB 3: SUKANTARA ══ */}
        {activeTab==='sukantara'&&(
          <div className="bg-gray-50 min-h-[600px] p-4 lg:p-6">
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg text-white"><Flag className="w-5 h-5"/></div>
                <div>
                  <h3 className="text-lg font-bold text-orange-900">Keputusan Sukantara</h3>
                  <p className="text-sm text-orange-700">Ringkasan kutipan mata keseluruhan bagi acara Sukantara</p>
                </div>
              </div>
              <div className="overflow-x-auto" style={{scrollbarWidth:'thin',WebkitOverflowScrolling:'touch'}}>
                <table className="w-full border-collapse text-sm" style={{minWidth:'600px'}}>
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="p-3 text-left font-black text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-30 border-r border-gray-200" style={{minWidth:'140px',width:'140px'}}>Acara / Kategori</th>
                      {activeHouseIds(systemConfig).map(house=>(
                        <th key={house} className="p-3 text-center border-r border-gray-100 last:border-0" style={{minWidth:'70px'}}>
                          <div className={`text-xs font-bold px-2 py-1.5 rounded inline-block shadow-sm ${HOUSE_CONFIG[house].color} text-white uppercase`}>{getHouseName(systemConfig, house)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {eventsMatrix.filter(r=>r.eventName.toLowerCase().includes('sukantara')).map((row,i)=>(
                      <tr key={i} className="hover:bg-orange-50/30 transition-colors">
                        <td className="p-3 border-r border-gray-100 sticky left-0 bg-white z-10">
                          <div className="font-bold text-sm text-gray-800 leading-tight">{row.eventName}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{row.category}</div>
                        </td>
                        {activeHouseIds(systemConfig).map(house=>(
                          <td key={house} className="p-3 text-center border-r border-gray-50 last:border-0">
                            {row.points[house]>0?(<div className="inline-flex w-8 h-8 rounded-lg items-center justify-center font-black text-gray-800 bg-slate-100 border border-slate-200">{row.points[house]}</div>):<span className="text-gray-300 font-medium">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50 border-t-2 border-orange-200 sticky bottom-0 z-20">
                    <tr>
                      <td className="p-4 font-black text-sm text-gray-800 uppercase tracking-wide border-r border-orange-200 sticky left-0 bg-orange-50 z-30">Jumlah Mata</td>
                      {activeHouseIds(systemConfig).map(house=>{
                        const sukEvents=eventsMatrix.filter(r=>r.eventName.toLowerCase().includes('sukantara'));
                        const houseTotal=sukEvents.reduce((sum,r)=>sum+(r.points[house]||0),0);
                        const isTop=Math.max(...activeHouseIds(systemConfig).map(h=>sukEvents.reduce((s,r)=>s+(r.points[h]||0),0)))===houseTotal&&houseTotal>0;
                        return (
                          <td key={house} className="p-4 text-center border-r border-orange-100 last:border-0">
                            <div className="inline-flex min-w-[3rem] px-2 py-1.5 rounded-lg items-center justify-center font-black text-base border-2"
                              style={{color:HS[house].hex,borderColor:isTop?HS[house].hex:'transparent',background:isTop?'white':'transparent',boxShadow:isTop?`0 2px 8px ${HS[house].glow}`:'none'}}>
                              {houseTotal}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ResultsList;
