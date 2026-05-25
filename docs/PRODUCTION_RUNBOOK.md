# Seoul Bowl Ops Production Runbook

This app shares Firebase with `seoul-bowl-orders`. Treat Firestore rules, indexes, and field overrides as shared infrastructure.

## Preflight

Run:

```bash
npm run verify:ops
npm run build
npm --prefix functions run build
```

Expected:

- Required Firebase env vars are set.
- `firebase.merged.json` points to `firestore.rules.merged`.
- App and functions builds pass.

## Data Migration

Run once before production use, or after introducing new issue fields:

```bash
npm run migrate:ops
```

This backfills:

- `issue_number`
- `parent_issue_id`
- `checklist_total`
- `checklist_done`
- `archived_at`

## Index Deploy

Run:

```bash
npm run deploy:indexes
```

If Firebase asks:

```text
Would you like to delete these indexes?
```

Answer:

```text
No
```

If Firebase asks:

```text
Would you like to delete these field overrides?
```

Answer:

```text
No
```

Reason: those indexes and overrides may belong to `seoul-bowl-orders`.

## Rules Deploy

Only deploy rules with the merged config:

```bash
npm run deploy:rules:merged
```

Do not deploy plain `firestore.rules` to the shared project unless it has been merged with the orders rules.

## Functions Deploy

Functions power:

- Notification processing
- Slack/email delivery
- Daily digest
- Recurring issue generation

Deploy with:

```bash
npx firebase-tools deploy --only functions
```

Optional env vars:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SLACK_WEBHOOK_URL`
- `SLACK_WEBHOOK_WAREHOUSE`
- `SLACK_WEBHOOK_STORE_WORK`
- `NEXT_PUBLIC_APP_URL`

## App Smoke Test

After deploy:

```bash
curl https://YOUR_APP_URL/api/health
```

Then manually verify:

- Login works.
- `/issues` loads.
- Search `#1` or another issue number quick-jumps correctly.
- Create issue from template.
- Add checklist item.
- Add comment with file/photo link.
- Mark inbox notification read.
- Export `/api/exports/issues?status=all`.
- Open `/projects` and create from playbook.

## Recovery Notes

If indexes or field overrides were accidentally deleted, redeploy from the orders app repo first, then redeploy Ops indexes and answer `No` to deletion prompts.

If rules were accidentally overwritten, deploy `firestore.rules.merged` immediately using `firebase.merged.json`.
