import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { type ServiceType, ServiceTypeApi } from '@api/config/service-type.api';
import { ServiceTypeLookup } from './service-type-lookup';

const type = (code: string, description: string, status: Partial<ServiceType>): ServiceType =>
  ({
    ServiceTypeCode: code,
    Description: description,
    IsActive: true,
    IsDeleted: false,
    ...status,
  }) as ServiceType;

describe('ServiceTypeLookup', () => {
  async function lookupOf(types: ServiceType[]): Promise<ServiceTypeLookup> {
    TestBed.configureTestingModule({
      providers: [
        ServiceTypeLookup,
        { provide: ServiceTypeApi, useValue: { listIncludingDeleted: () => of(types) } },
      ],
    });
    const lookup = TestBed.inject(ServiceTypeLookup);
    await firstValueFrom(lookup.load());
    return lookup;
  }

  it('names a reused code after its live record, not the deleted one', async () => {
    const lookup = await lookupOf([
      type('TOW', 'Towing', { IsActive: true }),
      type('TOW', 'Old towing', { IsDeleted: true }),
    ]);
    expect(lookup.label('TOW')).toBe('Towing');
    expect(lookup.options()).toEqual([{ value: 'TOW', label: 'Towing', selectable: true }]);
    expect(lookup.choices(null).map((option) => option.label)).toEqual(['Towing']);
  });

  it('prefers an inactive record to a deleted one', async () => {
    const lookup = await lookupOf([
      type('REC', 'Recovery', { IsDeleted: true }),
      type('REC', 'Recovery', { IsActive: false }),
    ]);
    expect(lookup.label('REC')).toBe('Recovery (Inactive)');
  });
});
