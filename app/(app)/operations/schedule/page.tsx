import { PageHeader } from "@/src/components/layout/PageHeader";
import { Card, CardContent } from "@/src/components/ui/card";
import { SlingRefreshButton } from "@/src/components/sling/SlingRefreshButton";
import { ScheduleView } from "@/src/components/sling/ScheduleView";
import { getSlingScheduleBoard } from "@/src/lib/sling/api";
import { getScheduleChanges } from "@/src/lib/sling/activity";
import { getScheduleBaseline } from "@/src/lib/sling/schedule-seen";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

function currentTime(): number {
  return Date.now();
}

export default async function SchedulePage() {
  const renderedAt = currentTime();
  const user = await getCurrentUser();
  const [board, changes, baseline] = await Promise.all([
    getSlingScheduleBoard(),
    // A week of Sling change-log entries feeds the grid marks and the Changes tab.
    getScheduleChanges({ since: new Date(renderedAt - 7 * 864e5) }),
    user ? getScheduleBaseline(user.uid, renderedAt) : Promise.resolve(renderedAt - 864e5),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="This week's published schedule and next week's plan, pulled from Sling per store — with who changed what, and when."
      >
        <SlingRefreshButton computedAt={board.computedAt} />
      </PageHeader>

      {!board.configured ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {board.error ?? "Add SLING_TOKEN and SLING_SOURCES to enable schedules."}
          </CardContent>
        </Card>
      ) : board.error ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-3 text-sm text-warning-foreground">{board.error}</CardContent>
        </Card>
      ) : board.stores.length ? (
        <ScheduleView
          stores={board.stores}
          thisWeekRangeLabel={board.thisWeekRangeLabel}
          nextWeekRangeLabel={board.nextWeekRangeLabel}
          businessHoursLabel={board.businessHoursLabel}
          changes={changes.changes}
          changesNextBefore={changes.nextBefore}
          changesError={changes.error}
          initialBaseline={baseline}
          renderedAt={renderedAt}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No schedule data yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
