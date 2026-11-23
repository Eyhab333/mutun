import { Suspense } from "react";

import { BookReader } from "@/components/books/book-reader";

export default function BookReadPage({ params }: { params: Promise<{ bookId: string }> }) {
  return <Suspense fallback={<RouteFallback />}><ReaderContent params={params} /></Suspense>;
}

async function ReaderContent({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookReader bookId={bookId} />;
}

function RouteFallback() { return <div className="min-h-40" aria-busy="true" />; }
