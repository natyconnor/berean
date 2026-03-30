import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import privacyMd from "@/content/legal/privacy.md?raw";

export function PrivacyPage() {
  return (
    <LegalPageLayout>
      <LegalMarkdown content={privacyMd} />
    </LegalPageLayout>
  );
}
