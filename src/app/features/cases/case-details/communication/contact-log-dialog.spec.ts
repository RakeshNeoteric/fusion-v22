import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ContactLogDialog } from './contact-log-dialog';
import type { HistoryRow } from './history-rows';

describe('ContactLogDialog', () => {
  async function render(log: Partial<HistoryRow>): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            id: 1,
            createdDate: '2026-10-23T12:17:00',
            user: 'Dayakar Nuchu',
            type: 'AutoLog',
            note: '',
            ...log,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ContactLogDialog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const rows = (element: HTMLElement) =>
    [...element.querySelectorAll('.cl-changes tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );

  it('shows who, when and the type', async () => {
    const element = await render({ note: 'Family called back', type: 'Inbound' });
    expect(element.querySelector('.cl-badge')?.textContent?.trim()).toBe('Inbound');
    expect(element.querySelector('.cl-avatar')?.textContent?.trim()).toBe('DN');
    expect(element.textContent).toContain('Dayakar Nuchu');
    expect(element.querySelector('.cl-subtitle')?.textContent?.trim()).toMatch(/^\d{2}\/10\/2026/);
  });

  it('lists an automatic log of changes as a table of what changed', async () => {
    const element = await render({
      note: 'CaseControllerUserId: louisa@fms.co.za -> \nCaseOpenedBy:  -> dayakar@neo.com',
    });
    expect(element.textContent).toContain('What changed');
    expect(rows(element)).toEqual([
      ['Case Controller User Id', 'louisa@fms.co.za', 'empty'],
      ['Case Opened By', 'empty', 'dayakar@neo.com'],
    ]);
    expect(element.querySelector('.cl-note')).toBeNull();
  });

  it('shows any other note as written, line breaks kept', async () => {
    const element = await render({ type: 'SMS', note: 'Your case is open\nRef REF1' });
    expect(element.querySelector('.cl-changes')).toBeNull();
    expect(element.querySelector('.cl-note')?.textContent).toBe('Your case is open\nRef REF1');
  });
});
