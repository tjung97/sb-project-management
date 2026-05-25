import { Download } from "lucide-react";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export function IssueAuditExportLink({
  issueId,
  className,
  label = "Export activity CSV",
}: {
  issueId: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/exports/issues/${issueId}/activity`}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      title="Download activity log for this issue"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Export</span>
    </a>
  );
}
