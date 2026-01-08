'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { AppShell } from '../../../../ui/shell';
import { Button } from '../../../../ui/button';
import { fmtCurrency } from '../../../../lib/format';

function fmt(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function SaleDetailPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params.saleId;

  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const r = await api.get(`/v1/sales/${saleId}`);
      setData(r);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load sale');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get('/v1/auth/me')
      .then((r) => setMe(r.user))
      .catch(() => (window.location.href = '/login'));
  }, []);

  useEffect(() => {
    if (!saleId) return;
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const sale = data?.sale;
  const customer = data?.customer;
  const attachments: any[] = data?.attachments || [];
  const contract = data?.contract;
  const auditRows: any[] = data?.audit || [];

  const photoAttachments = useMemo(
    () => attachments.filter((a) => a?.url && (a.type === 'photo' || a.type === 'signature')),
    [attachments]
  );

  return (
    <AppShell active="sales" me={me}>
      <div className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-mutedForeground">
              <Link href="/app/sales" className="hover:underline">
                Sales
              </Link>
              <span>›</span>
              <span className="text-foreground/80">{saleId.slice(0, 8)}…</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Sale details</h1>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {contract?.url ? (
              <Button onClick={() => window.open(contract.url, '_blank', 'noopener,noreferrer')} disabled={loading}>
                Download contract
              </Button>
            ) : null}
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
            {err}
          </div>
        ) : null}

        {!sale && !err ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-mutedForeground shadow-soft">
            Loading…
          </div>
        ) : null}

        {sale ? (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm text-mutedForeground">Customer</div>
                    <div className="mt-1 text-lg font-semibold">{customer?.name || customer?.phone || '—'}</div>
                    <div className="mt-1 text-sm text-mutedForeground">{customer?.address || '—'}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {customer?.phone ? (
                        <span className="rounded-lg bg-muted px-2 py-1 text-mutedForeground">{customer.phone}</span>
                      ) : null}
                      {customer?.email ? (
                        <span className="rounded-lg bg-muted px-2 py-1 text-mutedForeground">{customer.email}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <div className="text-xs font-semibold text-mutedForeground">Status</div>
                    <div className="mt-1 text-sm font-medium">{sale.pipeline_status || sale.sale_status || '—'}</div>
                    <div className="mt-2 text-xs text-mutedForeground">Created</div>
                    <div className="mt-1 text-sm text-mutedForeground">{fmt(sale.created_at)}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-xs font-semibold text-mutedForeground">Service</div>
                    <div className="mt-1 text-sm">{sale.service_type || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-xs font-semibold text-mutedForeground">Price</div>
                    <div className="mt-1 text-sm font-medium">{fmtCurrency(sale.price)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-xs font-semibold text-mutedForeground">Rep</div>
                    <div className="mt-1 text-sm">{sale.rep_name || sale.rep_id?.slice(0, 8) + '…'}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-background p-4">
                  <div className="text-xs font-semibold text-mutedForeground">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{sale.notes || '—'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Attachments</h2>
                    <p className="text-sm text-mutedForeground">Signed URLs (10 minutes)</p>
                  </div>
                </div>

                {photoAttachments.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {photoAttachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative overflow-hidden rounded-xl border border-border bg-background"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.type} className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white">
                          {a.type}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-mutedForeground">No attachments yet.</div>
                )}

                {attachments.filter((a) => a?.url && !(a.type === 'photo' || a.type === 'signature')).length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-mutedForeground">Other files</div>
                    <div className="mt-2 space-y-2">
                      {attachments
                        .filter((a) => a?.url && !(a.type === 'photo' || a.type === 'signature'))
                        .map((a) => (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm hover:bg-muted/40"
                          >
                            <span className="font-medium">{a.type}</span>
                            <span className="text-xs text-mutedForeground">{fmt(a.created_at)}</span>
                          </a>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {contract?.url ? (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <h2 className="text-lg font-semibold">Contract PDF</h2>
                  <p className="text-sm text-mutedForeground">Preview (browser PDF viewer)</p>
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    <iframe title="Contract PDF" src={contract.url} className="h-[680px] w-full" />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Status rollups</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-mutedForeground">Sale status</span>
                    <span className="font-medium">{sale.sale_status || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mutedForeground">Job status</span>
                    <span className="font-medium">{sale.job_status || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mutedForeground">Payment status</span>
                    <span className="font-medium">{sale.payment_status || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Audit timeline</h2>
                <p className="text-sm text-mutedForeground">Recent events on this sale</p>

                <div className="mt-4 space-y-3">
                  {auditRows.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{a.action}</div>
                          <div className="mt-1 text-xs text-mutedForeground">{fmt(a.created_at)}</div>
                        </div>
                        <div className="text-xs text-mutedForeground">{a.actor_profile_id ? a.actor_profile_id.slice(0, 8) + '…' : '—'}</div>
                      </div>
                      {a.meta ? (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-xs text-mutedForeground">
                          {JSON.stringify(a.meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}

                  {auditRows.length === 0 ? (
                    <div className="text-sm text-mutedForeground">No audit events yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
