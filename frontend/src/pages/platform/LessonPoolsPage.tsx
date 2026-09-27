import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import {
  createLessonPoolTemplate,
  deleteLessonPoolTemplate,
  formatHours,
  getLessonPoolTemplate,
  KIND_LABELS,
  listLessonPoolTemplates,
  parseHoursText,
  parseLessonPoolFile,
  SCHOOL_TYPE_LABELS,
  updateLessonPoolTemplate,
  type LessonPoolItem,
  type LessonPoolKind,
  type LessonPoolTemplatePayload,
  type LessonPoolTemplateSummary,
  type ParsedSheet,
  type SchoolTypeValue,
} from '../../api/lessonPools'
import { getErrorMessage } from '../../api/client'

interface EditorState {
  id: number | null
  draft: LessonPoolTemplatePayload
  warnings: string[]
}

interface Row extends LessonPoolItem {
  key: string
}

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as LessonPoolKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))
const SCHOOL_TYPE_OPTIONS = (Object.keys(SCHOOL_TYPE_LABELS) as SchoolTypeValue[]).map((k) => ({
  value: k,
  label: SCHOOL_TYPE_LABELS[k],
}))

function guessSchoolType(levels: string[]): SchoolTypeValue | null {
  const nums = levels.map(Number).filter((n) => Number.isFinite(n))
  if (levels.includes('Hazırlık') || nums.some((n) => n >= 9)) return 'lise'
  if (nums.length && nums.every((n) => n >= 5 && n <= 8)) return 'ortaokul'
  if (nums.length && nums.every((n) => n >= 1 && n <= 4)) return 'ilkokul'
  return null
}

function fromSheet(sheet: ParsedSheet, fileName: string): EditorState {
  return {
    id: null,
    warnings: sheet.warnings,
    draft: {
      name: sheet.title,
      school_type: guessSchoolType(sheet.levels),
      levels: sheet.levels,
      items: sheet.items,
      source_name: `${fileName} · ${sheet.source}`,
      note: null,
      is_active: true,
    },
  }
}

let rowSeq = 0
const toRows = (items: LessonPoolItem[]): Row[] => items.map((it) => ({ ...it, key: `r${(rowSeq += 1)}` }))

