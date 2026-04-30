import React, { useMemo, useState, useRef } from 'react';
import { Participant, HouseColor, Gender, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, activeHouseIds, getHouseName } from '../utils/systemConfig';
import { Printer, Settings, ChevronDown, ChevronUp, Trophy, Users, AlertCircle, RotateCcw, Eye, Flag } from 'lucide-react';

interface CompetitionFormProps {
  registrations: Record<string, Participant[]>;
  systemConfig?: SystemConfig;
}

const SCHOOL_NAME = 'SK ORAN';
const SCHOOL_LOGO = '/logo-sekolah-oran-transparent.png?v=2';
const EVENT_TITLE = 'Kejohanan Sukan Olahraga 2026';
const HOUSE_COLORS: Record<string, string> = {
  MERAH: '#ef4444', BIRU: '#3b82f6', HIJAU: '#22c55e',
  KUNING: '#eab308', UNGU: '#a855f7', OREN: '#f97316',
};
const LARIAN_INDIVIDU = ['80m', '100m', '200m', '80m Lari Berpagar'];
const LARIAN_RELAY = ['4x80m', '4x100m', '4x200m'];
const LOMPAT_TINGGI_EVT = ['Lompat Tinggi'];

type FormType = 'larian_individu' | 'larian_relay' | 'padang_ukuran' | 'lompat_tinggi';

function getFormType(name: string): FormType {
  if (LARIAN_INDIVIDU.includes(name)) return 'larian_individu';
  if (LARIAN_RELAY.includes(name)) return 'larian_relay';
  if (LOMPAT_TINGGI_EVT.includes(name)) return 'lompat_tinggi';
  return 'padang_ukuran';
}

interface Peserta { name: string; className: string; house: HouseColor; }
interface GroupedEvent {
  uniqueKey: string; eventName: string; eventIdRaw: string;
  year: number; gender: Gender; participants: Peserta[];
}
interface SaringanState {
  groups: Peserta[][];
  results: Record<number, number[]>;
  finalists: Peserta[];
}
interface PrintSettings {
  orientation: 'portrait' | 'landscape';
  saringanMode: 'semua' | 'satu';
  activeSaringan: number;
  pesertaPerSaringan: number;
  showResults: boolean;
  peringkat: string;
  chiefJudge: string;
  judges: string[];
  marginT: number;
  marginB: number;
  marginL: number;
  marginR: number;
}

