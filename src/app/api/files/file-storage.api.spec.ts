import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FileStorageApi, storagePath, uniqueName } from './file-storage.api';

describe('FileStorageApi', () => {
  it('uploads under a unique name, so two "logo.png" never replace each other', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(FileStorageApi);
    const backend = TestBed.inject(HttpTestingController);

    const stored = firstValueFrom(api.upload(new File(['x'], 'logo.png'), 'Client'));
    const request = backend.expectOne((req) => req.url === 'File/upload');
    const sent = (request.request.body as FormData).get('File') as File;
    expect(sent.name).toMatch(/^logo-[a-z0-9]+\.png$/);
    expect(request.request.params.get('FilePath')).toBe('Client');
    request.flush({ FilePath: `Client/${sent.name}` });
    expect(await stored).toBe(`Client/${sent.name}`);
  });

  it.each([
    ['logo.png', /^logo-[a-z0-9]+\.png$/],
    ['report.v2.pdf', /^report\.v2-[a-z0-9]+\.pdf$/],
    ['README', /^README-[a-z0-9]+$/],
  ])('names %s uniquely, keeping its extension', (name, pattern) => {
    expect(uniqueName(name)).toMatch(pattern);
    expect(uniqueName(name)).not.toBe(uniqueName(name));
  });

  it('reads a storage path out of a download URL', () => {
    expect(storagePath('https://api/File/download?fileName=Client%2Flogo.png')).toBe(
      'Client/logo.png',
    );
    expect(storagePath(' Client/logo.png ')).toBe('Client/logo.png');
  });
});
