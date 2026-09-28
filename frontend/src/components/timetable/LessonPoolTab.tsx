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
  Typography,
} from 'antd'
import { CloudDownloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { createSubject } from '../../api/subjects'
import {
  createBranch,
  deleteBranch,
  getLessonPool,
  updateBranch,
  updatePoolSubject,
  upsertPoolHour,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { TypedPhraseConfirmModal } from '../TypedPhraseConfirmModal'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../../utils/bulkDelete'
import { DIFFICULTY_LEVEL_OPTIONS } from '../../types/subject'
import type { Branch, LessonPool, PoolHour, PoolSubject } from '../../types/timetable'
import { blockPatternChoices } from './blocks'
import { classLevels, type TimetableCtx } from './shared'
import { PoolTemplateImportModal } from './PoolTemplateImportModal'

type SubjectPatch = Partial<Omit<PoolSubject, 'id' | 'name' | 'is_active'>>

function HourEditor({
  hour,
  onSave,
}: {
  hour?: PoolHour
  onSave: (hours: number, pattern: string | null, id?: number) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState<number | null>(hour?.weekly_hours ?? null)
  const [pattern, setPattern] = useState(hour?.block_pattern || '')

  useEffect(() => {
    if (!open) return
    setHours(hour?.weekly_hours ?? null)
    setPattern(hour?.block_pattern || '')
  }, [open, hour])

  const save = async (h: number, p: string | null) => {
    if (await onSave(h, p, hour?.id)) setOpen(false)
  }
  const blockOptions = blockPatternChoices(hours || 0, pattern)
  const patternFits =
    !pattern || blockOptions.some((item) => item.value === pattern)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Space direction="vertical" size={6}>
          <InputNumber
            min={1}
            max={40}
            value={hours}
            onChange={(value) => {
              setHours(value)
              const next = blockPatternChoices(value || 0, pattern)
              if (pattern && !next.some((item) => item.value === pattern)) setPattern('')
            }}
            addonAfter="saat"
            style={{ width: 140 }}
          />
          <Select
            allowClear
            placeholder="Blok: otomatik"
            style={{ width: 180 }}
            disabled={!hours}
            value={patternFits && pattern ? pattern : undefined}
            options={blockOptions}
            onChange={(value) => setPattern(value || '')}
            getPopupContainer={(node) => node.parentElement || document.body}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Aynı sınıfta birden fazla saat olabilir. Blok seçilmezse 2'li bloklar ve kalan 1 saat kullanılır.
          </Typography.Text>
          <Space>
            <Button size="small" type="primary" disabled={!hours} onClick={() => hours && save(hours, patternFits ? pattern.trim() || null : null)}>
              Kaydet
            </Button>
            {hour && (
              <Button size="small" danger onClick={() => save(0, null)}>
                Kaldır
              </Button>
            )}
          </Space>
        </Space>
      }
    >
      {hour ? (
        <Tag style={{ cursor: 'pointer', marginInlineEnd: 0 }}>
          {hour.weekly_hours}
          {hour.block_pattern ? ` (${hour.block_pattern})` : ''}
        </Tag>
      ) : (
        <Button size="small" type="text" icon={<PlusOutlined />} />
      )}
    </Popover>
  )
}

function HourCell({
  options,
  editable,
  onSave,
}: {
  options: PoolHour[]
  editable: boolean
  onSave: (hours: number, pattern: string | null, id?: number) => Promise<boolean>
}) {
  const sorted = [...options].sort((a, b) => a.weekly_hours - b.weekly_hours)
  if (!editable) {
    return sorted.length ? (
      <span>
        {sorted.map((hour) => (
          <span key={hour.id}>
            <b>{hour.weekly_hours}</b>
            {hour.block_pattern ? ` (${hour.block_pattern}) ` : ' '}
          </span>
        ))}
      </span>
    ) : (
      <span>—</span>
    )
  }
  return (
    <Space size={2} wrap>
      {sorted.map((hour) => (
        <HourEditor key={hour.id} hour={hour} onSave={onSave} />
      ))}
      <HourEditor onSave={onSave} />
    </Space>
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

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
      {ctx.canDelete && branches.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
            Toplu sil ({branches.length})
          </Button>
        </div>
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
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Branşları toplu sil"
        description={`Listedeki ${branches.length} branş silinecek. Bağlı derslerin branşı boşalır.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={async () => {
          setBulkLoading(true)
          try {
            const result = await bulkDeleteByIds(
              branches.map((branch) => branch.id),
              (id) => deleteBranch(ctx.project.id, Number(id)),
            )
            const text = bulkDeleteResultMessage(result, 'branş')
            if (result.failed === 0) message.success(text)
            else message.warning(text)
            setBulkOpen(false)
            await onChange()
          } finally {
            setBulkLoading(false)
          }
        }}
      />
    </>
  )
}

export function LessonPoolTab({ ctx }: { ctx: TimetableCtx }) {
  const [importOpen, setImportOpen] = useState(false)
  const { message } = App.useApp()
  const [pool, setPool] = useState<LessonPool>({ subjects: [], hours: [], branches: [] })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [onlyPool, setOnlyPool] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
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
    const map = new Map<string, PoolHour[]>()
    for (const h of pool.hours) {
      const key = `${h.subject_id}:${h.class_level}`
      map.set(key, [...(map.get(key) || []), h])
    }
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

  const saveHour = async (subjectId: number, level: string, hours: number, pattern: string | null, hourId?: number) => {
    try {
      const saved = await upsertPoolHour(ctx.project.id, {
        id: hourId,
        subject_id: subjectId,
        class_level: level,
        weekly_hours: hours,
        block_pattern: pattern,
      })
      setPool((prev) => {
        let hoursRows = prev.hours
        if (!saved && hourId) hoursRows = hoursRows.filter((h) => h.id !== hourId)
        else if (!saved) hoursRows = hoursRows.filter((h) => !(h.subject_id === subjectId && h.class_level === level))
        else hoursRows = [...hoursRows.filter((h) => h.id !== saved.id), saved]
        return { ...prev, hours: hoursRows }
      })
      return true
    } catch (err) {
      message.error(getErrorMessage(err))
      return false
    }
  }

  const addSubject = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      await createSubject(ctx.project.tenant_id, { name, code: newCode.trim() || null })
      setNewName('')
      setNewCode('')
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

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
          {row.is_elective && <Tag color="purple">seçmeli</Tag>}
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
      width: 150,
      align: 'center' as const,
      render: (_: unknown, row: PoolSubject) => (
        <HourCell
          options={hourMap.get(`${row.id}:${level}`) || []}
          editable={editable}
          onSave={(h, p, id) => saveHour(row.id, level, h, p, id)}
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
  ]

  return (
    <>
      <Typography.Paragraph type="secondary">
        Ders havuzunda dersi bir kez tanımlarsınız. Aynı sınıf seviyesinde birden fazla saat olabilir: 12. sınıfta
        Türk dili ve edebiyatı hem 3 hem 5 saat, seçmeli birinci yabancı dil 2, 8 veya 10 saat olabilir. Rehberlik
        başlı başına bir derstir; branşı ne olursa olsun her öğretmen girebilir. Havuz her şubeye kendiliğinden
        yazılmaz. Hücredeki saate tıklayarak düzenleyin, artı ile yeni saat ekleyin.
      </Typography.Paragraph>
      <PoolTemplateImportModal
        projectId={ctx.project.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
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
          {ctx.canCreate && (
            <>
              <Input
                placeholder="Yeni ders adı"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: 200 }}
                maxLength={100}
                onPressEnter={() => void addSubject()}
              />
              <Input
                placeholder="Kod"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                style={{ width: 90 }}
                maxLength={20}
              />
              <Button icon={<PlusOutlined />} disabled={!newName.trim()} onClick={() => void addSubject()}>
                Ders ekle
              </Button>
            </>
          )}
          {ctx.canUpdate && (
            <Button icon={<CloudDownloadOutlined />} onClick={() => setImportOpen(true)}>
              Hazır havuzdan aktar (MEB)
            </Button>
          )}
        </Space>
        <Table<PoolSubject>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 900 + levels.length * 150, y: 560 }}
        />
      </Card>
    </>
  )
}
