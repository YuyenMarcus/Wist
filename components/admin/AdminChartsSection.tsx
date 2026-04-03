'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const TIER_COLORS: Record<string, string> = {
  free: '#a1a1aa',
  pro: '#7c3aed',
  creator: '#d97706',
  enterprise: '#059669',
  other: '#71717a',
}

export function AdminChartsSection({
  weeklySignups,
  tierBreakdown,
}: {
  weeklySignups: { week: string; signups: number }[]
  tierBreakdown: { name: string; value: number }[]
}) {
  const pieData = tierBreakdown.filter((d) => d.value > 0).map((d) => ({ ...d, name: d.name === 'other' ? 'Other' : d.name }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Signups by week</h3>
        <p className="text-xs text-zinc-500 mb-4">Last 8 weeks (rolling)</p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklySignups} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-zinc-500" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e4e4e7',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="signups" name="Signups" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Users by plan</h3>
        <p className="text-xs text-zinc-500 mb-4">Share of profiles</p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={88}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={TIER_COLORS[entry.name.toLowerCase()] || TIER_COLORS.other} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e4e4e7',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
