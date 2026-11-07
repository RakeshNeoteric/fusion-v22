import { serviceTiles, summaryTiles } from './dashboard-tiles';
import {
  clientDashboardData,
  dashboardService,
  reportService,
} from '../../../../../testing/report.fixtures';

describe('dashboard tiles', () => {
  const dashboard = clientDashboardData({
    GroupByService: [
      dashboardService(5, {
        CurrentMonthCount: 3,
        LastMonthCount: 2,
        CurrentMonthAvgProcessTime: 2,
        LastMonthAvgProcessTime: 4,
      }),
      dashboardService(7, { CurrentMonthCount: 0, LastMonthCount: 2 }),
      dashboardService(99, { CurrentMonthCount: 2, LastMonthCount: 0 }),
    ],
    StatusWiseCount: [
      { Status: 'Active', Count: 4 },
      { Status: 'Closed', Count: 1 },
    ],
  });

  it("a tile per service: this period's cases against a month earlier", () => {
    expect(serviceTiles({ dashboard, service: reportService })).toEqual([
      { title: 'Funeral', icon: 'repat.png', value: 3, change: '+50%', tone: 'good' },
      { title: 'Groceries', icon: 'benefit.png', value: 0, change: '-100%', tone: 'bad' },
      { title: 'Service 99', icon: 'repat.png', value: 2, change: '+100%', tone: 'good' },
    ]);
  });

  it('the totals: cases, the share closed and the days a closed case took', () => {
    expect(summaryTiles(dashboard)).toEqual([
      { label: 'Total Cases', value: '5', change: '↑ 25% from last month', tone: 'good' },
      { label: 'Resolution Rate', value: '20.0%', change: null, tone: 'good' },
      {
        label: 'Avg. Processing Time',
        value: '2.0 days',
        change: '↓ 2.0 days from last month',
        tone: 'good',
      },
    ]);
  });

  it('no closed cases: no processing time and no trend', () => {
    const [, , days] = summaryTiles(clientDashboardData());
    expect(days).toEqual({
      label: 'Avg. Processing Time',
      value: 'No closed cases',
      change: null,
      tone: 'good',
    });
  });
});
