import { Bars, TrendChart } from './charts'

const DASH_BARS = [60, 85, 45, 100, 70, 55, 90]
const TABS = ['Overview', 'Log', 'Analytics'] as const

/** Weight-trend card from the dashboard preview. Example values. */
export function WeightTrendCard({ chartHeight }: { chartHeight?: number }) {
  return (
    <div className="site-card">
      <div className="card-head">
        <span className="card-title">Weight trend</span>
        <div className="seg">
          <span>1W</span>
          <span className="on">1M</span>
          <span>3M</span>
          <span>1Y</span>
        </div>
      </div>
      <div className="metric-row">
        <span className="metric-lg site-num">
          78.4<span className="unit">kg</span>
        </span>
        <span className="delta site-num">
          −2.1 kg<small>vs 2 weeks ago</small>
        </span>
      </div>
      <TrendChart height={chartHeight} />
    </div>
  )
}

/**
 * Example dashboard card (DESIGN.md §8.1). `tab` selects the highlighted tab
 * in the bar; the cards are the same on every tab.
 */
export default function DashboardPreview({ tab = 'Overview' }: { tab?: (typeof TABS)[number] }) {
  return (
    <div
      className="dash"
      role="img"
      aria-label="Example dashboard. Weight trend: 78.4 kg, down 2.1 kg in two weeks. Estimated daily burn: 2,340 kcal per day, likely range 2,140 to 2,540. Example values."
    >
      <div className="dash-bar">
        <span className="wm">physlane</span>
        <div className="tabs">
          {TABS.map((t) => (
            <span key={t} className={t === tab ? 'on' : undefined}>
              {t}
            </span>
          ))}
        </div>
        <span className="chip">Last 30 days</span>
      </div>
      <div className="dash-body">
        <WeightTrendCard chartHeight={230} />
        <div className="stack">
          <div className="site-card burn-card">
            <div className="card-head">
              <span className="card-title">Estimated daily burn</span>
              <span className="tag est">Estimate</span>
            </div>
            <div className="metric-lg site-num" style={{ marginTop: 12 }}>
              2,340<span className="unit">kcal/day</span>
            </div>
            <div className="range" aria-hidden="true">
              <i style={{ left: '50%' }} />
            </div>
            <div className="range-ends caption site-num">
              <span>2,140</span>
              <span>likely range</span>
              <span>2,540</span>
            </div>
          </div>
          <div className="site-card cal-card">
            <div className="card-head">
              <span className="card-title">Daily calories (avg)</span>
              <span className="tag">Logged</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginTop: 12 }}>
              <span className="metric-md site-num">
                1,950
                <span className="unit" style={{ fontSize: '.6em' }}>
                  kcal
                </span>
              </span>
              <Bars heights={DASH_BARS} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
