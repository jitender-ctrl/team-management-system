export function SkeletonLine({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2">
      <SkeletonLine className="h-3 w-1/3" />
      <SkeletonLine className="h-6 w-1/2" />
      <SkeletonLine className="h-2 w-2/3" />
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-3">
              <SkeletonLine className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <SkeletonLine className="h-3 w-1/4 mb-3" />
      <SkeletonLine className="h-56 w-full" />
    </div>
  );
}
