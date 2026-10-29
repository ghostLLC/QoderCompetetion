import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UploadDropzone } from '@/features/upload/UploadDropzone'
import { decodeImage, toScaledBlob } from '@/lib/image'

vi.mock('@/lib/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image')>()
  return { ...actual, decodeImage: vi.fn(), toScaledBlob: vi.fn() }
})

const createObjectURL = vi.fn((_blob: Blob) => 'blob:preview')
const revokeObjectURL = vi.fn()

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
  vi.mocked(decodeImage).mockReset()
  vi.mocked(toScaledBlob).mockReset()
})

const makePhoto = (type = 'image/png') => new File([new Uint8Array(4)], 'photo.png', { type })

const makeBitmap = () => {
  const close = vi.fn()
  return { bitmap: { width: 4000, height: 3000, close } as unknown as ImageBitmap, close }
}

function renderDropzone() {
  const onPhoto = vi.fn()
  render(<UploadDropzone onPhoto={onPhoto} />)
  return {
    onPhoto,
    input: screen.getByLabelText('选择照片') as HTMLInputElement,
    dropzone: screen.getByRole('button', { name: /上传照片/ }),
  }
}

test('renders the sticker copy, image constraints and camera capture', () => {
  const { input } = renderDropzone()

  expect(screen.getByText('把照片拖进来')).toBeInTheDocument()
  expect(screen.getByText(/JPG \/ PNG \/ WebP/)).toBeInTheDocument()
  expect(input).toHaveAttribute('type', 'file')
  expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  expect(input).toHaveAttribute('capture', 'environment')
})

test('clicking the dropzone opens the file picker', () => {
  const { dropzone, input } = renderDropzone()
  const click = vi.spyOn(input, 'click')

  fireEvent.click(dropzone)

  expect(click).toHaveBeenCalledTimes(1)
})

test('valid photo: shows a preview, decodes, downscales, then calls onPhoto', async () => {
  const { input, onPhoto } = renderDropzone()
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

  fireEvent.change(input, { target: { files: [file] } })

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

test('invalid type shows the exact error copy and never decodes', async () => {
  const { input, onPhoto } = renderDropzone()

  fireEvent.change(input, {
    target: { files: [new File(['hi'], 'notes.txt', { type: 'text/plain' })] },
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('请上传 JPG / PNG / WebP 图片')
  expect(decodeImage).not.toHaveBeenCalled()
  expect(onPhoto).not.toHaveBeenCalled()
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByAltText('已选照片预览')).not.toBeInTheDocument()
})

test('decode failure shows a clear error and no photo', async () => {
  const { input, onPhoto } = renderDropzone()
  vi.mocked(decodeImage).mockRejectedValue(new Error('decode failed'))

  fireEvent.change(input, { target: { files: [makePhoto()] } })

  expect(await screen.findByRole('alert')).toHaveTextContent('图片解析失败，请换一张试试')
  expect(onPhoto).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByAltText('已选照片预览')).not.toBeInTheDocument())
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

test('toggles the drag-over state', () => {
  const { dropzone } = renderDropzone()

  expect(dropzone).not.toHaveAttribute('data-dragging')
  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } })
  expect(dropzone).toHaveAttribute('data-dragging', 'true')
  fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } })
  expect(dropzone).toHaveAttribute('data-dragging', 'true')
  fireEvent.dragLeave(dropzone)
  expect(dropzone).not.toHaveAttribute('data-dragging')
})

test('dropping a valid photo runs the pipeline', async () => {
  const { dropzone, onPhoto } = renderDropzone()
  const { bitmap } = makeBitmap()
  const scaled = new Blob(['scaled'], { type: 'image/png' })
  vi.mocked(decodeImage).mockResolvedValue(bitmap)
  vi.mocked(toScaledBlob).mockResolvedValue(scaled)

  fireEvent.drop(dropzone, { dataTransfer: { files: [makePhoto()] } })

  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(scaled))
  expect(dropzone).not.toHaveAttribute('data-dragging')
})
