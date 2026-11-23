import { BookAdminWorkspace } from "@/components/admin/books/book-admin-workspace";
import { PageHeader } from "@/components/app-shell/page-header";

export const instant = false;

export default function AdminBooksPage() {
  return <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><PageHeader title="قراءة الكتب" description="نظّم مجموعات الكتب والكتب داخل المستويات والعلوم الحالية." /><BookAdminWorkspace /></section>;
}
