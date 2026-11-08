import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { firstValueFrom, of } from 'rxjs';
import {
  type RatingQuestionOption,
  RatingQuestionOptionApi,
} from '@api/config/rating-question-option.api';
import {
  type RatingQuestionType,
  RatingQuestionTypeApi,
} from '@api/config/rating-question-type.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { QuestionTypeLookup } from '../rating-question-types/question-type-lookup';
import { RatingQuestionOptionDialog } from './rating-question-option-dialog';
import { chooseOption, dropdownOptions, dropdownText } from '../../../../testing/form-controls';

const type = (id: number, name: string, overrides: Partial<RatingQuestionType> = {}) => ({
  RatingQuestionTypeId: id,
  QuestionType: name,
  IncludeInRatingCalcs: true,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

const saved: RatingQuestionOption = {
  RatingQuestionOptionId: 4,
  RatingQuestionTypeId: 1,
  QuestionOption: 'Maybe',
  QualifyingPrompt: '',
  RatingValue: 5,
  IsNoteRequired: false,
  DoRaiseFlag: false,
  IsActive: true,
  IsDeleted: false,
};

describe('RatingQuestionOptionDialog', () => {
  const api = { create: vi.fn(), update: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  let result: Promise<RatingQuestionOption | null>;

  async function open(record: RatingQuestionOption | null): Promise<void> {
    const lookup = TestBed.inject(QuestionTypeLookup);
    await firstValueFrom(lookup.load());
    result = TestBed.inject(RecordDialogs).open(
      RatingQuestionOptionDialog,
      record,
      'RQO',
      TestBed.inject(Injector),
    );
    await settle();
  }

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }

  function element<E extends HTMLElement>(selector: string): E {
    const found = document.querySelector<E>(`app-rating-question-option-dialog ${selector}`);
    if (!found) throw new Error(`not found: ${selector}`);
    return found;
  }

  async function optionTexts(id: string): Promise<string[]> {
    return dropdownOptions(id);
  }

  async function choose(id: string, label: string): Promise<void> {
    await chooseOption(id, label);
    await settle();
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = element<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function press(text: string): Promise<void> {
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>('app-rating-question-option-dialog button'),
    ].find((candidate) => candidate.textContent?.trim() === text);
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  beforeEach(() => {
    for (const fn of [api.create, api.update, ...Object.values(notify)]) fn.mockReset();
    TestBed.configureTestingModule({
      providers: [
        QuestionTypeLookup,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: RatingQuestionOptionApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        {
          provide: RatingQuestionTypeApi,
          useValue: {
            listIncludingDeleted: () =>
              of([type(1, 'Yes/No'), type(2, 'Excellent, Good; Poor'), type(3, 'Feedback')]),
          },
        },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('RQO', { CanCreate: true })]),
    ]);
  });

  afterEach(async () => {
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>('app-rating-question-option-dialog button'),
    ].find((button) => button.textContent?.trim() === 'Cancel');
    cancel?.click();
    await settle();
  });

  it('offers the answers of the chosen type and picks its first one', async () => {
    await open(null);
    expect(await optionTexts('rqo-option')).toEqual([]);
    await choose('rqo-type', 'Excellent, Good; Poor');
    expect(await optionTexts('rqo-option')).toEqual(['Excellent', 'Good', 'Poor']);
    expect(dropdownText('rqo-option')).toBe('Excellent');
  });

  it('keeps the answer when the new type also has it', async () => {
    await open(null);
    await choose('rqo-type', 'Yes/No');
    await choose('rqo-option', 'No');
    await choose('rqo-type', 'Excellent, Good; Poor');
    expect(dropdownText('rqo-option')).toBe('Excellent');
  });

  it('only accepts a whole-number rating from 1 to 10, and saves it as a number', async () => {
    api.create.mockImplementation((entity: RatingQuestionOption) =>
      of({ ...entity, RatingQuestionOptionId: 7 }),
    );
    await open(null);
    await choose('rqo-type', 'Yes/No');
    for (const bad of ['0', '11', '2.5', 'abc']) {
      await fill('rqo-rating', bad);
      await press('Save');
      expect(document.body.textContent).toContain(
        'Rating must be a whole number between 1 and 10.',
      );
    }
    expect(api.create).not.toHaveBeenCalled();

    await fill('rqo-rating', '10');
    await press('Save');
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ RatingQuestionTypeId: 1, QuestionOption: 'Yes', RatingValue: 10 }),
    );
    expect((await result)?.RatingQuestionOptionId).toBe(7);
  });

  it('keeps an older saved answer that is not in the type name', async () => {
    await open(saved);
    expect(await optionTexts('rqo-option')).toEqual(['Yes', 'No', 'Maybe']);
    expect(dropdownText('rqo-option')).toBe('Maybe');
  });
});
