import { capitecCards } from './capitec-dashboard';
import type { DashboardInput } from './dashboard-input';
import type { ClientDashboardView, DashboardCard } from './dashboard-model';
import { serviceTiles, summaryTiles } from './dashboard-tiles';
import { nedgroupCards } from './nedgroup-dashboard';
import { standardCards } from './standard-dashboard';

/** The clients with a dashboard of their own; every other client gets FNB's (v21). */
export type DashboardLayout = 'nedgroup' | 'capitec' | 'standard';

/**
 * The dashboard a client gets, by its name. v21 picked the charts by "name contains" but laid
 * them out by exact name, so "Nedgroup Life" got Nedgroup's charts in a layout with none of
 * them; both now go by "contains".
 */
export function dashboardLayout(clientName: string): DashboardLayout {
  const name = clientName.toUpperCase();
  if (name.includes('NEDGROUP')) return 'nedgroup';
  if (name.includes('CAPITEC')) return 'capitec';
  return 'standard';
}

const CARDS: Record<DashboardLayout, (input: DashboardInput) => DashboardCard[]> = {
  nedgroup: nedgroupCards,
  capitec: capitecCards,
  standard: standardCards,
};

export function clientDashboard(clientName: string, input: DashboardInput): ClientDashboardView {
  return {
    tiles: serviceTiles(input),
    cards: CARDS[dashboardLayout(clientName)](input),
    summary: summaryTiles(input.dashboard),
  };
}
