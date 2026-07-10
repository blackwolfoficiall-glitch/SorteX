interface ProgressBarProps {
  value: number;
}

export default function ProgressBar({
  value,
}: ProgressBarProps) {
  return (
    <div className="h-3 w-full rounded-full bg-zinc-200">
      <div
        className="h-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}