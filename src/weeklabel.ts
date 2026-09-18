/**
 * Libellé lisible d'une clé de semaine "YYYY-Www" — portage de `weekLabel`
 * (plazma-schedule.html). Ex : "2026-W38" → "S38 · 15 sept. – 21 sept. 2026".
 */
export function weekLabel(value: string): string {
  const [yr, wk] = value.split('-W').map(Number);
  if (!yr || !wk) return value;
  const base = new Date(yr, 0, 1 + (wk - 1) * 7);
  const day = base.getDay();
  const mon = new Date(base);
  mon.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `S${wk} · ${fmt(mon)} – ${fmt(sun)} ${yr}`;
}
