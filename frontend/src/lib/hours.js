export const DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const JS_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toMinutes(t) {
  if (!t || typeof t !== "string" || !t.includes(":")) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function hasHours(hours) {
  return hours && typeof hours === "object" && DAYS.some((d) => hours[d.key] && !hours[d.key].closed && hours[d.key].open && hours[d.key].close);
}

// Returns { open: boolean, today: {open, close, closed} | null }
export function openStatus(hours) {
  if (!hasHours(hours)) return { open: false, today: null, unknown: true };
  const now = new Date();
  const key = JS_TO_KEY[now.getDay()];
  const today = hours[key];
  if (!today || today.closed || !today.open || !today.close) return { open: false, today: today || null };
  const cur = now.getHours() * 60 + now.getMinutes();
  const o = toMinutes(today.open);
  const c = toMinutes(today.close);
  if (o == null || c == null) return { open: false, today };
  const isOpen = c > o ? cur >= o && cur < c : cur >= o || cur < c; // supports overnight
  return { open: isOpen, today };
}
