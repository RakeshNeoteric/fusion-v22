import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import type { CaseRatingRecord } from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { RatingQuestionOption } from '@api/config/rating-question-option.api';
import type { RatingQuestionType } from '@api/config/rating-question-type.api';
import type { DirectoryUser } from '@api/models/app.models';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { caseTabHarness, held } from '../tabs/testing/case-tab-harness';
import { dropdownOptions, dropdownText } from '../../../../../testing/form-controls';

const controller = (id: number, first: string, last: string): DirectoryUser => ({
  AspNetUserId: id,
  UserName: null,
  UserEmail: `${first.toLowerCase()}@x.com`,
  Firstname: first,
  Lastname: last,
  IsActive: true,
  IsDeleted: false,
});

const question = (linkId: number, rank: number, typeId: number, text: string) => ({
  ClientRatingQuestionId: linkId,
  ClientId: 1,
  RatingQuestionId: linkId + 100,
  ListRank: rank,
  IsDeleted: false,
  RatingQuestion: {
    RatingQuestionId: linkId + 100,
    RatingQuestionTypeId: typeId,
    Question: text,
    ListRank: rank,
    IsActive: true,
    IsDeleted: false,
  },
});

/** Zulu Insure asks two rating questions: the service (Good / Poor), then politeness (Yes/No). */
const RATED_CLIENT = {
  ClientId: 1,
  ClientService: [],
  ClientRatingQuestion: [
    question(21, 2, 5, 'Was the agent polite?'),
    question(20, 1, 6, 'How was the service?'),
  ],
} as unknown as ClientWithLinks;

const type = (id: number, name: string): RatingQuestionType => ({
  RatingQuestionTypeId: id,
  QuestionType: name,
  IncludeInRatingCalcs: true,
  IsActive: true,
  IsDeleted: false,
});

const option = (id: number, typeId: number, name: string): RatingQuestionOption => ({
  RatingQuestionOptionId: id,
  RatingQuestionTypeId: typeId,
  QuestionOption: name,
  QualifyingPrompt: '',
  RatingValue: null,
  IsNoteRequired: false,
  DoRaiseFlag: false,
  IsActive: true,
  IsDeleted: false,
});

const rating = (id: number, linkId: number, answer: string): CaseRatingRecord => ({
  CaseRatingId: id,
  CaseDetailId: 4,
  ContactName: 'Ann Lee',
  ContactNumber: '+27 82 123 4567',
  ClientRatingQuestionId: linkId,
  Question: '',
  QuestionAnswer: answer,
});

