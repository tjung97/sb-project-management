"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/src/lib/utils";

export function IssuesDensityToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const compact = searchParams.get("density") !== "comfortable";

  function setDensity(next: "comfortable" | "compact") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "comfortable") params.set("density", "comfortable");
    else params.delete("density");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs shadow-sm" role="group" aria-label="Issue list density">
      <button
        type="button"
        onClick={() => setDensity("comfortable")}
        className={cn("rounded-md px-3 py-1.5 font-medium transition", !compact && "bg-secondary text-foreground")}
      >
        Comfortable
      </button>
      <button
        type="button"
        onClick={() => setDensity("compact")}
        className={cn("rounded-md px-3 py-1.5 font-medium transition", compact && "bg-secondary text-foreground")}
      >
        Compact
      </button>
    </div>
  );
}
