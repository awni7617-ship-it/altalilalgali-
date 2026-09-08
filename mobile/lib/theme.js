/* The same plum-and-rose identity as the website, in native units. */
export const C = {
  plum900: '#4a1528',
  plum800: '#64203a',
  plum700: '#7d2b48',
  plum500: '#b8546f',
  plum100: '#f6dfe6',
  plum50: '#fdf4f7',

  ink: '#2b1f24',
  inkSoft: '#6b565e',
  inkMute: '#9b8890',
  line: '#ece0e4',
  lineSoft: '#f5eef0',
  surface: '#ffffff',
  surface2: '#fbf7f8',
  canvas: '#f8f3f4',

  ok: '#1f7a4d',
  okBg: '#e8f5ee',
  warn: '#9a6410',
  warnBg: '#fdf3e2',
  bad: '#b3261e',
  badBg: '#fdecea',
  slate: '#6b6470',
  slateBg: '#efecf0',
  gold: '#b8892b',
  goldBg: '#f4e6c8',
  whatsapp: '#25D366',
};

export const shadow = {
  shadowColor: '#4a1528',
  shadowOpacity: 0.09,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const money = (n, symbol = '₪') => {
  const v = Number(n) || 0;
  return `${v % 1 === 0 ? v.toLocaleString('en-US') : v.toFixed(2)} ${symbol}`;
};

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};
