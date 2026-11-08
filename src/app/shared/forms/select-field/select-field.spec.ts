import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  chooseOption,
  closeDropdown,
  dropdownDisabled,
  dropdownOptions,
  dropdownText,
  openDropdown,
} from '../../../../testing/form-controls';
import { SelectField, type SelectValue } from './select-field';
import { type SelectOption, textOptions } from './select-option';

const PROVINCES = textOptions(['Gauteng', 'Limpopo', 'Western Cape']);
const CLIENTS: SelectOption<number>[] = [
  { value: 1, label: 'Acme' },
  { value: 2, label: 'Zulu Insure' },
  { value: 3, label: 'Acorn Mutual' },
];

@Component({
  imports: [ReactiveFormsModule, SelectField],
  template: `
    <label for="client">Client</label>
    <app-select
      inputId="client"
      placeholder="Select Client"
      searchable
      [options]="clients"
      [formControl]="client"
      (changed)="changes.push($event)"
    />
    <label for="province">Province</label>
    <app-select
      inputId="province"
      placeholder="Select Province"
      allowNone
      noneValue=""
      [options]="provinces"
      [formControl]="province"
    />
    <app-select
      inputId="tags"
      ariaLabel="Provinces"
      multiple
      [options]="provinces"
      [(value)]="tags"
    />
  `,
})
class Host {
  readonly clients = CLIENTS;
  readonly provinces = PROVINCES;
  readonly client = new FormControl<number | null>(null);
  readonly province = new FormControl('Limpopo', { nonNullable: true });
  readonly tags = signal<SelectValue<string>>(null);
  readonly changes: SelectValue<number>[] = [];
}

describe('SelectField', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance };
  }

  function searchBox(): HTMLInputElement {
    const box = document.querySelector<HTMLInputElement>('.app-select-search input');
    if (!box) throw new Error('no search box');
    return box;
  }

  afterEach(() => closeDropdown());

  it('shows the placeholder, then the chosen text, and gives the form the value', async () => {
    const { host } = await render();
    expect(dropdownText('client')).toBe('Select Client');

    await chooseOption('client', 'Zulu Insure');

    expect(host.client.value).toBe(2);
    expect(host.client.touched).toBe(true);
    expect(dropdownText('client')).toBe('Zulu Insure');
    expect(host.changes).toEqual([2]);
  });

  it('shows a value the form sets', async () => {
    const { fixture, host } = await render();
    expect(dropdownText('province')).toBe('Limpopo');
    host.client.setValue(3);
    await fixture.whenStable();
    expect(dropdownText('client')).toBe('Acorn Mutual');
  });

  it('offers the placeholder as a choice that clears to the none value (allowNone)', async () => {
    const { host } = await render();
    expect(await dropdownOptions('province')).toEqual([
      'Select Province',
      'Gauteng',
      'Limpopo',
      'Western Cape',
    ]);
    expect(await dropdownOptions('client')).toEqual(['Acme', 'Zulu Insure', 'Acorn Mutual']);

    await chooseOption('province', 'Select Province');

    expect(host.province.value).toBe('');
    expect(dropdownText('province')).toBe('Select Province');
  });

  it('narrows a searchable list to the choices containing the typed text', async () => {
    const { fixture, host } = await render();
    await openDropdown('client');
    const box = searchBox();
    expect(document.activeElement).toBe(box);

    box.value = 'AC';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const shown = () =>
      [...document.querySelectorAll('.app-select-panel .mat-mdc-option')].map((option) =>
        option.textContent?.trim(),
      );
    expect(shown()).toEqual(['Acme', 'Acorn Mutual']);

    box.value = 'xyz';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(shown()).toEqual([]);
    expect(document.querySelector('.app-select-empty')?.textContent).toContain('No matches');

    box.value = 'orn';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.app-select-panel .mat-mdc-option')?.click();
    await fixture.whenStable();
    expect(host.client.value).toBe(3);

    // The search starts again next time.
    await openDropdown('client');
    expect(searchBox().value).toBe('');
    expect(shown()).toHaveLength(3);
  });

  it('keeps letters and spaces typed in the search box out of the list’s keys', async () => {
    await render();
    await openDropdown('client');
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    searchBox().dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
  });

  it('is disabled with its form control', async () => {
    const { fixture, host } = await render();
    host.client.disable();
    await fixture.whenStable();
    expect(dropdownDisabled('client')).toBe(true);
    host.client.enable();
    await fixture.whenStable();
    expect(dropdownDisabled('client')).toBe(false);
  });

  it('is named by its label', async () => {
    await render();
    const label = document.querySelector('label[for="client"]');
    expect(label?.id).toBeTruthy();
    expect(document.querySelector('#client')?.getAttribute('aria-labelledby')).toContain(label?.id);
  });

  it('holds several choices with multiple, without a form', async () => {
    const { host } = await render();
    expect(document.querySelector('#tags')?.getAttribute('aria-label')).toBe('Provinces');
    await openDropdown('tags');
    const options = [
      ...document.querySelectorAll<HTMLElement>('.app-select-panel .mat-mdc-option'),
    ];
    options[0]?.click();
    options[2]?.click();
    await closeDropdown();
    expect(host.tags()).toEqual(['Gauteng', 'Western Cape']);
    expect(dropdownText('tags')).toBe('Gauteng, Western Cape');
  });
});
