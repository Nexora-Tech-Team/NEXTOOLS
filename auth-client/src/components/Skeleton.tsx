// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-800 ${className}`} />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Bone className="h-4 w-2/3" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
        </div>
        <Bone className="h-8 w-8 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-20" />
      </div>
    </div>
  );
}

export function BoardColumnSkeleton() {
  return (
    <div className="w-[min(17rem,calc(100vw-3.75rem))] sm:w-68 flex-shrink-0 bg-[#1a2035]/60 rounded-xl px-2 pb-3 pt-1">
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-sm bg-slate-700 animate-pulse" />
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-5 ml-auto" />
      </div>
      {/* Cards */}
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#1e2330] border border-[#2a3147] rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
              <Bone className="h-2.5 w-14" />
              <Bone className="h-2.5 w-10" />
            </div>
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3 w-3/4" />
            <div className="flex gap-1.5">
              <Bone className="h-4 w-12 rounded" />
              <Bone className="h-4 w-14 rounded" />
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <Bone className="h-5 w-5 rounded-full" />
              <Bone className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardStatSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="h-8 w-8 rounded-lg" />
      </div>
      <Bone className="h-8 w-16" />
      <Bone className="h-2.5 w-32" />
    </div>
  );
}

export function DashboardRowSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <Bone className="h-7 w-24 rounded-lg" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-3 w-1/3" />
              <Bone className="h-2 w-full rounded-full" />
            </div>
            <Bone className="h-3 w-12 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabContentSkeleton() {
  return (
    <div className="px-5 py-4 space-y-4 animate-pulse">
      <div className="space-y-2">
        <Bone className="h-3 w-16" />
        <Bone className="h-9 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Bone className="h-3 w-12" /><Bone className="h-9 rounded-lg" /></div>
        <div className="space-y-1.5"><Bone className="h-3 w-12" /><Bone className="h-9 rounded-lg" /></div>
        <div className="space-y-1.5"><Bone className="h-3 w-14" /><Bone className="h-9 rounded-lg" /></div>
        <div className="space-y-1.5"><Bone className="h-3 w-16" /><Bone className="h-9 rounded-lg" /></div>
      </div>
      <div className="space-y-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
