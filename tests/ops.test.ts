import { describe, expect, test } from "vitest";
import { avatarColor, initials } from "@/src/lib/ops/avatar";
import { attachmentKindFromName, attachmentKindLabel, buildLinkAttachment, formatAttachmentSize } from "@/src/lib/ops/attachments";
import { activityToCsvRows, issuesToCsvRows, toCsv } from "@/src/lib/ops/export";
import { formatDate, formatIssueNumber, formatRelativeTime, markdownPreview, priorityLabel, statusLabel } from "@/src/lib/ops/format";
import {
  activityTypeForPeopleChanges,
  assigneeAdds,
  assigneeRemoves,
  buildUserDisplayMap,
  diffPeople,
  summarizePeopleChanges,
  watcherAdds,
} from "@/src/lib/ops/people-diff";
import { getProjectTemplate, PROJECT_TEMPLATES } from "@/src/lib/ops/project-templates";
import { savedViewHref, SAVED_VIEWS } from "@/src/lib/ops/saved-views";
import {
  buildOpsOverviewTree,
  classifyIssueBucket,
  resolveLatestFollowUp,
  visibleOverviewLocations,
} from "@/src/lib/ops/overview-tree";
import { locationBorderClass, locationKindStyles, roleStyles } from "@/src/lib/ops/semantic";
import { serializeActivityEvent, serializeUserProfile, timestampToMillis } from "@/src/lib/ops/serialize";
import {
  buildMentionUsers,
  linkifyMentionsForMarkdown,
  resolveMentionUids,
} from "@/src/lib/ops/mentions";
import { getIssueTemplate, ISSUE_TEMPLATES } from "@/src/lib/ops/templates";
import type { ActivityEventWithId, IssueWithId, UserProfile } from "@/src/types/firestore";
import { dueDateFromDays, recurringIssueTemplateIds, RECURRING_ISSUE_TEMPLATES } from "../functions/src/recurring";

const timestamp = (iso: string) => ({
  toDate: () => new Date(iso),
  toMillis: () => new Date(iso).getTime(),
});

describe("people assignment history", () => {
  test("diffs assignees and summarizes Git-style people changes", () => {
    const users = buildUserDisplayMap([
      { uid: "u1", display_name: "Ari" },
      { uid: "u2", display_name: "Bo" },
      { uid: "u3", display_name: "Casey" },
    ]);

    const changes = diffPeople("assignee_uids", ["u1", "u2"], ["u2", "u3"], users);

    expect(changes).toEqual([
      { field: "assignee_uids", op: "added", uid: "u3", display_name: "Casey" },
      { field: "assignee_uids", op: "removed", uid: "u1", display_name: "Ari" },
    ]);
    expect(activityTypeForPeopleChanges(changes)).toBe("assigned");
    expect(summarizePeopleChanges("Dana", changes)).toBe("Dana assigned Casey; Dana unassigned Ari");
    expect(assigneeAdds(changes)).toEqual(["u3"]);
    expect(assigneeRemoves(changes)).toEqual(["u1"]);
  });

  test("detects watcher changes separately from assignee changes", () => {
    const changes = diffPeople("watcher_uids", [], ["owner"], new Map([["owner", "Project Owner"]]));

    expect(activityTypeForPeopleChanges(changes)).toBe("watchers_changed");
    expect(watcherAdds(changes)).toEqual(["owner"]);
  });
});

describe("formatting and serialization", () => {
  test("formats issue numbers, labels, and dates", () => {
    expect(formatIssueNumber({ id: "abcdef123", issue_number: 42 })).toBe("#42");
    expect(formatIssueNumber({ id: "abcdef123", issue_number: undefined })).toBe("#abcdef");
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(priorityLabel("urgent")).toBe("Urgent");
    expect(formatDate(timestamp("2026-05-23T12:00:00Z") as never)).toContain("2026");
    expect(formatRelativeTime(timestamp("2026-05-23T11:00:00Z") as never, new Date("2026-05-23T12:00:00Z"))).toBe("1h ago");
    expect(markdownPreview("**Bold** _text_")).toBe("Bold text");
  });

  test("serializes Firestore-like timestamps and user profiles for client components", () => {
    const created = timestamp("2026-05-23T18:00:00Z");
    const event = serializeActivityEvent({
      id: "a1",
      type: "assigned",
      actor_uid: "u1",
      actor_name: "Ari",
      summary: "Ari assigned Bo",
      created_at: created,
    } as ActivityEventWithId);
    const user = serializeUserProfile({
      uid: "u1",
      email: "ari@example.com",
      display_name: "Ari",
      role: "manager",
      store_ids: ["capitol-hill"],
      store_id: "capitol-hill",
      active: true,
    } as UserProfile);

    expect(event.created_at).toBe(created.toMillis());
    expect(timestampToMillis({ _seconds: 10, _nanoseconds: 500_000_000 })).toBe(10_500);
    expect(user).toEqual({
      uid: "u1",
      email: "ari@example.com",
      display_name: "Ari",
      role: "manager",
      store_ids: ["capitol-hill"],
      active: true,
    });
  });
});

