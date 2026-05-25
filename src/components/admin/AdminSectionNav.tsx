import Link from "next/link";
import { cn } from "@/src/lib/utils";

export const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "system", label: "System" },
  { id: "locations", label: "Locations" },
  { id: "labels", label: "Labels" },
  { id: "users", label: "Users" },
  { id: "automation", label: "Automation" },
  { id: "notifications", label: "Notifications" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export function AdminSectionNav({ active }: { active?: AdminSectionId }) {
  return (
    <nav className="sticky top-[7.25rem] z-10 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <ul className="flex gap-1 overflow-x-auto py-2 text-sm">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className={cn(
                "inline-flex shrink-0 rounded-md px-3 py-1.5 font-medium transition",
                active === section.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
