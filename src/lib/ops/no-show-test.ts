// TEST HARNESS for the no-show -> Slack pipeline. This injects fake shifts into
// today's schedule so you can force an alert while validating end-to-end.
// >>> Empty both of these out once you're done testing. <<<

export interface TestShift {
  store: string; // Sling store name, e.g. "Bellevue"
  person: string; // schedule this person…
  role: string; // …in this role…
  start: string; // …at this store-local time, 24h "HH:MM" (e.g. "07:00")
}

// Injected as if they were on today's published schedule. A person who can never
// clock in (a fake name) is guaranteed to flag as a no-show once the grace
// period passes — perfect for confirming the Slack alert fires.
//
// Change "Bellevue" to whichever store maps to your test Slack channel. Use a
// fake person for a guaranteed flag, or a real scheduled name to test matching.
export const TEST_SCHEDULE_OVERRIDES: TestShift[] = [
  { store: "Seattle", person: "Test Noshow", role: "Cook", start: "07:00" },
];

// Only send Slack alerts for this store (should match the channel your webhook
// posts to), so a real no-show elsewhere doesn't hit your test channel. Set to
// null when you go live and want every store to alert.
export const NOTIFY_ONLY_STORE: string | null = "Seattle";
