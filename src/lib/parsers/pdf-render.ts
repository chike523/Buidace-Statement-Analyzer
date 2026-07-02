import '@/lib/polyfills'

export async function renderPdfPagesToImages(buffer: ArrayBuffer): Promise<ImageData[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const images: ImageData[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    images.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
  }

  return images
}
