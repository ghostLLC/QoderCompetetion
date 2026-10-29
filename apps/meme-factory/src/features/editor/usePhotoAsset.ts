import { useEffect, useRef, useState } from 'react'

import { bakeFilters } from '@/lib/image'
import type { PhotoFilters } from '@/lib/scene'
import { usePhotoStore } from '@/store/photoStore'

export interface PhotoAsset {
  /** Ready-to-draw pixels: the loaded photo, or its filtered bake. */
  image: HTMLImageElement | HTMLCanvasElement | null
  /** Natural pixel size of the source photo. */
  natural: { width: number; height: number }
}

/** Debounce window for re-baking filters while a slider is being dragged. */
const FILTER_BAKE_DEBOUNCE_MS = 150

const ZERO_SIZE = { width: 0, height: 0 }

interface LoadedPhoto {
  url: string
  image: HTMLImageElement
  natural: { width: number; height: number }
}

interface BakedPhoto {
  source: HTMLImageElement
  image: HTMLCanvasElement
}

function filterKeyOf(filters: PhotoFilters | null): string {
  if (!filters) return 'none'
  return [
    filters.brightness,
    filters.contrast,
    filters.saturation,
    filters.grayscale ? 1 : 0,
  ].join('|')
}

function isNeutral(filters: PhotoFilters): boolean {
  return (
    filters.brightness === 100 &&
    filters.contrast === 100 &&
    filters.saturation === 100 &&
    !filters.grayscale
  )
}

/**
 * Loads the current `photoStore` blob as an `HTMLImageElement` and bakes photo
 * filters into an offscreen canvas. The bake is debounced so dragging a filter
 * slider does not allocate a canvas per frame.
 *
 * URLs belong to `photoStore`; this hook only detaches image listeners and
 * cancels pending bakes when the URL or filters change.
 */
export function usePhotoAsset(filters: PhotoFilters | null = null): PhotoAsset {
  const photoUrl = usePhotoStore((state) => state.photoUrl)
  const [loaded, setLoaded] = useState<LoadedPhoto | null>(null)
  const [baked, setBaked] = useState<BakedPhoto | null>(null)

  // A stale load never leaks into the current URL: the URL is part of the key.
  const source = loaded && loaded.url === photoUrl ? loaded.image : null
  const natural = loaded && loaded.url === photoUrl ? loaded.natural : ZERO_SIZE

  const filterKey = filterKeyOf(filters)
  const neutral = !filters || isNeutral(filters)

  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    if (!photoUrl) return

    let cancelled = false
    const img = new Image()
    const detach = () => {
      img.onload = null
      img.onerror = null
    }

    img.onload = () => {
      if (cancelled) return
      detach()
      setLoaded({
        url: photoUrl,
        image: img,
        natural: {
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        },
      })
    }
    img.onerror = () => {
      if (cancelled) return
      detach()
      setLoaded(null)
    }
    img.src = photoUrl

    return () => {
      cancelled = true
      detach()
    }
  }, [photoUrl])

  useEffect(() => {
    if (!source || neutral) return

    const timer = window.setTimeout(() => {
      const current = filtersRef.current
      if (!current) return
      try {
        setBaked({ source, image: bakeFilters(source, current) })
      } catch {
        // Filtering is cosmetic; fall back to the unfiltered photo.
        setBaked(null)
      }
    }, FILTER_BAKE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [source, neutral, filterKey])

  const image =
    !source || neutral ? source : baked && baked.source === source ? baked.image : source

  return { image, natural }
}
