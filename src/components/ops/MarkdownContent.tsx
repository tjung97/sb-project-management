import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/src/lib/markdown-components";
import { markdownComponentsWithMentions } from "@/src/lib/markdown-mentions";
import { linkifyMentionsForMarkdown, type MentionUser } from "@/src/lib/ops/mentions";
import { cn } from "@/src/lib/utils";

export function MarkdownContent({
  content,
  className,
  mentionUsers,
}: {
  content: string;
  className?: string;
  mentionUsers?: MentionUser[];
}) {
  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  const rendered =
    mentionUsers && mentionUsers.length > 0 ? linkifyMentionsForMarkdown(content, mentionUsers) : content;
  const components = mentionUsers && mentionUsers.length > 0 ? markdownComponentsWithMentions : markdownComponents;

  return (
    <div className={cn("markdown-body text-base leading-7 text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {rendered}
      </ReactMarkdown>
    </div>
  );
}
