import { Suspense } from "react";

import { BookDetails } from "@/components/books/book-details";

export default function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  return <Suspense fallback={<RouteFallback />}><BookContent params={params} /></Suspense>;
}

async function BookContent({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookDetails bookId={bookId} />;
}

function RouteFallback() { return <div className="min-h-40" aria-busy="true" />; }
