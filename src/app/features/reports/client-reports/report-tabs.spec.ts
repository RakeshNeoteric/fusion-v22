import { caseService } from '../../../../testing/case.fixtures';
import { reportTabs } from './report-tabs';

const SERVICES = [
  caseService(5, 'Funeral', 'FUN'),
  caseService(6, 'Groceries', ' avs ', { IsVoucherService: true }),
];

describe('reportTabs', () => {
  it('shows the dashboard, the client, then every service when none is chosen', () => {
    const tabs = reportTabs({ id: 1, name: 'Zulu Insure' }, SERVICES, []);
    expect(tabs.map((tab) => [tab.id, tab.label])).toEqual([
      ['dashboard', 'Dashboard'],
      ['client-1', 'Zulu Insure'],
      ['service-1-5', 'Zulu Insure - Funeral'],
      ['service-1-6', 'Zulu Insure - Groceries'],
    ]);
    expect(tabs[3]).toMatchObject({
      kind: 'service',
      serviceId: 6,
      serviceTypeCode: 'AVS',
      isVoucherService: true,
    });
  });

  it('shows only the chosen services', () => {
    const tabs = reportTabs({ id: 1, name: 'Zulu Insure' }, SERVICES, [6]);
    expect(tabs.map((tab) => tab.id)).toEqual(['dashboard', 'client-1', 'service-1-6']);
  });
});
