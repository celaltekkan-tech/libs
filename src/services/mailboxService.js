'use strict';

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');

class MailboxConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MailboxConfigError';
    this.status = 503;
    this.code = 'MAILBOX_NOT_CONFIGURED';
    this.expose = true;
  }
}

class MailboxError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MailboxError';
    this.status = status;
    this.code = 'MAILBOX_ERROR';
    this.expose = true;
  }
}

const FOLDER_LABELS = {
  inbox: 'Gelen',
  sent: 'Gönderilen',
  drafts: 'Taslaklar',
  junk: 'Spam',
  trash: 'Çöp',
  archive: 'Arşiv',
};

function mailboxConfig() {
  const user = process.env.MAIL_ACCOUNT || process.env.SMTP_USER || '';
  const pass = process.env.MAIL_ACCOUNT_PASSWORD || process.env.SMTP_PASS || '';
  const imapHost = process.env.IMAP_HOST || process.env.SMTP_HOST || '';
  return {
    user,
    pass,
    from: process.env.SMTP_FROM || (user ? `OIDS <${user}>` : ''),
    imapHost,
    imapPort: Number(process.env.IMAP_PORT || 143),
    imapSecure: String(process.env.IMAP_SECURE || '').toLowerCase() === 'true',
    smtpHost: process.env.SMTP_HOST || imapHost,
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(process.env.SMTP_PORT) === 465,
    rejectUnauthorized: String(process.env.SMTP_TLS_REJECT || 'true').toLowerCase() !== 'false',
  };
}

function isConfigured() {
  const c = mailboxConfig();
  return Boolean(c.imapHost && c.user && c.pass);
}

function requireConfig() {
  const c = mailboxConfig();
  if (!c.imapHost || !c.user || !c.pass) {
    throw new MailboxConfigError('Posta sunucusu yapılandırılmamış (IMAP_HOST, MAIL_ACCOUNT, MAIL_ACCOUNT_PASSWORD)');
  }
  return c;
}

function formatAddresses(value) {
  if (!value) return '';
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((addr) => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr;
      const name = addr.name ? `${addr.name} ` : '';
      const email = addr.address || addr.email || '';
      return email ? `${name}<${email}>`.trim() : name.trim();
    })
    .filter(Boolean)
    .join(', ');
}

function firstAddress(value) {
  if (!value) return '';
  const list = Array.isArray(value) ? value : [value];
  const addr = list[0];
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return addr.address || addr.email || '';
}

function folderRole(box) {
  const special = String(box.specialUse || box.specialUseFlag || '').toLowerCase();
  if (special.includes('sent')) return 'sent';
  if (special.includes('draft')) return 'drafts';
  if (special.includes('junk') || special.includes('spam')) return 'junk';
  if (special.includes('trash') || special.includes('deleted')) return 'trash';
  if (special.includes('archive')) return 'archive';
  if (special.includes('inbox') || box.path === 'INBOX') return 'inbox';
  const path = String(box.path || '').toLowerCase();
  if (path === 'inbox') return 'inbox';
  if (/(^|\/|\.)(sent|sent items|sent messages)$/i.test(box.path)) return 'sent';
  if (/(^|\/|\.)(trash|deleted|deleted items)$/i.test(box.path)) return 'trash';
  if (/(^|\/|\.)(junk|spam)$/i.test(box.path)) return 'junk';
  if (/(^|\/|\.)drafts$/i.test(box.path)) return 'drafts';
  return 'other';
}

function folderLabel(role, path) {
  return FOLDER_LABELS[role] || path;
}

function hasAttachment(structure) {
  if (!structure) return false;
  if (String(structure.disposition || '').toLowerCase() === 'attachment') return true;
  if (Array.isArray(structure.childNodes)) return structure.childNodes.some(hasAttachment);
  return false;
}

function wrapImapError(err) {
  if (err instanceof MailboxConfigError || err instanceof MailboxError) return err;
  const wrapped = new MailboxError(err.message || 'Posta sunucusuna bağlanılamadı');
  return wrapped;
}

async function withImap(fn) {
  const c = requireConfig();
  const client = new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: c.imapSecure,
    auth: { user: c.user, pass: c.pass },
    logger: false,
    tls: { rejectUnauthorized: c.rejectUnauthorized },
  });
  try {
    await client.connect();
    return await fn(client, c);
  } catch (err) {
    throw wrapImapError(err);
  } finally {
    try {
      await client.logout();
    } catch {
      await client.close().catch(() => {});
    }
  }
}

async function findSpecialPath(client, role) {
  const boxes = await client.list();
  const match = boxes.find((box) => folderRole(box) === role);
  return match ? match.path : null;
}

async function status() {
  if (!isConfigured()) {
    return { configured: false, address: process.env.MAIL_ACCOUNT || 'info@oids.com.tr', folders: [] };
  }
  return withImap(async (client, c) => {
    const boxes = await client.list();
    const folders = [];
    for (const box of boxes) {
      const flags = box.flags instanceof Set ? box.flags : new Set(box.flags || []);
      if (flags.has('\\Noselect') || flags.has('\\NonExistent')) continue;
      const role = folderRole(box);
      let messages = 0;
      let unseen = 0;
      try {
        const st = await client.status(box.path, { messages: true, unseen: true });
        messages = st.messages || 0;
        unseen = st.unseen || 0;
      } catch {
        // klasör durumu alınamazsa listede kalsın
      }
      folders.push({
        path: box.path,
        role,
        label: folderLabel(role, box.path),
        messages,
        unseen,
      });
    }
    const order = ['inbox', 'sent', 'drafts', 'junk', 'trash', 'archive', 'other'];
    folders.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.path.localeCompare(b.path));
    return { configured: true, address: c.user, folders };
  });
}

