import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { decodeImage, toScaledBlob, validateFile } from '@/lib/image'

const MAX_DIMENSION = 1600

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

export function UploadDropzone({ onPhoto }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const openPicker = () => inputRef.current?.click()

  const acceptFile = async (file: File) => {
    const result = validateFile(file)
    if (!result.ok) {
      setError(result.reason)
      setPreview(null)
      return
    }

    setError(null)
    setBusy(true)
    setPreview(URL.createObjectURL(file))

    try {
      const bitmap = await decodeImage(file)
      try {
        const blob = await toScaledBlob(bitmap, MAX_DIMENSION)
        onPhoto(blob)
      } finally {
        bitmap.close()
      }
    } catch {
      setError('图片解析失败，请换一张试试')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return
    openPicker()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void acceptFile(file)
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
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) void acceptFile(file)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="上传照片"
      aria-busy={busy || undefined}
      data-dragging={dragging ? 'true' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-ink bg-paper p-6 text-center transition-colors select-none focus-visible:ring-4 focus-visible:ring-ink/30 focus-visible:outline-none ${
        dragging ? 'border-solid bg-alert/20' : ''
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="选择照片"
        tabIndex={-1}
        className="sr-only"
        onChange={handleChange}
      />

      <span className="inline-flex -rotate-2 items-center gap-2 border-2 border-ink bg-alert px-4 py-2 font-display text-xl font-bold text-ink shadow-[4px_4px_0_0_var(--color-ink)]">
        <CameraIcon />
        把照片拖进来
      </span>

      <p className="text-sm text-ink/60">或点击选择照片 · JPG / PNG / WebP · 最大 20MB</p>

      {preview ? (
        <img
          src={preview}
          alt="已选照片预览"
          className="h-28 w-28 rounded-xl border-2 border-ink object-cover"
        />
      ) : null}

      <p aria-live="polite" className="min-h-5 text-sm font-bold text-ink/70">
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
    </div>
  )
}

export default UploadDropzone
