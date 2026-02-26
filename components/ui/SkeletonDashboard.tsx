'use client'

export default function SkeletonDashboard() {
  return (
    <div className="min-h-screen bg-beige-50 dark:bg-dpurple-950 pb-32 animate-pulse">
      {/* Profile header skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-8 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-zinc-200" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-zinc-200 rounded" />
            <div className="h-3 w-24 bg-zinc-100 rounded" />
          </div>
          <div className="ml-auto flex gap-2">
            <div className="w-9 h-9 rounded-lg bg-zinc-100" />
            <div className="w-9 h-9 rounded-lg bg-zinc-100" />
          </div>
        </div>
        {/* Add item form skeleton */}
        <div className="h-12 bg-zinc-100 rounded-xl" />
      </div>

      {/* Cards grid skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-6 space-y-3 sm:space-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} height={heights[i % heights.length]} />
          ))}
        </div>
      </div>
    </div>
  )
}

const heights = [220, 280, 200, 260, 240, 300, 210, 250]

function SkeletonCard({ height }: { height: number }) {
  return (
    <div
      className="break-inside-avoid bg-beige-100 dark:bg-dpurple-900 rounded-xl border border-zinc-100 dark:border-dpurple-700 overflow-hidden"
      style={{ height }}
    >
      <div className="bg-zinc-100 w-full" style={{ height: height - 70 }} />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 bg-zinc-100 rounded" />
        <div className="h-3 w-1/3 bg-zinc-100 rounded" />
      </div>
    </div>
  )
}