function summarize(msg) {
  const flags = msg.flags instanceof Set ? msg.flags : new Set(msg.flags || []);
  return {
    uid: msg.uid,
    from: formatAddresses(msg.envelope?.from),
    from_email: firstAddress(msg.envelope?.from),
    to: formatAddresses(msg.envelope?.to),
    subject: msg.envelope?.subject || '(konu yok)',
    date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : msg.internalDate
      ? new Date(msg.internalDate).toISOString()
      : null,
    seen: flags.has('\\Seen'),
    flagged: flags.has('\\Flagged'),
    has_attachment: hasAttachment(msg.bodyStructure),
  };
}

async function listMessages({ folder = 'INBOX', page = 1, limit = 30 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists || 0;
      if (total === 0) return { folder, page: safePage, limit: safeLimit, total: 0, items: [] };
      const end = Math.max(1, total - (safePage - 1) * safeLimit);
      const start = Math.max(1, end - safeLimit + 1);
      if (end < start) return { folder, page: safePage, limit: safeLimit, total, items: [] };
      const items = [];
      for await (const msg of client.fetch(`${start}:${end}`, {
        envelope: true,
        flags: true,
        uid: true,
        internalDate: true,
        bodyStructure: true,
      })) {
        items.push(summarize(msg));
      }
      items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.uid - a.uid);
      return { folder, page: safePage, limit: safeLimit, total, items };
    } finally {
      lock.release();
    }
  });
}

function attachmentMeta(att, index) {
  return {
    index,
    filename: att.filename || `ek-${index + 1}`,
    content_type: att.contentType || 'application/octet-stream',
    size: att.size || (att.content ? att.content.length : 0),
  };
}

async function getMessage({ folder = 'INBOX', uid, markSeen = true }) {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(
        uid,
        { source: true, envelope: true, flags: true, uid: true, internalDate: true },
        { uid: true },
      );
      if (!msg) {
        throw new MailboxError('İleti bulunamadı', 404);
      }
      if (markSeen) {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
      const parsed = await simpleParser(msg.source);
      const attachments = (parsed.attachments || []).map(attachmentMeta);
      const flags = msg.flags instanceof Set ? msg.flags : new Set(msg.flags || []);
      return {
        uid: msg.uid,
        folder,
        from: formatAddresses(parsed.from),
        from_email: firstAddress(parsed.from),
        to: formatAddresses(parsed.to),
        cc: formatAddresses(parsed.cc),
        subject: parsed.subject || msg.envelope?.subject || '(konu yok)',
        date: parsed.date ? parsed.date.toISOString() : summarize(msg).date,
        seen: true,
        flagged: flags.has('\\Flagged'),
        text: parsed.text || '',
        html: parsed.html && typeof parsed.html === 'string' ? parsed.html : null,
        attachments,
      };
    } finally {
      lock.release();
    }
  });
}

async function getAttachment({ folder = 'INBOX', uid, index }) {
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0) {
    throw new MailboxError('Geçersiz ek', 400);
  }
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg) throw new MailboxError('İleti bulunamadı', 404);
      const parsed = await simpleParser(msg.source);
      const att = (parsed.attachments || [])[idx];
      if (!att) throw new MailboxError('Ek bulunamadı', 404);
      return {
        filename: att.filename || `ek-${idx + 1}`,
        contentType: att.contentType || 'application/octet-stream',
        content: att.content,
      };
    } finally {
      lock.release();
    }
  });
}

function splitRecipients(value) {
  return String(value || '')
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function sendMessage({ to, cc, subject, text }) {
  const c = requireConfig();
  const recipients = splitRecipients(to);
  if (!recipients.length) throw new MailboxError('Alıcı gerekli', 400);
  const ccList = splitRecipients(cc);
  const mail = {
    from: c.from || c.user,
    to: recipients.join(', '),
    cc: ccList.length ? ccList.join(', ') : undefined,
    subject: String(subject || '').trim(),
    text: String(text || '').trim(),
    date: new Date(),
  };
  const raw = await new MailComposer(mail).compile().build();
  const transporter = nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpSecure,
    auth: { user: c.user, pass: c.pass },
    tls: { rejectUnauthorized: c.rejectUnauthorized },
  });
  try {
    await transporter.sendMail({ envelope: { from: c.user, to: [...recipients, ...ccList] }, raw });
  } catch (err) {
    throw new MailboxError(err.message || 'İleti gönderilemedi');
  }
  await withImap(async (client) => {
    const sentPath = (await findSpecialPath(client, 'sent')) || 'Sent';
    try {
      await client.append(sentPath, raw, ['\\Seen']);
    } catch {
      // Gönderilen klasörü yoksa ileti yine de gitmiştir
    }
  });
  return { ok: true };
}

async function setSeen({ folder = 'INBOX', uid, seen = true }) {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (seen) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      else await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
      return { uid, folder, seen };
    } finally {
      lock.release();
    }
  });
}

async function deleteMessage({ folder = 'INBOX', uid }) {
  return withImap(async (client) => {
    const trashPath = await findSpecialPath(client, 'trash');
    const lock = await client.getMailboxLock(folder);
    try {
      if (trashPath && folder !== trashPath) {
        await client.messageMove(uid, trashPath, { uid: true });
        return { uid, moved_to: trashPath };
      }
      await client.messageDelete(uid, { uid: true });
      return { uid, deleted: true };
    } finally {
      lock.release();
    }
  });
}

module.exports = {
  isConfigured,
  status,
  listMessages,
  getMessage,
  getAttachment,
  sendMessage,
  setSeen,
  deleteMessage,
  MailboxConfigError,
  MailboxError,
};
