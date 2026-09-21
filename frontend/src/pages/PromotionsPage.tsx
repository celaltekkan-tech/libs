import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { FilterBar } from '../components/FilterBar'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { SortableTable } from '../components/SortableTable'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  applyPromotion,
  downloadPromotionForm,
  fetchSchoolPrincipal,
  fetchUpcomingPromotions,
  listTeachers,
  reportEightYearCheck,
} from '../api/teachers'
import type { UpcomingPromotion } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type {
  ApplyPromotionPayload,
  PromotionType,
  ReportEightYearCheckPayload,
  Teacher,
} from '../types/teacher'
import { downloadBlob } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface PromotionApplyValues {
  new_degree: string
  new_rank: string
  new_degree_rank_date: dayjs.Dayjs
  note?: string
  override_reason?: string
  is_permanent?: boolean
}

interface EightYearCheckValues {
  has_penalty: boolean
  penalty_date?: dayjs.Dayjs
  note?: string
}

/** Seçilen ayın terfi dönemi: önceki ayın 15'i – bu ayın 14'ü. */
function promotionPeriod(month: dayjs.Dayjs) {
  const end = month.date(14)
  const start = month.subtract(1, 'month').date(15)
  return { start, end }
}

/** Terfi tarihi, göreve ilk başlama / kademe tarihinin yıl dönümüdür. */
function anniversaryInPeriod(base: string, start: dayjs.Dayjs, end: dayjs.Dayjs): dayjs.Dayjs | null {
  const parsed = dayjs(base.slice(0, 10))
  if (!parsed.isValid()) return null
  const month = parsed.month()
  const day = parsed.date()
  for (let year = start.year(); year <= end.year(); year += 1) {
    const daysInMonth = dayjs(new Date(year, month, 1)).daysInMonth()
    const candidate = dayjs(new Date(year, month, Math.min(day, daysInMonth)))
    if (!candidate.isBefore(start, 'day') && !candidate.isAfter(end, 'day')) return candidate
  }
  return null
}

function isDue(row: UpcomingPromotion) {
  return row.kariyer_eligible || row.eight_year_due || row.in_current_period
}

function applyModalTitle(type: PromotionType, row?: UpcomingPromotion) {
  if (type === 'yillik') return 'Yıllık Kademe İlerlemesini Uygula'
  if (type === 'kariyer') {
    const target = row?.kariyer_suggested_title
    return target ? `Kariyer Terfisini Uygula (Derece -1, ${target})` : 'Kariyer Terfisini Uygula (Derece -1)'
  }
  return 'Terfi Tarihini Değiştir'
}

