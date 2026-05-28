"use client";

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/src/components/ui/button";

export function WeeklyRecapCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      <ClipboardCopy className="h-3.5 w-3.5" />
      {copied ? "Copied" : "Copy recap"}
    </Button>
  );
}
