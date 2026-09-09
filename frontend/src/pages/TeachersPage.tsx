import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Col,
  Collapse,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createTeacher,
  deleteTeacher,
  downloadTeacherDocument,
  exportTeachers,
  fetchUpcomingPromotions,
  listTeachers,
  updateTeacher,
} from '../api/teachers'
import type { TeacherDocumentType, UpcomingPromotion } from '../api/teachers'
import { listSchools } from '../api/schools'
import { getErrorMessage } from '../api/client'
import type { Teacher, TeacherPayload } from '../types/teacher'
import type { School } from '../types/school'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

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
  personnel_type?: string
}

export function TeachersPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [promotions, setPromotions] = useState<UpcomingPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<TeacherFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherData, schoolData, promotionData] = await Promise.all([
        listTeachers(),
        listSchools(),
        fetchUpcomingPromotions(90).catch(() => []),
      ])
      setTeachers(teacherData)
      setSchools(schoolData)
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
    form.setFieldsValue({ personnel_type: 'ogretmen' })
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
      personnel_type: teacher.personnel_type,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: TeacherFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload: TeacherPayload = {
        ...values,
        degree_rank_date: values.degree_rank_date ? values.degree_rank_date.toISOString() : null,
        service_start_date: values.service_start_date ? values.service_start_date.format('YYYY-MM-DD') : null,
      }

      if (editing) {
        await updateTeacher(editing.id, payload)
        message.success('Öğretmen güncellendi')
      } else {
        await createTeacher(session.user.tenant_id, payload)
        message.success('Öğretmen oluşturuldu')
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

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportTeachers({
        format: exportFormat,
        filters: search.trim() ? { q: search.trim() } : undefined,
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

  const onDownloadDocument = async (teacher: Teacher, type: TeacherDocumentType) => {
    try {
      const blob = await downloadTeacherDocument(teacher.id, type)
      downloadBlob(blob, `${type}-${teacher.personnel_no || teacher.id}.pdf`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<Teacher> = [
    {
      title: 'Ad soyad',
      render: (_: unknown, record) => `${record.first_name} ${record.last_name}`,
    },
    { title: 'Sicil No', dataIndex: 'personnel_no', render: (v: string | null) => v || '—' },
    { title: 'Unvan / Branş', dataIndex: 'title_branch', render: (v: string | null) => v || '—' },
    {
      title: 'Personel Tipi',
      dataIndex: 'personnel_type',
      render: (v: string) =>
        ({ ogretmen: 'Öğretmen', memur: 'Memur', isci: 'İşçi', typ: 'TYP Personeli' })[v] || v,
    },
    { title: 'Okul', render: (_: unknown, record) => schoolName(record.school_id) },
    { title: 'Şehir', dataIndex: 'city', render: (v: string | null) => v || '—' },
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
                { key: 'ayrilis', label: 'Ayrılış Yazısı' },
              ],
              onClick: ({ key }) => void onDownloadDocument(record, key as TeacherDocumentType),
            }}
          >
            <Button size="small" icon={<FileTextOutlined />} title="Evrak indir" />
          </Dropdown>
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
      <div style={{ maxWidth: 1100 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Öğretmenler
          </Typography.Title>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
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

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTeachers}
          pagination={{ pageSize: 20 }}
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
                  <Table
                    size="small"
                    rowKey="teacher_id"
                    pagination={false}
                    dataSource={promotions}
                    columns={[
                      { title: 'Personel', dataIndex: 'teacher_name' },
                      { title: 'Mevcut Derece/Kademe', render: (_, r) => `${r.degree || '—'} / ${r.rank || '—'}` },
                      { title: 'Sonraki İlerleme Tarihi', dataIndex: 'next_promotion_date' },
                      {
                        title: 'Kalan Gün',
                        dataIndex: 'days_remaining',
                        render: (v: number) => <Tag color={v <= 30 ? 'red' : 'blue'}>{v} gün</Tag>,
                      },
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
            <Col span={12}>
              <Form.Item name="school_id" label="Okul">
                <Select
                  allowClear
                  placeholder="Okul seçin"
                  options={schools.map((school) => ({ value: school.id, label: school.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="personnel_type" label="Personel Tipi" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'ogretmen', label: 'Öğretmen' },
                    { value: 'memur', label: 'Memur' },
                    { value: 'isci', label: 'İşçi' },
                    { value: 'typ', label: 'TYP Personeli' },
                  ]}
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
          <Form.Item name="school_principal" label="Okul Müdürü">
            <Input />
          </Form.Item>
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
    </AppLayout>
  )
}
