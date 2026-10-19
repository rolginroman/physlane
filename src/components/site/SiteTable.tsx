import type { ReactNode } from 'react'

/** A cell that is only a number, optionally signed and with a short unit. */
const isNumeric = (cell: ReactNode) => typeof cell === 'string' && /^[≈±+−-]?\s?[\d.,]+(\s?[a-z%/]{1,6})?$/i.test(cell)

/** Two-or-more column spec table: hairline rules, tabular figures in numeric cells, no zebra. */
export default function SiteTable({
  caption,
  columns,
  rows,
}: {
  caption?: string
  columns: string[]
  rows: ReactNode[][]
}) {
  return (
    <table className="site-table">
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={j} className={isNumeric(cell) ? 'num' : undefined}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
