import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Typography, Upload } from 'antd'
import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { SchoolCatalogFields } from '../components/SchoolCatalogFields'
import { SortableTable } from '../components/SortableTable'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  createSchool,
  deleteSchool,
  deleteSchoolLogo,
  fetchSchoolLogoBlob,
  listSchools,
  updateSchool,
  uploadSchoolLogo,
} from '../api/schools'
import { getErrorMessage } from '../api/client'
import {
  FOREIGN_LANGUAGE_OPTIONS,
  SCHOOL_TYPE_LABELS,
  SCHOOL_CODE_RULES,
  type School,
  type SchoolPayload,
} from '../types/school'
import { getLicensePlan, canAssignSchoolCode } from '../constants/licensePlans'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'

type SchoolFormValues = SchoolPayload & {
  first_foreign_language?: string | null
  second_foreign_language?: string | null
}

function SchoolLogoThumb({ school }: { school: School }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!school.logo_url) return
    let alive = true
    let objectUrl: string | null = null
    void fetchSchoolLogoBlob(school.id)
      .then((blob) => {
        if (!alive || !blob.type.startsWith('image/')) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        /* logo yoksa sessiz */
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [school.id, school.logo_url])

  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }}
    />
  )
}

export function SchoolsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const { reload: reloadActiveSchools } = useActiveSchool()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [form] = Form.useForm<SchoolFormValues>()
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [pendingRemoveLogo, setPendingRemoveLogo] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const logoPreviewRef = useRef<string | null>(null)
  const logoLoadGen = useRef(0)

  const replaceLogoPreview = useCallback((url: string | null) => {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current)
    logoPreviewRef.current = url
    setLogoPreviewUrl(url)
  }, [])

  const clearLogoState = useCallback(() => {
    logoLoadGen.current += 1
    setPendingLogoFile(null)
    setPendingRemoveLogo(false)
    setLogoLoading(false)
    replaceLogoPreview(null)
  }, [replaceLogoPreview])

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current)
    }
  }, [])

  const loadSchoolLogo = useCallback(
    async (schoolId: number) => {
      const gen = ++logoLoadGen.current
      setLogoLoading(true)
      try {
        const blob = await fetchSchoolLogoBlob(schoolId)
        if (gen !== logoLoadGen.current) return
        if (!blob.type.startsWith('image/')) return
        replaceLogoPreview(URL.createObjectURL(blob))
      } catch {
        if (gen !== logoLoadGen.current) return
      } finally {
        if (gen === logoLoadGen.current) setLogoLoading(false)
      }
    },
    [replaceLogoPreview],
  )

  const onSelectLogo = (file: File) => {
    setPendingLogoFile(file)
    setPendingRemoveLogo(false)
    replaceLogoPreview(URL.createObjectURL(file))
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSchools(await listSchools())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const canCreate = hasPermission('schools.create')
  const canUpdate = hasPermission('schools.update')
  const canDelete = hasPermission('schools.delete')
  const canAssignCode = Boolean(
    session?.is_global_admin || session?.is_platform_admin || canAssignSchoolCode(session?.license?.plan),
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      school_type: 'lise',
      daily_period_count: 8,
      first_foreign_language: undefined,
      second_foreign_language: undefined,
    })
    clearLogoState()
    setModalOpen(true)
  }

  const openEdit = (school: School) => {
    setEditing(school)
    form.setFieldsValue({
      name: school.name,
      code: school.code,
      school_type: school.school_type,
      daily_period_count: school.daily_period_count,
      province_id: school.province_id ?? undefined,
      district_id: school.district_id ?? undefined,
      directory_school_id: school.directory_school_id ?? undefined,
      first_foreign_language: school.meta?.first_foreign_language || undefined,
      second_foreign_language: school.meta?.second_foreign_language || undefined,
    })
    clearLogoState()
    if (school.logo_url) void loadSchoolLogo(school.id)
    setModalOpen(true)
  }

  const onFinish = async (values: SchoolFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload: SchoolPayload = {
        name: values.name,
        school_type: values.school_type,
        daily_period_count: values.daily_period_count,
        province_id: values.province_id || null,
        district_id: values.district_id || null,
        directory_school_id: values.directory_school_id || null,
        meta: {
          ...(editing?.meta || {}),
          first_foreign_language: values.first_foreign_language || null,
          second_foreign_language: values.second_foreign_language || null,
        },
      }
      if (canAssignCode || values.code) payload.code = values.code
      let savedId: number
      if (editing) {
        await updateSchool(editing.id, payload)
        savedId = editing.id
      } else {
        const created = await createSchool(session.user.tenant_id, payload)
        savedId = created.id
      }
      if (pendingRemoveLogo && !pendingLogoFile) {
        try {
          await deleteSchoolLogo(savedId)
        } catch (logoErr) {
          message.warning(`Kayıt kaydedildi ancak logo kaldırılamadı: ${getErrorMessage(logoErr)}`)
          setModalOpen(false)
          clearLogoState()
          void load()
          void reloadActiveSchools()
          return
        }
      }
      if (pendingLogoFile) {
        try {
          await uploadSchoolLogo(savedId, pendingLogoFile)
        } catch (logoErr) {
          message.warning(`Kayıt kaydedildi ancak logo yüklenemedi: ${getErrorMessage(logoErr)}`)
          setModalOpen(false)
          clearLogoState()
          void load()
          void reloadActiveSchools()
          return
        }
      }
      message.success(editing ? 'Okul güncellendi' : 'Okul oluşturuldu')
      setModalOpen(false)
      clearLogoState()
      void load()
      void reloadActiveSchools()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (school: School) => {
    modal.confirm({
      title: 'Okulu sil',
      content: `"${school.name}" okulunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteSchool(school.id)
          message.success('Okul silindi')
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
        schools.map((s) => s.id),
        (id) => deleteSchool(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'okul')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const schoolLimit = getLicensePlan(session?.license?.plan || '')?.schoolLimit
  const atSchoolLimit = schoolLimit != null && schools.length >= schoolLimit
  const isLastSchool = schools.length <= 1
  const canRemoveSchool = canDelete && !isLastSchool
  const quotaLabel =
    schoolLimit == null
      ? `Okul: ${schools.length}${session?.license?.plan ? ' (sınırsız)' : ''}`
      : `Okul: ${schools.length}/${schoolLimit}`

  const columns: ColumnsType<School> = [
    {
      title: 'Ad',
      dataIndex: 'name',
      render: (value: string, row) => (
        <Space>
          {row.logo_url ? <SchoolLogoThumb school={row} /> : null}
          {value}
        </Space>
      ),
    },
    { title: 'Kod', dataIndex: 'code', width: 100 },
    {
      title: 'İl',
      dataIndex: ['Province', 'name'],
      width: 130,
      render: (_value, row) => row.Province?.name || '—',
    },
    {
      title: 'İlçe',
      dataIndex: ['District', 'name'],
      width: 130,
      render: (_value, row) => row.District?.name || '—',
    },
    {
      title: 'Kademe',
      dataIndex: 'school_type',
      render: (value: School['school_type']) => SCHOOL_TYPE_LABELS[value] ?? value,
    },
    {
      title: 'Oluşturma',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('tr-TR'),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: School) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record)}
                    disabled={isLastSchool}
                    title={isLastSchool ? 'Hesapta en az bir okul bulunmalıdır' : 'Sil'}
                  />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Okullar">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Okullar
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {quotaLabel}
            </Typography.Paragraph>
          </div>
          <Space wrap>
            {canRemoveSchool && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({schools.length})
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={atSchoolLimit}>
                Yeni Okul
              </Button>
            )}
          </Space>
        </Space>
        {atSchoolLimit && (
          <Typography.Paragraph type="warning">
            Plan okul limitine ulaşıldı ({schools.length}/{schoolLimit}).
          </Typography.Paragraph>
        )}

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={schools}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? 'Okulu Düzenle' : 'Yeni Okul'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          clearLogoState()
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <Upload
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              showUploadList={false}
              beforeUpload={(file) => {
                onSelectLogo(file)
                return false
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  border: '1px dashed #d9d9d9',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  cursor: 'pointer',
                }}
              >
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt="Okul logosu"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                    <PictureOutlined style={{ fontSize: 24 }} />
                    <div style={{ marginTop: 6, fontSize: 12 }}>{logoLoading ? 'Yükleniyor...' : 'Logo'}</div>
                  </div>
                )}
              </div>
            </Upload>
            <div>
              <Typography.Text strong style={{ display: 'block' }}>
                Okul logosu
              </Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                PNG, JPG veya WEBP. En fazla 2 MB. Logosu olan okulların e-postalarında bu görsel kullanılır.
              </Typography.Text>
              <Space wrap>
                <Upload
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    onSelectLogo(file)
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={logoLoading}>
                    {logoPreviewUrl ? 'Logoyu değiştir' : 'Logo yükle'}
                  </Button>
                </Upload>
                {logoPreviewUrl && (
                  <Button
                    danger
                    onClick={() => {
                      setPendingLogoFile(null)
                      setPendingRemoveLogo(true)
                      replaceLogoPreview(null)
                    }}
                  >
                    Kaldır
                  </Button>
                )}
              </Space>
            </div>
          </div>
          <SchoolCatalogFields
            key={editing ? `edit-${editing.id}` : 'create'}
            form={form}
            initialCustomName={Boolean(editing && !editing.directory_school_id)}
            onError={(text) => message.error(text)}
          />
          {canAssignCode ? (
            <Form.Item
              name="code"
              label="Okul kodu"
              tooltip="MEB kurum kodunuz (6 haneli). Katalogdan seçilen okulda varsa otomatik dolar."
              normalize={(value) => String(value || '').replace(/\D/g, '').slice(0, 6)}
              rules={SCHOOL_CODE_RULES}
            >
              <Input placeholder="Örn. 765978" maxLength={6} inputMode="numeric" />
            </Form.Item>
          ) : editing ? (
            <Form.Item label="Okul kodu">
              <Input value={editing.code} disabled />
            </Form.Item>
          ) : (
            <Typography.Paragraph type="secondary">
              Katalogda MEB kodu varsa o kullanılır; yoksa 6 haneli benzersiz bir kod otomatik atanır.
            </Typography.Paragraph>
          )}
          <Form.Item
            name="daily_period_count"
            label="Günlük ders saati sayısı"
            tooltip="Ders programı ekranında bir günde gösterilecek saat sayısı (en fazla 12)."
            rules={[{ required: true, message: 'Günlük ders saati sayısı zorunludur' }]}
          >
            <InputNumber min={1} max={12} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="first_foreign_language"
            label="Birinci yabancı dil"
            tooltip="Yabancı Dil ve Seçmeli Yabancı Dil derslerinde bu dilin öğretmenleri önerilir. Branş adı Yabancı Dil kabul edilir."
          >
            <Select
              allowClear
              placeholder="Birinci yabancı dil"
              options={FOREIGN_LANGUAGE_OPTIONS.map((language) => ({ value: language, label: language }))}
            />
          </Form.Item>
          <Form.Item
            name="second_foreign_language"
            label="İkinci yabancı dil"
            dependencies={['first_foreign_language']}
            tooltip="İkinci Yabancı Dil derslerinde bu dilin öğretmenleri önerilir."
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (value && value === getFieldValue('first_foreign_language')) {
                    return Promise.reject(new Error('İkinci yabancı dil, birinciden farklı olmalıdır'))
                  }
                  return Promise.resolve()
                },
              }),
            ]}
          >
            <Select
              allowClear
              placeholder="İkinci yabancı dil"
              options={FOREIGN_LANGUAGE_OPTIONS.map((language) => ({ value: language, label: language }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Okulları toplu sil"
        description={`Listedeki ${schools.length} okul kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
