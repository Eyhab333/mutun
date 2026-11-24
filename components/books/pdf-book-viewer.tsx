"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PDFJS_WASM_URL = "/pdfjs/wasm/";
const pdfDocumentOptions = { wasmUrl: PDFJS_WASM_URL };

export function PdfBookViewer({
  fileUrl,
  pageNumber,
  onPageCount,
}: {
  fileUrl: string;
  pageNumber: number;
  onPageCount: (pageCount: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(680);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.min(860, entry.contentRect.width - 24)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("PDF.js runtime configuration.", {
        version: pdfjs.version,
        workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
        wasmUrl: PDFJS_WASM_URL,
      });
    }
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-80 justify-center overflow-auto rounded-xl border bg-muted/20 p-3 sm:p-5">
      <Document
        file={fileUrl}
        suspense={false}
        options={pdfDocumentOptions}
        onLoadSuccess={({ numPages }) => onPageCount(numPages)}
        loading={<p className="py-16 text-sm text-muted-foreground">جارٍ تحميل ملف PDF...</p>}
        error={<p className="py-16 text-sm text-destructive">تعذر عرض ملف PDF.</p>}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          loading={<p className="py-16 text-sm text-muted-foreground">جارٍ تحميل الصفحة...</p>}
        />
      </Document>
    </div>
  );
}
