type FocusCounterProps = {
  count: number;
  disabled: boolean;
  onIncrement: () => void;
  incrementLabel?: string;
};

export function FocusCounter({
  count,
  disabled,
  onIncrement,
  incrementLabel = "اضغط لإضافة تكرار",
}: FocusCounterProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onIncrement}
      aria-label="إضافة تكرار واحد"
      className="flex size-52 touch-manipulation flex-col items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-sm transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:size-60"
    >
      <span className="text-6xl font-semibold tabular-nums sm:text-7xl">{count}</span>
      <span className="mt-2 text-sm font-medium opacity-85">{incrementLabel}</span>
    </button>
  );
}
