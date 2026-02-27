import Link from 'next/link';
import { Button } from '../../ui/button';

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-6">{children}</section>;
}

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Section>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primaryForeground shadow-soft">
                <span className="text-sm font-extrabold">B</span>
              </div>
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
            <h1 className="text-3xl font-extrabold tracking-tight">Join Block</h1>
            <p className="mt-2 text-sm text-mutedForeground">
              Tell us about your team. We’ll review your request and reach out to schedule onboarding.
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            {/* Client form to support file upload */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <form action="/api/join" method="post" encType="multipart/form-data" className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Company name" name="company_name" required />
                <Field label="Owner full name" name="owner_full_name" required />
                <Field label="Owner email" name="owner_email" type="email" required />
                <Field label="Owner phone" name="owner_phone" type="tel" required />
                <SelectField
                  label="Team size"
                  name="team_size"
                  required
                  options={['1-2', '3-5', '6-10', '11-25', '26-50', '50+']}
                />
                <SelectField
                  label="Industry"
                  name="industry"
                  required
                  options={['pressure washing', 'solar', 'roofing', 'pest control', 'landscaping', 'other']}
                />
                <Field label="Website" name="website" type="url" required placeholder="https://example.com" />
                <SelectField
                  label="Role"
                  name="role"
                  required
                  options={['Owner', 'Co-owner', 'GM', 'Ops manager', 'Sales manager', 'Other']}
                />
                <SelectField
                  label="How did you find us?"
                  name="referral_source"
                  required
                  options={['referral', 'cold outreach', 'social', 'search', 'event', 'other']}
                />
              </div>

              <div>
                <label className="text-sm text-mutedForeground" htmlFor="logo">
                  Business logo (optional)
                </label>
                <input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="mt-1 block w-full text-sm text-mutedForeground file:mr-4 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondaryForeground hover:file:opacity-90"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" size="lg">
                  Submit request
                </Button>
                <Link href="/login" className="text-sm text-mutedForeground hover:text-foreground">
                  Already have access? Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </Section>
    </main>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm text-mutedForeground" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-mutedForeground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm text-mutedForeground" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-mutedForeground focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <option value="" disabled selected>
          Select…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

