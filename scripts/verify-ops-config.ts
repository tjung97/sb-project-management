import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  required?: boolean;
};

const root = process.cwd();

function file(path: string) {
  return join(root, path);
}

function readJson(path: string) {
  return JSON.parse(readFileSync(file(path), "utf8")) as Record<string, unknown>;
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

const requiredEnv = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_SERVICE_ACCOUNT_KEY",
];

const optionalEnv = [
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SLACK_WEBHOOK_URL",
  "SLACK_WEBHOOK_WAREHOUSE",
  "SLACK_WEBHOOK_STORE_WORK",
];

const checks: Check[] = [
  ...requiredEnv.map((name) => ({
    name,
    ok: hasEnv(name),
    detail: hasEnv(name) ? "set" : "missing",
    required: true,
  })),
  ...optionalEnv.map((name) => ({
    name,
    ok: hasEnv(name),
    detail: hasEnv(name) ? "set" : "optional / not set",
  })),
  {
    name: "firebase.json",
    ok: existsSync(file("firebase.json")),
    detail: "default config exists",
    required: true,
  },
  {
    name: "firebase.merged.json",
    ok: existsSync(file("firebase.merged.json")),
    detail: "merged rules deploy config exists",
    required: true,
  },
  {
    name: "firestore.rules.merged",
    ok: existsSync(file("firestore.rules.merged")),
    detail: "orders + ops rules artifact exists",
    required: true,
  },
  {
    name: "firestore.indexes.json",
    ok: existsSync(file("firestore.indexes.json")),
    detail: "index config exists",
    required: true,
  },
];

try {
  const merged = readJson("firebase.merged.json");
  const firestore = merged.firestore as { rules?: string } | undefined;
  checks.push({
    name: "merged rules target",
    ok: firestore?.rules === "firestore.rules.merged",
    detail: `rules=${firestore?.rules ?? "missing"}`,
    required: true,
  });
} catch (error) {
  checks.push({
    name: "merged rules target",
    ok: false,
    detail: error instanceof Error ? error.message : "could not read firebase.merged.json",
    required: true,
  });
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
checks.push({
  name: "shared Firebase project reminder",
  ok: projectId === "seoul-bowl-orders",
  detail: projectId ? `project=${projectId}` : "project id missing",
});

let failed = false;
for (const check of checks) {
  const icon = check.ok ? "OK" : check.required ? "FAIL" : "WARN";
  console.log(`[${icon}] ${check.name}: ${check.detail}`);
  if (check.required && !check.ok) failed = true;
}

console.log("");
console.log("Deploy safety:");
console.log("- Deploy indexes with: npm run deploy:indexes");
console.log("- Answer No to delete indexes / field overrides prompts in the shared orders project.");
console.log("- Deploy rules only with: npm run deploy:rules:merged");
console.log("- Do not deploy plain firestore.rules to production unless it has been merged.");

if (failed) process.exit(1);
