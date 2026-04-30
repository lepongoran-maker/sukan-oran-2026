import fs from 'fs';

const path = 'components/Settings.tsx';
let data = fs.readFileSync(path, 'utf8');

const printConflictsCode = `
  const handlePrintConflicts = () => {
    if (dataConflicts.length === 0) { alert('Tiada ralat/konflik untuk dicetak.'); return; }
    const SCHOOL_LOGO = 'https://i.imgur.com/Ic1i65O.png';
    const now = new Date().toLocaleDateString('ms-MY', { day:'2-digit', month:'long', year:'numeric' });

    const houseColorMap: Record<string,string> = {
      MERAH:'#ef4444',BIRU:'#3b82f6',HIJAU:'#22c55e',KUNING:'#eab308',UNGU:'#a855f7',OREN:'#f97316'
    };

    const rowsHTML = dataConflicts.map((c, i) => {
      const issuesHTML = c.issues.map(iss => \`<li>\${iss}</li>\`).join('');
      const recordsHTML = c.records.map(r => {
        const dotColor = houseColorMap[r.house] || '#64748b';
        return \`<div style="margin-bottom:2px;font-size:9px;color:#475569;background:#f8fafc;padding:3px;border-radius:3px;border:1px solid #e2e8f0;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:\${dotColor};margin-right:4px;"></span>
          <strong>\${r.house}</strong> | \${r.className} | \${r.eventName} (Thn \${r.year} \${r.gender})
        </div>\`;
      }).join('');

      return \`
        <tr style="border-bottom:1px solid #e2e8f0;\${i%2===0?'background:white':'background:#f8fafc'}">
          <td style="padding:7px 10px;font-size:10px;font-weight:700;color:#1e293b;vertical-align:top;">\${i+1}</td>
          <td style="padding:7px 10px;font-size:10px;font-weight:700;color:#1e293b;vertical-align:top;">\${c.name}</td>
          <td style="padding:7px 10px;vertical-align:top;">
            <ul style="margin-left:12px;font-size:9px;color:#dc2626;font-weight:700;margin-bottom:0;">\${issuesHTML}</ul>
          </td>
          <td style="padding:7px 10px;vertical-align:top;">\${recordsHTML}</td>
        </tr>\`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { alert('Benarkan popup untuk mencetak.'); return; }
    win.document.write(\`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Semakan Data Bertindan</title>
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
    <img src="\${SCHOOL_LOGO}" style="width:54px;height:54px;object-fit:contain;"/>
    <div style="flex:1;text-align:center;">
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;">Kejohanan Sukan Olahraga SK Bandar Seri Putra 2026</div>
      <div style="font-size:12px;font-weight:bold;text-transform:uppercase;margin-top:2px;">SK Bandar Seri Putra</div>
      <div style="font-size:11px;font-weight:bold;margin-top:3px;background:#ea580c;color:white;padding:2px 10px;display:inline-block;border-radius:4px;">SEMAKAN DATA BERTINDAN (KONFLIK)</div>
    </div>
    <img src="\${SCHOOL_LOGO}" style="width:54px;height:54px;visibility:hidden;"/>
  </div>
  <div style="display:flex;gap:20px;margin-bottom:10px;font-size:10px;background:#fff7ed;padding:6px 12px;border-radius:4px;border:1px solid #ffedd5;">
    <span>Jumlah Konflik Data: <strong style="color:#ea580c">\${dataConflicts.length} murid</strong></span>
    <span style="margin-left:auto">Tarikh Cetak: <strong>\${now}</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">BIL</th>
        <th style="width:200px">NAMA MURID</th>
        <th style="width:250px">ISU / RALAT DATA</th>
        <th>BUTIRAN PENDAFTARAN (RUMAH | KELAS | ACARA)</th>
      </tr>
    </thead>
    <tbody>\${rowsHTML}</tbody>
  </table>
</body></html>\`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };
`;

data = data.replace('  // ── Violations (had acara) ──', printConflictsCode + '\n  // ── Violations (had acara) ──');
fs.writeFileSync(path, data);
