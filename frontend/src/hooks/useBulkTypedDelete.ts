import { useState } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'

interface UseBulkTypedDeleteOptions {
  getIds: () => Array<number | string>
  deleteOne: (id: number | string) => Promise<void>
  noun: string
  reload: () => void
  message: MessageInstance
  emptyWarning?: string
}

export function useBulkTypedDelete({
  getIds,
  deleteOne,
  noun,
  reload,
  message,
  emptyWarning,
}: UseBulkTypedDeleteOptions) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  const onBulkDelete = async () => {
    const ids = getIds()
    if (ids.length === 0) {
      message.warning(emptyWarning || `Silinecek ${noun} yok`)
      setBulkOpen(false)
      return
    }
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(ids, deleteOne)
      const text = bulkDeleteResultMessage(result, noun)
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      reload()
    } finally {
      setBulkLoading(false)
    }
  }

  return { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete }
}
