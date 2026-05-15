import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, Info, ArrowRight, RefreshCw } from 'lucide-react';
import { HouseColor, Gender, Participant, EventLimitsConfig, EventType, SystemConfig, StudentRosterEntry } from '../types';
import { DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, activeHouseIds, formatCompetitionGroupLabel, getEventCompetitionGroup, getHouseName } from '../utils/systemConfig';

interface CsvImportProps {
  onBulkRegistration: (newRegistrations: Record<string, Participant[]>) => void;
  onImportStudentRoster: (newRoster: StudentRosterEntry[]) => void;
  eventLimits?: EventLimitsConfig;
  existingRegistrations?: Record<string, Participant[]>;
  studentRoster?: StudentRosterEntry[];
  onBulkOverride?: (newRegistrations: Record<string, Participant[]>) => void;
  systemConfig?: SystemConfig;
}

interface ConflictParticipant extends Participant {
  source: 'existing' | 'new';
  selected: boolean;
  id: string;
}

interface ConflictEvent {
  key: string;
  eventName: string;
  house: string;
  year: number;
  gender: string;
  limit: number;
  participants: ConflictParticipant[];
}

const CsvImport: React.FC<CsvImportProps> = ({ onBulkRegistration, onImportStudentRoster, onBulkOverride, eventLimits, existingRegistrations = {}, studentRoster = [], systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const [importMode, setImportMode] = useState<'registrations' | 'roster'>('registrations');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'conflict' | 'done'>('upload');
  const [successCount, setSuccessCount] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [readyRegistrations, setReadyRegistrations] = useState<Record<string, Participant[]>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseFileForPreview(selectedFile);
    }
  };

  // Helper to parse CSV line respecting quotes and delimiter
  const parseCSVLine = (text: string, delimiter: string) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes;
        } else if (text[i] === delimiter && !inQuotes) {
            let field = text.substring(start, i).trim();
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.substring(1, field.length - 1);
            }
            result.push(field);
            start = i + 1;
        }
    }
    let lastField = text.substring(start).trim();
    if (lastField.startsWith('"') && lastField.endsWith('"')) {
        lastField = lastField.substring(1, lastField.length - 1);
    }
    result.push(lastField);
    return result;
  };

  const parseFileForPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Remove BOM

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      // Detect Delimiter (Comma or Semicolon)
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const delimiter = semiCount > commaCount ? ';' : ',';

      // Parse first few lines
      const rows = lines.slice(0, 6).map(line => parseCSVLine(line, delimiter));
      
      setHeaders(rows[0]);
      setParsedRows(rows.slice(1));
      setStep('preview');
      setErrorLog([]);
    };
    reader.readAsText(file);
  };

  const resolveHouse = (houseRaw: string) => activeHouseIds(systemConfig).find(h =>
    h === houseRaw.toUpperCase().trim() ||
    getHouseName(systemConfig, h).toLowerCase() === houseRaw.toLowerCase().trim()
  );

  const parseGenderValue = (genderRaw: string) => {
    const value = genderRaw.trim().toUpperCase();
    if (value.startsWith('L') || value.includes('LELAKI')) return Gender.LELAKI;
    if (value.startsWith('P') || value.includes('PEREMPUAN')) return Gender.PEREMPUAN;
    return undefined;
  };

  const parseYearValue = (yearRaw: string, classRaw: string) => {
    const direct = parseInt(yearRaw);
    if (!Number.isNaN(direct) && direct >= 1 && direct <= 6) return direct;
    const fromClass = classRaw.match(/[1-6]/)?.[0];
    return fromClass ? parseInt(fromClass) : undefined;
  };

  const findHeaderIndex = (headerRow: string[], patterns: string[]) =>
    headerRow.findIndex(header => patterns.some(pattern => header.includes(pattern)));

  const handleConfirmRosterImport = (text: string, delimiter: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const headerRow = parseCSVLine(lines[0].toLowerCase(), delimiter);
    const idxHouse = findHeaderIndex(headerRow, ['rumah']);
    const idxName = findHeaderIndex(headerRow, ['nama', 'murid', 'peserta']);
    const idxClass = findHeaderIndex(headerRow, ['kelas']);
    const idxYear = findHeaderIndex(headerRow, ['tahun']);
    const idxGender = findHeaderIndex(headerRow, ['jantina']);
    const errors: string[] = [];
    const newRoster: StudentRosterEntry[] = [];

    if (idxHouse === -1 || idxName === -1) {
      errors.push("Gagal mengesan kolum 'Rumah' dan 'Nama Murid'. Sila pastikan header betul.");
      setErrorLog(errors);
      setIsProcessing(false);
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const houseRaw = cols[idxHouse] || '';
      const nameRaw = cols[idxName] || '';
      const classRaw = idxClass >= 0 ? (cols[idxClass] || '') : '';
      const yearRaw = idxYear >= 0 ? (cols[idxYear] || '') : '';
      const genderRaw = idxGender >= 0 ? (cols[idxGender] || '') : '';

      if (!houseRaw.trim() && !nameRaw.trim()) continue;

      const house = resolveHouse(houseRaw);
      if (!house) { errors.push(`Baris ${i + 1}: Rumah '${houseRaw}' tidak sah.`); continue; }

      const name = nameRaw.replace(/\s+/g, ' ').trim();
      const className = classRaw.replace(/\s+/g, ' ').trim();
      if (!name) { errors.push(`Baris ${i + 1}: Nama murid kosong.`); continue; }

      newRoster.push({
        house,
        name,
        className,
        year: parseYearValue(yearRaw, className),
        gender: parseGenderValue(genderRaw),
      });
    }

    if (newRoster.length > 0) onImportStudentRoster(newRoster);
    setSuccessCount(newRoster.length);
    setErrorLog(errors);
    setStep('done');
    setIsProcessing(false);
  };

  const handleConfirmImport = () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorLog([]);
    setSuccessCount(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      // Detect Delimiter again
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const delimiter = semiCount > commaCount ? ';' : ',';

      if (importMode === 'roster') {
        handleConfirmRosterImport(text, delimiter);
        return;
      }

      const newRegistrations: Record<string, Participant[]> = {};
      const errors: string[] = [];
      let processed = 0;

      // Determine Column Indices based on Header
      const headerRow = parseCSVLine(lines[0].toLowerCase(), delimiter);
      
      // Default indices
      let idxHouse = 0, idxYear = 1, idxGender = 2, idxEvent = 3, idxName = 4, idxClass = 5;

      // Dynamic mapping if headers exist
      if (headerRow.some(h => h.includes('rumah'))) {
          idxHouse = headerRow.findIndex(h => h.includes('rumah'));
          idxYear = headerRow.findIndex(h => h.includes('tahun'));
          idxGender = headerRow.findIndex(h => h.includes('jantina'));
          idxEvent = headerRow.findIndex(h => h.includes('acara'));
          
          // FIX: Prioritize 'peserta' or 'murid'. If using 'nama', ensure it is NOT 'nama acara'
          idxName = headerRow.findIndex(h => h.includes('peserta') || h.includes('murid'));
          if (idxName === -1) {
             // Find index of 'nama' but exclude the one that is 'nama acara' (which equals idxEvent)
             idxName = headerRow.findIndex((h, idx) => h.includes('nama') && idx !== idxEvent);
          }
          
          idxClass = headerRow.findIndex(h => h.includes('kelas'));
      }

      // Check if critical columns found
      if (idxHouse === -1 || idxName === -1 || idxEvent === -1) {
          errors.push("Gagal mengesan kolum 'Rumah', 'Nama Peserta', atau 'Acara'. Sila pastikan header betul.");
          setErrorLog(errors);
          setIsProcessing(false);
          return;
      }

      // Process Data Rows (Skip header)
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], delimiter);
        
        if (cols.length < 3) continue; // Skip empty/malformed lines

        const houseRaw = cols[idxHouse] || '';
        const yearRaw = cols[idxYear] || '0';
        const genderRaw = cols[idxGender] || '';
        const eventNameRaw = cols[idxEvent] || '';
        const nameRaw = cols[idxName] || '';
        const classRaw = cols[idxClass] || '';

        // Check if row is effectively empty (Excel often adds rows with just commas)
        if (!houseRaw.trim() && !nameRaw.trim() && !eventNameRaw.trim()) {
            continue;
        }

        // Validation & Logic (Same as before)
        const name = nameRaw.replace(/\s+/g, ' ').trim(); 
        const className = classRaw.replace(/\s+/g, ' ').trim();

        // SAFETY CHECK: Ensure Name is not an Event Name (Common mapping error)
        const isLikelyEventName = /^(100m|200m|4x|lompat|lontar|80m)/i.test(name);
        if (isLikelyEventName) {
             errors.push(`Baris ${i + 1}: Nama '${name}' kelihatan seperti nama acara. Mungkin kolum tertukar.`);
             continue;
        }

        const houseKey = activeHouseIds(systemConfig).find(h =>
          h === houseRaw.toUpperCase() ||
          getHouseName(systemConfig, h).toLowerCase() === houseRaw.toLowerCase().trim()
        );
        if (!houseKey) { errors.push(`Baris ${i + 1}: Rumah '${houseRaw}' tidak sah.`); continue; }

        const year = parseInt(yearRaw);
        if (isNaN(year)) { errors.push(`Baris ${i + 1}: Tahun '${yearRaw}' tidak sah.`); continue; }

        const gender = genderRaw.toUpperCase().startsWith('L') ? 'L' : genderRaw.toUpperCase().startsWith('P') ? 'P' : '';
        if (!gender) { errors.push(`Baris ${i + 1}: Jantina '${genderRaw}' tidak sah.`); continue; }

        const normalizeEventName = (str: string) => {
          return str.toLowerCase()
            .replace(/meter/g, 'm')
            .replace(/khas/g, '')
            .replace(/lariberpagar/gi, 'lari berpagar')
            .replace(/\s+/g, '')
            .trim();
        };

        const allEvents = activeEvents(systemConfig);
        const eventList = allEvents.filter(event => event.years.includes(year));
        
        const normRaw = normalizeEventName(eventNameRaw);
        
        let targetEvent = eventList.find(e => 
            normalizeEventName(e.name) === normRaw ||
            e.id === eventNameRaw
        );
        
        if (!targetEvent) {
             targetEvent = allEvents.find(e => 
                normalizeEventName(e.name) === normRaw ||
                e.id === eventNameRaw
             );
        }

        if (!targetEvent) { errors.push(`Baris ${i + 1}: Acara '${eventNameRaw}' tidak dijumpai.`); continue; }

          const limit = eventLimits?.eventSlots?.[targetEvent.id] ?? targetEvent.maxParticipants;
          
          const group = getEventCompetitionGroup(targetEvent);
          const key = `${houseKey}_${group.key}_${gender}_${targetEvent.id}`;
          if (!newRegistrations[key]) newRegistrations[key] = [];

          // Remove the naive limit check here so we can catch overrides in the conflict stage
          const exists = newRegistrations[key].find(p => p.name.toLowerCase() === name.toLowerCase());
          if (!exists) {
              newRegistrations[key].push({ name, className });
              processed++;
          }
      }

      const allEvents = activeEvents(systemConfig);
      const getEventName = (eventId: string) => allEvents.find(e => e.id === eventId)?.name || eventId;
      const resolveHouseName = (houseId: string) => getHouseName(systemConfig, houseId);

      const conflictsList: ConflictEvent[] = [];
      const nonConflicting: Record<string, Participant[]> = {};
      let hasConflictingImports = false;

      Object.entries(newRegistrations).forEach(([key, newList]) => {
          const parts = key.split('_');
          const house = parts[0];
          const yearRaw = parts[1];
          const gender = parts[2];
          const eventId = parts.slice(3).join('_');

          const eventDef = allEvents.find(e => e.id === eventId);
          const limit = eventLimits?.eventSlots?.[eventId] ?? eventDef?.maxParticipants ?? 99;
          
          const existingList = existingRegistrations[key] || [];
          const validExisting = existingList.filter(p => p && p.name);

          const mergedList: ConflictParticipant[] = [];
          let idCounter = 0;
          
          const newNamesLower = newList.map(n => n.name.toLowerCase());

          validExisting.forEach(p => {
              const inNewCsv = newNamesLower.includes(p.name.toLowerCase());
              mergedList.push({ ...p, source: 'existing', selected: inNewCsv, id: `ex_${idCounter++}` });
          });

          let newCount = 0;
          newList.forEach(p => {
              const exists = mergedList.find(e => e.name.toLowerCase() === p.name.toLowerCase());
              if (!exists) {
                  mergedList.push({ ...p, source: 'new', selected: true, id: `nw_${idCounter++}` });
                  newCount++;
              }
          });

          const hasMissingExisting = validExisting.some(p => !newNamesLower.includes(p.name.toLowerCase()));

          // Show conflict if there are new people AND existing people (overlap) OR if total exceeds limit
          if ((validExisting.length > 0 && newCount > 0) || hasMissingExisting || mergedList.length > limit) {
              hasConflictingImports = true;
              // If it exceeds limit, auto-deselect to fit limit initially (optional, but good UX)
              let selectedCount = 0;
              mergedList.forEach(m => {
                  if (m.selected) {
                      if (selectedCount < limit) selectedCount++;
                      else m.selected = false;
                  }
              });

              conflictsList.push({
                  key,
                  eventName: getEventName(eventId),
                  house: resolveHouseName(house),
                  year: parseInt(yearRaw),
                  gender,
                  limit,
                  participants: mergedList
              });
          } else {
              // Direct import
              nonConflicting[key] = mergedList.map(m => ({ name: m.name, className: m.className }));
          }
      });

      if (hasConflictingImports) {
          setConflicts(conflictsList);
          setReadyRegistrations(nonConflicting);
          setStep('conflict');
          setIsProcessing(false);
          return;
      }

      if (processed > 0) {
          onBulkRegistration(nonConflicting);
      }
      
      setSuccessCount(processed);
      setErrorLog(errors);
      setStep('done');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const reset = () => {
      setFile(null);
      setParsedRows([]);
      setStep('upload');
      setErrorLog([]);
      setSuccessCount(0);
  };

  const downloadTemplate = () => {
    const csvContent = importMode === 'roster'
      ? "Rumah Sukan,Tahun,Jantina,Nama Murid,Kelas\nMERAH,1,L,Ali bin Abu,1 Bestari\nMERAH,1,P,Siti Aminah,1 Cemerlang\nBIRU,4,L,Adam Hakimi,4 Cerdik"
      : "Rumah Sukan,Tahun,Jantina,Acara,Nama Peserta,Kelas\nMERAH,1,L,80m,Ali bin Abu,1 Bestari\nBIRU,4,P,100m,Siti Aminah,4 Cemerlang\nHIJAU,0,C,Tarik Tali,Bakar bin Kadir,Guru / Staf";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', importMode === 'roster' ? 'Template_Senarai_Murid_Rumah.csv' : 'Template_Pendaftaran_Peserta.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResolveConflicts = () => {
      setIsProcessing(true);
      const finalRegistrations: Record<string, Participant[]> = {};
      
      conflicts.forEach(c => {
         const selected = c.participants.filter(p => p.selected).map(p => ({ name: p.name, className: p.className }));
         finalRegistrations[c.key] = selected;
      });

      const combined = { ...readyRegistrations, ...finalRegistrations };
      
      if (onBulkOverride) {
          onBulkOverride(combined);
      } else {
          onBulkRegistration(combined);
      }
      
      setSuccessCount(Object.values(combined).flat().length);
      setStep('done');
      setIsProcessing(false);
  };

  const toggleConflictParticipant = (eventKey: string, participantId: string) => {
      setConflicts(prev => prev.map(c => {
          if (c.key !== eventKey) return c;
          return {
              ...c,
              participants: c.participants.map(p => {
                  if (p.id === participantId) return { ...p, selected: !p.selected };
                  return p;
              })
          };
      }));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
           <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-green-600" />
              Import Peserta / Senarai Murid (CSV)
           </h2>
           {step === 'upload' && (
             <button
               onClick={downloadTemplate}
               className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors border border-slate-300 text-sm"
             >
               <Download className="w-4 h-4" />
               Muat Turun Template
             </button>
           )}
        </div>

        <div className="p-6">
           {step === 'upload' && (
             <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   {
                     mode: 'registrations' as const,
                     title: 'Import Peserta dan Acara',
                     desc: 'CSV lengkap: rumah, tahun, jantina, acara, nama murid dan kelas. Sistem terus masukkan peserta ke acara.',
                   },
                   {
                     mode: 'roster' as const,
                     title: 'Import Nama Murid dan Rumah Sukan',
                     desc: 'CSV senarai murid mengikut rumah. Nama akan muncul sebagai dropdown dalam pendaftaran manual.',
                   },
                 ].map(option => (
                   <button
                     key={option.mode}
                     type="button"
                     onClick={() => { setImportMode(option.mode); setFile(null); setParsedRows([]); }}
                     className={`rounded-xl border p-4 text-left transition-all ${
                       importMode === option.mode
                         ? 'border-blue-500 bg-blue-50 shadow-sm'
                         : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                     }`}
                   >
                     <div className="font-black text-gray-900">{option.title}</div>
                     <p className="mt-1 text-sm leading-relaxed text-gray-600">{option.desc}</p>
                   </button>
                 ))}
               </div>
               <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 bg-gray-50 hover:bg-white transition-colors">
                  <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
                  <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <span className="text-sm font-medium text-gray-700">Klik untuk pilih fail CSV</span>
                  </label>
                  <p
                    className="text-xs text-gray-400 mt-2 hover:underline cursor-help"
                    title={importMode === 'roster' ? 'Rumah Sukan, Tahun, Jantina, Nama Murid, Kelas' : 'Rumah Sukan, Tahun, Jantina, Acara, Nama Peserta, Kelas'}
                  >
                    Format: {importMode === 'roster' ? 'Rumah, Tahun, Jantina, Nama Murid, Kelas' : 'Rumah, Tahun, Jantina, Acara, Nama, Kelas'}
                  </p>
                  
                  <div className="mt-8 bg-blue-50/50 text-blue-800 p-4 rounded-xl border border-blue-100 text-sm max-w-lg text-center shadow-sm">
                     <b className="block mb-1 text-blue-900">Info Tambahan:</b>
                     {importMode === 'roster'
                       ? `Senarai murid sedia ada: ${studentRoster.length}. Selepas import, pergi ke Pendaftaran Manual dan pilih nama murid daripada dropdown.`
                       : 'Mahu masukkan data separuh-separuh? Boleh! Anda boleh muat naik beberapa fail CSV yang berbeza secara berasingan. Sistem akan mengesan senarai nama bertindan dan memberi anda pilihan untuk mengekalkan nama yang mana.'}
                  </div>
               </div>
             </div>
           )}

           {step === 'preview' && (
               <div className="animate-fadeIn">
                   <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                       <Info className="w-5 h-5 text-blue-500" /> Semak Data (5 Baris Pertama)
                   </h3>
                   <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                       Mod dipilih: {importMode === 'roster' ? 'Import Nama Murid dan Rumah Sukan' : 'Import Peserta dan Acara'}
                   </div>
                   <div className="overflow-x-auto border rounded-lg mb-6">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-gray-100 uppercase text-xs font-bold text-gray-600">
                               <tr>
                                   {headers.map((h, i) => <th key={i} className="px-4 py-2 border-b">{h}</th>)}
                               </tr>
                           </thead>
                           <tbody>
                               {parsedRows.map((row, i) => (
                                   <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                       {row.map((cell, j) => <td key={j} className="px-4 py-2">{cell}</td>)}
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
                   <div className="flex gap-3">
                       <button onClick={reset} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Batal</button>
                       <button onClick={handleConfirmImport} disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2">
                           {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                           Sahkan & Import {importMode === 'roster' ? 'Senarai Murid' : 'Pendaftaran'}
                       </button>
                   </div>
               </div>
           )}

           {step === 'conflict' && (
               <div className="animate-fadeIn space-y-6">
                   <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-orange-900">
                      <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-5 h-5 text-orange-500" /> Pengesahan Nama Bertindan
                      </h3>
                      <p className="text-sm">
                          Acara berikut telah melebihi had maksima atau mempunyai senarai nama baru yang berbeza dengan data sedia ada. 
                          Sila pilih nama peserta yang anda ingin <b>kekalkan</b> dalam acara tersebut. 
                          Peserta yang tidak ditanda akan dibuang dari senarai acara ini.
                      </p>
                   </div>
                   
                   <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                      {conflicts.map(c => {
                          const limitExceeded = c.participants.filter(p => p.selected).length > c.limit;
                          return (
                              <div key={c.key} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                      <div>
                                          <h4 className="font-bold text-slate-800">{c.eventName}</h4>
                                          <p className="text-xs font-bold text-slate-500">{c.house} - {formatCompetitionGroupLabel(c.year).toUpperCase()} - {c.gender === 'L' ? 'LELAKI' : 'PEREMPUAN'}</p>
                                      </div>
                                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${limitExceeded ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                          Dipilih: {c.participants.filter(p => p.selected).length} / {c.limit} Maksima
                                      </div>
                                  </div>
                                  <div className="divide-y divide-gray-100">
                                      {c.participants.map(p => (
                                          <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${p.selected ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                                              <button 
                                                  onClick={() => toggleConflictParticipant(c.key, p.id)}
                                                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${p.selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}
                                              >
                                                  <CheckCircle className="w-4 h-4" />
                                              </button>
                                              <div className="flex-1">
                                                  <p className={`text-sm font-bold ${p.selected ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{p.name}</p>
                                                  <p className="text-xs text-gray-500">{p.className}</p>
                                              </div>
                                              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${p.source === 'new' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                  {p.source === 'new' ? 'Data Baru (CSV)' : 'Data Sedia Ada'}
                                              </span>
                                          </div>
                                      ))}
                                  </div>
                                  {limitExceeded && (
                                    <div className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold flex items-center gap-2 border-t border-red-100">
                                      <AlertTriangle className="w-4 h-4" /> Amaran: Peserta dipilih melebihi kuota ({c.limit}).
                                    </div>
                                  )}
                              </div>
                          );
                      })}
                   </div>

                   <div className="flex gap-3 pt-4 border-t border-gray-200">
                       <button onClick={reset} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Batal Semua</button>
                       <button onClick={handleResolveConflicts} disabled={isProcessing} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm flex-1">
                           {isProcessing ? 'Menyimpan...' : 'Sahkan Pilihan & Simpan Pendaftaran'}
                       </button>
                   </div>
               </div>
           )}

           {step === 'done' && (
               <div className="text-center py-8 animate-fadeIn">
                   <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${errorLog.length === 0 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                       {errorLog.length === 0 ? <CheckCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                   </div>
                   <h3 className="text-2xl font-bold text-gray-900 mb-2">Selesai!</h3>
                   <p className="text-gray-600 mb-6">
                       {importMode === 'roster'
                         ? <>Senarai murid rumah sukan telah dikemas kini. Terdapat <strong>{successCount}</strong> nama murid diimport.</>
                         : <>Data pendaftaran acara telah dikemas kini. Terdapat <strong>{successCount}</strong> peserta diimport.</>}
                   </p>
                   
                   {errorLog.length > 0 && (
                       <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-left max-h-60 overflow-y-auto mb-6 mx-auto max-w-2xl">
                           <h4 className="font-bold text-orange-800 text-xs uppercase mb-2">Terdapat Ralat (Senarai tidak diimport kerana ralat):</h4>
                           <ul className="space-y-1">
                               {errorLog.map((e, i) => <li key={i} className="text-xs text-orange-700 font-mono">{e}</li>)}
                           </ul>
                       </div>
                   )}

                   <button onClick={reset} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">
                       Import Fail Lain
                   </button>
               </div>
           )}
        </div>
    </div>
  );
};

export default CsvImport;
