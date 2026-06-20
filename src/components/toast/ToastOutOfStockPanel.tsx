import { PackageX, PackageCheck } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";
import type { ToastStoreStock } from "@/src/lib/toast/api";

export function ToastOutOfStockPanel({ stores }: { stores: ToastStoreStock[] }) {
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
          <StoreRow key={store.guid} store={store} />
        ))}
      </div>
    </div>
  );
}

function StoreRow({ store }: { store: ToastStoreStock }) {
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
            {items.map((item) => (
              <span
                key={item.guid}
                className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
              >
                {item.name}
              </span>
            ))}
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
