import { PageHeader } from "@/src/components/layout/PageHeader";
import { Card, CardContent } from "@/src/components/ui/card";
import { SlingRefreshButton } from "@/src/components/sling/SlingRefreshButton";
import { ScheduleBoard } from "@/src/components/sling/ScheduleBoard";
import { getSlingScheduleBoard } from "@/src/lib/sling/api";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const board = await getSlingScheduleBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="This week's published schedule and next week's plan, pulled from Sling per store."
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
        <ScheduleBoard
          stores={board.stores}
          thisWeekRangeLabel={board.thisWeekRangeLabel}
          nextWeekRangeLabel={board.nextWeekRangeLabel}
          businessHoursLabel={board.businessHoursLabel}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No schedule data yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
