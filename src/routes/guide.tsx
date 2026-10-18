import { createFileRoute, Link } from '@tanstack/react-router'
import LandingShell from '../components/landing/LandingShell'

const SITE_URL = 'https://physlane.unpackit.top'
const TITLE = 'Guide: calories, targets, and where the numbers come from · physlane'
const DESCRIPTION =
  'How calorie targets work, how physlane measures your daily burn instead of guessing it, and the research behind every number. For beginners and for people who already track.'

export const Route = createFileRoute('/guide')({
	head: () => ({
		meta: [
			{ title: TITLE },
			{
				name: 'description',
				content: DESCRIPTION,
			},
			{ name: 'robots', content: 'index, follow' },
			{ name: 'theme-color', content: '#ffffff' },
			{ property: 'og:site_name', content: 'physlane' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: `${SITE_URL}/guide` },
			{ property: 'og:title', content: TITLE },
			{ property: 'og:description', content: DESCRIPTION },
			{ property: 'og:image', content: `${SITE_URL}/og.png` },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:title', content: TITLE },
			{ name: 'twitter:description', content: DESCRIPTION },
			{ name: 'twitter:image', content: `${SITE_URL}/og.png` },
		],
		links: [{ rel: 'canonical', href: `${SITE_URL}/guide` }],
	}),
	component: GuidePage,
})

