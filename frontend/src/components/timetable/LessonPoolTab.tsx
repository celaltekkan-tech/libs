import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  Input,
  InputNumber,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createBranch,
  deleteBranch,
  getLessonPool,
  updateBranch,
  updatePoolSubject,
  upsertPoolHour,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DIFFICULTY_LEVEL_OPTIONS } from '../../types/subject'
import type { Branch, LessonPool, PoolHour, PoolSubject } from '../../types/timetable'
import { classLevels, type TimetableCtx } from './shared'

type SubjectPatch = Partial<Omit<PoolSubject, 'id' | 'name' | 'is_active'>>

function HourCell({
  hour,
  editable,
  onSave,
}: {
  hour: PoolHour | undefined
  editable: boolean
  onSave: (hours: number, pattern: string | null) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState<number | null>(hour?.weekly_hours ?? null)
  const [pattern, setPattern] = useState(hour?.block_pattern || '')

  useEffect(() => {
    if (!open) return
    setHours(hour?.weekly_hours ?? null)
    setPattern(hour?.block_pattern || '')
  }, [open, hour])

  const label = hour ? (
    <span>
      <b>{hour.weekly_hours}</b>
      {hour.block_pattern && <span style={{ color: '#6b7280', fontSize: 11 }}> ({hour.block_pattern})</span>}
    </span>
  ) : (
    <span style={{ color: '#d1d5db' }}>—</span>
  )
  if (!editable) return label

  const save = async (h: number, p: string | null) => {
    if (await onSave(h, p)) setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Space direction="vertical" size={6}>
          <Space>
            <InputNumber min={0} max={40} value={hours} onChange={setHours} addonAfter="saat" style={{ width: 120 }} />
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="blok: 2+2+1"
              style={{ width: 110 }}
            />
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Blok boşsa 2'li bloklar + kalan 1 saat kullanılır.
          </Typography.Text>
          <Space>
            <Button size="small" type="primary" onClick={() => save(hours || 0, pattern.trim() || null)}>
              Kaydet
            </Button>
            {hour && (
              <Button size="small" danger onClick={() => save(0, null)}>
                Seviyeden kaldır
              </Button>
            )}
          </Space>
        </Space>
      }
    >
      <span style={{ cursor: 'pointer', display: 'inline-block', minWidth: 36 }}>{label}</span>
    </Popover>
  )
}

