import { TestBed } from '@angular/core/testing';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { NotificationService } from '@core/notifications/notification.service';
import { PDF_MAKE, PdfRenderer, type PdfMake } from './pdf-renderer';

const doc: TDocumentDefinitions = { content: 'Hello' };

describe('PdfRenderer', () => {
  const tab = { close: vi.fn() } as unknown as Window;
  const pdfOpen = vi.fn<(win?: Window | null) => Promise<void>>();
  const pdfMake = {
    createPdf: vi.fn(() => ({ open: pdfOpen })),
    setFonts: vi.fn(),
  } satisfies PdfMake;
  const load = vi.fn(() => Promise.resolve(pdfMake));
  const notify = { error: vi.fn() };
  let renderer: PdfRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    pdfOpen.mockResolvedValue(undefined);
    load.mockImplementation(() => Promise.resolve(pdfMake));
    vi.spyOn(window, 'open').mockReturnValue(tab);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: PDF_MAKE, useValue: load },
        { provide: NotificationService, useValue: notify },
      ],
    });
    renderer = TestBed.inject(PdfRenderer);
  });

  afterEach(() => vi.restoreAllMocks());

  it('opens the tab at once, then shows the document there in Poppins', async () => {
    const opened = renderer.open(() => doc);
    expect(window.open).toHaveBeenCalledWith('', '_blank');

    expect(await opened).toBe(true);
    expect(pdfMake.setFonts).toHaveBeenCalledWith({
      Poppins: {
        normal: renderer.assetUrl('fonts/Poppins-Regular.ttf'),
        bold: renderer.assetUrl('fonts/Poppins-Medium.ttf'),
      },
    });
    expect(pdfMake.createPdf).toHaveBeenCalledWith(doc);
    expect(pdfOpen).toHaveBeenCalledWith(tab);
  });

  it('gives app files as full addresses under the base href', () => {
    expect(renderer.assetUrl('images/logo.png')).toBe(
      new URL('images/logo.png', document.baseURI).href,
    );
  });

  it('loads pdfmake once', async () => {
    await renderer.open(() => doc);
    await renderer.open(() => doc);
    expect(load).toHaveBeenCalledTimes(1);
    expect(pdfMake.setFonts).toHaveBeenCalledTimes(1);
  });

  it('closes the tab and says so when the document cannot be built', async () => {
    pdfOpen.mockRejectedValue(new Error('font missing'));
    expect(await renderer.open(() => doc)).toBe(false);
    expect(tab.close).toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('The PDF could not be created. Please try again.');
  });

  it('tries loading pdfmake again after a failed load', async () => {
    load.mockRejectedValueOnce(new Error('offline'));
    expect(await renderer.open(() => doc)).toBe(false);
    expect(await renderer.open(() => doc)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
