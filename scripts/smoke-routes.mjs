const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const routes = ["/api/health", "/issues", "/projects", "/inbox", "/admin", "/reports", "/pilot"];

let failed = false;

for (const route of routes) {
  const url = new URL(route, baseUrl);
  try {
    const response = await fetch(url, { redirect: "manual" });
    const ok = response.status >= 200 && response.status < 400;
    console.log(`${ok ? "OK" : "FAIL"} ${route} ${response.status}`);
    if (!ok) failed = true;
  } catch (error) {
    failed = true;
    console.log(`FAIL ${route} ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

if (failed) process.exit(1);
