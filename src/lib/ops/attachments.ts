export type AttachmentKind = "link" | "file" | "image";

export function attachmentKindFromName(value: string, contentType = ""): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (/\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i.test(value)) return "image";
  if (/^https?:\/\//i.test(value)) return "link";
  return "file";
}

export function buildLinkAttachment(url: string, name?: string | null) {
  return {
    name: name?.trim() || url,
    url,
    kind: attachmentKindFromName(url),
  };
}

export function attachmentKindLabel(kind: AttachmentKind) {
  if (kind === "image") return "Image";
  if (kind === "link") return "Link";
  return "File";
}

export function formatAttachmentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
