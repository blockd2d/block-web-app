'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  BadgeDollarSign,
  Calendar,
  CheckSquare,
  ClipboardList,
  Hammer,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  MessageCircle,
  ScrollText,
  Settings,
  Upload,
  Users2,
  Wrench
} from 'lucide-react';
import { api } from '../lib/api';
import { clearDevSession } from '../lib/dev-auth';
import { Button } from './button';
import { OfflineIndicator } from './offline-indicator';
import { ThemeToggle } from './theme-toggle';

const NavItem = ({
  href,
  label,
  icon: Icon
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) => {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={clsx(
        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-muted text-foreground' : 'text-mutedForeground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className={clsx('h-4 w-4', active ? 'text-foreground' : 'text-mutedForeground group-hover:text-foreground')} />
      <span>{label}</span>
    </Link>
  );
};

type AppShellProps = {
  children: React.ReactNode;
  me: any;
  title?: string;
  /** Override nav highlight when not using /app/* path (e.g. /audit, /labor) */
  active?: string;
};

function titleFromActive(active?: string) {
  switch (active) {
    case 'dashboard':
      return 'Dashboard';
    case 'sales':
      return 'Sales';
    case 'leads':
      return 'Leads';
    case 'territories':
    case 'assignments':
      return 'Territories';
    case 'messages':
      return 'Messages';
    case 'analytics':
      return 'Analytics';
    case 'reps':
      return 'Reps';
    case 'exports':
      return 'Exports';
    case 'followups':
      return 'Follow-ups';
    case 'audit':
      return 'Audit';
    case 'settings':
      return 'Settings';
    case 'knocks':
      return 'Knocks';
    case 'schedule':
      return 'Schedule';
    case 'quotes':
      return 'Quotes';
    case 'crews':
      return 'Crews';
    case 'invoices':
      return 'Invoices';
    case 'operations':
      return 'Operations';
    case 'counties':
      return 'Counties';
    case 'labor':
      return 'Labor';
    default:
      return 'Block';
  }
}

function activeFromPathname(pathname: string) {
  if (pathname.startsWith('/app/dashboard')) return 'dashboard';
  if (pathname.startsWith('/app/sales')) return 'sales';
  if (pathname.startsWith('/app/leads')) return 'leads';
  if (pathname.startsWith('/app/followups')) return 'followups';
  if (pathname.startsWith('/app/territories')) return 'territories';
  if (pathname.startsWith('/app/assignments')) return 'assignments';
  if (pathname.startsWith('/app/messages')) return 'messages';
  if (pathname.startsWith('/app/analytics')) return 'analytics';
  if (pathname.startsWith('/app/reps')) return 'reps';
  if (pathname.startsWith('/app/exports')) return 'exports';
  if (pathname.startsWith('/app/audit')) return 'audit';
  if (pathname.startsWith('/app/settings')) return 'settings';
  if (pathname.startsWith('/app/knocks')) return 'knocks';
  if (pathname.startsWith('/app/schedule')) return 'schedule';
  if (pathname.startsWith('/app/quotes')) return 'quotes';
  if (pathname.startsWith('/app/crews')) return 'crews';
  if (pathname.startsWith('/app/invoices')) return 'invoices';
  if (pathname.startsWith('/app/operations')) return 'operations';
  return undefined;
}

export function AppShell(props: AppShellProps) {
  const { children } = props;
  const pathname = usePathname();
  const active = props.active ?? activeFromPathname(pathname);
  const title = props.title || titleFromActive(active);
  const role = props.me?.role as string | undefined;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isRep = role === 'rep';
  const isLabor = role === 'labor';
  const canManage = isAdmin || isManager;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-4">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <Link
                  href="/app/dashboard"
                  className="flex min-w-0 items-center gap-2 sm:gap-3 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src="/block-logo-icon.png"
                    alt="Block"
                    className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tracking-tight sm:text-base">Block</div>
                    <div className="truncate text-xs text-mutedForeground">Territory + Sales Ops</div>
                  </div>
                </Link>
                <ThemeToggle />
              </div>
              <div className="mt-4 space-y-1">
                <NavItem href="/app/dashboard" label="Dashboard" icon={LayoutDashboard} />
                {canManage || isRep ? <NavItem href="/app/sales" label="Sales" icon={BadgeDollarSign} /> : null}
                {canManage || isRep ? <NavItem href="/app/leads" label="Leads" icon={MapPin} /> : null}
                {canManage || isRep ? <NavItem href="/app/followups" label="Follow-ups" icon={CheckSquare} /> : null}
                {canManage || isRep ? <NavItem href="/app/knocks" label="Knocks" icon={Hammer} /> : null}
                {canManage || isRep ? <NavItem href="/app/schedule" label="Schedule" icon={Calendar} /> : null}
                {canManage || isRep ? <NavItem href="/app/quotes" label="Quotes" icon={ClipboardList} /> : null}
                {canManage ? <NavItem href="/app/crews" label="Crews" icon={Wrench} /> : null}

                {canManage ? <NavItem href="/app/invoices" label="Invoices" icon={BadgeDollarSign} /> : null}
                {canManage ? <NavItem href="/app/operations" label="Operations" icon={Activity} /> : null}
                {canManage ? <NavItem href="/app/territories" label="Territories" icon={Map} /> : null}
                {canManage ? <NavItem href="/app/assignments" label="Assignments" icon={Map} /> : null}
                {canManage ? <NavItem href="/app/messages" label="Messages" icon={MessageCircle} /> : null}
                {canManage ? <NavItem href="/app/analytics" label="Analytics" icon={BarChart3} /> : null}
                {canManage ? <NavItem href="/app/reps" label="Reps" icon={Users2} /> : null}
                {canManage ? <NavItem href="/app/exports" label="Exports" icon={Upload} /> : null}

                {canManage ? <NavItem href="/app/audit" label="Audit" icon={ScrollText} /> : null}
                {isAdmin ? <NavItem href="/app/settings" label="Settings" icon={Settings} /> : null}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                {props.me?.org_name || props.me?.email ? (
                  <div className="mb-3 min-w-0 rounded-lg bg-muted/50 px-3 py-2 text-xs text-mutedForeground">
                    {props.me.org_name ? (
                      <div className="truncate font-medium text-foreground">{props.me.org_name}</div>
                    ) : null}
                    {props.me.email ? (
                      <div className="mt-0.5 truncate">{props.me.email}</div>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-mutedForeground hover:text-foreground"
                  onClick={async () => {
                    clearDevSession();
                    try {
                      await api('/v1/auth/logout', { method: 'POST' });
                    } catch {
                      // ignore if API not available (e.g. dev-only session)
                    }
                    window.location.href = '/';
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <OfflineIndicator />
          {/* Top bar */}
          <div className="mb-4 mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
            </div>
          </div>

          {/* Animated route content */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
