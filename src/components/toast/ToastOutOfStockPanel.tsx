import { PackageX, PackageCheck } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";
import type { ToastStoreStock } from "@/src/lib/toast/api";
import { isIgnored } from "@/src/lib/ops/out-of-stock-message";

export function ToastOutOfStockPanel({
  stores,
  ignored = {},
}: {
  stores: ToastStoreStock[];
  /** Items left out of the Sling alert; shown greyed out here. */
  ignored?: Record<string, string[]>;
}) {
  const configured = stores.some((s) => s.stock.configured);
  if (!configured) return null;

  const totalOut = stores.reduce((sum, s) => sum + s.stock.items.length, 0);

  return (
    <div className={cn("dash-rise rounded-xl border bg-card p-4", totalOut > 0 ? "border-destructive/30" : "border-border/80")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {totalOut > 0 ? (
            <PackageX className="h-4 w-4 text-destructive" />
          ) : (
            <PackageCheck className="h-4 w-4 text-success" />
          )}
          <h2 className="text-sm font-semibold">Out of stock</h2>
          <span className="text-[11px] text-muted-foreground">Toast POS · live menu</span>
        </div>
        {totalOut > 0 ? (
          <Badge variant="destructive">{totalOut} across stores</Badge>
        ) : (
          <Badge variant="success">All in stock</Badge>
        )}
      </div>

      <div className="divide-y divide-border/60 rounded-lg border border-border/70">
        {stores.map((store) => (
          <StoreRow key={store.guid} store={store} ignored={ignored} />
        ))}
      </div>
    </div>
  );
}

function StoreRow({ store, ignored }: { store: ToastStoreStock; ignored: Record<string, string[]> }) {
  const { stock } = store;
  const items = stock.items;

  return (
    <div className="grid grid-cols-[minmax(110px,160px)_1fr] items-start gap-3 px-3 py-2.5">
      <div className="flex items-center gap-2 pt-0.5">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", items.length > 0 ? "bg-destructive" : "bg-success")}
        />
        <span className="truncate text-xs font-semibold">{shortName(store.name)}</span>
      </div>
      <div>
        {stock.error ? (
          <p className="text-xs text-muted-foreground">Stock unavailable: {stock.error}</p>
        ) : items.length ? (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => {
              const off = isIgnored(ignored, store.guid, item.name);
              return (
                <span
                  key={item.guid}
                  title={off ? "Out of stock in Toast, but left out of the Sling alert" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                    off
                      ? "border-border/80 bg-muted text-muted-foreground line-through"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  {item.name}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">All in stock</p>
        )}
      </div>
    </div>
  );
}

// "Seoul Bowl Bellevue" / "Seoul Bowl - Tacoma Mall" -> "Bellevue" / "Tacoma Mall"
function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}
