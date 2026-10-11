/** Verknüpfung einer Reise mit einem Piwigo-Album (wird zwischen Geräten abgeglichen; id = tripId). */
export interface PiwigoAlbumLink {
  id: string
  tripId: string
  albumId: number
  albumName: string
  /** Link zum Album in Piwigo (öffentliche Adresse) */
  albumUrl: string
  /** Neue eigene Fotos automatisch hochladen */
  autoUpload: boolean
  createdAt: string
  updatedAt: string
}

export type UploadStatus = 'waiting' | 'error'

/** Ein Originalfoto, das noch nach Piwigo muss (nur auf diesem Gerät). */
export interface PiwigoUpload {
  id: string
  tripId: string
  photoId: string
  original: Blob
  filename: string
  caption: string
  takenAt: string
  status: UploadStatus
  tries: number
  error: string
  createdAt: string
  /** Frühester nächster Versuch (ISO) */
  nextTryAt: string
}

/** Album, wie der Server es liefert. */
export interface PiwigoAlbum {
  id: number
  /** Voller Name mit übergeordneten Alben, z. B. "Urlaube / Gardasee 2025" */
  name: string
  parentId: number | null
  images: number
  totalImages: number
  url: string
}

export interface PiwigoImage {
  id: number
  name: string
  file: string
  width: number
  height: number
  takenAt: string
  comment: string
  pageUrl: string
}

export interface PiwigoStatus {
  ok: boolean
  user: string
  admin: boolean
  version: string
  publicUrl: string
}
