import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { decodeImage, toScaledBlob, validateFile } from '@/lib/image'

const MAX_DIMENSION = 1600
const ACCEPT = 'image/jpeg,image/png,image/webp'
const PIPELINE_ERROR = '图片解析失败，请换一张试试'

export interface UploadDropzoneProps {
  onPhoto: (blob: Blob) => void
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

async function decodeAndDownscale(file: Blob): Promise<Blob> {
  const bitmap = await decodeImage(file)
  try {
    return await toScaledBlob(bitmap, MAX_DIMENSION)
  } finally {
    bitmap.close()
  }
}

export function UploadDropzone({ onPhoto }: UploadDropzoneProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    const url = preview
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [preview])

  const openGallery = () => galleryInputRef.current?.click()
  const openCamera = () => cameraInputRef.current?.click()

  const acceptFile = async (file: File) => {
    const requestId = ++requestIdRef.current
    const isLatest = () => requestId === requestIdRef.current

    const result = validateFile(file)
    if (!result.ok) {
      setError(result.reason)
      setPreview(null)
      setBusy(false)
      return
    }

    let previewUrl: string
    try {
      previewUrl = URL.createObjectURL(file)
    } catch {
      setError(PIPELINE_ERROR)
      setPreview(null)
      setBusy(false)
      return
    }

    setError(null)
    setPreview(previewUrl)
    setBusy(true)

    let blob: Blob | null = null
    try {
      blob = await decodeAndDownscale(file)
    } catch {
      if (isLatest()) {
        setError(PIPELINE_ERROR)
        setPreview(null)
        setBusy(false)
      }
      return
    }

    if (!isLatest() || !blob) return

    try {
      onPhoto(blob)
    } finally {
      if (isLatest()) setBusy(false)
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void acceptFile(file)
  }

  const handleKeyDown = (
    open: () => void,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open()
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  const handleDragEnd = () => {
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) void acceptFile(file)
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        data-testid="dropzone"
        aria-busy={busy || undefined}
        data-dragging={dragging ? 'true' : undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-ink bg-paper p-6 text-center transition-colors select-none ${
          dragging ? 'border-solid bg-alert/20' : ''
        }`}
      >
        <button
          type="button"
          aria-describedby={hintId}
          onClick={openGallery}
          onKeyDown={(event) => handleKeyDown(openGallery, event)}
          className="rounded-xl"
        >
          <span className="inline-flex -rotate-2 items-center gap-2 border-2 border-ink bg-alert px-4 py-2 font-display text-xl font-bold text-ink shadow-[4px_4px_0_0_var(--color-ink)]">
            <CameraIcon />
            把照片拖进来
          </span>
        </button>

        <p id={hintId} className="text-sm text-ink/60">
          从相册选择 / 拖进来 · JPG / PNG / WebP · 最大 20MB
        </p>

        <button
          type="button"
          onClick={openCamera}
          onKeyDown={(event) => handleKeyDown(openCamera, event)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-paper px-3 py-1.5 text-sm font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
        >
          <CameraIcon />
          拍照
        </button>

        {preview ? (
          <img
            src={preview}
            alt="已选照片预览"
            className="h-28 w-28 rounded-xl border-2 border-ink object-cover"
          />
        ) : null}
      </div>

      <p role="status" className="min-h-5 text-sm font-bold text-ink/70">
        {busy ? '正在处理照片…' : ''}
      </p>

      {error ? (
        <p
          role="alert"
          className="w-full border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold text-ink"
        >
          {error}
        </p>
      ) : null}

      <input
        data-testid="gallery-input"
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleChange}
      />
      <input
        data-testid="camera-input"
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  )
}

export default UploadDropzone
