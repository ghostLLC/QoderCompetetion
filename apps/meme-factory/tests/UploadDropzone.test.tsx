import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UploadDropzone } from '@/features/upload/UploadDropzone'
import { decodeImage, toScaledBlob } from '@/lib/image'

vi.mock('@/lib/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image')>()
  return { ...actual, decodeImage: vi.fn(), toScaledBlob: vi.fn() }
})

const createObjectURL = vi.fn<(blob: Blob) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  createObjectURL.mockReset()
  createObjectURL.mockImplementation(() => 'blob:preview')
  revokeObjectURL.mockReset()
  vi.mocked(decodeImage).mockReset()
  vi.mocked(toScaledBlob).mockReset()
})

const makePhoto = (name = 'photo.png') =>
  new File([new Uint8Array(4)], name, { type: 'image/png' })

const makeBitmap = () => {
  const close = vi.fn()
  return { bitmap: { width: 4000, height: 3000, close } as unknown as ImageBitmap, close }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function renderDropzone() {
  const onPhoto = vi.fn()
  render(<UploadDropzone onPhoto={onPhoto} />)
  return {
    onPhoto,
    dropzone: screen.getByTestId('dropzone'),
    galleryInput: screen.getByTestId('gallery-input') as HTMLInputElement,
    cameraInput: screen.getByTestId('camera-input') as HTMLInputElement,
    galleryButton: screen.getByRole('button', { name: /把照片拖进来/ }),
    cameraButton: screen.getByRole('button', { name: /拍照/ }),
  }
}

test('offers separate gallery and camera inputs with the right capture config', () => {
  const { galleryInput, cameraInput, cameraButton } = renderDropzone()

  expect(screen.getByText('把照片拖进来')).toBeInTheDocument()
  expect(screen.getByText(/从相册选择 \/ 拖进来/)).toBeInTheDocument()
  expect(screen.getByText(/JPG \/ PNG \/ WebP/)).toBeInTheDocument()

  expect(galleryInput).toHaveAttribute('type', 'file')
  expect(galleryInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  expect(galleryInput).not.toHaveAttribute('capture')
  expect(galleryInput).toHaveAttribute('aria-hidden', 'true')
  expect(galleryInput).toHaveAttribute('tabindex', '-1')
  expect(galleryInput.closest('button')).toBeNull()
  expect(galleryInput.closest('[role="button"]')).toBeNull()

  expect(cameraInput).toHaveAttribute('type', 'file')
  expect(cameraInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  expect(cameraInput).toHaveAttribute('capture', 'environment')
  expect(cameraInput).toHaveAttribute('aria-hidden', 'true')
  expect(cameraInput).toHaveAttribute('tabindex', '-1')
  expect(cameraInput.closest('button')).toBeNull()
  expect(cameraInput.closest('[role="button"]')).toBeNull()

  expect(cameraButton).toBeInTheDocument()
})

test('the gallery button opens the gallery picker and supports Enter/Space', () => {
  const { galleryButton, galleryInput } = renderDropzone()
  const click = vi.spyOn(galleryInput, 'click')

  fireEvent.click(galleryButton)
  fireEvent.keyDown(galleryButton, { key: 'Enter' })
  fireEvent.keyDown(galleryButton, { key: ' ' })

  expect(click).toHaveBeenCalledTimes(3)
})

test('the camera button opens the camera input', () => {
  const { cameraButton, cameraInput, galleryInput } = renderDropzone()
  const cameraClick = vi.spyOn(cameraInput, 'click')
  const galleryClick = vi.spyOn(galleryInput, 'click')

  fireEvent.click(cameraButton)

  expect(cameraClick).toHaveBeenCalledTimes(1)
  expect(galleryClick).not.toHaveBeenCalled()
})

test('valid gallery photo: preview, decode, downscale, then onPhoto', async () => {
  const { galleryInput, onPhoto } = renderDropzone()
  const { bitmap, close } = makeBitmap()
  const scaled = new Blob(['scaled'], { type: 'image/png' })
  vi.mocked(decodeImage).mockResolvedValue(bitmap)
  let resolveScaled: (blob: Blob) => void = () => {}
  vi.mocked(toScaledBlob).mockImplementation(
    () =>
      new Promise<Blob>((resolve) => {
        resolveScaled = resolve
      }),
  )
  const file = makePhoto()

  fireEvent.change(galleryInput, { target: { files: [file] } })

  expect(createObjectURL).toHaveBeenCalledWith(file)
  expect(screen.getByAltText('已选照片预览')).toHaveAttribute('src', 'blob:preview')
  await waitFor(() => expect(decodeImage).toHaveBeenCalledWith(file))
  expect(toScaledBlob).toHaveBeenCalledWith(bitmap, 1600)
  expect(onPhoto).not.toHaveBeenCalled()

  await act(async () => {
    resolveScaled(scaled)
  })

  expect(onPhoto).toHaveBeenCalledTimes(1)
  expect(onPhoto).toHaveBeenCalledWith(scaled)
  expect(close).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('the camera path runs the same validate/decode/downscale pipeline', async () => {
  const { cameraInput, onPhoto } = renderDropzone()
  const { bitmap, close } = makeBitmap()
  const scaled = new Blob(['scaled'], { type: 'image/png' })
  vi.mocked(decodeImage).mockResolvedValue(bitmap)
  vi.mocked(toScaledBlob).mockResolvedValue(scaled)
  const file = makePhoto()

  fireEvent.change(cameraInput, { target: { files: [file] } })

  expect(createObjectURL).toHaveBeenCalledWith(file)
  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(scaled))
  expect(decodeImage).toHaveBeenCalledWith(file)
  expect(toScaledBlob).toHaveBeenCalledWith(bitmap, 1600)
  expect(close).toHaveBeenCalledTimes(1)
  expect(onPhoto).toHaveBeenCalledTimes(1)
})

test('invalid type shows the exact error copy and never decodes', async () => {
  const { galleryInput, onPhoto } = renderDropzone()

  fireEvent.change(galleryInput, {
    target: { files: [new File(['hi'], 'notes.txt', { type: 'text/plain' })] },
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('请上传 JPG / PNG / WebP 图片')
  expect(decodeImage).not.toHaveBeenCalled()
  expect(onPhoto).not.toHaveBeenCalled()
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByAltText('已选照片预览')).not.toBeInTheDocument()
})

test('decode failure shows a clear error and no photo', async () => {
  const { galleryInput, onPhoto } = renderDropzone()
  vi.mocked(decodeImage).mockRejectedValue(new Error('decode failed'))

  fireEvent.change(galleryInput, { target: { files: [makePhoto()] } })

  expect(await screen.findByRole('alert')).toHaveTextContent('图片解析失败，请换一张试试')
  expect(onPhoto).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByAltText('已选照片预览')).not.toBeInTheDocument())
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

test('a preview URL failure does not leave the busy state stuck', async () => {
  const { galleryInput, onPhoto } = renderDropzone()
  createObjectURL.mockImplementationOnce(() => {
    throw new Error('createObjectURL failed')
  })

  fireEvent.change(galleryInput, { target: { files: [makePhoto()] } })

  expect(await screen.findByRole('alert')).toHaveTextContent('图片解析失败，请换一张试试')
  expect(screen.queryByText('正在处理照片…')).not.toBeInTheDocument()
  expect(decodeImage).not.toHaveBeenCalled()
  expect(onPhoto).not.toHaveBeenCalled()
})

test('status and errors sit outside the interactive buttons and the hint describes the gallery control', async () => {
  const { galleryButton, galleryInput } = renderDropzone()
  const { bitmap } = makeBitmap()
  vi.mocked(decodeImage).mockResolvedValue(bitmap)
  const scale = deferred<Blob>()
  vi.mocked(toScaledBlob).mockImplementation(() => scale.promise)

  expect(galleryButton).toHaveAccessibleName('把照片拖进来')
  expect(galleryButton).toHaveAccessibleDescription(/从相册选择 \/ 拖进来/)

  fireEvent.change(galleryInput, { target: { files: [makePhoto()] } })

  const status = await screen.findByText('正在处理照片…')
  expect(status.closest('button')).toBeNull()
  expect(status.closest('[role="button"]')).toBeNull()

  fireEvent.change(galleryInput, {
    target: { files: [new File(['hi'], 'notes.txt', { type: 'text/plain' })] },
  })

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('请上传 JPG / PNG / WebP 图片')
  expect(alert.closest('button')).toBeNull()
  expect(alert.closest('[role="button"]')).toBeNull()
  expect(screen.queryByText('正在处理照片…')).not.toBeInTheDocument()

  await act(async () => {
    scale.resolve(new Blob(['scaled'], { type: 'image/png' }))
  })
})

test('ignores an out-of-order success from an older selection', async () => {
  const { galleryInput, onPhoto } = renderDropzone()
  const fileA = makePhoto('a.png')
  const fileB = makePhoto('b.png')
  const { bitmap: bitmapA, close: closeA } = makeBitmap()
  const { bitmap: bitmapB, close: closeB } = makeBitmap()
  const scaledA = new Blob(['a'], { type: 'image/png' })
  const scaledB = new Blob(['b'], { type: 'image/png' })

  const decodeA = deferred<ImageBitmap>()
  const decodeB = deferred<ImageBitmap>()
  vi.mocked(decodeImage).mockImplementation((file) =>
    file === fileA ? decodeA.promise : decodeB.promise,
  )
  vi.mocked(toScaledBlob).mockImplementation((bitmap) =>
    Promise.resolve(bitmap === bitmapA ? scaledA : scaledB),
  )
  createObjectURL.mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b')

  fireEvent.change(galleryInput, { target: { files: [fileA] } })
  fireEvent.change(galleryInput, { target: { files: [fileB] } })
  expect(screen.getByAltText('已选照片预览')).toHaveAttribute('src', 'blob:b')

  await act(async () => {
    decodeB.resolve(bitmapB)
  })
  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(scaledB))
  expect(onPhoto).toHaveBeenCalledTimes(1)
  expect(closeB).toHaveBeenCalledTimes(1)

  await act(async () => {
    decodeA.resolve(bitmapA)
  })
  await waitFor(() => expect(closeA).toHaveBeenCalledTimes(1))

  expect(onPhoto).toHaveBeenCalledTimes(1)
  expect(onPhoto).toHaveBeenCalledWith(scaledB)
  expect(screen.getByAltText('已选照片预览')).toHaveAttribute('src', 'blob:b')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('ignores an out-of-order failure from an older selection', async () => {
  const { galleryInput, onPhoto } = renderDropzone()
  const fileA = makePhoto('a.png')
  const fileB = makePhoto('b.png')
  const { bitmap: bitmapB } = makeBitmap()
  const scaledB = new Blob(['b'], { type: 'image/png' })
  const decodeA = deferred<ImageBitmap>()

  vi.mocked(decodeImage).mockImplementation((file) =>
    file === fileA ? decodeA.promise : Promise.resolve(bitmapB),
  )
  vi.mocked(toScaledBlob).mockResolvedValue(scaledB)
  createObjectURL.mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b')

  fireEvent.change(galleryInput, { target: { files: [fileA] } })
  fireEvent.change(galleryInput, { target: { files: [fileB] } })

  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(scaledB))
  expect(onPhoto).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('正在处理照片…')).not.toBeInTheDocument()

  await act(async () => {
    decodeA.reject(new Error('late failure'))
  })
  await flushMicrotasks()

  expect(onPhoto).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByAltText('已选照片预览')).toHaveAttribute('src', 'blob:b')
})

test('toggles and clears the drag-over state', () => {
  const { dropzone, galleryButton } = renderDropzone()

  expect(dropzone).not.toHaveAttribute('data-dragging')
  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } })
  expect(dropzone).toHaveAttribute('data-dragging', 'true')
  fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } })
  // jsdom lacks DragEvent, so testing-library's dragLeave helper drops relatedTarget.
  fireEvent(
    dropzone,
    new MouseEvent('dragleave', {
      bubbles: true,
      cancelable: true,
      relatedTarget: galleryButton,
    }),
  )
  expect(dropzone).toHaveAttribute('data-dragging', 'true')

  fireEvent.dragLeave(dropzone)
  expect(dropzone).not.toHaveAttribute('data-dragging')

  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } })
  fireEvent.dragEnd(dropzone)
  expect(dropzone).not.toHaveAttribute('data-dragging')
})

test('dropping a valid photo runs the pipeline', async () => {
  const { dropzone, onPhoto } = renderDropzone()
  const { bitmap } = makeBitmap()
  const scaled = new Blob(['scaled'], { type: 'image/png' })
  vi.mocked(decodeImage).mockResolvedValue(bitmap)
  vi.mocked(toScaledBlob).mockResolvedValue(scaled)

  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } })
  fireEvent.drop(dropzone, { dataTransfer: { files: [makePhoto()] } })

  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(scaled))
  expect(dropzone).not.toHaveAttribute('data-dragging')
})
