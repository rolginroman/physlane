import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "#/lib/cn";

/** Dark mode inverts the tile: a dark code on a dark page scans poorly. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(value, { ecc: "M", border: 0 });
    let d = "";
    data.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (!row[x]) {
          x += 1;
          continue;
        }
        const start = x;
        while (x < row.length && row[x]) x += 1;
        d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
      }
    });
    return { size, path: d };
  }, [value]);

  return (
    <div
      className={cn(
        "shrink-0 rounded-lg border border-border bg-background p-2 text-foreground dark:bg-foreground dark:text-background",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="size-28"
        shapeRendering="crispEdges"
      >
        <path d={path} fill="currentColor" />
      </svg>
    </div>
  );
}
