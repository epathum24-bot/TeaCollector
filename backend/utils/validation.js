export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function fail(message, status = 400) {
  throw new HttpError(status, message);
}
export function text(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") fail(`${label} is required.`);
  const result = value.trim();
  if (result.length < min || result.length > max)
    fail(`${label} must contain ${min}–${max} characters.`);
  return result;
}
export function email(value) {
  const result = text(value, "Email", { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    fail("Enter a valid email address.");
  return result;
}
// Convert decimal strings to integers. Money uses cents; weight uses grams.
export function scaled(value, label, decimals = 2, max = 1000000) {
  if (!["number", "string"].includes(typeof value))
    fail(`${label} is required.`);
  const raw = String(value).trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(raw))
    fail(
      `${label} must be a positive number with up to ${decimals} decimal places.`,
    );
  const [whole, fraction = ""] = raw.split(".");
  const units =
    Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(units) || units > max * 10 ** decimals)
    fail(`${label} is too large.`);
  return units;
}
export function areas(value) {
  const items = text(value, "Collection areas", { max: 300 })
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const result = [...new Set(items)];
  if (!result.length || result.length > 10 || result.some((x) => x.length > 50))
    fail("Enter 1–10 collection areas, separated by commas.");
  return result;
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const requestTransitions = Object.freeze({
  pending: ["accepted", "rejected", "cancelled"],
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["assigned", "rejected", "cancelled"],
  assigned: ["on_the_way", "rejected", "cancelled"],
  on_the_way: ["collected", "cancelled"],
  collected: ["completed"],
  completed: ["paid"],
  paid: [],
  rejected: [],
  cancelled: [],
});

export function assertTransition(current, next) {
  if (!requestTransitions[current]?.includes(next))
    fail(`A request cannot move from ${current} to ${next}.`, 409);
}
export function collectionDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("Choose a valid collection date.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    fail("Choose a valid collection date.");
  const start = new Date(`${today()}T00:00:00Z`);
  if (parsed < start || parsed - start > 90 * 86400000)
    fail("Collection date must be today or within the next 90 days.");
  return value;
}
export function calculateBill(
  grossGrams,
  rejectedGrams,
  pricePerKgCents,
  otherDeductionGrams,
) {
  if (!Number.isSafeInteger(pricePerKgCents) || pricePerKgCents <= 0)
    fail("Price per kg must be greater than zero.");
  if (!Number.isSafeInteger(grossGrams) || grossGrams <= 0)
    fail("Gross weight must be greater than zero.");
  if (!Number.isSafeInteger(rejectedGrams) || rejectedGrams < 0)
    fail("Rejected weight cannot be negative.");
  if (!Number.isSafeInteger(otherDeductionGrams) || otherDeductionGrams < 0)
    fail("Other deduction cannot be negative.");
  if (rejectedGrams > grossGrams)
    fail("Rejected weight cannot exceed gross weight.");
  if (otherDeductionGrams > grossGrams)
    fail("Other deduction cannot exceed gross weight.");
  const netGrams = grossGrams - rejectedGrams - otherDeductionGrams;
  if (netGrams <= 0)
    fail("Net weight must be greater than zero.");
  const totalCents = Math.floor((netGrams * pricePerKgCents + 500) / 1000);
  return {
    grossGrams,
    rejectedGrams,
    otherDeductionGrams,
    netGrams,
    pricePerKgCents,
    totalCents,
  };
}
