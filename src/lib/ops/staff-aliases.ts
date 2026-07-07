// Manual overrides for cross-system matching between Sling (scheduling) and
// Toast (clock-ins) in the no-show detector. Edit as you spot mismatches in the
// dry run — this is intentionally a plain code file so it's easy to change.

// --- Store aliases ---
// Sling schedules some stores under a different name than Toast. Key = Sling
// store's city token, value = the Toast city token for the SAME physical store.
// e.g. Sling "Lynnwood" is Toast "Alderwood Mall".
export const STORE_ALIASES: Record<string, string> = {
  lynnwood: "alderwood",
};

// --- Person aliases ---
// The SAME human spelled differently across systems (legal vs preferred name,
// etc). Key = the Sling name, value = the Toast clock-in name(s) that are the
// same person. Names are matched case-insensitively.
//
// IMPORTANT: only add people you've CONFIRMED are the same person. Coincidental
// shared surnames are NOT aliases — e.g. "Neftali Najera" (Sling) is a DIFFERENT
// person from "Ronaldino Mateo Najera" (Toast), so they are deliberately absent.
export const PERSON_ALIASES: Record<string, string[]> = {
  // "Sling Name": ["Toast Clock-in Name"],
};
