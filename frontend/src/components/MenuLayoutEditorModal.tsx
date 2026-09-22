import { useEffect, useMemo, useState, type DragEvent } from 'react'
import {
  App,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { updateMenuLayout } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { catalogFromNodes, type NavLeaf, type NavNode } from '../nav/tenantMenu'
import type { TenantMenuLayout } from '../types/menuLayout'
import { layoutFromNodes, newCustomGroupKey } from '../utils/menuLayout'
import { MENU_HOME_KEY } from '../types/menuLayout'

interface MenuLayoutEditorModalProps {
  open: boolean
  onClose: () => void
  /** İzin/modül filtresi uygulanmış varsayılan menü (layout öncesi) */
  catalogNodes: NavNode[]
  initialLayout: TenantMenuLayout | null | undefined
}

type DragPayload =
  | { kind: 'group'; groupKey: string }
  | { kind: 'leaf'; leafKey: string; fromGroup: string | null }

function cloneLayout(layout: TenantMenuLayout): TenantMenuLayout {
  return {
    version: 1,
    order: [...layout.order],
    hidden: [...layout.hidden],
    groups: Object.fromEntries(
      Object.entries(layout.groups).map(([k, v]) => [k, { label: v.label, children: [...v.children] }]),
    ),
  }
}

function removeLeafFromGroups(layout: TenantMenuLayout, leafKey: string) {
  for (const g of Object.values(layout.groups)) {
    g.children = g.children.filter((c) => c !== leafKey)
  }
  layout.order = layout.order.filter((k) => k !== leafKey)
  layout.hidden = layout.hidden.filter((k) => k !== leafKey)
}

export function MenuLayoutEditorModal({
  open,
  onClose,
  catalogNodes,
  initialLayout,
}: MenuLayoutEditorModalProps) {
  const { message } = App.useApp()
  const { session, setSessionPayload } = useAuth()
  const [draft, setDraft] = useState<TenantMenuLayout>(() =>
    cloneLayout(initialLayout || layoutFromNodes(catalogNodes)),
  )
  const [saving, setSaving] = useState(false)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const { leaves } = useMemo(() => catalogFromNodes(catalogNodes), [catalogNodes])

  useEffect(() => {
    if (!open) return
    setDraft(cloneLayout(initialLayout || layoutFromNodes(catalogNodes)))
  }, [open, initialLayout, catalogNodes])

  const topOrder = draft.order.filter((k) => k !== MENU_HOME_KEY)

  const leafLabel = (key: string) => leaves.get(key)?.label || key

  const onDragStart = (event: DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  const readPayload = (event: DragEvent): DragPayload | null => {
    try {
      return JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload
    } catch {
      return null
    }
  }

  const moveGroup = (groupKey: string, beforeKey: string | null) => {
    setDraft((prev) => {
      const next = cloneLayout(prev)
      next.order = next.order.filter((k) => k !== groupKey)
      if (!beforeKey) {
        next.order.push(groupKey)
      } else {
        const idx = next.order.indexOf(beforeKey)
        if (idx < 0) next.order.push(groupKey)
        else next.order.splice(idx, 0, groupKey)
      }
      if (!next.order.includes(MENU_HOME_KEY)) next.order.unshift(MENU_HOME_KEY)
      return next
    })
  }

  const moveLeaf = (leafKey: string, toGroup: string | null, beforeLeaf: string | null) => {
    if (leafKey === MENU_HOME_KEY) return
    setDraft((prev) => {
      const next = cloneLayout(prev)
      removeLeafFromGroups(next, leafKey)
      if (toGroup) {
        if (!next.groups[toGroup]) {
          next.groups[toGroup] = { label: toGroup, children: [] }
        }
        const children = next.groups[toGroup].children
        if (beforeLeaf) {
          const idx = children.indexOf(beforeLeaf)
          if (idx < 0) children.push(leafKey)
          else children.splice(idx, 0, leafKey)
        } else {
          children.push(leafKey)
        }
        if (!next.order.includes(toGroup)) next.order.push(toGroup)
      } else {
        // Üst seviye yaprak
        if (beforeLeaf && next.order.includes(beforeLeaf)) {
          const idx = next.order.indexOf(beforeLeaf)
          next.order.splice(idx, 0, leafKey)
        } else {
          next.order.push(leafKey)
        }
      }
      return next
    })
  }

  const hideLeaf = (leafKey: string) => {
    if (leafKey === MENU_HOME_KEY) return
    setDraft((prev) => {
      const next = cloneLayout(prev)
      removeLeafFromGroups(next, leafKey)
      if (!next.hidden.includes(leafKey)) next.hidden.push(leafKey)
      return next
    })
  }

  const unhideLeaf = (leafKey: string) => {
    setDraft((prev) => {
      const next = cloneLayout(prev)
      next.hidden = next.hidden.filter((k) => k !== leafKey)
      // Sistem grubuna veya sona ekle
      const systemKey = Object.keys(next.groups).find((k) => k === 'grp-system') || Object.keys(next.groups)[0]
      if (systemKey) {
        if (!next.groups[systemKey].children.includes(leafKey)) {
          next.groups[systemKey].children.push(leafKey)
        }
        if (!next.order.includes(systemKey)) next.order.push(systemKey)
      } else {
        next.order.push(leafKey)
      }
      return next
    })
  }

  const renameGroup = (groupKey: string, label: string) => {
    setDraft((prev) => {
      const next = cloneLayout(prev)
      if (next.groups[groupKey]) next.groups[groupKey].label = label.slice(0, 80)
      return next
    })
  }

  const addGroup = () => {
    const key = newCustomGroupKey()
    setDraft((prev) => {
      const next = cloneLayout(prev)
      next.groups[key] = { label: 'Yeni grup', children: [] }
      next.order.push(key)
      return next
    })
  }

  const deleteGroup = (groupKey: string) => {
    setDraft((prev) => {
      const next = cloneLayout(prev)
      const children = next.groups[groupKey]?.children || []
      delete next.groups[groupKey]
      next.order = next.order.filter((k) => k !== groupKey)
      // Çocukları üst seviyeye taşı
      for (const child of children) {
        if (!next.order.includes(child)) next.order.push(child)
      }
      return next
    })
  }

  const onDropOnGroup = (event: DragEvent, groupKey: string) => {
    event.preventDefault()
    setDragOverKey(null)
    const payload = readPayload(event)
    if (!payload) return
    if (payload.kind === 'group') {
      moveGroup(payload.groupKey, groupKey)
      return
    }
    moveLeaf(payload.leafKey, groupKey, null)
  }

  const onDropOnLeaf = (event: DragEvent, leafKey: string, groupKey: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverKey(null)
    const payload = readPayload(event)
    if (!payload) return
    if (payload.kind === 'group') {
      // grupları yaprak önüne taşımak için order'da leafKey kullanılamaz; groupKey önüne
      if (groupKey) moveGroup(payload.groupKey, groupKey)
      else moveGroup(payload.groupKey, leafKey)
      return
    }
    moveLeaf(payload.leafKey, groupKey, leafKey)
  }

  const onSave = async () => {
    setSaving(true)
    try {
      // Boş özel grupları temizle (standart boş gruplar da düşsün)
      const cleaned = cloneLayout(draft)
      for (const [key, g] of Object.entries(cleaned.groups)) {
        if (g.children.length === 0) {
          delete cleaned.groups[key]
          cleaned.order = cleaned.order.filter((k) => k !== key)
        }
      }
      if (!cleaned.order.includes(MENU_HOME_KEY)) cleaned.order.unshift(MENU_HOME_KEY)

      const result = await updateMenuLayout(cleaned)
      if (session) {
        setSessionPayload({ ...session, menu_layout: result.layout })
      }
      message.success('Menü düzeni kaydedildi')
      onClose()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onReset = async () => {
    setSaving(true)
    try {
      const result = await updateMenuLayout(null)
      if (session) {
        setSessionPayload({ ...session, menu_layout: result.layout })
      }
      message.success('Menü varsayılana döndü')
      onClose()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderLeafRow = (leafKey: string, groupKey: string | null) => {
    const leaf: NavLeaf | undefined = leaves.get(leafKey)
    if (!leaf) return null
    return (
      <div
        key={leafKey}
        className={`menu-layout-item${dragOverKey === leafKey ? ' is-drag-over' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, { kind: 'leaf', leafKey, fromGroup: groupKey })}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverKey(leafKey)
        }}
        onDragLeave={() => setDragOverKey((k) => (k === leafKey ? null : k))}
        onDrop={(e) => onDropOnLeaf(e, leafKey, groupKey)}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <HolderOutlined style={{ cursor: 'grab', color: '#888' }} />
            {leaf.icon}
            <span>{leaf.label}</span>
          </Space>
          <Button
            type="text"
            size="small"
            icon={<EyeInvisibleOutlined />}
            title="Gizle"
            onClick={() => hideLeaf(leafKey)}
          />
        </Space>
      </div>
    )
  }

  return (
    <Modal
      title="Menüyü düzenle"
      open={open}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      footer={
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button danger onClick={() => void onReset()} loading={saving}>
            Varsayılana dön
          </Button>
          <Space>
            <Button onClick={onClose}>Vazgeç</Button>
            <Button type="primary" onClick={() => void onSave()} loading={saving}>
              Kaydet
            </Button>
          </Space>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        Sürükleyerek sırayı ve grupları değiştirin. Ana Sayfa sabittir. Değişiklik tüm hesap
        kullanıcılarına uygulanır.
      </Typography.Paragraph>

      <div className="menu-layout-home">
        <Space>
          {leaves.get(MENU_HOME_KEY)?.icon}
          <Typography.Text strong>Ana Sayfa</Typography.Text>
          <Typography.Text type="secondary">(sabit)</Typography.Text>
        </Space>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {topOrder.map((key, idx) => {
          if (key.startsWith('grp-')) {
            const group = draft.groups[key]
            if (!group) return null
            return (
              <div key={key}>
                {idx > 0 && <div className="menu-layout-divider" />}
                <Card
                  size="small"
                  className={dragOverKey === key ? 'menu-layout-group is-drag-over' : 'menu-layout-group'}
                  title={
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverKey(key)
                      }}
                      onDrop={(e) => onDropOnGroup(e, key)}
                    >
                      <span
                        draggable
                        onDragStart={(e) => onDragStart(e, { kind: 'group', groupKey: key })}
                        style={{ cursor: 'grab', display: 'inline-flex' }}
                      >
                        <HolderOutlined />
                      </span>
                      <Input
                        size="small"
                        value={group.label}
                        onChange={(e) => renameGroup(key, e.target.value)}
                        style={{ width: 220 }}
                      />
                    </div>
                  }
                  extra={
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      title="Grubu kaldır"
                      onClick={() => deleteGroup(key)}
                    />
                  }
                >
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverKey(key)
                    }}
                    onDrop={(e) => onDropOnGroup(e, key)}
                    style={{ minHeight: 36 }}
                  >
                    {group.children.length === 0 ? (
                      <Typography.Text type="secondary">Öğeleri buraya sürükleyin</Typography.Text>
                    ) : (
                      group.children.map((child) => renderLeafRow(child, key))
                    )}
                  </div>
                </Card>
              </div>
            )
          }
          return (
            <div key={key}>
              {idx > 0 && <div className="menu-layout-divider" />}
              {renderLeafRow(key, null)}
            </div>
          )
        })}
      </Space>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addGroup}
        style={{ marginTop: 12, width: '100%' }}
      >
        Yeni grup
      </Button>

      {draft.hidden.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <EyeInvisibleOutlined />
              Gizli öğeler
            </Space>
          }
          style={{ marginTop: 12 }}
        >
          {draft.hidden.map((key) => (
            <div key={key} className="menu-layout-item">
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{leafLabel(key)}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => unhideLeaf(key)}
                >
                  Göster
                </Button>
              </Space>
            </div>
          ))}
        </Card>
      )}
    </Modal>
  )
}
