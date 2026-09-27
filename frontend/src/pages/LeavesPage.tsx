import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Tabs, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import {
  createLeaveRecord,
  deleteLeaveRecord,
  listLeaveRecords,
  updateLeaveRecord,
} from '../api/leaves'
import { listTeachers } from '../api/teachers'
import { LeaveCalendarView } from '../components/LeaveCalendarView'
import { getErrorMessage } from '../api/client'
import { LEAVE_TYPE_LABELS } from '../types/leaveRecord'
import type { LeaveRecord } from '../types/leaveRecord'
import type { Teacher } from '../types/teacher'
import { tablePagination } from '../utils/tablePagination'
import { teacherTitleParts } from '../utils/teacherTitle'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'

interface LeaveFormValues {
  teacher_id: number
  leave_type: string
  range: [dayjs.Dayjs, dayjs.Dayjs]
  reason?: string
}

export function LeavesPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<LeaveRecord[]>([])
  const [yearReports, setYearReports] = useState<LeaveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<LeaveFormValues>()

  const isReportPerson = (teacher: Teacher) => {
    if (teacher.employment_type === 'ucretli') return false
    const text = `${teacher.unvan || ''} ${teacher.title_branch || ''} ${teacher.brans || ''} ${teacher.kariyer || ''}`.toLocaleLowerCase(
      'tr-TR',
    )
    if (text.includes('müdür')) return true
    return teacher.personnel_type === 'ogretmen' || teacher.personnel_type === 'memur'
  }

  const canCreate = hasPermission('leaves.create')
  const canUpdate = hasPermission('leaves.update')
  const canDelete = hasPermission('leaves.delete')

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listTeachers()
      const eligible = data.filter(isReportPerson)
      setTeachers(eligible)
      setSelectedTeacherId((current) => current ?? eligible[0]?.id ?? null)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadTeachers()
  }, [loadTeachers])

  const loadForTeacher = useCallback(async () => {
    setRowsLoading(true)
    try {
      const [rowsData, yearData] = await Promise.all([
        selectedTeacherId
          ? listLeaveRecords({ teacher_id: selectedTeacherId, year, leave_type: 'rapor' })
          : Promise.resolve([]),
        listLeaveRecords({ year, leave_type: 'rapor' }),
      ])
      setRows(rowsData)
      setYearReports(yearData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setRowsLoading(false)
    }
  }, [selectedTeacherId, year, message])

  useEffect(() => {
    void loadForTeacher()
  }, [loadForTeacher])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => rows.map((r) => r.id),
    deleteOne: (id) => deleteLeaveRecord(Number(id)),
    noun: 'rapor kaydı',
    reload: () => void loadForTeacher(),
    message,
  })

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || null,
    [teachers, selectedTeacherId],
  )

  const openCreate = () => {
    if (!selectedTeacherId) return
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ teacher_id: selectedTeacherId, leave_type: 'rapor' })
    setModalOpen(true)
  }

  const openEdit = (row: LeaveRecord) => {
    setEditing(row)
    form.setFieldsValue({
      teacher_id: row.teacher_id,
      leave_type: row.leave_type,
      range: [dayjs(row.start_date), dayjs(row.end_date)],
      reason: row.reason || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: LeaveFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = {
        teacher_id: values.teacher_id,
        leave_type: values.leave_type,
        start_date: values.range[0].format('YYYY-MM-DD'),
        end_date: values.range[1].format('YYYY-MM-DD'),
        reason: values.reason || null,
      }
      if (editing) {
        await updateLeaveRecord(editing.id, payload)
        message.success('Rapor kaydı güncellendi. 7 günü aşan kısım maaş değişikliği formuna işlenir.')
      } else {
        await createLeaveRecord(session.user.tenant_id, { ...payload, leave_type: 'rapor' })
        message.success('Rapor kaydedildi. 7 günü aşan kısım maaş değişikliği formuna işlenir.')
      }
      setModalOpen(false)
      void loadForTeacher()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: LeaveRecord) => {
    modal.confirm({
      title: 'Rapor kaydını sil',
      content: 'Bu rapor kaydını silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteLeaveRecord(row.id)
          message.success('Rapor kaydı silindi')
          void loadForTeacher()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const reportDaysByTeacher = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of yearReports) {
      map.set(row.teacher_id, (map.get(row.teacher_id) || 0) + Number(row.day_count || 0))
    }
    return map
  }, [yearReports])

  const selectedDays = selectedTeacherId ? reportDaysByTeacher.get(selectedTeacherId) || 0 : 0
  const withinFree = Math.min(7, selectedDays)
  const excessDays = Math.max(0, selectedDays - 7)

  const columns: ColumnsType<LeaveRecord> = [
    { title: 'Kayıt', dataIndex: 'leave_type', render: (v: string) => LEAVE_TYPE_LABELS[v] || v },
    { title: 'Başlangıç', dataIndex: 'start_date' },
    { title: 'Bitiş', dataIndex: 'end_date' },
    { title: 'Gün', dataIndex: 'day_count' },
    { title: 'Açıklama', dataIndex: 'reason', render: (v: string | null) => v || '—' },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: LeaveRecord) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const personnelTab = (
    <>
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select
            value={selectedTeacherId ?? undefined}
            onChange={setSelectedTeacherId}
            placeholder="Personel seçin"
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            style={{ width: 240 }}
          />
          <InputNumber value={year} onChange={(v) => setYear(Number(v) || year)} style={{ width: 100 }} />
        </Space>
        <Space wrap>
          {canDelete && rows.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
              Toplu sil ({rows.length})
            </Button>
          )}
          {canCreate && selectedTeacherId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni Rapor
            </Button>
          )}
        </Space>
      </Space>

      <SortableTable
        rowKey="id"
        size="small"
        loading={rowsLoading}
        style={{ marginBottom: 16 }}
        pagination={false}
        dataSource={teachers.map((teacher) => ({
          id: teacher.id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          role: teacherTitleParts(teacher).unvan || teacher.title_branch || 'Personel',
          days: reportDaysByTeacher.get(teacher.id) || 0,
        }))}
        columns={[
          { title: 'Personel', dataIndex: 'name' },
          { title: 'Görev', dataIndex: 'role' },
          { title: `${year} rapor günü`, dataIndex: 'days' },
          {
            title: '7 gün içinde',
            render: (_: unknown, row: { id: number; days: number }) => Math.min(7, row.days),
          },
          {
            title: 'Maaşa yansıyan',
            render: (_: unknown, row: { id: number; days: number }) => {
              const extra = Math.max(0, row.days - 7)
              return extra > 0 ? <Tag color="red">{extra} gün</Tag> : '0'
            },
          },
        ]}
        onRow={(row) => ({
          onClick: () => setSelectedTeacherId(row.id),
          style: { cursor: 'pointer', background: row.id === selectedTeacherId ? '#fffbe6' : undefined },
        })}
      />

      {selectedTeacher && (
        <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Personel">
            {selectedTeacher.first_name} {selectedTeacher.last_name}
          </Descriptions.Item>
          <Descriptions.Item label="Ücret kesintisiz">{withinFree} gün</Descriptions.Item>
          <Descriptions.Item label="Maaş değişikliğine giden">
            <Tag color={excessDays > 0 ? 'red' : 'green'}>{excessDays} gün</Tag>
          </Descriptions.Item>
        </Descriptions>
      )}

      <SortableTable
        rowKey="id"
        loading={rowsLoading}
        columns={columns}
        dataSource={rows}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
      />
    </>
  )

  return (
    <AppLayout title="Rapor Takibi">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Rapor Takibi
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Öğretmen, memur, müdür ve müdür yardımcılarının sağlık raporları burada tutulur. 1 Ocak–31 Aralık arasında ilk 7 gün ücret kesintisine girmez. 7 günü aşan kısım, raporun düştüğü ayın maaş değişikliği formuna yazılır.
      </Typography.Paragraph>

      <Tabs
        items={[
          { key: 'personnel', label: 'Personel Bazlı', children: personnelTab },
          { key: 'calendar', label: 'Takvim', children: <LeaveCalendarView /> },
        ]}
      />

      <Modal
        title={editing ? 'Rapor kaydını düzenle' : 'Yeni rapor'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="teacher_id" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="leave_type" hidden initialValue="rapor">
            <Input />
          </Form.Item>
          <Form.Item name="range" label="Rapor tarih aralığı" rules={[{ required: true, message: 'Tarih aralığı zorunludur' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Açıklama">
            <Input.TextArea rows={2} placeholder="Opsiyonel açıklama" />
          </Form.Item>
        </Form>
      </Modal>

      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Rapor kayıtlarını toplu sil"
        description={`Seçili personele ait ${rows.length} rapor kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
