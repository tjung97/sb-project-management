import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

export default function ProjectNotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project not found</CardTitle>
        <CardDescription>
          This project may not exist or you may not have access.{" "}
          <Link href="/projects" className="text-primary hover:underline">
            Back to projects
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