function TemplateEditor({
  state,
  onClose,
  onSaved,
}: {
  state: EditorState
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Pick<LessonPoolTemplatePayload, 'name' | 'school_type' | 'note' | 'is_active'>>()
  const [levels, setLevels] = useState<string[]>(state.draft.levels)
  const [rows, setRows] = useState<Row[]>(() => toRows(state.draft.items))
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      name: state.draft.name,
      school_type: state.draft.school_type,
      note: state.draft.note,
      is_active: state.draft.is_active,
    })
  }, [state, form])

  const patchRow = (key: string, patch: Partial<LessonPoolItem>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const visible = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr-TR')
    return q ? rows.filter((r) => `${r.name} ${r.category || ''}`.toLocaleLowerCase('tr-TR').includes(q)) : rows
  }, [rows, filter])

  const onSave = async () => {
    const meta = await form.validateFields()
    const items = rows
      .filter((r) => r.name.trim())
      .map(({ key: _key, ...r }, i) => ({ ...r, name: r.name.trim(), sort_order: i + 1 }))
    if (!items.length) {
      message.error('En az bir ders gerekli')
      return
    }
    setSaving(true)
    try {
      const payload: LessonPoolTemplatePayload = {
        ...state.draft,
        ...meta,
        school_type: meta.school_type || null,
        note: meta.note || null,
        levels,
        items,
      }
      if (state.id) await updateLessonPoolTemplate(state.id, payload)
      else await createLessonPoolTemplate(payload)
      message.success('Ders havuzu kaydedildi')
      await onSaved()
      onClose()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<Row> = [
    {
      title: 'Ders',
      dataIndex: 'name',
      fixed: 'left',
      width: 260,
      render: (v: string, r) => (
        <Input size="small" value={v} maxLength={100} onChange={(e) => patchRow(r.key, { name: e.target.value })} />
      ),
    },
    {
      title: 'Tür',
      dataIndex: 'kind',
      width: 110,
      render: (v: LessonPoolKind, r) => (
        <Select size="small" style={{ width: '100%' }} value={v} options={KIND_OPTIONS} onChange={(k) => patchRow(r.key, { kind: k })} />
      ),
    },
    {
      title: 'Seçmeli grubu (MEB)',
      dataIndex: 'category',
      width: 190,
      render: (v: string | null, r) =>
        r.kind === 'secmeli' ? (
          <Input size="small" value={v || ''} maxLength={100} onChange={(e) => patchRow(r.key, { category: e.target.value || null })} />
        ) : null,
    },
    {
      title: 'Kaç kez',
      dataIndex: 'max_takes',
      width: 80,
      render: (v: number | null, r) =>
        r.kind === 'secmeli' ? (
          <InputNumber size="small" min={1} max={20} value={v} style={{ width: 64 }} onChange={(n) => patchRow(r.key, { max_takes: n ?? null })} />
        ) : null,
    },
    ...levels.map((level) => ({
      title: level === 'Hazırlık' ? 'Hazırlık' : `${level}. sınıf`,
      key: `lv-${level}`,
      width: 90,
      render: (_: unknown, r: Row) => (
        <Input
          size="small"
          key={`${r.key}-${level}-${formatHours(r.hours[level])}`}
          defaultValue={formatHours(r.hours[level])}
          placeholder="—"
          onBlur={(e) => {
            const list = parseHoursText(e.target.value)
            const hours = { ...r.hours }
            if (list.length) hours[level] = list
            else delete hours[level]
            patchRow(r.key, { hours })
          }}
        />
      ),
    })),
    {
      title: '',
      key: 'del',
      width: 44,
      render: (_: unknown, r: Row) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} />
      ),
    },
  ]

  return (
    <Drawer
      open
      width="min(1200px, 100vw)"
      title={state.id ? 'Ders havuzunu düzenle' : 'Yeni hazır ders havuzu'}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          Kaydet
        </Button>
      }
    >
      {state.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Dosyadan okunanları kontrol edin"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {state.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          }
        />
      )}
      <Form form={form} layout="vertical">
        <Space wrap align="start" size="large">
          <Form.Item name="name" label="Ad" rules={[{ required: true, message: 'Ad gerekli' }]} style={{ width: 360 }}>
            <Input maxLength={150} />
          </Form.Item>
          <Form.Item name="school_type" label="Okul türü" style={{ width: 160 }}>
            <Select allowClear options={SCHOOL_TYPE_OPTIONS} placeholder="Hepsi" />
          </Form.Item>
          <Form.Item label="Sınıf seviyeleri (sütunlar)" style={{ width: 300 }}>
            <Select mode="tags" value={levels} onChange={(v: string[]) => setLevels(v)} tokenSeparators={[',', ' ']} />
          </Form.Item>
          <Form.Item name="is_active" label="Okullara açık" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="note" label="Açıklama" extra="Okullar aktarırken görür (ör. TTK kararı tarihi ve sayısı).">
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Saat hücresine tek saat (5) ya da seçenekli saatleri eğik çizgiyle yazın (1/2/3). Seçenekli saatler okulun ders
        havuzuna aynı seviyede ayrı saat seçenekleri olarak aktarılır. "Kaç kez", seçmeli dersin öğrenim boyunca kaç
        kez alınabileceğidir.
      </Typography.Paragraph>
      <Space style={{ marginBottom: 8 }}>
        <Input.Search allowClear placeholder="Ders ara" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
        <Button
          icon={<PlusOutlined />}
          onClick={() => setRows((prev) => [...prev, ...toRows([{ name: '', kind: 'ortak', category: null, max_takes: null, hours: {} }])])}
        >
          Ders ekle
        </Button>
        <Typography.Text type="secondary">
          {rows.length} ders · {rows.filter((r) => r.kind === 'secmeli').length} seçmeli
        </Typography.Text>
      </Space>
      <Table<Row>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={visible}
        columns={columns}
        scroll={{ x: 740 + levels.length * 90, y: 'calc(100vh - 420px)' }}
      />
    </Drawer>
  )
}

