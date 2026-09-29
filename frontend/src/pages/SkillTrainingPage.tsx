import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import { getErrorMessage } from '../api/client'
import { listStudents } from '../api/students'
import { listTeachers } from '../api/teachers'
import {
  deleteSkillBusiness,
  deleteSkillPlacement,
  downloadSkillDocument,
  generateSkillSupports,
  listSkillBusinesses,
  listSkillPlacements,
  listSkillSgk,
  listSkillSupports,
  prepareSkillSgk,
  saveSkillBusiness,
  saveSkillPlacement,
  updateSkillSgk,
  updateSkillSupport,
  type SkillBusiness,
  type SkillPerson,
  type SkillPlacement,
  type SkillSgk,
  type SkillSupport,
} from '../api/skillTraining'
import type { Student } from '../types/student'
import type { Teacher } from '../types/teacher'

function person(row?: { first_name?: string; last_name?: string } | null) {
  return `${row?.first_name || ''} ${row?.last_name || ''}`.trim()
}

function classOf(row?: SkillPerson | null) {
  return [row?.class_level, row?.section].filter(Boolean).join('/') || '—'
}

const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'tamamlandi', label: 'Tamamlandı' },
  { value: 'ayrildi', label: 'Ayrıldı' },
]

export function SkillTrainingPage() {
  const { message, modal } = App.useApp()
  const { hasPermission } = useAuth()
  const { activeSchoolId, activeSchool } = useActiveSchool()
  const canCreate = hasPermission('skill_training.create')
  const canUpdate = hasPermission('skill_training.update')
  const canDelete = hasPermission('skill_training.delete')
  const [tab, setTab] = useState('businesses')
  const [businesses, setBusinesses] = useState<SkillBusiness[]>([])
  const [placements, setPlacements] = useState<SkillPlacement[]>([])
  const [supports, setSupports] = useState<SkillSupport[]>([])
  const [notices, setNotices] = useState<SkillSgk[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [placementOpen, setPlacementOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<SkillBusiness | null>(null)
  const [editingPlacement, setEditingPlacement] = useState<SkillPlacement | null>(null)
  const [period, setPeriod] = useState(() => dayjs())
  const [docPlacement, setDocPlacement] = useState<number | null>(null)
  const [businessForm] = Form.useForm()
  const [placementForm] = Form.useForm()

  const load = useCallback(async () => {
    if (!activeSchoolId) return
    setLoading(true)
    try {
      const [b, p, s, g, studentRows, teacherRows] = await Promise.all([
        listSkillBusinesses(activeSchoolId),
        listSkillPlacements(activeSchoolId),
        listSkillSupports(activeSchoolId, period.year(), period.month() + 1),
        listSkillSgk(activeSchoolId),
        listStudents({ school_id: activeSchoolId }),
        listTeachers({ school_id: activeSchoolId, scope: 'teachers' }),
      ])
      setBusinesses(b)
      setPlacements(p)
      setSupports(s)
      setNotices(g)
      setStudents(studentRows)
      setTeachers(teacherRows)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [activeSchoolId, period, message])

  useEffect(() => {
    void load()
  }, [load])

  const openBusiness = (row?: SkillBusiness) => {
    setEditingBusiness(row || null)
    businessForm.setFieldsValue(row || { is_active: true })
    setBusinessOpen(true)
  }

  const openPlacement = (row?: SkillPlacement) => {
    setEditingPlacement(row || null)
    placementForm.setFieldsValue(
      row
        ? {
            ...row,
            start_date: row.start_date ? dayjs(row.start_date) : null,
            end_date: row.end_date ? dayjs(row.end_date) : null,
            contract_date: row.contract_date ? dayjs(row.contract_date) : null,
          }
        : { status: 'aktif', weekly_days: 3 },
    )
    setPlacementOpen(true)
  }

  const saveBusiness = async (values: SkillBusiness) => {
    if (!activeSchoolId) return
    try {
      await saveSkillBusiness({ ...values, school_id: activeSchoolId }, editingBusiness?.id)
      message.success(editingBusiness ? 'İşletme güncellendi' : 'İşletme eklendi')
      setBusinessOpen(false)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const savePlacement = async (values: Record<string, unknown>) => {
    if (!activeSchoolId) return
    const date = (value: unknown) => (dayjs.isDayjs(value) ? (value as Dayjs).format('YYYY-MM-DD') : value || null)
    try {
      await saveSkillPlacement(
        {
          ...values,
          school_id: activeSchoolId,
          start_date: date(values.start_date),
          end_date: date(values.end_date),
          contract_date: date(values.contract_date),
          teacher_id: values.teacher_id || null,
        },
        editingPlacement?.id,
      )
      message.success(editingPlacement ? 'Yerleştirme güncellendi' : 'Yerleştirme eklendi')
      setPlacementOpen(false)
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const download = async (kind: 'sozlesme' | 'devam' | 'destek' | 'sgk') => {
    if (!activeSchoolId) return
    try {
      await downloadSkillDocument({
        school_id: activeSchoolId,
        kind,
        placement_id: kind === 'sozlesme' ? docPlacement || undefined : undefined,
        year: period.year(),
        month: period.month() + 1,
        filename:
          kind === 'sozlesme'
            ? 'beceri-sozlesme.xlsx'
            : kind === 'devam'
              ? `beceri-devam-${period.format('YYYY-MM')}.xlsx`
              : kind === 'destek'
                ? `beceri-devlet-katkisi-${period.format('YYYY-MM')}.xlsx`
                : 'beceri-sgk.xlsx',
      })
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  return (
    <AppLayout title="İşletmede Beceri Eğitimi">
      <Typography.Paragraph type="secondary">
        {activeSchool?.name || 'Okul'} için işletmede beceri eğitimi. Sözleşme ve devam çizelgesi buradan çıkar.
        Devlet katkısı tutarını yürürlükteki meblağa göre siz yazarsınız. SGK işe giriş ve işten çıkış listesi hazırlanır;
        bildirimin kendisi SGK’ya sizin tarafınızdan yapılır, burada bildirildi diye işaretlenir.
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'businesses',
            label: 'İşletmeler',
            children: (
              <>
                {canCreate && (
                  <Button icon={<PlusOutlined />} type="primary" style={{ marginBottom: 12 }} onClick={() => openBusiness()}>
                    İşletme ekle
                  </Button>
                )}
                <Table
                  rowKey="id"
                  size="small"
                  loading={loading}
                  dataSource={businesses}
                  pagination={false}
                  columns={[
                    { title: 'İşletme', dataIndex: 'name' },
                    { title: 'Alan', dataIndex: 'field_name', render: (v) => v || '—' },
                    { title: 'Usta öğretici', dataIndex: 'master_name', render: (v) => v || '—' },
                    { title: 'SGK işyeri', dataIndex: 'sgk_workplace_no', render: (v) => v || '—' },
                    { title: 'Telefon', dataIndex: 'phone', render: (v) => v || '—' },
                    {
                      title: '',
                      width: 90,
                      render: (_, row) => (
                        <Space>
                          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => openBusiness(row)} />}
                          {canDelete && (
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                modal.confirm({
                                  title: 'İşletme silinsin mi?',
                                  okText: 'Sil',
                                  cancelText: 'Vazgeç',
                                  onOk: async () => {
                                    try {
                                      await deleteSkillBusiness(row.id)
                                      message.success('İşletme silindi')
                                      await load()
                                    } catch (err) {
                                      message.error(getErrorMessage(err))
                                    }
                                  },
                                })
                              }
                            />
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'placements',
            label: 'Yerleştirme',
            children: (
              <>
                {canCreate && (
                  <Button icon={<PlusOutlined />} type="primary" style={{ marginBottom: 12 }} onClick={() => openPlacement()}>
                    Öğrenci yerleştir
                  </Button>
                )}
                <Table
                  rowKey="id"
                  size="small"
                  loading={loading}
                  dataSource={placements}
                  pagination={false}
                  columns={[
                    { title: 'Öğrenci', render: (_, row) => person(row.Student) },
                    { title: 'Sınıf', render: (_, row) => classOf(row.Student) },
                    { title: 'İşletme', render: (_, row) => row.Business?.name || '—' },
                    { title: 'Koordinatör', render: (_, row) => person(row.Coordinator) || '—' },
                    { title: 'Başlangıç', dataIndex: 'start_date', render: (v) => v || '—' },
                    { title: 'Bitiş', dataIndex: 'end_date', render: (v) => v || '—' },
                    { title: 'Sözleşme', dataIndex: 'contract_no', render: (v) => v || '—' },
                    {
                      title: 'Durum',
                      dataIndex: 'status',
                      render: (v) => STATUS_OPTIONS.find((o) => o.value === v)?.label || v,
                    },
                    {
                      title: '',
                      width: 90,
                      render: (_, row) => (
                        <Space>
                          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => openPlacement(row)} />}
                          {canDelete && (
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                modal.confirm({
                                  title: 'Yerleştirme silinsin mi?',
                                  okText: 'Sil',
                                  cancelText: 'Vazgeç',
                                  onOk: async () => {
                                    try {
                                      await deleteSkillPlacement(row.id)
                                      message.success('Yerleştirme silindi')
                                      await load()
                                    } catch (err) {
                                      message.error(getErrorMessage(err))
                                    }
                                  },
                                })
                              }
                            />
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'support',
            label: 'Devlet katkısı',
            children: (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  <DatePicker picker="month" value={period} onChange={(value) => value && setPeriod(value)} allowClear={false} />
                  {canCreate && (
                    <Button
                      onClick={async () => {
                        if (!activeSchoolId) return
                        try {
                          const created = await generateSkillSupports(activeSchoolId, period.year(), period.month() + 1)
                          message.success(created ? `${created} kayıt açıldı` : 'Bu ay zaten hazır')
                          await load()
                        } catch (err) {
                          message.error(getErrorMessage(err))
                        }
                      }}
                    >
                      Bu ayı oluştur
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={() => download('destek')}>
                    Listeyi indir
                  </Button>
                </Space>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Tutar, o ay işletmeye ödenen devlet katkısıdır. Yürürlükteki meblağı siz yazın.
                </Typography.Paragraph>
                <Table
                  rowKey="id"
                  size="small"
                  loading={loading}
                  dataSource={supports}
                  pagination={false}
                  columns={[
                    { title: 'Öğrenci', render: (_, row) => person(row.SkillPlacement?.Student) },
                    { title: 'İşletme', render: (_, row) => row.SkillPlacement?.Business?.name || '—' },
                    {
                      title: 'Gün',
                      dataIndex: 'work_days',
                      width: 110,
                      render: (v, row) => (
                        <InputNumber
                          min={0}
                          max={31}
                          defaultValue={v}
                          key={`${row.id}-d-${v}`}
                          disabled={!canUpdate}
                          onBlur={(e) => {
                            const next = Number((e.target as HTMLInputElement).value)
                            if (!Number.isFinite(next) || next === v) return
                            void updateSkillSupport(row.id, { work_days: next }).then(load).catch((err) => message.error(getErrorMessage(err)))
                          }}
                        />
                      ),
                    },
                    {
                      title: 'Tutar',
                      dataIndex: 'amount',
                      width: 140,
                      render: (v, row) => (
                        <InputNumber
                          min={0}
                          defaultValue={v == null || v === '' ? undefined : Number(v)}
                          key={`${row.id}-a-${v ?? ''}`}
                          disabled={!canUpdate}
                          addonAfter="TL"
                          onBlur={(e) => {
                            const raw = (e.target as HTMLInputElement).value.trim()
                            const next = raw === '' ? null : Number(raw)
                            const current = v == null || v === '' ? null : Number(v)
                            if (next != null && !Number.isFinite(next)) return
                            if (next === current) return
                            void updateSkillSupport(row.id, { amount: next }).then(load).catch((err) => message.error(getErrorMessage(err)))
                          }}
                        />
                      ),
                    },
                    {
                      title: 'Ödendi',
                      dataIndex: 'status',
                      width: 90,
                      render: (v, row) => (
                        <Switch
                          checked={v === 'odendi'}
                          disabled={!canUpdate}
                          onChange={(checked) => {
                            void updateSkillSupport(row.id, { status: checked ? 'odendi' : 'bekliyor' })
                              .then(load)
                              .catch((err) => message.error(getErrorMessage(err)))
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'sgk',
            label: 'SGK',
            children: (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  {canCreate && (
                    <Button
                      type="primary"
                      onClick={async () => {
                        if (!activeSchoolId) return
                        try {
                          const created = await prepareSkillSgk(activeSchoolId)
                          message.success(created ? `${created} bildirim hazırlandı` : 'Eksik bildirim yok')
                          await load()
                        } catch (err) {
                          message.error(getErrorMessage(err))
                        }
                      }}
                    >
                      Eksik bildirimleri hazırla
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={() => download('sgk')}>
                    SGK listesini indir
                  </Button>
                </Space>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Aktif yerleştirmeye işe giriş, biten yerleştirmeye işten çıkış satırı açılır. İş kazası ve meslek hastalığı bildirimi bu listedeki tarihle takip edilir.
                </Typography.Paragraph>
                <Table
                  rowKey="id"
                  size="small"
                  loading={loading}
                  dataSource={notices}
                  pagination={false}
                  columns={[
                    { title: 'Öğrenci', render: (_, row) => person(row.SkillPlacement?.Student) },
                    { title: 'İşletme', render: (_, row) => row.SkillPlacement?.Business?.name || '—' },
                    { title: 'SGK işyeri', render: (_, row) => row.SkillPlacement?.Business?.sgk_workplace_no || '—' },
                    { title: 'Bildirim', dataIndex: 'kind', render: (v) => (v === 'cikis' ? 'İşten çıkış' : 'İşe giriş') },
                    { title: 'Tarih', dataIndex: 'notice_date', render: (v) => v || '—' },
                    {
                      title: 'Referans',
                      dataIndex: 'sgk_ref',
                      render: (v, row) => (
                        <Input
                          size="small"
                          defaultValue={v || ''}
                          key={`${row.id}-${v || ''}`}
                          disabled={!canUpdate}
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next === (v || '')) return
                            void updateSkillSgk(row.id, { sgk_ref: next || null }).then(load).catch((err) => message.error(getErrorMessage(err)))
                          }}
                        />
                      ),
                    },
                    {
                      title: 'Bildirildi',
                      dataIndex: 'status',
                      render: (v, row) => (
                        <Switch
                          checked={v === 'bildirildi'}
                          disabled={!canUpdate}
                          onChange={(checked) => {
                            void updateSkillSgk(row.id, { status: checked ? 'bildirildi' : 'taslak' })
                              .then(load)
                              .catch((err) => message.error(getErrorMessage(err)))
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'docs',
            label: 'Evraklar',
            children: (
              <Space direction="vertical" size="middle">
                <Space wrap>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Yerleştirme seçin"
                    style={{ minWidth: 280 }}
                    value={docPlacement ?? undefined}
                    onChange={setDocPlacement}
                    options={placements.map((row) => ({
                      value: row.id,
                      label: `${person(row.Student)} — ${row.Business?.name || ''}`,
                    }))}
                  />
                  <Button icon={<DownloadOutlined />} disabled={!docPlacement} onClick={() => download('sozlesme')}>
                    Sözleşme özeti
                  </Button>
                </Space>
                <Space wrap>
                  <DatePicker picker="month" value={period} onChange={(value) => value && setPeriod(value)} allowClear={false} />
                  <Button icon={<DownloadOutlined />} onClick={() => download('devam')}>
                    Aylık devam çizelgesi
                  </Button>
                </Space>
                <Typography.Text type="secondary">
                  Devam çizelgesi boş gün hücreleriyle iner; işletmedeki devam bu çizelgeye işlenir. Devlet katkısı ve SGK listeleri kendi sekmelerinden de iner.
                </Typography.Text>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingBusiness ? 'İşletmeyi düzenle' : 'İşletme ekle'}
        open={businessOpen}
        onCancel={() => setBusinessOpen(false)}
        onOk={() => businessForm.submit()}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={businessForm} layout="vertical" onFinish={saveBusiness}>
          <Form.Item name="name" label="İşletme adı" rules={[{ required: true, message: 'Ad gerekli' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="field_name" label="Meslek alanı">
            <Input />
          </Form.Item>
          <Form.Item name="master_name" label="Usta öğretici">
            <Input />
          </Form.Item>
          <Form.Item name="contact_name" label="İşletme yetkilisi">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Telefon">
            <Input />
          </Form.Item>
          <Form.Item name="tax_no" label="Vergi no">
            <Input />
          </Form.Item>
          <Form.Item name="sgk_workplace_no" label="SGK işyeri sicil no">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Adres">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPlacement ? 'Yerleştirmeyi düzenle' : 'Öğrenci yerleştir'}
        open={placementOpen}
        onCancel={() => setPlacementOpen(false)}
        onOk={() => placementForm.submit()}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
        width={640}
      >
        <Form form={placementForm} layout="vertical" onFinish={savePlacement}>
          <Form.Item name="student_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçin' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name} ${s.class_level || ''}/${s.section || ''}` }))}
            />
          </Form.Item>
          <Form.Item name="business_id" label="İşletme" rules={[{ required: true, message: 'İşletme seçin' }]}>
            <Select showSearch optionFilterProp="label" options={businesses.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="teacher_id" label="Koordinatör öğretmen">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Space wrap>
            <Form.Item name="start_date" label="Başlangıç">
              <DatePicker />
            </Form.Item>
            <Form.Item name="end_date" label="Bitiş">
              <DatePicker />
            </Form.Item>
            <Form.Item name="weekly_days" label="Haftalık gün">
              <InputNumber min={1} max={6} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="contract_no" label="Sözleşme no">
              <Input />
            </Form.Item>
            <Form.Item name="contract_date" label="Sözleşme tarihi">
              <DatePicker />
            </Form.Item>
            <Form.Item name="academic_year" label="Eğitim yılı">
              <Input placeholder="2026-2027" />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="Durum">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
