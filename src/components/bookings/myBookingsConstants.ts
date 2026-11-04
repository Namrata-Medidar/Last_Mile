import { Activity, CheckCircle2, Clock3 } from "lucide-react";

export const statuses = [
  { label: "Open", icon: Clock3, style: "border-warning/20 bg-warning/10 text-warning" },
  { label: "Assigned", icon: Clock3, style: "border-warning/20 bg-warning/10 text-warning" },
  { label: "In Progress", icon: Activity, style: "border-primary/20 bg-primary/10 text-primary" },
  { label: "Closed", icon: CheckCircle2, style: "border-success/20 bg-success/10 text-success" },
];

export const orderStages = ["Pending", "Assigned", "In progress", "Completed"];
export const priorities = ["Urgent", "High", "Medium", "Low"];
export const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

export function getCancellationErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Please refresh My Orders and try again.";
}
