import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Collapse, DatePicker, Dropdown, Empty, Form, Input, Modal, Select, Space, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { SortableTable } from '../components/SortableTable'
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
  TagOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { PersonnelDepartureModal } from '../components/PersonnelDepartureModal'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  createTeacher,
  deleteTeacher,
  downloadTeacherDocument,
  listTeachers,
  updateTeacher,
} from '../api/teachers'
import type { TeacherDocumentType } from '../api/teachers'
import {
  createPersonnelCategory,
  deletePersonnelCategory,
  listPersonnelCategories,
  updatePersonnelCategory,
} from '../api/personnelCategories'
import { getErrorMessage } from '../api/client'
import type { Teacher } from '../types/teacher'
import type { PersonnelCategory } from '../types/personnelCategory'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { downloadBlob } from '../utils/download'
import { addSalaryFormStarter } from '../utils/salaryFormAutoEntry'
import { personNameSorter, SORT_AZ } from '../utils/tableSort'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface CategoryFormValues {
  name: string
}

interface StaffFormValues {
  personnel_category_id: number
  first_name: string
  last_name: string
  school_id?: number | null
  personnel_no?: string
  national_id?: string
  title_branch?: string
  working_institution?: string
  first_duty_date?: Dayjs | null
  add_to_salary_form?: boolean
}

