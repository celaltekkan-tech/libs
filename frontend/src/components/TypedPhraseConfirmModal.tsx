import { useEffect, useState } from 'react'
import { Alert, Input, Modal, Typography } from 'antd'

const DEFAULT_PHRASE = 'onaylıyorum'

export interface TypedPhraseConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmPhrase?: string
  loading?: boolean
  okText?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

function normalizePhrase(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

export function TypedPhraseConfirmModal({
  open,
  title,
  description,
  confirmPhrase = DEFAULT_PHRASE,
  loading = false,
  okText = 'Toplu sil',
  onCancel,
  onConfirm,
}: TypedPhraseConfirmModalProps) {
  const [phrase, setPhrase] = useState('')
  const expected = normalizePhrase(confirmPhrase)
  const matched = normalizePhrase(phrase) === expected

  useEffect(() => {
    if (!open) setPhrase('')
  }, [open])

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      okButtonProps={{ danger: true, disabled: !matched, loading }}
      cancelText="Vazgeç"
      onCancel={onCancel}
      onOk={() => void onConfirm()}
      destroyOnHidden
      maskClosable={!loading}
      closable={!loading}
      cancelButtonProps={{ disabled: loading }}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={description}
        description="Bu işlem geri alınamaz. Devam etmek için aşağıdaki kutuya onay kelimesini elle yazın (yapıştırma kapalıdır)."
      />
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        Onay kelimesi:{' '}
        <Typography.Text code strong>
          {confirmPhrase}
        </Typography.Text>
      </Typography.Paragraph>
      <Input
        value={phrase}
        placeholder={`${confirmPhrase} yazın`}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={loading}
        onChange={(e) => setPhrase(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault()
          }
        }}
      />
    </Modal>
  )
}
