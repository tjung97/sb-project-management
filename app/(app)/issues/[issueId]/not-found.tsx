import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

export default function IssueNotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue not found</CardTitle>
        <CardDescription>
          This issue may not exist, may be archived, or you may not have access.{" "}
          <Link href="/issues" className="text-primary hover:underline">
            Back to issues
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
