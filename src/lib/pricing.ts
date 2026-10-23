const BUSINESS_HOURS = { start: 8, end: 20 };
const RATE_CARD = {
  L1: {
    label: "L1 Engineer",
    hourly: 1e3,
    minHours: 4,
    minCharge: 4e3,
    offHoursMin: 6e3,
    offHoursHourly: 2e3,
    card: "RC-2026-FE-L1"
  },
  L2: {
    label: "L2 Engineer",
    hourly: 1500,
    minHours: 4,
    minCharge: 6e3,
    offHoursMin: 9e3,
    offHoursHourly: 2500,
    card: "RC-2026-FE-L2"
  }
};
const PRIORITIES = {
  P0: { label: "P0 \u2014 Critical (High)", multiplier: 1.35, dispatchFee: 2500, sla: "Engineer allotted in 15\u201320 min \xB7 on site within 2\u20133 hours", scheduled: false },
  P1: { label: "P1 \u2014 High", multiplier: 1.15, dispatchFee: 1e3, sla: "Engineer allotted same day", scheduled: true },
  P2: { label: "P2 \u2014 Standard", multiplier: 1, dispatchFee: 0, sla: "Scheduled as per selected slot", scheduled: true }
};
const PLATFORM_FEE = 200;
const AMC_DISCOUNT = 1200;
const GST_RATE = 0.18;
const CANCELLATION_FEE = 1e3;
const MATERIAL_CATALOGUE = [
  { name: "Cat6A cable (per box)", rate: 6500 },
  { name: "LC-LC patch cord", rate: 850 },
  { name: "Managed switch port module", rate: 3200 },
  { name: "PVC conduit (per 10 m)", rate: 450 },
  { name: "Copper wire bundle", rate: 1200 }
];
const inr = (n: number) => `\u20B9 ${Math.round(n).toLocaleString("en-IN")}`;
function isOffHours(startHour: number, hours: number): boolean {
  const end = startHour + hours;
  return startHour < BUSINESS_HOURS.start || end > BUSINESS_HOURS.end;
}
type Grade = "L1" | "L2";
type PriorityCode = "P0" | "P1" | "P2";
export type Material = { name: string; rate: number; qty: number };
export type QuoteInput = {
  grade: Grade | "L1+L2" | string;
  l1Count: number;
  l2Count: number;
  hours: number;
  days?: number;
  startHour: number;
  priority: PriorityCode | string;
  mode: "Active" | "Passive" | string;
  materials: Material[];
  amcLinked: boolean;
};
type Line = { label: string; note: string; amount: number | null; hint?: string };
function computeQuote(input: QuoteInput) {
  const { grade, hours, startHour, priority, mode, materials, amcLinked } = input;
  const days = input.days ?? 1;
  const p = PRIORITIES[priority as PriorityCode];
  const offHours = p.scheduled ? isOffHours(startHour, hours) : false;
  const counts: [Grade, number][] = grade === "L1" ? [["L1", input.l1Count]] : grade === "L2" ? [["L2", input.l2Count]] : [["L1", input.l1Count], ["L2", input.l2Count]];
  const lines: Line[] = [];
  let labour = 0;
  for (const [key, count] of counts) {
    if (count <= 0) continue;
    const r = RATE_CARD[key];
    const base = offHours ? r.offHoursMin : r.minCharge;
    const extraHours = Math.max(0, hours - r.minHours);
    const extra = extraHours * (offHours ? r.offHoursHourly : r.hourly);
    const subtotal = (base + extra) * count * days;
    labour += subtotal;
    lines.push({
      label: `${r.label} \xD7 ${count}`,
      note: `${offHours ? "Off-hours minimum" : "Minimum block"} ${r.minHours} hr \u2014 ${inr(base)}${extraHours ? ` + ${extraHours} extra hr \xD7 ${inr(offHours ? r.offHoursHourly : r.hourly)}` : ""}${days > 1 ? ` \xD7 ${days} days` : ""} \xB7 ${r.card}`,
      amount: subtotal
    });
  }
  const prioritySurcharge = labour * (p.multiplier - 1);
  if (prioritySurcharge > 0) lines.push({ label: `${priority} priority surcharge`, note: `${Math.round((p.multiplier - 1) * 100)}% on labour`, amount: prioritySurcharge });
  if (p.dispatchFee > 0) lines.push({ label: "Emergency dispatch fee", note: p.sla, amount: p.dispatchFee });
  const materialTotal = mode === "Active" ? materials.reduce((s, m) => s + m.rate * m.qty, 0) : 0;
  const materialLines: Line[] = mode === "Passive" ? [{ label: "Material / spares", note: "Passive engagement \u2014 no materials billed", amount: null, hint: "Nil" }] : materials.filter((m) => m.qty > 0).map((m) => ({ label: m.name, note: `${inr(m.rate)} \xD7 ${m.qty}`, amount: m.rate * m.qty }));
  if (mode === "Active" && !materialLines.length) materialLines.push({ label: "Material / spares", note: "No items added yet", amount: 0 });
  const subTotal = labour + prioritySurcharge + p.dispatchFee + materialTotal + PLATFORM_FEE;
  const discount = amcLinked ? AMC_DISCOUNT : 0;
  const taxable = Math.max(0, subTotal - discount);
  const gst = taxable * GST_RATE;
  return {
    lines,
    materialLines,
    offHours,
    priority: p,
    labour,
    prioritySurcharge,
    dispatchFee: p.dispatchFee,
    materialTotal,
    platform: PLATFORM_FEE,
    subTotal,
    discount,
    gst,
    total: taxable + gst
  };
}
const IN_SCOPE = [
  "Certified engineer travel to site within city limits",
  "Diagnostics, configuration and restoration of reported issue",
  "Standard tools, ladder and safety equipment",
  "Digital job card, geo-tagged photos and completion certificate"
];
const OUT_OF_SCOPE = [
  "Civil / masonry work and false-ceiling restoration",
  "OEM hardware replacement cost and licences",
  "Inter-city travel, lodging and toll for remote sites",
  "Work beyond the booked duration (billed per extra hour)"
];
export {
  AMC_DISCOUNT,
  BUSINESS_HOURS,
  CANCELLATION_FEE,
  GST_RATE,
  IN_SCOPE,
  MATERIAL_CATALOGUE,
  OUT_OF_SCOPE,
  PLATFORM_FEE,
  PRIORITIES,
  RATE_CARD,
  computeQuote,
  inr,
  isOffHours
};

/** Split a GST-inclusive total into taxable value and GST (18%). */
export function splitGst(total: number): { taxable: number; gst: number; total: number } {
  const taxable = Math.round((total / (1 + GST_RATE)) * 100) / 100;
  return { taxable, gst: Math.round((total - taxable) * 100) / 100, total };
}
