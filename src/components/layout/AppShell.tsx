'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NAV_ITEMS } from './nav';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { cn, Spinner } from '@/components/ui';
import { AlertTriangle, Cloud, HardDrive, LogOut, Loader2, Feather } from 'lucide-react';

/**
 * App frame: desktop sidebar + mobile bottom bar + top status header. Loads the
 * project on mount and gates content behind a loading state.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { load, status, storageMode, saving, computed } = useProjectStore();

  useEffect(() => {
    void load();
  }, [load]);

  const errorCount = computed?.warnings.filter((w) => w.severity === 'error').length ?? 0;

  if (status !== 'ready') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-timber-50">
        <Spinner className="h-8 w-8" />
        <p className="text-sm font-medium text-timber-600">Loading your coop plan…</p>
      </div>
    );
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-timber-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-timber-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-timber-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-timber-800 text-white">
            <Feather className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-timber-900">Coop Planner</div>
            <div className="text-xs text-timber-500">24-bird walk-in build</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-blueprint-50 text-blueprint-700' : 'text-timber-700 hover:bg-timber-100',
                )}
              >
                <Icon className="h-4.5 w-4.5" size={18} />
                <span>{item.label}</span>
                {item.href === '/' && errorCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-100 px-1.5 text-xs font-bold text-red-600">
                    {errorCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-timber-200 p-3">
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-timber-600 hover:bg-timber-100">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-timber-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-timber-800 text-white">
              <Feather className="h-4.5 w-4.5" size={18} />
            </div>
            <span className="font-bold text-timber-900">Coop Planner</span>
          </div>
          <div className="hidden text-sm font-semibold text-timber-700 lg:block">
            {NAV_ITEMS.find((n) => n.href === pathname)?.label ?? 'Coop Planner'}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {errorCount > 0 && (
              <Link href="/" className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-semibold text-red-600">
                <AlertTriangle size={14} /> {errorCount} issue{errorCount > 1 ? 's' : ''}
              </Link>
            )}
            <span className="flex items-center gap-1 text-timber-500" title={storageMode === 'blob' ? 'Saved to Vercel cloud storage' : 'Saved to this browser (configure Blob for cloud sync)'}>
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : storageMode === 'blob' ? (
                <>
                  <Cloud size={14} /> Cloud
                </>
              ) : (
                <>
                  <HardDrive size={14} /> Local
                </>
              )}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-timber-200 bg-white/95 pb-[var(--safe-bottom)] backdrop-blur lg:hidden">
        {NAV_ITEMS.filter((n) => n.primary).map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                active ? 'text-blueprint-700' : 'text-timber-500',
              )}
            >
              <Icon size={20} />
              {item.short}
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', pathname === '/settings' ? 'text-blueprint-700' : 'text-timber-500')}
        >
          <span className="text-[20px] leading-none">⋯</span>
          More
        </Link>
      </nav>
    </div>
  );
}
