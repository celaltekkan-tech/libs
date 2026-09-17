import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Col, Collapse, DatePicker, Dropdown, Form, Input, InputNumber, Modal, Row, Select, Space, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { MebbisImportModal } from '../components/MebbisImportModal'
import { PersonnelDepartureModal } from '../components/PersonnelDepartureModal'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  applyPromotion,
  createTeacher,
  deleteTeacher,
  downloadPromotionForm,
  downloadTeacherDocument,
  exportTeachers,
  fetchUpcomingPromotions,
  listTeachers,
  updateTeacher,
} from '../api/teachers'
import type { TeacherDocumentType, UpcomingPromotion } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { ApplyPromotionPayload, Teacher, TeacherPayload } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { listPersonnelCategories } from '../api/personnelCategories'
import type { PersonnelCategory } from '../types/personnelCategory'
import { tablePagination } from '../utils/tablePagination'
import { personNameSorter, sorterBy, SORT_AZ } from '../utils/tableSort'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { addSalaryFormStarter } from '../utils/salaryFormAutoEntry'

interface PromotionFormValues {
  new_degree: string
  new_rank: string
  new_degree_rank_date: Dayjs
  note?: string
}

interface TeacherFormValues {
  first_name: string
  last_name: string
  school_id?: number | null
  personnel_no?: string
  national_id?: string
  city?: string
  district?: string
  last_graduated_school?: string
  class_level?: string
  title_branch?: string
  working_institution?: string
  degree?: string
  pension_degree?: string
  rank?: string
  degree_rank_date?: Dayjs | null
  school_principal?: string
  service_start_date?: Dayjs | null
  annual_leave_quota?: number | null
  union_name?: string
  add_to_salary_form?: boolean
}

