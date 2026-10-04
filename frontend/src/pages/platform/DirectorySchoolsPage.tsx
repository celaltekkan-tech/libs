import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { ClearFiltersButton } from '../../components/ClearFiltersButton'
import { FilterBar } from '../../components/FilterBar'
import { SortableTable } from '../../components/SortableTable'
import {
  createDirectorySchool,
  deleteDirectorySchool,
  fetchDirectorySchoolLogoBlob,
  listDirectorySchools,
  listDistricts,
  listProvinces,
  updateDirectorySchool,
  type DirectorySchoolPayload,
} from '../../api/geo'
import { getErrorMessage } from '../../api/client'
import {
  DIRECTORY_SCHOOL_TYPE_LABELS,
  type DirectorySchool,
  type DirectorySchoolType,
  type District,
  type Province,
} from '../../types/geo'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const TYPE_OPTIONS = Object.entries(DIRECTORY_SCHOOL_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

function trFilter(input: string, option?: { label?: string }) {
  return (option?.label || '').toLocaleLowerCase('tr-TR').includes(input.trim().toLocaleLowerCase('tr-TR'))
}

function DirectorySchoolLogoThumb({ school }: { school: DirectorySchool }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)
    void fetchDirectorySchoolLogoBlob(school.id)
      .then((blob) => {
        if (!alive || !blob.type.startsWith('image/')) {
          if (alive) setFailed(true)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [school.id, school.logo_url])

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <PictureOutlined style={{ color: failed ? '#d9d9d9' : '#bfbfbf', fontSize: 16 }} />
      )}
    </div>
  )
}

type SchoolFormValues = DirectorySchoolPayload

