// @ts-nocheck
import { Check } from "lucide-react";

export function ScopeList({ title, items, tone }) {
  return <div><h3 className={`text-sm font-semibold ${tone}`}>{title}</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">{items.map((item) => <li key={item} className="flex gap-2"><Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />{item}</li>)}</ul></div>;
}