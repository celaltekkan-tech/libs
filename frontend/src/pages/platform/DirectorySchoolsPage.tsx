import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Input, Select, Space, Typography } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { ClearFiltersButton } from '../../components/ClearFiltersButton'
import { FilterBar } from '../../components/FilterBar'
import { SortableTable } from '../../components/SortableTable'
import { fetchDirectorySchoolLogoBlob, listDirectorySchools, listDistricts, listProvinces } from '../../api/geo'
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

export function DirectorySchoolsPage() {
  const { message } = App.useApp()
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
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
    ],
    [],
  )

  return (
    <AppLayout title="MEB Okul Kataloğu">
      <Typography.Paragraph type="secondary">
        Türkiye genelindeki ortaokul ve lise referans listesi. Kiracılar okul eklerken bu katalogdan
        seçer.
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
    </AppLayout>
  )
}
