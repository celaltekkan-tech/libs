import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { SortableTable } from '../components/SortableTable'
import { useAuth } from '../auth/AuthContext'
import { sorterBy } from '../utils/tableSort'
import { getErrorMessage } from '../api/client'
import { listManagedUsers } from '../api/managedUsers'
import {
  completeWorkTask,
  createWorkTask,
  deleteWorkTask,
  listWorkTasks,
  pauseWorkTask,
  resumeWorkTask,
  updateWorkTask,
} from '../api/workTasks'
import type { ManagedUser } from '../types/managedUser'
import type {
  NotifyChannel,
  WorkTask,
  WorkTaskDueState,
  WorkTaskFrequency,
  WorkTaskPayload,
} from '../types/workTask'
import { FREQUENCY_LABELS, NOTIFY_CHANNEL_OPTIONS } from '../types/workTask'
import { tablePagination } from '../utils/tablePagination'

interface TaskFormValues {
  title: string
  description?: string
  assignee_user_id: number
  frequency: WorkTaskFrequency
  due_at: Dayjs
  remind_before_days: number
  is_mandatory: boolean
  notify_channels: NotifyChannel[]
  monthly_day?: number
  yearly_month?: number
  yearly_day?: number
}

function dueStateTag(state: WorkTaskDueState, mandatory: boolean) {
  const icon = mandatory ? <ExclamationCircleOutlined /> : null
  switch (state) {
    case 'overdue':
      return (
        <Tag color="red" icon={icon}>
          Gecikmiş
        </Tag>
      )
    case 'due_soon':
      return <Tag color="orange">Yaklaşıyor</Tag>
    case 'done_period':
      return <Tag color="green">Bu dönem yapıldı</Tag>
    case 'completed':
      return <Tag color="default">Tamamlandı</Tag>
    case 'cancelled':
      return <Tag>İptal</Tag>
    default:
      return <Tag color="blue">Zamanında</Tag>
  }
}

function formatDue(iso: string) {
  return dayjs(iso).format('DD.MM.YYYY HH:mm')
}

function buildRecurrenceConfig(frequency: WorkTaskFrequency, values: TaskFormValues) {
  if (frequency === 'monthly') {
    return { day: values.monthly_day ?? values.due_at.date() }
  }
  if (frequency === 'yearly') {
    return {
      month: values.yearly_month ?? values.due_at.month() + 1,
      day: values.yearly_day ?? values.due_at.date(),
    }
  }
  return null
}

function formValuesFromTask(task: WorkTask): Partial<TaskFormValues> {
  const due = dayjs(task.next_due_at)
  const remindDays = Math.max(0, Math.round((task.remind_before_minutes || 0) / 1440))
  return {
    title: task.title,
    description: task.description || undefined,
    assignee_user_id: task.assignee_user_id,
    frequency: task.frequency,
    due_at: due,
    remind_before_days: remindDays || 1,
    is_mandatory: task.is_mandatory,
    notify_channels: task.notify_channels || [],
    monthly_day: task.recurrence_config?.day ?? due.date(),
    yearly_month: task.recurrence_config?.month ?? due.month() + 1,
    yearly_day: task.recurrence_config?.day ?? due.date(),
  }
}

function payloadFromForm(values: TaskFormValues): WorkTaskPayload {
  return {
    title: values.title.trim(),
    description: values.description?.trim() || null,
    assignee_user_id: values.assignee_user_id,
    frequency: values.frequency,
    next_due_at: values.due_at.toISOString(),
    remind_before_minutes: Math.round((values.remind_before_days ?? 1) * 1440),
    is_mandatory: values.is_mandatory,
    notify_channels: values.notify_channels || [],
    recurrence_config: buildRecurrenceConfig(values.frequency, values),
  }
}

