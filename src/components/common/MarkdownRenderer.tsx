/**
 * MarkdownRenderer — Renders markdown content with syntax highlighting & one-click code copying.
 * Uses react-markdown + rehype-highlight with dedicated language badge and copy button.
 */

import React, { useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererProps {
  /** The markdown content to render */
  content: string;
  /** Optional additional CSS class */
  className?: string;
}

function extractRawText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) return children.map(extractRawText).join('');
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    if (props && props.children) {
      return extractRawText(props.children);
    }
  }
  return '';
}

function detectLanguage(children: React.ReactNode): string {
  let lang = '';
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const className = (child.props as { className?: string })?.className || '';
      const match = /language-([a-zA-Z0-9_+-]+)/.exec(className);
      if (match && match[1]) {
        lang = match[1].toLowerCase();
      }
    }
  });
  return lang;
}

function CodeBlockWrapper({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = detectLanguage(children);
  const rawCode = extractRawText(children).trim();

  const isSql = lang === 'sql';
  const displayTitle = isSql
    ? '🐬 SQL 代码块'
    : lang
    ? `💻 ${lang.toUpperCase()}`
    : '💻 代码块';
  const copyLabel = copied
    ? '✓ 已复制'
    : isSql
    ? '📋 一键复制 SQL'
    : '📋 复制代码';

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!rawCode) return;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(rawCode);
        } else {
          const ta = document.createElement('textarea');
          ta.value = rawCode;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('[MarkdownRenderer] 复制代码失败:', err);
      }
    },
    [rawCode],
  );

  return (
    <div className="code-block-wrapper" style={{ margin: '14px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: isSql ? 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)' : '#1e293b',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: isSql ? '#38bdf8' : '#cbd5e1',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {displayTitle}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            fontSize: '0.72rem',
            fontWeight: 700,
            borderRadius: 6,
            border: copied
              ? '1px solid #10b981'
              : isSql
              ? '1px solid #38bdf8'
              : '1px solid rgba(255,255,255,0.25)',
            background: copied
              ? 'rgba(16, 185, 129, 0.2)'
              : isSql
              ? 'rgba(56, 189, 248, 0.15)'
              : 'rgba(255,255,255,0.08)',
            color: copied ? '#34d399' : isSql ? '#7dd3fc' : '#e2e8f0',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="点击一键复制代码到剪贴板"
        >
          {copyLabel}
        </button>
      </div>
      <div className="code-block" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
        <pre style={{ margin: 0, padding: '12px 14px' }}>{children}</pre>
      </div>
    </div>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${className ?? ''}`}>
      <ReactMarkdown
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlockWrapper>{children}</CodeBlockWrapper>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

