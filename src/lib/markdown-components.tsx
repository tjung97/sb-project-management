import type { Components } from "react-markdown";
import { cn } from "@/src/lib/utils";

/** Tailwind classes on elements — reliable vs global `.markdown-body h1` selectors in Tailwind v4. */
export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 border-b border-border pb-2 text-2xl font-bold tracking-tight text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 border-b border-border/70 pb-1.5 text-xl font-semibold tracking-tight text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-3 mb-1.5 text-base font-semibold text-foreground first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mt-2 mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">{children}</h6>
  ),
  p: ({ children }) => <p className="my-3 leading-7 text-foreground first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary/30 bg-secondary/30 py-1 pl-4 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  ul: ({ children, className }) => (
    <ul className={cn("my-3 list-disc space-y-1 pl-6 text-foreground", className)}>{children}</ul>
  ),
  ol: ({ children, className }) => (
    <ol className={cn("my-3 list-decimal space-y-1 pl-6 text-foreground", className)}>{children}</ol>
  ),
  li: ({ children, className }) => (
    <li className={cn("leading-7 [&>p]:my-1", className)}>{children}</li>
  ),
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isFenced = Boolean(className?.includes("language-"));
    if (isFenced) {
      return (
        <code className={cn("block font-mono text-xs leading-6 text-foreground", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-secondary/60 p-4">{children}</pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary/60">{children}</thead>,
  th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
  tr: ({ children }) => <tr className="even:bg-secondary/20">{children}</tr>,
  input: ({ type, checked, disabled }) =>
    type === "checkbox" ? (
      <input type="checkbox" checked={checked} disabled={disabled} className="mr-2 mt-1 size-4 align-middle accent-primary" readOnly />
    ) : (
      <input type={type} checked={checked} disabled={disabled} />
    ),
};
