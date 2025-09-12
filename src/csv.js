
export function toCSV(records) {
  const headers = ["GlobalId","IfcClass","Name","PredefinedType","ObjectType","Tag"];
  const lines = [headers.join(',')];
  for (const r of records) {
    const row = [
      r.globalId || '', r.ifcClass || '', escapeCSV(r.name || ''), r.predefinedType || '',
      escapeCSV(r.objectType || ''), r.tag || ''
    ];
    lines.push(row.join(','));
  }
  return lines.join('
');
}
function escapeCSV(s) {
  return (s.includes('"') || s.includes(',') || s.includes('
')) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function downloadCSV(content, filename = 'filtered-elements.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
