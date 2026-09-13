import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Switch, Tabs, Typography } from 'antd'
import { CloseCircleFilled } from '@ant-design/icons'
import {
  computeSeatingCapacity,
  type ExamRoom,
  type ExamRoomPayload,
  type SeatingLayout,
  type SeatingLayoutGroup,
  type SeatType,
} from '../types/kelebek'

function defaultGroup(name: string, columnsCount: number): SeatingLayoutGroup {
  return {
    name,
    rows: 5,
    columns: Array.from({ length: columnsCount }, () => true),
    disabled_seats: [],
  }
}

const ROW_OPTIONS = Array.from({ length: 20 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const GROUP_COUNT_OPTIONS = Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))

interface SeatingLayoutBoardProps {
  layout: SeatingLayout
  editable?: boolean
  onChangeGroups?: (groups: SeatingLayoutGroup[]) => void
}

export function SeatingLayoutBoard({ layout, editable, onChangeGroups }: SeatingLayoutBoardProps) {
  const toggleColumn = (groupIdx: number, colIdx: number) => {
    if (!onChangeGroups) return
    onChangeGroups(
      layout.groups.map((g, i) =>
        i === groupIdx ? { ...g, columns: g.columns.map((v, c) => (c === colIdx ? !v : v)) } : g,
      ),
    )
  }

  const toggleSeat = (groupIdx: number, slot: number) => {
    if (!onChangeGroups) return
    onChangeGroups(
      layout.groups.map((g, i) => {
        if (i !== groupIdx) return g
        const disabled = new Set(g.disabled_seats)
        if (disabled.has(slot)) disabled.delete(slot)
        else disabled.add(slot)
        return { ...g, disabled_seats: Array.from(disabled) }
      }),
    )
  }

  return (
    <div>
      <div
        style={{
          background: '#262626',
          color: '#fff',
          textAlign: 'center',
          padding: '8px 0',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 12,
          letterSpacing: 1,
        }}
      >
        TAHTA
      </div>
      <Space align="start" wrap size={24}>
        {layout.groups.map((group, gi) => {
          let seatCounter = 0
          const colCount = group.columns.length
          return (
            <div key={gi} style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 12 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                {group.name}
              </Typography.Text>
              <Space style={{ marginBottom: 8 }}>
                {group.columns.map((on, ci) => (
                  <Switch key={ci} size="small" checked={on} disabled={!editable} onChange={() => toggleColumn(gi, ci)} />
                ))}
              </Space>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${colCount}, 56px)`,
                  gap: 8,
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
              >
                {Array.from({ length: group.rows }).flatMap((_, r) =>
                  group.columns.map((colOn, c) => {
                    const slot = r * colCount + c
                    const isDisabled = group.disabled_seats.includes(slot)
                    if (!colOn) {
                      return <div key={slot} style={{ width: 56, height: 40 }} />
                    }
                    if (!isDisabled) seatCounter += 1
                    return (
                      <div
                        key={slot}
                        style={{
                          position: 'relative',
                          width: 56,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDisabled ? '#f5f5f5' : '#f6ffed',
                          border: `1px solid ${isDisabled ? '#d9d9d9' : '#b7eb8f'}`,
                          borderRadius: 6,
                          color: isDisabled ? '#bfbfbf' : '#389e0d',
                          fontSize: 12,
                        }}
                      >
                        {!isDisabled && seatCounter}
                        {editable && (
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<CloseCircleFilled style={{ fontSize: 14 }} />}
                            style={{ position: 'absolute', top: -10, right: -10, padding: 0, width: 18, height: 18, minWidth: 18, lineHeight: 1 }}
                            onClick={() => toggleSeat(gi, slot)}
                          />
                        )}
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
          )
        })}
      </Space>
    </div>
  )
}

interface ExamRoomModalProps {
  open: boolean
  editing?: ExamRoom | null
  duplicateFrom?: ExamRoom | null
  submitting?: boolean
  onCancel: () => void
  onSubmit: (payload: ExamRoomPayload, id?: number) => Promise<void>
}

export function ExamRoomModal({ open, editing, duplicateFrom, submitting, onCancel, onSubmit }: ExamRoomModalProps) {
  const [form] = Form.useForm<{ name: string; building?: string; floor?: string; is_active: boolean }>()
  const [tab, setTab] = useState<'general' | 'seating'>('general')
  const [seatType, setSeatType] = useState<SeatType>('ikili')
  const [groups, setGroups] = useState<SeatingLayoutGroup[]>([defaultGroup('1.Grup', 2)])

  useEffect(() => {
    if (!open) return
    setTab('general')
    const source = editing || duplicateFrom
    if (source) {
      form.setFieldsValue({
        name: duplicateFrom ? `${source.name} (Kopya)` : source.name,
        building: source.building || undefined,
        floor: source.floor || undefined,
        is_active: source.is_active,
      })
      if (source.seating_layout) {
        setSeatType(source.seating_layout.seat_type)
        setGroups(source.seating_layout.groups)
        return
      }
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
    setSeatType('ikili')
    setGroups([defaultGroup('1.Grup', 2)])
  }, [open, editing, duplicateFrom, form])

  const columnsCount = seatType === 'ikili' ? 2 : 1
  const groupCount = groups.length

  const onSeatTypeChange = (value: SeatType) => {
    setSeatType(value)
    const nextColumns = value === 'ikili' ? 2 : 1
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        columns: Array.from({ length: nextColumns }, (_, i) => g.columns[i] ?? true),
        disabled_seats: [],
      })),
    )
  }

  const onGroupCountChange = (value: number) => {
    setGroups((prev) => {
      const next = prev.slice(0, value)
      while (next.length < value) next.push(defaultGroup(`${next.length + 1}.Grup`, columnsCount))
      return next
    })
  }

  const updateGroupRows = (idx: number, rows: number) => {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, rows, disabled_seats: [] } : g)))
  }

  const layout: SeatingLayout = { seat_type: seatType, groups }
  const totalSeats = computeSeatingCapacity(layout)

  const goToSeating = async () => {
    await form.validateFields(['name'])
    setTab('seating')
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    await onSubmit(
      {
        name: values.name,
        building: values.building || null,
        floor: values.floor || null,
        is_active: values.is_active,
        seating_layout: layout,
      },
      editing?.id,
    )
  }

  return (
    <Modal
      title={editing ? 'Salon Düzenle' : 'Salon Ekle'}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={tab === 'seating' ? 760 : 480}
      destroyOnHidden
    >
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'general' | 'seating')}
        items={[
          {
            key: 'general',
            label: 'Genel Bilgiler',
            children: (
              <Form form={form} layout="vertical">
                <Space size="large" style={{ width: '100%' }} align="start" wrap>
                  <Form.Item
                    name="name"
                    label="Salon Adı"
                    rules={[{ required: true, message: 'Salon adı zorunludur' }]}
                    style={{ minWidth: 200, flex: 1 }}
                  >
                    <Input placeholder="Örn. 9/A" />
                  </Form.Item>
                  <Form.Item name="is_active" label="Sınav Salonu" valuePropName="checked" initialValue>
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Space>
                <Space size="large" style={{ width: '100%' }} align="start" wrap>
                  <Form.Item name="building" label="Bina" style={{ minWidth: 200, flex: 1 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="floor" label="Kat" style={{ minWidth: 200, flex: 1 }}>
                    <Input />
                  </Form.Item>
                </Space>
                <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                  <Button onClick={onCancel}>Pencereyi Kapat</Button>
                  <Button type="primary" onClick={() => void goToSeating()}>
                    İlerle
                  </Button>
                </Space>
              </Form>
            ),
          },
          {
            key: 'seating',
            label: 'Oturma Düzeni',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space wrap size="large" align="start">
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary">Sıra Tipi</Typography.Text>
                    <Select
                      value={seatType}
                      onChange={onSeatTypeChange}
                      style={{ width: 140 }}
                      options={[
                        { value: 'ikili', label: 'İkili' },
                        { value: 'tekli', label: 'Tekli' },
                      ]}
                    />
                  </Space>
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary">Grup Sayısı</Typography.Text>
                    <Select value={groupCount} onChange={onGroupCountChange} style={{ width: 90 }} options={GROUP_COUNT_OPTIONS} />
                  </Space>
                  {groups.map((g, i) => (
                    <Space direction="vertical" size={0} key={i}>
                      <Typography.Text type="secondary">{g.name} Sıra Sayısı</Typography.Text>
                      <Select value={g.rows} onChange={(v) => updateGroupRows(i, v)} style={{ width: 90 }} options={ROW_OPTIONS} />
                    </Space>
                  ))}
                </Space>
                <SeatingLayoutBoard layout={layout} editable onChangeGroups={setGroups} />
                <Typography.Text type="secondary">Toplam sıra sayısı: {totalSeats}</Typography.Text>
                <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                  <Button onClick={onCancel}>Pencereyi Kapat</Button>
                  <Button type="primary" loading={submitting} onClick={() => void handleSave()}>
                    Kaydet
                  </Button>
                </Space>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  )
}
