export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-2 w-48 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="text-sm font-bold text-ink-2">Memuat data...</p>
    </div>
  );
}
