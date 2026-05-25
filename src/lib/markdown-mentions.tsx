import type { Components } from "react-markdown";
import { markdownComponents } from "@/src/lib/markdown-components";

export const markdownComponentsWithMentions: Components = {
  ...markdownComponents,
  a: ({ href, children }) => {
    if (href?.startsWith("mention:")) {
      return (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary ring-1 ring-inset ring-primary/20">
          @{children}
        </span>
      );
    }
    return (
      <a href={href} className="font-medium text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
};
