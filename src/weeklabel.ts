/**
 * Libellé lisible d'une clé de semaine "YYYY-Www" — portage de `weekLabel`
 * (plazma-schedule.html). Ex : "2026-W38" → "S38 · 15 sept. – 21 sept. 2026".
 */
function mondaySunday(value: string): { mon: Date; sun: Date } | null {
  const [yr, wk] = value.split('-W').map(Number);
  if (!yr || !wk) return null;
  const base = new Date(yr, 0, 1 + (wk - 1) * 7);
  const day = base.getDay();
  const mon = new Date(base);
  mon.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}

export function weekLabel(value: string): string {
  const r = mondaySunday(value);
  if (!r) return value;
  const wk = Number(value.split('-W')[1]);
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `S${wk} · ${fmt(r.mon)} – ${fmt(r.sun)} ${r.mon.getFullYear()}`;
}

/** "Semaine du 15/09 au 21/09" (lundi → dimanche, JJ/MM). */
export function frenchWeekRange(value: string): string {
  const r = mondaySunday(value);
  if (!r) return value;
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return `Semaine du ${fmt(r.mon)} au ${fmt(r.sun)}`;
}
