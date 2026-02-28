import Link from 'next/link';
import { Button } from '../../../ui/button';

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-6">{children}</section>;
}

export default function JoinReceivedPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';
  const statusUrl = token ? `/join/status/${encodeURIComponent(token)}` : '';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Section>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/block-logo-icon.png" alt="Block" className="h-9 w-9 shrink-0 object-contain" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">Block</div>
                <div className="text-xs text-mutedForeground">Join</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </Section>
      </header>

      <Section>
        <div className="py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight">Request received</h1>
            <p className="mt-2 text-sm text-mutedForeground">
              We’ll reach out soon to schedule onboarding. Approval is required before you can sign in.
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            {token ? (
              <>
                <div className="text-sm font-semibold">Bookmark your status link</div>
                <div className="mt-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-mutedForeground">
                  <code className="select-all">{statusUrl}</code>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link href={statusUrl}>
                    <Button size="lg">View status</Button>
                  </Link>
                  <Link href="/">
                    <Button variant="secondary" size="lg">
                      Back to homepage
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-mutedForeground">
                  Missing status token. Please return to the Join page and submit your request again.
                </div>
                <div className="mt-4">
                  <Link href="/join">
                    <Button size="lg">Go to Join</Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </Section>
    </main>
  );
}

