import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TypedPhraseConfirmModal } from '../TypedPhraseConfirmModal'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../../utils/bulkDelete'
import type { TimetableAssignment, TimetableAssignmentPayload } from '../../types/timetable'
import { useActiveSchool } from '../../auth/ActiveSchoolContext'
import { blockPatternChoices } from './blocks'
import { assignmentTeacherIds, computeLoads, lessonTeacherOptions, shortClassroom, teacherFullName, teacherMatchesLesson, type TimetableCtx } from './shared'

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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [addForm] = Form.useForm<TimetableAssignmentPayload>()
  const addHours = Form.useWatch('weekly_hours', addForm)
  const { project } = ctx
  const { activeSchool } = useActiveSchool()
  const languages = useMemo(
    () => ({
      first: activeSchool?.meta?.first_foreign_language || null,
      second: activeSchool?.meta?.second_foreign_language || null,
    }),
    [activeSchool],
  )
  const autoFilled = useRef(new Set<number>())
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

  // Senkron gruplar bir öğretmen/şube için tek sayılır; ortak öğretmenler de yük alır.
  const { teacherLoad, classLoad } = useMemo(() => {
    const loads = computeLoads(rows)
    const wrap = (m: Map<number, number>) => new Map([...m.entries()].map(([k, hours]) => [k, { hours }]))
    return { teacherLoad: wrap(loads.teacher), classLoad: wrap(loads.classroom) }
  }, [rows])

  const filtered = useMemo(
    () =>
      rows.filter(
        (a) =>
          (!classroomFilter || a.classroom_id === classroomFilter) &&
          (!teacherFilter || assignmentTeacherIds(a).includes(teacherFilter)) &&
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

  useEffect(() => {
    if (!ctx.canUpdate || loading || ctx.teachers.length === 0) return
    for (const row of rows) {
      if (autoFilled.current.has(row.id)) continue
      autoFilled.current.add(row.id)
      if (row.teacher_id) continue
      const matches = ctx.teachers.filter((teacher) =>
        teacherMatchesLesson(teacher, row.Subject?.name || '', languages),
      )
      if (matches.length === 1) void patch(row, { teacher_id: matches[0].id })
    }
  }, [rows, loading, languages, ctx.teachers, ctx.canUpdate])

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
            {ctx.canDelete && filtered.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filtered.length})
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
            scroll={{ x: 1120 }}
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
                    options={lessonTeacherOptions(ctx.teachers, r.Subject?.name || '', languages)}
                    placeholder="Seçin"
                  />
                ),
              },
              {
                title: 'Ortak öğretmen',
                key: 'co',
                width: 220,
                render: (_, r) => (
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    size="small"
                    style={{ width: '100%' }}
                    maxCount={4}
                    maxTagCount="responsive"
                    disabled={!editable || !r.teacher_id}
                    value={r.co_teacher_ids || []}
                    onChange={(v: number[]) => patch(r, { co_teacher_ids: v })}
                    options={lessonTeacherOptions(ctx.teachers, r.Subject?.name || '', languages).filter(
                      (option) => option.value !== r.teacher_id,
                    )}
                    placeholder="—"
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
                width: 150,
                render: (v: string | null, r) => (
                  <Select
                    size="small"
                    allowClear
                    placeholder="Otomatik"
                    disabled={!editable}
                    style={{ width: '100%' }}
                    value={v || undefined}
                    options={blockPatternChoices(r.weekly_hours, v)}
                    onChange={(next) => {
                      const value = next || null
                      if (value !== (v || null)) void patch(r, { block_pattern: value })
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
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Atamaları toplu sil"
        description={`Listede görünen ${filtered.length} ders ataması silinecek. Bağlı taslak ders saatleri de kalkar.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={async () => {
          setBulkLoading(true)
          try {
            const ids = new Set(filtered.map((row) => row.id))
            const result = await bulkDeleteByIds([...ids], (id) => deleteTimetableAssignment(Number(id)))
            const text = bulkDeleteResultMessage(result, 'atama')
            if (result.failed === 0) message.success(text)
            else message.warning(text)
            setBulkOpen(false)
            setSelected((prev) => prev.filter((id) => !ids.has(id)))
            if (result.failed === 0) setRows((prev) => prev.filter((row) => !ids.has(row.id)))
            else await load()
            await ctx.reloadProject()
          } finally {
            setBulkLoading(false)
          }
        }}
      />

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
              <InputNumber min={1} max={40} addonAfter="saat" />
            </Form.Item>
            <Form.Item name="block_pattern" label="Blok düzeni">
              <Select
                allowClear
                placeholder="Otomatik"
                style={{ width: 180 }}
                disabled={!addHours}
                options={blockPatternChoices(Number(addHours) || 0)}
              />
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
