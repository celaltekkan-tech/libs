import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { createExam, deleteExam, exportExams, listExams } from '../api/exams'
import { listClassrooms } from '../api/classrooms'
import { listSubjects } from '../api/subjects'
import { getErrorMessage } from '../api/client'
import { EXAM_TYPE_LABELS, EXAM_TYPE_OPTIONS } from '../types/exam'
import type { Exam, ExamPayload } from '../types/exam'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import type { Subject } from '../types/subject'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function ExamsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [exams, setExams] = useState<Exam[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<ExamPayload>()

  const canCreate = hasPermission('exams.create')
  const canDelete = hasPermission('exams.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [examData, classroomData, subjectData] = await Promise.all([
        listExams(),
        listClassrooms({ is_active: true }),
        listSubjects({ is_active: true }),
      ])
      setExams(examData)
      setClassrooms(classroomData)
      setSubjects(subjectData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async (values: ExamPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const { warning } = await createExam(session.user.tenant_id, values)
      message.success('Sınav planlandı')
      if (warning) {
        modal.warning({ title: 'Uyarı', content: warning });
      }
      setModalOpen(false)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: Exam) => {
    modal.confirm({
      title: 'Sınavı sil',
      content: 'Bu sınav kaydını silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteExam(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportExams({ format: exportFormat })
      downloadBlob(blob, exportFilename('sinav-programi', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<Exam> = [
    { title: 'Tarih', dataIndex: 'exam_date' },
    { title: 'Sınıf', render: (_: unknown, r: Exam) => (r.Classroom ? classroomLabel(r.Classroom) : '—') },
    { title: 'Ders', render: (_: unknown, r: Exam) => r.Subject?.name || '—' },
    { title: 'Tür', dataIndex: 'exam_type', render: (v: string) => EXAM_TYPE_LABELS[v] || v },
    { title: 'Süre (dk)', dataIndex: 'duration_minutes', render: (v: number | null) => v || '—' },
    ...(canDelete
      ? [
          {
            title: '',
            width: 60,
            render: (_: unknown, record: Exam) => (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Sınav Programı Hazırlama">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Sınav Programı Hazırlama
        </Typography.Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
            Dışa Aktar
          </Button>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Yeni Sınav
            </Button>
          )}
        </Space>
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={exams} pagination={{ pageSize: 20 }} />

      <Modal
        title="Yeni Sınav Planla"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Planla"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="classroom_id" label="Sınıf" rules={[{ required: true, message: 'Sınıf seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))}
            />
          </Form.Item>
          <Form.Item name="subject_id" label="Ders" rules={[{ required: true, message: 'Ders seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="exam_type" label="Sınav türü" rules={[{ required: true, message: 'Sınav türü zorunludur' }]}>
            <Select options={EXAM_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="exam_date" label="Tarih" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="duration_minutes" label="Süre (dakika)">
            <InputNumber min={1} max={600} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Sınav Programını Dışa Aktar"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        confirmLoading={submitting}
        okText="İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Biçim">
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV (.csv)' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
