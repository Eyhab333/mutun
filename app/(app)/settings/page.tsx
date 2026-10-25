import { PageContent } from "@/components/app-shell/page-content";
import { ReviewNotificationSettings } from "@/components/notifications/review-notification-settings";

export default function SettingsPage() {
  return (
    <PageContent
      title="الإعدادات"
      description="ستظهر هنا إعدادات التطبيق الشخصية."
    >
      <ReviewNotificationSettings />
    </PageContent>
  );
}
