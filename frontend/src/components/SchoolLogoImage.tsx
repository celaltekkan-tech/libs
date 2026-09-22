import { useEffect, useState } from 'react'
import { fetchSchoolLogoBlob } from '../api/schools'
import type { School } from '../types/school'
import { blobToDataUrl, writeLastSchoolBrand } from '../utils/lastSchoolBrand'

interface SchoolLogoImageProps {
  school: Pick<School, 'id' | 'name' | 'logo_url'> | null
  size?: number
  className?: string
}

export function SchoolLogoImage({ school, size = 36, className }: SchoolLogoImageProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!school?.logo_url) {
      setUrl(null)
      return
    }
    let alive = true
    let objectUrl: string | null = null
    void fetchSchoolLogoBlob(school.id)
      .then((blob) => {
        if (!alive || !blob.type.startsWith('image/')) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        void blobToDataUrl(blob)
          .then((dataUrl) => {
            if (!school) return
            writeLastSchoolBrand({ schoolId: school.id, name: school.name, dataUrl })
          })
          .catch(() => {
            /* giriş ekranı için saklanamazsa sessizce geç */
          })
      })
      .catch(() => {
        if (alive) setUrl(null)
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [school?.id, school?.logo_url])

  if (!url) return null
  return (
    <img
      src={url}
      alt={school?.name || ''}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  )
}
