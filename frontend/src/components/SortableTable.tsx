import { Table } from 'antd'
import type { TableProps } from 'antd'
import { useMemo } from 'react'
import { withColumnSorters } from '../utils/tableSort'

/**
 * Ant Design Table sarmalayıcısı: başlıklardan A→Z / Z→A sıralama.
 * dataIndex (veya uygun key) olan sütunlar otomatik sıralanır.
 */
export function SortableTable<RecordType extends object>(props: TableProps<RecordType>) {
  const columns = useMemo(
    () => (props.columns ? withColumnSorters(props.columns) : props.columns),
    [props.columns],
  )

  return <Table<RecordType> {...props} columns={columns} />
}
