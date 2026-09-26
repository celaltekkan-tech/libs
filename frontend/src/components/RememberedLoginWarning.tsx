import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from 'antd'
import {
  clearRememberedLoginWarning,
  rememberedLoginWarningPending,
} from '../utils/rememberedLogin'

export function RememberedLoginWarning() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (rememberedLoginWarningPending()) setOpen(true)
  }, [])

  function dismiss() {
    clearRememberedLoginWarning()
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      title="Girişiniz güvenli değil"
      onCancel={dismiss}
      footer={[
        <Button key="ok" onClick={dismiss}>
          Anladım
        </Button>,
        <Button
          key="profile"
          type="primary"
          onClick={() => {
            dismiss()
            navigate('/profile')
          }}
        >
          2FA veya SMS için profile git
        </Button>,
      ]}
    >
      Girişiniz güvenli değil. 2FA veya SMS doğrulaması kullanın.
    </Modal>
  )
}
