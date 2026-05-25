import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missing = required.filter((key) => !process.env[key]);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      service: "seoul-bowl-ops",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      storageConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      missing,
      timestamp: new Date().toISOString(),
    },
    { status: missing.length === 0 ? 200 : 503 }
  );
}
