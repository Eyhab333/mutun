import { LoaderCircle } from "lucide-react";

type AuthLoadingStateProps = {
  message?: string;
};

export function AuthLoadingState({
  message = "جارٍ التحقق من الجلسة...",
}: AuthLoadingStateProps) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        <span>{message}</span>
      </div>
    </main>
  );
}
