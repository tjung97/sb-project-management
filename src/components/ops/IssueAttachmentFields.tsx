"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ExternalLink, FileText, Image as ImageIcon, Link2, Paperclip, X } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { attachmentKindFromName, attachmentKindLabel, formatAttachmentSize, type AttachmentKind } from "@/src/lib/ops/attachments";
import { cn } from "@/src/lib/utils";

type Attachment = {
  name: string;
  url: string;
  kind: AttachmentKind;
};

export function IssueAttachmentFields({
  idPrefix,
  title = "Evidence",
  description = "Photo, file, or vendor link",
  compact = false,
  mobile = false,
}: {
  idPrefix?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  mobile?: boolean;
}) {
  const generatedId = useId().replaceAll(":", "");
  const baseId = idPrefix ?? `attachment-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function setSelectedFile(nextFile: File | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFile(nextFile);
    if (nextFile?.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(nextFile);
      objectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    setSelectedFile(null);
  }

  return (
    <section className={cn("rounded-lg border border-border bg-secondary/25 p-3", !compact && "sm:p-4")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      <div className={cn("grid gap-3", compact ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]")}>
        <label
          htmlFor={`${baseId}-file`}
          className={cn(
            "group flex min-h-28 cursor-pointer overflow-hidden rounded-lg border border-dashed border-border bg-background text-sm shadow-sm transition",
            "focus-within:ring-2 focus-within:ring-ring/45 focus-within:ring-offset-1 focus-within:ring-offset-background",
            "hover:border-foreground/25 hover:bg-card",
            compact && "min-h-24"
          )}
        >
          <input
            ref={inputRef}
            id={`${baseId}-file`}
            name="attachment_file"
            type="file"
            accept="image/*,.pdf,.csv,.txt,.doc,.docx,.xls,.xlsx"
            className="sr-only"
            onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <span className="relative block w-28 shrink-0 overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </span>
          ) : (
            <span className="flex w-20 shrink-0 items-center justify-center bg-muted/70 text-muted-foreground">
              {mobile ? <Camera className="h-5 w-5" aria-hidden /> : <FileText className="h-5 w-5" aria-hidden />}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
            <span className="truncate font-medium text-foreground">
              {file ? file.name : mobile ? "Take photo or choose file" : "Choose photo or file"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {file ? formatAttachmentSize(file.size) || attachmentKindLabel(attachmentKindFromName(file.name, file.type)) : "Images, PDFs, docs, sheets"}
            </span>
            {file ? (
              <button
                type="button"
                className="mt-2 inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  clearFile();
                }}
              >
                <X className="h-3 w-3" aria-hidden />
                Clear
              </button>
            ) : null}
          </span>
        </label>

        <div className="grid gap-2">
          <div>
            <label className="form-label" htmlFor={`${baseId}-url`}>Link</label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id={`${baseId}-url`} name="attachment_url" className="pl-9" placeholder="https://vendor.example/thread" type="url" />
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor={`${baseId}-name`}>Attachment label</label>
            <Input id={`${baseId}-name`} name="attachment_name" placeholder="Quote, invoice, photo, or vendor thread" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function IssueAttachmentCard({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.kind === "image" ? ImageIcon : attachment.kind === "link" ? Link2 : FileText;

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-lg border border-border bg-secondary/25 text-sm shadow-sm transition hover:border-foreground/20 hover:bg-accent/35"
    >
      {attachment.kind === "image" ? (
        <span className="block aspect-[16/9] overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        </span>
      ) : null}
      <span className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{attachment.name}</span>
          <span className="text-xs text-muted-foreground">{attachmentKindLabel(attachment.kind)}</span>
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
      </span>
    </a>
  );
}
