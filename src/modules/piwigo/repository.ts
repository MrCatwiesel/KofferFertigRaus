import { db, newId, now } from '@/core/db'
import type { PiwigoAlbumLink, PiwigoUpload } from './types'

export const albumLinkRepository = {
  get(tripId: string): Promise<PiwigoAlbumLink | undefined> {
    return db.piwigoAlbums.get(tripId)
  },

  async set(tripId: string, album: { id: number; name: string; url?: string }, autoUpload?: boolean): Promise<PiwigoAlbumLink> {
    const old = await db.piwigoAlbums.get(tripId)
    const ts = now()
    const link: PiwigoAlbumLink = {
      id: tripId,
      tripId,
      albumId: album.id,
      albumName: album.name,
      albumUrl: album.url ?? '',
      autoUpload: autoUpload ?? old?.autoUpload ?? true,
      createdAt: old?.createdAt ?? ts,
      updatedAt: ts
    }
    await db.piwigoAlbums.put(link)
    return link
  },

  async setAutoUpload(tripId: string, autoUpload: boolean): Promise<void> {
    await db.piwigoAlbums.update(tripId, { autoUpload, updatedAt: now() })
  },

  async remove(tripId: string): Promise<void> {
    await db.piwigoAlbums.delete(tripId)
  }
}

export const uploadRepository = {
  async add(items: Omit<PiwigoUpload, 'id' | 'status' | 'tries' | 'error' | 'createdAt' | 'nextTryAt'>[]): Promise<void> {
    const ts = now()
    await db.piwigoUploads.bulkAdd(items.map((i) => ({ ...i, id: newId(), status: 'waiting', tries: 0, error: '', createdAt: ts, nextTryAt: '' })))
  },
  listAll(): Promise<PiwigoUpload[]> {
    return db.piwigoUploads.toArray().then((l) => l.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  },
  listByTrip(tripId: string): Promise<PiwigoUpload[]> {
    return db.piwigoUploads.where('tripId').equals(tripId).toArray()
  },
  count(): Promise<number> {
    return db.piwigoUploads.count()
  },
  async failed(id: string, tries: number, error: string, nextTryAt: string): Promise<void> {
    await db.piwigoUploads.update(id, { status: 'error', tries, error, nextTryAt })
  },
  async retryNow(tripId: string): Promise<void> {
    await db.piwigoUploads.where('tripId').equals(tripId).modify({ nextTryAt: '' })
  },
  async done(id: string): Promise<void> {
    await db.piwigoUploads.delete(id)
  },
  async removeByPhoto(photoId: string): Promise<void> {
    await db.piwigoUploads.where('photoId').equals(photoId).delete()
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.piwigoUploads.where('tripId').equals(tripId).delete()
  }
}

/** Einstellungen nur auf diesem Gerät. */
export const piwigoPrefs = {
  /** Zuletzt bekannt: Piwigo am Server eingerichtet? (null = noch nie geprüft) */
  async enabled(): Promise<boolean | null> {
    return ((await db.meta.get('piwigo.enabled'))?.value as boolean | undefined) ?? null
  },
  async setEnabled(v: boolean): Promise<void> {
    await db.meta.put({ key: 'piwigo.enabled', value: v })
  },
  /** Hauptalbum für neue Reise-Alben */
  async parentAlbum(): Promise<number | null> {
    return ((await db.meta.get('piwigo.parentAlbum'))?.value as number | null) ?? null
  },
  async setParentAlbum(id: number | null): Promise<void> {
    await db.meta.put({ key: 'piwigo.parentAlbum', value: id })
  }
}
