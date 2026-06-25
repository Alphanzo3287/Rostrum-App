// =====================================================================
// The Rostrum · src/lib/deck.ts
// Turns whatever the host uploads into image pages the SlideStage can show.
// PDFs are rendered to PNG in the browser (one image per page); images pass
// through untouched. PPTX / Google Slides aren't readable here — export to
// PDF first, then upload.
// =====================================================================
import * as pdfjsLib from 'pdfjs-dist';
// Vite serves the worker file and gives us a URL to point pdf.js at.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

export async function rasterizeToImages(files: File[]): Promise<File[]> {
  const pages: File[] = [];
  for (const f of files) {
    if (isPdf(f)) {
      const data = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const stem = f.name.replace(/\.pdf$/i, '');
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // crisp at projector size
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        const blob: Blob = await new Promise((res, rej) =>
          canvas.toBlob(b => (b ? res(b) : rej(new Error('render failed'))), 'image/png'));
        pages.push(new File([blob], `${stem}-${String(i).padStart(3, '0')}.png`, { type: 'image/png' }));
      }
    } else if (f.type.startsWith('image/')) {
      pages.push(f);
    }
    // silently skip anything else (e.g. a stray .pptx)
  }
  return pages;
}
