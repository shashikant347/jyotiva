/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, BOM, newlines inside quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false, i = 0
  const endField = () => { row.push(field); field = '' }
  const endRow = () => { endField(); if (row.some(c => c.trim() !== '')) rows.push(row); row = [] }
  while (i < text.length) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false } else field += c
    } else if (c === '"' && field === '') inQ = true
    else if (c === ',') endField()
    else if (c === '\n') endRow()
    else if (c === '\r') { /* ignored, \n ends the row */ }
    else field += c
    i++
  }
  if (inQ) throw new Error('Unclosed quote in CSV')
  if (field !== '' || row.length) endRow()
  return rows
}
