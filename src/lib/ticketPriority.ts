export const ticketPriorities = ["P0", "P1", "P2", "P3"] as const;

export type TicketPriority = (typeof ticketPriorities)[number];

export const ticketPriorityRank: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export const ticketPriorityNames: Record<TicketPriority, string> = {
  P0: "Urgent",
  P1: "High",
  P2: "Standard",
  P3: "Low",
};

const priorityAliases: Record<string, TicketPriority> = {
  P0: "P0",
  URGENT: "P0",
  CRITICAL: "P0",
  P1: "P1",
  HIGH: "P1",
  P2: "P2",
  MEDIUM: "P2",
  STANDARD: "P2",
  NORMAL: "P2",
  P3: "P3",
  LOW: "P3",
};

export function normalizeTicketPriority(value: string): string {
  const priority = value.trim();
  return priorityAliases[priority.toUpperCase()] ?? priority;
}
