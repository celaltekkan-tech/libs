import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  applyTimetableRun,
  cancelTimetableRun,
  checkTimetable,
  getTimetableRun,
  listTimetableRuns,
  startTimetableRun,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { RUN_STATUS_LABELS, SCORE_LABELS, type CheckResult, type TimetableRun } from '../../types/timetable'
import type { TimetableCtx } from './shared'

interface Props {
  ctx: TimetableCtx
  onShowGrid: () => void
}

const ACTIVE = ['kuyrukta', 'calisiyor']

export function SolveTab({ ctx, onShowGrid }: Props) {
  const { message } = App.useApp()
  const { project } = ctx
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [timeLimit, setTimeLimit] = useState<number>(project.settings.time_limit)
  const [runs, setRuns] = useState<TimetableRun[]>([])
  const [active, setActive] = useState<TimetableRun | null>(null)
  const [selected, setSelected] = useState<TimetableRun | null>(null)
  const [starting, setStarting] = useState(false)
  const timer = useRef<number | null>(null)

  const loadRuns = useCallback(async () => {
    try {
      const list = await listTimetableRuns(project.id)
      setRuns(list)
      const running = list.find((r) => ACTIVE.includes(r.status))
      setActive(running || null)
      return list
    } catch (err) {
      message.error(getErrorMessage(err))
      return []
    }
  }, [project.id, message])

  useEffect(() => {
    void loadRuns().then((list) => {
      const last = list.find((r) => r.status === 'tamamlandi')
      if (last) void getTimetableRun(last.id).then(setSelected).catch(() => undefined)
    })
  }, [loadRuns])

  // Devam eden işi 2 sn'de bir izler.
  useEffect(() => {
    if (!active) return
    const tick = async () => {
      try {
        const r = await getTimetableRun(active.id)
        if (ACTIVE.includes(r.status)) {
          setActive(r)
          timer.current = window.setTimeout(tick, 2000)
          return
        }
        setActive(null)
        setSelected(r)
        await loadRuns()
        await ctx.reloadProject()
        if (r.status === 'tamamlandi') {
          message.success('Program oluşturuldu')
        } else if (r.status === 'basarisiz') {
          message.error('Program oluşturulamadı; ayrıntılar aşağıda')
        }
      } catch {
        timer.current = window.setTimeout(tick, 4000)
      }
    }
    timer.current = window.setTimeout(tick, 2000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const onCheck = async () => {
    setChecking(true)
    try {
      setCheck(await checkTimetable(project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  const onStart = async () => {
    setStarting(true)
    try {
      const run = await startTimetableRun(project.id, timeLimit)
      setActive(run)
      setSelected(null)
      await loadRuns()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setStarting(false)
    }
  }

  const onCancel = async () => {
    if (!active) return
    try {
      await cancelTimetableRun(active.id)
      message.info('Durduruluyor; o ana kadarki en iyi sonuç kaydedilecek')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onApply = async (run: TimetableRun) => {
    try {
      await applyTimetableRun(run.id)
      message.success('Sonuç taslağa uygulandı')
      await loadRuns()
      await ctx.reloadProject()
      onShowGrid()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const elapsed = active?.progress?.elapsed ?? (active?.started_at ? dayjs().diff(dayjs(active.started_at), 'second') : 0)
  const pct = active ? Math.min(99, Math.round((elapsed / (active.time_limit || 60)) * 100)) : 0

  return (
    <>
      {!ctx.meta.solver_available && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Program çözücü servisine ulaşılamıyor"
          description="Sunucuda 'solver' servisinin çalıştığından emin olun (docker compose up -d solver)."
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card size="small" title="1. Ön kontrol" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Saat toplamları, öğretmen müsaitliği, mekan kapasitesi ve blok düzenleri çözümden önce kontrol edilir.
            </Typography.Paragraph>
            <Button onClick={onCheck} loading={checking} icon={<CheckCircleOutlined />}>
              Kontrol Et
            </Button>
            {check && (
              <div style={{ marginTop: 12 }}>
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="Atama">{check.stats.assignments}</Descriptions.Item>
                  <Descriptions.Item label="Toplam saat">{check.stats.total_hours}</Descriptions.Item>
                  <Descriptions.Item label="Şube">{check.stats.classrooms}</Descriptions.Item>
                  <Descriptions.Item label="Öğretmen">{check.stats.teachers}</Descriptions.Item>
                </Descriptions>
                {check.issues.length === 0 ? (
                  <Alert style={{ marginTop: 12 }} type="success" showIcon message="Sorun bulunmadı" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
                    {check.issues.map((i, idx) => (
                      <Alert key={idx} type={i.level === 'error' ? 'error' : 'warning'} showIcon message={i.message} />
                    ))}
                  </Space>
                )}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card size="small" title="2. Programı oluştur" style={{ marginBottom: 16 }}>
            {active ? (
              <>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Text>
                    Çözücü çalışıyor. Bu sayfadan ayrılabilirsiniz; işlem sunucuda devam eder.
                  </Typography.Text>
                  <Progress percent={pct} status="active" />
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Bulunan çözüm" value={active.progress?.solutions ?? 0} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Ceza puanı (düşük iyi)" value={active.progress?.objective ?? '—'} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Geçen süre" value={`${Math.round(elapsed)} / ${active.time_limit} sn`} />
                    </Col>
                  </Row>
                  <Button danger icon={<StopOutlined />} onClick={onCancel}>
                    Durdur (en iyi sonucu al)
                  </Button>
                </Space>
              </>
            ) : (
              <Space wrap align="end">
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Süre sınırı (sn)</div>
                  <InputNumber min={10} max={600} step={30} value={timeLimit} onChange={(v) => setTimeLimit(v || 60)} />
                </div>
                {ctx.canCreate && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    loading={starting}
                    onClick={onStart}
                    disabled={!ctx.meta.solver_available}
                  >
                    Programı Oluştur
                  </Button>
                )}
              </Space>
            )}
            {!active && (project.counts?.lessons ?? 0) > 0 && (
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Mevcut taslakta kilitlediğiniz dersler yerinde kalır; yeni sonuç taslağa siz "Uygula" deyince yazılır.
              </Typography.Paragraph>
            )}
          </Card>

          {selected && (
            <Card
              size="small"
              title={`Çalıştırma #${selected.id} sonucu`}
              style={{ marginBottom: 16 }}
              extra={
                selected.status === 'tamamlandi' &&
                (selected.applied_at ? (
                  <Button onClick={onShowGrid}>Programı Gör</Button>
                ) : (
                  ctx.canUpdate && (
                    <Popconfirm
                      title="Mevcut taslak bu sonuçla değiştirilsin mi?"
                      okText="Uygula"
                      cancelText="Vazgeç"
                      onConfirm={() => onApply(selected)}
                    >
                      <Button type="primary">Taslağa Uygula</Button>
                    </Popconfirm>
                  )
                ))
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {selected.status === 'tamamlandi' && (
                  <Alert
                    type="success"
                    showIcon
                    message={`${selected.result?.lesson_count ?? 0} ders saati yerleştirildi${
                      selected.solver_status === 'OPTIMAL' ? ' (en iyi çözüm kanıtlandı)' : ''
                    }`}
                  />
                )}
                {(selected.diagnostics || []).map((d, i) => (
                  <Alert key={i} type={d.level === 'error' ? 'error' : 'warning'} showIcon message={d.message} />
                ))}
                {selected.error && <Alert type="error" showIcon message={selected.error} />}
                {selected.result?.score && (
                  <Descriptions size="small" column={1} bordered title="Kalite dökümü (ihlal sayıları)">
                    {Object.entries(selected.result.score).map(([k, v]) => (
                      <Descriptions.Item key={k} label={SCORE_LABELS[k] || k}>
                        {v === 0 ? <Tag color="green">0</Tag> : <Tag color="orange">{v}</Tag>}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                )}
              </Space>
            </Card>
          )}
        </Col>
      </Row>

      <Card size="small" title="Geçmiş çalıştırmalar">
        <Table<TimetableRun>
          rowKey="id"
          size="small"
          dataSource={runs}
          pagination={false}
          onRow={(r) => ({
            onClick: async () => {
              try {
                setSelected(await getTimetableRun(r.id))
              } catch (err) {
                message.error(getErrorMessage(err))
              }
            },
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: '#', dataIndex: 'id', width: 60 },
            {
              title: 'Başlangıç',
              dataIndex: 'created_at',
              render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
            },
            {
              title: 'Durum',
              dataIndex: 'status',
              render: (v: TimetableRun['status']) => <Tag color={RUN_STATUS_LABELS[v].color}>{RUN_STATUS_LABELS[v].label}</Tag>,
            },
            { title: 'Süre', dataIndex: 'time_limit', render: (v: number) => `${v} sn` },
            { title: 'Ceza puanı', dataIndex: 'objective', render: (v: number | null) => (v == null ? '—' : Math.round(v)) },
            {
              title: 'Taslağa uygulandı',
              dataIndex: 'applied_at',
              render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : ''),
            },
          ]}
        />
      </Card>
    </>
  )
}