export function WorkTasksPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkTask | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filterMine, setFilterMine] = useState(false)
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [filterMandatory, setFilterMandatory] = useState(false)
  const [form] = Form.useForm<TaskFormValues>()

  const frequencyWatch = Form.useWatch('frequency', form)

  const canCreate = hasPermission('work_tasks.create')
  const canUpdate = hasPermission('work_tasks.update')
  const canDelete = hasPermission('work_tasks.delete')
  const canComplete = hasPermission('work_tasks.read')

  const userOptions = useMemo(
    () =>
      users
        .filter((u) => u.is_active)
        .map((u) => ({ value: u.id, label: `${u.full_name} (${u.email})` })),
    [users],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskData, userData] = await Promise.all([
        listWorkTasks({
          mine: filterMine || undefined,
          overdue: filterOverdue || undefined,
          mandatory: filterMandatory || undefined,
        }),
        listManagedUsers(),
      ])
      setTasks(taskData)
      setUsers(userData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, filterMine, filterOverdue, filterMandatory])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    const defaultAssignee = session?.user.id
    form.setFieldsValue({
      frequency: 'once',
      due_at: dayjs().add(1, 'day').hour(17).minute(0).second(0),
      remind_before_days: 1,
      is_mandatory: false,
      notify_channels: ['in_app'],
      assignee_user_id: defaultAssignee,
      monthly_day: dayjs().date(),
      yearly_month: dayjs().month() + 1,
      yearly_day: dayjs().date(),
    })
    setModalOpen(true)
  }

  const openEdit = (task: WorkTask) => {
    setEditing(task)
    form.setFieldsValue(formValuesFromTask(task) as TaskFormValues)
    setModalOpen(true)
  }

  const onFinish = async (values: TaskFormValues) => {
    setSubmitting(true)
    try {
      const payload = payloadFromForm(values)
      if (editing) {
        await updateWorkTask(editing.id, payload)
        message.success('Görev güncellendi')
      } else {
        await createWorkTask(payload)
        message.success('Görev oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onComplete = (task: WorkTask) => {
    modal.confirm({
      title: 'Görevi tamamla',
      content: `"${task.title}" görevini yapıldı olarak işaretlemek istiyor musunuz?`,
      okText: 'Yapıldı',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await completeWorkTask(task.id)
          message.success('Görev tamamlandı')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onDelete = (task: WorkTask) => {
    modal.confirm({
      title: 'Görevi sil',
      content: `"${task.title}" silinsin mi?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteWorkTask(task.id)
          message.success('Görev silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const togglePause = async (task: WorkTask) => {
    try {
      if (task.status === 'paused') {
        await resumeWorkTask(task.id)
        message.success('Görev devam ettirildi')
      } else {
        await pauseWorkTask(task.id)
        message.success('Görev duraklatıldı')
      }
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const canMarkComplete = (task: WorkTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false
    if (task.due_state === 'done_period') return false
    const isAssignee = session?.user.id === task.assignee_user_id
    return canComplete && (isAssignee || canUpdate)
  }

  const columns: ColumnsType<WorkTask> = [
    {
      title: 'Başlık',
      dataIndex: 'title',
      render: (title: string, record) => (
        <Space>
          {record.is_mandatory && (
            <Tooltip title="Zorunlu iş">
              <ExclamationCircleOutlined style={{ color: '#cf1322' }} />
            </Tooltip>
          )}
          <span>{title}</span>
        </Space>
      ),
    },
    {
      title: 'Atanan',
      dataIndex: ['Assignee', 'full_name'],
      sorter: sorterBy((r: WorkTask) => r.Assignee?.full_name || ''),
      sortDirections: ['ascend', 'descend'],
      render: (_: unknown, record) => record.Assignee?.full_name || '—',
    },
    {
      title: 'Periyot',
      dataIndex: 'frequency',
      render: (f: WorkTaskFrequency) => FREQUENCY_LABELS[f] || f,
    },
    {
      title: 'Sonraki vade',
      dataIndex: 'next_due_at',
      render: (v: string) => formatDue(v),
    },
    {
      title: 'Durum',
      dataIndex: 'due_state',
      sorter: sorterBy((r: WorkTask) => r.due_state),
      sortDirections: ['ascend', 'descend'],
      render: (_: unknown, record) => (
        <Space size={4} wrap>
          {dueStateTag(record.due_state, record.is_mandatory)}
          {record.status === 'paused' && <Tag>Duraklatıldı</Tag>}
        </Space>
      ),
    },
    {
      title: 'Uyarı',
      dataIndex: 'notify_channels',
      render: (channels: NotifyChannel[]) =>
        channels?.length ? (
          <Space size={2} wrap>
            {channels.map((c) => {
              const opt = NOTIFY_CHANNEL_OPTIONS.find((o) => o.value === c)
              return (
                <Tag key={c} style={{ marginInlineEnd: 0 }}>
                  {opt?.label || c}
                </Tag>
              )
            })}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record) => (
        <Space wrap>
          {canMarkComplete(record) && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => onComplete(record)}>
              Yapıldı
            </Button>
          )}
          {canUpdate && record.status !== 'completed' && record.status !== 'cancelled' && (
            <>
              <Button
                size="small"
                icon={record.status === 'paused' ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={() => void togglePause(record)}
                title={record.status === 'paused' ? 'Devam' : 'Duraklat'}
              />
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
            </>
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="İş Takibi">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          İş Takibi
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Periyodik görevler, hatırlatmalar ve zorunlu işler için son tarih takibi. Atanan kullanıcıya seçilen kanallarla
          bildirim gider.
        </Typography.Paragraph>

        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Space wrap>
            <Checkbox checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)}>
              Yalnızca bana atananlar
            </Checkbox>
            <Checkbox checked={filterOverdue} onChange={(e) => setFilterOverdue(e.target.checked)}>
              Gecikmiş
            </Checkbox>
            <Checkbox checked={filterMandatory} onChange={(e) => setFilterMandatory(e.target.checked)}>
              Zorunlu
            </Checkbox>
          </Space>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={userOptions.length === 0}>
              Yeni görev
            </Button>
          )}
        </Space>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tasks}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? 'Görevi düzenle' : 'Yeni görev'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="title" label="Başlık" rules={[{ required: true, message: 'Başlık zorunludur' }]}>
            <Input placeholder="Görev başlığı" maxLength={300} />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={3} placeholder="İsteğe bağlı açıklama" maxLength={5000} />
          </Form.Item>
          <Form.Item
            name="assignee_user_id"
            label="Atanan kullanıcı"
            rules={[{ required: true, message: 'Atanan seçin' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={userOptions}
              placeholder="Kurum kullanıcısı seçin"
            />
          </Form.Item>
          <Form.Item name="frequency" label="Periyot" rules={[{ required: true }]}>
            <Select
              options={(
                Object.entries(FREQUENCY_LABELS) as Array<[WorkTaskFrequency, string]>
              ).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          {frequencyWatch === 'monthly' && (
            <Form.Item name="monthly_day" label="Ayın günü" rules={[{ required: true }]}>
              <InputNumber min={1} max={31} style={{ width: '100%' }} />
            </Form.Item>
          )}
          {frequencyWatch === 'yearly' && (
            <Space style={{ width: '100%' }} wrap>
              <Form.Item name="yearly_month" label="Ay" rules={[{ required: true }]}>
                <InputNumber min={1} max={12} />
              </Form.Item>
              <Form.Item name="yearly_day" label="Gün" rules={[{ required: true }]}>
                <InputNumber min={1} max={31} />
              </Form.Item>
            </Space>
          )}
          <Form.Item
            name="due_at"
            label="Son tarih ve saat"
            rules={[{ required: true, message: 'Vade seçin' }]}
          >
            <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remind_before_days" label="Hatırlatma (gün önce)">
            <InputNumber min={0} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_mandatory" label="Zorunlu iş" valuePropName="checked">
            <Switch checkedChildren="Evet" unCheckedChildren="Hayır" />
          </Form.Item>
          <Form.Item name="notify_channels" label="Uyarı tipleri">
            <Checkbox.Group options={NOTIFY_CHANNEL_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
