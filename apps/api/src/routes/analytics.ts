import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed } from './_helpers';
import { enumerateDaysISO, getRangeWindow } from './_range';

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service
    .from('reps')
    .select('id')
    .eq('org_id', org_id)
    .eq('profile_id', profile_id)
    .single();
  return (data?.id as string) || null;
}

type Totals = {
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
  hours: number;
  followups_due: number;
  jobs_completed: number;
  payments_collected: number;
};

function derive(totals: Totals) {
  const doors_per_hour = totals.hours > 0 ? totals.doors / Number(totals.hours) : 0;
  const close_rate = totals.leads > 0 ? totals.sold / totals.leads : 0;
  return { doors_per_hour, close_rate };
}

async function fetchDailyStats(service: any, org_id: string, sinceDay: string, untilDay: string, rep_id?: string | null) {
  let q = service
    .from('daily_stats')
    .select('day, rep_id, doors_knocked, leads, quotes, sold, revenue, hours_worked')
    .eq('org_id', org_id)
    .gte('day', sinceDay)
    .lte('day', untilDay);
  if (rep_id) q = q.eq('rep_id', rep_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchFollowupsDue(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  let q = service
    .from('followups')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
    .eq('status', 'open')
    .lte('due_at', new Date().toISOString())
    .gte('due_at', sinceISO);
  if (rep_id) q = q.eq('rep_id', rep_id);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function fetchJobsCompleted(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  // Jobs are tied to a sale; sales have rep_id. Join is heavier; do 2-step.
  // For MVP, count jobs completed regardless of rep if rep_id not provided.
  let q = service
    .from('jobs')
    .select('id, sale_id, completed_at')
    .eq('org_id', org_id)
    .eq('status', 'complete')
    .gte('completed_at', sinceISO);

  const { data: jobs, error } = await q;
  if (error) throw new Error(error.message);
  if (!rep_id) return (jobs || []).length;
  if (!jobs?.length) return 0;

  const saleIds = jobs.map((j: any) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;
  const { data: sales, error: sErr } = await service
    .from('sales')
    .select('id, rep_id')
    .eq('org_id', org_id)
    .in('id', saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s: any) => [s.id, s.rep_id]));
  return jobs.filter((j: any) => saleRep.get(j.sale_id) === rep_id).length;
}

async function fetchPaymentsCollected(service: any, org_id: string, sinceISO: string, rep_id?: string | null) {
  // Payments are tied to a job -> sale -> rep. Two-step like jobs.
  const { data: payments, error } = await service
    .from('payments')
    .select('id, amount, job_id, status, created_at')
    .eq('org_id', org_id)
    .eq('status', 'paid')
    .gte('created_at', sinceISO);
  if (error) throw new Error(error.message);
  if (!rep_id) return (payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0) / 100;
  if (!payments?.length) return 0;

  const jobIds = payments.map((p: any) => p.job_id).filter(Boolean);
  if (!jobIds.length) return 0;
  const { data: jobs, error: jErr } = await service
    .from('jobs')
    .select('id, sale_id')
    .eq('org_id', org_id)
    .in('id', jobIds);
  if (jErr) throw new Error(jErr.message);
  const saleIds = (jobs || []).map((j: any) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;

  const { data: sales, error: sErr } = await service
    .from('sales')
    .select('id, rep_id')
    .eq('org_id', org_id)
    .in('id', saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s: any) => [s.id, s.rep_id]));
  const jobSale = new Map((jobs || []).map((j: any) => [j.id, j.sale_id]));

  const totalCents = (payments || []).reduce((acc: number, p: any) => {
    const saleId = jobSale.get(p.job_id);
    if (saleId && saleRep.get(saleId) === rep_id) return acc + (p.amount || 0);
    return acc;
  }, 0);

  return totalCents / 100;
}

function scoreRow(r: { doors: number; leads: number; quotes: number; sold: number; revenue: number }) {
  // Simple deterministic scoring:
  // Sold heavily weighted, then revenue, then quotes/leads, then doors.
  return r.sold * 200 + r.revenue / 50 + r.quotes * 25 + r.leads * 10 + r.doors * 0.5;
}

export async function analyticsRoutes(app: FastifyInstance) {
  // Summary for dashboard/analytics/rep detail
  app.get('/summary', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    const { range, since, until, sinceDay, untilDay } = getRangeWindow((req.query as any)?.range);

    let repId: string | null = null;
    if (ctx.role === 'rep') {
      repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    } else {
      // admin/manager can optionally request a specific rep_id
      repId = (req.query as any)?.rep_id ? String((req.query as any).rep_id) : null;
    }

    const rows = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, repId);

    const totalsBase: Totals = {
      doors: 0,
      leads: 0,
      quotes: 0,
      sold: 0,
      revenue: 0,
      hours: 0,
      followups_due: 0,
      jobs_completed: 0,
      payments_collected: 0
    };

    for (const r of rows) {
      totalsBase.doors += Number((r as any).doors_knocked || 0);
      totalsBase.leads += Number((r as any).leads || 0);
      totalsBase.quotes += Number((r as any).quotes || 0);
      totalsBase.sold += Number((r as any).sold || 0);
      totalsBase.revenue += Number((r as any).revenue || 0);
      totalsBase.hours += Number((r as any).hours_worked || 0);
    }

    const sinceISO = since.toISOString();

    const [followups_due, jobs_completed, payments_collected] = await Promise.all([
      fetchFollowupsDue(service, ctx.org_id, sinceISO, repId),
      fetchJobsCompleted(service, ctx.org_id, sinceISO, repId),
      fetchPaymentsCollected(service, ctx.org_id, sinceISO, repId)
    ]);

    totalsBase.followups_due = followups_due;
    totalsBase.jobs_completed = jobs_completed;
    totalsBase.payments_collected = payments_collected;

    const derived = derive(totalsBase);

    return reply.send({
      range,
      since: sinceDay,
      until: untilDay,
      rep_id: repId,
      totals: totalsBase,
      derived,
      // Backward-compatible "rep summary" shape used by /app/reps
      summary: {
        doors: totalsBase.doors,
        leads: totalsBase.leads,
        quotes: totalsBase.quotes,
        sold: totalsBase.sold,
        revenue: totalsBase.revenue,
        doors_per_hour: derived.doors_per_hour,
        close_rate: derived.close_rate
      }
    });
  });

  // Time series for charts (fills missing days with zeros)
  app.get('/timeseries', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    const { range, sinceDay, untilDay } = getRangeWindow((req.query as any)?.range);

    let repId: string | null = null;
    if (ctx.role === 'rep') {
      repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    } else {
      repId = (req.query as any)?.rep_id ? String((req.query as any).rep_id) : null;
    }

    const rows = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, repId);

    const byDay = new Map<string, any>();
    for (const d of enumerateDaysISO(sinceDay, untilDay)) {
      byDay.set(d, { date: d, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 });
    }
    for (const r of rows) {
      const day = String((r as any).day);
      const bucket = byDay.get(day) || { date: day, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
      bucket.doors += Number((r as any).doors_knocked || 0);
      bucket.leads += Number((r as any).leads || 0);
      bucket.quotes += Number((r as any).quotes || 0);
      bucket.sold += Number((r as any).sold || 0);
      bucket.revenue += Number((r as any).revenue || 0);
      byDay.set(day, bucket);
    }

    const items = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

    return reply.send({ range, since: sinceDay, until: untilDay, rep_id: repId, items });
  });

  // Leaderboard with delta vs prior period
  app.get('/leaderboard', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    const { range, sinceDay, untilDay, priorSinceDay, priorUntilDay } = getRangeWindow((req.query as any)?.range);

    // Pull reps
    const { data: reps, error: repsErr } = await service
      .from('reps')
      .select('id, name')
      .eq('org_id', ctx.org_id)
      .order('name', { ascending: true });
    if (repsErr) return reply.code(400).send({ error: repsErr.message });

    const repMap = new Map<string, string>((reps || []).map((r: any) => [r.id, r.name]));

    // Current window stats
    const current = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, null);

    const agg = new Map<string, any>();
    for (const r of reps || []) {
      agg.set(r.id, {
        rep_id: r.id,
        rep_name: r.name,
        doors: 0,
        leads: 0,
        quotes: 0,
        sold: 0,
        revenue: 0,
        hours: 0
      });
    }

    for (const row of current) {
      const rep_id = (row as any).rep_id;
      if (!rep_id) continue;
      if (!agg.has(rep_id)) {
        agg.set(rep_id, {
          rep_id,
          rep_name: repMap.get(rep_id) || 'Rep',
          doors: 0,
          leads: 0,
          quotes: 0,
          sold: 0,
          revenue: 0,
          hours: 0
        });
      }
      const a = agg.get(rep_id);
      a.doors += Number((row as any).doors_knocked || 0);
      a.leads += Number((row as any).leads || 0);
      a.quotes += Number((row as any).quotes || 0);
      a.sold += Number((row as any).sold || 0);
      a.revenue += Number((row as any).revenue || 0);
      a.hours += Number((row as any).hours_worked || 0);
    }

    // Prior window stats
    const priorAgg = new Map<string, number>();
    if (priorSinceDay && priorUntilDay) {
      const priorRows = await fetchDailyStats(service, ctx.org_id, priorSinceDay, priorUntilDay, null);
      const tmp = new Map<string, any>();
      for (const row of priorRows) {
        const rep_id = (row as any).rep_id;
        if (!rep_id) continue;
        const a = tmp.get(rep_id) || { doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
        a.doors += Number((row as any).doors_knocked || 0);
        a.leads += Number((row as any).leads || 0);
        a.quotes += Number((row as any).quotes || 0);
        a.sold += Number((row as any).sold || 0);
        a.revenue += Number((row as any).revenue || 0);
        tmp.set(rep_id, a);
      }
      for (const [rep_id, a] of tmp.entries()) {
        priorAgg.set(rep_id, scoreRow(a));
      }
    }

    const items = Array.from(agg.values()).map((r: any) => {
      const score = scoreRow(r);
      const priorScore = priorAgg.get(r.rep_id) || 0;
      const delta_score = score - priorScore;
      const doors_per_hour = r.hours > 0 ? r.doors / Number(r.hours) : 0;
      const close_rate = r.leads > 0 ? r.sold / r.leads : 0;
      return {
        rep_id: r.rep_id,
        rep_name: r.rep_name,
        doors: r.doors,
        leads: r.leads,
        quotes: r.quotes,
        sold: r.sold,
        revenue: r.revenue,
        score,
        delta_score,
        doors_per_hour,
        close_rate
      };
    });

    items.sort((a: any, b: any) => b.score - a.score);

    return reply.send({ range, since: sinceDay, until: untilDay, items });
  });
}
