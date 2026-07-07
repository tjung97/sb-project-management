import Link from "next/link";
import { List, Plus } from "lucide-react";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { buttonVariants } from "@/src/components/ui/button";
import { IssueExplorer } from "@/src/components/issues/IssueExplorer";
import { buildIssueTree } from "@/src/lib/ops/issue-tree";
import { listIssues } from "@/src/lib/ops/data";
import { cn } from "@/src/lib/utils";

export const dynamic = "force-dynamic";

export default async function IssueTreePage() {
  const issues = await listIssues({ status: "all" }, 500);
  const { roots, stats } = buildIssueTree(issues);

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[28rem] flex-col gap-4">
      <PageHeader
        title="Issue map"
        description="Press an issue to slide into its branch — parents stay in view, progress fills in as branches resolve."
      >
        <Link href="/issues" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <List className="h-3.5 w-3.5" />
          List view
        </Link>
        <Link href="/issues/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="h-3.5 w-3.5" />
          New issue
        </Link>
      </PageHeader>

      <IssueExplorer roots={roots} stats={stats} />
    </div>
  );
}