const CompetitionForm: React.FC<CompetitionFormProps> = ({ registrations, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const houseOrder = activeHouseIds(systemConfig);
  const houseLabel = (house: HouseColor | string) => getHouseName(systemConfig, house);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [activeTab, setActiveTab] = useState<'saringan'|'akhir'|'lorong'|'urutan'|'settings'>('settings');
  const [saringanStates, setSaringanStates] = useState<Record<string, SaringanState>>({});
  const [relayLanes, setRelayLanes] = useState<Record<string, string[]>>({});
  const [padangHouseOrders, setPadangHouseOrders] = useState<Record<string, string[]>>({});
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    orientation: 'portrait', saringanMode: 'semua', activeSaringan: 0,
    pesertaPerSaringan: 8, showResults: true, peringkat: 'Akhir',
    chiefJudge: '', judges: ['', '', ''],
    marginT: 8, marginB: 5, marginL: 4, marginR: 4,
  });
  const [expandedSection, setExpandedSection] = useState<string | null>('saringan_0');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBlankModal, setShowBlankModal] = useState(false);
  const [blankSelections, setBlankSelections] = useState<Record<string, {selected: boolean; orientation: 'portrait'|'landscape'}>>({});
  const [bulkSelections, setBulkSelections] = useState<Record<string, {selected: boolean; orientation: 'portrait'|'landscape'}>>({});
  const printRef = useRef<HTMLDivElement>(null);

  // ── Per-acara padang house order helpers ──
  const getPadangOrder = (key?: string): string[] => {
    const k = key || selectedGroup?.uniqueKey;
    if (!k) return [...houseOrder];
    return padangHouseOrders[k] || [...houseOrder];
  };
  const setPadangOrder = (newOrder: string[], key?: string) => {
    const k = key || selectedGroup?.uniqueKey;
    if (!k) return;
    setPadangHouseOrders(prev => ({ ...prev, [k]: newOrder }));
  };

  const TAHAP1_ORDER = ['80m', 'Lompat Jauh', 'Lontar Peluru', '4x80m'];
  const TAHAP2_ORDER = ['100m', '200m', '80m Lari Berpagar', 'Lompat Jauh', 'Lontar Peluru', 'Lompat Tinggi', 'Merejam Lembing', '4x100m', '4x200m'];
  const GENDER_ORDER = ['L', 'P'];

  const getEvRank = (name: string, year: number) => {
    const list = year <= 3 ? TAHAP1_ORDER : TAHAP2_ORDER;
    const i = list.indexOf(name);
    return i >= 0 ? i : 99;
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, GroupedEvent> = {};
    const allEvents = activeEvents(systemConfig).filter(event => !event.years.includes(0));
    (Object.entries(registrations) as [string, Participant[]][]).forEach(([key, participants]) => {
      const parts = key.split('_');
      const house = parts[0] as HouseColor;
      const year = parseInt(parts[1]);
      const gender = parts[2] as Gender;
      const eventId = parts.slice(3).join('_');
      const gk = `${eventId}_${year}_${gender}`;
      if (!groups[gk]) {
        const def = allEvents.find(e => e.id === eventId);
        groups[gk] = { uniqueKey: gk, eventName: def?.name || eventId, eventIdRaw: eventId, year, gender, participants: [] };
      }
      participants.forEach(p => { if (p?.name?.trim()) groups[gk].participants.push({ name: p.name, className: p.className, house }); });
    });
    return Object.values(groups).sort((a, b) => {
      const tahapA = a.year <= 3 ? 0 : 1;
      const tahapB = b.year <= 3 ? 0 : 1;
      if (tahapA !== tahapB) return tahapA - tahapB;
      const evA = getEvRank(a.eventName, a.year);
      const evB = getEvRank(b.eventName, b.year);
      if (evA !== evB) return evA - evB;
      if (a.year !== b.year) return a.year - b.year;
      return GENDER_ORDER.indexOf(a.gender) - GENDER_ORDER.indexOf(b.gender);
    });
  }, [registrations]);

  const selectedGroup = groupedData.find(g => g.uniqueKey === selectedEvent);
  const formType = selectedGroup ? getFormType(selectedGroup.eventName) : 'larian_individu';

  React.useEffect(() => {
    if (!selectedGroup) return;
    const key = selectedGroup.uniqueKey;
    if (!saringanStates[key]) {
      const pps = printSettings.pesertaPerSaringan;
      const all = [...selectedGroup.participants];
      const groups: Peserta[][] = [];
      for (let i = 0; i < all.length; i += pps) groups.push(all.slice(i, i + pps));
      if (groups.length === 0) groups.push([]);
      setSaringanStates(prev => ({ ...prev, [key]: { groups, results: {}, finalists: [] } }));
    }
    if (!relayLanes[key]) {
      setRelayLanes(prev => ({ ...prev, [key]: [...houseOrder] }));
    }
    if (!padangHouseOrders[key]) {
      setPadangHouseOrders(prev => ({ ...prev, [key]: [...houseOrder] }));
    }
  }, [selectedEvent, selectedGroup]);

  const getSaringan = (): SaringanState | null => {
    if (!selectedGroup) return null;
    return saringanStates[selectedGroup.uniqueKey] || null;
  };

  const swapPeserta = (saringanIdx: number, fromIdx: number, toIdx: number) => {
    if (!selectedGroup) return;
    setSaringanStates(prev => {
      const key = selectedGroup.uniqueKey;
      const state = { ...prev[key] };
      const groups = state.groups.map(g => [...g]);
      const group = groups[saringanIdx];
      if (toIdx >= 0 && toIdx < group.length && fromIdx !== toIdx) [group[fromIdx], group[toIdx]] = [group[toIdx], group[fromIdx]];
      groups[saringanIdx] = group;
      return { ...prev, [key]: { ...state, groups } };
    });
  };

  const rebuildSaringan = (mode: 'auto'|'satu_rumah' = 'auto') => {
    if (!selectedGroup) return;
    const key = selectedGroup.uniqueKey;
    const pps = printSettings.pesertaPerSaringan;
    const all = selectedGroup.participants;
    let groups: Peserta[][] = [];

    if (mode === 'satu_rumah') {
      // Satu saringan = satu wakil setiap rumah
      // Kumpul peserta ikut rumah
      const byHouse: Record<string, Peserta[]> = {};
      all.forEach(p => { if (!byHouse[p.house]) byHouse[p.house] = []; byHouse[p.house].push(p); });
      const maxPerHouse = Math.max(...Object.values(byHouse).map(a => a.length), 0);
      // Setiap saringan ambil satu dari setiap rumah
      for (let slot = 0; slot < maxPerHouse; slot++) {
        const saringan: Peserta[] = [];
        houseOrder.forEach(h => {
          const list = byHouse[h] || [];
          if (slot < list.length) saringan.push(list[slot]);
        });
        if (saringan.length > 0) groups.push(saringan);
      }
    } else {
      for (let i = 0; i < all.length; i += pps) groups.push(all.slice(i, i + pps));
    }

    if (groups.length === 0) groups.push([]);
    setSaringanStates(prev => ({ ...prev, [key]: { groups, results: {}, finalists: [] } }));
  };

  // ── Auto generate kedudukan lorong (shuffle) ──────────────────
  const shuffleLorong = (saringanIdx?: number) => {
    if (!selectedGroup) return;
    const key = selectedGroup.uniqueKey;

    // Pre-generate shuffled arrays BEFORE setState to avoid closure issues
    setSaringanStates(prev => {
      const st = prev[key];
      if (!st) return prev;
      const groups = st.groups.map((g, si) => {
        // Kalau ada saringanIdx, hanya shuffle saringan itu sahaja — biarkan lain
        if (saringanIdx !== undefined && si !== saringanIdx) return g;
        // Fisher-Yates — copy array dulu supaya independent
        const arr = [...g];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
      });
      return { ...prev, [key]: { ...st, groups } };
    });
  };

  const setPosition = (saringanIdx: number, pesertaIdx: number, position: number) => {
    if (!selectedGroup) return;
    setSaringanStates(prev => {
      const key = selectedGroup.uniqueKey;
      const state = { ...prev[key] };
      const results = { ...state.results };
      const current = [...(results[saringanIdx] || [])];
      const filtered = current.filter(p => p !== pesertaIdx);
      const clean = filtered.filter((_, i) => i !== position - 1);
      clean.splice(position - 1, 0, pesertaIdx);
      results[saringanIdx] = clean;
      return { ...prev, [key]: { ...state, results } };
    });
  };

  const swapLane = (fromIdx: number, toIdx: number) => {
    if (!selectedGroup) return;
    const key = selectedGroup.uniqueKey;
    setRelayLanes(prev => {
      const lanes = [...(prev[key] || [...houseOrder])];
      if (toIdx >= 0 && toIdx < lanes.length) [lanes[fromIdx], lanes[toIdx]] = [lanes[toIdx], lanes[fromIdx]];
      return { ...prev, [key]: lanes };
    });
  };

  // Move house up/down — per acara
  const moveHouse = (from: number, to: number) => {
    const o = [...getPadangOrder()];
    [o[from], o[to]] = [o[to], o[from]];
    setPadangOrder(o);
  };

  const swapHouseTo = (from: number, to: number) => {
    if (from === to) return;
    const o = [...getPadangOrder()];
    [o[from], o[to]] = [o[to], o[from]];
    setPadangOrder(o);
  };

  // Build HTML for each page
  const buildPage = (g: GroupedEvent, isBlank: boolean = false): string => {
    const ft = getFormType(g.eventName);
    const ori = bulkSelections[g.uniqueKey]?.orientation || 'portrait';
    const isL = ori === 'landscape';
    const gLabel = g.gender === 'L' ? 'LELAKI' : 'PEREMPUAN';
    const yearLabel = `TAHUN ${g.year}`;

    const hdrHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;border-bottom:3px solid #000;padding-bottom:8px;">
        <img src="${SCHOOL_LOGO}" style="width:56px;height:56px;object-fit:contain;"/>
        <div style="flex:1;text-align:center;">
          <div style="font-size:14px;font-weight:900;text-transform:uppercase;">${EVENT_TITLE}</div>
          <div style="font-size:12px;font-weight:bold;text-transform:uppercase;margin-top:2px;">${SCHOOL_NAME}</div>
          <div style="font-size:11px;font-weight:bold;margin-top:3px;background:#1e293b;color:white;padding:2px 10px;display:inline-block;border-radius:4px;">
            ${ft==='larian_individu'?'BORANG HAKIM — LARIAN':ft==='larian_relay'?'BORANG HAKIM — RELAY':ft==='lompat_tinggi'?'BORANG HAKIM — LOMPAT TINGGI':'BORANG HAKIM — ACARA PADANG'}
          </div>
        </div>
        <img src="${SCHOOL_LOGO}" style="width:56px;height:56px;visibility:hidden;"/>
      </div>
      <div style="display:flex;gap:20px;margin-bottom:8px;font-size:11px;border:1px solid #e2e8f0;background:#f8fafc;padding:5px 10px;border-radius:4px;">
        <span><strong>ACARA:</strong> ${g.eventName.toUpperCase()}</span>
        <span><strong>KATEGORI:</strong> ${yearLabel} (${gLabel})</span>
        <span><strong>PERINGKAT:</strong> ${printSettings.peringkat}</span>
      </div>`;

    const footerHTML = `
      <div style="margin-top:14px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;display:flex;gap:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <div style="margin-bottom:20px;">Ketua Hakim: <strong>${printSettings.chiefJudge||'___________________________'}</strong></div>
          <div>Tandatangan: ____________________</div>
        </div>
        <div style="flex:1;min-width:120px;">
          <div style="margin-bottom:20px;">Tarikh: _______________</div>
          <div>Masa: _______________</div>
        </div>
      </div>`;

    let bodyHTML = '';

    if (ft === 'larian_individu') {
      const savedState = saringanStates[g.uniqueKey];
      const grps = isBlank ? [[]] : (savedState?.groups || [g.participants]);
      const totalR = grps.reduce((s, grp) => s + Math.max(grp.length,1), 0);
      const est = 80 + 25 + (totalR * 26) + (grps.length * 28) + 60;
      const sf = est > 900 ? (900/est) : 1;
      const sc = sf < 1 ? `transform:scale(${sf.toFixed(3)});transform-origin:top left;width:${(100/sf).toFixed(1)}%;` : '';
      const tables = grps.map((grp, gi) => `
        <div style="margin-top:${gi>0?'8px':'0'};">
          <div style="background:#1e3a5f;color:white;padding:2px 8px;border-radius:2px 2px 0 0;font-size:9px;font-weight:900;display:inline-block;">▶ SARINGAN ${gi+1} | ${grp.length} Peserta</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:24px;background:#e8e8e8;">BIL</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:30px;background:#e8e8e8;">LORONG</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;text-align:left;background:#e8e8e8;">NAMA PESERTA</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:70px;background:#e8e8e8;">KELAS</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:55px;background:#e8e8e8;">RUMAH</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:80px;background:#e8e8e8;">MASA</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:65px;background:#e8e8e8;">KEDUDUKAN</th>
            </tr></thead>
            <tbody>
              ${Array.from({length: Math.max(grp.length, printSettings.pesertaPerSaringan)}).map((_,i) => {
                const p = grp[i];
                return `<tr style="height:26px;">
                  <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
                  <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
                  <td style="border:1px solid #000;padding-left:5px;font-size:9px;text-align:left;">${p?p.name.toUpperCase():''}</td>
                  <td style="border:1px solid #000;text-align:center;font-size:9px;">${p?p.className:''}</td>
                  <td style="border:1px solid #000;text-align:center;font-size:9px;">${p?p.house:''}</td>
                  <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`).join('');
      bodyHTML = `<div style="${sc}">${tables}</div>`;

    } else if (ft === 'larian_relay') {
      const lanes = relayLanes[g.uniqueKey] || [...houseOrder];
      const byH: Record<string,Peserta[]> = {};
      if (!isBlank) g.participants.forEach(p => { if (!byH[p.house]) byH[p.house]=[]; byH[p.house].push(p); });
      bodyHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;width:24px;" rowspan="2">BIL</th>
          <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;width:28px;" rowspan="2">LORONG</th>
          <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;text-align:left;" rowspan="2">PASUKAN</th>
          <th colspan="4" style="border:1px solid #000;background:#e8e8e8;font-size:9px;">PELARI</th>
          <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;" rowspan="2">MASA</th>
          <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;" rowspan="2">KEDUDUKAN</th>
        </tr>
        <tr>${[1,2,3,4].map(n=>`<th style="border:1px solid #000;background:#e8e8e8;font-size:9px;">PELARI ${n}</th>`).join('')}</tr>
        </thead><tbody>
        ${lanes.map((h,i) => {
          const team = byH[h]||[];
          return `<tr style="height:30px;">
            <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
            <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
            <td style="border:1px solid #000;padding-left:5px;font-size:9px;font-weight:bold;">${houseLabel(h)}</td>
            ${[0,1,2,3].map(ri=>`<td style="border:1px solid #000;padding-left:3px;font-size:8px;">${team[ri]?team[ri].name.toUpperCase():''}</td>`).join('')}
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
          </tr>`;
        }).join('')}
        </tbody></table>`;

    } else {
      // Padang / Lompat Tinggi
      const activeOrd = (padangHouseOrders[g.uniqueKey] || [...houseOrder]);
      const byH2: Record<string,Peserta[]> = {};
      if (!isBlank) g.participants.forEach(p => { if (!byH2[p.house]) byH2[p.house]=[]; byH2[p.house].push(p); });
      const maxPH = Math.max(...activeOrd.map(h=>(byH2[h]||[]).length),1);
      const ord2: (Peserta|null)[] = [];
      for (let i=0; i<maxPH; i++) activeOrd.forEach(h=>ord2.push((byH2[h]||[])[i]||null));
      while (ord2.length < 18) ord2.push(null);
      const pH = isL ? 680 : 940;
      const est2 = 80+25+40+(ord2.length*28)+60;
      const sf2 = est2>pH ? +(pH/est2).toFixed(4) : 1;
      const sc2 = sf2<1 ? `transform:scale(${sf2});transform-origin:top left;width:${(100/sf2).toFixed(2)}%;` : '';
      const pW = isL?42:36; const nW = isL?100:85;

      if (ft === 'lompat_tinggi') {
        const NG=6; const pW4=isL?26:22;
        bodyHTML = `<div style="${sc2}"><table style="table-layout:fixed;width:100%;border-collapse:collapse;">
          <colgroup><col style="width:20px"/><col style="width:32px"/><col style="width:${nW}px"/><col style="width:42px"/>
            ${Array.from({length:NG*3},()=>`<col style="width:${pW4}px"/>`).join('')}<col style="width:38px"/></colgroup>
          <thead><tr>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">BIL</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">RUMAH</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;text-align:left;" rowspan="2">NAMA PESERTA</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">KELAS</th>
            ${Array.from({length:NG},()=>`<th colspan="3" style="border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;font-size:7px;"></th>`).join('')}
            <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">KDK</th>
          </tr>
          <tr>${Array.from({length:NG*3},(_,i)=>`<th style="border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;font-size:7px;padding-bottom:2px;">${(i%3)+1}</th>`).join('')}</tr>
          </thead><tbody>
          ${ord2.map((p,i)=>`<tr style="height:26px;">
            <td style="border:1px solid #000;font-size:7px;text-align:center;">${i+1}.</td>
            <td style="border:1px solid #000;font-size:7px;text-align:center;font-weight:bold;">${isBlank ? "" : (p?houseLabel(p.house).toUpperCase():houseLabel(activeOrd[i%activeOrd.length]).toUpperCase())}</td>
            <td style="border:1px solid #000;font-size:7px;padding-left:3px;word-wrap:break-word;white-space:normal;">${p?p.name.toUpperCase():''}</td>
            <td style="border:1px solid #000;font-size:7px;text-align:center;">${p?p.className:''}</td>
            ${Array.from({length:NG*3},()=>`<td style="border:1px solid #000;"></td>`).join('')}
            <td style="border:1px solid #000;"></td>
          </tr>`).join('')}
          </tbody></table>
          <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">TANDATANGAN HAKIM,</div><div>………………………………….</div><div style="margin-top:3px">(${printSettings.chiefJudge||''})</div></div>
            <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">DISAHKAN OLEH,</div><div>………………………………….</div><div style="margin-top:3px">()</div></div>
          </div></div>`;
      } else {
        bodyHTML = `<div style="${sc2}"><table style="table-layout:fixed;width:100%;border-collapse:collapse;">
          <colgroup><col style="width:20px"/><col style="width:32px"/><col style="width:${nW}px"/><col style="width:46px"/>
            ${[1,2,3].map(()=>`<col style="width:${pW}px"/>`).join('')}<col style="width:38px"/>
            ${[1,2,3].map(()=>`<col style="width:${pW}px"/>`).join('')}<col style="width:38px"/></colgroup>
          <thead><tr>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;" rowspan="2">BIL</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;" rowspan="2">RUMAH</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;text-align:left;padding:2px;" rowspan="2">NAMA PESERTA</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;" rowspan="2">KELAS</th>
            <th colspan="3" style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;">PERCUBAAN</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;" rowspan="2">KDK</th>
            <th colspan="3" style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;">PERCUBAAN</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;" rowspan="2">KDK</th>
          </tr>
          <tr>${[1,2,3,4,5,6].map(n=>`<th style="border:1px solid #000;background:#e8e8e8;font-size:8px;padding:2px;">${n}</th>`).join('')}</tr>
          </thead><tbody>
          ${ord2.map((p,i)=>`<tr style="height:28px;">
            <td style="border:1px solid #000;font-size:8px;text-align:center;">${i+1}.</td>
            <td style="border:1px solid #000;font-size:8px;text-align:center;font-weight:bold;">${isBlank ? "" : (p?houseLabel(p.house).toUpperCase():houseLabel(activeOrd[i%activeOrd.length]).toUpperCase())}</td>
            <td style="border:1px solid #000;font-size:8px;padding-left:3px;word-wrap:break-word;white-space:normal;">${p?p.name.toUpperCase():''}</td>
            <td style="border:1px solid #000;font-size:8px;text-align:center;">${p?p.className:''}</td>
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
          </tr>`).join('')}
          </tbody></table>
          <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">TANDATANGAN HAKIM,</div><div>………………………………….</div><div style="margin-top:3px">(${printSettings.chiefJudge||''})</div></div>
            <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">DISAHKAN OLEH,</div><div>………………………………….</div><div style="margin-top:3px">()</div></div>
          </div></div>`;
      }
    }

    // Wrap in page with EXPLICIT margin via padding — reliable across all browsers
    const size = isL ? '297mm 210mm' : '210mm 297mm';
    return `<div style="width:${isL?'297mm':'210mm'};min-height:${isL?'210mm':'297mm'};padding:${printSettings.marginT}mm ${printSettings.marginR}mm ${printSettings.marginB}mm ${printSettings.marginL}mm;box-sizing:border-box;page-break-after:always;">
      ${hdrHTML}${bodyHTML}${ft!=='lompat_tinggi'&&ft!=='padang_ukuran'?footerHTML:''}
    </div>`;
  };

  const handleBlankPrint = () => {
    if (groupedData.length === 0) { alert('Tiada data peserta.'); return; }
    const init: Record<string, {selected: boolean; orientation: 'portrait'|'landscape'}> = {};
    groupedData.forEach(g => {
      const ft = getFormType(g.eventName);
      const defaultO: 'portrait'|'landscape' = (ft === 'larian_individu' || ft === 'larian_relay') ? 'portrait' : 'landscape';
      init[g.uniqueKey] = { selected: true, orientation: defaultO };
    });
    setBlankSelections(prev => {
      const merged = { ...init };
      Object.keys(init).forEach(k => {
        if (prev[k] !== undefined) merged[k] = { selected: true, orientation: prev[k].orientation };
      });
      return merged;
    });
    setShowBlankModal(true);
  };

  const executeBlankBulkPrint = () => {
    const selected = groupedData.filter(g => blankSelections[g.uniqueKey]?.selected);
    if (selected.length === 0) { alert('Pilih sekurang-kurangnya satu acara.'); return; }

    const portraitCount = selected.filter(g=>(blankSelections[g.uniqueKey]?.orientation||'portrait')==='portrait').length;
    const dominantSize = portraitCount >= selected.length/2 ? 'A4 portrait' : 'A4 landscape';

    // Guna buildPage yang sama dengan cetak pukal, cuma isBlank=true
    // Perlu set bulkSelections sementara supaya buildPage dapat orientation yang betul
    const prevBulk = { ...bulkSelections };
    // Override bulkSelections dengan blankSelections untuk buildPage
    const tempSelections: typeof bulkSelections = {};
    selected.forEach(g => {
      tempSelections[g.uniqueKey] = blankSelections[g.uniqueKey] || { selected: true, orientation: 'portrait' };
    });
    // buildPage uses bulkSelections for orientation - we pass directly via closure trick
    // Instead, build HTML directly using same structure as executeBulkPrint but isBlank=true
    const allHTML = selected.map(g => {
      const ori = blankSelections[g.uniqueKey]?.orientation || 'portrait';
      const isL = ori === 'landscape';
      const mT = printSettings.marginT; const mR = printSettings.marginR;
      const mB = printSettings.marginB; const mL = printSettings.marginL;
      const ft = getFormType(g.eventName);
      const gLabel = g.gender === 'L' ? 'LELAKI' : 'PEREMPUAN';

      const hdrHTML = `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;border-bottom:3px solid #000;padding-bottom:8px;">
          <img src="${SCHOOL_LOGO}" style="width:56px;height:56px;object-fit:contain;"/>
          <div style="flex:1;text-align:center;">
            <div style="font-size:14px;font-weight:900;text-transform:uppercase;">${EVENT_TITLE}</div>
            <div style="font-size:12px;font-weight:bold;text-transform:uppercase;margin-top:2px;">${SCHOOL_NAME}</div>
            <div style="font-size:11px;font-weight:bold;margin-top:3px;background:#1e293b;color:white;padding:2px 10px;display:inline-block;border-radius:4px;">
              ${ft==='larian_individu'?'BORANG HAKIM — LARIAN':ft==='larian_relay'?'BORANG HAKIM — RELAY':ft==='lompat_tinggi'?'BORANG HAKIM — LOMPAT TINGGI':'BORANG HAKIM — ACARA PADANG'}
            </div>
          </div>
          <img src="${SCHOOL_LOGO}" style="width:56px;height:56px;visibility:hidden;"/>
        </div>
        <div style="display:flex;gap:20px;margin-bottom:8px;font-size:11px;border:1px solid #e2e8f0;background:#f8fafc;padding:5px 10px;border-radius:4px;">
          <span><strong>ACARA:</strong> ${g.eventName.toUpperCase()}</span>
          <span><strong>KATEGORI:</strong> TAHUN ${g.year} (${gLabel})</span>
          <span><strong>PERINGKAT:</strong> ${printSettings.peringkat}</span>
        </div>`;

      const footerHTML = `
        <div style="margin-top:14px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;display:flex;gap:20px;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <div style="margin-bottom:20px;">Ketua Hakim: <strong>${printSettings.chiefJudge||'___________________________'}</strong></div>
            <div>Tandatangan: ____________________</div>
          </div>
          <div style="flex:1;min-width:120px;">
            <div style="margin-bottom:20px;">Tarikh: _______________</div>
            <div>Masa: _______________</div>
          </div>
        </div>`;

      let bodyHTML = '';

      if (ft === 'larian_individu') {
        const rows = printSettings.pesertaPerSaringan;
        bodyHTML = `<div>
          <div style="background:#1e3a5f;color:white;padding:2px 8px;border-radius:2px 2px 0 0;font-size:9px;font-weight:900;display:inline-block;">▶ SARINGAN 1 | ${rows} Peserta</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:24px;background:#e8e8e8;">BIL</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:30px;background:#e8e8e8;">LORONG</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;text-align:left;background:#e8e8e8;">NAMA PESERTA</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:70px;background:#e8e8e8;">KELAS</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:55px;background:#e8e8e8;">RUMAH</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:80px;background:#e8e8e8;">MASA</th>
              <th style="border:1px solid #000;padding:2px 4px;font-size:9px;width:65px;background:#e8e8e8;">KEDUDUKAN</th>
            </tr></thead>
            <tbody>
              ${Array.from({length:rows}).map((_,i)=>`<tr style="height:26px;">
                <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
                <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
                <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

      } else if (ft === 'larian_relay') {
        bodyHTML = `<table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;width:24px;" rowspan="2">BIL</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;width:28px;" rowspan="2">LORONG</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;text-align:left;" rowspan="2">PASUKAN</th>
            <th colspan="4" style="border:1px solid #000;background:#e8e8e8;font-size:9px;">PELARI</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;" rowspan="2">MASA</th>
            <th style="border:1px solid #000;background:#e8e8e8;font-size:9px;" rowspan="2">KEDUDUKAN</th>
          </tr>
          <tr>${[1,2,3,4].map(n=>`<th style="border:1px solid #000;background:#e8e8e8;font-size:9px;">PELARI ${n}</th>`).join('')}</tr>
          </thead><tbody>
          ${Array.from({length:6}).map((_,i)=>`<tr style="height:30px;">
            <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
            <td style="border:1px solid #000;text-align:center;font-size:9px;">${i+1}</td>
            <td style="border:1px solid #000;padding-left:5px;font-size:9px;font-weight:bold;"></td>
            ${[0,1,2,3].map(()=>`<td style="border:1px solid #000;"></td>`).join('')}
            <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
          </tr>`).join('')}
          </tbody></table>`;

      } else {
        const nRows = 18;
        const pW = isL?42:36; const nW = isL?100:85;
        if (ft === 'lompat_tinggi') {
          const NG=6; const pW4=isL?26:22;
          bodyHTML = `<table style="table-layout:fixed;width:100%;border-collapse:collapse;">
            <colgroup><col style="width:20px"/><col style="width:32px"/><col style="width:${nW}px"/><col style="width:42px"/>
              ${Array.from({length:NG*3},()=>`<col style="width:${pW4}px"/>`).join('')}<col style="width:38px"/></colgroup>
            <thead><tr>
              <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">BIL</th>
              <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">RUMAH</th>
              <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;text-align:left;" rowspan="2">NAMA PESERTA</th>
              <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">KELAS</th>
              ${Array.from({length:NG},()=>`<th colspan="3" style="border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;font-size:7px;"></th>`).join('')}
              <th style="border:1px solid #000;background:#e8e8e8;font-size:7px;" rowspan="2">KDK</th>
            </tr>
            <tr>${Array.from({length:NG*3},(_,i)=>`<th style="border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;font-size:7px;padding-bottom:2px;">${(i%3)+1}</th>`).join('')}</tr>
            </thead><tbody>
            ${Array.from({length:nRows}).map((_,i)=>`<tr style="height:26px;">
              <td style="border:1px solid #000;font-size:7px;text-align:center;">${i+1}.</td>
              <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
              ${Array.from({length:NG*3},()=>`<td style="border:1px solid #000;"></td>`).join('')}
              <td style="border:1px solid #000;"></td>
            </tr>`).join('')}
            </tbody></table>
            <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:10px;">
              <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">TANDATANGAN HAKIM,</div><div>………………………………….</div></div>
              <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">DISAHKAN OLEH,</div><div>………………………………….</div></div>
            </div>`;
        } else {
          const percColW = isL?44:38; const nameColW = isL?110:90;
          bodyHTML = `<table style="table-layout:fixed;width:100%;border-collapse:collapse;">
            <colgroup><col style="width:22px"/><col style="width:34px"/><col style="width:${nameColW}px"/><col style="width:50px"/>
              <col style="width:${percColW}px"/><col style="width:${percColW}px"/><col style="width:${percColW}px"/>
              <col style="width:42px"/>
              <col style="width:${percColW}px"/><col style="width:${percColW}px"/><col style="width:${percColW}px"/>
              <col style="width:42px"/></colgroup>
            <thead><tr>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">BIL</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">RUMAH<br/>SUKAN</th>
              <th style="text-align:left;font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 4px;" rowspan="2">NAMA PESERTA</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KELAS</th>
              <th colspan="3" style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;">PERCUBAAN</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KEDU-<br/>DUKAN</th>
              <th colspan="3" style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;">PERCUBAAN</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KEDU-<br/>DUKAN</th>
            </tr>
            <tr>${[1,2,3,4,5,6].map(n=>`<th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:2px;">${n}</th>`).join('')}</tr>
            </thead><tbody>
            ${Array.from({length:nRows}).map((_,i)=>`<tr style="height:30px;">
              <td style="font-size:9px;border:1px solid #000;text-align:center;vertical-align:middle;">${i+1}.</td>
              <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
              <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
              <td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td>
            </tr>`).join('')}
            </tbody></table>
            <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:10px;">
              <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">TANDATANGAN HAKIM,</div><div>………………………………….</div></div>
              <div style="text-align:center;min-width:180px"><div style="font-weight:bold;margin-bottom:25px">DISAHKAN OLEH,</div><div>………………………………….</div></div>
            </div>`;
        }
      }

      return `<div style="width:${isL?'297mm':'210mm'};min-height:${isL?'210mm':'297mm'};padding:${mT}mm ${mR}mm ${mB}mm ${mL}mm;box-sizing:border-box;page-break-after:always;">
        ${hdrHTML}${bodyHTML}${ft!=='lompat_tinggi'&&ft!=='padang_ukuran'?footerHTML:''}
      </div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Borang Kosong</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:11px;background:white;color:black; }
  @page { size:${dominantSize}; margin:0; }
  @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
</style></head><body>${allHTML}</body></html>`);
    win.document.close();
    setTimeout(()=>win.print(), 800);
    setShowBlankModal(false);
  };

  // ── CETAK PUKAL — semua acara sekaligus ──────────────────────
  const handleBulkPrint = () => {
    if (groupedData.length === 0) { alert('Tiada data peserta.'); return; }
    // Init selections with defaults
    const init: Record<string, {selected: boolean; orientation: 'portrait'|'landscape'}> = {};
    groupedData.forEach(g => {
      const ft = getFormType(g.eventName);
      const defaultO: 'portrait'|'landscape' = (ft === 'larian_individu' || ft === 'larian_relay') ? 'portrait' : 'landscape';
      init[g.uniqueKey] = { selected: true, orientation: defaultO };
    });
    setBulkSelections(prev => {
      const merged: Record<string, {selected: boolean; orientation: 'portrait'|'landscape'}> = { ...init };
      // Kekal pilihan orientation user yang lama, tapi SEMUA selected by default setiap kali buka
      Object.keys(init).forEach(k => {
        if (prev[k] !== undefined) {
          merged[k] = { selected: true, orientation: prev[k].orientation };
        }
      });
      return merged;
    });
    setShowBulkModal(true);
  };

  const executeBulkPrint = () => {
    if (groupedData.length === 0) { alert('Tiada data peserta.'); return; }
    const selected = groupedData.filter(g => bulkSelections[g.uniqueKey]?.selected);
    if (selected.length === 0) { alert('Pilih sekurang-kurangnya satu acara.'); return; }

    const mT = printSettings.marginT;
    const mR = printSettings.marginR;
    const mB = printSettings.marginB;
    const mL = printSettings.marginL;


    const allHTML = selected.map(g => buildPage(g)).join('');

    // Determine dominant orientation for @page size
    const portraitCount = selected.filter(g=>(bulkSelections[g.uniqueKey]?.orientation||'portrait')==='portrait').length;
    const dominantSize = portraitCount >= selected.length/2 ? 'A4 portrait' : 'A4 landscape';

    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Borang Pukal</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:11px;background:white;color:black; }
  @page { size:${dominantSize}; margin:0; }
  @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
</style></head><body>${allHTML}</body></html>`);
    win.document.close();
    setTimeout(()=>win.print(), 800);
    setShowBulkModal(false);
  };

  // Keep old handleBulkPrint2 for single group
  const handleBulkPrint_single = () => {
    if (groupedData.length === 0) { alert('Tiada data peserta.'); return; }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const isPortrait = printSettings.orientation === 'portrait';
    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Borang Pertandingan</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; background: white; color: black; }
  @page { size: A4 ${isPortrait ? 'portrait' : 'landscape'}; margin: ${printSettings.marginT}mm ${printSettings.marginR}mm ${printSettings.marginB}mm ${printSettings.marginL}mm; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th,td { border:1px solid #000; padding:3px 5px; text-align:center; font-size:11px; }
  th { background:#e8e8e8; font-weight:bold; }
  td.left { text-align:left; }
  .tall-row td { height:${printSettings.saringanMode === 'semua' ? '28px' : '36px'}; }
  .page-break { page-break-after: always; break-after: page; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const state = getSaringan();
  const saringanCount = state?.groups.length || 0;
  const genderLabel = selectedGroup?.gender === 'L' ? 'LELAKI' : 'PEREMPUAN';

  const printHeader = (tajuk: string) => `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;border-bottom:3px solid #000;padding-bottom:8px;">
      <img src="${SCHOOL_LOGO}" style="width:64px;height:64px;object-fit:contain;"/>
      <div style="flex:1;text-align:center;">
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${EVENT_TITLE}</div>
        <div style="font-size:13px;font-weight:bold;text-transform:uppercase;margin-top:2px;">${SCHOOL_NAME}</div>
        <div style="font-size:12px;font-weight:bold;margin-top:3px;background:#1e293b;color:white;padding:3px 10px;display:inline-block;border-radius:4px;">${tajuk}</div>
      </div>
      <img src="${SCHOOL_LOGO}" style="width:64px;height:64px;object-fit:contain;visibility:hidden;"/>
    </div>`;

  const printEventInfo = (extra = '') => `
    <div style="display:flex;gap:20px;margin-bottom:8px;font-size:11px;flex-wrap:wrap;border:1px solid #e2e8f0;background:#f8fafc;padding:6px 10px;border-radius:4px;">
      <span><strong>ACARA:</strong> ${selectedGroup?.eventName.toUpperCase()}</span>
      <span><strong>KATEGORI:</strong> Tahun ${selectedGroup?.year} (${genderLabel})</span>
      <span><strong>PERINGKAT:</strong> ${printSettings.peringkat}</span>
      ${extra}
    </div>`;

  const printFooter = () => `
    <div style="margin-top:18px;padding-top:10px;border-top:1px solid #ccc;font-size:11px;">
      <div style="display:flex;gap:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;">
          <div style="margin-bottom:24px;">Ketua Hakim: <strong>${printSettings.chiefJudge || '___________________________'}</strong></div>
          <div>Tandatangan: ____________________</div>
        </div>
        ${printSettings.judges.filter(n => n.trim()).map((n, i) => `
          <div style="flex:1;min-width:160px;">
            <div style="margin-bottom:24px;">Hakim ${i + 1}: <strong>${n}</strong></div>
            <div>Tandatangan: ____________________</div>
          </div>`).join('')}
        <div style="flex:1;min-width:120px;">
          <div style="margin-bottom:24px;">Tarikh: _______________</div>
          <div>Masa: _______________</div>
        </div>
      </div>
    </div>`;

  const printSaringanTable = (group: Peserta[], saringanIdx: number, showResults: boolean) => {
    const positions = state?.results[saringanIdx] || [];
    const rows = printSettings.saringanMode === 'semua' ? Math.max(group.length, 1) : Math.max(group.length, printSettings.pesertaPerSaringan);
    return `
      <table>
        <thead>
          <tr>
            <th style="width:30px">BIL</th>
            <th style="width:38px">LORONG</th>
            <th style="text-align:left">NAMA PESERTA</th>
            <th style="width:80px">KELAS</th>
            <th style="width:70px">RUMAH</th>
            <th style="width:100px">MASA</th>
            <th style="width:80px">KEDUDUKAN</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: rows }).map((_, i) => {
            const p = group[i];
            const pos = positions.indexOf(i) + 1;
            return `<tr class="tall-row">
              <td>${i + 1}</td><td>${i + 1}</td>
              <td style="text-align:left;padding-left:8px">${p ? p.name.toUpperCase() : ''}</td>
              <td>${p ? p.className : ''}</td>
              <td>${p ? p.house : ''}</td>
              <td></td>
              <td>${showResults && pos > 0 ? `<strong>${pos}</strong>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  };

  const buildPrintContent = () => {
    if (!selectedGroup) return '';
    const ftype = formType;

    if (ftype === 'larian_individu') {
      if (!state) return '';
      if (printSettings.saringanMode === 'satu' && printSettings.activeSaringan === -1) {
        const fins = state.finalists;
        const finTable = `<table>
          <thead><tr>
            <th style="width:30px">BIL</th><th style="width:38px">LORONG</th>
            <th style="text-align:left">NAMA PESERTA</th>
            <th style="width:80px">KELAS</th><th style="width:70px">RUMAH</th>
            <th style="width:100px">MASA</th><th style="width:80px">KEDUDUKAN</th>
          </tr></thead>
          <tbody>
            ${fins.map((p, i) => `<tr class="tall-row">
              <td>${i+1}</td><td>${i+1}</td>
              <td style="text-align:left;padding-left:8px">${p.name.toUpperCase()}</td>
              <td>${p.className||''}</td><td>${p.house}</td><td></td><td></td>
            </tr>`).join('')}
            ${fins.length < 8 ? Array.from({length: 8 - fins.length}, (_,i) => `<tr class="tall-row">
              <td>${fins.length+i+1}</td><td>${fins.length+i+1}</td>
              <td></td><td></td><td></td><td></td><td></td>
            </tr>`).join('') : ''}
          </tbody></table>`;
        return `<div>${printHeader('KEPUTUSAN RASMI — PERINGKAT AKHIR')}${printEventInfo()}<div style="margin-top:8px">${finTable}</div>${printFooter()}</div>`;
      }
      if (printSettings.saringanMode === 'satu') {
        const idx = printSettings.activeSaringan;
        const group = state.groups[idx] || [];
        return `<div>${printHeader('KEPUTUSAN RASMI')}${printEventInfo(`<span><strong>SARINGAN:</strong> ${idx + 1} / ${state.groups.length}</span>`)}${printSaringanTable(group, idx, printSettings.showResults)}${printFooter()}</div>`;
      }
      const totalRows = state.groups.reduce((sum, g) => sum + Math.max(g.length, 1), 0);
      const estimatedPx = 80 + 30 + (totalRows * 28) + (state.groups.length * 30) + 70;
      const pageHeightPx = 960;
      const scaleFactor = estimatedPx > pageHeightPx ? (pageHeightPx / estimatedPx) : 1;
      const scaleStyle = scaleFactor < 1 ? `transform:scale(${scaleFactor.toFixed(3)});transform-origin:top left;width:${(100/scaleFactor).toFixed(1)}%;` : '';
      return `
        <div style="${scaleStyle}">
          ${printHeader('KEPUTUSAN RASMI')}
          ${printEventInfo(`<span><strong>JUMLAH SARINGAN:</strong> ${state.groups.length}</span>`)}
          ${state.groups.map((group, idx) => `
            <div style="margin-top:${idx > 0 ? '10px' : '0'};">
              <div style="background:#1e3a5f;color:white;padding:3px 10px;border-radius:3px 3px 0 0;font-size:10px;font-weight:900;display:inline-block;">
                ▶ SARINGAN ${idx + 1} &nbsp;|&nbsp; ${group.length} Peserta
              </div>
              ${printSaringanTable(group, idx, printSettings.showResults)}
            </div>`).join('')}
          ${printFooter()}
        </div>`;
    }

    if (ftype === 'larian_relay') {
      const lanes = relayLanes[selectedGroup.uniqueKey] || [...houseOrder];
      const byHouse: Record<string, Peserta[]> = {};
      selectedGroup.participants.forEach(p => { if (!byHouse[p.house]) byHouse[p.house] = []; byHouse[p.house].push(p); });
      return `
        <div>
          ${printHeader('KEPUTUSAN RASMI — LARIAN BERGANTI-GANTI')}
          ${printEventInfo()}
          <table>
            <thead>
              <tr>
                <th style="width:30px" rowspan="2">BIL</th>
                <th style="width:35px" rowspan="2">LORONG</th>
                <th style="width:150px;text-align:left" rowspan="2">PASUKAN</th>
                <th colspan="4">PELARI</th>
                <th style="width:100px" rowspan="2">MASA</th>
                <th style="width:70px" rowspan="2">KEDUDUKAN</th>
              </tr>
              <tr>${[1,2,3,4].map(n=>`<th>PELARI ${n}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${lanes.map((h, i) => {
                const team = byHouse[h] || [];
                return `<tr class="tall-row">
                  <td>${i+1}</td><td>${i+1}</td>
                  <td style="text-align:left;padding-left:6px;font-weight:bold">${houseLabel(h)}</td>
                  ${[0,1,2,3].map(ri=>`<td style="text-align:left;padding-left:4px;font-size:10px">${team[ri]?team[ri].name.toUpperCase():''}</td>`).join('')}
                  <td></td><td></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${printFooter()}
        </div>`;
    }

    // ── PADANG / LOMPAT TINGGI — guna padangHouseOrder ──
    const activeOrder = getPadangOrder();
    const byHouse: Record<string, Peserta[]> = {};
    selectedGroup.participants.forEach(p => { if (!byHouse[p.house]) byHouse[p.house] = []; byHouse[p.house].push(p); });
    const maxPerHouse = Math.max(...activeOrder.map(h => (byHouse[h]||[]).length), 1);
    const ordered: (Peserta|null)[] = [];
    for (let i = 0; i < maxPerHouse; i++) activeOrder.forEach(h => ordered.push((byHouse[h]||[])[i]||null));
    const rows = Math.max(ordered.length, 18);
    while (ordered.length < rows) ordered.push(null);
    const tajuk = ftype === 'lompat_tinggi' ? 'BORANG HAKIM — LOMPAT TINGGI' : 'BORANG HAKIM — ACARA PADANG';

    // ── LOMPAT TINGGI — format khusus: banyak column ketinggian ──
    if (ftype === 'lompat_tinggi') {
      const numRowsLT = ordered.length;
      const isLandscapeLT = printSettings.orientation === 'landscape';
      const pageHLT = isLandscapeLT ? 690 : 950;
      // 6 kumpulan ketinggian × 3 percubaan = 18 column + BIL+RUMAH+NAMA+KELAS+KEDUDUKAN
      // Anggaran: header 80px, info 25px, thead 44px, row 28px, footer 60px
      const estHLT = 80 + 25 + 44 + (numRowsLT * 28) + 60;
      const sfLT = estHLT > pageHLT ? +(pageHLT / estHLT).toFixed(4) : 1;
      const scaleLT = sfLT < 1 ? `transform:scale(${sfLT});transform-origin:top left;width:${(100/sfLT).toFixed(2)}%;` : '';
      const NUM_HT_GROUPS = 6; // 6 kumpulan ketinggian
      // Column sizing: BIL+RUMAH+NAMA+KELAS + 18col percubaan + KEDUDUKAN
      // Nama kecil supaya percubaan dapat lebih ruang
      const nameW = isLandscapeLT ? 100 : 80;
      const percW = isLandscapeLT ? 28 : 24; // lebar setiap percubaan

      return `
        <div style="${scaleLT}">
          ${printHeader('BORANG HAKIM — LOMPAT TINGGI')}
          ${printEventInfo()}
          <table style="table-layout:fixed;width:100%;border-collapse:collapse;">
            <colgroup>
              <col style="width:22px"/>
              <col style="width:36px"/>
              <col style="width:${nameW}px"/>
              <col style="width:46px"/>
              ${Array.from({length: NUM_HT_GROUPS * 3}, () => `<col style="width:${percW}px"/>`).join('')}
              <col style="width:44px"/>
            </colgroup>
            <thead>
              <tr>
                <th style="font-size:8px;border:1px solid #000;background:#e8e8e8;" rowspan="2">BIL</th>
                <th style="font-size:8px;border:1px solid #000;background:#e8e8e8;" rowspan="2">RUMAH<br/>SUKAN</th>
                <th style="font-size:8px;border:1px solid #000;background:#e8e8e8;text-align:left;" rowspan="2">NAMA PESERTA</th>
                <th style="font-size:8px;border:1px solid #000;background:#e8e8e8;" rowspan="2">KELAS</th>
                ${Array.from({length: NUM_HT_GROUPS}, (_,g) => `<th colspan="3" style="font-size:8px;border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;padding-bottom:3px;"></th>`).join('')}
                <th style="font-size:8px;border:1px solid #000;background:#e8e8e8;" rowspan="2">KEDU-<br/>DUKAN</th>
              </tr>
              <tr>
                ${Array.from({length: NUM_HT_GROUPS * 3}, (_,i) => `<th style="font-size:8px;border:1px solid #000;background:#e8e8e8;height:32px;vertical-align:bottom;padding-bottom:3px;">${(i%3)+1}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${ordered.map((p, i) => `
                <tr style="height:28px;">
                  <td style="font-size:8px;border:1px solid #000;text-align:center;vertical-align:middle;">${i+1}.</td>
                  <td style="font-size:8px;border:1px solid #000;text-align:center;vertical-align:middle;font-weight:bold;">${p?houseLabel(p.house).toUpperCase():houseLabel(activeOrder[i%activeOrder.length]).toUpperCase()}</td>
                  <td style="font-size:8px;border:1px solid #000;text-align:left;padding:2px 4px;vertical-align:middle;word-wrap:break-word;white-space:normal;overflow-wrap:break-word;">${p?p.name.toUpperCase():''}</td>
                  <td style="font-size:8px;border:1px solid #000;text-align:center;vertical-align:middle;">${p?p.className:''}</td>
                  ${Array.from({length: NUM_HT_GROUPS * 3}, () => `<td style="border:1px solid #000;"></td>`).join('')}
                  <td style="border:1px solid #000;"></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="text-align:center;min-width:180px">
              <div style="font-weight:bold;margin-bottom:25px">TANDATANGAN HAKIM,</div>
              <div>…………………………………….</div>
              <div style="margin-top:3px">(${printSettings.chiefJudge||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'})</div>
            </div>
            <div style="text-align:center;min-width:180px">
              <div style="font-weight:bold;margin-bottom:25px">DISAHKAN OLEH,</div>
              <div>…………………………………….</div>
              <div style="margin-top:3px">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
            </div>
          </div>
        </div>`;
    }

    // ── PADANG UKURAN (Lompat Jauh, Lontar Peluru, Merejam Lembing, dll) ──
    const numRows = ordered.length;
    const isLandscape = printSettings.orientation === 'landscape';
    const pageH = isLandscape ? 690 : 950;
    // row 30px supaya hakim ada ruang tulis jarak
    const estH = 80 + 25 + 42 + (numRows * 30) + 65;
    const sf = estH > pageH ? +(pageH / estH).toFixed(4) : 1;
    const scaleDiv = sf < 1 ? `transform:scale(${sf});transform-origin:top left;width:${(100/sf).toFixed(2)}%;` : '';
    // Column percubaan lebih besar: 38px portrait, 44px landscape
    const percColW = isLandscape ? 44 : 38;
    // Column nama kecil: 90px portrait, 110px landscape — nama wrap bila perlu
    const nameColWP = isLandscape ? 110 : 90;

    return `
      <div style="${scaleDiv}">
        ${printHeader('BORANG HAKIM — ACARA PADANG')}
        ${printEventInfo()}
        <table style="table-layout:fixed;width:100%;border-collapse:collapse;">
          <colgroup>
            <col style="width:22px"/>
            <col style="width:34px"/>
            <col style="width:${nameColWP}px"/>
            <col style="width:50px"/>
            <col style="width:${percColW}px"/><col style="width:${percColW}px"/><col style="width:${percColW}px"/>
            <col style="width:42px"/>
            <col style="width:${percColW}px"/><col style="width:${percColW}px"/><col style="width:${percColW}px"/>
            <col style="width:42px"/>
          </colgroup>
          <thead>
            <tr>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">BIL</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">RUMAH<br/>SUKAN</th>
              <th style="text-align:left;font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 4px;" rowspan="2">NAMA PESERTA</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KELAS</th>
              <th colspan="3" style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;">PERCUBAAN</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KEDU-<br/>DUKAN</th>
              <th colspan="3" style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;">PERCUBAAN</th>
              <th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:3px 1px;" rowspan="2">KEDU-<br/>DUKAN</th>
            </tr>
            <tr>
              ${[1,2,3,4,5,6].map(n=>`<th style="font-size:9px;border:1px solid #000;background:#e8e8e8;padding:2px;">${n}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${ordered.map((p, i) => `
              <tr style="height:30px;">
                <td style="font-size:9px;border:1px solid #000;text-align:center;vertical-align:middle;">${i+1}.</td>
                <td style="font-size:9px;border:1px solid #000;text-align:center;vertical-align:middle;font-weight:bold;">${p?houseLabel(p.house).toUpperCase():houseLabel(activeOrder[i%activeOrder.length]).toUpperCase()}</td>
                <td style="font-size:9px;border:1px solid #000;text-align:left;padding:2px 4px;vertical-align:middle;word-wrap:break-word;white-space:normal;overflow-wrap:break-word;">${p?p.name.toUpperCase():''}</td>
                <td style="font-size:9px;border:1px solid #000;text-align:center;vertical-align:middle;">${p?p.className:''}</td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
                <td style="border:1px solid #000;"></td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:10px;">
          <div style="text-align:center;min-width:180px">
            <div style="font-weight:bold;margin-bottom:28px">TANDATANGAN HAKIM,</div>
            <div>…………………………………….</div>
            <div style="margin-top:3px">(${printSettings.chiefJudge||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'})</div>
          </div>
          <div style="text-align:center;min-width:180px">
            <div style="font-weight:bold;margin-bottom:28px">DISAHKAN OLEH,</div>
            <div>…………………………………….</div>
            <div style="margin-top:3px">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          </div>
        </div>
      </div>`;
  };

  const tabStyle = (t: string) => `flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === t ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-700'}`;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5">

      {/* ── BULK PRINT MODAL ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="p-2 bg-yellow-500 rounded-xl"><Printer className="w-5 h-5 text-slate-900"/></div>
              <div className="flex-1">
                <h3 className="text-white font-black text-base">Cetak Borang Pukal</h3>
                <p className="text-slate-400 text-xs">Pilih acara & orientasi untuk setiap borang</p>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setBulkSelections(prev=>{const n={...prev};Object.keys(n).forEach(k=>n[k]={...n[k],selected:true});return n;})}
                  className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10">Pilih Semua</button>
                <button onClick={()=>setBulkSelections(prev=>{const n={...prev};Object.keys(n).forEach(k=>n[k]={...n[k],selected:false});return n;})}
                  className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10">Nyahpilih</button>
              </div>
            </div>
            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[
                {label:'TAHAP 1', years:[1,2,3], color:'#3b82f6'},
                {label:'TAHAP 2', years:[4,5,6], color:'#8b5cf6'},
              ].map(tahap => {
                const tahapG = groupedData.filter(g => tahap.years.includes(g.year));
                if (!tahapG.length) return null;
                const byName: Record<string, typeof tahapG> = {};
                tahapG.forEach(g => { if (!byName[g.eventName]) byName[g.eventName]=[]; byName[g.eventName].push(g); });
                return (
                  <div key={tahap.label}>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{color:tahap.color}}>{tahap.label}</div>
                    {Object.entries(byName).map(([evName, evList]) => {
                      const ft = getFormType(evName);
                      const typeIcon = ft==='larian_individu'?'🏃':ft==='larian_relay'?'🔄':ft==='lompat_tinggi'?'🏅':'🎯';
                      return (
                        <div key={evName} className="mb-2 border border-gray-200 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-black text-gray-700">{typeIcon} {evName}</span>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {evList.map(g => {
                              const sel = bulkSelections[g.uniqueKey] || {selected:true, orientation:'portrait'};
                              const gLabel = g.gender==='L'?'Lelaki':'Perempuan';
                              return (
                                <div key={g.uniqueKey} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${sel.selected?'bg-white':'bg-gray-50'}`}>
                                  <button onClick={()=>setBulkSelections(prev=>({...prev,[g.uniqueKey]:{...sel,selected:!sel.selected}}))}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel.selected?'border-blue-600 bg-blue-600':'border-gray-300 bg-white'}`}>
                                    {sel.selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                                  </button>
                                  <div className="flex-1">
                                    <span className={`text-sm font-bold ${sel.selected?'text-gray-800':'text-gray-400'}`}>Tahun {g.year} · {gLabel}</span>
                                    <span className="text-[10px] text-gray-400 ml-2">({g.participants.length} peserta)</span>
                                  </div>
                                  {sel.selected && (
                                    <div className="flex gap-1 flex-shrink-0">
                                      {(['portrait','landscape'] as const).map(o => (
                                        <button key={o} onClick={()=>setBulkSelections(prev=>({...prev,[g.uniqueKey]:{...sel,orientation:o}}))}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all ${sel.orientation===o?'border-blue-600 bg-blue-50 text-blue-700':'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                          <div className={`border border-current rounded-sm ${o==='portrait'?'w-2.5 h-3.5':'w-3.5 h-2.5'}`}/>
                                          {o==='portrait'?'Menegak':'Melintang'}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div className="border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="px-6 py-3 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs font-black text-gray-600 uppercase tracking-wider flex-shrink-0">Margin (mm):</span>
                  {([{label:'Atas',key:'marginT'},{label:'Bawah',key:'marginB'},{label:'Kiri',key:'marginL'},{label:'Kanan',key:'marginR'}] as const).map(m => (
                    <div key={m.key} className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-gray-500">{m.label}</label>
                      <input type="number" min="0" max="30"
                        value={printSettings[m.key as keyof PrintSettings] as number}
                        onChange={e=>setPrintSettings(p=>({...p,[m.key]:parseInt(e.target.value)||0}))}
                        className="w-14 px-2 py-1 border-2 border-gray-200 rounded-lg text-xs font-bold text-center focus:border-yellow-400 outline-none bg-white"/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold">
                  {Object.values(bulkSelections).filter((s:any)=>s.selected).length} acara dipilih
                </span>
                <div className="flex gap-3">
                  <button onClick={()=>setShowBulkModal(false)}
                    className="px-5 py-2.5 rounded-xl border-2 border-gray-200 font-black text-gray-600 hover:bg-gray-100 text-sm">Batal</button>
                  <button onClick={executeBulkPrint}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-white transition-all hover:-translate-y-0.5 shadow-lg"
                    style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 4px 12px rgba(245,158,11,0.4)'}}>
                    <Printer className="w-4 h-4"/>Cetak Sekarang
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BLANK PRINT MODAL ── */}
      {showBlankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="p-2 bg-white rounded-xl"><Printer className="w-5 h-5 text-slate-900"/></div>
              <div className="flex-1">
                <h3 className="text-white font-black text-base">Cetak Borang Kosong</h3>
                <p className="text-slate-400 text-xs">Pilih acara & orientasi — borang tanpa nama peserta</p>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setBlankSelections(prev=>{const n={...prev};Object.keys(n).forEach(k=>n[k]={...n[k],selected:true});return n;})}
                  className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10">Pilih Semua</button>
                <button onClick={()=>setBlankSelections(prev=>{const n={...prev};Object.keys(n).forEach(k=>n[k]={...n[k],selected:false});return n;})}
                  className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10">Nyahpilih</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[
                {label:'TAHAP 1', years:[1,2,3], color:'#3b82f6'},
                {label:'TAHAP 2', years:[4,5,6], color:'#8b5cf6'},
              ].map(tahap => {
                const tahapG = groupedData.filter(g => tahap.years.includes(g.year));
                if (!tahapG.length) return null;
                const byName: Record<string, typeof tahapG> = {};
                tahapG.forEach(g => { if (!byName[g.eventName]) byName[g.eventName]=[]; byName[g.eventName].push(g); });
                return (
                  <div key={tahap.label}>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{color:tahap.color}}>{tahap.label}</div>
                    {Object.entries(byName).map(([evName, evList]) => {
                      const ft = getFormType(evName);
                      const typeIcon = ft==='larian_individu'?'🏃':ft==='larian_relay'?'🔄':ft==='lompat_tinggi'?'🏅':'🎯';
                      return (
                        <div key={evName} className="mb-2 border border-gray-200 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-black text-gray-700">{typeIcon} {evName}</span>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {evList.map(g => {
                              const sel = blankSelections[g.uniqueKey] || {selected:true, orientation:'portrait'};
                              const gLabel = g.gender==='L'?'Lelaki':'Perempuan';
                              return (
                                <div key={g.uniqueKey} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${sel.selected?'bg-white':'bg-gray-50'}`}>
                                  <button onClick={()=>setBlankSelections(prev=>({...prev,[g.uniqueKey]:{...sel,selected:!sel.selected}}))}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel.selected?'border-blue-600 bg-blue-600':'border-gray-300 bg-white'}`}>
                                    {sel.selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                                  </button>
                                  <div className="flex-1">
                                    <span className={`text-sm font-bold ${sel.selected?'text-gray-800':'text-gray-400'}`}>Tahun {g.year} · {gLabel}</span>
                                  </div>
                                  {sel.selected && (
                                    <div className="flex gap-1 flex-shrink-0">
                                      {(['portrait','landscape'] as const).map(o => (
                                        <button key={o} onClick={()=>setBlankSelections(prev=>({...prev,[g.uniqueKey]:{...sel,orientation:o}}))}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all ${sel.orientation===o?'border-blue-600 bg-blue-50 text-blue-700':'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                          <div className={`border border-current rounded-sm ${o==='portrait'?'w-2.5 h-3.5':'w-3.5 h-2.5'}`}/>
                                          {o==='portrait'?'Menegak':'Melintang'}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="px-6 py-3 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs font-black text-gray-600 uppercase tracking-wider flex-shrink-0">Margin (mm):</span>
                  {([{label:'Atas',key:'marginT'},{label:'Bawah',key:'marginB'},{label:'Kiri',key:'marginL'},{label:'Kanan',key:'marginR'}] as const).map(m => (
                    <div key={m.key} className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-gray-500">{m.label}</label>
                      <input type="number" min="0" max="30"
                        value={printSettings[m.key as keyof PrintSettings] as number}
                        onChange={e=>setPrintSettings(p=>({...p,[m.key]:parseInt(e.target.value)||0}))}
                        className="w-14 px-2 py-1 border-2 border-gray-200 rounded-lg text-xs font-bold text-center focus:border-blue-400 outline-none bg-white"/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold">{Object.values(blankSelections).filter((s:any)=>s.selected).length} acara dipilih</span>
                <div className="flex gap-3">
                  <button onClick={()=>setShowBlankModal(false)}
                    className="px-5 py-2.5 rounded-xl border-2 border-gray-200 font-black text-gray-600 hover:bg-gray-100 text-sm">Batal</button>
                  <button onClick={executeBlankBulkPrint}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-white transition-all hover:-translate-y-0.5 shadow-lg bg-slate-800 hover:bg-slate-700">
                    <Printer className="w-4 h-4"/>Cetak Borang Kosong
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl"><Printer className="w-5 h-5 text-white"/></div>
          <div>
            <h2 className="text-white font-black text-lg">Jana Borang Pertandingan</h2>
            <p className="text-slate-400 text-xs">Susun saringan, tentukan keputusan & cetak borang rasmi</p>
          </div>
          {groupedData.length > 0 && (
            <>
              <button onClick={handleBulkPrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-white transition-all hover:-translate-y-0.5 flex-shrink-0"
                style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 4px 12px rgba(245,158,11,0.35)'}}>
                <Printer className="w-4 h-4"/>Cetak Semua Pukal
              </button>
              <button onClick={handleBlankPrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-slate-700 bg-white hover:bg-gray-50 transition-all hover:-translate-y-0.5 border-2 border-slate-200 flex-shrink-0">
                <Printer className="w-4 h-4"/>Cetak Borang Kosong
              </button>
            </>
          )}
        </div>
        <div className="p-4 space-y-2">
          {/* ── Senarai acara dalam baris ── */}
          {[
            { label: 'TAHAP 1', years: [1,2,3], color: '#3b82f6' },
            { label: 'TAHAP 2', years: [4,5,6], color: '#8b5cf6' },
          ].map(tahap => {
            const tahapEvents = groupedData.filter(g => tahap.years.includes(g.year));
            if (tahapEvents.length === 0) return null;
            const byName: Record<string, typeof tahapEvents> = {};
            tahapEvents.forEach(g => { if (!byName[g.eventName]) byName[g.eventName] = []; byName[g.eventName].push(g); });
            return (
              <div key={tahap.label}>
                <div className="text-[10px] font-black uppercase tracking-widest mb-1.5 px-1" style={{color: tahap.color}}>{tahap.label}</div>
                <div className="space-y-1">
                  {Object.entries(byName).map(([evName, evList]) => {
                    const ft = getFormType(evName);
                    const typeIcon = ft==='larian_individu'?'🏃':ft==='larian_relay'?'🔄':ft==='lompat_tinggi'?'🏅':'🎯';
                    return (
                      <div key={evName} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                        {/* Acara name */}
                        <span className="text-xs font-black text-gray-700 w-36 flex-shrink-0 flex items-center gap-1">
                          <span>{typeIcon}</span>{evName}
                        </span>
                        {/* Pill buttons: year + gender */}
                        <div className="flex gap-1.5 flex-wrap">
                          {evList.map(g => {
                            const isSelected = selectedEvent === g.uniqueKey;
                            const gLabel = g.gender === 'L' ? 'L' : 'P';
                            return (
                              <button key={g.uniqueKey}
                                onClick={() => {
                                  setSelectedEvent(g.uniqueKey);
                                  const ftype = getFormType(g.eventName);
                                  if (ftype === 'larian_individu') setActiveTab('saringan');
                                  else if (ftype === 'larian_relay') setActiveTab('lorong');
                                  else setActiveTab('urutan');
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all border-2"
                                style={{
                                  background: isSelected ? tahap.color : 'white',
                                  color: isSelected ? 'white' : '#6b7280',
                                  borderColor: isSelected ? tahap.color : '#e5e7eb',
                                  boxShadow: isSelected ? `0 2px 8px ${tahap.color}40` : 'none',
                                }}>
                                <span>Thn {g.year}</span>
                                <span className="opacity-70">·</span>
                                <span>{gLabel}</span>
                                <span className="text-[9px] opacity-70">({g.participants.length})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {groupedData.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">Tiada data peserta. Daftar peserta dahulu.</p>
            </div>
          )}

          {/* Acara terpilih */}
          {selectedGroup && (
            <div className="flex flex-wrap gap-2 pt-3 mt-1 border-t border-gray-100">
              <span className="px-3 py-1.5 rounded-full text-xs font-black bg-slate-800 text-white">
                ✅ {selectedGroup.eventName} · Thn {selectedGroup.year} · {selectedGroup.gender==='L'?'Lelaki':'Perempuan'} · {selectedGroup.participants.length} peserta
              </span>
              {state && formType==='larian_individu' && (
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-orange-50 text-orange-700 border border-orange-200">⚡ {saringanCount} Saringan</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Working Area */}
      {selectedGroup && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
            {formType==='larian_individu' && <>
              <button onClick={()=>setActiveTab('saringan')} className={tabStyle('saringan')}>
                <Flag className="w-4 h-4"/>Susun Saringan
                {state && <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">{saringanCount}</span>}
              </button>
              <button onClick={()=>setActiveTab('akhir')} className={tabStyle('akhir')}>
                <Trophy className="w-4 h-4"/>Peringkat Akhir
                {state && state.finalists.length>0 && <span className="ml-1 w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center">{state.finalists.length}</span>}
              </button>
            </>}
            {formType==='larian_relay' && (
              <button onClick={()=>setActiveTab('lorong')} className={tabStyle('lorong')}><Users className="w-4 h-4"/>Susun Lorong</button>
            )}
            {(formType==='padang_ukuran'||formType==='lompat_tinggi') && (
              <button onClick={()=>setActiveTab('urutan')} className={tabStyle('urutan')}>
                <Users className="w-4 h-4"/>Susun Urutan Rumah
              </button>
            )}
            <button onClick={()=>setActiveTab('settings')} className={tabStyle('settings')}><Settings className="w-4 h-4"/>Tetapan & Cetak</button>
          </div>

          {/* TAB: SARINGAN */}
          {activeTab==='saringan' && formType==='larian_individu' && state && (
            <div className="p-5 space-y-5">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-gray-600 uppercase tracking-wider">Bilangan Saringan:</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => {
                        if (!selectedGroup) return;
                        const key = selectedGroup.uniqueKey;
                        setSaringanStates(prev => {
                          const old = prev[key] || { groups: [[]], results: {}, finalists: [] };
                          let newGroups = [...old.groups.map(g => [...g])];
                          while (newGroups.length < n) newGroups.push([]);
                          if (newGroups.length > n) {
                            for (let i = n; i < newGroups.length; i++) newGroups[n-1].push(...newGroups[i]);
                            newGroups = newGroups.slice(0, n);
                          }
                          return { ...prev, [key]: { ...old, groups: newGroups } };
                        });
                      }} className={`w-9 h-9 rounded-xl border-2 text-sm font-black transition-all ${state.groups.length===n?'border-blue-600 bg-blue-600 text-white':'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <button onClick={()=>rebuildSaringan('auto')} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100">
                  <RotateCcw className="w-3.5 h-3.5"/>Auto Bahagi Semula
                </button>
                <button onClick={()=>rebuildSaringan('satu_rumah')}
                  title="Setiap saringan ada 1 wakil dari setiap rumah sukan"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100">
                  <Users className="w-3.5 h-3.5"/>1 Rumah / Saringan
                </button>
                <button onClick={()=>shuffleLorong()}
                  title="Shuffle kedudukan lorong secara rawak untuk semua saringan"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100">
                  🎲 Acak Lorong
                </button>

                <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                  <label className="text-xs font-black text-gray-600 uppercase tracking-wider whitespace-nowrap">Peserta / Saringan:</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <button key={n} onClick={() => { setPrintSettings(p=>({...p,pesertaPerSaringan:n})); setTimeout(rebuildSaringan,50); }}
                        className={`w-8 h-8 rounded-lg border-2 text-xs font-black transition-all ${printSettings.pesertaPerSaringan===n?'border-purple-600 bg-purple-600 text-white':'border-gray-200 bg-white text-gray-600 hover:border-purple-300'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
                      <span className="text-white font-black text-sm">Senarai Peserta</span>
                      <span className="text-slate-400 text-xs">{selectedGroup.participants.length} orang</span>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-[500px] overflow-y-auto">
                      {selectedGroup.participants.map((p, pi) => {
                        let assignedSaringan = -1; let assignedLorong = -1;
                        state.groups.forEach((g, si) => { const li = g.findIndex(x => x.name===p.name&&x.house===p.house); if(li>=0){assignedSaringan=si;assignedLorong=li;} });
                        const hcolor = HOUSE_COLORS[p.house]||'#64748b';
                        const isAssigned = assignedSaringan >= 0;
                        return (
                          <div key={pi} className={`flex items-center gap-2 p-2.5 rounded-xl border ${isAssigned?'bg-white border-gray-200':'bg-yellow-50 border-yellow-300'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-gray-800 truncate">{p.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full" style={{background:hcolor}}>{houseLabel(p.house)}</span>
                                <span className="text-[10px] text-gray-400">{p.className}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <select value={assignedSaringan>=0?assignedSaringan:''} onChange={e => {
                                const targetSi = parseInt(e.target.value);
                                if (isNaN(targetSi)||!selectedGroup) return;
                                const key = selectedGroup.uniqueKey;
                                setSaringanStates(prev => {
                                  const st = prev[key]; if (!st) return prev;
                                  const groups = st.groups.map(g=>[...g]);
                                  if (assignedSaringan>=0) groups[assignedSaringan]=groups[assignedSaringan].filter(x=>!(x.name===p.name&&x.house===p.house));
                                  groups[targetSi].push(p);
                                  return {...prev,[key]:{...st,groups}};
                                });
                              }} className={`px-2 py-1 border rounded-lg text-[11px] font-bold focus:outline-none ${isAssigned?'border-blue-300 bg-blue-50 text-blue-700':'border-yellow-300 bg-yellow-50 text-yellow-700'}`}>
                                <option value="">-- Saringan --</option>
                                {state.groups.map((_,si)=><option key={si} value={si}>Saringan {si+1}</option>)}
                              </select>
                              {isAssigned && (
                                <select value={assignedLorong} onChange={e=>swapPeserta(assignedSaringan,assignedLorong,parseInt(e.target.value))}
                                  className="px-2 py-1 border border-gray-300 rounded-lg text-[11px] font-bold focus:outline-none bg-white text-gray-700">
                                  {state.groups[assignedSaringan]?.map((_,li)=><option key={li} value={li}>Lorong {li+1}</option>)}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-3">
                  {state.groups.map((group, si) => (
                    <div key={si} className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 cursor-pointer"
                        onClick={()=>setExpandedSection(expandedSection===`saringan_${si}`?null:`saringan_${si}`)}>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-white text-blue-700 flex items-center justify-center font-black">{si+1}</span>
                          <span className="text-white font-black">SARINGAN {si+1}</span>
                          <span className="text-blue-200 text-xs">{group.length} peserta</span>
                        </div>
                        <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>shuffleLorong(si)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title="Acak lorong dalam saringan ini">
                            🎲 Acak
                          </button>
                          {expandedSection===`saringan_${si}`?<ChevronUp className="w-5 h-5 text-white"/>:<ChevronDown className="w-5 h-5 text-white"/>}
                        </div>
                      </div>
                      {expandedSection===`saringan_${si}` && (
                        <div className="p-3">
                          {group.length===0 ? (
                            <div className="text-center py-6 text-gray-400 text-sm"><Users className="w-8 h-8 mx-auto mb-2 opacity-30"/>Tiada peserta. Assign dari panel kiri.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="px-3 py-2 text-left text-xs font-black text-gray-500 border border-gray-200 w-16">Lorong</th>
                                    <th className="px-3 py-2 text-left text-xs font-black text-gray-500 border border-gray-200">Nama</th>
                                    <th className="px-3 py-2 text-center text-xs font-black text-gray-500 border border-gray-200 w-20">Kelas</th>
                                    <th className="px-3 py-2 text-center text-xs font-black text-gray-500 border border-gray-200 w-24">Rumah</th>
                                    <th className="px-3 py-2 text-center text-xs font-black text-gray-500 border border-gray-200 w-28">Kedudukan</th>
                                    <th className="px-3 py-2 text-center text-xs font-black text-gray-500 border border-gray-200 w-28"><span className="text-green-700">✅ Layak Akhir</span></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.map((p, li) => {
                                    const positions = state.results[si]||[];
                                    const currentPos = positions.indexOf(li)+1;
                                    const hcolor = HOUSE_COLORS[p.house]||'#64748b';
                                    const isFinalist = state.finalists.some(f=>f.name===p.name&&f.house===p.house);
                                    return (
                                      <tr key={li} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-3 py-2.5 border border-gray-200 text-center font-black text-blue-700">{li+1}</td>
                                        <td className="px-3 py-2.5 border border-gray-200 font-semibold text-gray-800">{p.name}</td>
                                        <td className="px-3 py-2.5 border border-gray-200 text-center text-gray-500 text-xs">{p.className||'-'}</td>
                                        <td className="px-3 py-2.5 border border-gray-200 text-center">
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{background:hcolor}}>{houseLabel(p.house)}</span>
                                        </td>
                                        <td className="px-2 py-2 border border-gray-200 text-center">
                                          <select value={currentPos} onChange={e=>{const v=parseInt(e.target.value);if(v>0)setPosition(si,li,v);}}
                                            className={`w-full px-2 py-1 border-2 rounded-lg text-xs font-black focus:outline-none ${currentPos===1?'border-yellow-400 bg-yellow-50 text-yellow-800':currentPos===2?'border-gray-300 bg-gray-50 text-gray-700':currentPos===3?'border-orange-300 bg-orange-50 text-orange-700':'border-gray-200 bg-white text-gray-500'}`}>
                                            <option value={0}>-- Tempat --</option>
                                            {group.map((_,i)=><option key={i} value={i+1}>Tempat {i+1}</option>)}
                                          </select>
                                        </td>
                                        <td className="px-2 py-2 border border-gray-200 text-center">
                                          <button onClick={()=>{
                                            if(!selectedGroup)return;
                                            const key=selectedGroup.uniqueKey;
                                            setSaringanStates(prev=>{
                                              const st=prev[key];if(!st)return prev;
                                              let fins=[...st.finalists];
                                              if(isFinalist) fins=fins.filter(f=>!(f.name===p.name&&f.house===p.house));
                                              else fins.push(p);
                                              return{...prev,[key]:{...st,finalists:fins}};
                                            });
                                          }} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black border-2 w-full justify-center transition-all ${isFinalist?'bg-green-600 text-white border-green-600':'bg-white text-gray-400 border-gray-200 hover:border-green-400 hover:text-green-600'}`}>
                                            {isFinalist?'✅ Layak':'+ Pilih'}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {(() => {
                            const fins = group.filter(p=>state.finalists.some(f=>f.name===p.name&&f.house===p.house));
                            if(fins.length===0)return null;
                            return <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                              <p className="text-xs font-black text-green-700 mb-2">✅ Layak ke Akhir dari Saringan {si+1}:</p>
                              <div className="flex flex-wrap gap-2">{fins.map((p,i)=><span key={i} className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">{p.name}</span>)}</div>
                            </div>;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERINGKAT AKHIR */}
          {activeTab==='akhir' && state && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-800 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500"/>Peserta Layak ke Peringkat Akhir</h3>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black">{state.finalists.length} peserta</span>
              </div>
              {state.finalists.length===0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                  <p className="font-medium">Belum ada peserta dipilih.</p>
                  <p className="text-sm mt-1">Pergi ke Susun Saringan dan klik "+ Pilih" pada peserta yang layak.</p>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-black text-sm">Peserta Peringkat Akhir</span>
                    <span className="text-slate-300 text-xs">Susun lorong mengikut kesesuaian</span>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-700">
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-12">No.</th>
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-24">Lorong</th>
                        <th className="px-3 py-2.5 text-left text-xs font-black text-slate-300">Nama</th>
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-28">Kelas</th>
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-28">Rumah</th>
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-32">Kedudukan</th>
                        <th className="px-3 py-2.5 text-xs font-black text-slate-300 w-16">Buang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.finalists.map((p, i) => {
                        const hcolor = HOUSE_COLORS[p.house]||'#64748b';
                        return (
                          <tr key={i} className={`${i%2===0?'bg-white':'bg-gray-50'} hover:bg-yellow-50`}>
                            <td className="px-3 py-2.5 border-b border-gray-100 text-center text-gray-500 font-mono">{i+1}</td>
                            <td className="px-2 py-2 border-b border-gray-100 text-center">
                              <select value={i} onChange={e=>{
                                const toIdx=parseInt(e.target.value);
                                if(!selectedGroup||toIdx===i)return;
                                setSaringanStates(prev=>{
                                  const key=selectedGroup.uniqueKey;
                                  const st=prev[key];if(!st)return prev;
                                  const fin=[...st.finalists];
                                  [fin[i],fin[toIdx]]=[fin[toIdx],fin[i]];
                                  return{...prev,[key]:{...st,finalists:fin}};
                                });
                              }} className="px-2 py-1 border-2 border-blue-300 rounded-lg text-xs font-black bg-blue-50 text-blue-700 focus:outline-none">
                                {state.finalists.map((_,li)=><option key={li} value={li}>Lorong {li+1}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 border-b border-gray-100 font-semibold text-gray-800">{p.name}</td>
                            <td className="px-3 py-2.5 border-b border-gray-100 text-center text-xs text-gray-600">{p.className||'-'}</td>
                            <td className="px-3 py-2.5 border-b border-gray-100 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{background:hcolor}}>{houseLabel(p.house)}</span>
                            </td>
                            <td className="px-2 py-2 border-b border-gray-100 text-center">
                              <select className="px-2 py-1 border-2 border-gray-200 rounded-lg text-xs font-black focus:outline-none bg-white">
                                <option value="">-- Tempat --</option>
                                {state.finalists.map((_,fi)=><option key={fi} value={fi+1}>Tempat {fi+1}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2 border-b border-gray-100 text-center">
                              <button onClick={()=>{
                                if(!selectedGroup)return;
                                setSaringanStates(prev=>{
                                  const key=selectedGroup.uniqueKey;
                                  const st=prev[key];if(!st)return prev;
                                  const fin=st.finalists.filter((_,fi)=>fi!==i);
                                  return{...prev,[key]:{...st,finalists:fin}};
                                });
                              }} className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1 rounded hover:bg-red-50">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: LORONG RELAY */}
          {activeTab==='lorong' && formType==='larian_relay' && (
            <div className="p-5 space-y-4">
              <h3 className="font-black text-gray-800 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600"/>Susun Lorong Relay</h3>
              <div className="space-y-3">
                {(relayLanes[selectedGroup.uniqueKey]||[...houseOrder]).map((h, i) => {
                  const hcolor = HOUSE_COLORS[h]||'#64748b';
                  const byHouse: Record<string,Peserta[]>={};
                  selectedGroup.participants.forEach(p=>{if(!byHouse[p.house])byHouse[p.house]=[];byHouse[p.house].push(p);});
                  const team = byHouse[h]||[];
                  return (
                    <div key={h} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 bg-gray-50">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl flex-shrink-0" style={{background:hcolor}}>{i+1}</div>
                      <div className="flex-1">
                        <select value={h} onChange={e=>{const ti=(relayLanes[selectedGroup.uniqueKey]||[...houseOrder]).indexOf(e.target.value);swapLane(i,ti);}}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-black focus:border-blue-500 outline-none bg-white mb-2">
                          {houseOrder.map(ho=><option key={ho} value={ho}>{houseLabel(ho)}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-1.5">
                          {team.slice(0,4).map((p,pi)=>(
                            <span key={pi} className="px-2 py-1 rounded-lg text-[10px] font-bold text-white" style={{background:hcolor+'cc'}}>Pelari {pi+1}: {p.name}</span>
                          ))}
                          {team.length===0 && <span className="text-xs text-gray-400 italic">Tiada peserta didaftarkan</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: SUSUN URUTAN RUMAH (PADANG/LOMPAT TINGGI) */}
          {activeTab==='urutan' && (formType==='padang_ukuran'||formType==='lompat_tinggi') && (
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-black text-gray-800 text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600"/>Susun Urutan Rumah Sukan
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Urutan ini akan diulang dalam borang: <strong>R1 → R2 → R3 → R4 → R5 → R6</strong> kemudian ulang semula.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{
                    const arr = [...getPadangOrder()];
                    for (let i = arr.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                    setPadangOrder(arr);
                  }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors">
                    🎲 Acak Urutan
                  </button>
                  <button onClick={()=>setPadangOrder([...houseOrder])}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5"/>Reset ke Asal
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Senarai susun */}
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Susun Urutan</p>
                  {getPadangOrder().map((h, i) => {
                    const hcolor = HOUSE_COLORS[h]||'#64748b';
                    const byH: Record<string,Peserta[]>={};
                    selectedGroup.participants.forEach(p=>{if(!byH[p.house])byH[p.house]=[];byH[p.house].push(p);});
                    const count = (byH[h]||[]).length;
                    return (
                      <div key={h} className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-300 transition-colors group">
                        {/* Position badge */}
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-black text-gray-500 flex-shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                          {i+1}
                        </div>
                        {/* House color block */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-sm" style={{background:hcolor}}>
                          {houseLabel(h).substring(0,1)}
                        </div>
                        {/* Name + count */}
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-gray-800">{houseLabel(h)}</div>
                          <div className="text-xs text-gray-400">{count} peserta</div>
                        </div>
                        {/* Controls */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={()=>moveHouse(i, i-1)} disabled={i===0}
                            className="w-8 h-8 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                            <ChevronUp className="w-4 h-4"/>
                          </button>
                          <button onClick={()=>moveHouse(i, i+1)} disabled={i===getPadangOrder().length-1}
                            className="w-8 h-8 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                            <ChevronDown className="w-4 h-4"/>
                          </button>
                          <select value={i} onChange={e=>swapHouseTo(i, parseInt(e.target.value))}
                            className="ml-1 px-2 py-1.5 border-2 border-gray-200 rounded-lg text-xs font-bold text-gray-600 bg-white focus:outline-none focus:border-blue-400 hover:border-blue-300 transition-colors">
                            {getPadangOrder().map((_,idx)=>(
                              <option key={idx} value={idx}>Kedudukan {idx+1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preview */}
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Preview Susnan dalam Borang</p>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4">
                    {(() => {
                      const byH: Record<string,Peserta[]>={};
                      selectedGroup.participants.forEach(p=>{if(!byH[p.house])byH[p.house]=[];byH[p.house].push(p);});
                      const maxPH = Math.max(...getPadangOrder().map(h=>(byH[h]||[]).length), 1);
                      return Array.from({length: maxPH}, (_, row) => (
                        <div key={row} className="flex gap-1.5 mb-2 flex-wrap">
                          <span className="text-[10px] font-black text-gray-400 w-6 flex items-center justify-end shrink-0">{row*6+1}</span>
                          {getPadangOrder().map((h, col) => {
                            const p = (byH[h]||[])[row];
                            const hcolor = HOUSE_COLORS[h]||'#64748b';
                            return (
                              <div key={col} className="flex items-center gap-1 px-2 py-1 rounded-lg border text-xs flex-1 min-w-[80px]"
                                style={{borderColor:`${hcolor}50`, background: p ? `${hcolor}12` : '#f9fafb'}}>
                                <span className="font-black text-[10px] w-3" style={{color:hcolor}}>
                                  {houseLabel(h).substring(0,1)}
                                </span>
                                <span className="text-gray-700 truncate text-[11px]">
                                  {p ? p.name : <span className="text-gray-300">—</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                  <button onClick={()=>setActiveTab('settings')}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors">
                    <Settings className="w-4 h-4"/>Teruskan ke Tetapan & Cetak
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TETAPAN & CETAK */}
          {activeTab==='settings' && (
            <div className="p-5 space-y-5">
              <h3 className="font-black text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-600"/>Tetapan Cetakan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Orientasi Halaman</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['portrait','landscape'] as const).map(o=>(
                      <button key={o} onClick={()=>setPrintSettings(p=>({...p,orientation:o}))}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${printSettings.orientation===o?'border-blue-600 bg-blue-50':'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className={`rounded border-2 border-current ${o==='portrait'?'w-8 h-10':'w-12 h-8'} ${printSettings.orientation===o?'text-blue-600':'text-gray-400'}`}/>
                        <span className={`text-xs font-black uppercase ${printSettings.orientation===o?'text-blue-700':'text-gray-500'}`}>{o==='portrait'?'Menegak':'Melintang'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {formType==='larian_individu' && state && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Yang Dicetak</label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${printSettings.saringanMode==='semua'?'border-blue-600 bg-blue-50':'border-gray-200 bg-white'}`}>
                        <input type="radio" checked={printSettings.saringanMode==='semua'} onChange={()=>setPrintSettings(p=>({...p,saringanMode:'semua',activeSaringan:0}))} className="w-4 h-4 accent-blue-600"/>
                        <span className={`text-sm font-bold ${printSettings.saringanMode==='semua'?'text-blue-700':'text-gray-600'}`}>Semua Saringan (1 muka surat)</span>
                      </label>
                      <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${printSettings.saringanMode==='satu'&&printSettings.activeSaringan>=0?'border-blue-600 bg-blue-50':'border-gray-200 bg-white'}`}>
                        <input type="radio" checked={printSettings.saringanMode==='satu'&&printSettings.activeSaringan>=0} onChange={()=>setPrintSettings(p=>({...p,saringanMode:'satu',activeSaringan:0}))} className="w-4 h-4 accent-blue-600"/>
                        <span className={`text-sm font-bold ${printSettings.saringanMode==='satu'&&printSettings.activeSaringan>=0?'text-blue-700':'text-gray-600'}`}>Satu Saringan sahaja</span>
                      </label>
                      {printSettings.saringanMode==='satu'&&printSettings.activeSaringan>=0&&(
                        <select value={printSettings.activeSaringan} onChange={e=>setPrintSettings(p=>({...p,activeSaringan:parseInt(e.target.value)}))}
                          className="w-full mt-1 px-3 py-2 border-2 border-blue-300 rounded-xl text-sm font-bold focus:border-blue-500 outline-none bg-white">
                          {state.groups.map((_,i)=><option key={i} value={i}>Saringan {i+1}</option>)}
                        </select>
                      )}
                      {state.finalists.length>0&&(
                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${printSettings.saringanMode==='satu'&&printSettings.activeSaringan===-1?'border-green-600 bg-green-50':'border-gray-200 bg-white'}`}>
                          <input type="radio" checked={printSettings.saringanMode==='satu'&&printSettings.activeSaringan===-1} onChange={()=>setPrintSettings(p=>({...p,saringanMode:'satu',activeSaringan:-1,peringkat:'Akhir'}))} className="w-4 h-4 accent-green-600"/>
                          <span className={`text-sm font-bold ${printSettings.saringanMode==='satu'&&printSettings.activeSaringan===-1?'text-green-700':'text-gray-600'}`}>✅ Peringkat Akhir ({state.finalists.length} peserta)</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Pilihan Lain</label>
                  <div className="space-y-3">
                    {formType==='larian_individu'&&(
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={printSettings.showResults} onChange={e=>setPrintSettings(p=>({...p,showResults:e.target.checked}))} className="w-4 h-4 accent-blue-600"/>
                        <span className="text-sm font-bold text-gray-700">Tunjuk lajur kedudukan</span>
                      </label>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">Peringkat</label>
                      <select value={printSettings.peringkat} onChange={e=>setPrintSettings(p=>({...p,peringkat:e.target.value}))}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-blue-500 outline-none bg-white">
                        {['Saringan','Separuh Akhir','Akhir'].map(v=><option key={v}>{v}</option>)}
                      </select>
                    </div>
                    {/* Padang: tunjuk urutan rumah yang dipilih */}
                    {(formType==='padang_ukuran'||formType==='lompat_tinggi')&&(
                      <div className="pt-1">
                        <label className="block text-xs font-bold text-gray-500 mb-2">Urutan Rumah Semasa</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {getPadangOrder().map((h,i)=>(
                            <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-black text-white" style={{background:HOUSE_COLORS[h]||'#64748b'}}>
                              {i+1}. {houseLabel(h).substring(0,1)}
                            </span>
                          ))}
                        </div>
                        <button onClick={()=>setActiveTab('urutan')} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                          Tukar urutan →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Margin Kertas (mm)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Atas</label>
                      <input type="number" min="0" value={printSettings.marginT} onChange={e=>setPrintSettings(p=>({...p,marginT:parseInt(e.target.value)||0}))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Bawah</label>
                      <input type="number" min="0" value={printSettings.marginB} onChange={e=>setPrintSettings(p=>({...p,marginB:parseInt(e.target.value)||0}))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Kiri</label>
                      <input type="number" min="0" value={printSettings.marginL} onChange={e=>setPrintSettings(p=>({...p,marginL:parseInt(e.target.value)||0}))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Kanan</label>
                      <input type="number" min="0" value={printSettings.marginR} onChange={e=>setPrintSettings(p=>({...p,marginR:parseInt(e.target.value)||0}))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 md:col-span-2">
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Maklumat Hakim</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" placeholder="Nama Ketua Hakim" value={printSettings.chiefJudge}
                      onChange={e=>setPrintSettings(p=>({...p,chiefJudge:e.target.value}))}
                      className="px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    {printSettings.judges.map((j,i)=>(
                      <input key={i} type="text" placeholder={`Nama Hakim ${i+1}`} value={j}
                        onChange={e=>{const u=[...printSettings.judges];u[i]=e.target.value;setPrintSettings(p=>({...p,judges:u}));}}
                        className="px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"/>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={()=>{const c=buildPrintContent();if(printRef.current)printRef.current.innerHTML=c;setTimeout(handlePrint,100);}}
                  className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base shadow-xl transition-all transform hover:-translate-y-0.5">
                  <Printer className="w-5 h-5"/>🖨️ Cetak / Jana PDF
                </button>
                <button onClick={()=>{const c=buildPrintContent();if(printRef.current)printRef.current.innerHTML=c;}}
                  className="flex items-center gap-2 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm transition-all">
                  <Eye className="w-4 h-4"/>Pratonton
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pratonton */}
      {selectedGroup && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-black text-gray-600 flex items-center gap-2"><Eye className="w-4 h-4"/>Pratonton Borang Cetakan</span>
            <span className="text-xs text-gray-400">{printSettings.orientation==='portrait'?'📄 Menegak':'📄 Melintang'}</span>
          </div>
          <div className="p-4 overflow-x-auto bg-gray-50">
            <div className="bg-white shadow-md rounded-lg p-6 min-w-[600px]" ref={printRef}
              dangerouslySetInnerHTML={{__html: buildPrintContent()}}/>
          </div>
        </div>
      )}

      {groupedData.length===0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-yellow-800 font-black text-lg">Tiada data peserta ditemui.</p>
          <p className="text-yellow-600 text-sm mt-2">Sila daftar peserta dahulu dalam bahagian Tetapan → Pendaftaran.</p>
        </div>
      )}
    </div>
  );
};

export default CompetitionForm;
