import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import licenseMd from "@/content/legal/license.md?raw";

export function LicensePage() {
  return (
    <LegalPageLayout>
      <LegalMarkdown content={licenseMd} />
    </LegalPageLayout>
  );
}
