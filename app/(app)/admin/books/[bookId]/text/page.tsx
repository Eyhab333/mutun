import { Suspense } from "react";

import { BookTextEditor } from "@/components/admin/books/book-text-editor";

export default function BookTextEditorPage({ params }: { params: Promise<{ bookId: string }> }) {
  return <Suspense fallback={<div className="min-h-40" aria-busy="true" />}><BookTextEditorContent params={params} /></Suspense>;
}

async function BookTextEditorContent({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookTextEditor bookId={bookId} />;
}
