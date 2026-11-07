import type { CaseContact, CaseRatingRecord } from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { RatingQuestionOption } from '@api/config/rating-question-option.api';
import type { RatingQuestionType } from '@api/config/rating-question-type.api';
import { ratingProgress, ratingQuestions, ratingRecords } from './rating-rules';

const link = (
  linkId: number,
  rank: number,
  typeId: number | null,
  text: string,
  extra: { linkDeleted?: boolean; active?: boolean; deleted?: boolean } = {},
) => ({
  ClientRatingQuestionId: linkId,
  ClientId: 1,
  RatingQuestionId: linkId + 100,
  ListRank: rank,
  IsDeleted: extra.linkDeleted ?? false,
  RatingQuestion: {
    RatingQuestionId: linkId + 100,
    RatingQuestionTypeId: typeId,
    Question: ` ${text} `,
    ListRank: rank,
    IsActive: extra.active ?? true,
    IsDeleted: extra.deleted ?? false,
  },
});

const client = (...links: ReturnType<typeof link>[]) =>
  ({ ClientId: 1, ClientRatingQuestion: links }) as unknown as ClientWithLinks;

const type = (id: number, name: string): RatingQuestionType => ({
  RatingQuestionTypeId: id,
  QuestionType: name,
  IncludeInRatingCalcs: true,
  IsActive: true,
  IsDeleted: false,
});

const option = (
  id: number,
  typeId: number,
  name: string,
  extra: Partial<RatingQuestionOption> = {},
): RatingQuestionOption => ({
  RatingQuestionOptionId: id,
  RatingQuestionTypeId: typeId,
  QuestionOption: name,
  QualifyingPrompt: '',
  RatingValue: null,
  IsNoteRequired: false,
  DoRaiseFlag: false,
  IsActive: true,
  IsDeleted: false,
  ...extra,
});

const saved = (id: number, linkId: number, answer: string): CaseRatingRecord => ({
  CaseRatingId: id,
  CaseDetailId: 4,
  ContactName: '',
  ContactNumber: '',
  ClientRatingQuestionId: linkId,
  Question: '',
  QuestionAnswer: answer,
});

const LOOKUPS = {
  types: [type(5, 'Yes/No'), type(6, 'Service'), type(7, 'Good | Fair ; Bad')],
  options: [
    option(2, 6, 'Poor'),
    option(1, 6, 'Good'),
    option(3, 6, 'Retired', { IsActive: false }),
    option(4, 6, 'Gone', { IsDeleted: true }),
  ],
};

describe('ratingQuestions', () => {
  it("keeps the client's live questions in their order", () => {
    const rows = ratingQuestions(
      client(
        link(1, 3, 5, 'Third'),
        link(2, 1, 5, 'First'),
        link(3, 2, 5, 'Unlinked', { linkDeleted: true }),
        link(4, 2, 5, 'Inactive', { active: false }),
        link(5, 2, 5, 'Deleted', { deleted: true }),
        link(6, 2, 5, 'Second'),
      ),
      LOOKUPS,
      [],
    );
    expect(rows.map((row) => row.question)).toEqual(['First', 'Second', 'Third']);
  });

  it("offers the type's live options in their order, else splits the type's name (v21)", () => {
    const rows = ratingQuestions(
      client(link(1, 1, 6, 'Service'), link(2, 2, 5, 'Polite'), link(3, 3, 7, 'Mood')),
      LOOKUPS,
      [],
    );
    expect(rows.map((row) => [row.type, row.options])).toEqual([
      ['Service', ['Good', 'Poor']],
      ['Yes/No', ['Yes', 'No']],
      ['Good | Fair ; Bad', ['Good', 'Fair', 'Bad']],
    ]);
  });

  it('gives each question its latest saved answer, still offered if no longer an option', () => {
    const rows = ratingQuestions(
      client(link(1, 1, 6, 'Service'), link(2, 2, 5, 'Polite')),
      LOOKUPS,
      [saved(12, 1, 'Excellent'), saved(10, 1, 'Poor')],
    );
    expect(rows[0]).toMatchObject({ answer: 'Excellent', ratingId: 12 });
    expect(rows[0]?.options).toEqual(['Good', 'Poor', 'Excellent']);
    expect(rows[1]).toMatchObject({ answer: '', ratingId: 0 });
  });

  it('has no questions without a client', () => {
    expect(ratingQuestions(null, LOOKUPS, [])).toEqual([]);
  });
});

describe('ratingProgress', () => {
  it('counts the answered questions', () => {
    expect(ratingProgress([{ answer: 'Yes' }, { answer: ' ' }, { answer: '' }])).toEqual({
      answered: 1,
      total: 3,
    });
  });
});

describe('ratingRecords', () => {
  const caller: CaseContact = {
    Id: 1,
    FirstName: 'Ann',
    LastName: 'Lee',
    Email: null,
    ContactNumber: '821234567',
    Relationship: null,
  };

  it('saves every question with the main caller as the contact (v21 saved it empty)', () => {
    const rows = ratingQuestions(
      client(link(1, 1, 6, 'Service'), link(2, 2, 5, 'Polite')),
      LOOKUPS,
      [saved(12, 1, 'Poor')],
    );
    expect(ratingRecords(rows, new Map([[1, ' Good ']]), 4, caller)).toEqual([
      {
        CaseRatingId: 12,
        CaseDetailId: 4,
        ContactName: 'Ann Lee',
        ContactNumber: '+27 82 123 4567',
        ClientRatingQuestionId: 1,
        Question: 'Service',
        QuestionAnswer: 'Good',
      },
      {
        CaseRatingId: 0,
        CaseDetailId: 4,
        ContactName: 'Ann Lee',
        ContactNumber: '+27 82 123 4567',
        ClientRatingQuestionId: 2,
        Question: 'Polite',
        QuestionAnswer: '',
      },
    ]);
  });

  it('keeps the saved answer for a question not changed, and has no contact without a caller', () => {
    const rows = ratingQuestions(client(link(1, 1, 6, 'Service')), LOOKUPS, [saved(12, 1, 'Poor')]);
    expect(ratingRecords(rows, new Map(), 4, null)[0]).toMatchObject({
      ContactName: '',
      ContactNumber: '',
      QuestionAnswer: 'Poor',
    });
  });
});
