import type { CaseCauseOfDeathRecord } from '@api/cases/case.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

const record = (extra: Partial<CaseCauseOfDeathRecord> = {}): CaseCauseOfDeathRecord => ({
  CaseCauseOfDeathId: 50,
  CaseDetailId: 4,
  CauseOfDeathDescription: 'Unnatural',
  BodyNumber: 'B-12',
  TelephoneNumber: null,
  CauseOfDeathNotes: null,
  MortuaryState: 'Salt River',
  IsPostMortemDone: true,
  PostMortemPlace: 'Salt River',
  BodyWeight: 72.5,
  ReleaseDate: '2026-11-02',
  ReleaseTime: '09:30:00',
  ...extra,
});

/** A case on the Groceries (AVS) service, which has the Cause Of Death tab. */
const avs = (cause: CaseCauseOfDeathRecord | null = null) =>
  held({ CaseClientServiceId: 6, CaseCauseOfDeath: cause });

describe('Cause Of Death tab', () => {
  const { api, notify, show, type, choose, openTab, selectedTab, value, text } = caseTabHarness();

  const saved = () => api.saveCauseOfDeath.mock.calls[0]?.[0] as CaseCauseOfDeathRecord;

  it('shows a saved unnatural death with its mortuary and release', async () => {
    await show(avs(record()));
    await openTab('Cause Of Death');
    expect(value('cod-cause')).toContain('Unnatural');
    expect(value('cod-mortuary')).toBe('Salt River');
    expect(value('cod-weight')).toBe('72.5');
    expect(value('cod-release-time')).toBe('09:30');
    await openTab('Caller');
    expect(api.saveCauseOfDeath).not.toHaveBeenCalled();
  });

  it('needs the cause, and a state mortuary for an unnatural death', async () => {
    await show(avs());
    await openTab('Cause Of Death');
    expect(text()).not.toContain('State Mortuary');
    await type('cod-body-number', 'B-1');
    await openTab('Caller');
    expect(selectedTab()).toBe('Cause Of Death');
    expect(text()).toContain('Cause of Death is required.');

    await choose('cod-cause', 'Unnatural');
    await type('cod-weight', '1000');
    await openTab('Caller');
    expect(text()).toContain('State Mortuary is required for an unnatural death.');
    expect(text()).toContain('Enter a weight up to 999.99 kg.');
    expect(notify.warning).toHaveBeenCalledWith(
      'Please correct the highlighted fields on the Cause Of Death tab.',
    );

    await type('cod-mortuary', 'Gale Street');
    await type('cod-weight', '80.25');
    await type('cod-release-date', '2026-11-03');
    await type('cod-release-time', '14:15');
    await openTab('Caller');
    expect(selectedTab()).toBe('Caller');
    expect(saved()).toMatchObject({
      CaseCauseOfDeathId: 0,
      CaseDetailId: 4,
      CauseOfDeathDescription: 'Unnatural',
      BodyNumber: 'B-1',
      MortuaryState: 'Gale Street',
      IsPostMortemDone: false,
      BodyWeight: 80.25,
      ReleaseDate: '2026-11-03',
      ReleaseTime: '14:15:00',
    });
  });

  it('drops the unnatural-death details for another cause', async () => {
    await show(avs(record()));
    await openTab('Cause Of Death');
    await choose('cod-cause', 'Natural');
    expect(text()).not.toContain('State Mortuary');
    await type('cod-notes', 'Heart failure');
    await openTab('Caller');
    expect(saved()).toEqual({
      ...record(),
      CauseOfDeathDescription: 'Natural',
      CauseOfDeathNotes: 'Heart failure',
      MortuaryState: null,
      IsPostMortemDone: null,
      PostMortemPlace: null,
      BodyWeight: null,
      ReleaseDate: null,
      ReleaseTime: null,
    });
    expect(notify.success).toHaveBeenCalledWith('Cause of death saved.');
  });
});
