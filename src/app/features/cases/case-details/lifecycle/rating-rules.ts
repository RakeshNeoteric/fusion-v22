import type { CaseContact, CaseRatingRecord } from '@api/cases/case.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { RatingQuestionOption } from '@api/config/rating-question-option.api';
import type { RatingQuestionType } from '@api/config/rating-question-type.api';
import { displayStoredPhone } from '@shared/reference/phone';

/** One of the client's rating questions, with the caller's answer so far. */
export interface RatingQuestionRow {
  /** The client's link to the question (`ClientRatingQuestionId`): what an answer is saved against. */
  readonly linkId: number;
  readonly question: string;
  /** The question type's name, e.g. "Yes/No". */
  readonly type: string;
  /** The answers to choose from. */
  readonly options: readonly string[];
  /** The saved answer ('' for none). */
  readonly answer: string;
  /** The saved row's id, 0 when not answered yet. */
  readonly ratingId: number;
}

/** What the rating questions are built from. */
export interface RatingLookups {
  readonly types: readonly RatingQuestionType[];
  readonly options: readonly RatingQuestionOption[];
}

const live = (record: { IsDeleted?: boolean | null; IsActive?: boolean | null }) =>
  record.IsDeleted !== true && record.IsActive !== false;

/** v21 split the type's name ("Yes/No", "Good | Bad") when no options are set up. */
function optionsFromTypeName(name: string): string[] {
  return name
    .split(/[/|,;]+/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The client's active rating questions in their order, each with its answers and the caller's
 * saved answer. Answers are the options set up for the question's type (Configuration / Rating
 * Question Options); v21 only split the type's name, ignoring them. A saved answer no longer
 * offered stays choosable, so nothing saved is lost.
 */
export function ratingQuestions(
  client: ClientWithLinks | null,
  lookups: RatingLookups,
  ratings: readonly CaseRatingRecord[],
): RatingQuestionRow[] {
  const typeById = new Map(lookups.types.map((type) => [type.RatingQuestionTypeId, type]));
  const saved = new Map<number, CaseRatingRecord>();
  for (const rating of [...ratings].sort((a, b) => a.CaseRatingId - b.CaseRatingId)) {
    saved.set(rating.ClientRatingQuestionId, rating);
  }
  return (client?.ClientRatingQuestion ?? [])
    .filter((link) => link.IsDeleted !== true && link.RatingQuestion && live(link.RatingQuestion))
    .sort((a, b) => (a.ListRank ?? 0) - (b.ListRank ?? 0))
    .map((link) => {
      const question = link.RatingQuestion;
      const typeId = question?.RatingQuestionTypeId ?? null;
      const type = typeId === null ? '' : (typeById.get(typeId)?.QuestionType ?? '').trim();
      const configured = lookups.options
        .filter((option) => option.RatingQuestionTypeId === typeId && live(option))
        .sort((a, b) => a.RatingQuestionOptionId - b.RatingQuestionOptionId)
        .map((option) => option.QuestionOption.trim());
      const rating = saved.get(link.ClientRatingQuestionId);
      const answer = rating?.QuestionAnswer?.trim() ?? '';
      const offered = configured.length > 0 ? configured : optionsFromTypeName(type);
      return {
        linkId: link.ClientRatingQuestionId,
        question: question?.Question.trim() ?? '',
        type,
        options: unique(answer ? [...offered, answer] : offered),
        answer,
        ratingId: rating?.CaseRatingId ?? 0,
      };
    });
}

/** How many of the questions have an answer. */
export function ratingProgress(rows: readonly { answer: string }[]): {
  readonly answered: number;
  readonly total: number;
} {
  return { answered: rows.filter((row) => row.answer.trim()).length, total: rows.length };
}

/**
 * The rows to save: every question, answered or not (v21), with the main caller as the
 * contact. v21 read the contact from disabled fields, so it saved them empty.
 */
export function ratingRecords(
  rows: readonly RatingQuestionRow[],
  answers: ReadonlyMap<number, string>,
  caseDetailId: number,
  caller: CaseContact | null,
): CaseRatingRecord[] {
  const contactName = `${caller?.FirstName ?? ''} ${caller?.LastName ?? ''}`.trim();
  return rows.map((row) => ({
    CaseRatingId: row.ratingId,
    CaseDetailId: caseDetailId,
    ContactName: contactName,
    // International format, as v21 meant to store it.
    ContactNumber: displayStoredPhone(caller?.ContactNumber),
    ClientRatingQuestionId: row.linkId,
    Question: row.question,
    QuestionAnswer: (answers.get(row.linkId) ?? row.answer).trim(),
  }));
}
