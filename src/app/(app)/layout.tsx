import { AppShell } from '@/components/layout/AppShell';

/**
 * Shared layout for all authenticated screens. The middleware guarantees a user
 * reaching here has passed the password gate; AppShell loads the project data.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
