import React, { useMemo, useState } from 'react';
import { Participant, HouseColor, Gender, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, activeHouseIds, getHouseName } from '../utils/systemConfig';
import { Search, Filter, Users, Calendar, LayoutGrid, Dumbbell, Printer, ChevronDown } from 'lucide-react';

interface ParticipantListProps {
  registrations: Record<string, Participant[]>;
  systemConfig?: SystemConfig;
}

interface GroupedEvent {
  uniqueKey: string;
  eventName: string;
  eventIdRaw: string;
  year: number;
  gender: Gender;
  participants: Array<{ name: string; className: string; house: HouseColor; }>;
}

const HOUSE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MERAH:  { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  BIRU:   { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  HIJAU:  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  KUNING: { bg: '#fef9c3', text: '#854d0e', border: '#eab308' },
  UNGU:   { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
  OREN:   { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
};

const SCHOOL_NAME = 'SK ORAN';
const SCHOOL_MOTTO = 'Berilmu, Berusaha, Berbakti';
const SCHOOL_LOGO = '/logo-sekolah-oran-transparent.png?v=2';
const EVENT_TITLE = 'Kejohanan Sukan Olahraga 2026';

const ParticipantList: React.FC<ParticipantListProps> = ({ registrations, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHouse, setFilterHouse] = useState<string>('SEMUA');
  const [filterYear, setFilterYear] = useState<string>('SEMUA');
  const [filterGender, setFilterGender] = useState<string>('SEMUA');
  const [filterEvent, setFilterEvent] = useState<string>('SEMUA');

  // Print settings
  const [printYears, setPrintYears] = useState<number[]>([1,2,3,4,5,6,0]);
  const [printGenders, setPrintGenders] = useState<string[]>([Gender.LELAKI, Gender.PEREMPUAN, Gender.CAMPURAN]);
  const [printEventsFilter, setPrintEventsFilter] = useState<string[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const groupedData = useMemo(() => {
    const groups: Record<string, GroupedEvent> = {};
    const allEvents = activeEvents(systemConfig);
    (Object.entries(registrations) as [string, Participant[]][]).forEach(([key, participants]) => {
      const parts = key.split('_');
      const house = parts[0] as HouseColor;
      const year = parseInt(parts[1]);
      const gender = parts[2] as Gender;
      const eventId = parts.slice(3).join('_');
      const groupKey = `${eventId}_${year}_${gender}`;
      if (!groups[groupKey]) {
        const eventDef = allEvents.find(e => e.id === eventId);
        groups[groupKey] = { uniqueKey: groupKey, eventName: eventDef ? eventDef.name : eventId, eventIdRaw: eventId, year, gender, participants: [] };
      }
      participants.forEach(p => {
        if (p && p.name && p.name.trim() !== '') {
          groups[groupKey].participants.push({ name: p.name, className: p.className, house });
        }
      });
    });
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
      return a.eventName.localeCompare(b.eventName);
    });
  }, [registrations, systemConfig]);

  const uniqueEventNames = useMemo(() => {
    const names = new Set<string>();
    groupedData.forEach(g => names.add(g.eventName));
    return Array.from(names).sort();
  }, [groupedData]);

  const availablePrintEventNames = useMemo(() => {
    let filtered = groupedData;
    if (printYears.length > 0) {
      filtered = filtered.filter(e => printYears.includes(e.year));
    }
    const n = new Set<string>();
    filtered.forEach(r => n.add(r.eventName));
    return Array.from(n).sort();
  }, [groupedData, printYears]);

  const filteredGroups = useMemo(() => {
    return groupedData.map(group => {
      let fp = group.participants;
      if (filterHouse !== 'SEMUA') fp = fp.filter(p => p.house === filterHouse);
      const q = searchQuery.toLowerCase();
      if (q && !group.eventName.toLowerCase().includes(q)) {
        fp = fp.filter(p => p.name.toLowerCase().includes(q) || p.className.toLowerCase().includes(q));
      }
      return { ...group, participants: fp };
    }).filter(g => {
      if (filterYear !== 'SEMUA' && g.year !== parseInt(filterYear)) return false;
      if (filterGender !== 'SEMUA' && g.gender !== filterGender) return false;
      if (filterEvent !== 'SEMUA' && g.eventName !== filterEvent) return false;
      return g.participants.length > 0;
    });
  }, [groupedData, filterHouse, filterYear, filterGender, filterEvent, searchQuery]);

  const totalParticipantsShown = filteredGroups.reduce((acc, g) => acc + g.participants.length, 0);

  // ── Kira berapa peserta akan dicetak ikut setting modal ──
  const printPreviewCount = useMemo(() => {
    let groups = groupedData;
    groups = groups.filter(g => printYears.includes(g.year));
    groups = groups.filter(g => printGenders.includes(g.gender));
    groups = groups.filter(g => printEventsFilter.includes(g.eventName));
    return groups.reduce((a, g) => a + g.participants.length, 0);
  }, [groupedData, printYears, printGenders, printEventsFilter]);

  // ── HTML Helpers ──────────────────────────────────────────────
  const genSchoolHeader = () => `
    <div style="position:relative;margin-bottom:14px;border-radius:10px;overflow:hidden;">
      <div style="background:#0f2544;padding:14px 20px 10px 20px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#ef4444 16.6%,#3b82f6 33.2%,#22c55e 49.8%,#eab308 66.4%,#a855f7 83%,#f97316 100%);"></div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:4px;">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.25);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <img src="${SCHOOL_LOGO}" style="width:56px;height:56px;object-fit:contain;" />
          </div>
          <div style="flex:1;">
            <div style="font-size:9px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:3px;">Kementerian Pendidikan Malaysia</div>
            <div style="font-size:19px;font-weight:900;color:#ffffff;text-transform:uppercase;letter-spacing:0.03em;line-height:1.1;">${SCHOOL_NAME}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
              <div style="width:18px;height:1px;background:#f59e0b;"></div>
              <div style="font-size:10px;color:#fbbf24;font-style:italic;font-weight:600;">${SCHOOL_MOTTO}</div>
              <div style="width:18px;height:1px;background:#f59e0b;"></div>
            </div>
          </div>
          <div style="flex-shrink:0;background:rgba(245,158,11,0.15);border:1.5px solid #f59e0b;border-radius:8px;padding:6px 12px;text-align:center;">
            <div style="font-size:9px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Edisi</div>
            <div style="font-size:20px;font-weight:900;color:#fbbf24;line-height:1;">2026</div>
          </div>
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;gap:8px;">
          <div style="width:3px;height:18px;background:linear-gradient(180deg,#f59e0b,#ef4444);border-radius:2px;flex-shrink:0;"></div>
          <div style="font-size:12px;font-weight:800;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.06em;">${EVENT_TITLE}</div>
          <div style="margin-left:auto;font-size:14px;">🏃🏅🏆</div>
        </div>
      </div>
      <div style="display:flex;height:4px;">
        <div style="flex:1;background:#ef4444;"></div><div style="flex:1;background:#3b82f6;"></div>
        <div style="flex:1;background:#22c55e;"></div><div style="flex:1;background:#eab308;"></div>
        <div style="flex:1;background:#a855f7;"></div><div style="flex:1;background:#f97316;"></div>
      </div>
    </div>`;

  const genEventTitle = (title: string, subtitle: string, total: number) => `
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:9px 14px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">${title}</div>
        <div style="font-size:10px;color:#bfdbfe;margin-top:1px;">${subtitle}</div>
      </div>
      <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:16px;padding:4px 10px;text-align:center;flex-shrink:0;">
        <div style="font-size:15px;font-weight:900;color:#fff;">${total}</div>
        <div style="font-size:8px;color:#bfdbfe;text-transform:uppercase;">Peserta</div>
      </div>
    </div>`;

  const genTable = (group: GroupedEvent, showSubTitle: boolean, titleOverride?: string) => {
    const rows = group.participants.map((p, idx) => {
      const hc = HOUSE_COLORS[p.house] || HOUSE_COLORS['BIRU'];
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `<tr style="background:${rowBg};">
        <td style="padding:5px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #f1f5f9;width:36px;">${idx + 1}</td>
        <td style="padding:5px 8px;font-weight:600;font-size:12px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${p.name}</td>
        <td style="padding:5px 8px;font-size:11px;color:#475569;border-bottom:1px solid #f1f5f9;width:130px;">${p.className || '-'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;width:80px;">
          <span style="display:inline-block;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${hc.bg};color:${hc.text};border:1px solid ${hc.border};">
            ${getHouseName(systemConfig, p.house)}
          </span>
        </td>
      </tr>`;
    }).join('');

    const subLabel = `${group.year === 0 ? 'Terbuka' : `Tahun ${group.year}`} &bull; ${group.gender === Gender.LELAKI ? 'Lelaki' : group.gender === Gender.PEREMPUAN ? 'Perempuan' : 'Campuran'}`;
    const displayTitle = titleOverride || group.eventName;
    const groupHeader = showSubTitle ? `
      <div style="background:#f1f5f9;padding:6px 12px;border-left:3px solid #3b82f6;">
        <div style="font-weight:700;font-size:12px;color:#1e293b;">${displayTitle}</div>
        <div style="font-size:10px;color:#64748b;">${subLabel} &mdash; ${group.participants.length} peserta</div>
      </div>` : '';

    return `
      <div style="page-break-inside:avoid;break-inside:avoid;margin-bottom:10px;">
        ${groupHeader}
        <div style="border:1px solid #e2e8f0;border-radius:${showSubTitle ? '0 0 6px 6px' : '6px'};overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#1e293b;">
                <th style="padding:6px 8px;text-align:left;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;width:36px;">No.</th>
                <th style="padding:6px 8px;text-align:left;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Nama</th>
                <th style="padding:6px 8px;text-align:left;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;width:130px;">Kelas</th>
                <th style="padding:6px 8px;text-align:left;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;width:80px;">Rumah</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  };

  const genFooter = (pageNum: number, totalPages: number) => `
    <div style="padding-top:8px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;margin-top:10px;">
      <div style="font-size:9px;color:#94a3b8;">${SCHOOL_NAME} &mdash; ${EVENT_TITLE}</div>
      <div style="font-size:9px;color:#94a3b8;">Dicetak: ${new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; Muka Surat ${pageNum} / ${totalPages}</div>
    </div>`;

  // ── HANDLE PRINT ──────────────────────────────────────────────
  const handlePrint = () => {
    // Tapis data mengikut setting print modal
    let sourceGroups = groupedData;
    sourceGroups = sourceGroups.filter(g => printYears.includes(g.year));
    sourceGroups = sourceGroups.filter(g => printGenders.includes(g.gender));
    sourceGroups = sourceGroups.filter(g => printEventsFilter.includes(g.eventName));

    type Page = { title: string; subtitle: string; groups: GroupedEvent[]; showSub: boolean; };
    const pages: Page[] = [];

    sourceGroups.forEach(g => {
      const sub = `${g.year === 0 ? 'Terbuka' : `Tahun ${g.year}`} \u2022 ${g.gender === Gender.LELAKI ? 'Lelaki' : g.gender === Gender.PEREMPUAN ? 'Perempuan' : 'Campuran'}`;
      pages.push({ title: g.eventName, subtitle: sub, groups: [g], showSub: false });
    });

    if (!pages.length) { alert('Sila pilih sekurang-kurangnya satu acara untuk dicetak (pastikan ia tidak kosong).'); return; }

    const totalPages = pages.length;
    const schoolHeader = genSchoolHeader();

    const allHTML = pages.map((p, idx) => {
      const pageBreak = idx > 0 ? 'page-break-before:always;break-before:page;' : '';
      const total = p.groups.reduce((a, g) => a + g.participants.length, 0);
      const tablesHTML = p.groups.map(g => genTable(g, p.showSub)).join('');
      return `
        <div style="width:210mm;min-height:50mm;padding:12mm 13mm 10mm 13mm;box-sizing:border-box;${pageBreak}">
          ${schoolHeader}
          ${genEventTitle(p.title, p.subtitle, total)}
          ${tablesHTML}
          ${genFooter(idx + 1, totalPages)}
        </div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { alert('Sila benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>Senarai Peserta</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;}
  @page{size:A4 portrait;margin:0;}
  @media print{
    body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
    thead{display:table-header-group;}
    tr{page-break-inside:avoid;break-inside:avoid;}
  }
</style>
</head><body>${allHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 800);
    setShowPrintModal(false);
  };

  // ── SELECT COMPONENT ──────────────────────────────────────────
  const SelectBox = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        <select
          className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-medium text-gray-700 appearance-none focus:border-blue-500 focus:outline-none pr-8"
          value={value} onChange={e => onChange(e.target.value)}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  const handleShowPrintModal = () => {
    setPrintEventsFilter(availablePrintEventNames);
    setShowPrintModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">

        {/* Header UI */}
        <div className="p-6 border-b border-gray-200 bg-slate-900 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><Users className="w-6 h-6 text-white" /></div>
              <div>
                <h2 className="text-2xl font-bold">Senarai Peserta</h2>
                <p className="text-blue-200 text-sm">Paparan senarai mengikut acara yang dipertandingkan</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Jumlah Peserta (Filtered)</div>
                <div className="text-xl font-bold">{totalParticipantsShown}</div>
              </div>
              <button onClick={handleShowPrintModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg">
                <Printer className="w-4 h-4" /> Cetak PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-800 p-4 rounded-lg">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Cari nama..." className="pl-10 w-full rounded bg-slate-700 border-slate-600 text-white placeholder-slate-400 text-sm p-2" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="relative">
              <LayoutGrid className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterHouse} onChange={e => setFilterHouse(e.target.value)}>
                <option value="SEMUA">Semua Rumah</option>
                {activeHouseIds(systemConfig).map(h => <option key={h} value={h}>{getHouseName(systemConfig, h)}</option>)}
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                <option value="SEMUA">Semua Tahun</option>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Tahun {y}</option>)}
              </select>
            </div>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                <option value="SEMUA">Semua Jantina</option>
                <option value={Gender.LELAKI}>Lelaki</option>
                <option value={Gender.PEREMPUAN}>Perempuan</option>
              </select>
            </div>
            <div className="relative">
              <Dumbbell className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select className="pl-10 w-full bg-slate-700 text-white text-sm border-slate-600 rounded p-2 appearance-none" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                <option value="SEMUA">Semua Acara</option>
                {uniqueEventNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-gray-50 min-h-[500px] p-6">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Filter className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">Tiada acara dijumpai dengan tapisan ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGroups.map(group => (
                <div key={group.uniqueKey} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-slate-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{group.eventName}</h3>
                      <div className="text-sm text-gray-500 font-medium uppercase tracking-wide mt-1">
                        {group.year === 0 ? 'Terbuka' : `Tahun ${group.year}`} • {group.gender === Gender.LELAKI ? 'Lelaki' : group.gender === Gender.PEREMPUAN ? 'Perempuan' : 'Campuran'}
                      </div>
                    </div>
                    <span className="bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{group.participants.length} Peserta</span>
                  </div>
                  {/* MOBILE: Card layout */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {group.participants.map((p, idx) => {
                      const hc = HOUSE_COLORS[p.house] || HOUSE_COLORS['BIRU'];
                      return (
                        <div key={idx} className="flex flex-col gap-2 px-3 py-3 hover:bg-blue-50 transition-colors w-full">
                          <div className="flex items-start gap-2.5 sm:gap-3 text-sm">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 mt-0.5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="font-semibold text-gray-800 leading-snug break-words hyphens-auto overflow-hidden text-sm sm:text-base">{p.name || '-'}</div>
                              <div className="text-xs text-gray-400 mt-1">{p.className || '-'}</div>
                            </div>
                            <span style={{ background: hc.bg, color: hc.text, border: `1px solid ${hc.border}` }}
                              className="flex-shrink-0 px-1.5 sm:px-2 py-0.5 rounded-[4px] text-[10px] whitespace-nowrap mt-0.5 tracking-wide font-black">
                              {getHouseName(systemConfig, p.house)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* DESKTOP: Table layout */}
                  <div className="hidden md:block">
                    <table className="w-full divide-y divide-gray-100 table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-16">No.</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-2/5">Nama</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Kelas</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-32">Rumah</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {group.participants.map((p, idx) => {
                          const hc = HOUSE_COLORS[p.house] || HOUSE_COLORS['BIRU'];
                          return (
                            <tr key={idx} className="hover:bg-blue-50 transition-colors">
                              <td className="px-6 py-3 text-sm text-gray-400 font-mono">{idx + 1}</td>
                              <td className="px-6 py-3 text-sm font-semibold text-gray-800 break-words">{p.name}</td>
                              <td className="px-6 py-3 text-sm text-gray-500 break-words">{p.className || '-'}</td>
                              <td className="px-6 py-3">
                                <span style={{ background: hc.bg, color: hc.text, border: `1px solid ${hc.border}` }}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold">
                                  {getHouseName(systemConfig, p.house)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL CETAK ── */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl"><Printer className="w-5 h-5 text-white" /></div>
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

              {/* Preview count */}
              <div className={`rounded-lg p-4 border ${printPreviewCount > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`font-bold text-sm ${printPreviewCount > 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {printPreviewCount > 0 ? '✅' : '⚠️'} Anggaran Cetakan
                </div>
                <div className={`text-xs mt-1 ${printPreviewCount > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {printPreviewCount > 0
                    ? `${printPreviewCount} peserta akan dicetak`
                    : 'Tiada peserta dengan pilihan ini. Sila tukar pilihan.'}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setShowPrintModal(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">Batal</button>
                <button onClick={handlePrint} disabled={printPreviewCount === 0}
                  className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg ${printPreviewCount > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  <Printer className="w-4 h-4" /> Cetak Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantList;
