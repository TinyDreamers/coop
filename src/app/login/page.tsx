'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Feather, Lock } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';

/**
 * Simple password gate (no accounts). Posts to /api/auth which sets the cookie
 * the middleware checks. Default password is "coop".
 *
 * The form reads the `?from=` search param, so it must live inside a Suspense
 * boundary (Next.js requirement for useSearchParams during static generation).
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-timber-100">
          <Spinner className="h-7 w-7" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = params.get('from') || '/';
        router.push(from);
        router.refresh();
      } else {
        setError('Incorrect password. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-timber-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-timber-800 text-white">
            <Feather className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-timber-900">Coop Planner</h1>
          <p className="mt-1 text-sm text-timber-600">
            Design, price &amp; build your 24-bird walk-in coop + run.
          </p>
        </div>

        <form onSubmit={submit} className="card p-5">
          <label className="label" htmlFor="pw">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-timber-400" />
            <input
              id="pw"
              type="password"
              autoFocus
              className="input pl-9"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          <Button variant="primary" type="submit" className="mt-4 w-full" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4 text-white" /> : 'Enter'}
          </Button>
          <p className="mt-3 text-center text-xs text-timber-500">
            No accounts — one shared password protects this plan.
          </p>
        </form>
      </div>
    </div>
  );
}
