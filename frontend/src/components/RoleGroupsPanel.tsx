import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createRole,
  deleteRole,
  fetchPermissionCatalog,
  listRoles,
  updateRole,
} from '../api/roles'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ACTION_LABELS } from '../constants/menuPermissions'
import type { PermissionCatalog, TenantRole } from '../types/role'
import { TypedPhraseConfirmModal } from './TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'

export function RoleGroupsPanel() {
  const { message, modal } = App.useApp()
  const { hasPermission } = useAuth()

  const [roles, setRoles] = useState<TenantRole[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<TenantRole | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<{ role_name: string; description?: string; clone_from_role_id?: number }>()

  const canCreate = hasPermission('users.create')
  const canUpdate = hasPermission('users.update')
  const canDelete = hasPermission('users.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roleRows, cat] = await Promise.all([listRoles(), fetchPermissionCatalog()])
      setRoles(roleRows)
      setCatalog(cat)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const deletableRoles = useMemo(() => roles.filter((r) => !r.is_system), [roles])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => deletableRoles.map((r) => r.id),
    deleteOne: (id) => deleteRole(Number(id)),
    noun: 'yetki grubu',
    reload: () => void load(),
    message,
  })

  const openCreate = () => {
    setEditing(null)
    setSelectedKeys([])
    form.resetFields()
    setEditorOpen(true)
  }

  const openEdit = (role: TenantRole) => {
    if (role.is_system) {
      message.info('Sistem rolleri değiştirilemez. Kopyala ile özel grup oluşturun.')
      return
    }
    setEditing(role)
    setSelectedKeys([...role.permission_keys])
    form.setFieldsValue({
      role_name: role.role_name,
      description: role.description || undefined,
    })
    setEditorOpen(true)
  }

  const openClone = (role: TenantRole) => {
    setEditing(null)
    setSelectedKeys([...role.permission_keys])
    form.setFieldsValue({
      role_name: `${role.role_name} (Özel)`,
      description: role.description || undefined,
      clone_from_role_id: role.id,
    })
    setEditorOpen(true)
  }

  const onSave = async (values: { role_name: string; description?: string }) => {
    setSubmitting(true)
    try {
      if (editing) {
        await updateRole(editing.id, {
          role_name: values.role_name,
          description: values.description || null,
          permission_keys: selectedKeys,
        })
        message.success('Yetki grubu güncellendi')
      } else {
        await createRole({
          role_name: values.role_name,
          description: values.description || null,
          permission_keys: selectedKeys,
        })
        message.success('Yetki grubu oluşturuldu')
      }
      setEditorOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (role: TenantRole) => {
    modal.confirm({
      title: 'Yetki grubunu sil',
      content: `"${role.role_name}" silinsin mi?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteRole(role.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      if (checked) return prev.includes(key) ? prev : [...prev, key]
      return prev.filter((k) => k !== key)
    })
  }

  const toggleMenuAll = (keys: string[], checked: boolean) => {
    setSelectedKeys((prev) => {
      if (checked) return Array.from(new Set([...prev, ...keys]))
      return prev.filter((k) => !keys.includes(k))
    })
  }

  const groupedMenus = useMemo(() => {
    if (!catalog) return []
    const map = new Map<string, typeof catalog.menus>()
    for (const menu of catalog.menus) {
      if (!map.has(menu.group)) map.set(menu.group, [])
      map.get(menu.group)!.push(menu)
    }
    return Array.from(map.entries())
  }, [catalog])

  const columns: ColumnsType<TenantRole> = [
    {
      title: 'Yetki Grubu',
      dataIndex: 'role_name',
      render: (name: string, row) => (
        <Space>
          <span>{name}</span>
          {row.is_system ? <Tag>Sistem</Tag> : <Tag color="blue">Özel</Tag>}
        </Space>
      ),
    },
    {
      title: 'Açıklama',
      dataIndex: 'description',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'İzin sayısı',
      width: 110,
      render: (_: unknown, row) => row.permission_keys?.length || 0,
    },
    {
      title: 'İşlem',
      width: 160,
      render: (_: unknown, row) => (
        <Space size={4}>
          {canCreate && (
            <Button size="small" icon={<CopyOutlined />} title="Kopyala" onClick={() => openClone(row)} />
          )}
          {!row.is_system && canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          )}
          {!row.is_system && canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 640 }}>
          İstediğiniz yetki grubunu tanımlayın; her menü için görüntüle / ekle / düzenle / sil yetkilerini
          ayrı ayrı verin. Sistem rolleri sabittir — kopyalayarak özelleştirin.
        </Typography.Paragraph>
        <Space wrap>
          {canDelete && deletableRoles.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
              Toplu sil ({deletableRoles.length})
            </Button>
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni Yetki Grubu
            </Button>
          )}
        </Space>
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={roles} pagination={false} />

      <Modal
        title={editing ? 'Yetki Grubunu Düzenle' : 'Yeni Yetki Grubu'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        width={880}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item name="role_name" label="Grup adı" rules={[{ required: true, message: 'Ad zorunludur' }]}>
            <Input placeholder="Örn. Sınav Komisyonu" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={2} placeholder="Bu grubun ne işe yaradığı" />
          </Form.Item>
        </Form>

        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Menü yetkileri ({selectedKeys.length} seçili)
        </Typography.Text>

        <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          {groupedMenus.map(([groupName, menus]) => (
            <div key={groupName} style={{ marginBottom: 20 }}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {groupName}
              </Typography.Title>
              {menus.map((menu) => {
                const keys = menu.permissions.map((p) => p.key).filter((k) => menu.permissions.find((p) => p.key === k)?.id)
                const allOn = keys.length > 0 && keys.every((k) => selectedKeys.includes(k))
                return (
                  <div
                    key={menu.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                  >
                    <div style={{ minWidth: 180, fontWeight: 500 }}>{menu.label}</div>
                    <Checkbox checked={allOn} onChange={(e) => toggleMenuAll(keys, e.target.checked)}>
                      Tümü
                    </Checkbox>
                    {menu.permissions.map((perm) => (
                      <Checkbox
                        key={perm.key}
                        disabled={!perm.id}
                        checked={selectedKeys.includes(perm.key)}
                        onChange={(e) => toggleKey(perm.key, e.target.checked)}
                      >
                        {ACTION_LABELS[perm.action] || perm.action}
                      </Checkbox>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Yetki gruplarını toplu sil"
        description={`${deletableRoles.length} özel yetki grubu silinecek (sistem rolleri hariç).`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </div>
  )
}
