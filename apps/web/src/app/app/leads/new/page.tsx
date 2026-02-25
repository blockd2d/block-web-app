'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';

type County = { id: string; name: string };
type Property = { id: string; address1?: string | null; city?: string | null; state?: string | null; zip?: string | null };
type Rep = { id: string; name: string };

export default function NewLeadPage() {
  const router = useRouter();
  const [counties, setCounties] = React.useState<County[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [reps, setReps] = React.useState<Rep[]>([]);

  const [countyId, setCountyId] = React.useState('');
  const [propertyId, setPropertyId] = React.useState('');
  const [repId, setRepId] = React.useState('');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [c, r] = await Promise.all([api.get('/v1/counties'), api.get('/v1/reps?limit=500')]);
        setCounties((c.items || c.counties || []) as County[]);
        setReps((r.items || r.reps || []) as Rep[]);
        if (!countyId && (c.items?.length || c.counties?.length)) setCountyId((c.items || c.counties)[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!countyId) {
      setProperties([]);
      setPropertyId('');
      return;
    }
    (async () => {
      try {
        const r = await api.get(`/v1/properties?county_id=${encodeURIComponent(countyId)}&limit=500`);
        setProperties((r.items || r.properties || []) as Property[]);
        setPropertyId('');
      } catch (e) {
        setProperties([]);
        setPropertyId('');
      }
    })();
  }, [countyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!propertyId || !repId) {
      setErr('Select a property and a rep.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/v1/sales', {
        property_id: propertyId,
        rep_id: repId,
        status: 'lead',
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        notes: notes || undefined
      });
      router.push('/app/leads');
    } catch (e: any) {
      setErr(e?.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  }

  function fmtProp(p: Property) {
    const parts = [p.address1, p.city, p.state, p.zip].filter(Boolean);
    return parts.length ? parts.join(', ') : p.id.slice(0, 8) + '…';
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-mutedForeground">
          <Link href="/app/leads" className="hover:underline">
            Leads
          </Link>
          <span>›</span>
          <span className="text-foreground/80">New lead</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Add lead</h1>
        <p className="mt-1 text-sm text-mutedForeground">Manual entry: pick a property and rep, then add customer details.</p>
      </div>

      {err ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <form onSubmit={submit} className="max-w-2xl space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-mutedForeground">County</label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={countyId}
              onChange={(e) => setCountyId(e.target.value)}
            >
              <option value="">Select county</option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-mutedForeground">Property</label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
            >
              <option value="">Select property</option>
              {properties.slice(0, 300).map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtProp(p)}
                </option>
              ))}
              {properties.length > 300 ? (
                <option value="" disabled>
                  — and {properties.length - 300} more (narrow by map) —
                </option>
              ) : null}
            </select>
            <p className="mt-1 text-xs text-mutedForeground">Loads from selected county (max 300 shown).</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-mutedForeground">Rep</label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            required
          >
            <option value="">Select rep</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-mutedForeground">Customer name</label>
            <Input
              className="mt-1"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-mutedForeground">Customer phone</label>
            <Input
              className="mt-1"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-mutedForeground">Customer email</label>
          <Input
            className="mt-1"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-mutedForeground">Notes</label>
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !propertyId || !repId}>
            {loading ? 'Creating…' : 'Create lead'}
          </Button>
          <Link href="/app/leads">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
