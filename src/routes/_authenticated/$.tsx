import { createFileRoute } from "@tanstack/react-router";
import { ProjectSectionPage } from "@/components/project/ProjectSectionPage";

export const Route = createFileRoute("/_authenticated/$")({
  component: ProjectSectionPage,
});
