import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Empty, Input, List, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import {
  aiParseConstraints,
  createTimetableConstraints,
  deleteTimetableConstraint,
  listTimetableConstraints,
  updateTimetableConstraint,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import type { AiProposal, ConstraintInput, TimetableConstraint } from '../../types/timetable'
import { ConstraintFormModal } from './ConstraintFormModal'
import type { TimetableCtx } from './shared'

const EXAMPLES = [
  'Ayşe Hoca cuma günleri gelemiyor.',
  'Matematik dersleri mümkünse sabah saatlerinde olsun.',
  'Beden eğitimi 1. saate konmasın.',
  'Öğretmenler üst üste 4 saatten fazla derse girmesin.',
  'Tüm öğretmenlere haftada bir boş gün verelim.',
  'Fizik laboratuvarı salı öğleden sonra kapalı.',
]

interface ProposalRow extends AiProposal {
  key: number
  checked: boolean
}

export function ConstraintsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<TimetableConstraint[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [unresolved, setUnresolved] = useState<string[]>([])
  const [lastPrompt, setLastPrompt] = useState('')
  const [usage, setUsage] = useState(ctx.meta.ai_usage)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TimetableConstraint | null>(null)
  const { project } = ctx

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listTimetableConstraints(project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const onParse = async () => {
    if (text.trim().length < 3) return
    setParsing(true)
    setProposals([])
    setUnresolved([])
    try {
      const res = await aiParseConstraints(project.id, text.trim())
      setProposals(res.proposals.map((p, i) => ({ ...p, key: i, checked: true })))
      setUnresolved(res.unresolved)
      setLastPrompt(text.trim())
      if (res.usage) setUsage(res.usage)
      if (!res.proposals.length && !res.unresolved.length) message.info('Metinden kısıt çıkarılamadı')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  const onAcceptProposals = async () => {
    const chosen = proposals.filter((p) => p.checked)
    if (!chosen.length) return
    try {
      await createTimetableConstraints(
        project.id,
        chosen.map((p) => ({
          type: p.type,
          is_hard: p.is_hard,
          weight: p.is_hard ? null : p.weight ?? 20,
          params: p.params,
          source: 'ai',
          source_text: lastPrompt,
        })),
      )
      message.success(`${chosen.length} kısıt eklendi`)
      setProposals([])
      setUnresolved([])
      setText('')
      await load()
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onSubmitForm = async (input: ConstraintInput) => {
    try {
      if (editing) {
        await updateTimetableConstraint(editing.id, { is_hard: input.is_hard, weight: input.weight ?? null, params: input.params })
      } else {
        await createTimetableConstraints(project.id, [{ ...input, source: 'manuel' }])
      }
      setFormOpen(false)
      await load()
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const patch = async (row: TimetableConstraint, payload: Partial<TimetableConstraint>) => {
    try {
      await updateTimetableConstraint(row.id, payload)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <RobotOutlined />
            Yapay zekâ ile kısıt yaz
            {ctx.meta.ai_model && <Tag>{ctx.meta.ai_model}</Tag>}
            {usage && usage.limit > 0 && (
              <Tag color={usage.used >= usage.limit ? 'red' : 'default'}>
                Bugün {usage.used}/{usage.limit}
              </Tag>
            )}
          </Space>
        }
      >
        {!ctx.meta.ai_licensed ? (
          <Alert
            type="info"
            showIcon
            message="Yapay zekâ eklenti lisansı gerekli"
            description='İstekleri Türkçe yazıp kısıta çevirmek için hesabınıza "Yapay Zekâ" eklenti lisansı tanımlanmalıdır. Kısıtları aşağıdan elle ekleyebilirsiniz; program oluşturma lisanstan bağımsız çalışır.'
          />
        ) : !ctx.meta.ai_configured ? (
          <Alert
            type="warning"
            showIcon
            message="Yapay zekâ servisi yapılandırılmamış"
            description="Lisansınız aktif ancak sunucuda yapay zekâ anahtarı (GEMINI_API_KEY) tanımlı değil. Sistem yöneticisine bildirin. Kısıtları aşağıdan elle ekleyebilirsiniz."
          />
        ) : (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              İstekleri Türkçe yazın. Yapay zekâ bunları kısıta çevirir; siz onaylamadan hiçbir şey eklenmez. Programı
              yapay zekâ değil, matematiksel çözücü hazırlar. Gemini'ye yalnızca öğretmen adı/branşı, şube ve ders
              adları gönderilir.
            </Typography.Paragraph>
            <Input.TextArea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              showCount
              placeholder={EXAMPLES.join('\n')}
              disabled={!ctx.canCreate}
            />
            <Space wrap style={{ marginTop: 8 }}>
              <Button type="primary" icon={<RobotOutlined />} loading={parsing} onClick={onParse} disabled={!ctx.canCreate}>
                Yorumla
              </Button>
              {EXAMPLES.slice(0, 3).map((ex) => (
                <Button key={ex} size="small" type="dashed" onClick={() => setText((t) => (t ? `${t}\n${ex}` : ex))}>
                  {ex}
                </Button>
              ))}
            </Space>

            {(proposals.length > 0 || unresolved.length > 0) && (
              <div style={{ marginTop: 16 }}>
                {proposals.length > 0 && (
                  <List
                    size="small"
                    bordered
                    header={<strong>Önerilen kısıtlar: eklemek istediklerinizi işaretleyin</strong>}
                    dataSource={proposals}
                    renderItem={(p) => (
                      <List.Item
                        actions={[
                          <Tooltip key="hard" title="Kesin kural / esnek tercih">
                            <Switch
                              checkedChildren="Kesin"
                              unCheckedChildren="Esnek"
                              checked={p.is_hard}
                              onChange={(v) =>
                                setProposals((prev) =>
                                  prev.map((x) => (x.key === p.key ? { ...x, is_hard: v, weight: v ? null : x.weight ?? 20 } : x)),
                                )
                              }
                            />
                          </Tooltip>,
                        ]}
                      >
                        <Checkbox
                          checked={p.checked}
                          onChange={(e) =>
                            setProposals((prev) => prev.map((x) => (x.key === p.key ? { ...x, checked: e.target.checked } : x)))
                          }
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{p.summary}</div>
                            {p.explanation && (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {p.explanation}
                              </Typography.Text>
                            )}
                          </div>
                        </Checkbox>
                      </List.Item>
                    )}
                    footer={
                      <Space>
                        <Button type="primary" onClick={onAcceptProposals} disabled={!proposals.some((p) => p.checked)}>
                          Seçilenleri Ekle
                        </Button>
                        <Button onClick={() => setProposals([])}>Vazgeç</Button>
                      </Space>
                    }
                  />
                )}
                {unresolved.length > 0 && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    message="Anlaşılamayan / desteklenmeyen istekler"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {unresolved.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </Card>

      <Space style={{ marginBottom: 12 }}>
        {ctx.canCreate && (
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Elle Kısıt Ekle
          </Button>
        )}
      </Space>

      <Table<TimetableConstraint>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <Empty description="Henüz kısıt yok. Kısıt olmadan da program oluşturulabilir." /> }}
        columns={[
          {
            title: 'Aktif',
            dataIndex: 'is_active',
            width: 70,
            render: (v: boolean, r) => <Switch size="small" checked={v} disabled={!ctx.canUpdate} onChange={(c) => patch(r, { is_active: c })} />,
          },
          { title: 'Tür', dataIndex: 'type_label', width: 200 },
          {
            title: 'Kısıt',
            dataIndex: 'summary',
            render: (v: string, r) => (
              <div>
                {v}
                {r.source === 'ai' && (
                  <Tooltip title={r.source_text || ''}>
                    <Tag icon={<RobotOutlined />} style={{ marginLeft: 6 }}>
                      AI
                    </Tag>
                  </Tooltip>
                )}
              </div>
            ),
          },
          {
            title: 'Tip',
            key: 'hard',
            width: 150,
            render: (_, r) =>
              r.is_hard ? <Tag color="red">Kesin</Tag> : <Tag color="blue">Esnek · önem {r.weight ?? 20}</Tag>,
          },
          {
            title: '',
            key: 'actions',
            width: 90,
            render: (_, r) => (
              <Space>
                {ctx.canUpdate && (
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditing(r)
                      setFormOpen(true)
                    }}
                  />
                )}
                {ctx.canDelete && (
                  <Popconfirm
                    title="Kısıt silinsin mi?"
                    okText="Sil"
                    cancelText="Vazgeç"
                    onConfirm={async () => {
                      try {
                        await deleteTimetableConstraint(r.id)
                        await load()
                      } catch (err) {
                        message.error(getErrorMessage(err))
                      }
                    }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <ConstraintFormModal
        ctx={ctx}
        open={formOpen}
        editing={editing}
        onCancel={() => setFormOpen(false)}
        onSubmit={onSubmitForm}
      />
    </>
  )
}
