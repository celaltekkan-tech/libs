import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createManagedUser,
  deleteManagedUser,
  fetchUserFormOptions,
  listManagedUsers,
  updateManagedUser,
} from '../api/managedUsers'
import { getErrorMessage } from '../api/client'
import type {
  ManagedUser,
  ManagedUserPayload,
  SchoolRoleName,
  UserFormOptions,
} from '../types/managedUser'
import { SCHOOL_ROLE_OPTIONS } from '../types/managedUser'

interface UserFormValues {
  full_name: string
  email: string
  password?: string
  school_id: number
  school_role: SchoolRoleName
  is_active: boolean
}

export function UsersPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [options, setOptions] = useState<UserFormOptions>({
    school_roles: [],
    schools: [],
    user_limit: null,
    user_count: 0,
    user_remaining: null,
  })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm<UserFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [userData, formOptions] = await Promise.all([listManagedUsers(), fetchUserFormOptions()])
      setUsers(userData)
      setOptions(formOptions)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return users
    return users.filter((u) => {
      return (
        u.full_name.toLocaleLowerCase('tr-TR').includes(q) ||
        u.email.toLocaleLowerCase('tr-TR').includes(q) ||
        (u.school_role || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (u.assigned_school_name || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [users, search])

  const roleOptions = useMemo(() => {
    const fromApi = options.school_roles.map((r) => r.name)
    const known = SCHOOL_ROLE_OPTIONS.filter((o) => fromApi.includes(o.value) || fromApi.length === 0)
    return (known.length ? known : SCHOOL_ROLE_OPTIONS).map((o) => ({
      value: o.value,
      label: `${o.label} — ${o.description}`,
    }))
  }, [options.school_roles])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      school_role: 'Memur',
      is_active: true,
      school_id: options.schools[0]?.id,
    })
    setModalOpen(true)
  }

  const openEdit = (user: ManagedUser) => {
    setEditing(user)
    form.setFieldsValue({
      full_name: user.full_name,
      email: user.email,
      school_id: user.assigned_school_id || user.school_id || undefined,
      school_role: (user.school_role as SchoolRoleName) || 'Memur',
      is_active: user.is_active,
      password: undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: UserFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const isSelf = Boolean(editing && session.user.id === editing.id)
      if (isSelf && values.is_active === false) {
        message.warning('Kendi hesabınızı pasife alamazsınız')
        setSubmitting(false)
        return
      }

      const payload: ManagedUserPayload = {
        full_name: values.full_name,
        email: values.email,
        school_id: values.school_id,
        school_role: values.school_role,
        is_active: isSelf ? true : values.is_active,
      }
      if (values.password) payload.password = values.password

      if (editing) {
        await updateManagedUser(editing.id, payload)
        message.success('Kullanıcı güncellendi')
      } else {
        await createManagedUser(session.user.tenant_id, payload)
        message.success('Kullanıcı oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (user: ManagedUser) => {
    if (session?.user.id === user.id) {
      message.warning('Kendi hesabınızı silemezsiniz')
      return
    }
    modal.confirm({
      title: 'Kullanıcıyı sil',
      content: `"${user.full_name}" kullanıcısını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteManagedUser(user.id)
          message.success('Kullanıcı silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const canCreate = hasPermission('users.create')
  const canUpdate = hasPermission('users.update')
  const canDelete = hasPermission('users.delete')
  const atUserLimit = options.user_limit != null && options.user_count >= options.user_limit
  const quotaLabel =
    options.user_limit == null
      ? `Kullanıcı: ${options.user_count} (sınırsız)`
      : `Kullanıcı: ${options.user_count}/${options.user_limit}`

  const columns: ColumnsType<ManagedUser> = [
    { title: 'Ad soyad', dataIndex: 'full_name' },
    { title: 'E-posta', dataIndex: 'email' },
    {
      title: 'Görev / Yetki',
      dataIndex: 'school_role',
      render: (role: string | null) => (role ? <Tag color="blue">{role}</Tag> : <Tag>Atanmamış</Tag>),
    },
    {
      title: 'Okul',
      render: (_: unknown, record) => record.assigned_school_name || record.School?.name || '—',
    },
    {
      title: 'Durum',
      dataIndex: 'is_active',
      render: (isActive: boolean) => (isActive ? <Tag color="green">Aktif</Tag> : <Tag color="red">Pasif</Tag>),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: ManagedUser) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && session?.user.id !== record.id && (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record)}
                    title="Sil"
                  />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Kullanıcılar ve Yetkilendirme">
      <div style={{ maxWidth: 1100 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Kullanıcılar ve Yetkilendirme
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Alt kullanıcı oluşturun; Müdür, Müdür Yardımcısı, Memur veya Öğretmen yetkisi atayın.
              {' · '}
              {quotaLabel}
            </Typography.Paragraph>
          </div>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              disabled={options.schools.length === 0 || atUserLimit}
            >
              Yeni Kullanıcı
            </Button>
          )}
        </Space>

        {options.schools.length === 0 && (
          <Typography.Paragraph type="warning">
            Kullanıcı atamak için önce bir okul kaydı olmalıdır.
          </Typography.Paragraph>
        )}
        {atUserLimit && (
          <Typography.Paragraph type="warning">
            Plan kullanıcı limitine ulaşıldı ({options.user_count}/{options.user_limit}). Yeni kullanıcı için
            planınızı yükseltin.
          </Typography.Paragraph>
        )}

        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Ad, e-posta, yetki veya okul ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredUsers}
          pagination={{ pageSize: 20 }}
        />
      </div>

      <Modal
        title={editing ? 'Kullanıcıyı Düzenle' : 'Yeni Alt Kullanıcı'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="full_name"
            label="Ad soyad"
            rules={[{ required: true, message: 'Ad soyad zorunludur' }]}
          >
            <Input placeholder="Ad Soyad" />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-posta"
            rules={[
              { required: true, message: 'E-posta zorunludur' },
              { type: 'email', message: 'Geçerli bir e-posta girin' },
            ]}
          >
            <Input placeholder="kullanici@okul.local" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'Yeni şifre (opsiyonel)' : 'Şifre'}
            rules={
              editing
                ? [{ min: 8, message: 'Şifre en az 8 karakter olmalı' }]
                : [
                    { required: true, message: 'Şifre zorunludur' },
                    { min: 8, message: 'Şifre en az 8 karakter olmalı' },
                  ]
            }
          >
            <Input.Password placeholder="En az 8 karakter" />
          </Form.Item>
          <Form.Item
            name="school_id"
            label="Okul"
            rules={[{ required: true, message: 'Okul seçin' }]}
          >
            <Select
              placeholder="Okul seçin"
              options={options.schools.map((school) => ({ value: school.id, label: school.name }))}
            />
          </Form.Item>
          <Form.Item
            name="school_role"
            label="Görev / Arayüz yetkisi"
            rules={[{ required: true, message: 'Yetki seçin' }]}
            extra="Menü ve işlem yetkileri bu role göre belirlenir."
          >
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="Aktif"
            valuePropName="checked"
            extra={
              editing && session?.user.id === editing.id
                ? 'Kendi hesabınızı pasife alamazsınız.'
                : undefined
            }
          >
            <Switch disabled={Boolean(editing && session?.user.id === editing.id)} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
