import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, List, Modal, Select, Space, Tag, Typography } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../api/client'
import { completeWorkTask, listWorkTasks } from '../api/workTasks'
import type { WorkTask } from '../types/workTask'

const POLL_MS = 180_000
const DEFAULT_SNOOZE_MINUTES = 5
const MAX_SNOOZE_MINUTES = 60
const SNOOZE_MINUTES_KEY = 'mandatory_work_snooze_minutes'
const SNOOZE_UNTIL_KEY = 'mandatory_work_snooze_until'

const SNOOZE_OPTIONS = [5, 10, 15, 20, 30, 45, 60].filter((m) => m <= MAX_SNOOZE_MINUTES)

function readSnoozeMinutes(): number {
  const raw = Number(localStorage.getItem(SNOOZE_MINUTES_KEY))
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_SNOOZE_MINUTES
  return Math.min(MAX_SNOOZE_MINUTES, Math.max(1, Math.round(raw)))
}

function readSnoozeUntil(): number {
  const raw = Number(localStorage.getItem(SNOOZE_UNTIL_KEY))
  return Number.isFinite(raw) ? raw : 0
}

function writeSnoozeMinutes(minutes: number) {
  localStorage.setItem(SNOOZE_MINUTES_KEY, String(minutes))
}

function writeSnoozeUntil(untilMs: number) {
  localStorage.setItem(SNOOZE_UNTIL_KEY, String(untilMs))
}

function clearSnoozeUntil() {
  localStorage.removeItem(SNOOZE_UNTIL_KEY)
}

/**
 * Zorunlu ve gecikmiş işleri her sayfada hatırlatır.
 * Kapatınca seçilen süre (varsayılan 5 dk, max 1 saat) sonra tekrar açılır.
 */
export function MandatoryWorkReminder() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [completingId, setCompletingId] = useState<number | null>(null)
  const [snoozeMinutes, setSnoozeMinutes] = useState(readSnoozeMinutes)
  const [snoozeUntil, setSnoozeUntil] = useState(readSnoozeUntil)

  const canRead = hasPermission('work_tasks.read')
  const canUpdate = hasPermission('work_tasks.update')
  const userId = session?.user?.id
  const enabled = Boolean(userId && canRead && !session?.is_platform_admin)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setTasks([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const rows = await listWorkTasks({
        mine: true,
        mandatory: true,
        status: 'active',
      })
      const overdue = rows.filter((t) => t.due_state === 'overdue')
      setTasks(overdue)
    } catch {
      /* sessiz — layout'u bozmasın */
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, refresh])

  // Snooze süresi dolunca modal'ı yeniden değerlendir
  useEffect(() => {
    if (!enabled || tasks.length === 0) return
    const remaining = snoozeUntil - Date.now()
    if (remaining <= 0) {
      setOpen(true)
      return
    }
    setOpen(false)
    const id = window.setTimeout(() => {
      clearSnoozeUntil()
      setSnoozeUntil(0)
      setOpen(true)
    }, remaining)
    return () => window.clearTimeout(id)
  }, [enabled, tasks.length, snoozeUntil])

  useEffect(() => {
    if (tasks.length === 0) {
      setOpen(false)
      clearSnoozeUntil()
      setSnoozeUntil(0)
    }
  }, [tasks.length])

  const canComplete = useMemo(() => {
    return (task: WorkTask) =>
      session?.user.id === task.assignee_user_id || canUpdate
  }, [session?.user.id, canUpdate])

  const onSnoozeMinutesChange = (value: number) => {
    const next = Math.min(MAX_SNOOZE_MINUTES, Math.max(1, value))
    setSnoozeMinutes(next)
    writeSnoozeMinutes(next)
  }

  const snoozeAndClose = () => {
    const until = Date.now() + snoozeMinutes * 60_000
    writeSnoozeUntil(until)
    setSnoozeUntil(until)
    setOpen(false)
  }

  const onComplete = async (task: WorkTask) => {
    setCompletingId(task.id)
    try {
      await completeWorkTask(task.id)
      message.success(`“${task.title}” yapıldı olarak işaretlendi`)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCompletingId(null)
    }
  }

  if (!enabled) return null

  return (
    <Modal
      open={open && tasks.length > 0}
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#cf1322' }} />
          <span>Zorunlu iş bekliyor</span>
        </Space>
      }
      closable
      maskClosable={false}
      keyboard={false}
      onCancel={snoozeAndClose}
      footer={
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Typography.Text type="secondary">Tekrar hatırlat:</Typography.Text>
            <Select
              size="small"
              value={snoozeMinutes}
              onChange={onSnoozeMinutesChange}
              style={{ width: 110 }}
              options={SNOOZE_OPTIONS.map((m) => ({
                value: m,
                label: m < 60 ? `${m} dk` : '1 saat',
              }))}
            />
          </Space>
          <Button onClick={snoozeAndClose}>Sonra hatırlat</Button>
        </Space>
      }
      width={520}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Size atanan zorunlu iş(ler) gecikmiş durumda. Kapatırsanız seçilen süre sonra uyarı yeniden
        açılır (varsayılan 5 dk, en fazla 1 saat).
      </Typography.Paragraph>
      <List
        loading={loading}
        dataSource={tasks}
        renderItem={(task) => (
          <List.Item
            actions={[
              canComplete(task) ? (
                <Button
                  key="done"
                  type="primary"
                  size="small"
                  loading={completingId === task.id}
                  onClick={() => void onComplete(task)}
                >
                  Yaptım
                </Button>
              ) : (
                <Tag key="na">Atanan değil</Tag>
              ),
            ]}
          >
            <List.Item.Meta
              title={
                <Space wrap>
                  <span>{task.title}</span>
                  <Tag color="red">Zorunlu</Tag>
                  <Tag color="error">Gecikmiş</Tag>
                </Space>
              }
              description={
                <Typography.Text type="secondary">
                  Vade: {dayjs(task.next_due_at).format('DD.MM.YYYY HH:mm')}
                  {task.description ? ` · ${task.description}` : ''}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
