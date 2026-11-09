import { TestBed } from '@angular/core/testing';
import { SkeletonFields } from './skeleton-fields';
import { SkeletonTable } from './skeleton-table';

describe('Skeleton patterns', () => {
  it('draws the number of fields asked for, and says what is loading', async () => {
    const fixture = TestBed.createComponent(SkeletonFields);
    fixture.componentRef.setInput('label', 'Loading users…');
    fixture.componentRef.setInput('count', 4);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.sk-field').length).toBe(4);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading users…');
  });

  it('says nothing when the screen already does', async () => {
    const fixture = TestBed.createComponent(SkeletonFields);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).toBeNull();
  });

  it('draws a header and the rows and columns asked for', async () => {
    const fixture = TestBed.createComponent(SkeletonTable);
    fixture.componentRef.setInput('label', 'Loading vouchers…');
    fixture.componentRef.setInput('columns', 3);
    fixture.componentRef.setInput('rows', 2);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.sk-head .sk-cell').length).toBe(3);
    expect(host.querySelectorAll('.sk-row:not(.sk-head)').length).toBe(2);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading vouchers…');
  });
});