export function DirectorySchoolsPage() {
  const { message, modal } = App.useApp()
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [formDistricts, setFormDistricts] = useState<District[]>([])
  const [rows, setRows] = useState<DirectorySchool[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [provinceId, setProvinceId] = useState<number | undefined>()
  const [districtId, setDistrictId] = useState<number | undefined>()
  const [schoolType, setSchoolType] = useState<DirectorySchoolType | undefined>()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DirectorySchool | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<SchoolFormValues>()
  const formProvinceId = Form.useWatch('province_id', form)

  useEffect(() => {
    void listProvinces()
      .then(setProvinces)
      .catch((err) => message.error(getErrorMessage(err)))
  }, [message])

  useEffect(() => {
    if (!provinceId) {
      setDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(provinceId)
      .then((list) => {
        if (!cancelled) setDistricts(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setDistricts([])
          message.error(getErrorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [provinceId, message])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { rows: nextRows, meta } = await listDirectorySchools({
        province_id: provinceId,
        district_id: districtId,
        school_type: schoolType,
        q: search.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      setRows(nextRows)
      setTotal(meta.total)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [provinceId, districtId, schoolType, search, page, pageSize, message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (!formProvinceId) {
      setFormDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(formProvinceId)
      .then((list) => {
        if (!cancelled) setFormDistricts(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setFormDistricts([])
          message.error(getErrorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [formProvinceId, message])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      province_id: provinceId,
      district_id: districtId,
      school_type: schoolType,
    })
    setModalOpen(true)
  }

  const openEdit = (row: DirectorySchool) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      province_id: row.province_id,
      district_id: row.district_id ?? undefined,
      school_type: row.school_type,
      code: row.code || undefined,
      website: row.website || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: SchoolFormValues) => {
    setSubmitting(true)
    try {
      const payload: DirectorySchoolPayload = {
        name: values.name.trim(),
        province_id: values.province_id,
        district_id: values.district_id || null,
        school_type: values.school_type,
        code: values.code?.trim() || null,
        website: values.website?.trim() || null,
      }
      if (editing) {
        await updateDirectorySchool(editing.id, payload)
        message.success('Okul güncellendi')
      } else {
        await createDirectorySchool(payload)
        message.success('Okul kataloga eklendi')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: DirectorySchool) => {
    modal.confirm({
      title: 'Okulu sil',
      content: `${row.name} katalogdan silinsin mi? Bu okulu seçmiş kurum kayıtlarında katalog bağlantısı kalkar.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        await deleteDirectorySchool(row.id)
        message.success('Okul silindi')
        void load()
      },
    })
  }

  const hasFilters = Boolean(provinceId || districtId || schoolType || search.trim())

  const columns: ColumnsType<DirectorySchool> = useMemo(
    () => [
      { title: 'Okul', dataIndex: 'name', render: (value: string, row) => (
          <Space>
            <DirectorySchoolLogoThumb school={row} />
            {value}
          </Space>
        ),
      },
      {
        title: 'Kod',
        dataIndex: 'code',
        width: 100,
        render: (value: string | null) => value || '—',
      },
      {
        title: 'Kademe',
        dataIndex: 'school_type',
        width: 120,
        render: (value: DirectorySchoolType) => DIRECTORY_SCHOOL_TYPE_LABELS[value] ?? value,
      },
      {
        title: 'İl',
        dataIndex: ['Province', 'name'],
        width: 140,
        render: (_value, row) => row.Province?.name || '—',
      },
      {
        title: 'İlçe',
        dataIndex: ['District', 'name'],
        width: 140,
        render: (_value, row) => row.District?.name || '—',
      },
      {
        title: 'Web',
        dataIndex: 'website',
        width: 220,
        render: (value: string | null) =>
          value ? (
            <Typography.Link href={value} target="_blank" rel="noreferrer">
              {value.replace(/^https?:\/\//, '')}
            </Typography.Link>
          ) : (
            '—'
          ),
      },
      {
        title: 'İşlemler',
        width: 220,
        render: (_: unknown, record: DirectorySchool) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle">
              Değiştir
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil">
              Sil
            </Button>
          </Space>
        ),
      },
    ],
    [openEdit, onDelete],
  )

  return (
    <AppLayout title="MEB Okul Kataloğu">
      <Typography.Paragraph type="secondary">
        Türkiye genelindeki ortaokul ve lise referans listesi. Kiracılar okul eklerken bu katalogdan
        seçer. Buradan okul ekleyebilir, değiştirebilir veya silebilirsiniz.
      </Typography.Paragraph>
      <FilterBar>
        <Space wrap>
          <Select
            allowClear
            showSearch
            placeholder="İl"
            style={{ minWidth: 180 }}
            options={provinces.map((p) => ({ value: p.id, label: p.name }))}
            value={provinceId}
            filterOption={trFilter}
            onChange={(value) => {
              setProvinceId(value)
              setDistrictId(undefined)
              setPage(1)
            }}
          />
          <Select
            allowClear
            showSearch
            placeholder="İlçe"
            style={{ minWidth: 180 }}
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
            value={districtId}
            disabled={!provinceId}
            filterOption={trFilter}
            onChange={(value) => {
              setDistrictId(value)
              setPage(1)
            }}
          />
          <Select
            allowClear
            placeholder="Kademe"
            style={{ minWidth: 140 }}
            options={TYPE_OPTIONS}
            value={schoolType}
            onChange={(value) => {
              setSchoolType(value)
              setPage(1)
            }}
          />
          <Input.Search
            allowClear
            placeholder="Okul adı ara"
            style={{ minWidth: 220 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) => setSearchInput(value)}
          />
          <ClearFiltersButton
            active={hasFilters || Boolean(searchInput.trim())}
            onClick={() => {
              setProvinceId(undefined)
              setDistrictId(undefined)
              setSchoolType(undefined)
              setSearchInput('')
              setPage(1)
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Yeni okul
          </Button>
        </Space>
      </FilterBar>
      <SortableTable<DirectorySchool>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (count) => `${count} okul`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
      />

      <Modal
        title={editing ? 'Okulu değiştir' : 'Yeni okul'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Ekle'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="province_id" label="İl" rules={[{ required: true, message: 'İl zorunludur' }]}>
            <Select
              showSearch
              placeholder="İl seçin"
              options={provinces.map((p) => ({ value: p.id, label: p.name }))}
              filterOption={trFilter}
              onChange={() => form.setFieldValue('district_id', undefined)}
            />
          </Form.Item>
          <Form.Item name="district_id" label="İlçe">
            <Select
              allowClear
              showSearch
              placeholder={formProvinceId ? 'İlçe seçin' : 'Önce il seçin'}
              disabled={!formProvinceId}
              options={formDistricts.map((d) => ({ value: d.id, label: d.name }))}
              filterOption={trFilter}
            />
          </Form.Item>
          <Form.Item name="name" label="Okul adı" rules={[{ required: true, message: 'Okul adı zorunludur' }]}>
            <Input maxLength={250} />
          </Form.Item>
          <Form.Item name="school_type" label="Kademe" rules={[{ required: true, message: 'Kademe zorunludur' }]}>
            <Select options={TYPE_OPTIONS} placeholder="Kademe seçin" />
          </Form.Item>
          <Form.Item
            name="code"
            label="Okul kodu"
            rules={[
              {
                validator: async (_, value) => {
                  const text = String(value || '').trim()
                  if (!text) return
                  if (!/^\d{6}$/.test(text)) {
                    throw new Error('Okul kodu 6 haneli sayı olmalıdır')
                  }
                },
              },
            ]}
          >
            <Input maxLength={6} placeholder="Opsiyonel, 6 hane" />
          </Form.Item>
          <Form.Item name="website" label="Web">
            <Input maxLength={300} placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
