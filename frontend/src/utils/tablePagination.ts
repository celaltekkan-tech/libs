import type { TablePaginationConfig } from 'antd/es/table'

/** Uncontrolled table pagination so “X / sayfa” size changes actually apply. */
export function tablePagination(defaultPageSize = 20): TablePaginationConfig {
  return {
    defaultPageSize,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
  }
}