export function LessonPoolsPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<LessonPoolTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<{ file_name: string; sheets: ParsedSheet[] } | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listLessonPoolTemplates())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onFile = async (file: File) => {
    setParsing(true)
    try {
      const res = await parseLessonPoolFile(file)
      setParsed(res)
      if (res.sheets.length === 1) setEditor(fromSheet(res.sheets[0], res.file_name))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  const saveAll = async () => {
    if (!parsed) return
    setSavingAll(true)
    try {
      for (const sheet of parsed.sheets) await createLessonPoolTemplate(fromSheet(sheet, parsed.file_name).draft)
      message.success(`${parsed.sheets.length} ders havuzu kaydedildi`)
      setParsed(null)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
      await load()
    } finally {
      setSavingAll(false)
    }
  }

  const openEdit = async (id: number) => {
    try {
      const t = await getLessonPoolTemplate(id)
      setEditor({ id: t.id, warnings: [], draft: { ...t } })
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<LessonPoolTemplateSummary> = [
    { title: 'Ad', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name, 'tr') },
    {
      title: 'Okul türü',
      dataIndex: 'school_type',
      width: 110,
      render: (v: SchoolTypeValue | null) => (v ? SCHOOL_TYPE_LABELS[v] : 'Hepsi'),
    },
    { title: 'Seviyeler', dataIndex: 'levels', width: 190, render: (v: string[]) => v.join(', ') },
    {
      title: 'Ders',
      key: 'count',
      width: 120,
      render: (_, r) => `${r.item_count} (${r.elective_count} seçmeli)`,
    },
    { title: 'Kaynak', dataIndex: 'source_name', ellipsis: true },
    {
      title: 'Okullara açık',
      dataIndex: 'is_active',
      width: 110,
      render: (v: boolean, r) => (
        <Switch
          size="small"
          checked={v}
          onChange={async (checked) => {
            try {
              await updateLessonPoolTemplate(r.id, { is_active: checked })
              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: checked } : x)))
            } catch (err) {
              message.error(getErrorMessage(err))
            }
          }}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.id)} />
          <Popconfirm
            title="Ders havuzu silinsin mi?"
            description="Okullara daha önce aktarılmış dersler silinmez."
            okText="Sil"
            okButtonProps={{ danger: true }}
            cancelText="Vazgeç"
            onConfirm={async () => {
              try {
                await deleteLessonPoolTemplate(r.id)
                await load()
              } catch (err) {
                message.error(getErrorMessage(err))
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Hazır Ders Havuzları">
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Hazır Ders Havuzları
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        MEB haftalık ders çizelgesini (Talim ve Terbiye Kurulu kararı PDF'i ya da MEBBİS'ten alınan Excel) yükleyin.
        Dosyadaki her çizelge (Anadolu Lisesi, Fen Lisesi vb.) ayrı bir ders havuzu olur. Okullar bu havuzu "Otomatik
        Ders Programı → Ders havuzu" adımında kendi havuzlarına aktarır.
      </Typography.Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Upload.Dragger
          accept=".pdf,.xls,.xlsx"
          multiple={false}
          showUploadList={false}
          disabled={parsing}
          beforeUpload={(file) => {
            void onFile(file)
            return false
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{parsing ? 'Dosya okunuyor…' : 'PDF veya Excel dosyasını buraya bırakın ya da tıklayın'}</p>
          <p className="ant-upload-hint">En fazla 15 MB. Kaydetmeden önce okunan dersleri kontrol edip düzeltebilirsiniz.</p>
        </Upload.Dragger>

        {parsed && parsed.sheets.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }} wrap>
              <Typography.Text strong>
                {parsed.file_name}: {parsed.sheets.length} çizelge bulundu
              </Typography.Text>
              <Space>
                <Button onClick={() => setParsed(null)}>Vazgeç</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={savingAll} onClick={saveAll}>
                  Tümünü kaydet
                </Button>
              </Space>
            </Space>
            <List
              bordered
              size="small"
              dataSource={parsed.sheets}
              renderItem={(sheet) => (
                <List.Item
                  actions={[
                    <Button key="edit" size="small" onClick={() => setEditor(fromSheet(sheet, parsed.file_name))}>
                      İncele ve kaydet
                    </Button>,
                  ]}
                >
                  <Space wrap>
                    <b>{sheet.title}</b>
                    <Tag>{sheet.source}</Tag>
                    <span>{sheet.levels.join(', ')}</span>
                    <Tag color="blue">{sheet.items.length} ders</Tag>
                    <Tag color="purple">{sheet.items.filter((i) => i.kind === 'secmeli').length} seçmeli</Tag>
                    {sheet.warnings.length > 0 && <Tag color="orange">{sheet.warnings.length} uyarı</Tag>}
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}
      </Card>

      <Card size="small" title="Kayıtlı ders havuzları">
        <Table<LessonPoolTemplateSummary>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Henüz hazır ders havuzu yok" /> }}
        />
      </Card>

      {editor && (
        <TemplateEditor
          state={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await load()
          }}
        />
      )}
    </AppLayout>
  )
}
