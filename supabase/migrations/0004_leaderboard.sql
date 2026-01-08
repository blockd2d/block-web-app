-- Block V7: Leaderboard helper (server-side aggregates)
-- Used by /v1/analytics/leaderboard and Rep mobile leaderboard UX

-- Drop first so reruns never fail
drop function if exists public.leaderboard(uuid, timestamptz);

create function public.leaderboard(
  org uuid,
  since timestamptz
)
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
set search_path = public
as $$
  select
    r.id as rep_id,
    r.name as rep_name,
    coalesce(s.sales_count, 0) as sales_count,
    coalesce(s.sales_amount, 0) as sales_amount,
    coalesce(i.interactions_count, 0) as interactions_count
  from public.reps r
  left join (
    select
      rep_id,
      count(*) as sales_count,
      coalesce(sum(price), 0) as sales_amount
    from public.sales
    where org_id = org
      and created_at >= since
    group by rep_id
  ) s on s.rep_id = r.id
  left join (
    select
      rep_id,
      count(*) as interactions_count
    from public.interactions
    where org_id = org
      and created_at >= since
    group by rep_id
  ) i on i.rep_id = r.id
  where r.org_id = org
  order by
    sales_amount desc nulls last,
    sales_count desc,
    interactions_count desc,
    r.name asc;
$$;

-- Permissions (idempotent)
revoke all on function public.leaderboard(uuid, timestamptz) from public;
grant execute on function public.leaderboard(uuid, timestamptz) to authenticated;
