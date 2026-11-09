import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CaseApi } from '@api/cases/case.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { RequestCache } from '@core/http/request-cache';
import { CASE_INIT } from '../../../testing/case.fixtures';
import { CaseLookups } from './case-lookups';

describe('CaseLookups', () => {
  const cases = { init: vi.fn(), list: vi.fn() };
  const documentTypes = { listIncludingDeleted: vi.fn() };
  let lookups: CaseLookups;
  let cache: RequestCache;

  beforeEach(() => {
    cases.init.mockReset().mockReturnValue(of(CASE_INIT));
    cases.list.mockReset().mockReturnValue(of([]));
    documentTypes.listIncludingDeleted.mockReset().mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: CaseApi, useValue: cases },
        { provide: DocumentTypeApi, useValue: documentTypes },
      ],
    });
    lookups = TestBed.inject(CaseLookups);
    cache = TestBed.inject(RequestCache);
  });

  it('loads CaseInit once for the list and every case', async () => {
    await lookups.init();
    await lookups.init();
    expect(cases.init).toHaveBeenCalledTimes(1);
    expect(lookups.lastInit()).toBe(CASE_INIT);
  });

  it.each([
    'Client',
    'Client/ClientService',
    'Client/ClientServiceProvider',
    'Service/7',
    'ServiceProvider',
    'ServiceProvider/3',
    'Config/ServiceTypes/2',
    'Config/CompanyDetails',
  ])('loads CaseInit again after a save to %s', async (path) => {
    await lookups.init();
    cache.saved(path);
    await lookups.init();
    expect(cases.init).toHaveBeenCalledTimes(2);
  });

  it.each(['ClientGroup', 'CaseDetails/4', 'Config/Document', 'Users'])(
    'keeps CaseInit after a save to %s',
    async (path) => {
      await lookups.init();
      cache.saved(path);
      await lookups.init();
      expect(cases.init).toHaveBeenCalledTimes(1);
    },
  );

  it('shares a lookup until it is saved on its own screen', async () => {
    await lookups.allDocumentTypes();
    await lookups.allDocumentTypes();
    cache.saved('Config/DocumentCategory');
    await lookups.allDocumentTypes();
    expect(documentTypes.listIncludingDeleted).toHaveBeenCalledTimes(1);

    cache.saved('Config/Document/12');
    await lookups.allDocumentTypes();
    expect(documentTypes.listIncludingDeleted).toHaveBeenCalledTimes(2);
  });

  it('always loads the case list fresh, keeping the last copy', async () => {
    expect(lookups.lastCaseList()).toBeUndefined();
    await lookups.loadCaseList();
    await lookups.loadCaseList();
    expect(cases.list).toHaveBeenCalledTimes(2);
    expect(lookups.lastCaseList()).toEqual([]);
  });
});