function BranchesCard({
  ctx,
  branches,
  onChange,
}: {
  ctx: TimetableCtx
  branches: Branch[]
  onChange: () => Promise<void>
}) {
  const { message } = App.useApp()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await onChange()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Öğretmen kartındaki branşlar otomatik eklenir. Derse branş bağlanınca "Öğretmene ders atama" ekranında
        öğretmenin branş dersleri listelenir ve branş dışı atamalar ön kontrolde uyarı verir.
      </Typography.Paragraph>
      {ctx.canCreate && (
        <Space wrap style={{ marginBottom: 8 }}>
          <Input placeholder="Kod (DKAB)" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 110 }} maxLength={20} />
          <Input placeholder="Branş adı" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 220 }} maxLength={100} />
          <Button
            icon={<PlusOutlined />}
            disabled={!name.trim()}
            onClick={() =>
              run(async () => {
                await createBranch(ctx.project.id, { name: name.trim(), code: code.trim() || null })
                setName('')
                setCode('')
              })
            }
          >
            Branş ekle
          </Button>
        </Space>
      )}
      <Table<Branch>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={branches}
        scroll={{ y: 260 }}
        columns={[
          {
            title: 'Kod',
            dataIndex: 'code',
            width: 120,
            render: (v: string | null, row) => (
              <Input
                size="small"
                key={`${row.id}-${v}`}
                defaultValue={v || ''}
                disabled={!ctx.canUpdate}
                maxLength={20}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next !== (v || '')) void run(() => updateBranch(ctx.project.id, row.id, { code: next || null }))
                }}
              />
            ),
          },
          {
            title: 'Branş',
            dataIndex: 'name',
            render: (v: string, row) => (
              <Input
                size="small"
                key={`${row.id}-${v}`}
                defaultValue={v}
                disabled={!ctx.canUpdate}
                maxLength={100}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== v) void run(() => updateBranch(ctx.project.id, row.id, { name: next }))
                }}
              />
            ),
          },
          ...(ctx.canDelete
            ? [
                {
                  title: '',
                  width: 50,
                  render: (_: unknown, row: Branch) => (
                    <Popconfirm
                      title="Branş silinsin mi?"
                      description="Bağlı derslerin branşı boşalır."
                      okText="Sil"
                      cancelText="Vazgeç"
                      onConfirm={() => run(() => deleteBranch(ctx.project.id, row.id))}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  )
}

export function LessonPoolTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const [pool, setPool] = useState<LessonPool>({ subjects: [], hours: [], branches: [] })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [onlyPool, setOnlyPool] = useState(false)
  const editable = ctx.canUpdate
  const levels = useMemo(() => classLevels(ctx.classrooms), [ctx.classrooms])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPool(await getLessonPool(ctx.project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [ctx.project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const hourMap = useMemo(() => {
    const map = new Map<string, PoolHour>()
    for (const h of pool.hours) map.set(`${h.subject_id}:${h.class_level}`, h)
    return map
  }, [pool.hours])

  const rows = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr-TR')
    return pool.subjects.filter((s) => {
      if (!s.is_active && !levels.some((l) => hourMap.has(`${s.id}:${l}`))) return false
      if (onlyPool && !levels.some((l) => hourMap.has(`${s.id}:${l}`))) return false
      if (!q) return true
      return `${s.code || ''} ${s.name}`.toLocaleLowerCase('tr-TR').includes(q)
    })
  }, [pool.subjects, filter, onlyPool, levels, hourMap])

  const patchSubject = async (row: PoolSubject, payload: SubjectPatch) => {
    try {
      const updated = await updatePoolSubject(ctx.project.id, row.id, payload)
      setPool((prev) => ({ ...prev, subjects: prev.subjects.map((s) => (s.id === row.id ? updated : s)) }))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const saveHour = async (subjectId: number, level: string, hours: number, pattern: string | null) => {
    try {
      const saved = await upsertPoolHour(ctx.project.id, {
        subject_id: subjectId,
        class_level: level,
        weekly_hours: hours,
        block_pattern: pattern,
      })
      setPool((prev) => {
        const rest = prev.hours.filter((h) => !(h.subject_id === subjectId && h.class_level === level))
        return { ...prev, hours: saved ? [...rest, saved] : rest }
      })
      return true
    } catch (err) {
      message.error(getErrorMessage(err))
      return false
    }
  }

  const flag = (key: 'allow_split' | 'allow_merge' | 'is_guidance' | 'is_activity', title: string, help: string) => ({
    title: <Tooltip title={help}>{title}</Tooltip>,
    key,
    width: 56,
    align: 'center' as const,
    render: (_: unknown, row: PoolSubject) => (
      <Checkbox checked={row[key]} disabled={!editable} onChange={(e) => patchSubject(row, { [key]: e.target.checked })} />
    ),
  })

  const columns: ColumnsType<PoolSubject> = [
    {
      title: 'Kod',
      dataIndex: 'code',
      width: 90,
      fixed: 'left',
      render: (v: string | null, row) => (
        <Input
          size="small"
          key={`${row.id}-${v}`}
          defaultValue={v || ''}
          disabled={!editable}
          maxLength={20}
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next !== (v || '')) void patchSubject(row, { code: next || null })
          }}
        />
      ),
    },
    {
      title: 'Ders',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name, 'tr'),
      render: (v: string, row) => (
        <Space size={4}>
          {v}
          {!row.is_active && <Tag>pasif</Tag>}
        </Space>
      ),
    },
    {
      title: 'Branş',
      key: 'branch',
      width: 170,
      render: (_, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          disabled={!editable}
          value={row.branch_id ?? undefined}
          onChange={(v) => patchSubject(row, { branch_id: v ?? null })}
          options={pool.branches.map((b) => ({ value: b.id, label: b.code ? `${b.code} — ${b.name}` : b.name }))}
          placeholder="—"
        />
      ),
    },
    ...levels.map((level) => ({
      title: `${level}. sınıf`,
      key: `lvl-${level}`,
      width: 80,
      align: 'center' as const,
      render: (_: unknown, row: PoolSubject) => (
        <HourCell
          hour={hourMap.get(`${row.id}:${level}`)}
          editable={editable}
          onSave={(h, p) => saveHour(row.id, level, h, p)}
        />
      ),
    })),
    {
      title: 'Zorluk',
      key: 'difficulty',
      width: 100,
      render: (_, row) => (
        <Select
          size="small"
          allowClear
          style={{ width: '100%' }}
          disabled={!editable}
          value={row.difficulty_level ?? undefined}
          onChange={(v) => patchSubject(row, { difficulty_level: v ?? null })}
          options={DIFFICULTY_LEVEL_OPTIONS}
          placeholder="—"
        />
      ),
    },
    flag('allow_split', 'B1', "B1: 2 saatlik blok gerekirse 1+1 olarak bölünebilir"),
    flag('allow_merge', 'B2', "B2: iki ayrı 1 saat gerekirse 2 saatlik blok olarak birleşebilir"),
    {
      title: 'Seçmeli',
      key: 'elective',
      width: 150,
      render: (_, row) => (
        <Space size={4}>
          <Checkbox
            checked={row.is_elective}
            disabled={!editable}
            onChange={(e) => patchSubject(row, { is_elective: e.target.checked })}
          />
          {row.is_elective && (
            <Input
              size="small"
              key={`${row.id}-${row.elective_group}`}
              defaultValue={row.elective_group || ''}
              placeholder="grup"
              disabled={!editable}
              maxLength={30}
              style={{ width: 100 }}
              onBlur={(e) => {
                const next = e.target.value.trim()
                if (next !== (row.elective_group || '')) void patchSubject(row, { elective_group: next || null })
              }}
            />
          )}
        </Space>
      ),
    },
    flag('is_guidance', 'Reh', 'Rehberlik dersi'),
    flag('is_activity', 'F', 'Faaliyet dersi'),
  ]

  return (
    <>
      <Typography.Paragraph type="secondary">
        Ders havuzu her dersin bir kez tanımlandığı yerdir: hangi sınıf seviyesinde kaç saat okutulduğu, blok düzeni
        (6 saat → 2+2+2), zorluğu ve esneklikleri. Havuz her şubeye kendiliğinden yazılmaz; "Sınıfa ders verme"
        adımında şubeye eklediğiniz ders saatini ve bloğunu buradan alır. Hücreye tıklayarak saat ve blok girin.
      </Typography.Paragraph>
      <Collapse
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'branches',
            label: `Branşlar (${pool.branches.length})`,
            children: <BranchesCard ctx={ctx} branches={pool.branches} onChange={load} />,
          },
        ]}
      />
      <Card size="small">
        <Space wrap style={{ marginBottom: 8 }}>
          <Input.Search
            allowClear
            placeholder="Ders filtresi"
            style={{ width: 220 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Checkbox checked={onlyPool} onChange={(e) => setOnlyPool(e.target.checked)}>
            Yalnız saati tanımlı dersler
          </Checkbox>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Yeni ders adı "Dersler" sayfasından eklenir.
          </Typography.Text>
        </Space>
        <Table<PoolSubject>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 900 + levels.length * 80, y: 560 }}
        />
      </Card>
    </>
  )
}