function GuidePage() {
	return (
		<LandingShell current="guide">
			<div className="wrap article">
				<header className="head">
					<p className="kicker">Guide</p>
					<h1>Calories, targets, and where the numbers come from</h1>
					<p className="sub">
						A short field guide in three parts: the basics if you have never tracked, the
						method if you already do, and the research behind every number physlane shows
						you.
					</p>
				</header>

				<section aria-labelledby="guide-new">
					<h2 id="guide-new">Part 1 · New to tracking</h2>
					<div>
						<p>
							<strong>A calorie is a unit of food energy.</strong> Your body burns energy
							every day to stay alive and move around. Eat less than you burn and you lose
							weight. Eat more and you gain. Every diet that has ever worked is a version of
							that one sentence. The hard part is knowing how much you actually burn, and
							that is the part physlane measures for you.
						</p>
						<p>
							<strong>Your job is two numbers a day.</strong> Your morning weight, and the
							calories you ate. For the food side, food labels, restaurant menus, or a
							five-second web search all work. One total for the day is enough. You do not
							need to log meals or ingredients separately, and close counts: consistent
							and slightly wrong beats exact once a week.
						</p>
						<p>
							<strong>Weigh in under the same conditions.</strong> Morning, after the
							bathroom, before food or drink. The scale jumps around for reasons that are
							not fat: salt, stored carbs, water, and for women the cycle phase. A kg
							swing overnight is normal. The trend line is what matters, and the trend
							does not care about any single day.
						</p>
						<p>
							<strong>The daily target is an aim, not a rule.</strong> It gives the intake
							strip something to measure against while the app learns your burn. Miss it
							and nothing breaks. You can also leave it empty: after about 14 days of
							weight and calorie logs, physlane suggests a target based on your measured
							burn instead of a guess.
						</p>
						<p>
							<strong>Sane rates.</strong> Most people do well losing 0.5 to 1 percent of
							body weight per week, or about 0.5 kg a week if you are near 80 kg. Faster
							is possible and usually costs muscle and sanity. If you eat under 1,200
							kcal a day regularly, take a GLP-1 medication, or have a medical condition
							that affects weight, involve a doctor in your target.
						</p>
						<p>
							<strong>The first two weeks are just logging.</strong> No verdicts, no
							judgment. The app is quietly turning your weight and food numbers into
							your personal burn rate. From then on it tells you, weekly, whether your
							pace matches your goal.
						</p>
					</div>
				</section>

				<section aria-labelledby="guide-adv">
					<h2 id="guide-adv">Part 2 · Already know your numbers</h2>
					<div>
						<p>
							<strong>The method is back-calculation.</strong> Your total daily energy
							expenditure (TDEE, the calories you burn per day) falls straight out of
							energy balance: over any window, average intake minus the calories implied
							by weight change equals burn. Log 2,000 a day and lose 0.5 kg a week, and
							your burn is about 2,550. physlane runs this on rolling 14-day windows of
							same-day weight and calorie pairs, so one wild weekend does not rewrite
							your estimate.
						</p>
						<p>
							<strong>Why 7,700 kcal per kg, and why it drifts.</strong> The 7,700 kcal per
							kg (3,500 per pound) rule comes from Wishnofsky's 1958 analysis. It assumes
							a fixed mix of tissue lost. Hall's 2011 Lancet model shows the real energy
							cost of a kilogram rises as you diet: less water and glycogen per kilogram
							over time, plus metabolic adaptation. physlane uses 7,700 as a stable weekly
							converter within a 90-day window, not a lifetime constant, and the weekly
							rate verdict allows ±0.1 kg of water noise.
						</p>
						<p>
							<strong>Why no BMR formula.</strong> Mifflin-St Jeor and similar equations
							predict a population average, and individuals scatter roughly 10 to 15
							percent around it. You may sit anywhere in that spread, and two weeks of
							your own data locate you exactly. That is the entire product: measured
							instead of assumed.
						</p>
						<p>
							<strong>About the day-one prefill.</strong> Before any data exists, onboarding
							suggests weight × 32 kcal per kg (33 for men, 31 for women), adjusted by
							your goal rate. It is a population shortcut, it says so on the screen, and
							the measured number replaces it. If you already know your TDEE from past
							tracking, type your own target and skip the guess.
						</p>
						<p>
							<strong>Body fat from a tape.</strong> The body fat figure uses the US Navy
							circumference method (Hodgdon and Beckett, 1984) with Siri's 1956 equation
							to convert body density to a percent. Tape methods carry a few percent of
							error versus lab tools. Measured the same way each week, the direction of
							travel is the useful signal.
						</p>
					</div>
				</section>

				<section aria-labelledby="guide-ref">
					<h2 id="guide-ref">Part 3 · References</h2>
					<p>
						The research behind the numbers above. Citations are given so you can check
						our work, which is the whole idea.
					</p>
					<ul>
						<li>
							<span className="t">Wishnofsky, M. (1958).</span> Caloric equivalents
							of gained or lost weight. <em>American Journal of Clinical Nutrition</em>,
							6(5), 542-546. The origin of the 3,500 kcal per pound rule.
						</li>
						<li>
							<span className="t">Hall, K. D., Sacks, G., Chandramohan, D., Chow,
							C. C., Wang, Y. C., Gortmaker, S. L., &amp; Swinburn, B. A. (2011).</span>{' '}
							Quantification of the effect of energy imbalance on bodyweight.{' '}
							<em>The Lancet</em>, 378(9793), 826-837. Why static calorie math drifts as
							you diet. The same lab's public tool is the NIH Body Weight Planner.
						</li>
						<li>
							<span className="t">Mifflin, M. D., St Jeor, S. T., Hill, L. A.,
							Scott, B. J., Daugherty, S. A., &amp; Koh, Y. O. (1990).</span> A new
							predictive equation for resting energy expenditure in healthy individuals.{' '}
							<em>American Journal of Clinical Nutrition</em>, 51(2), 241-247. The best
							of the population formulas. We still prefer measuring you.
						</li>
						<li>
							<span className="t">Siri, W. E. (1956).</span> The gross composition
							of the body. <em>Advances in Biological and Medical Sciences</em>, 4,
							239-280. Body density to percent fat.
						</li>
						<li>
							<span className="t">Hodgdon, J. A., &amp; Beckett, M. B. (1984).</span>{' '}
							Prediction of percent body fat for U.S. Navy men and women from body
							circumferences and heights. Naval Health Research Center. The tape method
							behind our body fat estimate.
						</li>
						<li>
							<span className="t">Helms, E. R., Aragon, A. A., &amp; Fitschen, P.
							J. (2014).</span> Evidence-based recommendations for natural bodybuilding
							contest preparation: nutrition and supplementation. <em>Journal of the
							International Society of Sports Nutrition</em>, 11, 20. Where the 0.5 to 1
							percent of body weight per week guidance comes from.
						</li>
					</ul>
				</section>

				<div className="end">
					<p>
						That is the whole model: weigh in, log the day, let the math find your number.{' '}
						<Link to="/sign-up">Start free</Link>.
					</p>
					<p className="fine">
						This guide is general information, not medical advice.
					</p>
				</div>
			</div>
		</LandingShell>
	)
}
