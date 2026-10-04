import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, EyeInvisibleOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { SortableTable } from '../components/SortableTable'
import { useAuth } from '../auth/AuthContext'
import {
  approveMobileRegisterRequest,
  listAssignableRoles,
  listLinkableTeachers,
  listMobileRegisterRequests,
  rejectMobileRegisterRequest,
  setMobileRegisterVisibility,
} from '../api/mobileRegisterRequests'
import { getErrorMessage } from '../api/client'
import type { AssignableRole, LinkableTeacher, MobileRegisterRequest } from '../types/mobileRegisterRequest'
import { tablePagination } from '../utils/tablePagination'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const EASY_WORDS = ['elma', 'okul', 'kedi', 'masa', 'sari', 'mavi', 'topu', 'evim']

function suggestEasyPassword() {
  const word = EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)]
  const digits = String(10 + Math.floor(Math.random() * 90))
  return `${word}${digits}`
}

function statusTag(status: MobileRegisterRequest['status']) {
  if (status === 'pending') return <Tag color="gold">Bekliyor</Tag>
  if (status === 'approved') return <Tag color="green">Onaylandı</Tag>
  return <Tag color="red">Reddedildi</Tag>
}

const MATCH_FIELD_LABELS: Record<string, string> = {
  name: 'Ad soyad',
  national_id: 'T.C.',
  phone: 'Telefon',
  email: 'E-posta',
}

function teacherLabel(row: MobileRegisterRequest) {
  const teacher = row.teacher_on_file
  if (!teacher) return null
  return `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || `Öğretmen #${teacher.id}`
}

