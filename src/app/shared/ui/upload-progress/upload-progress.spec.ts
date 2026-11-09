import { TestBed } from '@angular/core/testing';
import { UploadProgressBar } from './upload-progress';

describe('UploadProgressBar', () => {
  async function render(percent: number) {
    const fixture = TestBed.createComponent(UploadProgressBar);
    fixture.componentRef.setInput('upload', { name: 'logo.png', percent });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the file, how much is sent and a bar that far along', async () => {
    const host = await render(45);
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('45');
    expect(host.textContent).toContain('Uploading logo.png');
    expect(host.textContent).toContain('45%');
    expect(host.querySelector<HTMLElement>('.up-fill')?.style.width).toBe('45%');
  });

  it('says "Finishing…" once the file is sent and the server is storing it', async () => {
    const host = await render(100);
    expect(host.textContent).toContain('Finishing…');
  });
});
