// @ts-nocheck
import { useState } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Marketplace({ category, services, onDetails }) {
  const [query, setQuery] = useState("");
  const matchingServices = services.filter((service) =>
    service.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div>
        <h1 className="mt-2 text-2xl font-semibold">
          {category === "All" ? "All services" : category}
        </h1>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs"
          />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-xs">
          <option>All cities</option>
          <option>Bengaluru</option>
          <option>Mumbai</option>
          <option>Delhi NCR</option>
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-xs">
          <option>Most booked</option>
          <option>Recently added</option>
        </select>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1"></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {matchingServices.map((service) => (
          <article
            key={service.title}
            className="group overflow-hidden rounded-md border border-border bg-card"
          >
            <div className="relative aspect-[16/8]">
              <img
                src={service.image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded bg-card/90 px-2 py-1 text-[10px] font-semibold text-primary">
                {service.category}
              </span>
            </div>
            <div className="p-4">
              <h2 className="text-sm font-semibold">{service.title}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                {service.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-primary">
                <Star className="h-3 w-3 fill-current" />
                4.8 <span className="ml-2 text-muted-foreground">SLA-backed delivery</span>
              </div>
              <Button className="mt-4 w-full" variant="outline" onClick={() => onDetails(service)}>
                View details
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!matchingServices.length && (
        <div className="rounded-md border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No services match this search.
        </div>
      )}
    </div>
  );
}
