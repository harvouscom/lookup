// Parses the two stored formats ("Sun 10:30 AM" and OSM's "Su 08:00, 10:30; Mo-Fr 19:00") into slots.
// Anything else keeps its raw text with `parsed: false`.

export interface ServiceSlot { dayOfWeek: number; startTime: string }
export interface ServiceTimes { raw: string | null; slots: ServiceSlot[]; parsed: boolean }

const DAY: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, we: 3, wed: 3, th: 4, thu: 4, fr: 5, fri: 5, sa: 6, sat: 6 };

function parseDays(text: string): number[] | null {
  const out = new Set<number>();
  for (const part of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split("-").map((s) => DAY[s.trim().toLowerCase()]);
    if (a === undefined) return null;
    if (part.includes("-")) {
      if (b === undefined) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
    } else out.add(a);
  }
  return out.size ? [...out] : null;
}

function parseClock(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?(?:\s*-\s*\d{1,2}:\d{2})?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const p = m[3]?.toLowerCase();
  if (p === "pm" && h !== 12) h += 12;
  if (p === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseServiceTimes(raw: string | null): ServiceTimes {
  if (!raw) return { raw: null, slots: [], parsed: false };
  const seen = new Map<string, ServiceSlot>();
  for (const seg of raw.split(";").map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^([A-Za-z]{2,3}(?:\s*[-,]\s*[A-Za-z]{2,3})*)\s+(.+)$/);
    const days = m?.[1] ? parseDays(m[1]) : null;
    if (!m?.[2] || !days) return { raw, slots: [], parsed: false };
    for (const t of m[2].split(",")) {
      const startTime = parseClock(t);
      if (!startTime) return { raw, slots: [], parsed: false };
      for (const dayOfWeek of days) seen.set(`${dayOfWeek}@${startTime}`, { dayOfWeek, startTime });
    }
  }
  const slots = [...seen.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  return { raw, slots, parsed: slots.length > 0 };
}
