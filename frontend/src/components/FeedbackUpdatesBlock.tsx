import { useState } from 'react'
import { Button, Card, Modal, Space, Typography } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import { FeedbackMessageHtml } from './RichTextEditor'
import type { Feedback, FeedbackUpdate } from '../types/feedback'

function UpdateItem({ update }: { update: FeedbackUpdate }) {
  const person = update.User?.full_name || update.author_name
  const who = update.is_from_platform
    ? `Platform${person ? ` · ${person}` : ''}`
    : person || 'Kullanıcı'
  return (
    <Card size="small" type="inner" title={who}>
      <FeedbackMessageHtml html={update.body} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {new Date(update.created_at).toLocaleString('tr-TR')}
      </Typography.Text>
    </Card>
  )
}

function ReplyItem({ html, at }: { html: string; at: string | null }) {
  return (
    <Card size="small" type="inner" title="Yönetici cevabı">
      <FeedbackMessageHtml html={html} />
      {at && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(at).toLocaleString('tr-TR')}
        </Typography.Text>
      )}
    </Card>
  )
}

function normalizeText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

type ThreadEntry =
  | { key: string; at: number; kind: 'reply'; html: string; repliedAt: string | null }
  | { key: string; at: number; kind: 'update'; update: FeedbackUpdate }

/** İlk mesaj sonrası yazışma girdileri (eski reply + gelişmeler), tarihe göre */
function buildThreadEntries(item: Feedback): ThreadEntry[] {
  const updates = item.Updates || []
  const entries: ThreadEntry[] = []

  for (const u of updates) {
    entries.push({
      key: `u-${u.id}`,
      at: new Date(u.created_at).getTime() || 0,
      kind: 'update',
      update: u,
    })
  }

  if (item.reply) {
    const replyNorm = normalizeText(item.reply)
    const duplicated = updates.some(
      (u) => u.is_from_platform && normalizeText(u.body) === replyNorm,
    )
    if (!duplicated) {
      const at = item.replied_at ? new Date(item.replied_at).getTime() : 0
      entries.push({
        key: 'legacy-reply',
        at: Number.isFinite(at) ? at : 0,
        kind: 'reply',
        html: item.reply,
        repliedAt: item.replied_at,
      })
    }
  }

  entries.sort((a, b) => a.at - b.at || (a.kind === 'reply' ? -1 : 1))
  return entries
}

function threadEntryCount(item: Feedback): number {
  const cancel = item.status === 'cancelled' && Boolean(item.cancel_reason)
  return 1 + buildThreadEntries(item).length + (cancel ? 1 : 0)
}

/** Kronolojik yazışma gövdesi (ilk mesaj + yönetici cevabı + gelişmeler + iptal) */
export function FeedbackThreadBody({ item }: { item: Feedback }) {
  const entries = buildThreadEntries(item)

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" type="inner" title={item.User?.full_name || item.author_name || 'İlk mesaj'}>
        <FeedbackMessageHtml html={item.message} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(item.created_at).toLocaleString('tr-TR')}
        </Typography.Text>
      </Card>

      {entries.map((e) =>
        e.kind === 'reply' ? (
          <ReplyItem key={e.key} html={e.html} at={e.repliedAt} />
        ) : (
          <UpdateItem key={e.key} update={e.update} />
        ),
      )}

      {item.status === 'cancelled' && item.cancel_reason && (
        <Card size="small" type="inner" title="İptal nedeni">
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {item.cancel_reason}
          </Typography.Paragraph>
        </Card>
      )}
    </Space>
  )
}

/**
 * Liste kartında özet; tüm yazışmalar modal ile istenince açılır.
 * inline=true ise gelişmeleri kart içinde de gösterir (eski davranış).
 */
export function FeedbackUpdatesBlock({
  item,
  inline = false,
}: {
  item: Feedback
  inline?: boolean
}) {
  const [open, setOpen] = useState(false)
  const entries = buildThreadEntries(item)
  const count = threadEntryCount(item)
  const hasExtra = entries.length > 0 || Boolean(item.cancel_reason)

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {inline &&
        entries.map((e) =>
          e.kind === 'reply' ? (
            <ReplyItem key={e.key} html={e.html} at={e.repliedAt} />
          ) : (
            <UpdateItem key={e.key} update={e.update} />
          ),
        )}

      <Button type="link" icon={<MessageOutlined />} onClick={() => setOpen(true)} style={{ paddingInline: 0 }}>
        {hasExtra ? `Tüm yazışmaları görüntüle (${count})` : 'Yazışmayı görüntüle'}
      </Button>

      <Modal
        title={`Yazışma #${item.id}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={
          <Button type="primary" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        }
        width={640}
        destroyOnHidden
      >
        <FeedbackThreadBody item={item} />
      </Modal>
    </Space>
  )
}
