import { listCalendarEvents, listIssuesWithDue } from "@/src/lib/ops/data";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { CalendarSidebar } from "@/src/components/calendar/CalendarSidebar";

export interface SerializedIssueDue {
  id: string;
  title: string;
  due_at_ms: number;
  status: string;
  priority: string;
}

export interface SerializedCalendarEvent {
  id: string;
  title: string;
  date_ms: number;
  notes: string;
  color: "blue" | "green" | "yellow" | "red" | "purple" | null;
}

export async function CalendarSidebarServer() {
  const user = await getCurrentUser();
  if (!user) return null;

  let serializedIssues: SerializedIssueDue[] = [];
  let serializedEvents: SerializedCalendarEvent[] = [];

  try {
    const [events, issues] = await Promise.all([
      listCalendarEvents(user.uid),
      listIssuesWithDue(),
    ]);

    serializedIssues = issues.map((i) => ({
      id: i.id,
      title: i.title,
      due_at_ms: i.due_at.toMillis(),
      status: i.status,
      priority: i.priority,
    }));

    serializedEvents = events.map((e) => ({
      id: e.id,
      title: e.title,
      date_ms: e.date.toMillis(),
      notes: e.notes,
      color: e.color,
    }));
  } catch {
    // Silently degrade — calendar shows empty state, not a page-level error
  }

  return <CalendarSidebar events={serializedEvents} issues={serializedIssues} />;
}
