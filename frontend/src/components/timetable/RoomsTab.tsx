import { useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { createTimetableRoom, deleteTimetableRoom, updateTimetableRoom } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { TypedPhraseConfirmModal } from '../TypedPhraseConfirmModal'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../../utils/bulkDelete'
import { ROOM_TYPES, type TimetableRoom } from '../../types/timetable'
import type { TimetableCtx } from './shared'

export function RoomsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<Partial<TimetableRoom>>()
  const [editing, setEditing] = useState<TimetableRoom | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  const openForm = (room: TimetableRoom | null) => {
    setEditing(room)
    form.setFieldsValue(room || { name: '', room_type: 'laboratuvar', capacity: 1, is_active: true })
    setOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) await updateTimetableRoom(editing.id, values)
      else await createTimetableRoom({ ...values, school_id: ctx.project.school_id })
      setOpen(false)
      await ctx.reloadRooms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = (room: TimetableRoom) => {
    modal.confirm({
      title: `${room.name} silinsin mi?`,
      content: 'Bu mekana bağlı derslerin mekan bilgisi kaldırılır.',
      okButtonProps: { danger: true },
      okText: 'Sil',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTimetableRoom(room.id)
          await ctx.reloadRooms()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  return (
    <>
      <Typography.Paragraph type="secondary">
        Laboratuvar, spor salonu, BT sınıfı gibi paylaşılan mekanları tanımlayın. Kapasite, aynı saatte kaç şubenin
        mekanı birlikte kullanabileceğidir (ör. iki bölmeli spor salonu için 2). Hangi dersin hangi mekanda
        işleneceğini "Ders Atamaları" sekmesinden seçin. Mekanın kapalı olduğu saatler için "Kısıtlar" sekmesini
        kullanın. Mekanlar okul geneli içindir; tüm program çalışmalarında ortaktır.
      </Typography.Paragraph>
      <Space wrap style={{ marginBottom: 12 }}>
        {ctx.canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
            Yeni Mekan
          </Button>
        )}
        {ctx.canDelete && ctx.rooms.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
            Toplu sil ({ctx.rooms.length})
          </Button>
        )}
      </Space>
      <Table<TimetableRoom>
        rowKey="id"
        size="small"
        dataSource={ctx.rooms}
        pagination={false}
        columns={[
          { title: 'Mekan', dataIndex: 'name' },
          {
            title: 'Tür',
            dataIndex: 'room_type',
            render: (v: string | null) => ROOM_TYPES.find((t) => t.value === v)?.label || v || '—',
          },
          { title: 'Kapasite (şube)', dataIndex: 'capacity', width: 140 },
          { title: 'Aktif', dataIndex: 'is_active', width: 80, render: (v: boolean) => (v ? 'Evet' : 'Hayır') },
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_, r) => (
              <Space>
                {ctx.canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => openForm(r)} />}
                {ctx.canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        title={editing ? 'Mekanı Düzenle' : 'Yeni Mekan'}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        confirmLoading={saving}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Ad" rules={[{ required: true, message: 'Ad gerekli' }]}>
            <Input maxLength={100} placeholder="Fizik Laboratuvarı" />
          </Form.Item>
          <Form.Item name="room_type" label="Tür">
            <Select options={ROOM_TYPES} allowClear />
          </Form.Item>
          <Form.Item name="capacity" label="Aynı anda kullanabilecek şube sayısı" rules={[{ required: true }]}>
            <InputNumber min={1} max={20} addonAfter="şube" />
          </Form.Item>
          <Form.Item name="is_active" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Mekanları toplu sil"
        description={`Listedeki ${ctx.rooms.length} mekan silinecek. Bu mekanlara bağlı derslerin mekan bilgisi kalkar.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={async () => {
          setBulkLoading(true)
          try {
            const result = await bulkDeleteByIds(
              ctx.rooms.map((room) => room.id),
              (id) => deleteTimetableRoom(Number(id)),
            )
            const text = bulkDeleteResultMessage(result, 'mekan')
            if (result.failed === 0) message.success(text)
            else message.warning(text)
            setBulkOpen(false)
            await ctx.reloadRooms()
          } finally {
            setBulkLoading(false)
          }
        }}
      />
    </>
  )
}