export function TeachersPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const { schools, activeSchoolId, activeSchool } = useActiveSchool()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [promotions, setPromotions] = useState<UpcomingPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<TeacherFormValues>()
  const [promotionModalOpen, setPromotionModalOpen] = useState(false)
  const [promotionTarget, setPromotionTarget] = useState<UpcomingPromotion | null>(null)
  const [promotionSubmitting, setPromotionSubmitting] = useState(false)
  const [promotionForm] = Form.useForm<PromotionFormValues>()
  const [moveTarget, setMoveTarget] = useState<Teacher | null>(null)
  const [moveCategoryId, setMoveCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<PersonnelCategory[]>([])
  const [moving, setMoving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [departureTarget, setDepartureTarget] = useState<Teacher | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherData, promotionData] = await Promise.all([
        listTeachers({ scope: 'teachers' }),
        fetchUpcomingPromotions(90).catch(() => []),
      ])
      setTeachers(teacherData)
      setPromotions(promotionData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const schoolName = (schoolId: number | null) => schools.find((s) => s.id === schoolId)?.name || '—'

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return teachers
    return teachers.filter((t) => {
      const fullName = `${t.first_name} ${t.last_name}`.toLocaleLowerCase('tr-TR')
      const reverseName = `${t.last_name} ${t.first_name}`.toLocaleLowerCase('tr-TR')
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        t.first_name.toLocaleLowerCase('tr-TR').includes(q) ||
        t.last_name.toLocaleLowerCase('tr-TR').includes(q) ||
        (t.personnel_no || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.national_id || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [teachers, search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ add_to_salary_form: true })
    setModalOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    form.setFieldsValue({
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      school_id: teacher.school_id,
      personnel_no: teacher.personnel_no || undefined,
      national_id: teacher.national_id || undefined,
      city: teacher.city || undefined,
      district: teacher.district || undefined,
      last_graduated_school: teacher.last_graduated_school || undefined,
      class_level: teacher.class_level || undefined,
      title_branch: teacher.title_branch || undefined,
      working_institution: teacher.working_institution || undefined,
      degree: teacher.degree || undefined,
      pension_degree: teacher.pension_degree || undefined,
      rank: teacher.rank || undefined,
      degree_rank_date: teacher.degree_rank_date ? dayjs(teacher.degree_rank_date) : null,
      school_principal: teacher.school_principal || undefined,
      service_start_date: teacher.service_start_date ? dayjs(teacher.service_start_date) : null,
      annual_leave_quota: teacher.annual_leave_quota,
      union_name: teacher.union_name || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: TeacherFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const { add_to_salary_form, ...rest } = values
      const payload: TeacherPayload = {
        ...rest,
        personnel_type: 'ogretmen',
        personnel_category_id: null,
        degree_rank_date: values.degree_rank_date ? values.degree_rank_date.toISOString() : null,
        service_start_date: values.service_start_date ? values.service_start_date.format('YYYY-MM-DD') : null,
      }

      if (editing) {
        await updateTeacher(editing.id, payload)
        message.success('Öğretmen güncellendi')
      } else {
        const created = await createTeacher(session.user.tenant_id, payload)
        message.success('Öğretmen oluşturuldu')
        if (add_to_salary_form) {
          const startDate = values.service_start_date || dayjs()
          try {
            await addSalaryFormStarter(startDate, {
              personnel_no: created.personnel_no || undefined,
              full_name: `${created.first_name} ${created.last_name}`,
              national_id: created.national_id || undefined,
              start_date: startDate.format('YYYY-MM-DD'),
            })
          } catch (err) {
            message.warning('Öğretmen oluşturuldu ancak maaş değişikliği formuna eklenemedi: ' + getErrorMessage(err))
          }
        }
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (teacher: Teacher) => {
    modal.confirm({
      title: 'Öğretmeni sil',
      content: `"${teacher.first_name} ${teacher.last_name}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTeacher(teacher.id)
          message.success('Öğretmen silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(
        filteredTeachers.map((t) => t.id),
        (id) => deleteTeacher(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'öğretmen')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportTeachers({
        format: exportFormat,
        filters: {
          scope: 'teachers',
          ...(search.trim() ? { q: search.trim() } : {}),
        },
      })
      downloadBlob(blob, exportFilename('ogretmenler', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const canCreate = hasPermission('teachers.create')
  const canUpdate = hasPermission('teachers.update')
  const canDelete = hasPermission('teachers.delete')

  const openMove = async (teacher: Teacher) => {
    try {
      const rows = await listPersonnelCategories()
      setCategories(rows)
      setMoveTarget(teacher)
      setMoveCategoryId(rows[0]?.id ?? null)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onMove = async () => {
    if (!moveTarget || !moveCategoryId) {
      message.warning('Kategori seçin')
      return
    }
    setMoving(true)
    try {
      await updateTeacher(moveTarget.id, { personnel_category_id: moveCategoryId })
      message.success('Personel Diğer Personeller listesine taşındı')
      setMoveTarget(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setMoving(false)
    }
  }

  const onDownloadDocument = async (teacher: Teacher, type: TeacherDocumentType) => {
    if (type === 'ayrilis') {
      setDepartureTarget(teacher)
      return
    }
    try {
      const blob = await downloadTeacherDocument(teacher.id, type)
      downloadBlob(blob, `${type}-${teacher.personnel_no || teacher.id}.docx`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const openApplyPromotion = (promotion: UpcomingPromotion) => {
    setPromotionTarget(promotion)
    promotionForm.setFieldsValue({
      new_degree: promotion.degree || undefined,
      new_rank: promotion.rank || undefined,
      new_degree_rank_date: dayjs(promotion.next_promotion_date),
      note: undefined,
    })
    setPromotionModalOpen(true)
  }

  const onApplyPromotion = async (values: PromotionFormValues) => {
    if (!promotionTarget) return
    setPromotionSubmitting(true)
    try {
      const payload: ApplyPromotionPayload = {
        new_degree: values.new_degree,
        new_rank: values.new_rank,
        new_degree_rank_date: values.new_degree_rank_date.toISOString(),
        note: values.note || null,
      }
      const { history } = await applyPromotion(promotionTarget.teacher_id, payload)
      message.success('Terfi/kademe ilerlemesi uygulandı')
      setPromotionModalOpen(false)
      void load()
      try {
        const blob = await downloadPromotionForm(history.id)
        downloadBlob(blob, `terfi-formu-${promotionTarget.personnel_no || promotionTarget.teacher_id}.xlsx`)
      } catch (err) {
        message.warning('Terfi kaydedildi ancak form indirilemedi: ' + getErrorMessage(err))
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setPromotionSubmitting(false)
    }
  }

  const columns: ColumnsType<Teacher> = [
    {
      title: 'Ad soyad',
      sorter: personNameSorter<Teacher>(),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => `${record.first_name} ${record.last_name}`,
    },
    { title: 'Sicil No', dataIndex: 'personnel_no', render: (v: string | null) => v || '—' },
    { title: 'Unvan / Branş', dataIndex: 'title_branch', render: (v: string | null) => v || '—' },
    {
      title: 'Okul',
      sorter: sorterBy((r: Teacher) => schoolName(r.school_id)),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => schoolName(record.school_id),
    },
    { title: 'Şehir', dataIndex: 'city', render: (v: string | null) => v || '—' },
    { title: 'Sendika', dataIndex: 'union_name', render: (v: string | null) => v || '—' },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record: Teacher) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'baslama', label: 'Göreve Başlama Yazısı' },
                { key: 'gorevlendirme', label: 'Görevlendirme Yazısı' },
                { key: 'ayrilis', label: 'Ayrılış Ver...' },
              ],
              onClick: ({ key }) => void onDownloadDocument(record, key as TeacherDocumentType),
            }}
          >
            <Button size="small" icon={<FileTextOutlined />} title="Evrak indir" />
          </Dropdown>
          {canUpdate && (
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={() => void openMove(record)}
              title="Diğer personele taşı"
            />
          )}
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Öğretmenler">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Öğretmenler
          </Typography.Title>
          <Space wrap>
            {canDelete && filteredTeachers.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredTeachers.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
            {canCreate && (
              <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
                MEBBİS'ten İçe Aktar
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Öğretmen
              </Button>
            )}
          </Space>
        </Space>

        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Ad, soyad, sicil no veya T.C. ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTeachers}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />

        {promotions.length > 0 && (
          <Collapse
            style={{ marginTop: 24 }}
            items={[
              {
                key: 'promotions',
                label: (
                  <Space>
                    <span>Yaklaşan Kademe İlerlemeleri (90 gün)</span>
                    <Tag color="orange">{promotions.length}</Tag>
                  </Space>
                ),
                children: (
                  <SortableTable
                    size="small"
                    rowKey="teacher_id"
                    pagination={false}
                    dataSource={promotions}
                    scroll={{ x: 'max-content' }}
                    columns={[
                      { title: 'Personel', dataIndex: 'teacher_name' },
                      { title: 'Mevcut Derece/Kademe', render: (_, r) => `${r.degree || '—'} / ${r.rank || '—'}` },
                      { title: 'Sonraki İlerleme Tarihi', dataIndex: 'next_promotion_date' },
                      {
                        title: 'Kalan Gün',
                        dataIndex: 'days_remaining',
                        render: (v: number) => <Tag color={v <= 30 ? 'red' : 'blue'}>{v} gün</Tag>,
                      },
                      ...(canUpdate
                        ? [
                            {
                              title: 'İşlem',
                              render: (_: unknown, record: UpcomingPromotion) => (
                                <Button size="small" onClick={() => openApplyPromotion(record)}>
                                  Terfiyi Uygula
                                </Button>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
      </div>

      <Modal
        title={editing ? 'Öğretmeni Düzenle' : 'Yeni Öğretmen'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_name" label="Ad" rules={[{ required: true, message: 'Ad zorunludur' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Soyad" rules={[{ required: true, message: 'Soyad zorunludur' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="school_id" label="Okul">
                <Select
                  allowClear
                  placeholder="Okul seçin"
                  options={schools.map((school) => ({ value: school.id, label: school.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_no" label="Sicil No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="national_id" label="TC Kimlik No">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="Şehir">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district" label="İlçe">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title_branch" label="Unvan / Branş">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="working_institution" label="Görev Yeri">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="degree" label="Derece">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rank" label="Kademe">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pension_degree" label="Emekli Sicil No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="degree_rank_date" label="Kademe Tarihi">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="last_graduated_school" label="Mezun Olunan Okul">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="class_level" label="Sınıf / Kademe">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="school_principal" label="Okul Müdürü">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="union_name" label="Sendika">
                <Input placeholder="Sendika adı (isteğe bağlı)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="service_start_date"
                label="İşe başlama tarihi"
                tooltip="Yıllık izin hakkının 657 sayılı DMK m.102'ye göre otomatik hesaplanabilmesi için kullanılır"
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="annual_leave_quota"
                label="Yıllık izin hakkı (gün, manuel override)"
                tooltip="Boş bırakılırsa işe başlama tarihine göre otomatik hesaplanır (10 yıla kadar 20 gün, üzeri 30 gün)"
              >
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {!editing && (
            <Form.Item name="add_to_salary_form" valuePropName="checked">
              <Checkbox>
                Maaş Değişikliği Bildirim Formuna ekle (C - Başlayan Personel). İşaret kaldırılırsa kurum
                içi görevlendirme kabul edilir.
              </Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Öğretmen Listesini Dışa Aktar"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        confirmLoading={submitting}
        okText="İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Biçim">
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV (.csv)' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            {search.trim()
              ? `Arama filtresi uygulanacak (${filteredTeachers.length} kayıt).`
              : 'Tüm öğretmenler dışa aktarılır.'}
          </Typography.Text>
        </Form>
      </Modal>

      <MebbisImportModal
        open={importOpen}
        schoolId={activeSchoolId}
        schoolName={activeSchool?.name}
        onCancel={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <Modal
        title={promotionTarget ? `Terfiyi Uygula — ${promotionTarget.teacher_name}` : 'Terfiyi Uygula'}
        open={promotionModalOpen}
        onCancel={() => setPromotionModalOpen(false)}
        onOk={() => promotionForm.submit()}
        confirmLoading={promotionSubmitting}
        okText="Uygula ve Formu İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={promotionForm} layout="vertical" onFinish={onApplyPromotion}>
          <Typography.Text type="secondary">
            Mevcut durum: {promotionTarget?.degree || '—'} / {promotionTarget?.rank || '—'}
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
          <Form.Item
            name="new_degree_rank_date"
            label="Terfi Tarihi"
            rules={[{ required: true, message: 'Zorunlu' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="note" label="Açıklama (isteğe bağlı)">
            <Input placeholder="Örn. 657 s. DMK 64-65. Md." />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Diğer personele taşı"
        open={Boolean(moveTarget)}
        onCancel={() => setMoveTarget(null)}
        onOk={() => void onMove()}
        confirmLoading={moving}
        okText="Taşı"
      >
        <Typography.Paragraph>
          {moveTarget
            ? `"${moveTarget.first_name} ${moveTarget.last_name}" öğretmen listesinden çıkarılıp seçilen kategoriye alınacak.`
            : null}
        </Typography.Paragraph>
        <Select
          style={{ width: '100%' }}
          placeholder="Kategori seçin"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={moveCategoryId ?? undefined}
          onChange={(v) => setMoveCategoryId(v)}
        />
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Öğretmenleri toplu sil"
        description={`Filtreye uyan ${filteredTeachers.length} öğretmen kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
      <PersonnelDepartureModal
        teacher={departureTarget}
        onClose={() => setDepartureTarget(null)}
        onDone={() => {
          setDepartureTarget(null)
          void load()
        }}
      />
    </AppLayout>
  )
}
