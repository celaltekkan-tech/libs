import { useEffect, useRef, type ClipboardEvent } from 'react'
import { Button, Space, Tooltip } from 'antd'
import {
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'

const ALLOWED_TAGS = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'DIV'])

/** HTML'den düz metin (doğrulama / sayım için). */
export function stripHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

/** Yalnızca güvenli etiketleri bırakır. */
export function sanitizeFeedbackHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        if (!ALLOWED_TAGS.has(el.tagName)) {
          const text = doc.createTextNode(el.textContent || '')
          node.replaceChild(text, el)
          continue
        }
        // Stil / event attribute temizle
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name)
        }
        walk(el)
      } else if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child)
      }
    }
  }
  walk(doc.body)

  // Boş içerik
  const text = (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim()
  if (!text) return ''
  return doc.body.innerHTML
}

interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  minHeight?: number
  onImagePaste?: (file: File) => void
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Mesajınızı yazın…',
  minHeight = 120,
  onImagePaste,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value !== lastEmitted.current && el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const html = sanitizeFeedbackHtml(el.innerHTML)
    lastEmitted.current = html
    onChange?.(html)
  }

  const run = (command: string) => {
    ref.current?.focus()
    document.execCommand(command, false)
    emit()
  }

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? [])
    const imageItem = items.find((it) => it.type.startsWith('image/'))
    if (imageItem && onImagePaste) {
      const blob = imageItem.getAsFile()
      if (blob) {
        e.preventDefault()
        onImagePaste(blob)
        return
      }
    }

    // Yapıştırılan metni düzgün biçimli HTML veya düz metin olarak al
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) {
      document.execCommand('insertHTML', false, sanitizeFeedbackHtml(html))
    } else {
      document.execCommand('insertText', false, text)
    }
    emit()
  }

  const empty = !stripHtml(value || '')

  return (
    <div className="rich-text-editor">
      <Space size={4} wrap style={{ marginBottom: 8 }}>
        <Tooltip title="Kalın">
          <Button type="text" size="small" icon={<BoldOutlined />} onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')} />
        </Tooltip>
        <Tooltip title="İtalik">
          <Button type="text" size="small" icon={<ItalicOutlined />} onMouseDown={(e) => e.preventDefault()} onClick={() => run('italic')} />
        </Tooltip>
        <Tooltip title="Altı çizili">
          <Button type="text" size="small" icon={<UnderlineOutlined />} onMouseDown={(e) => e.preventDefault()} onClick={() => run('underline')} />
        </Tooltip>
        <Tooltip title="Madde imi">
          <Button
            type="text"
            size="small"
            icon={<UnorderedListOutlined />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run('insertUnorderedList')}
          />
        </Tooltip>
        <Tooltip title="Numaralı liste">
          <Button
            type="text"
            size="small"
            icon={<OrderedListOutlined />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run('insertOrderedList')}
          />
        </Tooltip>
      </Space>

      <div style={{ position: 'relative' }}>
        {empty && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              color: 'var(--app-muted)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          className="rich-text-editor-surface"
          contentEditable
          role="textbox"
          aria-multiline
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          style={{
            minHeight,
            border: '1px solid var(--app-header-border, #d9d9d9)',
            borderRadius: 8,
            padding: '8px 12px',
            outline: 'none',
            background: 'var(--app-login-panel-bg, #fff)',
            color: 'var(--app-text, inherit)',
            lineHeight: 1.6,
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>
    </div>
  )
}

/** Kayıtlı HTML mesajı güvenli şekilde gösterir. */
export function FeedbackMessageHtml({ html }: { html: string }) {
  const safe = sanitizeFeedbackHtml(html)
  if (!safe) {
    // Eski düz metin kayıtları
    return <span style={{ whiteSpace: 'pre-wrap' }}>{html}</span>
  }
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html)
  if (!looksLikeHtml) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{html}</span>
  }
  return (
    <div
      className="feedback-message-html"
      style={{ lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
