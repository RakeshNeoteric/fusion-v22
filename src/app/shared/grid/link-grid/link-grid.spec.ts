import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type LinkGridColumn, LinkGrid } from './link-grid';

interface Row {
  readonly id: number;
  readonly name: string;
}

@Component({
  imports: [LinkGrid],
  template: `
    <app-link-grid
      caption="Linked things"
      [rows]="rows()"
      [columns]="columns"
      [rowKey]="key"
      [nameOf]="name"
      [canRemove]="canRemove()"
      [busy]="busy()"
      (view)="viewed.set($event)"
      (remove)="removed.set($event)"
    />
  `,
})
class Host {
  readonly rows = signal<readonly Row[]>([
    { id: 1, name: 'Repatriation' },
    { id: 2, name: 'Towing' },
  ]);
  readonly canRemove = signal(true);
  readonly busy = signal(false);
  readonly viewed = signal<Row | null>(null);
  readonly removed = signal<Row | null>(null);
  /** Like a lookup that loads after the rows: names by id. */
  readonly names = signal<ReadonlyMap<number, string> | null>(null);
  readonly columns: readonly LinkGridColumn<Row>[] = [
    { header: 'Service', text: (r) => this.names()?.get(r.id) ?? r.name },
  ];
  readonly key = (row: Row) => row.id;
  readonly name = (row: Row) => row.name;
}

describe('LinkGrid', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return fixture;
  }

  const element = <E extends HTMLElement>(fixture: { nativeElement: HTMLElement }, s: string) =>
    fixture.nativeElement.querySelector(s) as E;

  it('lists the rows with View and Delete, and says which row was chosen', async () => {
    const fixture = await render();
    const headers = [...fixture.nativeElement.querySelectorAll('.ag-header-cell-text')].map(
      (header: Element) => header.textContent?.trim(),
    );
    expect(headers).toEqual(['Service', 'View', 'Delete']);

    element<HTMLButtonElement>(fixture, '[aria-label="View: Towing"]').click();
    expect(fixture.componentInstance.viewed()?.id).toBe(2);
    element<HTMLButtonElement>(fixture, '[aria-label="Delete: Repatriation"]').click();
    expect(fixture.componentInstance.removed()?.id).toBe(1);
  });

  it('leaves out Delete without permission, and holds the buttons while busy', async () => {
    const fixture = await render();
    fixture.componentInstance.canRemove.set(false);
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fixture.nativeElement.querySelector('[aria-label^="Delete:"]')).toBeNull();
    expect(element<HTMLButtonElement>(fixture, '[aria-label="View: Towing"]').disabled).toBe(true);
  });

  it('says so when nothing is linked', async () => {
    const fixture = await render();
    fixture.componentInstance.rows.set([]);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fixture.nativeElement.textContent).toContain('No Rows To Show');
  });

  it('shows names that load after the rows', async () => {
    const fixture = await render();
    fixture.componentInstance.names.set(new Map([[1, 'Repatriation (loaded)']]));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fixture.nativeElement.textContent).toContain('Repatriation (loaded)');
  });
});
