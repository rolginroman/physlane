import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/glp-1')({
	head: () => ({
		meta: [
			{ title: 'GLP-1 weight tracking, muscle and all · physlane' },
			{
				name: 'description',
				content:
					'On a GLP-1 the scale moves fast. physlane shows what the loss is made of: smoothed weight trend, honest calories, tape and body fat estimate. Not medical advice.',
			},
		],
	}),
	component: Glp1Page,
})

function Glp1Page() {
	return (
		<main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
			<header className="mb-10">
				<Link to="/" className="text-sm text-dim hover:text-text">
					← physlane
				</Link>
				<p className="mt-6 text-xs uppercase tracking-widest text-dim">For GLP-1 users</p>
				<h1 className="display-2 m-0 mt-2 text-text">The scale moves fast now. See what it is made of.</h1>
				<p className="mt-3 text-dim">
					A GLP-1 quiets your appetite and the number drops quickly. The useful question changes
					from how much to what: how much fat, how much lean mass, how few calories you are
					actually eating. physlane turns that into a weekly read you can act on and share.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link to="/sign-up" className="btn-primary no-underline">
						Start free
					</Link>
					<Link to="/guide" className="btn-ghost no-underline">
						How logging works
					</Link>
				</div>
			</header>

			<section aria-label="Example GLP-1 readout" className="mb-10 rounded-lg border border-neutral-800 p-4">
				<div className="mb-3 text-xs uppercase tracking-widest text-dim">Week 9 on treatment, illustrative</div>
				<dl className="m-0 space-y-2 text-sm">
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-dim">Weight</dt>
						<dd className="m-0 text-text">96.4 → 88.7 kg</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-dim">Waist</dt>
						<dd className="m-0 text-text">108 → 99 cm</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-dim">Body fat</dt>
						<dd className="m-0 text-text">33.1 → 29.4% (Navy estimate)</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-dim">Intake, 7-day average</dt>
						<dd className="m-0 text-text">1,640 kcal</dd>
					</div>
				</dl>
				<p className="m-0 mt-3 text-xs text-dim">
					Illustrative data, not a real user. Tape beats the scale for composition.
				</p>
			</section>

			<section aria-labelledby="glp1-watch" className="mb-10">
				<h2 id="glp1-watch" className="h3 m-0 mb-4 text-text">
					Three numbers, one weekly check
				</h2>
				<div className="space-y-4 text-sm leading-relaxed text-dim [&_strong]:text-text">
					<p className="m-0">
						<strong>Weight trend, smoothed.</strong> Daily weigh-ins, weekly slope. Water noise
						drops out and the real rate shows, so dose changes and plateaus become visible
						events, not feelings.
					</p>
					<p className="m-0">
						<strong>Calories, honestly.</strong> Low appetite days are exactly the days worth
						logging. A running 7-day average tells you whether intake is too low to hold on to
						muscle.
					</p>
					<p className="m-0">
						<strong>Waist and neck tape.</strong> Thirty seconds with a tape gives a Navy body
						fat estimate. If weight falls and the estimate holds steady, most of the loss is
						fat.
					</p>
					<p className="m-0">
						<strong>GLP-1 mode (Pro).</strong> One switch changes the weekly verdicts: they stop
						talking about deficits, because the medication already handles appetite, and start
						talking about hitting your calorie target and keeping protein high.
					</p>
				</div>
			</section>

			<section aria-labelledby="glp1-visits" className="mb-10">
				<h2 id="glp1-visits" className="h3 m-0 mb-4 text-text">
					For your visits
				</h2>
				<div className="space-y-4 text-sm leading-relaxed text-dim [&_strong]:text-text">
					<p className="m-0">
						<strong>Walk in with numbers, not memories.</strong> Every check-in is already
						timestamped. A share card or a CSV export hands your clinician the whole story in
						seconds: rate of loss, intake average, composition trend.
					</p>
					<p className="m-0">
						<strong>Honest boundaries.</strong> physlane is a tracker, not medical advice. It
						does not dose, diagnose, or replace your care team. Questions about your medication
						belong with your prescriber. The body fat figure is an estimate from a tape
						measure, with real error bars.
					</p>
				</div>
			</section>

			<section className="rounded-lg border border-neutral-800 p-5">
				<h2 className="h3 m-0 text-text">Treatment is their job. Data is yours.</h2>
				<p className="mt-2 text-sm text-dim">
					Twenty seconds a day, in any browser or from the Telegram menu button, keeps the whole
					picture in one place. The free tier does the tracking; Pro, with GLP-1 mode, is $10 a
					month or $100 a year.
				</p>
				<Link to="/sign-up" className="btn-primary mt-4 no-underline">
					Create an account
				</Link>
			</section>

			<footer className="mt-10 text-xs text-dim">
				<Link to="/" className="hover:text-text">
					Home
				</Link>
				{' · '}
				<Link to="/guide" className="hover:text-text">
					Guide
				</Link>
				{' · Not medical advice'}
			</footer>
		</main>
	)
}
