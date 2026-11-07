import { of } from 'rxjs';
import type { CaseFinalFuneralRecord } from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { ServiceProvider } from '@api/services/service-provider.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

const provider = (id: number, name: string, extra: Partial<ServiceProvider> = {}) =>
  ({
    ServiceProviderId: id,
    Name: name,
    Province: 'Gauteng',
    OfficeAddress: `${id} Main Road`,
    StorageAddress: `${id} Cold Store`,
    IsActive: true,
    IsDeleted: false,
    ContactDetails: [
      {
        Id: 1,
        Type: 'Combined',
        Code: '+27',
        Value: '821234567',
        Mobile: null,
        Name: `Manager ${id}`,
        Fax: '0114567890',
        Email: null,
      },
    ],
    ...extra,
  }) as ServiceProvider;

const client = (...providers: ServiceProvider[]) =>
  ({
    ClientId: 1,
    ClientServiceProvider: providers.map((dto, index) => ({
      ClientServiceProviderId: index + 1,
      ClientId: 1,
      ServiceProviderId: dto.ServiceProviderId,
      IsDeleted: false,
      ServiceProviderDto: dto,
    })),
  }) as unknown as ClientWithLinks;

const funeral = (extra: Partial<CaseFinalFuneralRecord> = {}): CaseFinalFuneralRecord => ({
  CaseFinalFuneralId: 60,
  CaseDetailId: 4,
  FuneralHomeName: 'Kept',
  FuneralParlour: 'avbob east',
  FuneralProvince: 'Limpopo',
  ManagerName: 'Old Manager',
  BurialDate: '2026-11-10T00:00:00',
  PhysicalAddress: 'Old address',
  StorageAddress: 'Old store',
  TelephoneNumber: '+27 82 000 0000',
  FaxNumber: null,
  MobileNumber: '+27 83 123 4567',
  Priority: 'High',
  ...extra,
});

/** A case on the Groceries (AVS) service, which has the Final Funeral tab. */
const avs = (saved: CaseFinalFuneralRecord | null = null) =>
  held({ CaseClientServiceId: 6, CaseFinalFuneral: saved });

describe('Final Funeral tab', () => {
  const { api, clients, show, type, choose, openTab, value, element } = caseTabHarness();

  const saved = () => api.saveFinalFuneral.mock.calls[0]?.[0] as CaseFinalFuneralRecord;
  const options = () =>
    [...element<HTMLSelectElement>('#ff-parlour').options].map((option) => option.text.trim());

  it('lists the client’s active parlours and keeps the saved details as saved', async () => {
    clients.get.mockReturnValue(
      of(
        client(
          provider(2, 'Zulu Funerals'),
          provider(1, 'AVBOB East'),
          provider(3, 'Closed', { IsActive: false }),
        ),
      ),
    );
    await show(avs(funeral()));
    await openTab('Final Funeral');
    expect(clients.get).toHaveBeenCalledWith(1);
    expect(options()).toEqual(['Select Service Provider', 'AVBOB East', 'Zulu Funerals']);
    expect(value('ff-parlour')).toBe('AVBOB East');
    expect(value('ff-manager')).toBe('Old Manager');
    expect(value('ff-province')).toBe('Limpopo');
    await openTab('Caller');
    expect(api.saveFinalFuneral).not.toHaveBeenCalled();
  });

  it('copies the chosen parlour’s details and saves the whole record', async () => {
    clients.get.mockReturnValue(of(client(provider(1, 'AVBOB East'), provider(2, 'Zulu'))));
    await show(avs(funeral()));
    await openTab('Final Funeral');
    await choose('ff-parlour', 'Zulu');
    expect(value('ff-manager')).toBe('Manager 2');
    expect(value('ff-telephone')).toBe('+27 82 123 4567');
    await type('ff-priority', 'Urgent');
    await openTab('Caller');
    expect(saved()).toEqual({
      ...funeral(),
      FuneralParlour: 'Zulu',
      FuneralProvince: 'Gauteng',
      ManagerName: 'Manager 2',
      PhysicalAddress: '2 Main Road',
      StorageAddress: '2 Cold Store',
      TelephoneNumber: '+27 82 123 4567',
      FaxNumber: '+27 11 456 7890',
      BurialDate: '2026-11-10',
      MobileNumber: '+27 83 123 4567',
      Priority: 'Urgent',
    });
  });

  it('keeps a parlour the client no longer has', async () => {
    await show(avs(funeral({ FuneralParlour: 'Gone Funerals' })));
    await openTab('Final Funeral');
    expect(value('ff-parlour')).toBe('Gone Funerals');
    await choose('ff-parlour', 'Select Service Provider');
    expect(value('ff-manager')).toBe('');
    await choose('ff-parlour', 'Gone Funerals (no longer linked to the client)');
    expect(value('ff-manager')).toBe('Old Manager');
    await type('ff-burial', '2026-12-01');
    await openTab('Caller');
    expect(saved()).toMatchObject({
      FuneralParlour: 'Gone Funerals',
      ManagerName: 'Old Manager',
      BurialDate: '2026-12-01',
    });
  });

  it('makes a new record once something is entered', async () => {
    await show(avs());
    await openTab('Final Funeral');
    await openTab('Caller');
    expect(api.saveFinalFuneral).not.toHaveBeenCalled();
    await openTab('Final Funeral');
    await type('ff-priority', 'Low');
    await openTab('Caller');
    expect(saved()).toMatchObject({ CaseFinalFuneralId: 0, CaseDetailId: 4, Priority: 'Low' });
  });
});
