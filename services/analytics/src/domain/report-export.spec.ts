import { exportReport, toCsv, toJson, toPdfPayload, toXlsxPayload } from './report-export';

describe('report-export', () => {
  const rows = [
    { metricCode: 'dau', value: 100 },
    { metricCode: 'tx_volume', value: 50 },
  ];

  it('exports JSON', () => {
    const json = toJson(rows);
    expect(JSON.parse(json)).toEqual(rows);
  });

  it('exports CSV with header', () => {
    const csv = toCsv(rows);
    expect(csv.split('\n')[0]).toBe('metricCode,value');
    expect(csv).toContain('dau,100');
  });

  it('returns empty CSV for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('escapes CSV values with commas', () => {
    const csv = toCsv([{ note: 'a,b', value: 1 }]);
    expect(csv).toContain('"a,b"');
  });

  it('returns structured payload for xlsx', () => {
    const payload = toXlsxPayload(rows);
    expect(payload.format).toBe('XLSX');
    expect(payload.rows).toEqual(rows);
    expect(payload.generatedAt).toBeTruthy();
  });

  it('returns structured payload for pdf', () => {
    const payload = toPdfPayload(rows);
    expect(payload.format).toBe('PDF');
  });

  it('routes exportReport by format', () => {
    expect(typeof exportReport('CSV', rows)).toBe('string');
    expect(exportReport('XLSX', rows)).toMatchObject({ format: 'XLSX' });
    expect(exportReport('PDF', rows)).toMatchObject({ format: 'PDF' });
  });
});
