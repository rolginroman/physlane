/**
 * Example charts for the public site, computed during render (SSR-safe).
 * Colours are theme tokens via CSS vars; text styling comes from `.chart text`
 * in src/styles/site.css. All values are illustrative.
 */

/** Example weight series, Oct 1 to Oct 29 (kg). */
const WEIGHTS = [
  80.6, 80.3, 80.0, 80.0, 79.8, 79.9, 79.5, 79.4, 79.2, 79.4, 79.0, 78.9, 79.0,
  78.7, 78.6, 78.4,
];

const points = (pts: [number, number][]) =>
  pts.map(([x, y]) => `${x},${y}`).join(" ");

/** Places an overlay label at viewBox point (x, y). */
type At = (x: number, y: number) => { x: string; y: string };

/**
 * A chart whose marks scale with the viewBox while its labels do not: `labels`
 * render in an unscaled overlay at the same viewBox positions (as percentages),
 * so `.chart text` font sizes are real CSS px at every chart width.
 */
function Chart({
  width,
  height,
  className,
  labels,
  children,
  ...aria
}: {
  width: number;
  height: number;
  className?: string;
  labels: (at: At) => React.ReactNode;
  children: React.ReactNode;
  role?: string;
  "aria-label"?: string;
}) {
  const at: At = (x, y) => ({
    x: `${(x / width) * 100}%`,
    y: `${(y / height) * 100}%`,
  });
  return (
    <div className={className ? `chart ${className}` : "chart"} {...aria}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {children}
      </svg>
      <svg className="chart-labels" aria-hidden="true">
        {labels(at)}
      </svg>
    </div>
  );
}

/** Decorative bar strip; heights in percent of the strip. */
export function Bars({
  heights,
  style,
}: {
  heights: number[];
  style?: React.CSSProperties;
}) {
  return (
    <span className="bars" style={style} aria-hidden="true">
      {heights.map((h, i) => (
        <i key={i} style={{ height: `${h}%` }} />
      ))}
    </span>
  );
}

/** `height` sets the viewBox height; the plot grows, the labels keep their size. */
export function TrendChart({ height = 170 }: { height?: number }) {
  const L = 26,
    R = 352,
    T = 12,
    B = height - 30,
    lo = 75.5,
    hi = 81.5;
  const X = (i: number) => L + (i * (R - L)) / (WEIGHTS.length - 1);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (B - T);
  const last = WEIGHTS.length - 1;
  return (
    <Chart
      width={360}
      height={height}
      labels={(at) => (
        <>
          {[81, 79, 77].map((v) => (
            <text key={v} {...at(0, Y(v))} dy="0.35em">
              {v}
            </text>
          ))}
          <text {...at(R, Y(76) - 6)} textAnchor="end">
            Target 76 kg
          </text>
          {["Oct 1", "Oct 8", "Oct 15", "Oct 22", "Oct 29"].map((d, i) => (
            <text
              key={d}
              {...at(L + (i * (R - L)) / 4, height - 6)}
              textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
              className={i % 2 ? "tick-minor" : undefined}
            >
              {d}
            </text>
          ))}
        </>
      )}
    >
      {[81, 79, 77].map((v) => (
        <line
          key={v}
          x1={L}
          x2={R}
          y1={Y(v)}
          y2={Y(v)}
          stroke="var(--color-chart-grid)"
        />
      ))}
      <line
        x1={L}
        x2={R}
        y1={Y(76)}
        y2={Y(76)}
        stroke="var(--color-chart-neutral)"
        strokeDasharray="4 4"
      />
      <polyline
        points={points(WEIGHTS.map((v, i) => [X(i), Y(v)]))}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.5}
      />
      {WEIGHTS.map((v, i) => (
        <circle
          key={i}
          cx={X(i)}
          cy={Y(v)}
          r={i === last ? 4.5 : 2.6}
          fill={i === last ? "var(--color-brand)" : "var(--color-ink)"}
        />
      ))}
    </Chart>
  );
}

