import client from './client'
import { downloadBlob } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export type MailboxFolderRole = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash' | 'archive' | 'other'

export interface MailboxFolder {
  path: string
  role: MailboxFolderRole
  label: string
  messages: number
  unseen: number
}

export interface MailboxStatus {
  configured: boolean
  address: string
  folders: MailboxFolder[]
}

export interface MailboxMessageSummary {
  uid: number
  from: string
  from_email: string
  to: string
  subject: string
  date: string | null
  seen: boolean
  flagged: boolean
  has_attachment: boolean
}

export interface MailboxMessageList {
  folder: string
  page: number
  limit: number
  total: number
  items: MailboxMessageSummary[]
}

export interface MailboxAttachment {
  index: number
  filename: string
  content_type: string
  size: number
}

export interface MailboxMessage extends MailboxMessageSummary {
  folder: string
  cc: string
  text: string
  html: string | null
  attachments: MailboxAttachment[]
}

const TIMEOUT = 30000

export async function getMailboxStatus(): Promise<MailboxStatus> {
  const { data } = await client.get<Envelope<MailboxStatus>>('/api/platform/mailbox', { timeout: TIMEOUT })
  return data.data
}

export async function listMailboxMessages(params: {
  folder: string
  page?: number
  limit?: number
}): Promise<MailboxMessageList> {
  const { data } = await client.get<Envelope<MailboxMessageList>>('/api/platform/mailbox/messages', {
    params,
    timeout: TIMEOUT,
  })
  return data.data
}

export async function getMailboxMessage(uid: number, folder: string): Promise<MailboxMessage> {
  const { data } = await client.get<Envelope<MailboxMessage>>(`/api/platform/mailbox/messages/${uid}`, {
    params: { folder },
    timeout: TIMEOUT,
  })
  return data.data
}

export async function sendMailboxMessage(payload: {
  to: string
  cc?: string
  subject: string
  text: string
}): Promise<{ ok: boolean }> {
  const { data } = await client.post<Envelope<{ ok: boolean }>>('/api/platform/mailbox/messages', payload, {
    timeout: TIMEOUT,
  })
  return data.data
}

export async function deleteMailboxMessage(uid: number, folder: string): Promise<void> {
  await client.delete(`/api/platform/mailbox/messages/${uid}`, { params: { folder }, timeout: TIMEOUT })
}

export async function downloadMailboxAttachment(
  uid: number,
  folder: string,
  index: number,
  filename: string,
): Promise<void> {
  const { data } = await client.get<Blob>(`/api/platform/mailbox/messages/${uid}/attachments/${index}`, {
    params: { folder },
    responseType: 'blob',
    timeout: 60000,
  })
  downloadBlob(data, filename)
}