export function PromotionsPage() {
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const { activeSchoolId } = useActiveSchool()
  const canUpdate = hasPermission('teachers.update')

  const [rows, setRows] = useState<UpcomingPromotion[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search)
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [onlyDue, setOnlyDue] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<number[]>([])
  const [principalName, setPrincipalName] = useState<string | null>(null)
  const [periodMonth, setPeriodMonth] = useState<dayjs.Dayjs | null>(null)

  const [applyTarget, setApplyTarget] = useState<{ row: UpcomingPromotion; type: PromotionType } | null>(null)
  const [applySubmitting, setApplySubmitting] = useState(false)
  const [applyForm] = Form.useForm<PromotionApplyValues>()

  const [eightYearTarget, setEightYearTarget] = useState<UpcomingPromotion | null>(null)
  const [eightYearSubmitting, setEightYearSubmitting] = useState(false)
  const [eightYearForm] = Form.useForm<EightYearCheckValues>()
  const hasPenalty = Form.useWatch('has_penalty', eightYearForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, teacherRows] = await Promise.all([
        fetchUpcomingPromotions({ all: true }),
        listTeachers({ scope: 'all' }),
      ])
      setRows(data)
      setTeachers(teacherRows)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!activeSchoolId) {
      setPrincipalName(null)
      return
    }
    void fetchSchoolPrincipal(activeSchoolId)
      .then(setPrincipalName)
      .catch(() => setPrincipalName(null))
  }, [activeSchoolId])

  const teachersById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers])

  const hasActiveFilters = Boolean(search.trim() || typeFilter || onlyDue || periodMonth)

  const period = periodMonth ? promotionPeriod(periodMonth) : null

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    return rows.filter((r) => {
      if (activeSchoolId) {
        const teacher = teachersById.get(r.teacher_id)
        if (teacher?.school_id && teacher.school_id !== activeSchoolId) return false
      }
      if (period) {
        if (!r.degree_rank_date || !anniversaryInPeriod(r.degree_rank_date, period.start, period.end)) {
          return false
        }
      }
      if (typeFilter && r.personnel_type !== typeFilter) return false
      if (onlyDue && !isDue(r)) return false
      if (!q) return true
      return (
        r.teacher_name.toLocaleLowerCase('tr-TR').includes(q) ||
        (r.personnel_no || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [rows, searchQuery, typeFilter, onlyDue, period, activeSchoolId, teachersById])

  const openApply = (row: UpcomingPromotion, type: PromotionType) => {
    setApplyTarget({ row, type })
    if (type === 'kariyer') {
      applyForm.setFieldsValue({
        new_degree: row.kariyer_suggested_degree || row.degree || undefined,
        new_rank: row.rank || undefined,
        new_degree_rank_date: dayjs(),
        note: undefined,
        override_reason: undefined,
        is_permanent: true,
      })
    } else {
      applyForm.setFieldsValue({
        new_degree: row.suggested_degree || row.degree || undefined,
        new_rank: row.suggested_rank || row.rank || undefined,
        new_degree_rank_date: dayjs(row.next_promotion_date || undefined),
        note: undefined,
        override_reason: undefined,
        is_permanent: true,
      })
    }
  }

  const onApplySubmit = async (values: PromotionApplyValues) => {
    if (!applyTarget) return
    setApplySubmitting(true)
    try {
      const payload: ApplyPromotionPayload = {
        new_degree: values.new_degree,
        new_rank: values.new_rank,
        new_degree_rank_date: values.new_degree_rank_date.toISOString(),
        note: values.note || null,
        type: applyTarget.type,
        override_reason: applyTarget.type === 'manuel' ? values.override_reason : undefined,
        is_permanent: applyTarget.type === 'manuel' ? Boolean(values.is_permanent) : true,
      }
      const { history } = await applyPromotion(applyTarget.row.teacher_id, payload)
      message.success('Terfi/kademe ilerlemesi uygulandı')
      setApplyTarget(null)
      void load()
      try {
        const blob = await downloadPromotionForm(history.id)
        downloadBlob(blob, `terfi-formu-${applyTarget.row.personnel_no || applyTarget.row.teacher_id}.xlsx`)
      } catch (err) {
        message.warning('Terfi kaydedildi ancak form indirilemedi: ' + getErrorMessage(err))
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setApplySubmitting(false)
    }
  }

  const openEightYear = (row: UpcomingPromotion) => {
    setEightYearTarget(row)
    eightYearForm.resetFields()
    eightYearForm.setFieldsValue({ has_penalty: false })
  }

  const onEightYearSubmit = async (values: EightYearCheckValues) => {
    if (!eightYearTarget) return
    setEightYearSubmitting(true)
    try {
      const payload: ReportEightYearCheckPayload = {
        has_penalty: values.has_penalty,
        penalty_date: values.has_penalty ? values.penalty_date?.toISOString() : null,
        note: values.note || null,
      }
      const { bonusApplied } = await reportEightYearCheck(eightYearTarget.teacher_id, payload)
      message.success(
        bonusApplied
          ? '8 yıl boyunca ceza alınmadı, kademe ilerlemesi uygulandı'
          : 'Ceza bildirildi, 8 yıllık sayaç bu tarihten yeniden başlayacak',
      )
      setEightYearTarget(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setEightYearSubmitting(false)
    }
  }

  const toggleExpand = (teacherId: number) => {
    setExpandedKeys((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId],
    )
  }

  const columns: ColumnsType<UpcomingPromotion> = [
    {
      title: 'Ad Soyad',
      dataIndex: 'teacher_name',
      render: (v: string, r) => (
        <Typography.Link onClick={() => toggleExpand(r.teacher_id)}>{v}</Typography.Link>
      ),
    },
    {
      title: 'Tür',
      dataIndex: 'personnel_type',
      render: (v: string) => (v === 'ogretmen' ? <Tag color="blue">Öğretmen</Tag> : <Tag color="purple">Memur</Tag>),
    },
    {
      title: 'Derece / Kademe',
      render: (_: unknown, r: UpcomingPromotion) => (
        <Space>
          <span>{r.degree || '—'} / {r.rank || '—'}</span>
          {r.at_ceiling && <Tag color="gold">Tavan</Tag>}
        </Space>
      ),
    },
    { title: 'Kariyer', dataIndex: 'kariyer', render: (v: string | null) => v || '—' },
    { title: 'Kademe Tarihi', dataIndex: 'degree_rank_date', render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY') : '—') },
    {
      title: 'Sıradaki Yıllık Terfi',
      render: (_: unknown, r: UpcomingPromotion) => {
        const inPeriod =
          period && r.degree_rank_date
            ? anniversaryInPeriod(r.degree_rank_date, period.start, period.end)
            : null
        const shown = inPeriod || (r.next_promotion_date ? dayjs(r.next_promotion_date) : null)
        if (!shown) return '—'
        return (
          <Space>
            <span>{shown.format('DD.MM.YYYY')}</span>
            {!inPeriod && r.days_remaining != null && (
              <Tag color={r.days_remaining <= 30 ? 'red' : r.in_current_period ? 'orange' : 'blue'}>
                {r.days_remaining} gün
              </Tag>
            )}
          </Space>
        )
      },
    },
    ...(canUpdate
      ? [
          {
            title: 'İşlemler',
            render: (_: unknown, r: UpcomingPromotion) => (
              <Space wrap size="small">
                {!r.at_ceiling && (
                  <Button size="small" onClick={() => openApply(r, 'yillik')}>
                    Terfiyi Uygula
                  </Button>
                )}
                {!r.at_ceiling && r.eight_year_due && (
                  <Button size="small" onClick={() => openEightYear(r)}>
                    8 Yıl Kontrolü
                  </Button>
                )}
                {r.kariyer_eligible && (
                  <Button size="small" onClick={() => openApply(r, 'kariyer')}>
                    Kariyer Terfisi Uygula
                  </Button>
                )}
                {!r.at_ceiling && (
                  <Button size="small" onClick={() => openApply(r, 'manuel')}>
                    Terfi Tarihini Değiştir
                  </Button>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Terfi Takibi">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Terfi Takibi
        </Typography.Title>
      </Space>

      <FilterBar>
        <Input.Search
          placeholder="Ad, soyad veya sicil no ara"
          allowClear
          style={{ width: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Personel Türü"
          style={{ width: 160 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'ogretmen', label: 'Öğretmen' },
            { value: 'memur', label: 'Memur' },
          ]}
        />
        <Select
          allowClear
          placeholder="Durum"
          style={{ width: 200 }}
          value={onlyDue ? 'due' : undefined}
          onChange={(v) => setOnlyDue(v === 'due')}
          options={[{ value: 'due', label: 'Sadece işlem gerekenler' }]}
        />
        <DatePicker
          picker="month"
          value={periodMonth}
          format="MM.YYYY"
          allowClear
          placeholder="Terfi ayı"
          onChange={(value) => setPeriodMonth(value ? value.startOf('month') : null)}
        />
        {period && (
          <Typography.Text type="secondary">
            {period.start.format('DD.MM.YYYY')} – {period.end.format('DD.MM.YYYY')}
          </Typography.Text>
        )}
        <ClearFiltersButton
          active={hasActiveFilters}
          onClick={() => {
            setSearch('')
            setTypeFilter(undefined)
            setOnlyDue(false)
            setPeriodMonth(null)
          }}
        />
      </FilterBar>

      <SortableTable
        rowKey="teacher_id"
        loading={loading}
        columns={columns}
        dataSource={filteredRows}
        locale={{
            emptyText: period
            ? 'Bu dönemde yıl dönümü olan personel yok. Terfi tarihi, göreve ilk başlama günüdür.'
            : 'Kayıt yok',
        }}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys(keys as number[]),
          showExpandColumn: false,
          expandedRowRender: (r) => {
            const t = teachersById.get(r.teacher_id)
            if (!t) return <Typography.Text type="secondary">Öğretmen bilgisi bulunamadı</Typography.Text>
            return (
              <Descriptions size="small" column={3} bordered>
                <Descriptions.Item label="Sicil No">{t.personnel_no || '—'}</Descriptions.Item>
                <Descriptions.Item label="TC Kimlik No">{t.national_id || '—'}</Descriptions.Item>
                <Descriptions.Item label="Telefon">{t.phone || '—'}</Descriptions.Item>
                <Descriptions.Item label="E-posta">{t.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="Unvan">{t.unvan || '—'}</Descriptions.Item>
                <Descriptions.Item label="Branş">{t.brans || '—'}</Descriptions.Item>
                <Descriptions.Item label="Kariyer">{t.kariyer || '—'}</Descriptions.Item>
                <Descriptions.Item label="Personel Türü">
                  {t.personnel_type === 'ogretmen' ? 'Öğretmen' : 'Memur'}
                </Descriptions.Item>
                <Descriptions.Item label="Personel Kategorisi">
                  {t.PersonnelCategory?.name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Çalıştığı Kurum">{t.working_institution || '—'}</Descriptions.Item>
                <Descriptions.Item label="Emekli Sicil No">{t.pension_degree || '—'}</Descriptions.Item>
                <Descriptions.Item label="Sendika">{t.union_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Son Mezun Olduğu Okul">
                  {t.last_graduated_school || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="İl / İlçe">
                  {t.city || t.district ? `${t.city || '—'} / ${t.district || '—'}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Okul Müdürü">
                  {principalName || t.school_principal || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Yıllık İzin Kotası">
                  {t.annual_leave_quota ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Hizmet Başlangıç Tarihi">
                  {t.service_start_date ? dayjs(t.service_start_date).format('DD.MM.YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="İlk Görev Tarihi">
                  {t.first_duty_date ? dayjs(t.first_duty_date).format('DD.MM.YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="8 Yıl Başlangıç Tarihi">
                  {t.eight_year_base_date ? dayjs(t.eight_year_base_date).format('DD.MM.YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Sözleşme Başlangıç">
                  {t.contract_start_date ? dayjs(t.contract_start_date).format('DD.MM.YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Sözleşme Bitiş">
                  {t.contract_end_date ? dayjs(t.contract_end_date).format('DD.MM.YYYY') : '—'}
                </Descriptions.Item>
              </Descriptions>
            )
          },
        }}
      />

      <Modal
        title={
          applyTarget
            ? `${applyModalTitle(applyTarget.type, applyTarget.row)} — ${applyTarget.row.teacher_name}`
            : ''
        }
        open={Boolean(applyTarget)}
        onCancel={() => setApplyTarget(null)}
        onOk={() => applyForm.submit()}
        confirmLoading={applySubmitting}
        okText="Uygula ve Formu İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={applyForm} layout="vertical" onFinish={onApplySubmit}>
          <Typography.Text type="secondary">
            Mevcut durum: {applyTarget?.row.degree || '—'} / {applyTarget?.row.rank || '—'}
          </Typography.Text>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Form.Item name="new_degree" label="Yeni Derece" rules={[{ required: true, message: 'Zorunlu' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="new_rank" label="Yeni Kademe" rules={[{ required: true, message: 'Zorunlu' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="new_degree_rank_date" label="Terfi Tarihi" rules={[{ required: true, message: 'Zorunlu' }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          {applyTarget?.type === 'manuel' && (
            <>
              <Form.Item
                name="override_reason"
                label="Değişiklik Sebebi"
                rules={[{ required: true, message: 'Terfi tarihini değiştirme sebebini yazın' }]}
              >
                <Input.TextArea rows={2} placeholder="Örn. Askerlik dönüşü, ücretsiz izin, mahkeme kararı vb." />
              </Form.Item>
              <Form.Item
                name="is_permanent"
                label="Bu değişiklik"
                rules={[{ required: true }]}
              >
                <Radio.Group>
                  <Radio value={true}>Sürekli — kademe takvimi bu tarihe göre devam etsin</Radio>
                  <Radio value={false}>Tek seferlik — sıradaki yıllık takvim eskisi gibi devam etsin</Radio>
                </Radio.Group>
              </Form.Item>
            </>
          )}
          <Form.Item name="note" label="Açıklama (isteğe bağlı)">
            <Input placeholder="Örn. 657 s. DMK 64-65. Md." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={eightYearTarget ? `8 Yıllık Kademe Kontrolü — ${eightYearTarget.teacher_name}` : ''}
        open={Boolean(eightYearTarget)}
        onCancel={() => setEightYearTarget(null)}
        onOk={() => eightYearForm.submit()}
        confirmLoading={eightYearSubmitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={eightYearForm} layout="vertical" onFinish={onEightYearSubmit}>
          <Form.Item name="has_penalty" label="Bu 8 yıllık dönemde ceza aldı mı?" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value={false}>Hayır — kademe ilerlemesi uygulansın</Radio>
              <Radio value={true}>Evet — ceza tarihini gir</Radio>
            </Radio.Group>
          </Form.Item>
          {hasPenalty && (
            <Form.Item
              name="penalty_date"
              label="Ceza Tarihi"
              rules={[{ required: true, message: 'Ceza tarihini seçin' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
            </Form.Item>
          )}
          <Form.Item name="note" label="Not (isteğe bağlı)">
            <Input placeholder="Örn. disiplin karar no" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
