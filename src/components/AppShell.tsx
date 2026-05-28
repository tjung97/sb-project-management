import { Suspense } from "react";
import type { AuthUser } from "@/src/lib/firebase/auth-server";
import { CommandPaletteProvider } from "@/src/components/command/CommandPaletteProvider";
import { IssueHeaderProvider } from "@/src/components/issues/IssueHeaderContext";
import { AppShellHeader } from "@/src/components/layout/AppShellHeader";
import { CalendarPanelProvider } from "@/src/components/calendar/CalendarPanelContext";
import { CalendarSidebarServer } from "@/src/components/calendar/CalendarSidebarServer";

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <CalendarPanelProvider>
      <CommandPaletteProvider role={user.role} userUid={user.uid}>
        <IssueHeaderProvider>
          <div className="flex min-h-dvh flex-col bg-background">
            <AppShellHeader user={user} />
            <div className="flex flex-1 min-h-0">
              <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-7xl">{children}</div>
              </main>
              <Suspense fallback={null}>
                <CalendarSidebarServer />
              </Suspense>
            </div>
          </div>
        </IssueHeaderProvider>
      </CommandPaletteProvider>
    </CalendarPanelProvider>
  );
}
