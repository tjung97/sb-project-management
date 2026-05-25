import type { AuthUser } from "@/src/lib/firebase/auth-server";
import { CommandPaletteProvider } from "@/src/components/command/CommandPaletteProvider";
import { IssueHeaderProvider } from "@/src/components/issues/IssueHeaderContext";
import { AppShellHeader } from "@/src/components/layout/AppShellHeader";

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <CommandPaletteProvider role={user.role}>
      <IssueHeaderProvider>
        <div className="min-h-dvh bg-background">
          <AppShellHeader user={user} />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
      </IssueHeaderProvider>
    </CommandPaletteProvider>
  );
}