export function OtherPersonnelPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const { schools, activeSchoolId } = useActiveSchool()
  const [categories, setCategories] = useState<PersonnelCategory[]>([])
  const [staff, setStaff] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PersonnelCategory | null>(null)
  const [staffOpen, setStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Teacher | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [departureTarget, setDepartureTarget] = useState<Teacher | null>(null)
  const [categoryForm] = Form.useForm<CategoryFormValues>()
  const [staffForm] = Form.useForm<StaffFormValues>()

  const canCreate = hasPermission('teachers.create')
  const canUpdate = hasPermission('teachers.update')
  const canDelete = hasPermission('teachers.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catRows, staffRows] = await Promise.all([
        listPersonnelCategories(),
        listTeachers({ scope: 'staff' }),
      ])
      setCategories(catRows)
      setStaff(staffRows)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    if (!q) return staff
    return staff.filter((t) => {
      const fullName = `${t.first_name} ${t.last_name}`.toLocaleLowerCase('tr-TR')
      return (
        fullName.includes(q) ||
        (t.personnel_no || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.national_id || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.title_branch || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [staff, searchQuery])

  const grouped = useMemo(() => {
    const byId = new Map<number, Teacher[]>()
    const uncategorized: Teacher[] = []
    for (const person of filteredStaff) {
      if (person.personnel_category_id) {
        const list = byId.get(person.personnel_category_id) || []
        list.push(person)
        byId.set(person.personnel_category_id, list)
      } else {
        uncategorized.push(person)
      }
    }
    return { byId, uncategorized }
  }, [filteredStaff])

  const schoolName = (schoolId: number | null) => schools.find((s) => s.id === schoolId)?.name || '—'

  const openCreateCategory = () => {
    setEditingCategory(null)
    categoryForm.resetFields()
    setCategoryOpen(true)
  }

  const openEditCategory = (row: PersonnelCategory) => {
    setEditingCategory(row)
    categoryForm.setFieldsValue({ name: row.name })
    setCategoryOpen(true)
  }

  const onSaveCategory = async (values: CategoryFormValues) => {
    setSubmitting(true)
    try {
      if (editingCategory) {
        await updatePersonnelCategory(editingCategory.id, { name: values.name })
        message.success('Kategori güncellendi')
      } else {
        await createPersonnelCategory({ name: values.name })
        message.success('Kategori eklendi')
      }
      setCategoryOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteCategory = (row: PersonnelCategory) => {
    modal.confirm({
      title: 'Kategoriyi sil',
      content: `"${row.name}" kategorisini silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deletePersonnelCategory(row.id)
          message.success('Kategori silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const openCreateStaff = (categoryId?: number) => {
    setEditingStaff(null)
    staffForm.resetFields()
    const id = categoryId ?? categories[0]?.id
    setDefaultCategoryId(id ?? null)
    staffForm.setFieldsValue({
      personnel_category_id: id,
      add_to_salary_form: true,
      school_id: activeSchoolId ?? undefined,
    })
    setStaffOpen(true)
  }

  const openEditStaff = (person: Teacher) => {
    setEditingStaff(person)
    staffForm.setFieldsValue({
      personnel_category_id: person.personnel_category_id || undefined,
      first_name: person.first_name,
      last_name: person.last_name,
      school_id: person.school_id,
      personnel_no: person.personnel_no || undefined,
      national_id: person.national_id || undefined,
      title_branch: person.title_branch || undefined,
      working_institution: person.working_institution || undefined,
      first_duty_date: person.first_duty_date ? dayjs(person.first_duty_date) : null,
    })
    setStaffOpen(true)
  }

  const onSaveStaff = async (values: StaffFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const { add_to_salary_form, first_duty_date, ...rest } = values
      const payload = {
        ...rest,
        personnel_category_id: values.personnel_category_id,
        first_duty_date: first_duty_date ? first_duty_date.format('YYYY-MM-DD') : null,
      }
      if (editingStaff) {
        await updateTeacher(editingStaff.id, payload)
        message.success('Personel güncellendi')
      } else {
        const created = await createTeacher(session.user.tenant_id, payload)
        message.success('Personel eklendi')
        if (add_to_salary_form) {
          const startDate = dayjs()
          try {
            await addSalaryFormStarter(startDate, {
              personnel_no: created.personnel_no || undefined,
              full_name: `${created.first_name} ${created.last_name}`,
              national_id: created.national_id || undefined,
              start_date: startDate.format('YYYY-MM-DD'),
            })
          } catch (err) {
            message.warning('Personel eklendi ancak maaş değişikliği formuna eklenemedi: ' + getErrorMessage(err))
          }
        }
      }
      setStaffOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDownloadDocument = async (person: Teacher, type: TeacherDocumentType) => {
    if (type === 'ayrilis') {
      setDepartureTarget(person)
      return
    }
    try {
      const blob = await downloadTeacherDocument(person.id, type)
      downloadBlob(blob, `${type}-${person.personnel_no || person.id}.docx`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onMoveToTeacher = (person: Teacher) => {
    modal.confirm({
      title: 'Öğretmene taşı',
      content: `"${person.first_name} ${person.last_name}" Diğer Personeller listesinden çıkarılıp Öğretmenler listesine taşınacak.`,
      okText: 'Taşı',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await updateTeacher(person.id, { personnel_category_id: null, personnel_type: 'ogretmen' })
          message.success('Personel Öğretmenler listesine taşındı')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onDeleteStaff = (person: Teacher) => {
    modal.confirm({
      title: 'Personeli sil',
      content: `"${person.first_name} ${person.last_name}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTeacher(person.id)
          message.success('Personel silindi')
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
        filteredStaff.map((p) => p.id),
        (id) => deleteTeacher(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'personel')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
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
    { title: 'T.C.', dataIndex: 'national_id', render: (v: string | null) => v || '—' },
    { title: 'Unvan', dataIndex: 'title_branch', render: (v: string | null) => v || '—' },
    {
      title: 'İlk başlama',
      dataIndex: 'first_duty_date',
      render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY') : '—'),
    },
    { title: 'Okul', render: (_: unknown, record) => schoolName(record.school_id) },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record) => (
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
              onClick={() => onMoveToTeacher(record)}
              title="Öğretmene taşı"
            />
          )}
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditStaff(record)} title="Düzenle" />
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteStaff(record)} title="Sil" />
          )}
        </Space>
      ),
    },
  ]

  const collapseItems = [
    ...categories.map((cat) => {
      const rows = grouped.byId.get(cat.id) || []
      return {
        key: String(cat.id),
        label: (
          <Space>
            <TagOutlined />
            <span>{cat.name}</span>
            <Typography.Text type="secondary">({rows.length})</Typography.Text>
          </Space>
        ),
        extra: (
          <Space onClick={(e) => e.stopPropagation()}>
            {canCreate && (
              <Button size="small" icon={<PlusOutlined />} onClick={() => openCreateStaff(cat.id)}>
                Personel ekle
              </Button>
            )}
            {canUpdate && (
              <Button size="small" icon={<EditOutlined />} onClick={() => openEditCategory(cat)} title="Kategoriyi düzenle" />
            )}
            {canDelete && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDeleteCategory(cat)}
                title="Kategoriyi sil"
              />
            )}
          </Space>
        ),
        children: (
          <SortableTable
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={false}
            locale={{ emptyText: 'Bu kategoride personel yok' }}
          />
        ),
      }
    }),
    ...(grouped.uncategorized.length > 0
      ? [
          {
            key: 'uncategorized',
            label: (
              <Space>
                <span>Kategorisiz</span>
                <Typography.Text type="secondary">({grouped.uncategorized.length})</Typography.Text>
              </Space>
            ),
            children: (
              <SortableTable
                rowKey="id"
                size="small"
                loading={loading}
                columns={columns}
                dataSource={grouped.uncategorized}
                pagination={false}
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Diğer Personeller">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Diğer Personeller
          </Typography.Title>
          <Space wrap>
            {canDelete && filteredStaff.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredStaff.length})
              </Button>
            )}
            {canCreate && (
              <Button icon={<TagOutlined />} onClick={openCreateCategory}>
                Kategori ekle
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateStaff()} disabled={categories.length === 0}>
                Personel ekle
              </Button>
            )}
          </Space>
        </Space>

        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Ad, sicil no, T.C. veya unvan ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 360 }}
        />

        {categories.length === 0 && !loading ? (
          <Empty description="Önce bir kategori ekleyin (ör. Aşçı, Hizmetli, Memur)" />
        ) : (
          <Collapse defaultActiveKey={categories.map((c) => String(c.id))} items={collapseItems} />
        )}

        <Modal
          title={editingCategory ? 'Kategoriyi düzenle' : 'Yeni kategori'}
          open={categoryOpen}
          onCancel={() => setCategoryOpen(false)}
          onOk={() => categoryForm.submit()}
          confirmLoading={submitting}
          destroyOnHidden
          okText="Kaydet"
        >
          <Form form={categoryForm} layout="vertical" onFinish={onSaveCategory}>
            <Form.Item
              name="name"
              label="Kategori adı"
              rules={[{ required: true, message: 'Kategori adı zorunludur' }]}
            >
              <Input placeholder="Örn. Aşçı, Hizmetli, Güvenlik" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={editingStaff ? 'Personeli düzenle' : 'Yeni personel'}
          open={staffOpen}
          onCancel={() => setStaffOpen(false)}
          onOk={() => staffForm.submit()}
          confirmLoading={submitting}
          destroyOnHidden
          width={640}
          okText="Kaydet"
        >
          <Form form={staffForm} layout="vertical" onFinish={onSaveStaff} initialValues={{ personnel_category_id: defaultCategoryId }}>
            <Form.Item
              name="personnel_category_id"
              label="Kategori"
              rules={[{ required: true, message: 'Kategori seçin' }]}
            >
              <Select
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Kategori seçin"
              />
            </Form.Item>
            <Space.Compact block style={{ width: '100%' }}>
              <Form.Item name="first_name" label="Ad" rules={[{ required: true, message: 'Ad zorunludur' }]} style={{ flex: 1, marginRight: 8 }}>
                <Input />
              </Form.Item>
              <Form.Item name="last_name" label="Soyad" rules={[{ required: true, message: 'Soyad zorunludur' }]} style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item name="school_id" label="Okul">
              <Select
                allowClear
                placeholder="Okul seçin"
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Space.Compact block style={{ width: '100%' }}>
              <Form.Item name="personnel_no" label="Sicil No" style={{ flex: 1, marginRight: 8 }}>
                <Input />
              </Form.Item>
              <Form.Item name="national_id" label="T.C. Kimlik No" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item name="title_branch" label="Unvan / Görev">
              <Input placeholder="Örn. Aşçı, Hizmetli" />
            </Form.Item>
            <Form.Item name="working_institution" label="Görev yeri">
              <Input />
            </Form.Item>
            <Form.Item
              name="first_duty_date"
              label="İşe ilk başlama tarihi"
              tooltip="Kamu görevine ilk başladığı tarih"
            >
              <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
            </Form.Item>
            {!editingStaff && (
              <Form.Item name="add_to_salary_form" valuePropName="checked">
                <Checkbox>
                  Maaş Değişikliği Bildirim Formuna ekle (C - Başlayan Personel). İşaret kaldırılırsa
                  görevlendirme kabul edilir.
                </Checkbox>
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Personelleri toplu sil"
        description={`Filtreye uyan ${filteredStaff.length} personel kaydı silinecek.`}
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
