import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import termsMd from "@/content/legal/terms.md?raw";

export function TermsPage() {
  return (
    <LegalPageLayout>
      <LegalMarkdown content={termsMd} />
    </LegalPageLayout>
  );
}
