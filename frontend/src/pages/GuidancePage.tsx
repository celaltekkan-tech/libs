import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createGuidanceSession,
  deleteGuidanceSession,
  fetchGuidanceStats,
  listGuidanceSessions,
} from '../api/guidance'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import { REFERRAL_LABELS, REFERRAL_OPTIONS, SESSION_TYPE_LABELS, SESSION_TYPE_OPTIONS } from '../types/guidanceSession'
import type { GuidanceSession, GuidanceSessionPayload, GuidanceStats } from '../types/guidanceSession'
import type { Student } from '../types/student'

export function GuidancePage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [sessions, setSessions] = useState<GuidanceSession[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState<GuidanceStats | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<GuidanceSessionPayload>()

  const canCreate = hasPermission('guidance.create')
  const canDelete = hasPermission('guidance.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sessionData, studentData, statsData] = await Promise.all([
        listGuidanceSessions(selectedStudentId ?? undefined),
        listStudents(),
        fetchGuidanceStats(),
      ])
      setSessions(sessionData)
      setStudents(studentData)
      setStats(statsData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [selectedStudentId, message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async (values: GuidanceSessionPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createGuidanceSession(session.user.tenant_id, values)
      message.success('Görüşme kaydı eklendi')
      setModalOpen(false)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: GuidanceSession) => {
    modal.confirm({
      title: 'Görüşme kaydını sil',
      content: 'Bu gizlilik dereceli kaydı silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteGuidanceSession(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<GuidanceSession> = [
    { title: 'Tarih', dataIndex: 'session_date' },
    {
      title: 'Öğrenci',
      render: (_: unknown, r: GuidanceSession) => (r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '—'),
    },
    { title: 'Görüşme Türü', dataIndex: 'session_type', render: (v: string) => SESSION_TYPE_LABELS[v] || v },
    { title: 'Özet', dataIndex: 'summary', ellipsis: true },
    {
      title: 'Yönlendirme',
      dataIndex: 'referral_to',
      render: (v: string | null) => (v ? <Tag color="orange">{REFERRAL_LABELS[v] || v}</Tag> : '—'),
    },
    ...(canDelete
      ? [
          {
            title: '',
            width: 60,
            render: (_: unknown, record: GuidanceSession) => (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Rehberlik Modülü">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 8 }}>
        <LockOutlined /> Rehberlik Modülü
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Bu modüldeki kayıtlar gizlilik dereceli olup yalnızca Rehber Öğretmen ve Müdür rolleri erişebilir.
      </Typography.Paragraph>

      {stats && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Tag color="blue">Toplam görüşme: {stats.total}</Tag>
          {Object.entries(stats.by_type).map(([type, count]) => (
            <Tag key={type}>{SESSION_TYPE_LABELS[type] || type}: {count}</Tag>
          ))}
        </Space>
      )}

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Öğrenciye göre filtrele"
          value={selectedStudentId ?? undefined}
          onChange={(v) => setSelectedStudentId(v ?? null)}
          options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
          style={{ width: 260 }}
        />
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Yeni Görüşme Kaydı
          </Button>
        )}
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={sessions} pagination={{ pageSize: 20 }} />

      <Modal
        title="Yeni Rehberlik Görüşme Kaydı"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="student_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="session_date" label="Tarih" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="session_type" label="Görüşme türü" rules={[{ required: true, message: 'Görüşme türü zorunludur' }]}>
            <Select options={SESSION_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="summary" label="Görüşme özeti" rules={[{ required: true, message: 'Özet zorunludur' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="referral_to" label="Yönlendirme">
            <Select allowClear options={REFERRAL_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