describe("templates and saved views", () => {
  test("defines issue templates that can seed operational work", () => {
    expect(ISSUE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(getIssueTemplate("weekly-inventory")).toMatchObject({
      kind: "warehouse",
      suggested_recurrence: "weekly",
    });
    for (const template of ISSUE_TEMPLATES) {
      expect(template.title).toBeTruthy();
      expect(template.body).toBeTruthy();
      expect(template.checklist.length).toBeGreaterThan(0);
    }
  });

  test("defines project playbooks with multiple checklist-backed issues", () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(getProjectTemplate("equipment-repair")?.issues.length).toBe(3);
    for (const template of PROJECT_TEMPLATES) {
      expect(template.due_days).toBeGreaterThan(0);
      expect(template.issues.every((issue) => issue.checklist.length > 0)).toBe(true);
    }
  });

  test("builds saved issue view links with current-user substitution", () => {
    const myBlocked = SAVED_VIEWS.find((view) => view.id === "my-blocked");
    const unassigned = SAVED_VIEWS.find((view) => view.id === "unassigned-hq");
    const myDueWeek = SAVED_VIEWS.find((view) => view.id === "my-due-week");
    const staleBlocked = SAVED_VIEWS.find((view) => view.id === "blocked-72h");

    expect(savedViewHref(myBlocked!, "u1")).toBe("/issues?status=blocked&assignee=u1");
    expect(savedViewHref(unassigned!, null)).toBe("/issues?status=openish&location=hq&unassigned=1");
    expect(savedViewHref(myDueWeek!, "u1")).toBe("/issues?status=openish&assignee=u1&due=week");
    expect(savedViewHref(staleBlocked!, "u1")).toBe("/issues?status=blocked&stale=blocked_72h");
  });
});

describe("attachments and recurring helpers", () => {
  test("classifies attachments for links, files, and images", () => {
    expect(attachmentKindFromName("photo.webp")).toBe("image");
    expect(attachmentKindFromName("quote.pdf")).toBe("file");
    expect(attachmentKindFromName("https://vendor.example/thread")).toBe("link");
    expect(attachmentKindFromName("upload.bin", "image/png")).toBe("image");
    expect(buildLinkAttachment("https://example.com/photo.jpg", "Install photo")).toEqual({
      name: "Install photo",
      url: "https://example.com/photo.jpg",
      kind: "image",
    });
    expect(attachmentKindLabel("file")).toBe("File");
    expect(formatAttachmentSize(1536)).toBe("2 KB");
  });

  test("computes recurring due dates at end of day", () => {
    const due = dueDateFromDays(new Date(2026, 4, 20, 8), 7);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(4);
    expect(due.getDate()).toBe(27);
    expect(due.getHours()).toBe(17);
  });

  test("keeps recurring function templates aligned with app issue templates", () => {
    const appTemplateIds = new Set(ISSUE_TEMPLATES.map((template) => template.id));
    expect(recurringIssueTemplateIds.length).toBeGreaterThan(0);
    for (const templateId of recurringIssueTemplateIds) {
      const template = RECURRING_ISSUE_TEMPLATES[templateId];
      expect(appTemplateIds.has(templateId)).toBe(true);
      expect(template.due_days).toBeGreaterThan(0);
      expect(template.checklist.length).toBeGreaterThan(0);
    }
  });
});

describe("visual identity helpers", () => {
  test("creates stable initials and avatar colors", () => {
    expect(initials("Ari Kim")).toBe("AK");
    expect(initials("warehouse")).toBe("WA");
    expect(initials(" ")).toBe("?");
    expect(avatarColor("u1")).toEqual(avatarColor("u1"));
  });

  test("keeps semantic styles available for roles and location kinds", () => {
    expect(roleStyles.admin.label).toBe("Admin");
    expect(locationKindStyles.warehouse.label).toBe("Warehouse");
    expect(locationBorderClass("store")).toContain("location-store");
    expect(locationBorderClass(undefined)).toBe("border-l-transparent");
  });
});

