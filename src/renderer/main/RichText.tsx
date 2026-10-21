import { useMemo, type ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from '../shared/markdown';
import './RichText.css';

interface RichTextProps {
  source: string;
  className?: string;
}

/**
 * Descriptions and comments as they read, not as they were typed.
 *
 * Everything is built as React elements from the parsed tree, so the user's
 * text only ever reaches the page as text. Links open in a new window, which
 * the main process turns into the system browser (setWindowOpenHandler) - a
 * link must never navigate the app's own window away from the board.
 */
export function RichText({ source, className }: RichTextProps) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <div className={['rich-text', className].filter(Boolean).join(' ')}>{blocks.map(block)}</div>;
}

function block(node: Block, key: number): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{node.children.map(inline)}</p>;
    case 'heading': {
      const Tag = `h${node.level}` as const;
      return <Tag key={key}>{node.children.map(inline)}</Tag>;
    }
    case 'list': {
      const items = node.items.map((item, index) => (
        <li key={index}>
          {item.content.map(inline)}
          {item.children.map(block)}
        </li>
      ));
      return node.ordered ? (
        <ol key={key} start={node.start}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case 'quote':
      return <blockquote key={key}>{node.children.map(block)}</blockquote>;
    case 'code':
      return (
        <pre key={key}>
          <code>{node.text}</code>
        </pre>
      );
    case 'rule':
      return <hr key={key} />;
  }
}

function inline(node: Inline, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'break':
      return <br key={key} />;
    case 'strong':
      return <strong key={key}>{node.children.map(inline)}</strong>;
    case 'em':
      return <em key={key}>{node.children.map(inline)}</em>;
    case 'strike':
      return <s key={key}>{node.children.map(inline)}</s>;
    case 'code':
      return <code key={key}>{node.text}</code>;
    case 'link':
      return (
        <a key={key} href={node.href} target="_blank" rel="noreferrer noopener" title={node.href}>
          {node.children.map(inline)}
        </a>
      );
  }
}
