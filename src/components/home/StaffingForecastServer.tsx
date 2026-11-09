import { getStaffingVsForecast } from "@/src/lib/ops/staffing";
import { StaffingForecast } from "@/src/components/home/StaffingForecast";

// Streams independently of the sales dashboard — it fetches the Sling schedule
// board, which is a separate (slower) call.
export async function StaffingForecastServer() {
  const data = await getStaffingVsForecast().catch(() => null);
  if (!data || !data.configured || data.stores.length === 0) return null;
  return <StaffingForecast data={data} />;
}
