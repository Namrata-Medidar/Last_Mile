import { useState } from "react";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { panel, label, money } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { computeQuote, PRIORITIES } from "@/lib/pricing";
import { PricingRulebook } from "./PricingRulebook";

type EngineerLevel = "L1" | "L2" | "L1 + L2";
type PriorityCode = keyof typeof PRIORITIES;
type BookingHours = 4 | 8;
type PointOfContact = { name: string; mobile: string };
type SiteDetails = {
  code: string;
  name: string;
  address: string;
};
const emptyPointOfContact = (): PointOfContact => ({ name: "", mobile: "" });

type BookingFormProps = {
  onBack: () => void;
  onSubmit: (booking: {
    customerType: "existing" | "new";
    level: EngineerLevel;
    count: number;
    priority: PriorityCode;
    total: number;
    gst: number;
    totalPayable: number;
    start_date: string;
    end_date: string;
    duration: "4-hour" | "full-day";
    hours: number;
    startTime: string;
    gpsLocation: string;
    site: SiteDetails;
    contacts: PointOfContact[];
    issueDescription: string;
    workInstructions: string;
  }) => void;
};

export function BookingForm({ onBack, onSubmit }: BookingFormProps) {
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing");
  const [level, setLevel] = useState<EngineerLevel | "">("");
  const [count, setCount] = useState(1);
  const [priority, setPriority] = useState<PriorityCode | "">("");
  const [hours, setHours] = useState<BookingHours | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [gpsLocation, setGpsLocation] = useState("");
  const [showGpsInstructions, setShowGpsInstructions] = useState(false);
  const [site, setSite] = useState<SiteDetails>({ code: "", name: "", address: "" });
  const [pocs, setPocs] = useState<PointOfContact[]>([emptyPointOfContact()]);
  const [issueDescription, setIssueDescription] = useState("");
  const [workInstructions, setWorkInstructions] = useState("");
  const urgent = priority === "P0";
  const chooseLevel = (nextLevel: EngineerLevel | "") => {
    setLevel(nextLevel);
    if (nextLevel === "L1 + L2") setCount(2);
  };
  const updatePoc = (index: number, key: keyof PointOfContact, value: string) => {
    setPocs((currentPocs) => currentPocs.map((poc, pocIndex) => pocIndex === index ? { ...poc, [key]: value } : poc));
  };
  const updateSite = (key: keyof SiteDetails, value: string) => {
    setSite((currentSite) => ({ ...currentSite, [key]: value }));
  };
  const resetBookingFields = () => {
    setLevel("");
    setCount(1);
    setPriority("");
    setHours("");
    setStartDate("");
    setEndDate("");
    setStartTime("10:00");
    setGpsLocation("");
    setSite({ code: "", name: "", address: "" });
    setPocs([emptyPointOfContact()]);
    setIssueDescription("");
    setWorkInstructions("");
  };
  const changeCustomerType = (nextType: "existing" | "new") => {
    setCustomerType(nextType);
    resetBookingFields();
  };
  const dayCount = startDate && endDate
    ? Math.floor((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1
    : 0;
  const validDates = dayCount > 0;
  const validSite = Object.values(site).every((value) => value.trim().length > 0);
  const startHour = Number(startTime.split(":")[0]);
  const quote = level && priority && hours ? computeQuote({
    grade: level === "L1 + L2" ? "L1+L2" : level,
    l1Count: level === "L1" || level === "L1 + L2" ? (level === "L1 + L2" ? 1 : count) : 0,
    l2Count: level === "L2" ? count : level === "L1 + L2" ? 1 : 0,
    hours,
    days: validDates ? dayCount : 1,
    startHour: Number.isFinite(startHour) ? startHour : 10,
    priority,
    mode: "Passive",
    materials: [],
    amcLinked: false
  }) : null;

  return <div className="mx-auto max-w-[1100px] space-y-5 pb-6">
    <div className="flex items-end justify-between">
      <div><p className="text-[10px] font-bold uppercase text-primary">Field engineer support</p><h1 className="mt-2 text-2xl font-semibold">Book a service</h1></div>
      <Button variant="outline" onClick={onBack}><ArrowLeft />Back</Button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <section className={panel}>
        <h2 className="text-sm font-semibold">Customer</h2>
        <div className="mt-4 flex gap-5 text-xs">
          <label className="flex gap-2"><input type="radio" name="customer" value="existing" checked={customerType === "existing"} onChange={() => changeCustomerType("existing")} />Existing customer</label>
          <label className="flex gap-2"><input type="radio" name="customer" value="new" checked={customerType === "new"} onChange={() => changeCustomerType("new")} />New customer</label>
        </div>
      </section>

      <section className={panel}>
        <h2 className="text-sm font-semibold">Engineer requirement</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className={label}>Required engineers *</span><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={level} onChange={(event) => chooseLevel(event.target.value as EngineerLevel | "")}><option value="">Select engineer level</option><option value="L1">L1</option><option value="L2">L2</option><option value="L1 + L2">L1 + L2</option></select></label>
          <label><span className={label}>Priority *</span><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as PriorityCode | "")}><option value="">Select priority</option><option value="P2">{PRIORITIES.P2.label}</option><option value="P1">{PRIORITIES.P1.label}</option><option value="P0">{PRIORITIES.P0.label}</option></select></label>
        </div>
        {urgent && <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs"><strong>{PRIORITIES.P0.label}.</strong> {PRIORITIES.P0.sla}.</p>}
      </section>
    </div>

    <section className={panel}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Site details</h2>
        <button type="button" className="rounded-full text-muted-foreground hover:text-foreground" aria-label="How to find and share the GPS location" aria-expanded={showGpsInstructions} onClick={() => setShowGpsInstructions(true)}>
          <CircleHelp size={18} />
        </button>
      </div>
      <Sheet open={showGpsInstructions} onOpenChange={setShowGpsInstructions}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>GPS location instructions</SheetTitle>
            <SheetDescription>Copy and share the site location using Google Search.</SheetDescription>
          </SheetHeader>
          <ol className="mt-6 list-inside list-decimal space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Open Google Search.</li>
            <li>Search for the site address.</li>
            <li>Find the correct address or location in the search results.</li>
            <li>Click the Share icon, if available.</li>
            <li>Click Copy link.</li>
            <li>Paste the copied link into the GPS location field.</li>
          </ol>
        </SheetContent>
      </Sheet>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label><span className={label}>Site code *</span><Input value={site.code} onChange={(event) => updateSite("code", event.target.value)} placeholder="Enter site code" required /></label>
        <label><span className={label}>Site name *</span><Input value={site.name} onChange={(event) => updateSite("name", event.target.value)} placeholder="Enter site name" required /></label>
        <label><span className={label}>Site address *</span><Input value={site.address} onChange={(event) => updateSite("address", event.target.value)} placeholder="Enter site address" required /></label>
        <label>
          <span className={label}>GPS location</span>
          <Input value={gpsLocation} onChange={(event) => setGpsLocation(event.target.value)} placeholder="Paste GPS coordinates or a map link" />
        </label>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <section className={panel}>
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Site contacts</h2><Button size="sm" variant="outline" onClick={() => setPocs((currentPocs) => [...currentPocs, { name: "", mobile: "" }])}>Add POC</Button></div>
        <div className="mt-4 space-y-3">
          {pocs.map((poc, index) => <div key={index} className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>POC {index + 1} name *</span><Input value={poc.name} onChange={(event) => updatePoc(index, "name", event.target.value)} /></label>
            <label><span className={label}>POC {index + 1} mobile *</span><Input value={poc.mobile} onChange={(event) => updatePoc(index, "mobile", event.target.value)} /></label>
          </div>)}
        </div>
      </section>

      <details className={panel} open>
        <summary className="cursor-pointer text-sm font-semibold">Scheduling</summary>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className={label}>No. of engineers required *</span><Input type="number" min="1" disabled={!level || level === "L1 + L2"} value={count} onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label><span className={label}>Start date *</span><Input type="date" required value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate && event.target.value > endDate) setEndDate(""); }} /></label>
          <label><span className={label}>End date *</span><Input type="date" required min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <label><span className={label}>Booking duration *</span><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={hours} onChange={(event) => setHours(event.target.value ? Number(event.target.value) as BookingHours : "")}><option value="">Select duration</option><option value={4}>4-hour slot</option><option value={8}>Full-day booking (8 hours)</option></select></label>
          <label><span className={label}>Start time *</span><Input type="time" disabled={urgent} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          {validDates && <p className="col-span-2 text-xs text-muted-foreground">{dayCount} {dayCount === 1 ? "day" : "days"} selected{hours ? ` · ${hours}-hour ${hours === 4 ? "slot" : "full-day booking"} per day` : ""}</p>}
        </div>
      </details>
    </div>

    <section className={panel}>
      <h2 className="text-sm font-semibold">Work details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>Issue description *</span><Textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} placeholder="Describe the installation, configuration, or troubleshooting required" required /></label>
        <label><span className={label}>Instructions and equipment to carry</span><Textarea value={workInstructions} onChange={(event) => setWorkInstructions(event.target.value)} placeholder="Add access, safety, tool, or site instructions" /></label>
        <label><span className={label}>Attachments</span><Input type="file" multiple /></label>
      </div>
    </section>

    {level && <PricingRulebook level={level} />}

    <section className={`${panel} sticky bottom-4 z-10 shadow-lg`}>
      <div className="flex flex-col gap-4 p-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-6 sm:justify-start"><span className="text-muted-foreground">{level ? `${count} x ${level}` : "Select engineer level"}{hours ? `, ${hours} hrs/day` : ""} for {validDates ? dayCount : 0} {dayCount === 1 ? "day" : "days"}</span><span>{quote ? money(quote.subTotal) : "—"}</span></div>
          <div className="flex justify-between gap-6 sm:justify-start"><span className="text-muted-foreground">GST (18%)</span><span>{quote ? money(quote.gst) : "—"}</span></div>
        </div>
        <div className="flex items-center gap-4 border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
          <div><p className="text-[10px] text-muted-foreground">Total payable</p><p className="text-lg font-semibold text-primary">{quote ? money(quote.total) : "—"}</p></div>
          <Button disabled={!validDates || !validSite || !issueDescription.trim() || !level || !priority || !hours || !quote} onClick={() => {
            if (!validDates || !validSite || !issueDescription.trim() || !level || !priority || !hours || !quote) return;
            onSubmit({
            customerType,
            level,
            count,
            priority,
            total: quote.subTotal,
            gst: quote.gst,
            totalPayable: quote.total,
            start_date: startDate,
            end_date: endDate,
            duration: hours === 4 ? "4-hour" : "full-day",
            hours,
            startTime,
            gpsLocation,
            site,
            contacts: pocs,
            issueDescription: issueDescription.trim(),
            workInstructions: workInstructions.trim()
            });
          }}>Book service</Button>
        </div>
      </div>
    </section>
  </div>;
}
