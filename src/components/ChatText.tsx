import { parseChatText, type InlineSegment } from '../utils/chatFormat';

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.bold ? <strong key={i} className="font-bold">{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

/** The coach's reply as readable text: paragraphs, lists and bold, without raw Markdown symbols. */
export default function ChatText({ text }: { text: string }) {
  const blocks = parseChatText(text);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              <Inline segments={block.segments} />
            </p>
          );
        }
        const List = block.type === 'ol' ? 'ol' : 'ul';
        return (
          <List key={i} className={`flex flex-col gap-1 ps-0 pe-5 ${block.type === 'ol' ? 'list-decimal' : 'list-disc'} marker:text-lime-600 dark:marker:text-lime-400`}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline segments={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
