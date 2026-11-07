import type { CaseInitService } from '@api/cases/case.api';

export interface DashboardTab {
  readonly kind: 'dashboard';
  readonly id: 'dashboard';
  readonly label: string;
}

/** All the client's cases in the period. */
export interface ClientTab {
  readonly kind: 'client';
  readonly id: string;
  readonly label: string;
  readonly clientId: number;
}

/** The cases of one of the client's services, with that service type's columns. */
export interface ServiceTab {
  readonly kind: 'service';
  readonly id: string;
  readonly label: string;
  readonly clientId: number;
  readonly serviceId: number;
  readonly serviceTypeCode: string;
  /** A row per voucher, with the voucher columns. */
  readonly isVoucherService: boolean;
}

export type ReportTab = DashboardTab | ClientTab | ServiceTab;
export type TableTab = ClientTab | ServiceTab;

/**
 * v21 report tabs: Dashboard, the client, then each chosen service (all the client's services
 * when none is chosen).
 */
export function reportTabs(
  client: { readonly id: number; readonly name: string },
  services: readonly CaseInitService[],
  chosen: readonly number[],
): ReportTab[] {
  const shown = chosen.length
    ? services.filter((service) => chosen.includes(service.ServiceId))
    : services;
  return [
    { kind: 'dashboard', id: 'dashboard', label: 'Dashboard' },
    { kind: 'client', id: `client-${client.id}`, label: client.name, clientId: client.id },
    ...shown.map((service): ServiceTab => ({
      kind: 'service',
      id: `service-${client.id}-${service.ServiceId}`,
      label: `${client.name} - ${service.ServiceName}`,
      clientId: client.id,
      serviceId: service.ServiceId,
      serviceTypeCode: (service.ServiceTypeCode ?? '').trim().toUpperCase(),
      isVoucherService: service.IsVoucherService,
    })),
  ];
}