describe('Case lifecycle (Case Details header)', () => {
  const h = caseTabHarness();
  const {
    api,
    clients,
    ratingTypes,
    ratingOptions,
    notify,
    show,
    settle,
    press,
    choose,
    type: typeInto,
    text,
    value,
    disabled,
    openMenu,
    menuItem,
    fromMenu,
  } = h;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(UserDirectoryService).load([
      { RoleId: 1, RoleName: 'Agent', Users: [controller(7, 'Jane', 'Doe')] },
      {
        RoleId: 2,
        RoleName: 'CaseController',
        Users: [controller(3, 'Carl', 'Ng'), controller(5, 'Dee', 'Moyo')],
      },
    ]);
    ratingTypes.listIncludingDeleted.mockReturnValue(of([type(5, 'Yes/No'), type(6, 'Service')]));
    ratingOptions.listIncludingDeleted.mockReturnValue(
      of(
        [option(2, 6, 'Poor'), option(1, 6, 'Good'), option(3, 5, 'Retired')].map((o) =>
          o.QuestionOption === 'Retired' ? { ...o, IsActive: false } : o,
        ),
      ),
    );
  });

  const headerButton = (label: string) =>
    document.querySelector<HTMLButtonElement>(`.cd-actions button[aria-label="${label}"]`);
  async function click(label: string): Promise<void> {
    headerButton(label)?.click();
    await settle();
  }

  /** Answers the Exit popup (the Caller tab has Yes / No buttons of its own). */
  async function answerExit(label: 'Yes' | 'No'): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('app-exit-dialog button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`no ${label} in the Exit popup`);
    button.click();
    await settle();
  }

  describe('Exit', () => {
    it('No lets go of the case as it is and goes back to the cases', async () => {
      await show(held());
      await click('Exit');
      expect(text()).toContain('Is the call complete?');
      expect(value('ex-reference')).toBe(held().CaseReferenceNumber ?? '');

      await answerExit('No');
      expect(api.exit).toHaveBeenCalledTimes(1);
      expect(api.exit).toHaveBeenCalledWith(4, 'Pending');
      expect(navigate).toHaveBeenCalledWith(['/cases']);
    });

    it('× stays on the case', async () => {
      await show(held());
      await click('Exit');
      await press('×');
      expect(api.exit).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('Yes closes a case whose client asks no rating questions', async () => {
      await show(held());
      await click('Exit');
      await answerExit('Yes');

      expect(api.exit).toHaveBeenCalledWith(4, 'Closed');
      expect(notify.success).toHaveBeenCalledWith('Case closed.');
      expect(navigate).toHaveBeenCalledWith(['/cases']);
    });

    it('Yes asks for the rating first; Close Rating Completed saves it and closes the case', async () => {
      clients.get.mockReturnValue(of(RATED_CLIENT));
      await show(held());
      await click('Exit');
      await answerExit('Yes');

      expect(api.exit).not.toHaveBeenCalled();
      expect(text()).toContain('Case Rating');
      expect(value('cr-contact-name')).toBe('Ann Lee');
      expect(value('cr-contact-phone')).toBe('+27 82 123 4567');
      const questions = [...document.querySelectorAll('app-rating-dialog tbody tr')].map((row) =>
        row.querySelector('td')?.textContent?.trim(),
      );
      expect(questions).toEqual(['How was the service?', 'Was the agent polite?']);
      // Configured options in their order (inactive ones left out); else the type's name split.
      expect(await dropdownOptions('cr-answer-20')).toEqual(['-- Select --', 'Good', 'Poor']);
      expect(await dropdownOptions('cr-answer-21')).toEqual(['-- Select --', 'Yes', 'No']);

      await press('Close Rating Completed');
      expect(notify.warning).toHaveBeenCalledWith(
        'Please answer all rating questions before closing.',
      );
      expect(api.saveRatings).not.toHaveBeenCalled();

      await choose('cr-answer-20', 'Good');
      await choose('cr-answer-21', 'Yes');
      expect(text()).toContain('2 of 2 questions answered.');
      await press('Close Rating Completed');

      const contact = { CaseDetailId: 4, ContactName: 'Ann Lee', ContactNumber: '+27 82 123 4567' };
      expect(api.saveRatings).toHaveBeenCalledWith(
        [
          {
            ...contact,
            CaseRatingId: 0,
            ClientRatingQuestionId: 20,
            Question: 'How was the service?',
            QuestionAnswer: 'Good',
          },
          {
            ...contact,
            CaseRatingId: 0,
            ClientRatingQuestionId: 21,
            Question: 'Was the agent polite?',
            QuestionAnswer: 'Yes',
          },
        ],
        true,
      );
      expect(api.exit).toHaveBeenCalledWith(4, 'Closed');
      expect(navigate).toHaveBeenCalledWith(['/cases']);
    });

    it('Yes closes at once when every rating question is answered', async () => {
      clients.get.mockReturnValue(of(RATED_CLIENT));
      await show(held({ CaseRatings: [rating(31, 20, 'Good'), rating(32, 21, 'No')] }));
      await click('Exit');
      await answerExit('Yes');

      expect(document.querySelector('app-rating-dialog')).toBeNull();
      expect(api.exit).toHaveBeenCalledWith(4, 'Closed');
    });

    it('a case the user cannot change is just left, without a new closed date', async () => {
      await show(held({ CaseStatus: 'Closed' }));
      await click('Exit');

      expect(text()).not.toContain('Is the call complete?');
      // CaseExit with Closed would stamp the closed date again.
      expect(api.exit).not.toHaveBeenCalled();
      expect(api.releaseFinished).toHaveBeenCalledWith(
        expect.objectContaining({ CaseDetailId: 4, CaseStatus: 'Closed' }),
      );
      expect(navigate).toHaveBeenCalledWith(['/cases']);
    });
  });

  describe('Case Rating', () => {
    it('Update saves the answers so far, keeping the case open', async () => {
      clients.get.mockReturnValue(of(RATED_CLIENT));
      const details = held({ CaseRatings: [rating(31, 20, 'Poor')] });
      await show(details);
      await fromMenu('Case Rating');

      expect(value('cr-answer-20')).toBe('Poor');
      expect(text()).toContain('1 of 2 questions answered.');
      await press('Update');
      expect(notify.info).toHaveBeenCalledWith('No changes to save.');

      api.open.mockReturnValue(
        of({ ...details, CaseRatings: [rating(31, 20, 'Poor'), rating(33, 21, 'No')] }),
      );
      await choose('cr-answer-21', 'No');
      await press('Update');

      expect(api.saveRatings).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            CaseRatingId: 31,
            ClientRatingQuestionId: 20,
            QuestionAnswer: 'Poor',
          }),
          expect.objectContaining({
            CaseRatingId: 0,
            ClientRatingQuestionId: 21,
            QuestionAnswer: 'No',
          }),
        ],
        false,
      );
      expect(notify.success).toHaveBeenCalledWith('Rating updated.');
      expect(api.exit).not.toHaveBeenCalled();
      expect(document.querySelector('app-rating-dialog')).toBeNull();
    });

    it('a saved answer no longer offered is kept', async () => {
      clients.get.mockReturnValue(of(RATED_CLIENT));
      await show(held({ CaseRatings: [rating(31, 20, 'Excellent')] }));
      await fromMenu('Case Rating');
      expect(value('cr-answer-20')).toBe('Excellent');
    });

    it('only shows the answers on a closed case', async () => {
      clients.get.mockReturnValue(of(RATED_CLIENT));
      await show(held({ CaseStatus: 'Closed', CaseRatings: [rating(31, 20, 'Good')] }));
      await fromMenu('Case Rating');

      expect(disabled('cr-answer-20')).toBe(true);
      expect(text()).not.toContain('Close Rating Completed');
      expect(document.querySelector('app-rating-dialog button[type="submit"]')).toBeNull();
    });
  });

  describe('Abort', () => {
    it('needs a reason, then aborts the case and leaves it', async () => {
      await show(held());
      await click('Abort');
      expect(text()).toContain('Please confirm why you want to abort the call:');

      await press('Submit');
      expect(notify.warning).toHaveBeenCalledWith('Please fill in all required fields.');
      expect(api.addHistory).not.toHaveBeenCalled();

      await typeInto('rs-reason', '  Duplicate call  ');
      await press('Submit');

      expect(api.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          CaseHistoryId: 0,
          CaseDetailId: 4,
          NoteType: 'CaseAbort',
          Note: 'Duplicate call',
          CreatedByUserId: 7,
        }),
      );
      expect(api.exit).toHaveBeenCalledWith(4, 'Aborted');
      expect(notify.success).toHaveBeenCalledWith('Case aborted.');
      expect(navigate).toHaveBeenCalledWith(['/cases']);
    });

    it('says so when the case could not be let go, showing it as it now is', async () => {
      const details = held();
      await show(details);
      api.exit.mockReturnValue(of('Case in use by another user'));
      api.open.mockReturnValue(
        of({ ...details, CaseStatus: 'Aborted', CaseOpenedBy: 'carl@x.com' }),
      );
      await click('Abort');
      await typeInto('rs-reason', 'Duplicate call');
      await press('Submit');

      expect(notify.error).toHaveBeenCalledWith('The case is open for another user.');
      expect(notify.success).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(text()).toContain('(Aborted)');
    });
  });

  describe('Re-Open', () => {
    it('is offered on closed and aborted cases only', async () => {
      await show(held());
      await openMenu();
      expect(menuItem('Re-Open Case')).toBeUndefined();
    });

    it('needs a reason, then the case is Active and can be changed again', async () => {
      const details = held({ CaseStatus: 'Closed' });
      await show(details);
      expect(disabled('caller-language')).toBe(true);
      api.open.mockReturnValue(of({ ...details, CaseStatus: 'Active' }));

      await fromMenu('Re-Open Case');
      await press('OK');
      expect(api.addHistory).not.toHaveBeenCalled();
      await typeInto('rs-reason', 'Family called back');
      await press('OK');

      expect(api.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({ NoteType: 'CaseReopen', Note: 'Family called back' }),
      );
      expect(notify.success).toHaveBeenCalledWith('Case re-opened.');
      expect(text()).toContain('(Active)');
      expect(disabled('caller-language')).toBe(false);
    });

    it('is not offered while someone else has the case open', async () => {
      await show(held({ CaseStatus: 'Closed', CaseOpenedBy: 'carl@x.com' }));
      await openMenu();
      expect(menuItem('Re-Open Case')?.disabled).toBe(true);
    });
  });

  describe('Re-Assign', () => {
    it('changes the case controller and notes who it was', async () => {
      const details = held();
      await show(details);
      await fromMenu('Re-Assign');
      expect(value('ra-current')).toBe('Carl Ng');

      await choose('ra-controller', 'Carl Ng');
      await press('Assign Case Controller');
      expect(notify.info).toHaveBeenCalledWith(
        'This case is already assigned to the selected controller.',
      );
      expect(api.update).not.toHaveBeenCalled();

      api.open.mockReturnValue(of({ ...details, CaseStatus: 'Active' }));
      await choose('ra-controller', 'Dee Moyo');
      await press('Assign Case Controller');

      // The whole case is saved (v21 sent part of it, wiping the rest).
      expect(api.update).toHaveBeenCalledWith(details, { CaseControllerUserId: 5 });
      expect(api.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          NoteType: 'CaseReAssign',
          Note: 'Reassigned from "Carl Ng" to "Dee Moyo"',
        }),
      );
      expect(notify.success).toHaveBeenCalledWith('Case reassigned to Dee Moyo.');
      expect(text()).toContain('(Active)');
      expect(dropdownText('caller-controller')).toBe('Dee Moyo');
    });
  });

  it('a user who may only view cases cannot abort or re-assign, and Exit just leaves', async () => {
    h.allowOnlyViewing();
    await show(held());
    expect(headerButton('Abort')?.disabled).toBe(true);
    await openMenu();
    expect(menuItem('Re-Assign')?.disabled).toBe(true);
    expect(menuItem('Case Rating')).toBeDefined();
  });

  it('offers the costing popups from View More on services with phases only', async () => {
    await show(held());
    await openMenu();
    expect(menuItem('Phase Costing')).toBeUndefined();
    expect(menuItem('Additional Cost')).toBeUndefined();
  });
});
