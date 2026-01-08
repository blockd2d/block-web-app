'use client';

import * as React from 'react';
import { AppShell } from '../../../ui/shell';
import { api } from '../../../lib/api';
import { Input } from '../../../ui/input';
import { Button } from '../../../ui/button';
import { fmtDateTimeLocal } from '../../../lib/format';

type Thread = {
  id: string;
  customer_phone: string;
  rep_id: string | null;
  rep_name: string | null;
  property_id: string | null;
  property_address: string | null;
  county_name: string | null;
  status: 'open' | 'resolved' | 'dnk';
  last_message_at: string | null;
  last_message_preview: string | null;
};

type Msg = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_at: string;
  sent_by_rep_id: string | null;
  thread_id: string;
};

type Rep = { id: string; name: string; role: string };
type County = { id: string; name: string; state: string };

const FEATURE_INTERVENE_UI = String(process.env.NEXT_PUBLIC_FEATURE_MESSAGES_INTERVENE || 'false') === 'true';

export default function MessagesPage() {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<string>('all');
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [compose, setCompose] = React.useState('');
  const [reps, setReps] = React.useState<Rep[]>([]);
  const [counties, setCounties] = React.useState<County[]>([]);
  const [repFilter, setRepFilter] = React.useState<string>('all');
  const [countyFilter, setCountyFilter] = React.useState<string>('all');
  const [intervene, setIntervene] = React.useState(false);
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function loadReps() {
    try {
      const r = await api('/v1/reps');
      setReps(r.items || []);
    } catch {
      // ignore
    }
  }

  async function loadCounties() {
    try {
      const r = await api('/v1/counties');
      setCounties(r.items || []);
    } catch {
      // ignore
    }
  }

  async function loadThreads() {
    setLoadingThreads(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (status !== 'all') qs.set('status', status);
      if (repFilter !== 'all' && repFilter !== '__unassigned') qs.set('rep_id', repFilter);
      if (countyFilter !== 'all') qs.set('county_id', countyFilter);
      qs.set('limit', '50');
      const r = await api(`/v1/messages/threads?${qs.toString()}`);
      let items = (r.items || []) as Thread[];
      if (repFilter === '__unassigned') items = items.filter((t) => !t.rep_id);
      setThreads(items);
      const keepSelected = selectedThreadId && items.some((t) => t.id === selectedThreadId);
      if (!keepSelected) {
        setSelectedThreadId(items[0]?.id || null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load threads');
    } finally {
      setLoadingThreads(false);
    }
  }

  async function loadMessages(threadId: string) {
    setLoadingMessages(true);
    setError(null);
    try {
      const r = await api(`/v1/messages/threads/${threadId}/messages?limit=100`);
      setMessages(r.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }

  React.useEffect(() => {
    loadReps();
    loadCounties();
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const id = setTimeout(() => {
      loadThreads();
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  React.useEffect(() => {
    const id = setTimeout(() => {
      loadThreads();
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repFilter, countyFilter]);

  React.useEffect(() => {
    if (selectedThreadId) loadMessages(selectedThreadId);
    setIntervene(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  const canSend = selectedThreadId && FEATURE_INTERVENE_UI && intervene;
  const hasActiveFilters = Boolean(q.trim() || status !== 'all' || repFilter !== 'all' || countyFilter !== 'all');

  async function send() {
    if (!selectedThreadId) return;
    if (!FEATURE_INTERVENE_UI || !intervene) return;
    const body = compose.trim();
    if (!body) return;
    setCompose('');
    try {
      await api('/v1/messages/send', {
        method: 'POST',
        body: JSON.stringify({ thread_id: selectedThreadId, body, intervene: true })
      });
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
      setCompose(body);
    }
  }

  async function reassign(repId: string) {
    if (!selectedThreadId) return;
    try {
      await api(`/v1/messages/threads/${selectedThreadId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ rep_id: repId || null })
      });
      await loadThreads();
    } catch (e: any) {
      setError(e?.message || 'Failed to reassign');
    }
  }

  async function setThreadStatus(newStatus: string) {
    if (!selectedThreadId) return;
    try {
      await api(`/v1/messages/threads/${selectedThreadId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });
      await loadThreads();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    }
  }

  return (
    <AppShell title="Messages">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phone, address, message…" />
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-2 text-sm text-foreground"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="dnk">DNK</option>
                </select>
                <select
                  className="h-10 rounded-xl border border-input bg-background px-2 text-sm text-foreground"
                  value={repFilter}
                  onChange={(e) => setRepFilter(e.target.value)}
                  aria-label="Filter by rep"
                >
                  <option value="all">All reps</option>
                  <option value="__unassigned">Unassigned</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-xl border border-input bg-background px-2 text-sm text-foreground"
                  value={countyFilter}
                  onChange={(e) => setCountyFilter(e.target.value)}
                  aria-label="Filter by county"
                >
                  <option value="all">All counties</option>
                  {counties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}, {c.state}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-border">
              {loadingThreads ? (
                <div className="p-4 text-sm text-mutedForeground">Loading threads…</div>
              ) : threads.length ? (
                <div className="divide-y divide-border">
                  {threads.map((t) => {
                    const isActive = t.id === selectedThreadId;
                    return (
                      <button
                        key={t.id}
                        className={
                          `w-full text-left px-3 py-3 hover:bg-muted/50 ${isActive ? 'bg-muted/60' : 'bg-transparent'}`
                        }
                        onClick={() => setSelectedThreadId(t.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-medium">{t.customer_phone}</div>
                          <div className="text-xs text-mutedForeground">{t.last_message_at ? fmtDateTimeLocal(t.last_message_at) : ''}</div>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-mutedForeground">
                          {t.property_address ? `${t.property_address}${t.county_name ? ` • ${t.county_name}` : ''}` : t.county_name || ''}
                        </div>
                        <div className="mt-1 truncate text-xs text-mutedForeground">{t.last_message_preview || '—'}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-mutedForeground">Owner: {t.rep_name || 'Unassigned'}</div>
                          <div className="rounded-md border border-border px-2 py-0.5 text-xs text-mutedForeground">{t.status}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-sm text-mutedForeground">
                  {hasActiveFilters ? 'No threads match your filters.' : 'No threads yet.'}
                  <div className="mt-1 text-xs">Inbound Twilio messages will appear here automatically.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selectedThread?.customer_phone || 'Select a thread'}</div>
                <div className="truncate text-xs text-mutedForeground">
                  {selectedThread?.property_address ? selectedThread.property_address : ''}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-2 text-sm text-foreground"
                  value={selectedThread?.rep_id ?? ''}
                  onChange={(e) => reassign(e.target.value)}
                  disabled={!selectedThreadId}
                >
                  <option value="">Unassigned</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <Button
                  variant="ghost"
                  onClick={() => setThreadStatus('resolved')}
                  disabled={!selectedThreadId}
                  aria-label="Resolve thread"
                >
                  Resolve
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setThreadStatus('dnk')}
                  disabled={!selectedThreadId}
                  aria-label="Mark thread as DNK"
                >
                  Mark DNK
                </Button>

                <div className="hidden items-center gap-2 md:flex">
                  <span className="text-xs text-mutedForeground">Intervene as company</span>
                  <button
                    type="button"
                    onClick={() => FEATURE_INTERVENE_UI && setIntervene((v) => !v)}
                    disabled={!FEATURE_INTERVENE_UI || !selectedThreadId}
                    className={
                      `h-6 w-11 rounded-full border border-border transition ${
                        intervene ? 'bg-primary/20' : 'bg-muted'
                      } ${!FEATURE_INTERVENE_UI ? 'opacity-60' : ''}`
                    }
                    aria-pressed={intervene}
                    aria-label="Toggle intervene"
                  >
                    <span
                      className={
                        `block h-5 w-5 rounded-full bg-foreground/80 transition ${intervene ? 'translate-x-5' : 'translate-x-0'}`
                      }
                    />
                  </button>
                </div>
              </div>
            </div>

            {!FEATURE_INTERVENE_UI ? (
              <div className="border-b border-border px-4 py-3 text-xs text-mutedForeground">
                Sending from the web is disabled by default. Set <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_FEATURE_MESSAGES_INTERVENE=true</code> in Vercel
                and <code className="rounded bg-muted px-1 py-0.5">FEATURE_MESSAGES_INTERVENE=true</code> on Railway to enable manager/admin intervention.
              </div>
            ) : null}

            {error ? <div className="px-4 pt-3 text-sm text-destructive">{error}</div> : null}

            <div className="max-h-[60vh] overflow-auto p-4">
              {!selectedThreadId ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">
                  Select a thread to view the conversation.
                </div>
              ) : loadingMessages ? (
                <div className="text-sm text-mutedForeground">Loading conversation…</div>
              ) : messages.length ? (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isOutbound = m.direction === 'outbound';
                    return (
                      <div key={m.id} className={isOutbound ? 'flex justify-end' : 'flex justify-start'}>
                        <div
                          className={
                            `max-w-[85%] rounded-2xl border px-3 py-2 text-sm shadow-soft ${
                              isOutbound
                                ? 'border-primary/30 bg-primary/10 text-foreground'
                                : 'border-border bg-background text-foreground'
                            }`
                          }
                        >
                          <div className="whitespace-pre-wrap">{m.body}</div>
                          <div className="mt-1 text-[11px] text-mutedForeground">{fmtDateTimeLocal(m.sent_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">No messages yet.</div>
              )}
            </div>

            <div className="border-t border-border p-4">
              {!selectedThreadId ? (
                <div className="text-sm text-mutedForeground">Select a thread to reassign or intervene.</div>
              ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={compose}
                  onChange={(e) => setCompose(e.target.value)}
                  placeholder={selectedThreadId ? (FEATURE_INTERVENE_UI ? 'Write a message…' : 'Read-only') : 'Select a thread…'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={!canSend}
                />
                <Button onClick={send} disabled={!canSend || !compose.trim()}>
                  Send
                </Button>
              </div>
              )}
              {FEATURE_INTERVENE_UI ? (
                <div className="mt-2 text-xs text-mutedForeground">
                  Toggle <span className="font-medium text-foreground">Intervene as company</span> to send from the company number. When off, this view is read-only.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
