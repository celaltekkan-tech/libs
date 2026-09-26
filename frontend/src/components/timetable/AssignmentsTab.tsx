import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  bulkUpdateTimetableAssignments,
  createTimetableAssignment,
  deleteTimetableAssignment,
  generateTimetableAssignments,
  listTimetableAssignments,
  updateTimetableAssignment,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import type { TimetableAssignment, TimetableAssignmentPayload } from '../../types/timetable'
import { shortClassroom, teacherFullName, type TimetableCtx } from './shared'

export function AssignmentsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<TimetableAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [classroomFilter, setClassroomFilter] = useState<number | null>(null)
  const [teacherFilter, setTeacherFilter] = useState<number | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [bulkTeacher, setBulkTeacher] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [addForm] = Form.useForm<TimetableAssignmentPayload>()
  const { project } = ctx
  const slotsPerWeek = project.days.length * project.periods_per_day

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listTimetableAssignments(project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const teacherOptions = useMemo(
    () =>
      ctx.teachers.map((t) => ({
        value: t.id,
        label: `${t.first_name} ${t.last_name}${t.brans ? ` — ${t.brans}` : ''}`,
      })),
    [ctx.teachers],
  )
  const roomOptions = useMemo(() => ctx.rooms.map((r) => ({ value: r.id, label: r.name })), [ctx.rooms])

  // Senkron gruplar bir öğretmen/şube için tek sayılır.
  const { teacherLoad, classLoad } = useMemo(() => {
    const t = new Map<number, { hours: number; seen: Set<string> }>()
    const c = new Map<number, { hours: number; seen: Set<string> }>()
    for (const a of rows) {
      const key = a.sync_group ? `g:${a.sync_group}` : `a:${a.id}`
      if (a.teacher_id) {
        const cur = t.get(a.teacher_id) || { hours: 0, seen: new Set() }
        if (!cur.seen.has(key)) {
          cur.seen.add(key)
          cur.hours += a.weekly_hours
        }
        t.set(a.teacher_id, cur)
      }
      const cc = c.get(a.classroom_id) || { hours: 0, seen: new Set() }
      if (!cc.seen.has(key)) {
        cc.seen.add(key)
        cc.hours += a.weekly_hours
      }
      c.set(a.classroom_id, cc)
    }
    return { teacherLoad: t, classLoad: c }
  }, [rows])

  const filtered = useMemo(
    () =>
      rows.filter(
        (a) =>
          (!classroomFilter || a.classroom_id === classroomFilter) &&
          (!teacherFilter || a.teacher_id === teacherFilter) &&
          (!onlyMissing || !a.teacher_id),
      ),
    [rows, classroomFilter, teacherFilter, onlyMissing],
  )

  const patch = async (row: TimetableAssignment, payload: TimetableAssignmentPayload) => {
    try {
      const updated = await updateTimetableAssignment(row.id, payload)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const runGenerate = async (overwrite: boolean) => {
    setGenOpen(false)
    try {
      const res = await generateTimetableAssignments(project.id, overwrite)
      message.success(
        `${res.created} atama oluşturuldu${res.skipped ? `, ${res.skipped} mevcut atama korundu` : ''}. ${
          res.without_teacher ? `${res.without_teacher} atamada öğretmen seçilmeli.` : ''
        }`,
      )
      await load()
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onGenerate = () => {
    if (!rows.length) void runGenerate(false)
    else setGenOpen(true)
  }

  const onBulkTeacher = async () => {
    if (!selected.length) return
    try {
      await bulkUpdateTimetableAssignments(project.id, { ids: selected, teacher_id: bulkTeacher })
      setSelected([])
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onAdd = async () => {
    const values = await addForm.validateFields()
    try {
      const created = await createTimetableAssignment(project.id, values)
      setRows((prev) => [...prev, created])
      setAddOpen(false)
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const overloadedClasses = ctx.classrooms.filter((c) => (classLoad.get(c.id)?.hours || 0) > slotsPerWeek)
  const missingTeacher = rows.filter((a) => !a.teacher_id).length
  const editable = ctx.canUpdate

  return (
    <>
      <Typography.Paragraph type="secondary">
        Hangi şubede hangi dersi kimin okutacağını buradan seçin. Ders havuzundaki saat her şubeye kendiliğinden
        yazılmaz; yalnız o şubede gerçekten okutulan dersi ekleyin. "Mevcut programdan doldur", okulda hâlihazırda
        işlenen dersleri buraya taşır.
      </Typography.Paragraph>

      {missingTeacher > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${missingTeacher} atamada öğretmen seçilmemiş. Bu dersler için öğretmen çakışması kontrol edilemez.`}
        />
      )}
      {overloadedClasses.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Haftalık ${slotsPerWeek} saati aşan şubeler: ${overloadedClasses
            .map((c) => `${shortClassroom(c)} (${classLoad.get(c.id)?.hours})`)
            .join(', ')}`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} xl={17}>
          <Space wrap style={{ marginBottom: 12 }}>
            {ctx.canCreate && (
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={onGenerate}>
                Mevcut programdan doldur
              </Button>
            )}
            {ctx.canCreate && (
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  addForm.resetFields()
                  addForm.setFieldsValue({ classroom_id: classroomFilter ?? undefined })
                  setAddOpen(true)
                }}
              >
                Atama Ekle
              </Button>
            )}
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Şube"
              style={{ width: 130 }}
              value={classroomFilter ?? undefined}
              onChange={(v) => setClassroomFilter(v ?? null)}
              options={ctx.classrooms.map((c) => ({ value: c.id, label: shortClassroom(c) }))}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Öğretmen"
              style={{ width: 220 }}
              value={teacherFilter ?? undefined}
              onChange={(v) => setTeacherFilter(v ?? null)}
              options={teacherOptions}
            />
            <Button type={onlyMissing ? 'primary' : 'default'} ghost={onlyMissing} onClick={() => setOnlyMissing((v) => !v)}>
              Öğretmensizler
            </Button>
          </Space>

          {selected.length > 0 && editable && (
            <Space wrap style={{ marginBottom: 12 }}>
              <Typography.Text>{selected.length} satır seçili:</Typography.Text>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Öğretmen ata"
                style={{ width: 240 }}
                value={bulkTeacher ?? undefined}
                onChange={(v) => setBulkTeacher(v ?? null)}
                options={teacherOptions}
              />
              <Button onClick={onBulkTeacher}>Uygula</Button>
            </Space>
          )}

          <Table<TimetableAssignment>
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={filtered}
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [50, 100, 200] }}
            rowSelection={editable ? { selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) } : undefined}
            scroll={{ x: 900 }}
            columns={[
              {
                title: 'Şube',
                key: 'classroom',
                width: 80,
                sorter: (a, b) => shortClassroom(a.Classroom).localeCompare(shortClassroom(b.Classroom), 'tr'),
                render: (_, r) => shortClassroom(r.Classroom),
              },
              {
                title: 'Ders',
                key: 'subject',
                sorter: (a, b) => (a.Subject?.name || '').localeCompare(b.Subject?.name || '', 'tr'),
                render: (_, r) => (
                  <Space size={4}>
                    {r.Subject?.name}
                    {r.Subject?.difficulty_level === 'zor' && <Tag color="volcano">zor</Tag>}
                  </Space>
                ),
              },
              {
                title: 'Öğretmen',
                key: 'teacher',
                width: 240,
                render: (_, r) => (
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    size="small"
                    style={{ width: '100%' }}
                    status={r.teacher_id ? undefined : 'warning'}
                    disabled={!editable}
                    value={r.teacher_id ?? undefined}
                    onChange={(v) => patch(r, { teacher_id: v ?? null })}
                    options={teacherOptions}
                    placeholder="Seçin"
                  />
                ),
              },
              {
                title: 'Saat',
                dataIndex: 'weekly_hours',
                width: 80,
                render: (v: number, r) => (
                  <InputNumber
                    size="small"
                    min={1}
                    max={40}
                    value={v}
                    disabled={!editable}
                    style={{ width: 60 }}
                    onBlur={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isInteger(n) && n > 0 && n !== v) void patch(r, { weekly_hours: n })
                    }}
                  />
                ),
              },
              {
                title: 'Blok',
                dataIndex: 'block_pattern',
                width: 100,
                render: (v: string | null, r) => (
                  <Input
                    size="small"
                    defaultValue={v || ''}
                    key={`${r.id}-${v}`}
                    placeholder="oto"
                    disabled={!editable}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== (v || '')) void patch(r, { block_pattern: next || null })
                    }}
                  />
                ),
              },
              {
                title: 'Mekan',
                key: 'room',
                width: 150,
                render: (_, r) => (
                  <Select
                    allowClear
                    size="small"
                    style={{ width: '100%' }}
                    disabled={!editable}
                    value={r.room_id ?? undefined}
                    onChange={(v) => patch(r, { room_id: v ?? null })}
                    options={roomOptions}
                    placeholder="—"
                  />
                ),
              },
              {
                title: 'Senkron grup',
                dataIndex: 'sync_group',
                width: 120,
                render: (v: string | null, r) => (
                  <Input
                    size="small"
                    defaultValue={v || ''}
                    key={`${r.id}-${v}`}
                    disabled={!editable}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== (v || '')) void patch(r, { sync_group: next || null })
                    }}
                  />
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 50,
                render: (_, r) =>
                  ctx.canDelete && (
                    <Popconfirm
                      title="Atama silinsin mi?"
                      okText="Sil"
                      cancelText="Vazgeç"
                      onConfirm={async () => {
                        try {
                          await deleteTimetableAssignment(r.id)
                          setRows((prev) => prev.filter((x) => x.id !== r.id))
                        } catch (err) {
                          message.error(getErrorMessage(err))
                        }
                      }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
              },
            ]}
          />
        </Col>
        <Col xs={24} xl={7}>
          <Card size="small" title="Öğretmen yükleri (haftalık saat)" style={{ marginBottom: 16 }}>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {[...teacherLoad.entries()]
                .sort((a, b) => b[1].hours - a[1].hours)
                .map(([tid, v]) => {
                  const t = ctx.teachers.find((x) => x.id === tid)
                  return (
                    <div
                      key={tid}
                      onClick={() => setTeacherFilter(tid)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', cursor: 'pointer' }}
                    >
                      <span>{teacherFullName(t)}</span>
                      <Tag color={v.hours > slotsPerWeek * 0.75 ? 'red' : v.hours > 30 ? 'orange' : 'blue'}>{v.hours}</Tag>
                    </div>
                  )
                })}
              {!teacherLoad.size && <Typography.Text type="secondary">Henüz atama yok</Typography.Text>}
            </div>
          </Card>
          <Card size="small" title={`Şube toplamları (en fazla ${slotsPerWeek})`}>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {ctx.classrooms.map((c) => {
                const h = classLoad.get(c.id)?.hours || 0
                return (
                  <div
                    key={c.id}
                    onClick={() => setClassroomFilter(c.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', cursor: 'pointer' }}
                  >
                    <span>{shortClassroom(c)}</span>
                    <Tag color={h > slotsPerWeek ? 'red' : h === 0 ? 'default' : 'green'}>{h}</Tag>
                  </div>
                )
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        open={genOpen}
        title="Atamalar otomatik doldurulsun mu?"
        onCancel={() => setGenOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setGenOpen(false)}>
            Vazgeç
          </Button>,
          <Popconfirm
            key="overwrite"
            title="Mevcut tüm atamalar silinecek. Emin misiniz?"
            okText="Evet, baştan oluştur"
            cancelText="Hayır"
            okButtonProps={{ danger: true }}
            onConfirm={() => runGenerate(true)}
          >
            <Button danger>Baştan oluştur</Button>
          </Popconfirm>,
          <Button key="append" type="primary" onClick={() => runGenerate(false)}>
            Eksikleri ekle
          </Button>,
        ]}
      >
        Şube seviyelerine göre "Ders Saatleri" tanımlarından atama üretilir. Öğretmen, mevcut ders programından
        (Excel ile yüklenen) tahmin edilir. "Eksikleri ekle" mevcut atamalara dokunmaz.
      </Modal>

      <Modal
        open={addOpen}
        title="Ders Ataması Ekle"
        onCancel={() => setAddOpen(false)}
        onOk={onAdd}
        okText="Ekle"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="classroom_id" label="Şube" rules={[{ required: true, message: 'Şube seçin' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={ctx.classrooms.map((c) => ({ value: c.id, label: shortClassroom(c) }))}
            />
          </Form.Item>
          <Form.Item name="subject_id" label="Ders" rules={[{ required: true, message: 'Ders seçin' }]}>
            <Select showSearch optionFilterProp="label" options={ctx.subjects.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="teacher_id" label="Öğretmen">
            <Select allowClear showSearch optionFilterProp="label" options={teacherOptions} />
          </Form.Item>
          <Space>
            <Form.Item name="weekly_hours" label="Haftalık saat" rules={[{ required: true, message: 'Saat girin' }]}>
              <InputNumber min={1} max={40} />
            </Form.Item>
            <Form.Item name="block_pattern" label="Blok düzeni">
              <Input placeholder="2+2+1" style={{ width: 110 }} />
            </Form.Item>
          </Space>
          <Form.Item name="room_id" label="Mekan">
            <Select allowClear options={roomOptions} />
          </Form.Item>
          <Form.Item name="sync_group" label="Senkron grup">
            <Input maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
