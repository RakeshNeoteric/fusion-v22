import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { type ClientRatingQuestionLink, ClientLinksApi } from '@api/clients/client-links.api';
import { type RatingQuestion, RatingQuestionApi } from '@api/config/rating-question.api';
import { isSelectable, statusLabel } from '@shared/reference/lookup-label';
import { type LinkColumn, LinkCell, LinkTable } from '@shared/ui/link-table/link-table';
import { ClientLinkTab } from './client-link-tab';
import { optionsOf } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

/** v21 client popup, Rating Questions: the questions asked on this client's cases, in rank order. */
@Component({
  selector: 'app-client-rating-questions-tab',
  imports: [ReactiveFormsModule, LinkTable, LinkCell, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './link-tab.css',
  template: `
    @if (canLink()) {
      <div class="link-bar">
        <app-select
          inputId="crq-pick"
          [formControl]="picked"
          ariaLabel="Rating question to link"
          placeholder="Link New Rating Questions"
          allowNone
          [options]="choiceOptions()"
        />
        <button
          type="button"
          class="link-add"
          [disabled]="pickedId() === null || busy()"
          (click)="add()"
        >
          <span class="link-plus" aria-hidden="true">+</span> Add
        </button>
      </div>
    }
    <app-link-table
      caption="Linked rating questions"
      [rows]="rows()"
      [columns]="columns"
      [rowKey]="key"
      [nameOf]="name"
      [canRemove]="canLink()"
      [busy]="busy()"
      (remove)="unlink($event)"
    >
      <ng-template appLinkCell="Active" let-row>
        <span class="switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="Active"
            disabled
            [checked]="questionOf(row)?.IsActive === true"
          />
          <span class="slider"></span>
        </span>
      </ng-template>
    </app-link-table>
  `,
})
export class ClientRatingQuestionsTab extends ClientLinkTab<ClientRatingQuestionLink> {
  private readonly api = inject(ClientLinksApi);
  protected readonly linkName = 'Rating Question';

  /** Every question, deleted ones included, to name old links. */
  private readonly questions = signal<readonly RatingQuestion[]>([]);
  private readonly byId = computed(
    () => new Map(this.questions().map((question) => [question.RatingQuestionId, question])),
  );

  protected readonly picked = new FormControl<number | null>(null);
  protected readonly pickedId = toSignal(this.picked.valueChanges, { initialValue: null });

  /** Active questions not linked yet. */
  protected readonly choices = computed(() => {
    const linked = new Set(this.links().map((link) => link.RatingQuestionId));
    return this.questions()
      .filter((question) => isSelectable(question) && !linked.has(question.RatingQuestionId))
      .sort((a, b) => a.Question.localeCompare(b.Question));
  });

  /** v21: by rank, then question. */
  protected readonly rows = computed(() =>
    [...this.links()].sort(
      (a, b) => a.ListRank - b.ListRank || this.name(a).localeCompare(this.name(b)),
    ),
  );

  protected readonly choiceOptions = computed(() =>
    optionsOf(
      this.choices(),
      (question) => question.RatingQuestionId,
      (question) => question.Question,
    ),
  );

  protected readonly columns: readonly LinkColumn<ClientRatingQuestionLink>[] = [
    { header: 'Question', text: (link) => this.name(link) },
    { header: 'Rank', text: (link) => String(link.ListRank), align: 'center' },
    { header: 'Active', align: 'center' },
  ];

  protected readonly key = (link: ClientRatingQuestionLink): number => link.RatingQuestionId;
  protected readonly name = (link: ClientRatingQuestionLink): string => {
    const question = this.questionOf(link);
    return question ? statusLabel(question.Question, question) : '';
  };

  constructor() {
    super();
    inject(RatingQuestionApi)
      .listIncludingDeleted()
      .pipe(takeUntilDestroyed())
      .subscribe((questions) => this.questions.set(questions));
  }

  protected questionOf(link: ClientRatingQuestionLink): RatingQuestion | undefined {
    return this.byId().get(link.RatingQuestionId) ?? link.RatingQuestion ?? undefined;
  }

  protected async add(): Promise<void> {
    const question = this.byId().get(this.pickedId() ?? 0);
    if (!question) return;
    const linked = await this.link({
      ClientRatingQuestionId: 0,
      ClientId: this.clientId(),
      RatingQuestionId: question.RatingQuestionId,
      ListRank: question.ListRank ?? 0,
      IsDeleted: false,
    });
    if (linked) this.picked.reset();
  }

  protected send(
    links: readonly ClientRatingQuestionLink[],
  ): Observable<readonly ClientRatingQuestionLink[]> {
    return this.api.saveRatingQuestions(links);
  }

  protected idOf(link: ClientRatingQuestionLink): number {
    return link.ClientRatingQuestionId;
  }

  protected describe(link: ClientRatingQuestionLink): string {
    return this.name(link) || 'Rating question';
  }
}
