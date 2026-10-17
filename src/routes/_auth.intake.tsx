import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/intake')({
  head: () => ({ meta: [{ title: 'Intake · physlane' }] }),
  component: IntakePage,
})

function IntakePage() {
  return (
    <section className="pt-8">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Intake</h1>
      <div className="card mt-4 p-6">
        <p className="m-0 text-sm text-dim">Coming in the next milestone.</p>
      </div>
    </section>
  )
}
