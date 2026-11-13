/** Accepts 9876543210, +91 98765 43210, 919876543210, 09876543210. Returns +91XXXXXXXXXX or null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '')
  if (d.startsWith('+91')) d = d.slice(3)
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? '+91' + d : null
}
