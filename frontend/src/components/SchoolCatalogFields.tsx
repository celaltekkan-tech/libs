import { useEffect, useMemo, useState } from 'react'
import { Checkbox, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd/es/form'
import { getErrorMessage } from '../api/client'
import { listDirectorySchools, listDistricts, listProvinces } from '../api/geo'
import { DIRECTORY_SCHOOL_TYPE_LABELS, type DirectorySchool, type District, type Province } from '../types/geo'
import { SCHOOL_TYPE_LABELS, type SchoolType } from '../types/school'

function fieldName(prefix: Array<string | number>, key: string) {
  return prefix.length ? [...prefix, key] : key
}

function trFilter(input: string, option?: { label?: string }) {
  return (option?.label || '').toLocaleLowerCase('tr-TR').includes(input.trim().toLocaleLowerCase('tr-TR'))
}

const SCHOOL_TYPE_OPTIONS = Object.entries(SCHOOL_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface SchoolCatalogFieldsProps {
  form: FormInstance
  namePrefix?: Array<string | number>
  initialCustomName?: boolean
  onError?: (message: string) => void
}

export function SchoolCatalogFields({
  form,
  namePrefix = [],
  initialCustomName = false,
  onError,
}: SchoolCatalogFieldsProps) {
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [catalog, setCatalog] = useState<DirectorySchool[]>([])
  const [customName, setCustomName] = useState(initialCustomName)
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  const provinceField = fieldName(namePrefix, 'province_id')
  const districtField = fieldName(namePrefix, 'district_id')
  const directoryField = fieldName(namePrefix, 'directory_school_id')
  const nameField = fieldName(namePrefix, 'name')
  const typeField = fieldName(namePrefix, 'school_type')

  const provinceId = Form.useWatch(provinceField, form) as number | undefined
  const districtId = Form.useWatch(districtField, form) as number | undefined

  useEffect(() => {
    setCustomName(initialCustomName)
  }, [initialCustomName])

  useEffect(() => {
    void listProvinces()
      .then(setProvinces)
      .catch((err) => onError?.(getErrorMessage(err)))
  }, [onError])

  useEffect(() => {
    if (!provinceId) {
      setDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(provinceId)
      .then((rows) => {
        if (!cancelled) setDistricts(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setDistricts([])
          onError?.(getErrorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [provinceId, onError])

  useEffect(() => {
    if (!provinceId || !districtId || customName) {
      setCatalog([])
      return
    }
    let cancelled = false
    setLoadingCatalog(true)
    void listDirectorySchools({
      province_id: provinceId,
      district_id: districtId,
      limit: 1000,
    })
      .then(({ rows }) => {
        if (!cancelled) setCatalog(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalog([])
          onError?.(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [provinceId, districtId, customName, onError])

  const schoolOptions = useMemo(
    () =>
      catalog.map((row) => ({
        value: row.id,
        label: `${row.name} (${DIRECTORY_SCHOOL_TYPE_LABELS[row.school_type]}${row.code ? ` · ${row.code}` : ''})`,
      })),
    [catalog],
  )

  function setValue(key: string, value: unknown) {
    form.setFieldValue(fieldName(namePrefix, key), value)
  }

  function onProvinceChange() {
    setValue('district_id', undefined)
    setValue('directory_school_id', undefined)
    if (!customName) setValue('name', undefined)
  }

  function onDistrictChange() {
    setValue('directory_school_id', undefined)
    if (!customName) setValue('name', undefined)
  }

  function onCatalogSchoolChange(id: number | undefined) {
    const row = catalog.find((item) => item.id === id)
    if (!row) {
      setValue('directory_school_id', undefined)
      setValue('name', undefined)
      return
    }
    setValue('directory_school_id', row.id)
    setValue('name', row.name)
    setValue('school_type', row.school_type as SchoolType)
    if (row.code) setValue('code', row.code)
  }

  function onToggleCustom(checked: boolean) {
    setCustomName(checked)
    setValue('directory_school_id', undefined)
    if (checked) {
      setValue('name', undefined)
    } else {
      setValue('name', undefined)
    }
  }

  return (
    <>
      <Form.Item name={provinceField} label="İl" rules={[{ required: true, message: 'İl seçin' }]}>
        <Select
          showSearch
          placeholder="İl seçin"
          options={provinces.map((p) => ({ value: p.id, label: p.name }))}
          filterOption={trFilter}
          onChange={onProvinceChange}
        />
      </Form.Item>
      <Form.Item name={districtField} label="İlçe" rules={[{ required: true, message: 'İlçe seçin' }]}>
        <Select
          showSearch
          placeholder={provinceId ? 'İlçe seçin' : 'Önce il seçin'}
          disabled={!provinceId}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          filterOption={trFilter}
          onChange={onDistrictChange}
        />
      </Form.Item>
      <Checkbox
        checked={customName}
        onChange={(e) => onToggleCustom(e.target.checked)}
        style={{ marginBottom: 12 }}
        disabled={!districtId}
      >
        Okul listede yok, yeni ad gireceğim
      </Checkbox>
      {customName ? (
        <>
          <Form.Item name={directoryField} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={nameField} label="Okul adı" rules={[{ required: true, message: 'Okul adı zorunludur' }]}>
            <Input placeholder="Örn. Atatürk Ortaokulu" />
          </Form.Item>
        </>
      ) : (
        <>
          <Form.Item
            name={directoryField}
            label="Okul adı"
            rules={[{ required: true, message: 'Katalogdan okul seçin veya listede yok seçeneğini işaretleyin' }]}
          >
            <Select
              showSearch
              placeholder={districtId ? 'Okul seçin' : 'Önce ilçe seçin'}
              disabled={!districtId}
              loading={loadingCatalog}
              options={schoolOptions}
              filterOption={trFilter}
              onChange={onCatalogSchoolChange}
              notFoundContent={districtId ? 'Bu ilçede katalog kaydı yok. Listede yok seçeneğini kullanın.' : null}
            />
          </Form.Item>
          <Form.Item name={nameField} hidden>
            <Input />
          </Form.Item>
        </>
      )}
      <Form.Item name={typeField} label="Okul kademesi" rules={[{ required: true, message: 'Okul kademesi zorunludur' }]}>
        <Select options={SCHOOL_TYPE_OPTIONS} placeholder="Kademe seçin" />
      </Form.Item>
    </>
  )
}
