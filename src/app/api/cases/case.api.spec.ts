import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { caseDeceased, caseDetails, caseValidation } from '../../../testing/case.fixtures';
import { CaseApi } from './case.api';

describe('CaseApi', () => {
  let backend: HttpTestingController;
  let api: CaseApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CaseApi);
  });

  afterEach(() => backend.verify());

  it('lists cases newest first', async () => {
    const listed = firstValueFrom(api.list());
    backend
      .expectOne({ method: 'GET', url: 'CaseDetails' })
      .flush([caseDetails({ CaseDetailId: 2 }), caseDetails({ CaseDetailId: 9 })]);
    expect((await listed).map((c) => c.CaseDetailId)).toEqual([9, 2]);
  });

  it('opens one case and creates one for a client service', async () => {
    const opened = firstValueFrom(api.open(4));
    backend
      .expectOne({ method: 'GET', url: 'CaseDetails/4' })
      .flush(caseDetails({ CaseDetailId: 4 }));
    expect((await opened).CaseDetailId).toBe(4);

    const created = firstValueFrom(api.create(1, 5));
    const request = backend.expectOne({ method: 'POST', url: 'CaseDetails' });
    expect(request.request.body).toEqual({ CaseClientId: 1, CaseClientServiceId: 5 });
    request.flush(caseDetails({ CaseDetailId: 12 }));
    expect((await created).CaseDetailId).toBe(12);
  });

  it('lets go of a case with its status and reads the text answer', async () => {
    const exited = firstValueFrom(api.exit(4, 'Active'));
    const request = backend.expectOne(
      (r) => r.method === 'GET' && r.url === 'CaseExit/4' && r.params.get('status') === 'Active',
    );
    expect(request.request.responseType).toBe('text');
    request.flush('Case exited');
    expect(await exited).toBe('Case exited');
  });

  it('loads the case lookups', async () => {
    const init = firstValueFrom(api.init());
    backend
      .expectOne({ method: 'GET', url: 'CaseInit' })
      .flush({ ClientDto: [], ServiceTypeBasedTabs: [] });
    expect(await init).toEqual({ ClientDto: [], ServiceTypeBasedTabs: [] });
  });

  it('saves the case with its changes, without the records it includes', async () => {
    const details = caseDetails({
      CaseDetailId: 4,
      CaseStatus: 'Pending',
      CaseDeceasedInfo: caseDeceased(),
      CaseValidation: [caseValidation()],
      ContactDetails: [],
    });
    const saved = firstValueFrom(api.update(details, { AgentId: 9 }));
    const request = backend.expectOne({ method: 'POST', url: 'CaseDetails/4' });
    expect(request.request.body).toMatchObject({
      CaseStatus: 'Pending',
      AgentId: 9,
      ContactDetails: [],
    });
    expect(request.request.body).not.toHaveProperty('CaseDeceasedInfo');
    expect(request.request.body).not.toHaveProperty('CaseValidation');
    request.flush(details);
    await saved;
  });

  it('creates or replaces validation and deceased records', async () => {
    const created = firstValueFrom(api.saveValidation(caseValidation({ CaseValidationId: 0 })));
    backend.expectOne({ method: 'POST', url: 'CaseValidation' }).flush(caseValidation());
    await created;
    const updated = firstValueFrom(api.saveDeceased(caseDeceased({ CaseDeceasedInfoId: 30 })));
    backend.expectOne({ method: 'POST', url: 'CaseDeceasedInfo/30' }).flush(caseDeceased());
    await updated;
  });

  it("asks the client's policy system", async () => {
    const matches = firstValueFrom(
      api.fetchPolicy(4, {
        clientId: 1,
        deceasedId: 'X1',
        policyNumber: null,
        dateOfDeath: '2026-11-01',
      }),
    );
    const request = backend.expectOne({
      method: 'POST',
      url: 'CaseValidation/FetchPolicyDetails/4',
    });
    expect(request.request.body).toEqual({
      CaseDetailId: 4,
      ClientId: 1,
      DeceaseId: 'X1',
      PolicyNumber: null,
      DateOfDeath: '2026-11-01',
    });
    request.flush([]);
    expect(await matches).toEqual([]);
  });
});
