import type { MemoryStatusCaption } from "@/lib/memory-due-label";

export function MemoryStatusCaptionLine({
  caption,
  className,
  as: Tag = "span",
}: {
  caption: MemoryStatusCaption;
  className: string;
  as?: "span" | "p";
}) {
  if (caption.title === undefined || caption.accessibleName === undefined) {
    return <Tag className={className}>{caption.text}</Tag>;
  }
  return (
    <Tag className={className}>
      <span aria-hidden title={caption.title}>
        {caption.text}
      </span>
      <span className="sr-only">{caption.accessibleName}</span>
    </Tag>
  );
}
