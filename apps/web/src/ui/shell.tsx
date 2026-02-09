'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  BadgeDollarSign,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Map,
  MessageCircle,
  ScrollText,
  Settings,
  Upload,
  Users2
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './button';
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

type AppShellProps =
  | { title: string; children: React.ReactNode; active?: never; me?: never }
  | { title?: string; children: React.ReactNode; active?: string; me?: any };

function titleFromActive(active?: string) {
  switch (active) {
    case 'dashboard':
      return 'Dashboard';
    case 'sales':
      return 'Sales';
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
    default:
      return 'Block';
  }
}

export function AppShell(props: AppShellProps) {
  const { children } = props;
  const pathname = usePathname();
  const title = (props as any).title || titleFromActive((props as any).active);
  const role = (props as any).me?.role as string | undefined;
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
                <div>
                  <div className="text-base font-semibold tracking-tight">Block</div>
                  <div className="text-xs text-mutedForeground">Territory + Sales Ops</div>
                </div>
                <ThemeToggle />
              </div>
              <div className="mt-4 space-y-1">
                <NavItem href="/app/dashboard" label="Dashboard" icon={LayoutDashboard} />
                {canManage || isRep ? <NavItem href="/app/sales" label="Sales" icon={BadgeDollarSign} /> : null}
                {canManage || isRep ? <NavItem href="/app/followups" label="Follow-ups" icon={CheckSquare} /> : null}

                {canManage ? <NavItem href="/app/territories" label="Territories" icon={Map} /> : null}
                {canManage ? <NavItem href="/app/messages" label="Messages" icon={MessageCircle} /> : null}
                {canManage ? <NavItem href="/app/analytics" label="Analytics" icon={BarChart3} /> : null}
                {canManage ? <NavItem href="/app/reps" label="Reps" icon={Users2} /> : null}
                {canManage ? <NavItem href="/app/exports" label="Exports" icon={Upload} /> : null}

                {canManage ? <NavItem href="/app/audit" label="Audit" icon={ScrollText} /> : null}
                {isAdmin ? <NavItem href="/app/settings" label="Settings" icon={Settings} /> : null}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-mutedForeground hover:text-foreground"
                  onClick={async () => {
                    await api('/v1/auth/logout', { method: 'POST' });
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
          {/* Top bar */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
              <div className="text-xs text-mutedForeground">{pathname}</div>
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
