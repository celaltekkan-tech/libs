import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  Drawer,
  Empty,
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
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  TableOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { ExamRoomModal, SeatingLayoutBoard } from '../components/ExamRoomModal'
import { useAuth } from '../auth/AuthContext'
import {
  assignProctor,
  createExamRoom,
  createExamSession,
  deleteExamRoom,
  deleteExamSession,
  downloadSeatingExport,
  fetchSeating,
  generateSeating,
  listExamRooms,
  listExamSessions,
  listProctors,
  markSeatAttendance,
  removeProctor,
  updateExamRoom,
} from '../api/kelebek'
import { listClassrooms } from '../api/classrooms'
import { listTeachers } from '../api/teachers'
import { listScheduleTeachers } from '../api/schedule'
import { getErrorMessage } from '../api/client'
import type { ExamRoom, ExamRoomPayload, ExamSession, ProctorAssignment, SeatAssignment } from '../types/kelebek'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import type { Teacher } from '../types/teacher'
import type { ScheduleTeacherOption } from '../api/schedule'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function KelebekPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [rooms, setRooms] = useState<ExamRoom[]>([])
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [scheduleTeachers, setScheduleTeachers] = useState<ScheduleTeacherOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [seating, setSeating] = useState<SeatAssignment[]>([])
  const [proctors, setProctors] = useState<ProctorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false)
  const [roomEditorOpen, setRoomEditorOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null)
  const [duplicateRoom, setDuplicateRoom] = useState<ExamRoom | null>(null)
  const [seatingPreviewRoom, setSeatingPreviewRoom] = useState<ExamRoom | null>(null)
  const [roomSubmitting, setRoomSubmitting] = useState(false)
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [proctorModalOpen, setProctorModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')

  const [sessionForm] = Form.useForm<{ name: string; exam_date: string; notes?: string }>()
  const [generateForm] = Form.useForm<{ exam_room_ids: number[]; classroom_ids: number[] }>()
  const [proctorForm] = Form.useForm<{ exam_room_id: number; teacher_id: number }>()

  const canCreate = hasPermission('exams.create')
  const canDelete = hasPermission('exams.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roomData, sessionData, classroomData, teacherData, scheduleTeacherData] = await Promise.all([
        listExamRooms(),
        listExamSessions(),
        listClassrooms({ is_active: true }),
        listTeachers(),
        listScheduleTeachers().catch(() => []),
      ])
      setRooms(roomData)
      setSessions(sessionData)
      setClassrooms(classroomData)
      setTeachers(teacherData)
      setScheduleTeachers(scheduleTeacherData)
      if (sessionData.length > 0 && !selectedSessionId) setSelectedSessionId(sessionData[0].id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const loadSessionDetail = useCallback(async () => {
    if (!selectedSessionId) {
      setSeating([])
      setProctors([])
      return
    }
    try {
      const [seatData, proctorData] = await Promise.all([
        fetchSeating(selectedSessionId),
        listProctors(selectedSessionId),
      ])
      setSeating(seatData)
      setProctors(proctorData)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [selectedSessionId, message])

  useEffect(() => {
    void loadSessionDetail()
  }, [loadSessionDetail])

  const openAddRoom = () => {
    setEditingRoom(null)
    setDuplicateRoom(null)
    setRoomEditorOpen(true)
  }

  const openEditRoom = (room: ExamRoom) => {
    setEditingRoom(room)
    setDuplicateRoom(null)
    setRoomEditorOpen(true)
  }

  const openDuplicateRoom = (room: ExamRoom) => {
    setEditingRoom(null)
    setDuplicateRoom(room)
    setRoomEditorOpen(true)
  }

  const onSubmitRoom = async (payload: ExamRoomPayload, id?: number) => {
    if (!session) return
    setRoomSubmitting(true)
    try {
      if (id) {
        await updateExamRoom(id, payload)
        message.success('Salon güncellendi')
      } else {
        await createExamRoom(session.user.tenant_id, payload)
        message.success('Salon oluşturuldu')
      }
      setRoomEditorOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setRoomSubmitting(false)
    }
  }

  const onToggleRoomActive = async (room: ExamRoom, checked: boolean) => {
    try {
      await updateExamRoom(room.id, { is_active: checked })
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDeleteRoom = (room: ExamRoom) => {
    modal.confirm({
      title: 'Salonu sil',
      content: `"${room.name}" salonunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteExamRoom(room.id)
          message.success('Salon silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const roomColumns: ColumnsType<ExamRoom> = [
    { title: 'Salon Adı', dataIndex: 'name' },
    { title: 'Sıra Sayısı', dataIndex: 'capacity', width: 110 },
    {
      title: 'Oturma Düzeni',
      width: 120,
      align: 'center',
      render: (_: unknown, room: ExamRoom) => (
        <Button
          size="small"
          icon={<TableOutlined />}
          disabled={!room.seating_layout}
          onClick={() => setSeatingPreviewRoom(room)}
        />
      ),
    },
    {
      title: 'Sınav Salonu',
      width: 120,
      align: 'center',
      render: (_: unknown, room: ExamRoom) => (
        <Switch
          checked={room.is_active}
          checkedChildren="Aktif"
          unCheckedChildren="Pasif"
          disabled={!canCreate}
          onChange={(checked) => void onToggleRoomActive(room, checked)}
        />
      ),
    },
    {
      title: 'Seçenekler',
      width: 130,
      align: 'center',
      render: (_: unknown, room: ExamRoom) => (
        <Space size={4}>
          {canCreate && <Button size="small" icon={<CopyOutlined />} onClick={() => openDuplicateRoom(room)} />}
          {canCreate && <Button size="small" icon={<EditOutlined />} onClick={() => openEditRoom(room)} />}
          {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteRoom(room)} />}
        </Space>
      ),
    },
  ]

  const onCreateSession = async (values: { name: string; exam_date: string; notes?: string }) => {
    if (!session) return
    setSubmitting(true)
    try {
      const created = await createExamSession(session.user.tenant_id, values)
      message.success('Sınav oturumu oluşturuldu')
      setSessionModalOpen(false)
      sessionForm.resetFields()
      await load()
      setSelectedSessionId(created.id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteSession = (row: ExamSession) => {
    modal.confirm({
      title: 'Oturumu sil',
      content: `"${row.name}" oturumunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteExamSession(row.id)
          message.success('Silindi')
          setSelectedSessionId(null)
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onGenerate = async (values: { exam_room_ids: number[]; classroom_ids: number[] }) => {
    if (!session || !selectedSessionId) return
    setSubmitting(true)
    try {
      const result = await generateSeating(session.user.tenant_id, selectedSessionId, values)
      message.success(`${result.assigned} öğrenci yerleştirildi`)
      setGenerateModalOpen(false)
      void loadSessionDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onToggleAttendance = async (seat: SeatAssignment, present: boolean) => {
    if (!selectedSessionId) return
    try {
      await markSeatAttendance(selectedSessionId, [{ seat_assignment_id: seat.id, present }])
      void loadSessionDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onAssignProctor = async (values: { exam_room_id: number; teacher_id: number }) => {
    if (!session || !selectedSessionId) return
    try {
      await assignProctor(session.user.tenant_id, selectedSessionId, values)
      message.success('Gözetmen atandı')
      setProctorModalOpen(false)
      proctorForm.resetFields()
      void loadSessionDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onRemoveProctor = async (proctor: ProctorAssignment) => {
    if (!selectedSessionId) return
    try {
      await removeProctor(selectedSessionId, proctor.id)
      void loadSessionDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onExport = async () => {
    if (!selectedSessionId) return
    setSubmitting(true)
    try {
      const blob = await downloadSeatingExport(selectedSessionId, exportFormat)
      downloadBlob(blob, exportFilename('kelebek-oturma-plani', exportFormat))
      message.success('Dışa aktarma indirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const seatingByRoom = useMemo(() => {
    const map = new Map<number, { roomName: string; seats: SeatAssignment[] }>()
    seating.forEach((s) => {
      const key = s.exam_room_id
      if (!map.has(key)) map.set(key, { roomName: s.ExamRoom?.name || `#${key}`, seats: [] })
      map.get(key)!.seats.push(s)
    })
    return Array.from(map.entries())
  }, [seating])

  const seatColumns: ColumnsType<SeatAssignment> = [
    { title: 'Sıra', dataIndex: 'seat_no' },
    { title: 'Öğrenci', render: (_: unknown, s: SeatAssignment) => (s.Student ? `${s.Student.first_name} ${s.Student.last_name}` : '—') },
    { title: 'Sınıf', dataIndex: 'classroom_label' },
    {
      title: 'Katıldı mı',
      render: (_: unknown, s: SeatAssignment) => (
        <Checkbox checked={s.present !== false} onChange={(e) => void onToggleAttendance(s, e.target.checked)}>
          {s.present === false ? 'Katılmadı' : 'Katıldı'}
        </Checkbox>
      ),
    },
  ]

  const sessionColumns: ColumnsType<ExamSession> = [
    { title: 'Sınav Adı', dataIndex: 'name' },
    { title: 'Tarih', dataIndex: 'exam_date', width: 140 },
    {
      title: 'Not',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'İşlem',
      width: 160,
      align: 'center',
      render: (_: unknown, row: ExamSession) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            type={selectedSessionId === row.id ? 'primary' : 'default'}
            onClick={() => setSelectedSessionId(row.id)}
          >
            {selectedSessionId === row.id ? 'Seçili' : 'Seç'}
          </Button>
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteSession(row)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Kelebek Sistemi — Sınav Salon ve Oturma Planı">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Kelebek Sistemi — Sınav Salon ve Oturma Planı
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Select
          value={selectedSessionId ?? undefined}
          onChange={setSelectedSessionId}
          placeholder="Sınav oturumu seçin"
          loading={loading}
          options={sessions.map((s) => ({ value: s.id, label: `${s.name} (${s.exam_date})` }))}
          style={{ width: 300 }}
        />
        <Space wrap>
          <Button onClick={() => setRoomsDrawerOpen(true)}>Salonlar</Button>
          {canCreate && (
            <Button icon={<PlusOutlined />} onClick={() => setSessionModalOpen(true)}>
              Yeni Oturum
            </Button>
          )}
          {selectedSessionId && canDelete && (
            <Button danger onClick={() => onDeleteSession(sessions.find((s) => s.id === selectedSessionId)!)}>
              Oturumu Sil
            </Button>
          )}
        </Space>
      </Space>

      {selectedSessionId && (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            {canCreate && (
              <Button type="primary" onClick={() => setGenerateModalOpen(true)}>
                Oturma Planı Oluştur
              </Button>
            )}
            {canCreate && <Button onClick={() => setProctorModalOpen(true)}>Gözetmen Ata</Button>}
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel' },
                { value: 'csv', label: 'CSV' },
                { value: 'pdf', label: 'PDF' },
              ]}
              style={{ width: 100 }}
            />
            <Button icon={<DownloadOutlined />} loading={submitting} onClick={() => void onExport()}>
              Dışa Aktar
            </Button>
          </Space>

          {proctors.length > 0 && (
            <Space wrap style={{ marginBottom: 16 }}>
              {proctors.map((p) => (
                <Tag
                  key={p.id}
                  closable={canDelete}
                  onClose={(e) => {
                    e.preventDefault()
                    void onRemoveProctor(p)
                  }}
                >
                  {p.ExamRoom?.name}: {p.Teacher ? `${p.Teacher.first_name} ${p.Teacher.last_name}` : '—'}
                </Tag>
              ))}
            </Space>
          )}

          {seatingByRoom.length > 0 ? (
            <Tabs
              items={seatingByRoom.map(([roomId, group]) => ({
                key: String(roomId),
                label: `${group.roomName} (${group.seats.length})`,
                children: (
                  <Table
                    rowKey="id"
                    size="small"
                    columns={seatColumns}
                    dataSource={group.seats}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                ),
              }))}
            />
          ) : (
            <Empty description="Bu oturum için henüz oturma planı oluşturulmadı" style={{ margin: '32px 0' }} />
          )}
        </>
      )}

      <Typography.Title level={4} style={{ marginTop: selectedSessionId ? 32 : 0 }}>
        Oluşturulan Sınavlar
      </Typography.Title>
      <Table
        rowKey="id"
        loading={loading}
        size="small"
        columns={sessionColumns}
        dataSource={sessions}
        pagination={{ pageSize: 20 }}
        rowClassName={(row) => (row.id === selectedSessionId ? 'ant-table-row-selected' : '')}
        onRow={(row) => ({
          onClick: () => setSelectedSessionId(row.id),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: <Empty description="Henüz sınav oturumu oluşturulmadı" /> }}
        scroll={{ x: 'max-content' }}
      />

      <Drawer
        title="Sınav Salonları"
        open={roomsDrawerOpen}
        onClose={() => setRoomsDrawerOpen(false)}
        width={640}
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddRoom}>
              Salon Ekle
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          size="small"
          columns={roomColumns}
          dataSource={rooms}
          pagination={false}
          locale={{ emptyText: <Empty description="Henüz salon eklenmedi" /> }}
          scroll={{ x: 'max-content' }}
        />
      </Drawer>

      <ExamRoomModal
        open={roomEditorOpen}
        editing={editingRoom}
        duplicateFrom={duplicateRoom}
        submitting={roomSubmitting}
        onCancel={() => setRoomEditorOpen(false)}
        onSubmit={onSubmitRoom}
      />

      <Modal
        title={`Oturma Düzeni${seatingPreviewRoom ? ` — ${seatingPreviewRoom.name}` : ''}`}
        open={!!seatingPreviewRoom}
        onCancel={() => setSeatingPreviewRoom(null)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        {seatingPreviewRoom?.seating_layout ? (
          <SeatingLayoutBoard layout={seatingPreviewRoom.seating_layout} />
        ) : (
          <Empty description="Bu salon için oturma düzeni tanımlı değil" />
        )}
      </Modal>

      <Modal
        title="Yeni Sınav Oturumu"
        open={sessionModalOpen}
        onCancel={() => setSessionModalOpen(false)}
        onOk={() => sessionForm.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={sessionForm} layout="vertical" onFinish={onCreateSession}>
          <Form.Item name="name" label="Oturum adı" rules={[{ required: true, message: 'Ad zorunludur' }]}>
            <Input placeholder="Örn. 1. Dönem Ortak Sınavı" />
          </Form.Item>
          <Form.Item name="exam_date" label="Tarih" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Kelebek Oturma Planı Oluştur"
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={() => generateForm.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          Seçilen sınıflardaki öğrenciler, aynı sınıftan öğrencilerin yan yana gelmemesi için birbirine
          karıştırılarak seçilen salonlara dağıtılır.
        </Typography.Paragraph>
        <Form form={generateForm} layout="vertical" onFinish={onGenerate}>
          <Form.Item name="exam_room_ids" label="Salonlar" rules={[{ required: true, message: 'En az bir salon seçin' }]}>
            <Select
              mode="multiple"
              options={rooms
                .filter((r) => r.is_active)
                .map((r) => ({ value: r.id, label: r.name }))}
              placeholder="Aktif salonlar"
            />
          </Form.Item>
          <Form.Item name="classroom_ids" label="Sınıflar" rules={[{ required: true, message: 'En az bir sınıf seçin' }]}>
            <Select mode="multiple" options={classrooms.map((c) => ({ value: c.id, label: classroomLabel(c) }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Gözetmen Ata"
        open={proctorModalOpen}
        onCancel={() => setProctorModalOpen(false)}
        onOk={() => proctorForm.submit()}
        okText="Ata"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={proctorForm} layout="vertical" onFinish={onAssignProctor}>
          <Form.Item name="exam_room_id" label="Salon" rules={[{ required: true, message: 'Salon seçimi zorunludur' }]}>
            <Select
              options={rooms
                .filter((r) => r.is_active)
                .map((r) => ({ value: r.id, label: r.name }))}
              placeholder="Aktif salon seçin"
            />
          </Form.Item>
          <Form.Item
            name="teacher_id"
            label="Öğretmen"
            rules={[{ required: true, message: 'Öğretmen seçimi zorunludur' }]}
            extra={
              scheduleTeachers.length > 0
                ? 'Öncelikle ders programındaki öğretmenler listelenir.'
                : 'Ders programı yüklenince program öğretmenleri burada öncelikli görünür.'
            }
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={[
                ...(scheduleTeachers.length
                  ? [
                      {
                        label: 'Ders programından',
                        options: scheduleTeachers.map((t) => ({
                          value: t.id,
                          label: `${t.first_name} ${t.last_name}${
                            t.subject_names.length ? ` (${t.subject_names.slice(0, 2).join(', ')})` : ''
                          }`,
                        })),
                      },
                    ]
                  : []),
                {
                  label: 'Tüm öğretmenler',
                  options: teachers
                    .filter((t) => !scheduleTeachers.some((s) => s.id === t.id))
                    .map((t) => ({
                      value: t.id,
                      label: `${t.first_name} ${t.last_name}`,
                    })),
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
