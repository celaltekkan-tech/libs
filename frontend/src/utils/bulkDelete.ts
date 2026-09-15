export interface BulkDeleteResult {
  deleted: number
  failed: number
}

export async function bulkDeleteByIds(
  ids: Array<number | string>,
  deleteOne: (id: number | string) => Promise<void>,
): Promise<BulkDeleteResult> {
  let deleted = 0
  let failed = 0
  for (const id of ids) {
    try {
      await deleteOne(id)
      deleted += 1
    } catch {
      failed += 1
    }
  }
  return { deleted, failed }
}

export function bulkDeleteResultMessage(result: BulkDeleteResult, noun = 'kayıt'): string {
  if (result.failed === 0) {
    return `${result.deleted} ${noun} silindi`
  }
  if (result.deleted === 0) {
    return `Hiçbir ${noun} silinemedi (${result.failed} hata)`
  }
  return `${result.deleted} ${noun} silindi, ${result.failed} silinemedi`
}
