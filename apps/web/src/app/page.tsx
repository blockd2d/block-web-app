import React from 'react';
import Link from 'next/link';
import { Button } from '../ui/button';

export const metadata = {
  title: 'Block — Territory Clustering + Field Sales Ops',
  description:
    'Block is a multi-tenant field sales + ops platform built for door-to-door teams and pressure washing businesses: territory clustering, rep performance, messaging, jobs, and exports.'
};

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-6">{children}</section>;
}

export default function MarketingPage() {
  const baseUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Block',
        url: baseUrl,
        logo: `${baseUrl}/og.png`
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Block',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        description:
          'Territory clustering and field sales operations platform for door-to-door teams and pressure washing businesses.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/PreOrder'
        }
      }
    ]
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Section>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primaryForeground shadow-soft">
                <span className="text-sm font-extrabold">B</span>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Block</div>
                <div className="text-xs text-mutedForeground">Territory + Ops</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/join">
                <Button size="sm">Join</Button>
              </Link>
            </div>
          </div>
        </Section>
      </header>

      <Section>
        <div className="relative py-16">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-mutedForeground shadow-soft">
                <span className="font-medium text-foreground">Block V7</span>
                <span>•</span>
                <span>Built for door-to-door + pressure washing</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
                Territory clustering that turns a fat CSV into rep-ready routes.
              </h1>
              <p className="mt-4 max-w-xl text-base text-mutedForeground">
                Block is a multi-tenant field sales operations platform: cluster properties into territories, assign reps, track
                performance, run messaging workflows, and hand completed jobs to labor — without spreadsheets.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/join">
                  <Button size="lg">Get started</Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="secondary" size="lg">
                    See how it works
                  </Button>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-xs text-mutedForeground">
                <span className="rounded-full border border-border bg-card px-3 py-1">Territory clustering</span>
                <span className="rounded-full border border-border bg-card px-3 py-1">Door-to-door CRM</span>
                <span className="rounded-full border border-border bg-card px-3 py-1">Pressure washing ops</span>
                <span className="rounded-full border border-border bg-card px-3 py-1">Rep + labor mobile apps</span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <div className="text-sm font-semibold">What you get</div>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="font-medium">Cluster territories</div>
                      <div className="text-xs text-mutedForeground">Radius + min houses + price filters.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-accent" />
                    <div>
                      <div className="font-medium">Operational messaging</div>
                      <div className="text-xs text-mutedForeground">Threaded SMS hub with resolutions + DNK.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-ring" />
                    <div>
                      <div className="font-medium">Jobs + labor handoff</div>
                      <div className="text-xs text-mutedForeground">Signatures, photos, and Stripe payment links.</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/40 p-4 text-xs text-mutedForeground">
                  Want a demo dataset + dashboards populated out of the box? Run the included seed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="py-12">
          <h2 className="text-2xl font-bold">Built for territory clustering and field sales ops</h2>
          <p className="mt-2 max-w-2xl text-sm text-mutedForeground">
            Block is optimized for door-to-door and service businesses (pressure washing, maintenance, exterior cleaning) that need
            repeatable territories, consistent rep performance tracking, and clean ops handoffs.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Territories in minutes', body: 'Import a CSV and generate clusters that reps can actually work.' },
              { title: 'Multi-tenant org isolation', body: 'Separate orgs, counties, users, and data — built-in from day one.' },
              { title: 'Rep + labor mobile', body: 'Reps sell and follow up. Labor runs jobs, photos, signatures, and payment links.' },
              { title: 'Ops-grade messaging hub', body: 'Resolve threads, mark DNK, reassign, and optionally intervene as the company.' },
              { title: 'Exports + contracts', body: 'Generate exports for assignments, follow-ups, and job operations.' },
              { title: 'Analytics that don\'t lie', body: 'Dashboards, timeseries, and leaderboards populated by seed + real activity.' }
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="text-sm font-semibold">{b.title}</div>
                <div className="mt-2 text-sm text-mutedForeground">{b.body}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div id="how-it-works" className="py-12">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { step: '1', title: 'Import + cluster', body: 'Upload property data (lat/lng + attributes). Generate clusters with guardrails.' },
              { step: '2', title: 'Assign + execute', body: 'Assign clusters to reps and track doors, leads, quotes, and sold.' },
              { step: '3', title: 'Close the loop', body: 'Messaging workflows + job handoff to labor with signatures, photos, and payment collection.' }
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                    <span className="font-bold">{s.step}</span>
                  </div>
                  <div className="text-sm font-semibold">{s.title}</div>
                </div>
                <p className="mt-3 text-sm text-mutedForeground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="py-12">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <h2 className="text-2xl font-bold">Proof</h2>
            <p className="mt-2 text-sm text-mutedForeground">
              Add testimonials, case studies, or screenshots here. This section is intentionally a placeholder for launch assets.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {['"We doubled doors per hour."', '"Territories stopped overlapping."', '"Ops finally has control."'].map((q) => (
                <div key={q} className="rounded-2xl border border-dashed border-border bg-background/40 p-4 text-sm text-mutedForeground">
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="py-12">
          <h2 className="text-2xl font-bold">Pricing</h2>
          <p className="mt-2 text-sm text-mutedForeground">Simple tiers as you scale reps and counties. Full pricing coming soon.</p>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { name: 'Starter', desc: 'Single county, small team, core clustering + CRM', emphasis: false },
              { name: 'Growth', desc: 'Multi-county ops + messaging workflows + exports', emphasis: true },
              { name: 'Scale', desc: 'Enterprise controls + custom workflows + SLA', emphasis: false }
            ].map((t) => (
              <div
                key={t.name}
                className={`rounded-3xl border ${t.emphasis ? 'border-primary' : 'border-border'} bg-card p-6 shadow-soft`}
              >
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="mt-2 text-sm text-mutedForeground">{t.desc}</div>
                <div className="mt-6">
                  <Link href="/login">
                    <Button variant={t.emphasis ? 'primary' : 'secondary'} className="w-full">
                      Talk to sales
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="py-12">
          <h2 className="text-2xl font-bold">FAQ</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { q: 'Does Block work for pressure washing?', a: 'Yes — it\'s designed around pressure washing + exterior services (territories, follow-ups, jobs, labor handoff).' },
              { q: 'Do reps need a laptop?', a: 'No. Rep and labor roles are mobile-only. Managers/admins use the web app.' },
              { q: 'How does messaging work?', a: 'SMS is handled via Twilio through the backend API. The web app shows ops-grade threads and controls.' },
              { q: 'Can we export territories and assignments?', a: 'Yes. Exports are generated by the backend and stored in Supabase Storage.' }
            ].map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="text-sm font-semibold">{f.q}</div>
                <div className="mt-2 text-sm text-mutedForeground">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="py-12">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <h2 className="text-2xl font-bold">Ready to run tighter territories?</h2>
            <p className="mt-2 text-sm text-mutedForeground">
              Start with the demo seed to see dashboards, analytics, messaging threads, and exports populate instantly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/join">
                <Button size="lg">Join</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="lg">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          <footer className="mt-10 border-t border-border py-8 text-xs text-mutedForeground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>© {new Date().getFullYear()} Block</div>
              <div className="flex items-center gap-3">
                <span>Territory clustering</span>
                <span>•</span>
                <span>Door-to-door CRM</span>
                <span>•</span>
                <span>Pressure washing ops</span>
              </div>
            </div>
          </footer>
        </div>
      </Section>
    </main>
  );
}
