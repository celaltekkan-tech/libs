import { useCallback, useEffect, useState } from 'react'
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createTraining,
  deleteTraining,
  listTrainings,
  updateTraining,
} from '../api/trainings'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { TrainingRecord, TrainingRecordPayload } from '../types/trainingRecord'
import type { Teacher } from '../types/teacher'

export function TrainingsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [rows, setRows] = useState<TrainingRecord[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<{
    teacher_id: number
    title: string
    institution?: string
    range?: [dayjs.Dayjs, dayjs.Dayjs] | null
    hours?: number
    certificate_no?: string
    notes?: string
  }>()

  const canCreate = hasPermission('trainings.create')
  const canUpdate = hasPermission('trainings.update')
  const canDelete = hasPermission('trainings.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rowsData, teacherData] = await Promise.all([
        listTrainings(selectedTeacherId ? { teacher_id: selectedTeacherId } : undefined),
        listTeachers(),
      ])
      setRows(rowsData)
      setTeachers(teacherData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [selectedTeacherId, message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    if (selectedTeacherId) form.setFieldsValue({ teacher_id: selectedTeacherId })
    setModalOpen(true)
  }

  const openEdit = (row: TrainingRecord) => {
    setEditing(row)
    form.setFieldsValue({
      teacher_id: row.teacher_id,
      title: row.title,
      institution: row.institution || undefined,
      range: row.start_date && row.end_date ? [dayjs(row.start_date), dayjs(row.end_date)] : null,
      hours: row.hours ?? undefined,
      certificate_no: row.certificate_no || undefined,
      notes: row.notes || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: {
    teacher_id: number
    title: string
    institution?: string
    range?: [dayjs.Dayjs, dayjs.Dayjs] | null
    hours?: number
    certificate_no?: string
    notes?: string
  }) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload: TrainingRecordPayload = {
        teacher_id: values.teacher_id,
        title: values.title,
        institution: values.institution || null,
        start_date: values.range ? values.range[0].format('YYYY-MM-DD') : null,
        end_date: values.range ? values.range[1].format('YYYY-MM-DD') : null,
        hours: values.hours ?? null,
        certificate_no: values.certificate_no || null,
        notes: values.notes || null,
      }
      if (editing) {
        await updateTraining(editing.id, payload)
        message.success('Eğitim kaydı güncellendi')
      } else {
        await createTraining(session.user.tenant_id, payload)
        message.success('Eğitim kaydı oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: TrainingRecord) => {
    modal.confirm({
      title: 'Eğitim kaydını sil',
      content: 'Bu kaydı silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTraining(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<TrainingRecord> = [
    {
      title: 'Personel',
      render: (_: unknown, record: TrainingRecord) =>
        record.Teacher ? `${record.Teacher.first_name} ${record.Teacher.last_name}` : '—',
    },
    { title: 'Eğitim', dataIndex: 'title' },
    { title: 'Kurum', dataIndex: 'institution', render: (v: string | null) => v || '—' },
    { title: 'Başlangıç', dataIndex: 'start_date', render: (v: string | null) => v || '—' },
    { title: 'Bitiş', dataIndex: 'end_date', render: (v: string | null) => v || '—' },
    { title: 'Saat', dataIndex: 'hours', render: (v: number | null) => v ?? '—' },
    { title: 'Belge No', dataIndex: 'certificate_no', render: (v: string | null) => v || '—' },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: TrainingRecord) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Hizmet İçi Eğitim Takibi">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Hizmet İçi Eğitim Takibi
        </Typography.Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Yeni Kayıt
          </Button>
        )}
      </Space>

      <Select
        allowClear
        placeholder="Personele göre filtrele"
        showSearch
        optionFilterProp="label"
        value={selectedTeacherId ?? undefined}
        onChange={(v) => setSelectedTeacherId(v ?? null)}
        options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
        style={{ width: 260, marginBottom: 16 }}
      />

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? 'Eğitim Kaydını Düzenle' : 'Yeni Eğitim Kaydı'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="teacher_id" label="Personel" rules={[{ required: true, message: 'Personel seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Personel seçin"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Eğitim adı" rules={[{ required: true, message: 'Eğitim adı zorunludur' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="institution" label="Kurum">
            <Input />
          </Form.Item>
          <Form.Item name="range" label="Tarih aralığı">
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="hours" label="Süre (saat)">
            <InputNumber min={0} max={2000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="certificate_no" label="Belge/Sertifika No">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
