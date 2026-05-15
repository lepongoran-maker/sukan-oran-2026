import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, RotateCcw, Award, Users, Anchor, ClipboardList, Trophy, LayoutGrid, FileSpreadsheet, Trash2, Database, AlertTriangle, ShieldAlert, Download, Printer, KeyRound, LogOut } from 'lucide-react';
import { AccessConfig, AccessSession, PointsConfig, Participant, WinnerProfile, HouseColor, Gender, EventLimitsConfig, EventType, HouseStats, SystemConfig, EventSettings, StudentRosterEntry } from '../types';
import { POINTS_INDIVIDUAL, POINTS_RELAY, POINTS_TARIK_TALI, HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG, DEFAULT_ACCESS_CONFIG } from '../constants';
import { activeEvents, activeHouseIds, getHouseName, normalizeSystemConfig } from '../utils/systemConfig';
import RegistrationForm from './RegistrationForm';
import ResultsEntry from './ResultsEntry';
import CsvImport from './CsvImport';
import CompetitionForm from './CompetitionForm';

interface SettingsProps {
  pointsConfig: PointsConfig;
  onUpdatePoints: (config: PointsConfig) => void;
  eventLimits: EventLimitsConfig;
  onUpdateEventLimits: (config: EventLimitsConfig) => void;
  systemConfig: SystemConfig;
  onUpdateSystemConfig: (config: SystemConfig) => void;
  accessConfig: AccessConfig;
  onUpdateAccessConfig: (config: AccessConfig) => void;
  accessSession: AccessSession;
  onLogout: () => void;
  registrations: Record<string, Participant[]>;
  onUpdateRegistration: (key: string, participants: Participant[]) => void;
  onBulkRegistration: (newRegistrations: Record<string, Participant[]>) => void;
  onBulkOverride?: (newRegistrations: Record<string, Participant[]>) => void;
  studentRoster: StudentRosterEntry[];
  onImportStudentRoster: (newRoster: StudentRosterEntry[]) => void;
  results: Record<string, WinnerProfile[]>;
  onSaveResult: (eventId: string, year: number, gender: Gender, positions: WinnerProfile[]) => void;
  onResetData: (type: 'participants' | 'results' | 'all') => void;
  stats?: HouseStats[];
}

type AdminTab = 'registration' | 'import' | 'results_entry' | 'competition_form' | 'system_config' | 'config' | 'limits' | 'access' | 'system' | 'backup';