export function MobileRegisterRequestsPage() {
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<MobileRegisterRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState<'visible' | 'hidden'>('visible')
  const searchQuery = useDebouncedValue(search)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [current, setCurrent] = useState<MobileRegisterRequest | null>(null)
  const [teachers, setTeachers] = useState<LinkableTeacher[]>([])
  const [roles, setRoles] = useState<AssignableRole[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approveForm] = Form.useForm<{ password: string }>()
  const [rejectForm] = Form.useForm<{ reason?: string }>()

  const canUpdate = hasPermission('mobile_register_requests.update')
  const selectedTeacher = useMemo(() => {
    const fromList = teachers.find((teacher) => teacher.id === selectedTeacherId)
    if (fromList) return fromList
    const suggested = current?.teacher_on_file
    if (!suggested || suggested.id !== selectedTeacherId) return null
    return {
      id: suggested.id,
      first_name: suggested.first_name || '',
      last_name: suggested.last_name || '',
      full_name: `${suggested.first_name || ''} ${suggested.last_name || ''}`.trim(),
      national_id: suggested.national_id,
      phone: suggested.phone,
      email: suggested.email,
      school_id: null,
    }
  }, [teachers, selectedTeacherId, current])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listMobileRegisterRequests({ q: searchQuery, visibility }))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, searchQuery, visibility])

  useEffect(() => {
    void load()
  }, [load])

  const openApprove = (row: MobileRegisterRequest) => {
    setCurrent(row)
    setSelectedTeacherId(row.teacher_on_file?.id ?? null)
    setSelectedRoleId(null)
    approveForm.setFieldsValue({ password: suggestEasyPassword() })
    setApproveOpen(true)
    if (teachers.length === 0) {
      void listLinkableTeachers()
        .then(setTeachers)
        .catch((err) => message.error(getErrorMessage(err)))
    }
    if (roles.length === 0) {
      void listAssignableRoles()
        .then(setRoles)
        .catch((err) => message.error(getErrorMessage(err)))
    }
  }

  const openReject = (row: MobileRegisterRequest) => {
    setCurrent(row)
    rejectForm.resetFields()
    setRejectOpen(true)
  }

  const onApprove = async (values: { password: string }) => {
    if (!current) return
    if (!selectedTeacherId && !selectedRoleId) {
      message.warning('Eşleşmeyen talep için yetki grubu seçin')
      return
    }
    setSubmitting(true)
    try {
      await approveMobileRegisterRequest(
        current.id,
        values.password,
        true,
        selectedTeacherId,
        selectedTeacherId ? null : selectedRoleId,
      )
      message.success('Kayıt onaylandı. Öğretmene T.C. ve bu şifreyi söyleyin.')
      setApproveOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onVisibility = async (row: MobileRegisterRequest, hidden: boolean) => {
    setSubmitting(true)
    try {
      await setMobileRegisterVisibility(row.id, hidden)
      message.success(hidden ? 'İstek gizlendi' : 'İstek yeniden gösterildi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onReject = async (values: { reason?: string }) => {
    if (!current) return
    setSubmitting(true)
    try {
      await rejectMobileRegisterRequest(current.id, values.reason)
      message.success('Kayıt isteği reddedildi')
      setRejectOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<MobileRegisterRequest> = useMemo(
    () => [
      { title: 'Ad soyad', dataIndex: 'full_name' },
      { title: 'T.C.', dataIndex: 'national_id', width: 130 },
      { title: 'Telefon', dataIndex: 'phone', width: 140 },
      { title: 'E-posta', dataIndex: 'email', render: (value: string | null) => value || '—' },
      {
        title: 'Eşleşen öğretmen',
        render: (_: unknown, record: MobileRegisterRequest) => {
          const name = teacherLabel(record)
          if (!name) return <Tag>Kayıtlı değil</Tag>
          const fields = (record.matched_fields || []).map((field) => MATCH_FIELD_LABELS[field] || field)
          return (
            <div>
              <div>{name}</div>
              {fields.length > 0 ? (
                <Typography.Text type="secondary">{fields.join(', ')}</Typography.Text>
              ) : null}
            </div>
          )
        },
      },
      {
        title: 'Onaylayan',
        dataIndex: 'reviewed_by_name',
        render: (value: string | null, record: MobileRegisterRequest) =>
          value ? (
            <div>
              <div>{value}</div>
              {record.reviewed_by_email ? (
                <Typography.Text type="secondary">{record.reviewed_by_email}</Typography.Text>
              ) : null}
            </div>
          ) : (
            '—'
          ),
      },
      {
        title: 'Durum',
        dataIndex: 'status',
        width: 120,
        render: (status: MobileRegisterRequest['status']) => statusTag(status),
      },
      ...(canUpdate
        ? [
            {
              title: 'İşlemler',
              width: 180,
              render: (_: unknown, record: MobileRegisterRequest) => (
                <Space wrap>
                  {visibility === 'visible' && record.status === 'pending' && (
                    <>
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApprove(record)}>
                        Onayla
                      </Button>
                      <Button size="small" danger icon={<CloseOutlined />} onClick={() => openReject(record)}>
                        Reddet
                      </Button>
                    </>
                  )}
                  {visibility === 'visible' ? (
                    <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => void onVisibility(record, true)}>
                      Gizle
                    </Button>
                  ) : (
                    <Button size="small" icon={<EyeOutlined />} onClick={() => void onVisibility(record, false)}>
                      Tekrar göster
                    </Button>
                  )}
                </Space>
              ),
            },
          ]
        : []),
    ],
    [canUpdate, visibility],
  )

  return (
    <AppLayout title="Mobil Kayıt İstekleri">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Mobil Kayıt İstekleri
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Uygulamadan gelen öğretmen kayıt isteklerini onaylayın. Onaylarken şifreyi siz belirlersiniz; öğretmen T.C.
          kimlik numarası ve bu şifreyle girer. Onayda öğretmen kaydındaki telefon ve e-posta güncellenir.
        </Typography.Paragraph>

        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Ad, T.C., telefon, e-posta veya okul"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 320 }}
          />
          <Select
            value={visibility}
            onChange={setVisibility}
            style={{ width: 160 }}
            options={[
              { value: 'visible', label: 'Görünenler' },
              { value: 'hidden', label: 'Gizlenenler' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Yenile
          </Button>
        </Space>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={current ? `Onayla: ${current.full_name}` : 'Onayla'}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() => approveForm.submit()}
        confirmLoading={submitting}
        okText="Onayla ve şifreyi kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Typography.Paragraph>
          Öğretmen T.C. <b>{current?.national_id}</b> ve aşağıda yazdığınız şifreyle giriş yapacak. Kolay bir şifre
          önerdik; isterseniz değiştirin.
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          Önerilen eşleşme otomatik seçilir. Beğenmezseniz listeden başka öğretmen seçin. Onayda mobil hesap seçtiğiniz
          öğretmene bağlanır.
        </Typography.Paragraph>
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          placeholder="Öğretmen seçin"
          style={{ width: '100%', marginBottom: 12 }}
          value={selectedTeacherId ?? undefined}
          onChange={(value) => setSelectedTeacherId(value ?? null)}
          options={teachers.map((teacher) => ({
            value: teacher.id,
            label: `${teacher.full_name}${teacher.national_id ? ` · ${teacher.national_id}` : ''}`,
          }))}
        />
        {selectedTeacher ? (
          <Typography.Paragraph>
            Bağlanacak öğretmen: <b>{selectedTeacher.full_name}</b>
            {selectedTeacher.national_id ? ` · T.C. ${selectedTeacher.national_id}` : ''}
            {selectedTeacher.phone ? ` · ${selectedTeacher.phone}` : ''}
            {selectedTeacher.email ? ` · ${selectedTeacher.email}` : ''}
            {current?.teacher_on_file?.id === selectedTeacher.id && (current.matched_fields || []).length > 0
              ? ` · Eşleşen: ${(current.matched_fields || []).map((field) => MATCH_FIELD_LABELS[field] || field).join(', ')}`
              : current?.teacher_on_file?.id !== selectedTeacher.id
                ? ' · Siz seçtiniz'
                : ''}
          </Typography.Paragraph>
        ) : (
          <>
            <Typography.Paragraph type="warning">
              Öğretmen eşleşmedi. Hesabı bağlamak için bir yetki grubu seçin.
            </Typography.Paragraph>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Yetki grubu seçin"
              style={{ width: '100%', marginBottom: 12 }}
              value={selectedRoleId ?? undefined}
              onChange={(value) => setSelectedRoleId(value)}
              options={roles.map((role) => ({
                value: role.id,
                label: role.description ? `${role.name} — ${role.description}` : role.name,
              }))}
            />
          </>
        )}
        <Form form={approveForm} layout="vertical" onFinish={onApprove}>
          <Form.Item
            name="password"
            label="Şifre"
            extra="En az 6 karakter, 1 harf ve 1 rakam."
            rules={[
              { required: true, message: 'Şifre zorunludur' },
              { min: 6, message: 'En az 6 karakter' },
              {
                validator: async (_, value) => {
                  const text = String(value || '')
                  if (!text) return
                  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text) || !/\d/.test(text)) {
                    throw new Error('En az 1 harf ve 1 rakam olmalı')
                  }
                },
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button onClick={() => approveForm.setFieldsValue({ password: suggestEasyPassword() })}>
            Yeni kolay şifre öner
          </Button>
        </Form>
      </Modal>

      <Modal
        title={current ? `Reddet: ${current.full_name}` : 'Reddet'}
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        confirmLoading={submitting}
        okText="Reddet"
        okButtonProps={{ danger: true }}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={rejectForm} layout="vertical" onFinish={onReject}>
          <Form.Item name="reason" label="Gerekçe (isteğe bağlı)">
            <Input.TextArea rows={3} maxLength={400} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
