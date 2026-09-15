import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { RoleGroupsPanel } from '../components/RoleGroupsPanel'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import {
  createManagedUser,
  deleteManagedUser,
  fetchUserFormOptions,
  listManagedUsers,
  updateManagedUser,
} from '../api/managedUsers'
import { getErrorMessage } from '../api/client'
import type { ManagedUser, ManagedUserPayload, UserFormOptions } from '../types/managedUser'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'

interface UserFormValues {
  full_name: string
  email: string
  password?: string
  school_id: number
  role_id: number
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
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

  const roleOptions = useMemo(
    () =>
      options.school_roles.map((r) => ({
        value: r.id,
        label: `${r.name}${r.is_system ? '' : ' (özel)'}${r.description ? ` — ${r.description}` : ''}`,
      })),
    [options.school_roles],
  )

  const resolveRoleId = (user: ManagedUser | null): number | undefined => {
    if (!user) return options.school_roles[0]?.id
    const byAssignment = user.school_assignments?.[0]?.role_id
    if (byAssignment) return byAssignment
    const byName = options.school_roles.find((r) => r.name === user.school_role)
    return byName?.id
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      role_id: options.school_roles.find((r) => r.name === 'Memur')?.id || options.school_roles[0]?.id,
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
      role_id: resolveRoleId(user),
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

      const roleMeta = options.school_roles.find((r) => r.id === values.role_id)
      const payload: ManagedUserPayload = {
        full_name: values.full_name,
        email: values.email,
        school_id: values.school_id,
        role_id: values.role_id,
        school_role: roleMeta?.name || 'Memur',
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

  const onBulkDelete = async () => {
    const ids = filteredUsers.filter((u) => u.id !== session?.user.id).map((u) => u.id)
    if (ids.length === 0) {
      message.warning('Silinecek kullanıcı yok (kendi hesabınız hariç tutulur)')
      setBulkOpen(false)
      return
    }
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(ids, (id) => deleteManagedUser(Number(id)))
      const text = bulkDeleteResultMessage(result, 'kullanıcı')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
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
      title: 'Yetki grubu',
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
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Kullanıcılar ve Yetkilendirme
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Özel yetki grupları tanımlayın, her menü için yetki verin ve kullanıcılara atayın. {quotaLabel}
        </Typography.Paragraph>

        <Tabs
          items={[
            {
              key: 'roles',
              label: 'Yetki Grupları',
              children: <RoleGroupsPanel />,
            },
            {
              key: 'users',
              label: 'Kullanıcılar',
              children: (
                <>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="Ad, e-posta, yetki veya okul ile ara..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ maxWidth: 420 }}
                    />
                    {canDelete && filteredUsers.length > 0 && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                        Toplu sil ({filteredUsers.length})
                      </Button>
                    )}
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
                      Plan kullanıcı limitine ulaşıldı ({options.user_count}/{options.user_limit}).
                    </Typography.Paragraph>
                  )}

                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={filteredUsers}
                    pagination={tablePagination(20)}
                    scroll={{ x: 'max-content' }}
                  />
                </>
              ),
            },
          ]}
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
          <Form.Item name="full_name" label="Ad soyad" rules={[{ required: true, message: 'Ad soyad zorunludur' }]}>
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
          <Form.Item name="school_id" label="Okul" rules={[{ required: true, message: 'Okul seçin' }]}>
            <Select
              placeholder="Okul seçin"
              options={options.schools.map((school) => ({ value: school.id, label: school.name }))}
            />
          </Form.Item>
          <Form.Item
            name="role_id"
            label="Yetki grubu"
            rules={[{ required: true, message: 'Yetki grubu seçin' }]}
            extra="Menü görünürlüğü ve işlem yetkileri bu gruba göre belirlenir."
          >
            <Select showSearch optionFilterProp="label" options={roleOptions} />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="Aktif"
            valuePropName="checked"
            extra={
              editing && session?.user.id === editing.id ? 'Kendi hesabınızı pasife alamazsınız.' : undefined
            }
          >
            <Switch disabled={Boolean(editing && session?.user.id === editing.id)} />
          </Form.Item>
        </Form>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Kullanıcıları toplu sil"
        description={`Filtreye uyan ${filteredUsers.length} kullanıcı kaydı silinecek (kendi hesabınız hariç).`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
