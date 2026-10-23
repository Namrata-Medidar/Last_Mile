import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telecom Services Marketplace | Last Mile Connect" },
      { name: "description", content: "Book, manage, and track enterprise telecom field services across India with Last Mile Connect." },
      { property: "og:title", content: "Last Mile Connect Telecom Services" },
      { property: "og:description", content: "Book and track certified telecom audits, surveys, engineers, infrastructure, products, and ISP services." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});