describe("exports", () => {
  test("escapes CSV values and maps issues into report rows", () => {
    const issue = {
      id: "issue-1",
      issue_number: 7,
      title: "Repair, \"urgent\"",
      description: "Fix fryer",
      kind: "fix",
      status: "blocked",
      priority: "urgent",
      location_id: "warehouse",
      project_id: "project-1",
      parent_issue_id: null,
      assignee_uids: ["u1"],
      watcher_uids: [],
      label_ids: [],
      due_at: timestamp("2026-05-25T12:00:00Z"),
      created_at: timestamp("2026-05-20T12:00:00Z"),
      updated_at: timestamp("2026-05-21T12:00:00Z"),
      closed_at: null,
      archived_at: null,
      created_by_uid: "u1",
      updated_by_uid: "u1",
      last_activity_summary: "Created",
      comment_count: 0,
      activity_count: 1,
      checklist_total: 3,
      checklist_done: 1,
    } as IssueWithId;

    const rows = issuesToCsvRows({
      issues: [issue],
      users: [{ uid: "u1", display_name: "Ari" } as UserProfile],
      locations: [{ id: "warehouse", name: "Warehouse" } as never],
      projects: [{ id: "project-1", title: "Repair Project" } as never],
    });
    const csv = toCsv(rows);

    expect(rows[0]).toMatchObject({
      number: "#7",
      assignees: "Ari",
      location: "Warehouse",
      project: "Repair Project",
      checklist: "1/3",
    });
    expect(csv).toContain('"Repair, ""urgent"""');
  });

  test("exports activity audit rows with before/after JSON", () => {
    const rows = activityToCsvRows([
      {
        id: "a1",
        type: "status_changed",
        actor_uid: "u1",
        actor_name: "Ari",
        summary: "Ari moved status",
        before: { status: "open" },
        after: { status: "blocked" },
        created_at: timestamp("2026-05-23T12:00:00Z"),
      } as ActivityEventWithId,
    ]);

    expect(rows[0].before).toBe(JSON.stringify({ status: "open" }));
    expect(toCsv(rows)).toContain("status_changed");
  });
});

describe("user store assignments", () => {
  test("profileStoreIds prefers store_ids and falls back to store_id", async () => {
    const { profileStoreIds } = await import("@/src/lib/ops/user-stores");
    expect(profileStoreIds({ store_ids: ["a", "b"], store_id: "legacy" })).toEqual(["a", "b"]);
    expect(profileStoreIds({ store_ids: [], store_id: "legacy" })).toEqual(["legacy"]);
  });
});

