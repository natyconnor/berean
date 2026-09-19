import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDevSpeechMockEnabled } from "@/lib/web-speech";

import { DictationWaveform } from "./dictation-waveform";

/**
 * Prominent dictation control under the recall textarea. Hidden by the parent
 * when getUserMedia or MediaRecorder is missing.
 */
export function RecallDictationMic({
  listening,
  onToggle,
  disabled = false,
  onInsertSample,
  micStream = null,
}: {
  listening: boolean;
  onToggle: () => void;
  disabled?: boolean;
  onInsertSample?: () => void;
  /** Shared capture from the dictation hook; waveform must not open its own. */
  micStream?: MediaStream | null;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      {listening ? <DictationWaveform active stream={micStream} /> : null}
      <Button
        type="button"
        variant={listening ? "default" : "outline"}
        size="lg"
        className={cn(
          "h-14 w-full text-base font-semibold",
          listening &&
            "bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-600 dark:hover:bg-red-600/90",
        )}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Dictate verse"}
        onClick={onToggle}
        disabled={disabled}
      >
        {listening ? (
          <Square className="h-5 w-5" aria-hidden />
        ) : (
          <Mic className="h-5 w-5" aria-hidden />
        )}
        {listening ? "Stop listening" : "Speak the verse"}
      </Button>
      {listening ? (
        <p
          className="text-center text-xs text-muted-foreground"
          aria-live="polite"
        >
          Listening… words appear after you pause. Edit, then Check.
        </p>
      ) : null}
      {listening && isDevSpeechMockEnabled() && onInsertSample ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          aria-label="Insert spoken sample"
          onClick={onInsertSample}
        >
          Insert spoken sample
        </Button>
      ) : null}
    </div>
  );
}
