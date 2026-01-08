-- Block V7: Leaderboard helper (server-side aggregates)
-- This function is used by /v1/analytics/leaderboard and the Rep mobile "leaderboard" UX.

create or replace function leaderboard(org uuid, since timestamptz)
returns table(
  rep_id uuid,
  rep_name text,
  sales_count bigint,
  sales_amount numeric,
  interactions_count bigint
)
language sql
stable
security definer
as $$
  select
    r.id as rep_id,
    r.name as rep_name,
    coalesce(s.sales_count, 0) as sales_count,
    coalesce(s.sales_amount, 0) as sales_amount,
    coalesce(i.interactions_count, 0) as interactions_count
  from reps r
  left join (
    select rep_id, count(*) as sales_count, coalesce(sum(price), 0) as sales_amount
    from sales
    where org_id = org and created_at >= since
    group by rep_id
  ) s on s.rep_id = r.id
  left join (
    select rep_id, count(*) as interactions_count
    from interactions
    where org_id = org and created_at >= since
    group by rep_id
  ) i on i.rep_id = r.id
  where r.org_id = org
  order by sales_amount desc nulls last, sales_count desc, interactions_count desc, r.name asc;
$$;

revoke all on function leaderboard(uuid, timestamptz) from public;
grant execute on function leaderboard(uuid, timestamptz) to authenticated;

