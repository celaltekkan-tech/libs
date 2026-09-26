import { DatePicker, Select } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { trSelectFilter } from '../utils/uniqueSelectOptions'
import type { FilterFieldOption } from './FilterFieldsPicker'

export interface DateRangeFilter {
  from: string
  to: string
}

export type ListFilterValue = string | number | boolean | DateRangeFilter | Array<string | number | boolean> | undefined

export function isDateRangeFilter(value: ListFilterValue): value is DateRangeFilter {
  return Boolean(value && typeof value === 'object' && 'from' in value && 'to' in value)
}

export function isActiveFilterValue(value: ListFilterValue): boolean {
  if (value == null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (isDateRangeFilter(value)) return Boolean(value.from && value.to)
  return true
}

export function matchesListFilter(recordValue: string, selected: ListFilterValue): boolean {
  if (!isActiveFilterValue(selected)) return true
  if (Array.isArray(selected)) return selected.some((item) => recordValue === String(item))
  if (isDateRangeFilter(selected)) {
    if (!recordValue) return false
    return recordValue >= selected.from && recordValue <= selected.to
  }
  return recordValue === String(selected)
}

interface DynamicListFiltersProps<T extends string> {
  fields: readonly FilterFieldOption<T>[]
  isVisible: (key: T) => boolean
  values: Partial<Record<T, ListFilterValue>>
  optionsByKey: Partial<Record<T, Array<{ value: string | number | boolean; label: string }>>>
  onChange: (key: T, value: ListFilterValue) => void
  multiple?: boolean
}

function rangeValue(value: ListFilterValue): [Dayjs, Dayjs] | null {
  if (!isDateRangeFilter(value) || !value.from || !value.to) return null
  const from = dayjs(value.from)
  const to = dayjs(value.to)
  if (!from.isValid() || !to.isValid()) return null
  return [from, to]
}

export function DynamicListFilters<T extends string>({
  fields,
  isVisible,
  values,
  optionsByKey,
  onChange,
  multiple = false,
}: DynamicListFiltersProps<T>) {
  return (
    <>
      {fields.map((field) => {
        if (!isVisible(field.key)) return null
        if (field.kind === 'dateRange') {
          return (
            <DatePicker.RangePicker
              key={field.key}
              allowClear
              allowEmpty={[false, false]}
              format="DD.MM.YYYY"
              placeholder={[`${field.label} baş.`, `${field.label} bit.`]}
              style={{ width: 280 }}
              value={rangeValue(values[field.key])}
              onChange={(dates) => {
                if (!dates?.[0] || !dates[1]) {
                  onChange(field.key, undefined)
                  return
                }
                const from = dates[0].format('YYYY-MM-DD')
                const to = dates[1].format('YYYY-MM-DD')
                onChange(field.key, { from, to })
              }}
            />
          )
        }
        const current = values[field.key]
        const multiValue = Array.isArray(current) ? current : current != null && current !== '' ? [current] : []
        return (
          <Select
            key={field.key}
            allowClear
            showSearch
            mode={multiple ? 'multiple' : undefined}
            maxTagCount="responsive"
            optionFilterProp="label"
            filterOption={trSelectFilter}
            placeholder={field.label}
            style={{ minWidth: 160, width: multiple ? 240 : 180 }}
            options={optionsByKey[field.key]}
            value={multiple ? (multiValue as Array<string | number>) : (current as string | number | undefined)}
            onChange={(next) => onChange(field.key, next)}
          />
        )
      })}
    </>
  )
}
