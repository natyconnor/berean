interface CopyrightNoticeProps {
  text: string;
}

export function CopyrightNotice({ text }: CopyrightNoticeProps) {
  return (
    <div className="mt-4 p-4 text-xs text-muted-foreground leading-relaxed">
      <p>{text}</p>
      <p className="mt-1">
        <a
          href="https://www.esv.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          www.esv.org
        </a>
      </p>
    </div>
  );
}
