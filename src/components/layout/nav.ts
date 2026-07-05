import {
  Home,
  SlidersHorizontal,
  Box,
  Package,
  ShoppingCart,
  Scissors,
  Hammer,
  Egg,
  Layers,
  Warehouse,
  Camera,
  Printer,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  short: string; // for the mobile bottom bar
  icon: LucideIcon;
  primary?: boolean; // shown in the mobile bottom bar
}

/** The 13 app screens. `primary` ones appear in the mobile bottom nav. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: Home, primary: true },
  { href: '/design', label: 'Design Settings', short: 'Design', icon: SlidersHorizontal, primary: true },
  { href: '/model', label: '3D Model', short: '3D', icon: Box, primary: true },
  { href: '/materials', label: 'Materials & Pricing', short: 'Materials', icon: Package, primary: true },
  { href: '/shopping', label: 'Shopping Mode', short: 'Shop', icon: ShoppingCart },
  { href: '/cutlist', label: 'Cut List', short: 'Cuts', icon: Scissors },
  { href: '/checklist', label: 'Build Checklist', short: 'Build', icon: Hammer, primary: true },
  { href: '/nesting', label: 'Nesting Boxes', short: 'Nesting', icon: Egg },
  { href: '/siding', label: 'Siding Compare', short: 'Siding', icon: Layers },
  { href: '/owned', label: 'Owned Materials', short: 'Owned', icon: Warehouse },
  { href: '/photos', label: 'Photos', short: 'Photos', icon: Camera },
  { href: '/export', label: 'Export & Print', short: 'Export', icon: Printer },
  { href: '/settings', label: 'Settings & Backup', short: 'Settings', icon: Settings },
];
