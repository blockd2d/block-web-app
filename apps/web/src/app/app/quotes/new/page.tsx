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

export default function NewQuotePage() {
  const router = useRouter();
  const [counties, setCounties] = React.useState<County[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [reps, setReps] = React.useState<Rep[]>([]);
  const [countyId, setCountyId] = React.useState('');
  const [propertyId, setPropertyId] = React.useState('');
  const [repId, setRepId] = React.useState('');
  const [price, setPrice] = React.useState<string>('');
  const [serviceType, setServiceType] = React.useState('');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [c, r] = await Promise.all([
          api.get('/v1/counties').then((x: any) => (x.items || x.counties || []) as County[]),
          api.get('/v1/reps?limit=500').then((x: any) => (x.items || x.reps || []) as Rep[])
        ]);
        setCounties(c);
        setReps(r);
        if (c.length && !countyId) setCountyId(c[0].id);
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
    api.get(`/v1/properties?county_id=${encodeURIComponent(countyId)}&limit=500`).then(
      (r: any) => {
        setProperties((r.items || r.properties || []) as Property[]);
        setPropertyId('');
      },
      () => {
        setProperties([]);
        setPropertyId('');
      }
    );
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
        status: 'quote',
        price: price === '' ? undefined : Number(price),
        service_type: serviceType || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        notes: notes || undefined
      });
      router.push('/app/quotes');
    } catch (e: any) {
      setErr(e?.message || 'Failed to create quote');
    } finally {
      setLoading(false);
    }
  }

  function fmtProp(p: Property) {
    return [p.address1, p.city, p.state, p.zip].filter(Boolean).join(', ') || p.id.slice(0, 8) + '…';
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-mutedForeground">
          <Link href="/app/quotes" className="hover:underline">Quotes</Link>
          <span>›</span>
          <span className="text-foreground/80">New quote</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">New quote</h1>
        <p className="mt-1 text-sm text-mutedForeground">Create a sale in quote stage with price and service type.</p>
      </div>

      {err ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">{err}</div>
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
                <option key={c.id} value={c.id}>{c.name}</option>
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
                <option key={p.id} value={p.id}>{fmtProp(p)}</option>
              ))}
            </select>
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
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-mutedForeground">Price</label>
            <Input type="number" step="0.01" className="mt-1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-medium text-mutedForeground">Service type</label>
            <Input className="mt-1" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="e.g. Pressure wash" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-mutedForeground">Customer name</label>
            <Input className="mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-mutedForeground">Customer phone</label>
            <Input type="tel" className="mt-1" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-mutedForeground">Customer email</label>
          <Input type="email" className="mt-1" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-mutedForeground">Notes</label>
          <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !propertyId || !repId}>{loading ? 'Creating…' : 'Create quote'}</Button>
          <Link href="/app/quotes"><Button type="button" variant="secondary">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
