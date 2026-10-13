import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { useLocale } from '@/locale';

import { fitNotesToViewport } from './fitNotesToViewport';

interface EventNotesFieldProps {
  id: string;
  value: string;
  editable: boolean;
  disabled: boolean;
  rows: number;
  onChange: (value: string) => void;
}

const safeHref = (value: string): string | null => {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const linkPattern =
  /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>(.*?)<\/a>|([^<|]+)<((?:https?:\/\/|mailto:|tel:)[^>]+)>|https?:\/\/[^\s<>]+/gi;

function renderLink(href: string, label: string, key: number) {
  return (
    <a key={key} href={href} target='_blank' rel='noopener noreferrer'>
      {label}
    </a>
  );
}

function renderLine(line: string) {
  const parts: (string | ReturnType<typeof renderLink>)[] = [];
  let cursor = 0;
  for (const match of line.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(line.slice(cursor, index));
    const raw = match[0];
    const hrefText = match[2] ?? match[5] ?? raw.replace(/[),.;!?]+$/, '');
    const label = match[3] ?? match[4] ?? hrefText;
    const href = safeHref(hrefText);
    parts.push(href ? renderLink(href, label, index) : raw);
    if (!match[2] && !match[5]) parts.push(raw.slice(hrefText.length));
    cursor = index + raw.length;
  }
  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}

const htmlTags = [
  'a',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'li',
  'ol',
  'p',
  'strong',
  'ul',
];

const containsHtml = (value: string): boolean => {
  const lower = value.toLowerCase();
  return htmlTags.some(
    tag =>
      lower.includes(`<${tag}>`) ||
      lower.includes(`<${tag} `) ||
      lower.includes(`<${tag}/`)
  );
};

const parseHtml = (value: string): HTMLElement | null =>
  typeof DOMParser === 'undefined'
    ? null
    : new DOMParser().parseFromString(value, 'text/html').body;

function renderHtmlNode(node: ChildNode, key: number): ComponentChildren {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (
    ['script', 'style', 'iframe', 'object', 'svg', 'form', 'input'].includes(
      tag
    )
  ) {
    return null;
  }
  const children = Array.from(element.childNodes).map(renderHtmlNode);
  switch (tag) {
    case 'br':
      return <br key={key} />;
    case 'a': {
      const href = safeHref(element.getAttribute('href') ?? '');
      return href ? (
        <a key={key} href={href} target='_blank' rel='noopener noreferrer'>
          {children}
        </a>
      ) : (
        children
      );
    }
    case 'strong':
    case 'b':
      return <strong key={key}>{children}</strong>;
    case 'em':
    case 'i':
      return <em key={key}>{children}</em>;
    case 'ul':
      return <ul key={key}>{children}</ul>;
    case 'ol':
      return <ol key={key}>{children}</ol>;
    case 'li':
      return <li key={key}>{children}</li>;
    case 'p':
      return <p key={key}>{children}</p>;
    case 'div':
      return <div key={key}>{children}</div>;
    case 'h1':
    case 'h2':
    case 'h3':
      return (
        <strong key={key} className='df-event-notes-heading'>
          {children}
        </strong>
      );
    default:
      return children;
  }
}

function htmlToPlainText(root: HTMLElement): string {
  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (
      ['script', 'style', 'iframe', 'object', 'svg', 'form', 'input'].includes(
        tag
      )
    )
      return '';
    if (tag === 'br') return '\n';
    const text = Array.from(element.childNodes).map(walk).join('');
    if (tag === 'a') {
      const href = safeHref(element.getAttribute('href') ?? '');
      return href && text.trim() !== href ? `${text} <${href}>` : text;
    }
    if (tag === 'li') return `• ${text.trim()}\n`;
    if (['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3'].includes(tag))
      return `${text}\n`;
    return text;
  };
  return Array.from(root.childNodes)
    .map(walk)
    .join('')
    .replaceAll(/\n[ \t]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

export const EventNotesField = ({
  id,
  value,
  editable,
  disabled,
  rows,
  onChange,
}: EventNotesFieldProps) => {
  const { t } = useLocale();
  const [editing, setEditing] = useState(!value);
  const contentRef = useRef<HTMLTextAreaElement | HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const startedEmptyRef = useRef(!value);

  useLayoutEffect(() => {
    const fit = () => {
      const content = contentRef.current;
      const frame = frameRef.current;
      const container = frame?.closest<HTMLElement>(
        '.df-event-detail-panel, .df-dialog-container'
      );
      if (!content || !frame || !container) return;

      if (!frame.style.height || (startedEmptyRef.current && editing)) {
        content.style.height = 'auto';
        fitNotesToViewport(container, content);
        frame.style.height = `${content.offsetHeight}px`;
      }

      const otherHeight = container.scrollHeight - frame.offsetHeight;
      const availableHeight = Math.max(
        48,
        window.innerHeight - 16 - otherHeight
      );
      frame.style.maxHeight = `${availableHeight}px`;
      frame.style.height = `${Math.min(frame.offsetHeight, availableHeight)}px`;
      content.style.maxHeight = editing ? `${availableHeight}px` : '100%';
      content.style.height = '100%';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [value, editing]);

  const finishResize = () => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || !(content instanceof HTMLTextAreaElement)) return;
    if (content.offsetHeight !== frame.offsetHeight) {
      frame.style.height = `${content.offsetHeight}px`;
    }
  };

  const showEditor = !value || (editing && editable);
  const htmlRoot = containsHtml(value) ? parseHtml(value) : null;
  const editorValue = htmlRoot ? htmlToPlainText(htmlRoot) : value;

  return (
    <div className='df-event-dialog-notes-row df-event-notes-field'>
      <div className='df-event-notes-header'>
        <span className='df-form-label'>{t('note')}</span>
        {editable && value && (
          <button
            type='button'
            className={`df-event-notes-action ${
              editing
                ? 'df-event-conference-done'
                : 'df-event-conference-icon-button'
            }`}
            disabled={disabled}
            aria-label={editing ? t('done') : t('editEvent')}
            title={editing ? t('done') : t('editEvent')}
            onClick={() => setEditing(current => !current)}
          >
            {editing ? (
              t('done')
            ) : (
              <svg viewBox='0 0 24 24' aria-hidden='true'>
                <path d='m14.7 5.3 4 4M4 20l3.8-.8L19 8a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L4.8 16.2Z' />
              </svg>
            )}
          </button>
        )}
      </div>
      <div ref={frameRef} className='df-event-notes-frame'>
        {showEditor ? (
          <textarea
            ref={element => {
              contentRef.current = element;
            }}
            id={id}
            name='note'
            value={editorValue}
            readOnly={!editable || disabled}
            disabled={!editable || disabled}
            onInput={event => onChange(event.currentTarget.value)}
            onPointerUp={finishResize}
            rows={rows}
            className='df-form-textarea'
            placeholder={t('addNotePlaceholder')}
          />
        ) : (
          <div
            ref={element => {
              contentRef.current = element;
            }}
            className='df-event-notes-preview'
            role='note'
          >
            {htmlRoot
              ? Array.from(htmlRoot.childNodes).map(renderHtmlNode)
              : value.split(/\r?\n/).map((line, index) =>
                  /^[_-]{8,}\s*$/.test(line.trim()) ? (
                    <hr key={index} />
                  ) : line.trim() ? (
                    <div key={index} className='df-event-notes-line'>
                      {renderLine(line)}
                    </div>
                  ) : (
                    <div key={index} className='df-event-notes-gap' />
                  )
                )}
          </div>
        )}
      </div>
    </div>
  );
};