describe("ops overview tree", () => {
  const admin = { uid: "admin", email: null, name: "Admin", role: "admin" as const, storeIds: [] as string[] };
  const seattleManager = {
    uid: "mgr",
    email: null,
    name: "Seattle Mgr",
    role: "manager" as const,
    storeIds: ["seattle", "bellevue"],
  };
  const locations = [
    { id: "seattle", name: "Seattle Store", code: "SEA", kind: "store" as const, active: true, sort_order: 100 },
    { id: "bellevue", name: "Bellevue Store", code: "BEL", kind: "store" as const, active: true, sort_order: 110 },
  ];
  const projects = [
    {
      id: "p1",
      title: "Store project",
      description: "",
      status: "active" as const,
      owner_uid: null,
      location_ids: ["seattle"],
      issue_count: 1,
      open_issue_count: 1,
      done_issue_count: 0,
      blocked_issue_count: 0,
      due_at: null,
      created_at: timestamp("2026-05-01") as never,
      updated_at: timestamp("2026-05-01") as never,
      created_by_uid: "admin",
    },
  ];
  const baseIssue = {
    description: "",
    kind: "task" as const,
    parent_issue_id: null,
    assignee_uids: [] as string[],
    watcher_uids: [] as string[],
    label_ids: [] as string[],
    due_at: null,
    created_at: timestamp("2026-05-20") as never,
    updated_at: timestamp("2026-05-20") as never,
    closed_at: null,
    created_by_uid: "admin",
    updated_by_uid: "admin",
    last_activity_summary: "",
    comment_count: 0,
    activity_count: 0,
    checklist_total: 0,
    checklist_done: 0,
  };

  test("classifies exclusive buckets", () => {
    const now = new Date("2026-05-23T12:00:00Z");
    expect(classifyIssueBucket({ ...baseIssue, status: "done" } as IssueWithId, now)).toBe("done");
    expect(classifyIssueBucket({ ...baseIssue, status: "blocked" } as IssueWithId, now)).toBe("blocked");
    expect(
      classifyIssueBucket({ ...baseIssue, status: "open", priority: "urgent" } as IssueWithId, now)
    ).toBe("urgent");
  });

  test("manager only sees their store location", () => {
    const visible = visibleOverviewLocations(
      seattleManager,
      locations,
      [{ ...baseIssue, id: "i1", title: "A", status: "open", priority: "normal", location_id: "seattle", project_id: "p1" } as IssueWithId],
      projects
    );
    expect(visible.map((l) => l.id).sort()).toEqual(["bellevue", "seattle"]);
  });

  test("builds location → project → issue tree for admin", () => {
    const issues = [
      {
        ...baseIssue,
        id: "i1",
        issue_number: 1,
        title: "Prep sink",
        status: "open",
        priority: "urgent",
        location_id: "seattle",
        project_id: "p1",
      },
      {
        ...baseIssue,
        id: "i2",
        issue_number: 2,
        title: "Loose task",
        status: "open",
        priority: "normal",
        location_id: "seattle",
        project_id: null,
      },
    ] as IssueWithId[];

    const tree = buildOpsOverviewTree(admin, locations, projects, issues, new Date("2026-05-23T12:00:00Z"));
    const seattle = tree.locations.find((l) => l.id === "seattle");
    expect(seattle?.projects[0]?.issues).toHaveLength(1);
    expect(seattle?.unlinkedIssues).toHaveLength(1);
    expect(tree.totals.urgent).toBe(1);
    expect(seattle?.projects[0]?.issues[0]?.latestFollowUp).toBeNull();
  });

  test("resolveLatestFollowUp uses denormalized comment fields", () => {
    const now = new Date("2026-05-23T12:00:00Z");
    const followUp = resolveLatestFollowUp(
      {
        ...baseIssue,
        id: "i1",
        title: "A",
        status: "open",
        priority: "normal",
        location_id: "seattle",
        project_id: null,
        comment_count: 2,
        last_comment_author_name: "Ari",
        last_comment_at: timestamp("2026-05-23T11:00:00Z") as never,
        last_comment_preview: "Plumber confirmed for Monday",
        last_activity_summary: "Ari commented",
      } as IssueWithId,
      now
    );
    expect(followUp?.authorName).toBe("Ari");
    expect(followUp?.relativeAt).toBe("1h ago");
    expect(followUp?.preview).toBe("Plumber confirmed for Monday");
  });

  test("resolveLatestFollowUp falls back to activity summary", () => {
    const followUp = resolveLatestFollowUp(
      {
        ...baseIssue,
        id: "i1",
        title: "A",
        status: "open",
        priority: "normal",
        location_id: "seattle",
        project_id: null,
        comment_count: 1,
        last_activity_summary: "Bo commented",
        updated_at: timestamp("2026-05-23T10:00:00Z") as never,
      } as IssueWithId,
      new Date("2026-05-23T12:00:00Z")
    );
    expect(followUp?.authorName).toBe("Bo");
    expect(followUp?.relativeAt).toBe("2h ago");
  });
});

describe("mentions", () => {
  test("builds unique handles and resolves tagged users", () => {
    const users = buildMentionUsers([
      { uid: "u1", display_name: "Alex Kim", email: "alex@example.com" },
      { uid: "u2", display_name: "Alex Kim", email: "alex.kim@example.com" },
    ]);
    expect(users[0].handle).toBe("AlexKim");
    expect(users[1].handle).not.toBe("AlexKim");

    const body = `Please review @${users[0].handle} and cc @${users[1].handle}`;
    expect(resolveMentionUids(body, users).sort()).toEqual(["u1", "u2"].sort());
  });

  test("linkifyMentionsForMarkdown creates mention links", () => {
    const users = buildMentionUsers([{ uid: "u1", display_name: "Casey Lee", email: null }]);
    const linked = linkifyMentionsForMarkdown(`Thanks @${users[0].handle} for the fix`, users);
    expect(linked).toContain("[@Casey Lee](mention:u1)");
  });
});