// ── EXCEL EXPORT ──────────────────────────────────────────────────────────────
function exportToExcel(
  registrations: Record<string, Participant[]>,
  results: Record<string, WinnerProfile[]>,
  pointsConfig: PointsConfig,
  systemConfig: SystemConfig
) {
  const allEvents = activeEvents(systemConfig);
  const now = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateStr = new Date().toISOString().slice(0, 10);

  // ── Escape XML special chars ──
  const esc = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // ── House colour maps ──
  const HOUSE_BG: Record<string, string> = {
    MERAH: '#fee2e2', BIRU: '#dbeafe', HIJAU: '#dcfce7',
    KUNING: '#fef9c3', UNGU: '#f3e8ff', OREN: '#ffedd5',
  };
  const HOUSE_FG: Record<string, string> = {
    MERAH: '#991b1b', BIRU: '#1e40af', HIJAU: '#166534',
    KUNING: '#854d0e', UNGU: '#6b21a8', OREN: '#9a3412',
  };
  const HOUSE_HDR: Record<string, string> = {
    MERAH: '#ef4444', BIRU: '#3b82f6', HIJAU: '#22c55e',
    KUNING: '#ca8a04', UNGU: '#a855f7', OREN: '#f97316',
  };

  // ── Pre-sort keys once — used across all sheets ──
  const sortedRegKeys = Object.keys(registrations).sort();
  const sortedResultKeys = Object.keys(results).sort();

  // ── Medal labels ──
  const MEDAL_LABELS = ['Emas (1)', 'Perak (2)', 'Gangsa (3)', 'Ke-4', 'Ke-5', 'Ke-6'];
  const MEDAL_STYLES = ['Gold', 'Silver', 'Bronze', 'Center', 'Center', 'Center'];

  // ─────────────────────────────────────────────────
  // PRE-COMPUTE: Mata setiap rumah (Sheet 3 & 4)
  // ─────────────────────────────────────────────────
  const houseStats: Record<string, {
    total: number; individu: number; relay: number; khas: number;
  }> = {};
  activeHouseIds(systemConfig).forEach(h => {
    houseStats[h] = { total: 0, individu: 0, relay: 0, khas: 0 };
  });

  sortedResultKeys.forEach(key => {
    const parts = key.split('_');
    const eventId = parts.slice(0, parts.length - 2).join('_');
    const eventDef = allEvents.find(e => e.id === eventId);
    const isRelay = eventDef?.type === EventType.RELAY;
    const isTarikTali = eventDef?.id === 'khas_tariktali';
    const isKhusus = eventDef?.type === EventType.KHUSUS;

    (results[key] || []).forEach((w, idx) => {
      if (!w?.house) return;
      let pts = 0;
      if (w.customScore !== undefined) {
        pts = w.customScore;
      } else {
        const sys = isTarikTali ? pointsConfig.tarikTali : isRelay ? pointsConfig.relay : pointsConfig.individu;
        pts = sys[idx] || 0;
      }
      if (!houseStats[w.house]) return;
      houseStats[w.house].total += pts;
      if (isRelay || isTarikTali) houseStats[w.house].relay += pts;
      else if (isKhusus) houseStats[w.house].khas += pts;
      else houseStats[w.house].individu += pts;
    });
  });

  const sortedHouses = activeHouseIds(systemConfig).sort((a, b) => houseStats[b].total - houseStats[a].total);
  const grandTotal  = Object.values(houseStats).reduce((a, s) => a + s.total, 0);
  const houseList   = activeHouseIds(systemConfig);

  // ─────────────────────────────────────────────────
  // SHEET 1 — SENARAI PESERTA
  // ─────────────────────────────────────────────────
  const buildSheet1 = () => {
    let rows = '';
    let bil = 1;
    sortedRegKeys.forEach(key => {
      const parts = key.split('_');
      const house    = parts[0];
      const year     = parts[1];
      const gender   = parts[2];
      const eventId  = parts.slice(3).join('_');
      const eventDef = allEvents.find(e => e.id === eventId);
      const eventName  = eventDef ? eventDef.name : eventId;
      const eventType  = eventDef ? eventDef.type : '-';
      const yearLabel  = year === '0' ? 'Terbuka' : `Tahun ${year}`;
      const genderLabel = gender === 'L' ? 'Lelaki' : gender === 'P' ? 'Perempuan' : 'Campuran';

      (registrations[key] || []).forEach(p => {
        if (!p?.name) return;
        rows += `<Row>
          <Cell ss:StyleID="Center"><Data ss:Type="Number">${bil++}</Data></Cell>
          <Cell ss:StyleID="Bold"><Data ss:Type="String">${esc(p.name)}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(p.className || '-')}</Data></Cell>
          <Cell ss:StyleID="${house}"><Data ss:Type="String">${esc(getHouseName(systemConfig, house))}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(eventName)}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(yearLabel)}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(genderLabel)}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(eventType)}</Data></Cell>
        </Row>`;
      });
    });
    return rows;
  };

  // ─────────────────────────────────────────────────
  // SHEET 2 — KEPUTUSAN PEMENANG
  // ─────────────────────────────────────────────────
  const buildSheet2 = () => {
    let rows = '';
    let bil = 1;
    sortedResultKeys.forEach(key => {
      const parts     = key.split('_');
      const yearStr   = parts[parts.length - 2];
      const genderStr = parts[parts.length - 1];
      const eventId   = parts.slice(0, parts.length - 2).join('_');
      const eventDef  = allEvents.find(e => e.id === eventId);
      const eventName = eventDef ? eventDef.name : eventId;
      const isRelay     = eventDef?.type === EventType.RELAY;
      const isTarikTali = eventDef?.id === 'khas_tariktali';
      const yearLabel   = yearStr === '0' ? 'Terbuka' : `Tahun ${yearStr}`;
      const genderLabel = genderStr === 'L' ? 'Lelaki' : genderStr === 'P' ? 'Perempuan' : 'Campuran';

      (results[key] || []).forEach((w, idx) => {
        if (!w) return;
        let pts = 0;
        if (w.customScore !== undefined) {
          pts = w.customScore;
        } else {
          const sys = isTarikTali ? pointsConfig.tarikTali : isRelay ? pointsConfig.relay : pointsConfig.individu;
          pts = sys[idx] || 0;
        }
        const namaDisplay  = w.teamMembers?.length ? w.teamMembers.map(m => m.name).join(', ') : w.name || '-';
        const kelasDisplay = w.teamMembers?.length ? w.teamMembers.map(m => m.className).filter(Boolean).join(', ') : w.className || '-';

        rows += `<Row>
          <Cell ss:StyleID="Center"><Data ss:Type="Number">${bil++}</Data></Cell>
          <Cell ss:StyleID="Bold"><Data ss:Type="String">${esc(eventName)}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(yearLabel)}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(genderLabel)}</Data></Cell>
          <Cell ss:StyleID="${MEDAL_STYLES[idx] || 'Center'}"><Data ss:Type="String">${esc(MEDAL_LABELS[idx] || `Ke-${idx + 1}`)}</Data></Cell>
          <Cell ss:StyleID="Bold"><Data ss:Type="String">${esc(namaDisplay)}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(kelasDisplay)}</Data></Cell>
          <Cell ss:StyleID="${w.house}"><Data ss:Type="String">${esc(getHouseName(systemConfig, w.house))}</Data></Cell>
          <Cell ss:StyleID="Center"><Data ss:Type="Number">${pts}</Data></Cell>
        </Row>`;
      });
    });
    return rows;
  };

  // ─────────────────────────────────────────────────
  // SHEET 3 — MATA RUMAH SUKAN
  // ─────────────────────────────────────────────────
  const buildSheet3 = () => {
    // Format baru: satu bahagian per rumah sukan
    // Tunjuk semua keputusan yang rumah tu menang (no 1,2,3,4,5,6)
    // Kolum: BIL | ACARA | TAHUN | JANTINA | TEMPAT | MATA

    const TEMPAT_LABELS = ['Ke-1 (Emas)', 'Ke-2 (Perak)', 'Ke-3 (Gangsa)', 'Ke-4', 'Ke-5', 'Ke-6'];
    const TEMPAT_STYLES = ['Gold', 'Silver', 'Bronze', 'Center', 'Center', 'Center'];

    let rows = '';

    // Susun ikut rumah (ranking)
    sortedHouses.forEach((house) => {
      const houseName = esc(getHouseName(systemConfig, house));
      const s = houseStats[house];

      // Header rumah
      rows += `<Row ss:Height="8"><Cell><Data ss:Type="String"></Data></Cell></Row>`;
      rows += `<Row ss:Height="22">
        <Cell ss:MergeAcross="5" ss:StyleID="${house}"><Data ss:Type="String">🏠 RUMAH ${houseName.toUpperCase()} — Jumlah Mata: ${s.total} | Individu: ${s.individu} | Relay/Khas: ${s.relay + s.khas}</Data></Cell>
      </Row>`;
      rows += `<Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">BIL</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">ACARA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TAHUN</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">JANTINA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TEMPAT</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">MATA</Data></Cell>
      </Row>`;

      let bil = 1;
      let hasResult = false;

      sortedResultKeys.forEach(key => {
        const parts = key.split('_');
        const yearStr = parts[parts.length - 2];
        const genderStr = parts[parts.length - 1];
        const eventId = parts.slice(0, parts.length - 2).join('_');
        const eventDef = allEvents.find(e => e.id === eventId);
        const eventName = eventDef ? eventDef.name : eventId;
        const isRelay = eventDef?.type === EventType.RELAY;
        const isTarikTali = eventDef?.id === 'khas_tariktali';
        const yearLabel = yearStr === '0' ? 'Terbuka' : `Tahun ${yearStr}`;
        const genderLabel = genderStr === 'L' ? 'Lelaki' : genderStr === 'P' ? 'Perempuan' : 'Campuran';

        (results[key] || []).forEach((w, idx) => {
          if (!w?.house || w.house !== house) return;
          let pts = 0;
          if (w.customScore !== undefined) {
            pts = w.customScore;
          } else {
            const sys = isTarikTali ? pointsConfig.tarikTali : isRelay ? pointsConfig.relay : pointsConfig.individu;
            pts = sys[idx] || 0;
          }
          const tempat = TEMPAT_LABELS[idx] || `Ke-${idx + 1}`;
          const tempatStyle = TEMPAT_STYLES[idx] || 'Center';
          rows += `<Row>
            <Cell ss:StyleID="Center"><Data ss:Type="Number">${bil++}</Data></Cell>
            <Cell ss:StyleID="Bold"><Data ss:Type="String">${esc(eventName)}</Data></Cell>
            <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(yearLabel)}</Data></Cell>
            <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(genderLabel)}</Data></Cell>
            <Cell ss:StyleID="${tempatStyle}"><Data ss:Type="String">${esc(tempat)}</Data></Cell>
            <Cell ss:StyleID="Center"><Data ss:Type="Number">${pts}</Data></Cell>
          </Row>`;
          hasResult = true;
        });
      });

      if (!hasResult) {
        rows += `<Row><Cell ss:MergeAcross="5" ss:StyleID="Center"><Data ss:Type="String">— Tiada keputusan lagi —</Data></Cell></Row>`;
      }
    });

    return rows;
  }

  // ─────────────────────────────────────────────────
  // SHEET 4 — RINGKASAN ACARA
  // ─────────────────────────────────────────────────
  const buildSheet4 = () => {
    let rows = '';
    sortedResultKeys.forEach(key => {
      const parts     = key.split('_');
      const yearStr   = parts[parts.length - 2];
      const genderStr = parts[parts.length - 1];
      const eventId   = parts.slice(0, parts.length - 2).join('_');
      const eventDef  = allEvents.find(e => e.id === eventId);
      const eventName   = eventDef ? eventDef.name : eventId;
      const isRelay     = eventDef?.type === EventType.RELAY;
      const isTarikTali = eventDef?.id === 'khas_tariktali';
      const yearLabel   = yearStr === '0' ? 'Terbuka' : `Tahun ${yearStr}`;
      const genderLabel = genderStr === 'L' ? 'Lelaki' : genderStr === 'P' ? 'Perempuan' : 'Campuran';
      const positions   = results[key] || [];
      const isCompleted = positions.length > 0;

      // Mata setiap rumah untuk acara ini
      const acaraPts: Record<string, number> = {};
      houseList.forEach(h => { acaraPts[h] = 0; });
      positions.forEach((w, idx) => {
        if (!w?.house) return;
        let pts = 0;
        if (w.customScore !== undefined) {
          pts = w.customScore;
        } else {
          const sys = isTarikTali ? pointsConfig.tarikTali : isRelay ? pointsConfig.relay : pointsConfig.individu;
          pts = sys[idx] || 0;
        }
        acaraPts[w.house] = (acaraPts[w.house] || 0) + pts;
      });

      rows += `<Row>
        <Cell ss:StyleID="Bold"><Data ss:Type="String">${esc(eventName)}</Data></Cell>
        <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(yearLabel)}</Data></Cell>
        <Cell ss:StyleID="Center"><Data ss:Type="String">${esc(genderLabel)}</Data></Cell>
        <Cell ss:StyleID="${isCompleted ? 'Complete' : 'Pending'}"><Data ss:Type="String">${isCompleted ? 'Selesai' : 'Belum'}</Data></Cell>
        ${houseList.map(h => {
          const pts = acaraPts[h];
          return pts > 0
            ? `<Cell ss:StyleID="${h}"><Data ss:Type="Number">${pts}</Data></Cell>`
            : `<Cell ss:StyleID="Center"><Data ss:Type="String">-</Data></Cell>`;
        }).join('')}
      </Row>`;
    });
    return rows;
  };

  // ─────────────────────────────────────────────────
  // BINA XML WORKBOOK
  // ─────────────────────────────────────────────────
  const titleRow = (colspan: number, text: string) =>
    `<Row><Cell ss:MergeAcross="${colspan}" ss:StyleID="Title"><Data ss:Type="String">${esc(text)}</Data></Cell></Row>`;
  const subtitleRow = (colspan: number, text: string) =>
    `<Row><Cell ss:MergeAcross="${colspan}" ss:StyleID="Header"><Data ss:Type="String">${esc(text)}</Data></Cell></Row>`;
  const emptyRow = (colspan: number) =>
    `<Row><Cell ss:MergeAcross="${colspan}"><Data ss:Type="String"></Data></Cell></Row>`;

  const xlsContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
    <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>
    <Style ss:ID="Center"><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Gold"><Interior ss:Color="#FEF9C3" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#92400E"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Silver"><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#475569"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Bronze"><Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#9A3412"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="MERAH"><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#991B1B"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="BIRU"><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#1E40AF"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="HIJAU"><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#166534"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="KUNING"><Interior ss:Color="#FEF9C3" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#854D0E"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="UNGU"><Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#6B21A8"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="OREN"><Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#9A3412"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Footer"><Interior ss:Color="#1E293B" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#FBB024"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Complete"><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/><Font ss:Color="#166534"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Pending"><Interior ss:Color="#FEF9C3" ss:Pattern="Solid"/><Font ss:Color="#92400E"/><Alignment ss:Horizontal="Center"/></Style>
  </Styles>

  <!-- SHEET 1: SENARAI PESERTA -->
  <Worksheet ss:Name="Senarai Peserta">
    <Table ss:DefaultColumnWidth="80">
      <Column ss:Width="40"/>
      <Column ss:Width="160"/>
      <Column ss:Width="100"/>
      <Column ss:Width="80"/>
      <Column ss:Width="140"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      ${titleRow(7, 'SK ORAN — KEJOHANAN OLAHRAGA TAHUNAN 2026')}
      ${subtitleRow(7, `SENARAI PESERTA PENUH | Dicetak: ${now}`)}
      ${emptyRow(7)}
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">BIL</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">NAMA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">KELAS</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">RUMAH</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">ACARA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TAHUN</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">JANTINA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">JENIS</Data></Cell>
      </Row>
      ${buildSheet1()}
    </Table>
  </Worksheet>

  <!-- SHEET 2: KEPUTUSAN PEMENANG -->
  <Worksheet ss:Name="Keputusan Pemenang">
    <Table ss:DefaultColumnWidth="80">
      <Column ss:Width="40"/>
      <Column ss:Width="140"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="90"/>
      <Column ss:Width="180"/>
      <Column ss:Width="120"/>
      <Column ss:Width="80"/>
      <Column ss:Width="60"/>
      ${titleRow(8, 'SK ORAN — KEJOHANAN OLAHRAGA TAHUNAN 2026')}
      ${subtitleRow(8, `KEPUTUSAN PEMENANG | Dicetak: ${now}`)}
      ${emptyRow(8)}
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">BIL</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">ACARA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TAHUN</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">JANTINA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TEMPAT</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">NAMA / PASUKAN</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">KELAS</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">RUMAH</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">MATA</Data></Cell>
      </Row>
      ${buildSheet2()}
    </Table>
  </Worksheet>

  <!-- SHEET 3: MATA RUMAH SUKAN -->
  <Worksheet ss:Name="Mata Rumah Sukan">
    <Table ss:DefaultColumnWidth="80">
      <Column ss:Width="40"/>
      <Column ss:Width="160"/>
      <Column ss:Width="90"/>
      <Column ss:Width="90"/>
      <Column ss:Width="110"/>
      <Column ss:Width="80"/>
      ${titleRow(5, 'SK ORAN — KEJOHANAN SUKAN OLAHRAGA 2026')}
      ${subtitleRow(5, `KEPUTUSAN MENGIKUT RUMAH SUKAN | Dicetak: ${now}`)}
      ${buildSheet3()}
    </Table>
  </Worksheet>

  <!-- SHEET 4: RINGKASAN ACARA -->
  <Worksheet ss:Name="Ringkasan Acara">
    <Table ss:DefaultColumnWidth="80">
      <Column ss:Width="140"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="90"/>
      ${houseList.map(() => '<Column ss:Width="70"/>').join('')}
      ${titleRow(3 + houseList.length, 'SK ORAN — KEJOHANAN OLAHRAGA TAHUNAN 2026')}
      ${subtitleRow(3 + houseList.length, `RINGKASAN MATA SETIAP ACARA | Dicetak: ${now}`)}
      ${emptyRow(3 + houseList.length)}
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">ACARA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">TAHUN</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">JANTINA</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">STATUS</Data></Cell>
        ${houseList.map(h => `<Cell ss:StyleID="${h}"><Data ss:Type="String">${esc(getHouseName(systemConfig, h))}</Data></Cell>`).join('')}
      </Row>
      ${buildSheet4()}
    </Table>
  </Worksheet>

</Workbook>`;

  // ── Download ──
  const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Backup_Sukan_SKORAN_${dateStr}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const Settings: React.FC<SettingsProps> = ({
  pointsConfig, onUpdatePoints, eventLimits, onUpdateEventLimits,
  systemConfig, onUpdateSystemConfig, accessConfig, onUpdateAccessConfig, accessSession, onLogout,
  registrations, onUpdateRegistration, onBulkRegistration, onBulkOverride, studentRoster, onImportStudentRoster,
  results, onSaveResult, onResetData, stats
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminTab>('registration');
  const [localConfig, setLocalConfig]   = useState<PointsConfig>(pointsConfig);
  const [isSaved, setIsSaved]           = useState(false);
  const [isExporting, setIsExporting]   = useState(false);

  useEffect(() => { setLocalConfig(pointsConfig); }, [pointsConfig]);

  const handleChange = (type: keyof PointsConfig, index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalConfig(prev => { const a = [...prev[type]]; a[index] = numValue; return { ...prev, [type]: a }; });
    setIsSaved(false);
  };

  const handleSavePoints = () => {
    onUpdatePoints(localConfig);
    onUpdateSystemConfig(normalizeSystemConfig(localSystemConfig));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetPoints = () => {
    if (confirm('Adakah anda pasti mahu mengembalikan markah kepada asal?')) {
      const def = { individu: POINTS_INDIVIDUAL, relay: POINTS_RELAY, tarikTali: POINTS_TARIK_TALI };
      setLocalConfig(def);
      onUpdatePoints(def);
    }
  };

  const [localLimits, setLocalLimits]     = useState<EventLimitsConfig>(eventLimits);
  const [isLimitsSaved, setIsLimitsSaved] = useState(false);
  useEffect(() => { setLocalLimits(eventLimits); }, [eventLimits]);

  const [localSystemConfig, setLocalSystemConfig] = useState<SystemConfig>(normalizeSystemConfig(systemConfig));
  const [isSystemConfigSaved, setIsSystemConfigSaved] = useState(false);
  useEffect(() => { setLocalSystemConfig(normalizeSystemConfig(systemConfig)); }, [systemConfig]);

  const [localAccessConfig, setLocalAccessConfig] = useState<AccessConfig>({
    ...DEFAULT_ACCESS_CONFIG,
    ...accessConfig,
    housePasswords: { ...DEFAULT_ACCESS_CONFIG.housePasswords, ...(accessConfig.housePasswords || {}) },
  });
  const [isAccessConfigSaved, setIsAccessConfigSaved] = useState(false);
  const isAdminSession = accessSession.role === 'admin';
  const teacherHouse = accessSession.role === 'house_teacher' ? accessSession.house : undefined;

  useEffect(() => {
    setLocalAccessConfig({
      ...DEFAULT_ACCESS_CONFIG,
      ...accessConfig,
      housePasswords: { ...DEFAULT_ACCESS_CONFIG.housePasswords, ...(accessConfig.housePasswords || {}) },
    });
  }, [accessConfig]);

  useEffect(() => {
    if (!isAdminSession && activeSubTab !== 'registration') {
      setActiveSubTab('registration');
    }
  }, [activeSubTab, isAdminSession]);

  const handleScoringChange = (patch: Partial<NonNullable<SystemConfig['scoring']>>) => {
    setLocalSystemConfig(prev => ({
      ...prev,
      scoring: {
        ...(normalizeSystemConfig(prev).scoring || { mode: 'POINTS', scope: 'ALL_EVENTS' }),
        ...patch,
      },
    }));
    setIsSaved(false);
  };

  const handleLimitsChange = (field: keyof EventLimitsConfig, value: string) => {
    setLocalLimits(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
    setIsLimitsSaved(false);
  };
  const handleSaveLimits = () => {
    onUpdateEventLimits(localLimits);
    setIsLimitsSaved(true);
    setTimeout(() => setIsLimitsSaved(false), 2000);
  };

  const handleHouseCountChange = (value: string) => {
    const count = Math.max(1, Math.min(6, parseInt(value) || 1));
    setLocalSystemConfig(prev => ({
      ...prev,
      houses: prev.houses.map((house, index) => ({ ...house, active: index < count }))
    }));
    setIsSystemConfigSaved(false);
  };

  const handleHouseNameChange = (houseId: HouseColor, name: string) => {
    setLocalSystemConfig(prev => ({
      ...prev,
      houses: prev.houses.map(house => house.id === houseId ? { ...house, name } : house)
    }));
    setIsSystemConfigSaved(false);
  };

  const handleHouseActiveChange = (houseId: HouseColor, active: boolean) => {
    setLocalSystemConfig(prev => ({
      ...prev,
      houses: prev.houses.map(house => house.id === houseId ? { ...house, active } : house)
    }));
    setIsSystemConfigSaved(false);
  };

  const handleCompetitionDateTimeChange = (field: 'date' | 'time', value: string) => {
    setLocalSystemConfig(prev => {
      const current = prev.competitionDateTime || DEFAULT_SYSTEM_CONFIG.competitionDateTime || '2026-05-09T07:00';
      const [datePart, timePart = '07:00'] = current.split('T');
      return {
        ...prev,
        competitionDateTime: field === 'date' ? `${value}T${timePart}` : `${datePart}T${value}`,
      };
    });
    setIsSystemConfigSaved(false);
  };

  const handleEventChange = (eventId: string, patch: Partial<EventSettings>) => {
    setLocalSystemConfig(prev => ({
      ...prev,
      events: prev.events.map(event => event.id === eventId ? { ...event, ...patch } : event)
    }));
    setIsSystemConfigSaved(false);
  };

  const handleEventYearToggle = (eventId: string, year: number, checked: boolean) => {
    setLocalSystemConfig(prev => ({
      ...prev,
      events: prev.events.map(event => {
        if (event.id !== eventId) return event;
        const years = new Set<number>(event.years || []);
        if (checked) years.add(year);
        else years.delete(year);
        return { ...event, years: Array.from(years).sort((a, b) => a - b) };
      }),
    }));
    setIsSystemConfigSaved(false);
  };

  const handleAddEvent = () => {
    const id = `custom_${Date.now()}`;
    const newEvent: EventSettings = {
      id,
      name: 'Acara Baru',
      type: EventType.INDIVIDU,
      maxParticipants: 3,
      years: [1, 2, 3, 4, 5, 6],
      active: true,
      category: 'TAHAP_2',
    };
    setLocalSystemConfig(prev => ({ ...prev, events: [...prev.events, newEvent] }));
    setIsSystemConfigSaved(false);
  };

  const handleDeleteEvent = (eventId: string, eventName: string) => {
    if (!confirm(`Buang acara "${eventName}" daripada senarai? Perubahan hanya disimpan selepas tekan Simpan Tetapan.`)) return;
    setLocalSystemConfig(prev => ({
      ...prev,
      events: prev.events.filter(event => event.id !== eventId),
    }));
    setIsSystemConfigSaved(false);
  };

  const handleSaveSystemConfig = () => {
    onUpdateSystemConfig(normalizeSystemConfig(localSystemConfig));
    setIsSystemConfigSaved(true);
    setTimeout(() => setIsSystemConfigSaved(false), 2000);
  };

  const handleResetSystemConfig = () => {
    if (confirm('Reset konfigurasi rumah sukan dan acara kepada asal?')) {
      setLocalSystemConfig(DEFAULT_SYSTEM_CONFIG);
      onUpdateSystemConfig(DEFAULT_SYSTEM_CONFIG);
    }
  };

  const handleAdminPasswordChange = (password: string) => {
    setLocalAccessConfig(prev => ({ ...prev, adminPassword: password }));
    setIsAccessConfigSaved(false);
  };

  const handleHousePasswordChange = (house: HouseColor, password: string) => {
    setLocalAccessConfig(prev => ({
      ...prev,
      housePasswords: {
        ...prev.housePasswords,
        [house]: password,
      },
    }));
    setIsAccessConfigSaved(false);
  };

  const handleSaveAccessConfig = () => {
    onUpdateAccessConfig({
      ...localAccessConfig,
      adminPassword: localAccessConfig.adminPassword.trim() || DEFAULT_ACCESS_CONFIG.adminPassword,
      housePasswords: { ...DEFAULT_ACCESS_CONFIG.housePasswords, ...localAccessConfig.housePasswords },
    });
    setIsAccessConfigSaved(true);
    setTimeout(() => setIsAccessConfigSaved(false), 2000);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => { exportToExcel(registrations, results, pointsConfig, systemConfig); setIsExporting(false); }, 300);
  };

  const activeStudentYears = [1, 2, 3, 4, 5, 6].filter(year =>
    localSystemConfig.events.some(event =>
      event.active &&
      event.type !== EventType.KHUSUS &&
      event.years.includes(year)
    )
  );
  const hiddenStudentYears = [1, 2, 3, 4, 5, 6].filter(year => !activeStudentYears.includes(year));

  // ── Print Violations PDF ──
  const handlePrintViolations = () => {
    if (violations.length === 0) { alert('Tiada pelanggaran untuk dicetak.'); return; }
    const SCHOOL_LOGO = '/logo-sekolah-oran-transparent.png?v=2';
    const now = new Date().toLocaleDateString('ms-MY', { day:'2-digit', month:'long', year:'numeric' });

    const houseColorMap: Record<string,string> = {
      MERAH:'#ef4444',BIRU:'#3b82f6',HIJAU:'#22c55e',KUNING:'#eab308',UNGU:'#a855f7',OREN:'#f97316'
    };
    const houseBgMap: Record<string,string> = {
      MERAH:'#fee2e2',BIRU:'#dbeafe',HIJAU:'#dcfce7',KUNING:'#fef9c3',UNGU:'#f3e8ff',OREN:'#ffedd5'
    };

    const rowsHTML = violations.map((v, i) => {
      const hcolor = houseColorMap[v.house] || '#64748b';
      const hbg = houseBgMap[v.house] || '#f1f5f9';
      const isIndivOver = v.individualCount > eventLimits.maxIndividual;
      const isRelayOver = v.relayCount > eventLimits.maxRelay;
      const eventsHTML = v.records.map(r =>
        `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:3px;padding:1px 6px;font-size:9px;margin:1px;">${r.eventName}</span>`
      ).join(' ');
      return `
        <tr style="border-bottom:1px solid #e2e8f0;${i%2===0?'background:white':'background:#f8fafc'}">
          <td style="padding:7px 10px;font-size:10px;font-weight:700;color:#1e293b;">${i+1}</td>
          <td style="padding:7px 10px;font-size:10px;font-weight:700;color:#1e293b;">${v.name}</td>
          <td style="padding:7px 10px;font-size:10px;color:#475569;">${v.className||'-'}</td>
          <td style="padding:7px 10px;text-align:center;">
            <span style="font-size:9px;font-weight:700;color:white;background:${hcolor};border-radius:4px;padding:2px 7px;">${getHouseName(systemConfig, v.house as HouseColor)}</span>
          </td>
          <td style="padding:7px 10px;text-align:center;font-size:10px;font-weight:900;color:${isIndivOver?'#dc2626':'#16a34a'}">
            ${v.individualCount}<span style="font-weight:400;color:#94a3b8;font-size:9px"> / ${eventLimits.maxIndividual}</span>
          </td>
          <td style="padding:7px 10px;text-align:center;font-size:10px;font-weight:900;color:${isRelayOver?'#dc2626':'#16a34a'}">
            ${v.relayCount}<span style="font-weight:400;color:#94a3b8;font-size:9px"> / ${eventLimits.maxRelay}</span>
          </td>
          <td style="padding:7px 10px;font-size:9px;">${eventsHTML}</td>
        </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pelanggaran Had Acara</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:Arial,sans-serif;font-size:11px;background:white;color:black; }
  @page { size:A4 landscape;margin:8mm 10mm; }
  @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
  table { width:100%;border-collapse:collapse; }
  th { background:#1e293b;color:white;padding:8px 10px;font-size:10px;font-weight:700;text-align:left; }
  th.center { text-align:center; }
</style></head><body>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;border-bottom:3px solid #000;padding-bottom:8px;">
    <img src="${SCHOOL_LOGO}" style="width:54px;height:54px;object-fit:contain;"/>
    <div style="flex:1;text-align:center;">
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;">Kejohanan Sukan Olahraga SK ORAN 2026</div>
      <div style="font-size:12px;font-weight:bold;text-transform:uppercase;margin-top:2px;">SK ORAN</div>
      <div style="font-size:11px;font-weight:bold;margin-top:3px;background:#dc2626;color:white;padding:2px 10px;display:inline-block;border-radius:4px;">SENARAI PELANGGARAN HAD ACARA</div>
    </div>
    <img src="${SCHOOL_LOGO}" style="width:54px;height:54px;visibility:hidden;"/>
  </div>
  <div style="display:flex;gap:20px;margin-bottom:10px;font-size:10px;background:#fef2f2;padding:6px 12px;border-radius:4px;border:1px solid #fee2e2;">
    <span>Jumlah Pelanggaran: <strong style="color:#dc2626">${violations.length} murid</strong></span>
    <span>Had Individu: <strong>${eventLimits.maxIndividual} acara</strong></span>
    <span>Had Kumpulan: <strong>${eventLimits.maxRelay} acara</strong></span>
    <span style="margin-left:auto">Tarikh Cetak: <strong>${now}</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">BIL</th>
        <th>NAMA MURID</th>
        <th style="width:90px">KELAS</th>
        <th style="width:80px;text-align:center;">RUMAH</th>
        <th style="width:80px;text-align:center;">INDIVIDU</th>
        <th style="width:80px;text-align:center;">KUMPULAN</th>
        <th>ACARA YANG DISERTAI</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <div style="margin-top:15px;font-size:9px;color:#64748b;text-align:right;">
    * Murid yang individu atau kumpulan melebihi had yang ditetapkan
  </div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // ── Violations (had acara) ──
  const violations = React.useMemo(() => {
    const allEvts = activeEvents(systemConfig);
    const map = new Map<string, { name:string; className:string; house:string; individualCount:number; relayCount:number; events:string[] }>();
    Object.entries(registrations).forEach(([key, participants]) => {
      const parts = key.split('_');
      const house = parts[0]; const eventId = parts.slice(3).join('_');
      const eventDef = allEvts.find(e => e.id === eventId);
      if (!eventDef) return;
      (participants as Participant[]).forEach(p => {
        if (!p?.name) return;
        const k = `${p.name.toLowerCase().trim()}_${house}`;
        if (!map.has(k)) map.set(k, { name:p.name, className:p.className, house, individualCount:0, relayCount:0, events:[] });
        else {
          const s = map.get(k)!;
          if (p.className && s.className && !s.className.includes(p.className)) s.className += ` / ${p.className}`;
          else if (!s.className && p.className) s.className = p.className;
        }
        const s = map.get(k)!;
        s.events.push(eventDef.name);
        if (eventDef.type === EventType.INDIVIDU) s.individualCount++;
        else if (eventDef.type === EventType.RELAY) s.relayCount++;
      });
    });
    return Array.from(map.values()).filter(s => s.individualCount > eventLimits.maxIndividual || s.relayCount > eventLimits.maxRelay);
  }, [registrations, eventLimits, systemConfig]);

  // ── Data conflicts ──
  const dataConflicts = React.useMemo(() => {
    const allEvts = activeEvents(systemConfig);
    const map = new Map<string, Array<{ house:string; year:number; gender:string; eventName:string; className:string; rawKey:string }>>();
    Object.entries(registrations).forEach(([key, participants]) => {
      const parts = key.split('_');
      const house = parts[0]; const year = parseInt(parts[1]); const gender = parts[2];
      const eventId = parts.slice(3).join('_');
      const eventDef = allEvts.find(e => e.id === eventId);
      if (!eventDef) return;
      (participants as Participant[]).forEach(p => {
        if (!p?.name) return;
        const n = p.name.toLowerCase().trim();
        if (!map.has(n)) map.set(n, []);
        map.get(n)!.push({ house, year, gender, eventName: eventDef.name, className: p.className, rawKey: key });
      });
    });
    const conflicts: Array<{ name:string; issues:string[]; records:any[] }> = [];
    map.forEach((records, name) => {
      if (records.length <= 1) return;
      const issues: string[] = [];
      const houses  = new Set(records.map(r => r.house));
      const classes  = new Set(records.map(r => r.className?.toLowerCase().trim()));
      if (houses.size > 1)  issues.push(`Berbeza Rumah Sukan (${Array.from(houses).join(', ')})`);
      if (classes.size > 1) issues.push(`Berbeza Kelas (${Array.from(new Set(records.map(r => r.className))).join(', ')})`);
      const evCounts = new Map<string, number>();
      records.forEach(r => { const k = `${r.eventName} (Tahun ${r.year} ${r.gender})`; evCounts.set(k, (evCounts.get(k) || 0) + 1); });
      evCounts.forEach((cnt, k) => { if (cnt > 1) issues.push(`Didaftar ${cnt} kali: ${k}`); });
      if (issues.length > 0) {
        const originalName = registrations[records[0].rawKey]?.find(p => p.name?.toLowerCase().trim() === name)?.name || name;
        conflicts.push({ name: originalName, issues, records });
      }
    });
    return conflicts;
  }, [registrations, systemConfig]);

  // ── Stats untuk backup ──
  const totalPeserta = React.useMemo(() => {
    const names = new Set<string>();
    Object.entries(registrations).forEach(([key, ps]) => {
      const house = key.split('_')[0];
      (ps as Participant[]).forEach(p => { if (p?.name) names.add(`${p.name.toLowerCase().trim()}_${house}`); });
    });
    return names.size;
  }, [registrations]);
  const totalAcara       = Object.keys(results).length;
  const totalPendaftaran = Object.values(registrations).reduce((a: number, b: any) => a + (Array.isArray(b) ? b.length : 0), 0);

  const renderPointsInputs = (type: keyof PointsConfig, title: string, icon: React.ReactNode) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${type==='individu'?'bg-blue-100 text-blue-600':type==='relay'?'bg-purple-100 text-purple-600':'bg-orange-100 text-orange-600'}`}>{icon}</div>
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">
              Tempat Ke-{i+1}{i<3&&<span className="ml-1 text-yellow-500">★</span>}
            </label>
            <input type="number" min="0" value={localConfig[type]?.[i]||0}
              onChange={e=>handleChange(type,i,e.target.value)}
              className="border border-gray-300 rounded-lg p-3 text-center text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"/>
          </div>
        ))}
      </div>
    </div>
  );

  const houseColor = (house: string) =>
    house==='MERAH'?'bg-red-100 text-red-700':house==='BIRU'?'bg-blue-100 text-blue-700':
    house==='HIJAU'?'bg-green-100 text-green-700':house==='KUNING'?'bg-yellow-100 text-yellow-700':
    house==='UNGU'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700';

  const houseDot = (house: string) =>
    house==='MERAH'?'bg-red-500':house==='BIRU'?'bg-blue-500':house==='HIJAU'?'bg-green-500':
    house==='KUNING'?'bg-yellow-400':house==='UNGU'?'bg-purple-500':'bg-orange-500';

  const setupTabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id:'system_config', icon:<SettingsIcon className="w-4 h-4"/>, label:'Rumah & Acara' },
    { id:'config', icon:<LayoutGrid className="w-4 h-4"/>, label:'Sistem Mata' },
    { id:'limits', icon:<ShieldAlert className="w-4 h-4"/>, label:'Had Acara Murid' },
    { id:'access', icon:<KeyRound className="w-4 h-4"/>, label:'Akses Guru' },
  ];
  const visibleSetupTabs = isAdminSession ? setupTabs : [];
  const isSetupTab = visibleSetupTabs.some(tab => tab.id === activeSubTab);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden sticky top-24">
            <div className="p-4 bg-slate-900 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5"/> Panel Admin</h2>
              <p className="text-xs text-slate-400 mt-1">
                {isAdminSession ? 'Pengurusan data & sistem' : `Guru Rumah ${teacherHouse ? getHouseName(systemConfig, teacherHouse) : ''}`}
              </p>
            </div>
            <nav className="p-2 space-y-1">
              {isAdminSession && (
                <>
                  <button onClick={()=>setActiveSubTab('system_config')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${isSetupTab?'bg-blue-50 text-blue-700':'text-gray-600 hover:bg-gray-50'}`}>
                    <SettingsIcon className="w-5 h-5"/> Tetapan Sistem
                  </button>
                  <div className="h-px bg-gray-200 my-2 mx-4"/>
                </>
              )}
              {[
                { id:'registration', icon:<ClipboardList className="w-5 h-5"/>, label:isAdminSession ? 'Pendaftaran (Manual)' : 'Daftar Rumah Saya' },
                ...(isAdminSession ? [
                  { id:'import',       icon:<FileSpreadsheet className="w-5 h-5"/>, label:'Import CSV (Pukal)' },
                  { id:'results_entry',icon:<Trophy className="w-5 h-5"/>,        label:'Masuk Keputusan' },
                  { id:'competition_form',icon:<Printer className="w-5 h-5"/>,    label:'Borang Pertandingan' },
                ] : []),
              ].map(tab=>(
                <button key={tab.id} onClick={()=>setActiveSubTab(tab.id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${activeSubTab===tab.id?'bg-blue-50 text-blue-700':'text-gray-600 hover:bg-gray-50'}`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
              {isAdminSession && (
                <>
                  <div className="h-px bg-gray-200 my-2 mx-4"/>
                  <button onClick={()=>setActiveSubTab('backup')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${activeSubTab==='backup'?'bg-green-50 text-green-700':'text-gray-600 hover:bg-green-50 hover:text-green-600'}`}>
                    <Download className="w-5 h-5"/> Backup Excel
                  </button>
                  <button onClick={()=>setActiveSubTab('system')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${activeSubTab==='system'?'bg-red-50 text-red-700':'text-gray-600 hover:bg-red-50 hover:text-red-600'}`}>
                    <Database className="w-5 h-5"/> Pengurusan Data
                  </button>
                </>
              )}
              <div className="h-px bg-gray-200 my-2 mx-4"/>
              <button onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg text-gray-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                <LogOut className="w-5 h-5"/> Log Keluar
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {activeSubTab==='registration'  && <div className="animate-fadeIn"><RegistrationForm registrations={registrations} studentRoster={studentRoster} allowedHouse={teacherHouse} onUpdateRegistration={onUpdateRegistration} eventLimits={eventLimits} systemConfig={systemConfig}/></div>}
          {isAdminSession && activeSubTab==='import'        && <div className="animate-fadeIn"><CsvImport existingRegistrations={registrations} studentRoster={studentRoster} onImportStudentRoster={onImportStudentRoster} onBulkRegistration={onBulkRegistration} onBulkOverride={onBulkOverride} eventLimits={eventLimits} systemConfig={systemConfig}/></div>}
          {isAdminSession && activeSubTab==='results_entry' && <div className="animate-fadeIn"><ResultsEntry existingResults={results} registrations={registrations} onSaveResult={onSaveResult} stats={stats} pointsConfig={pointsConfig} systemConfig={systemConfig}/></div>}
          {isAdminSession && activeSubTab==='competition_form' && <div className="animate-fadeIn"><CompetitionForm registrations={registrations} systemConfig={systemConfig}/></div>}

          {isSetupTab&&(
            <div className="mb-4 bg-white border border-gray-200 rounded-xl shadow-sm p-2 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {visibleSetupTabs.map(tab=>(
                  <button
                    key={tab.id}
                    type="button"
                    onClick={()=>setActiveSubTab(tab.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black transition-all ${
                      activeSubTab===tab.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BACKUP EXCEL */}
          {isAdminSession && activeSubTab==='backup'&&(
            <div className="animate-fadeIn space-y-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 bg-slate-900 text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Download className="w-6 h-6 text-green-400"/> Backup Data ke Excel</h2>
                  <p className="text-slate-400 text-sm mt-1">Export semua data sistem ke dalam fail Excel (.xls)</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
                  {[
                    { label:'Jumlah Murid',    value:totalPeserta,     color:'blue',   icon:'👤' },
                    { label:'Rekod Daftar',    value:totalPendaftaran, color:'purple', icon:'📋' },
                    { label:'Acara Selesai',   value:totalAcara,       color:'green',  icon:'🏆' },
                    { label:'Sheet Excel',     value:4,                color:'orange', icon:'📊' },
                  ].map(s=>(
                    <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-4 text-center`}>
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className={`text-2xl font-black text-${s.color}-700`}>{s.value}</div>
                      <div className={`text-xs font-bold text-${s.color}-600 uppercase tracking-wider`}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="font-black text-gray-800 text-lg">📁 Kandungan Fail Excel:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { sheet:'Sheet 1', name:'Senarai Peserta',     desc:'Nama, kelas, rumah, acara, tahun, jantina',          color:'blue',   icon:'👥' },
                      { sheet:'Sheet 2', name:'Keputusan Pemenang',  desc:'Tempat 1-6, nama pemenang, rumah, dan mata',         color:'yellow', icon:'🏅' },
                      { sheet:'Sheet 3', name:'Mata Rumah Sukan',    desc:'Kedudukan, jumlah pingat dan mata setiap rumah',     color:'green',  icon:'📊' },
                      { sheet:'Sheet 4', name:'Ringkasan Acara',     desc:'Mata setiap rumah untuk setiap acara',              color:'purple', icon:'📋' },
                    ].map(s=>(
                      <div key={s.sheet} className={`flex gap-3 p-4 bg-${s.color}-50 border border-${s.color}-200 rounded-xl`}>
                        <div className="text-2xl flex-shrink-0">{s.icon}</div>
                        <div>
                          <div className={`font-black text-${s.color}-800 text-sm`}>{s.sheet}: {s.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 border-t border-gray-200 bg-green-50">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-green-800">Sedia untuk diexport!</div>
                      <div className="text-sm text-green-700">Fail: <code className="bg-green-100 px-1 rounded">Backup_Sukan_SKORAN_{new Date().toISOString().slice(0,10)}.xls</code></div>
                    </div>
                    <button onClick={handleExport} disabled={isExporting}
                      className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black text-lg text-white shadow-xl transition-all transform hover:-translate-y-1 ${isExporting?'bg-gray-400 cursor-wait':'bg-green-600 hover:bg-green-700'}`}>
                      <Download className="w-6 h-6"/>
                      {isExporting?'Menjana...':'Export Excel Sekarang'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RUMAH & ACARA */}
          {isAdminSession && activeSubTab==='system_config'&&(
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tetapan Rumah Sukan & Acara</h2>
                  <p className="text-sm text-gray-500">Ubah rumah aktif, nama rumah, acara pertandingan, jenis acara, tahun, dan slot atlet.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleResetSystemConfig} className="text-sm flex items-center gap-2 text-red-500 hover:text-red-700 font-bold px-3 py-2 rounded-lg hover:bg-red-50">
                    <RotateCcw className="w-4 h-4"/> Reset Asal
                  </button>
                  <button onClick={handleSaveSystemConfig}
                    className={`flex items-center px-5 py-2 rounded-lg text-white font-bold shadow-md transition-all ${isSystemConfigSaved?'bg-green-600':'bg-blue-600 hover:bg-blue-700'}`}>
                    <Save className="w-4 h-4 mr-2"/>{isSystemConfigSaved?'Disimpan!':'Simpan Tetapan'}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white border-b border-gray-200">
                <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="mb-3">
                    <h3 className="text-lg font-black text-blue-950">Tarikh & Masa Kejohanan</h3>
                    <p className="text-sm text-blue-800">Tetapan ini digunakan untuk countdown di dashboard utama.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block">Tarikh Hari Kejohanan</label>
                      <input
                        type="date"
                        value={(localSystemConfig.competitionDateTime || DEFAULT_SYSTEM_CONFIG.competitionDateTime || '2026-05-09T07:00').split('T')[0]}
                        onChange={e=>handleCompetitionDateTimeChange('date', e.target.value)}
                        className="w-full border border-blue-200 rounded-lg p-3 text-base font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block">Masa Mula Kejohanan</label>
                      <input
                        type="time"
                        value={(localSystemConfig.competitionDateTime || DEFAULT_SYSTEM_CONFIG.competitionDateTime || '2026-05-09T07:00').split('T')[1]?.slice(0,5) || '07:00'}
                        onChange={e=>handleCompetitionDateTimeChange('time', e.target.value)}
                        className="w-full border border-blue-200 rounded-lg p-3 text-base font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-6 mb-6">
                  <div className="w-full md:w-64">
                    <label className="text-sm font-bold text-gray-700 mb-2 block">Bilangan Rumah Sukan Aktif</label>
                    <input type="number" min="1" max="6" value={localSystemConfig.houses.filter(house=>house.active).length}
                      onChange={e=>handleHouseCountChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <p className="text-xs text-gray-500 mt-1">Maksimum 6 warna sedia ada.</p>
                  </div>
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex-1">
                    Nota: menukar bilangan/nama rumah tidak memadam data lama. Kalau nyahaktif rumah, data lama masih berada di Firebase tetapi tidak digunakan dalam borang baru.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {localSystemConfig.houses.map((house, index)=>(
                    <div key={house.id} className={`rounded-xl border p-4 ${house.active?'bg-white border-gray-200':'bg-gray-50 border-gray-200 opacity-70'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${HOUSE_CONFIG[house.id].color}`}></div>
                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Rumah {index+1}</div>
                            <div className="font-black text-gray-800">{HOUSE_CONFIG[house.id].name}</div>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                          <input type="checkbox" checked={house.active} onChange={e=>handleHouseActiveChange(house.id, e.target.checked)}/>
                          Aktif
                        </label>
                      </div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Paparan</label>
                      <input type="text" value={house.name} onChange={e=>handleHouseNameChange(house.id,e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"/>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Senarai Acara Dipertandingkan</h3>
                    <p className="text-sm text-gray-500">Tick tahun yang terlibat untuk setiap acara. Pilih <code>Terbuka</code> untuk acara kategori umum.</p>
                  </div>
                  <button onClick={handleAddEvent} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">
                    + Tambah Acara
                  </button>
                </div>

                {hiddenStudentYears.length > 0 && (
                  <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"/>
                    <div>
                      <div className="font-black text-amber-900">Makluman: Tab Tahun Tersembunyi</div>
                      <p className="text-sm text-amber-800 leading-relaxed mt-1">
                        Tahun {hiddenStudentYears.join(', ')} tidak mempunyai acara murid yang aktif. Tab tahun tersebut tidak akan muncul dalam Pendaftaran Peserta dan Jaguh Pingat Terunggul.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {localSystemConfig.events.map(event=>(
                    <div key={event.id} className={`bg-white border rounded-xl p-4 ${event.active?'border-gray-200':'border-gray-200 opacity-70'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <label className="md:col-span-1 flex items-center gap-2 text-xs font-bold text-gray-600 pb-2">
                          <input type="checkbox" checked={event.active} onChange={e=>handleEventChange(event.id,{active:e.target.checked})}/>
                          Aktif
                        </label>
                        <div className="md:col-span-4 xl:col-span-3">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Acara</label>
                          <input type="text" value={event.name} onChange={e=>handleEventChange(event.id,{name:e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold"/>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Jenis</label>
                          <select value={event.type} onChange={e=>handleEventChange(event.id,{type:e.target.value as EventType})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white">
                            <option value={EventType.INDIVIDU}>Individu</option>
                            <option value={EventType.RELAY}>Relay</option>
                            <option value={EventType.KHUSUS}>Khas / Mata Manual</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kategori</label>
                          <select value={event.category} onChange={e=>handleEventChange(event.id,{category:e.target.value as EventSettings['category']})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white">
                            <option value="TAHAP_1">Tahap 1</option>
                            <option value="TAHAP_2">Tahap 2</option>
                            <option value="TERBUKA">Terbuka</option>
                          </select>
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Atlet / Rumah</label>
                          <input type="number" min="0" value={event.maxParticipants} onChange={e=>handleEventChange(event.id,{maxParticipants:parseInt(e.target.value)||0})}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm font-bold"/>
                        </div>
                        <div className="md:col-span-1">
                          <button
                            type="button"
                            onClick={()=>handleDeleteEvent(event.id,event.name)}
                            className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-black text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4"/>
                            Buang
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Tahun Terlibat</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          {[1, 2, 3, 4, 5, 6, 0].map(year => {
                            const checked = event.years.includes(year);
                            return (
                              <label
                                key={`${event.id}-${year}`}
                                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-all ${
                                  checked
                                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e=>handleEventYearToggle(event.id, year, e.target.checked)}
                                  className="sr-only"
                                />
                                {year === 0 ? 'Terbuka' : `Tahun ${year}`}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AKSES GURU */}
          {isAdminSession && activeSubTab==='access'&&(
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><KeyRound className="w-6 h-6 text-blue-600"/> Tetapan Password Guru Rumah</h2>
                  <p className="text-sm text-gray-500">Tetapkan password untuk admin dan guru rumah sukan. Guru hanya boleh daftar peserta rumah masing-masing.</p>
                </div>
                <button onClick={handleSaveAccessConfig}
                  className={`flex items-center px-5 py-2 rounded-lg text-white font-bold shadow-md transition-all ${isAccessConfigSaved?'bg-green-600':'bg-blue-600 hover:bg-blue-700'}`}>
                  <Save className="w-4 h-4 mr-2"/>{isAccessConfigSaved?'Disimpan!':'Simpan Password'}
                </button>
              </div>
              <div className="p-6 space-y-6 bg-gray-50">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-black text-amber-900">Penting</div>
                  <p className="mt-1 leading-relaxed">
                    Jangan guna password yang sama untuk dua rumah sukan. Jika password guru dikosongkan, guru rumah tersebut tidak boleh login.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="text-sm font-black text-slate-700 mb-2 block">Password Admin Utama</label>
                  <input
                    type="text"
                    value={localAccessConfig.adminPassword}
                    onChange={e=>handleAdminPasswordChange(e.target.value)}
                    className="w-full max-w-lg rounded-lg border border-slate-300 p-3 text-base font-bold tracking-wide outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Password admin"
                  />
                  <p className="mt-2 text-xs text-slate-500">Admin boleh akses semua tetapan, import, keputusan, backup dan pengurusan data.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {localSystemConfig.houses.map((house, index)=> {
                    const active = house.active;
                    return (
                      <div key={house.id} className={`rounded-xl border p-5 shadow-sm ${active?'bg-white border-gray-200':'bg-gray-50 border-gray-200 opacity-70'}`}>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl ${HOUSE_CONFIG[house.id].color}`}></div>
                            <div>
                              <div className="text-xs font-black uppercase text-gray-400">Rumah {index+1}</div>
                              <div className="font-black text-gray-900">{getHouseName(localSystemConfig, house.id)}</div>
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${active?'bg-green-100 text-green-700':'bg-gray-200 text-gray-500'}`}>
                            {active ? 'AKTIF' : 'TIDAK AKTIF'}
                          </span>
                        </div>
                        <label className="text-xs font-black uppercase tracking-wide text-gray-500 block mb-1">Password Guru Rumah</label>
                        <input
                          type="text"
                          value={localAccessConfig.housePasswords?.[house.id] || ''}
                          onChange={e=>handleHousePasswordChange(house.id, e.target.value)}
                          disabled={!active}
                          className="w-full rounded-lg border border-gray-300 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                          placeholder={active ? `Password guru ${getHouseName(localSystemConfig, house.id)}` : 'Rumah tidak aktif'}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Guru ini hanya boleh daftar peserta Rumah {getHouseName(localSystemConfig, house.id)}.
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SISTEM MATA */}
          {isAdminSession && activeSubTab==='config'&&(
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Konfigurasi Sistem Mata</h2>
                  <p className="text-sm text-gray-500">Tetapkan markah bagi setiap kedudukan.</p>
                </div>
                <button onClick={handleResetPoints} className="text-sm flex items-center gap-2 text-red-500 hover:text-red-700 font-medium">
                  <RotateCcw className="w-4 h-4"/> Reset Asal
                </button>
              </div>
              <div className="p-6 bg-gray-50">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Kaedah Kiraan Keseluruhan</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Pilihan ini menentukan cara ranking dashboard, senarai keputusan dan jumlah rumah sukan dikira.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
                      {localSystemConfig.scoring?.mode === 'MEDALS' ? 'Kiraan Pingat' : 'Kiraan Mata'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                    {[
                      {
                        mode: 'POINTS' as const,
                        title: 'Kiraan Mata',
                        desc: 'Ranking ikut markah tempat pertama hingga keenam seperti jadual mata di bawah.',
                        accent: 'blue',
                      },
                      {
                        mode: 'MEDALS' as const,
                        title: 'Kiraan Pingat',
                        desc: 'Ranking ikut emas, kemudian perak, kemudian gangsa. Mata manual tidak menentukan kedudukan.',
                        accent: 'yellow',
                      },
                    ].map(option => {
                      const active = (localSystemConfig.scoring?.mode || 'POINTS') === option.mode;
                      return (
                        <button
                          type="button"
                          key={option.mode}
                          onClick={() => handleScoringChange({ mode: option.mode })}
                          className={`text-left rounded-xl border p-4 transition-all ${active ? option.accent === 'blue' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-100' : 'bg-white border-gray-200 hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? option.accent === 'blue' ? 'border-blue-600' : 'border-yellow-500' : 'border-gray-300'}`}>
                              {active && <div className={`w-2.5 h-2.5 rounded-full ${option.accent === 'blue' ? 'bg-blue-600' : 'bg-yellow-500'}`} />}
                            </div>
                            <div className="font-black text-gray-900">{option.title}</div>
                          </div>
                          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{option.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 block">Acara yang dikira dalam jumlah keseluruhan</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {[
                        {
                          scope: 'ALL_EVENTS' as const,
                          title: 'Semua acara',
                          desc: 'Kira Merentas Desa, Sukantara, Olahraga, Tarik Tali dan acara khas lain.',
                        },
                        {
                          scope: 'ATHLETICS_ONLY' as const,
                          title: 'Olahraga sahaja',
                          desc: 'Kira acara olahraga individu dan relay sahaja. Acara khas tidak masuk jumlah keseluruhan.',
                        },
                      ].map(option => {
                        const active = (localSystemConfig.scoring?.scope || 'ALL_EVENTS') === option.scope;
                        return (
                          <button
                            type="button"
                            key={option.scope}
                            onClick={() => handleScoringChange({ scope: option.scope })}
                            className={`text-left rounded-xl border p-4 transition-all ${active ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100' : 'bg-white border-gray-200 hover:border-slate-300'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-emerald-600' : 'border-gray-300'}`}>
                                {active && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                              </div>
                              <div className="font-black text-gray-900">{option.title}</div>
                            </div>
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{option.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {renderPointsInputs('individu', 'Acara Individu', <Award className="w-6 h-6"/>)}
                {renderPointsInputs('relay', 'Acara Relay (Berpasukan)', <Users className="w-6 h-6"/>)}
                {renderPointsInputs('tarikTali', 'Acara Tarik Tali', <Anchor className="w-6 h-6"/>)}
                <div className="flex justify-end pt-4">
                  <button onClick={handleSavePoints}
                    className={`flex items-center px-8 py-3 rounded-lg text-white font-bold text-lg shadow-lg transition-all transform hover:-translate-y-1 ${isSaved?'bg-green-600':'bg-slate-900 hover:bg-slate-800'}`}>
                    <Save className="w-5 h-5 mr-2"/>{isSaved?'Disimpan!':'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HAD ACARA */}
          {isAdminSession && activeSubTab==='limits'&&(
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-200 bg-slate-50">
                <h2 className="text-xl font-bold text-gray-900">Tetapan Had Acara Murid</h2>
                <p className="text-sm text-gray-500">Tetapkan bilangan maksimum acara yang boleh disertai.</p>
              </div>
              <div className="p-6 bg-white border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="text-sm font-bold text-gray-700 mb-2">Had Maksimum Acara Individu</label>
                    <input type="number" min="0" value={localLimits.maxIndividual} onChange={e=>handleLimitsChange('maxIndividual',e.target.value)}
                      className="border border-gray-300 rounded-lg p-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <p className="text-xs text-gray-500 mt-1">Contoh: 2 atau 3 acara individu seorang.</p>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-bold text-gray-700 mb-2">Had Maksimum Acara Kumpulan (Relay)</label>
                    <input type="number" min="0" value={localLimits.maxRelay} onChange={e=>handleLimitsChange('maxRelay',e.target.value)}
                      className="border border-gray-300 rounded-lg p-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <p className="text-xs text-gray-500 mt-1">Contoh: 1 atau 2 acara kumpulan seorang.</p>
                  </div>
                </div>
                <div className="flex justify-end pt-6">
                  <button onClick={handleSaveLimits}
                    className={`flex items-center px-6 py-2 rounded-lg text-white font-bold shadow-md transition-all ${isLimitsSaved?'bg-green-600':'bg-blue-600 hover:bg-blue-700'}`}>
                    <Save className="w-4 h-4 mr-2"/>{isLimitsSaved?'Disimpan!':'Simpan Tetapan'}
                  </button>
                </div>
              </div>
              <div className="p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-red-700 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Senarai Pelanggaran Had Acara</h3>
                  {violations.length > 0 && (
                    <button onClick={handlePrintViolations}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm text-white transition-all hover:-translate-y-0.5 shadow-md"
                      style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',boxShadow:'0 4px 12px rgba(220,38,38,0.3)'}}>
                      <Printer className="w-4 h-4"/>Cetak PDF
                    </button>
                  )}
                </div>
                {violations.length===0?(
                  <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                    <p className="font-medium">Tiada murid yang melebihi had acara yang ditetapkan.</p>
                  </div>
                ):(
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                      <thead className="bg-red-50 text-red-800 text-sm">
                        <tr><th className="p-3 font-bold">Nama</th><th className="p-3 font-bold">Kelas</th><th className="p-3 font-bold">Rumah</th><th className="p-3 font-bold text-center">Individu</th><th className="p-3 font-bold text-center">Kumpulan</th><th className="p-3 font-bold">Acara</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {violations.map((v,i)=>(
                          <tr key={i} className="hover:bg-red-50/50">
                            <td className="p-3 font-medium text-gray-900">{v.name}</td>
                            <td className="p-3 text-gray-600">{v.className}</td>
                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${houseColor(v.house)}`}>{v.house}</span></td>
                            <td className="p-3 text-center"><span className={`font-bold ${v.individualCount>eventLimits.maxIndividual?'text-red-600':'text-gray-600'}`}>{v.individualCount}</span><span className="text-gray-400 text-xs ml-1">/ {eventLimits.maxIndividual}</span></td>
                            <td className="p-3 text-center"><span className={`font-bold ${v.relayCount>eventLimits.maxRelay?'text-red-600':'text-gray-600'}`}>{v.relayCount}</span><span className="text-gray-400 text-xs ml-1">/ {eventLimits.maxRelay}</span></td>
                            <td className="p-3 text-gray-600 text-xs">{v.events.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PENGURUSAN DATA */}
          {isAdminSession && activeSubTab==='system'&&(
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn flex flex-col gap-6">
              <div className="p-6 border-b border-gray-200 bg-slate-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Database className="w-6 h-6"/> Pengurusan Data</h2>
                <p className="text-sm text-gray-500">Semak ralat data dan urus pangkalan data sistem.</p>
              </div>
              <div className="p-6 bg-white">
                <h3 className="text-lg font-bold text-orange-700 flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5"/> Semakan Data Bertindan (Konflik)</h3>
                <p className="text-sm text-gray-600 mb-4">Sistem menyemak jika terdapat murid yang didaftarkan dalam pelbagai rumah sukan, kelas yang berbeza, atau didaftarkan berulang kali dalam acara yang sama.</p>
                {dataConflicts.length===0?(
                  <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                    <p className="font-medium">Tiada data bertindan atau konflik dikesan.</p>
                  </div>
                ):(
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm border border-orange-100">
                      <thead className="bg-orange-50 text-orange-800 text-sm">
                        <tr><th className="p-3 font-bold">Nama</th><th className="p-3 font-bold">Isu</th><th className="p-3 font-bold">Butiran</th></tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100 text-sm">
                        {dataConflicts.map((c,i)=>(
                          <tr key={i} className="hover:bg-orange-50/30">
                            <td className="p-3 font-bold text-gray-900 align-top">{c.name}</td>
                            <td className="p-3 align-top"><ul className="list-disc list-inside text-red-600 font-medium text-xs space-y-1">{c.issues.map((iss,ii)=><li key={ii}>{iss}</li>)}</ul></td>
                            <td className="p-3 align-top">
                              <div className="flex flex-col gap-1">
                                {c.records.map((r,ri)=>(
                                  <div key={ri} className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${houseDot(r.house)}`}/>
                                    <strong>{r.house}</strong> | {r.className} | {r.eventName} (Thn {r.year} {r.gender})
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 bg-red-50">
                <div className="border border-red-200 rounded-xl p-6">
                  <h3 className="font-bold text-red-900 text-lg mb-2 flex items-center gap-2"><Trash2 className="w-5 h-5"/> Kosongkan Semua Data</h3>
                  <p className="text-red-800 text-sm leading-relaxed mb-4">
                    Pilih data yang mahu dipadam. Setiap tindakan akan minta pengesahan dahulu kerana data yang dipadam tidak boleh dikembalikan.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ResetButton
                      title="Padam Peserta"
                      description="Buang semua nama peserta dan pendaftaran acara. Keputusan sedia ada tidak dipadam."
                      confirmText="YA, PADAM PESERTA"
                      onConfirm={() => onResetData('participants')}
                    />
                    <ResetButton
                      title="Padam Keputusan"
                      description="Padam semua keputusan pertandingan. Data peserta masih kekal."
                      confirmText="YA, PADAM KEPUTUSAN"
                      onConfirm={() => onResetData('results')}
                    />
                    <ResetButton
                      title="Padam Semua"
                      description="Padam semua peserta dan semua keputusan. Markah rumah sukan akan kembali kepada 0."
                      confirmText="YA, PADAM SEMUA"
                      onConfirm={() => onResetData('all')}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResetButton = ({
  title,
  description,
  confirmText,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
}) => {
  const [step, setStep] = useState<'idle'|'confirm'>('idle');
  useEffect(() => {
    if (step==='confirm') { const t = setTimeout(()=>setStep('idle'), 5000); return ()=>clearTimeout(t); }
  }, [step]);
  if (step==='confirm') return (
    <div className="rounded-xl border-2 border-red-500 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"/>
        <div>
          <div className="font-black text-red-900">Pengesahan diperlukan</div>
          <p className="text-xs text-red-700 leading-relaxed mt-1">{description}</p>
        </div>
      </div>
      <button type="button" onClick={onConfirm}
        className="w-full bg-red-800 hover:bg-red-900 text-white font-black py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 animate-pulse">
        <AlertTriangle className="w-5 h-5"/> {confirmText}
      </button>
      <button type="button" onClick={()=>setStep('idle')} className="w-full mt-2 text-xs font-bold text-gray-500 hover:text-gray-800">
        Batal
      </button>
    </div>
  );
  return (
    <button type="button" onClick={()=>setStep('confirm')}
      className="text-left rounded-xl border border-red-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md active:translate-y-0">
      <div className="flex items-center gap-2 font-black text-red-800">
        <Trash2 className="w-5 h-5"/> {title}
      </div>
      <p className="text-xs text-red-700 leading-relaxed mt-2">{description}</p>
    </button>
  );
};

export default Settings;
