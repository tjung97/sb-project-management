import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
export function IssuesEmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">No issues match these filters</p>
          <p className="text-sm text-muted-foreground">Try clearing filters or broadening your search.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/issues">
            <Button type="button" variant="outline">
              Clear filters
            </Button>
          </Link>
          <Link href="/issues/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              New issue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <ClipboardList className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">No issues yet</p>
        <p className="text-sm text-muted-foreground">Create the first operational follow-up for your team.</p>
      </div>
      <Link href="/issues/new">
        <Button type="button">
          <Plus className="h-4 w-4" />
          New issue
        </Button>
      </Link>
    </div>
  );
}
