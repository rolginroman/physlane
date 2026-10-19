import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

export type ChartProps = {
  data: Array<{ x: number | string; y: number }>
  title: string
  source?: string
}

export default function Chart({ data, title, source }: ChartProps) {
  const chartData = data.map((point) => ({ name: String(point.x), value: point.y }))

  return (
    <figure role="img" aria-label={title} className="blog-chart">
      <figcaption className="site-label">{title}</figcaption>
      <div className="blog-chart-canvas">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-ink)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-ink)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {source ? <p className="blog-chart-source caption">{source}</p> : null}
    </figure>
  )
}
