import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getViewer } from '#/lib/auth-guard.fns'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const me = await getViewer()
    if (!me) throw redirect({ to: '/sign-in' })
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <Outlet />
    </main>
  )
}