export function SparkChart() {
  const n = WEIGHTS.length;
  const pts = WEIGHTS.map((v, i): [number, number] => [
    (i * 196) / (n - 1) + 2,
    4 + ((80.8 - v) / 2.6) * 40,
  ]);
  const [lx, ly] = pts[n - 1];
  return (
    <svg className="chart" viewBox="0 0 200 48" aria-hidden="true">
      <polyline
        points={points(pts)}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.5}
      />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--color-brand)" />
    </svg>
  );
}

/** Estimate range narrowing over 28 days vs a flat generic-formula line. */
export function ConvergeChart() {
  const L = 64,
    R = 508,
    T = 34,
    B = 236,
    lo = 1950,
    hi = 2950;
  const X = (d: number) => L + ((d - 1) / 27) * (R - L);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (B - T);
  const up: [number, number][] = [];
  const dn: [number, number][] = [];
  const mid: [number, number][] = [];
  for (let d = 1; d <= 28; d++) {
    const spread = 300 * Math.exp(-(d - 1) / 9) + 80;
    const c = 2340 + 230 * Math.exp(-(d - 1) / 6);
    up.push([X(d), Y(c + spread)]);
    dn.unshift([X(d), Y(c - spread)]);
    mid.push([X(d), Y(c)]);
  }
  return (
    <Chart
      width={520}
      height={280}
      className="chart-wide"
      role="img"
      aria-label="Chart: the estimated burn range is wide at first and narrows after day 14, settling below the generic formula value."
      labels={(at) => (
        <>
          {[2100, 2400, 2700].map((v) => (
            <text key={v} {...at(0, Y(v))} dy="0.35em">
              {v.toLocaleString("en-US")}
            </text>
          ))}
          <text
            {...at(X(14) + 6, T - 8)}
            style={{ fill: "var(--color-brand-text)", fontWeight: 500 }}
          >
            Day 14: first estimate
          </text>
          {/* Narrow charts drop "Generic" so the label stays right of the day-14 line. */}
          <text {...at(R, Y(2610) - 7)} textAnchor="end" className="label-long">
            Generic formula · 2,610
          </text>
          <text
            {...at(R, Y(2610) - 7)}
            textAnchor="end"
            className="label-short"
          >
            Formula · 2,610
          </text>
          <text
            {...at(R, Y(2340) + 26)}
            textAnchor="end"
            style={{ fill: "var(--color-ink)", fontWeight: 500 }}
          >
            Your estimate · 2,340
          </text>
          {[1, 7, 14, 21, 28].map((d) => (
            <text
              key={d}
              {...at(X(d), 262)}
              textAnchor={d === 1 ? "start" : d === 28 ? "end" : "middle"}
              className={d === 7 || d === 21 ? "tick-minor" : undefined}
            >
              {`Day ${d}`}
            </text>
          ))}
        </>
      )}
    >
      {[2100, 2400, 2700].map((v) => (
        <line
          key={v}
          x1={L}
          x2={R}
          y1={Y(v)}
          y2={Y(v)}
          stroke="var(--color-chart-grid)"
        />
      ))}
      <polygon points={points(up.concat(dn))} fill="var(--color-brand-soft)" />
      <line
        x1={L}
        x2={R}
        y1={Y(2610)}
        y2={Y(2610)}
        stroke="var(--color-chart-neutral)"
        strokeDasharray="5 5"
      />
      <polyline
        points={points(mid)}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={2}
      />
      <line
        x1={X(14)}
        x2={X(14)}
        y1={T}
        y2={B}
        stroke="var(--color-brand)"
        strokeDasharray="2 4"
      />
      <circle
        cx={X(28)}
        cy={Y(2340 + 230 * Math.exp(-27 / 6))}
        r={4.5}
        fill="var(--color-brand)"
      />
    </Chart>
  );
}

/** ConvergeChart in a card with its legend caption. */
export function ConvergeFigure() {
  return (
    <figure className="site-card" style={{ margin: 0, padding: 24 }}>
      <div className="card-head">
        <span className="card-title">Estimate vs. formula</span>
        <span className="caption">example</span>
      </div>
      <ConvergeChart />
      <figcaption className="caption" style={{ marginTop: 8 }}>
        Shaded: likely range. Solid: your estimate. Dashed: generic formula.
      </figcaption>
    </figure>
  );
}
