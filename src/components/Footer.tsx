import { Link } from '@tanstack/react-router'

export default function Footer() {
  return (
    <footer className="px-4 py-6">
      <p className="m-0 text-center text-xs text-faint">
        physlane · manual numbers only, no bank or social integrations ·{' '}
        <Link
          to="/billing"
          className="inline-flex items-center px-2 py-2 text-dim underline decoration-line underline-offset-2 hover:text-text"
        >
          Pricing
        </Link>
      </p>
    </footer>
  )
}
