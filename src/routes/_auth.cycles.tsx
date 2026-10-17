import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/cycles')({
  head: () => ({ meta: [{ title: 'Cycles · physlane' }] }),
  component: CyclesPage,
})

function CyclesPage() {
  return (
    <section className="pt-8">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Cycles</h1>
      <div className="card mt-4 p-6">
        <p className="m-0 text-sm text-dim">Coming in the next milestone.</p>
      </div>
    </section>
  )
}
