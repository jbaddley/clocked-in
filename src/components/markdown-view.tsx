import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeHttpUrl } from "@/lib/url";

const components: Components = {
  a: ({ href, children }) => {
    const url = safeHttpUrl(href);
    if (!url) return <span>{children}</span>;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
        {children}
      </a>
    );
  },
  h1: ({ children }) => <h2 className="mt-4 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-4 text-lg font-semibold tracking-tight first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-base font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-3 leading-6 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-border pl-3 text-muted-foreground first:mt-0">{children}</blockquote>
  ),
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs first:mt-0">{children}</pre>,
  hr: () => <hr className="my-4 border-border" />,
};

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
