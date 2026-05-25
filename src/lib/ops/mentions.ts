export type MentionUser = {
  uid: string;
  display_name: string;
  email: string | null;
  handle: string;
};

/** Handle inserted after @ in comments (no spaces). */
export function baseMentionHandle(displayName: string, email: string | null) {
  const fromName = displayName.trim().replace(/\s+/g, "");
  if (fromName) return fromName.replace(/[^a-zA-Z0-9._-]/g, "");
  const local = email?.split("@")[0]?.trim();
  return local ? local.replace(/[^a-zA-Z0-9._-]/g, "") : "user";
}

export function buildMentionUsers(
  profiles: Array<{ uid: string; display_name: string; email?: string | null }>
): MentionUser[] {
  const used = new Set<string>();
  return profiles.map((profile) => {
    let handle = baseMentionHandle(profile.display_name, profile.email ?? null);
    if (used.has(handle.toLowerCase()) && profile.email) {
      handle = baseMentionHandle("", profile.email);
    }
    let suffix = 2;
    const root = handle;
    while (used.has(handle.toLowerCase())) {
      handle = `${root}${suffix}`;
      suffix += 1;
    }
    used.add(handle.toLowerCase());
    return {
      uid: profile.uid,
      display_name: profile.display_name,
      email: profile.email ?? null,
      handle,
    };
  });
}

export function getMentionContext(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const match = before.match(/@([a-zA-Z0-9._-]*)$/);
  if (!match) return null;
  return {
    query: match[1],
    start: cursor - match[0].length,
    end: cursor,
  };
}

export function filterMentionUsers(users: MentionUser[], query: string, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return users.slice(0, limit);
  return users
    .filter((user) => {
      const handle = user.handle.toLowerCase();
      const name = user.display_name.toLowerCase();
      const email = user.email?.toLowerCase() ?? "";
      return handle.startsWith(q) || name.includes(q) || email.includes(q);
    })
    .slice(0, limit);
}

export function insertMention(value: string, start: number, end: number, handle: string) {
  return `${value.slice(0, start)}@${handle} ${value.slice(end)}`;
}

export function parseMentionTokens(body: string) {
  return [...body.matchAll(/@([a-zA-Z0-9._-]+)/g)].map((match) => match[1].toLowerCase());
}

export function resolveMentionUids(body: string, users: MentionUser[]) {
  const tokens = new Set(parseMentionTokens(body));
  if (tokens.size === 0) return [];

  const byHandle = new Map<string, string>();
  for (const user of users) {
    byHandle.set(user.handle.toLowerCase(), user.uid);
    if (user.email) {
      byHandle.set(user.email.split("@")[0].toLowerCase(), user.uid);
    }
  }

  const uids = new Set<string>();
  for (const token of tokens) {
    const uid = byHandle.get(token);
    if (uid) uids.add(uid);
  }
  return [...uids];
}

/** Turn @handles into markdown links for rendering. Longest handles first avoids partial replacements. */
export function linkifyMentionsForMarkdown(body: string, users: MentionUser[]) {
  if (!users.length || !body.includes("@")) return body;

  let result = body;
  const sorted = [...users].sort((a, b) => b.handle.length - a.handle.length);

  for (const user of sorted) {
    const escaped = user.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`@${escaped}(?![a-zA-Z0-9._-])`, "gi");
    result = result.replace(pattern, `[@${user.display_name}](mention:${user.uid})`);
  }

  return result;
}
