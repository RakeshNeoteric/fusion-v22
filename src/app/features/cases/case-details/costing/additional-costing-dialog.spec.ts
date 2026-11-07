import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { capturePdfs, pdfTexts } from '../../../../../testing/pdf';
import { caseTabHarness, held } from '../tabs/testing/case-tab-harness';

const cost = (extra: Partial<CaseAdditionalCostRecord> = {}): CaseAdditionalCostRecord => ({
  CaseAdditionalCostId: 20,
  CaseDetailId: 4,
  ServiceProviderName: 'Florist',
  ServiceProviderAddress: '1 Rose St',
  VATNumber: '',
  CompanyRegNo: '',
  Email: 'f@x.com',
  Telephone: '+27 82 123 4567',
  Description: 'Flowers',
  Amount: 300,
  IsDeleted: false,
  ...extra,
});

/** A Groceries (AVS) case, which has phases and so additional costs. */
const avs = (costs: CaseAdditionalCostRecord[] = []) =>
  held({
    CaseClientServiceId: 6,
    CaseAdditionalCosts: costs,
    AdditionalCostTotal: 300,
    TotalCost: 300,
  });

describe('Additional Cost', () => {
  const { api, notify, show, settle, fromMenu, element, type, press, text } = caseTabHarness();

  const open = () => fromMenu('Additional Cost');

  const { printed } = capturePdfs();

  const poButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>('app-additional-costing-dialog button')].find(
      (button) => button.textContent?.trim() === 'Additional Cost PO',
    );

  it('adds a cost and saves the case totals', async () => {
    await show(avs([cost()]));
    await open();
    expect(text()).toContain('Flowers');
    expect(text()).toContain('300.00');

    await press('Add');
    expect(text()).toContain('Name is required.');
    expect(text()).toContain('Contact number is required and must be valid.');
    expect(notify.warning).toHaveBeenCalledWith('Please fix the highlighted errors before adding.');

    await type('ac-name', ' Caterer ');
    await type('ac-address', ' 2 Main Rd \n\n Durban ');
    await type('ac-telephone', '831234567');
    await type('ac-email', 'bad');
    await type('ac-amount', '0');
    await type('ac-description', 'Tea');
    await press('Add');
    expect(text()).toContain('Enter a valid email address.');
    expect(text()).toContain('Enter a cost above 0.');

    await type('ac-email', 'c@x.com');
    await type('ac-amount', '149.95');
    await press('Add');
    expect(api.saveAdditionalCost).toHaveBeenCalledWith({
      CaseAdditionalCostId: 0,
      CaseDetailId: 4,
      ServiceProviderName: 'Caterer',
      ServiceProviderAddress: '2 Main Rd\nDurban',
      VATNumber: '',
      CompanyRegNo: '',
      Email: 'c@x.com',
      Telephone: '+27 83 123 4567',
      Description: 'Tea',
      Amount: 149.95,
      IsDeleted: false,
    });
    expect(api.update).toHaveBeenCalledWith(expect.anything(), {
      PhaseTotal: 0,
      AdditionalCostTotal: 449.95,
      TotalCost: 449.95,
    });
    expect(text()).toContain('449.95');
  });

  it('deletes a cost once confirmed, keeping the row marked deleted', async () => {
    await show(avs([cost()]));
    await open();
    element<HTMLButtonElement>('button[aria-label="Delete Flowers"]').click();
    await settle();
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button'),
    ].find((button) => button.textContent?.trim() === 'Delete');
    confirm?.click();
    await settle();
    expect(api.saveAdditionalCost).toHaveBeenCalledWith({ ...cost(), IsDeleted: true });
    expect(api.update).toHaveBeenCalledWith(expect.anything(), {
      PhaseTotal: 0,
      AdditionalCostTotal: 0,
      TotalCost: 0,
    });
    expect(text()).toContain('No additional costs yet.');
  });

  it('only lists the costs of a case someone else has open', async () => {
    await show({ ...avs([cost()]), CaseOpenedBy: 'carl@x.com' });
    await open();
    expect(document.querySelector('#ac-name')).toBeNull();
    expect(document.querySelector('button[aria-label="Delete Flowers"]')).toBeNull();
    expect(text()).toContain('Flowers');
  });

  it('prints the costs as a purchase order with the company, client and controller', async () => {
    await show({
      ...avs([cost(), cost({ CaseAdditionalCostId: 21, Description: 'Tea', Amount: 50 })]),
      CaseReferenceNumber: 'REF-4',
      CaseNumber: 'C-4',
    });
    await open();
    poButton()?.click();
    await settle();

    expect(printed).toHaveLength(1);
    expect(printed[0]?.images).toEqual({ logo: 'http://app/images/logo.png' });
    const texts = pdfTexts(printed[0]?.content);
    expect(texts).toEqual(
      expect.arrayContaining([
        'REF-4',
        'C-4',
        'P O Box 71516, Bryanston, 2021',
        '2020/391135/07',
        'Zulu Insure',
        'Carl Ng',
        'Flowers',
        'Tea',
        'R 350.00',
      ]),
    );
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(texts).toContain(
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    );
  });

  it('numbers the order after the case when it has no reference yet (v21)', async () => {
    await show({ ...avs([cost()]), CaseReferenceNumber: null, CaseNumber: null });
    await open();
    poButton()?.click();
    await settle();
    expect(pdfTexts(printed[0]?.content)).toEqual(expect.arrayContaining(['ACPO-4', '4']));
  });

  it('cannot print without costs, or while the case cannot be changed (v21)', async () => {
    await show(avs());
    await open();
    expect(poButton()?.disabled).toBe(true);
    TestBed.inject(MatDialog).closeAll();
    await settle();

    await show({ ...avs([cost()]), CaseOpenedBy: 'carl@x.com' });
    await open();
    expect(poButton()?.disabled).toBe(true);
    poButton()?.click();
    await settle();
    expect(printed).toHaveLength(0);
  });
});
