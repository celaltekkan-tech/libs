import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  markAnnouncementSent,
  previewRecipients,
} from '../api/announcements'
import { listParentConsents, upsertParentConsent } from '../api/parentConsents'
import { listStudents } from '../api/students'
import { listClassrooms } from '../api/classrooms'
import { getErrorMessage } from '../api/client'
import { CHANNEL_OPTIONS, TARGET_TYPE_OPTIONS } from '../types/announcement'
import type { Announcement, AnnouncementPayload } from '../types/announcement'
import { CONSENT_TYPE_OPTIONS } from '../types/parentConsent'
import type { ParentConsent } from '../types/parentConsent'
import type { Student } from '../types/student'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'

interface AnnouncementFormValues extends AnnouncementPayload {
  target_class_level?: string
  target_classroom_ids?: number[]
  target_student_ids?: number[]
}

export function CommunicationsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [consents, setConsents] = useState<ParentConsent[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recipientPreview, setRecipientPreview] = useState<number | null>(null)
  const [form] = Form.useForm<AnnouncementFormValues>()

  const canCreate = hasPermission('communications.create')
  const canUpdate = hasPermission('communications.update')
  const canDelete = hasPermission('communications.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [annData, studentData, classroomData] = await Promise.all([
        listAnnouncements(),
        listStudents(),
        listClassrooms({ is_active: true }).catch(() => []),
      ])
      setAnnouncements(annData)
      setStudents(studentData)
      setClassrooms(classroomData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const loadConsents = useCallback(async () => {
    if (!selectedStudentId) {
      setConsents([])
      return
    }
    try {
      setConsents(await listParentConsents(selectedStudentId))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [selectedStudentId, message])

  useEffect(() => {
    void loadConsents()
  }, [loadConsents])

  const resolveTargetIds = (values: AnnouncementFormValues): (string | number)[] => {
    if (values.target_type === 'class_level') return values.target_class_level ? [values.target_class_level] : []
    if (values.target_type === 'classroom') return values.target_classroom_ids || []
    if (values.target_type === 'student') return values.target_student_ids || []
    return []
  }

  const onPreview = async () => {
    const values = form.getFieldsValue()
    if (!values.target_type) return
    try {
      const count = await previewRecipients(values.target_type, resolveTargetIds(values))
      setRecipientPreview(count)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onFinish = async (values: AnnouncementFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createAnnouncement(session.user.tenant_id, {
        title: values.title,
        body: values.body,
        channel: values.channel,
        target_type: values.target_type,
        target_ids: resolveTargetIds(values),
      })
      message.success('Duyuru oluşturuldu')
      setModalOpen(false)
      setRecipientPreview(null)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onMarkSent = (row: Announcement) => {
    modal.confirm({
      title: 'Gönderildi olarak işaretle',
      content:
        'Bu sistemde gerçek bir SMS/e-posta gönderim entegrasyonu bulunmuyor. Bu işlem yalnızca kaydı "gönderildi" olarak işaretler. Devam edilsin mi?',
      okText: 'İşaretle',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await markAnnouncementSent(row.id)
          message.success('Gönderildi olarak işaretlendi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onDeleteAnnouncement = (row: Announcement) => {
    modal.confirm({
      title: 'Duyuruyu sil',
      content: `"${row.title}" duyurusunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteAnnouncement(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onSaveConsent = async (consentType: string, granted: boolean) => {
    if (!session || !selectedStudentId) return
    try {
      await upsertParentConsent(session.user.tenant_id, { student_id: selectedStudentId, consent_type: consentType, granted })
      message.success('KVKK rıza kaydı güncellendi')
      void loadConsents()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const targetType = Form.useWatch('target_type', form)

  const announcementColumns: ColumnsType<Announcement> = [
    { title: 'Başlık', dataIndex: 'title' },
    { title: 'Kanal', dataIndex: 'channel', render: (v: string) => CHANNEL_OPTIONS.find((c) => c.value === v)?.label || v },
    {
      title: 'Hedef',
      render: (_: unknown, r: Announcement) => TARGET_TYPE_OPTIONS.find((t) => t.value === r.target_type)?.label || r.target_type,
    },
    { title: 'Alıcı Sayısı', dataIndex: 'recipient_count' },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (v: string) => <Tag color={v === 'gonderildi' ? 'green' : 'default'}>{v === 'gonderildi' ? 'Gönderildi' : 'Taslak'}</Tag>,
    },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record: Announcement) => (
        <Space>
          {canUpdate && record.status !== 'gonderildi' && (
            <Button size="small" onClick={() => onMarkSent(record)}>
              Gönderildi İşaretle
            </Button>
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteAnnouncement(record)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Veli İletişim, Duyuru ve Bildirim">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Veli İletişim, Duyuru ve Bildirim
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'announcements',
            label: 'Duyurular',
            children: (
              <>
                <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
                  {canCreate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                      Yeni Duyuru
                    </Button>
                  )}
                </Space>
                <Typography.Paragraph type="secondary">
                  Not: Bu sistemde gerçek bir SMS/e-posta sağlayıcı entegrasyonu bulunmuyor. Duyurular burada
                  kayıt altına alınır ve "gönderildi" olarak işaretlenebilir; fiili gönderim için bir sağlayıcı
                  entegrasyonu gerekir.
                </Typography.Paragraph>
                <Table rowKey="id" loading={loading} columns={announcementColumns} dataSource={announcements} pagination={{ pageSize: 20 }} />
              </>
            ),
          },
          {
            key: 'consents',
            label: 'KVKK Rıza Yönetimi',
            children: (
              <>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Öğrenci seçin"
                  value={selectedStudentId ?? undefined}
                  onChange={setSelectedStudentId}
                  options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name} (${s.student_number || '—'})` }))}
                  style={{ width: 320, marginBottom: 16 }}
                />
                {selectedStudentId && (
                  <Table
                    rowKey="value"
                    pagination={false}
                    dataSource={CONSENT_TYPE_OPTIONS}
                    columns={[
                      { title: 'Rıza Türü', dataIndex: 'label' },
                      {
                        title: 'Onay Durumu',
                        render: (_: unknown, opt: { value: string; label: string }) => {
                          const existing = consents.find((c) => c.consent_type === opt.value)
                          return (
                            <Switch
                              checked={existing?.granted || false}
                              disabled={!canCreate}
                              onChange={(checked) => void onSaveConsent(opt.value, checked)}
                            />
                          )
                        },
                      },
                      {
                        title: 'Onay Tarihi',
                        render: (_: unknown, opt: { value: string; label: string }) => {
                          const existing = consents.find((c) => c.consent_type === opt.value)
                          return existing?.granted_at ? new Date(existing.granted_at).toLocaleDateString('tr-TR') : '—'
                        },
                      },
                    ]}
                  />
                )}
              </>
            ),
          },
        ]}
      />

      <Modal
        title="Yeni Duyuru"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setRecipientPreview(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="title" label="Başlık" rules={[{ required: true, message: 'Başlık zorunludur' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Mesaj" rules={[{ required: true, message: 'Mesaj zorunludur' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="channel" label="Kanal" rules={[{ required: true, message: 'Kanal zorunludur' }]}>
            <Select options={CHANNEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="target_type" label="Hedef kitle" rules={[{ required: true, message: 'Hedef kitle zorunludur' }]}>
            <Select options={TARGET_TYPE_OPTIONS} />
          </Form.Item>
          {targetType === 'class_level' && (
            <Form.Item name="target_class_level" label="Sınıf seviyesi" rules={[{ required: true, message: 'Sınıf seviyesi zorunludur' }]}>
              <Input placeholder="Örn. 9" />
            </Form.Item>
          )}
          {targetType === 'classroom' && (
            <Form.Item name="target_classroom_ids" label="Sınıf / Şube" rules={[{ required: true, message: 'En az bir sınıf seçin' }]}>
              <Select mode="multiple" options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))} />
            </Form.Item>
          )}
          {targetType === 'student' && (
            <Form.Item name="target_student_ids" label="Öğrenciler" rules={[{ required: true, message: 'En az bir öğrenci seçin' }]}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
              />
            </Form.Item>
          )}
          <Space>
            <Button size="small" onClick={() => void onPreview()}>
              Alıcı sayısını göster
            </Button>
            {recipientPreview != null && <Typography.Text type="secondary">{recipientPreview} alıcı</Typography.Text>}
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  )
}
