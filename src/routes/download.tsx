import { createFileRoute } from "@tanstack/react-router";
import { DownloadPage } from "@/components/routes/download-page";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
});
