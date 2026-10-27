import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders task text. Raw HTML in the text is never rendered.
export function Markdown({ text, className = "lb-prose" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const MENTION = /(@[A-Z][a-z]+)/;

export function CommentText({ text, people }: { text: string; people: string[] }) {
  return (
    <p className="text">
      {text.split(MENTION).map((part, i) =>
        MENTION.test(part) && people.includes(part.slice(1)) ? (
          <span key={i} className="lb-mention">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
