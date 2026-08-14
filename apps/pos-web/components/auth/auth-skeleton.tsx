export function AuthSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[420px] space-y-6" aria-hidden>
      <div className="space-y-2">
        <div className="h-7 w-36 shimmer rounded-lg" />
        <div className="h-4 w-56 shimmer rounded" />
      </div>
      <div className="space-y-4">
        <div className="h-11 w-full shimmer rounded-xl" />
        <div className="h-11 w-full shimmer rounded-xl" />
        <div className="h-11 w-full shimmer rounded-xl" />
      </div>
    </div>
  );
}
