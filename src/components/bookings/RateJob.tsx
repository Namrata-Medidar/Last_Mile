import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { engineerService } from "@/services/engineerService";

export function RateJob({ dbId, rated }: { dbId: string; rated: number | null }) {
  const [stars, setStars] = useState(rated ?? 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  if (rated) return <div className="flex items-center gap-1 border-b border-border p-4 text-sm">You rated this service {rated}/5 <Star className="h-4 w-4 text-warning" /></div>;
  const submit = async () => {
    setBusy(true);
    try { await engineerService.rate(dbId, stars, note); toast.success("Thanks for your feedback"); qc.invalidateQueries({ queryKey: ["bookings"] }); }
    catch { toast.error("Could not save your rating."); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <span className="text-sm font-medium">Rate your engineer</span>
      <div className="flex">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setStars(n)}><Star className={`h-5 w-5 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} /></button>)}</div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional comment" className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
      <Button size="sm" disabled={!stars || busy} onClick={submit}>Submit</Button>
    </div>
  );
}
