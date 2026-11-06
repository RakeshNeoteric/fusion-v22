import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PageTitle } from '../page-title';
import { Breadcrumb, buildBreadcrumb } from './breadcrumb';

@Component({ template: '' })
class Blank {}

describe('Breadcrumb', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            children: [
              { path: 'home', component: Blank, data: { breadcrumb: 'Home' } },
              {
                path: 'client/client',
                data: { breadcrumb: 'Client / Client' },
                children: [
                  { path: '', component: Blank },
                  { path: ':id', component: Blank },
                ],
              },
              { path: 'plain', component: Blank },
            ],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  function current(): string {
    return buildBreadcrumb(TestBed.inject(Router).routerState.snapshot.root);
  }

  it('uses the route breadcrumb', async () => {
    await harness.navigateByUrl('/home');
    expect(current()).toBe('Home');
  });

  it('adds "Details for {id}" for detail routes, without repeating inherited data', async () => {
    await harness.navigateByUrl('/client/client');
    expect(current()).toBe('Client / Client');
    await harness.navigateByUrl('/client/client/42');
    expect(current()).toBe('Client / Client / Details for 42');
  });

  it('falls back to "Dashboard / Home"', async () => {
    await harness.navigateByUrl('/plain');
    expect(current()).toBe('Dashboard / Home');
  });

  it('updates the title bar on navigation', async () => {
    await harness.navigateByUrl('/home');
    const fixture = TestBed.createComponent(Breadcrumb);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent?.trim()).toBe('Home');

    await harness.navigateByUrl('/client/client/7');
    await fixture.whenStable();
    expect(host.textContent?.trim()).toBe('Client / Client / Details for 7');
  });

  it("shows a page's own title while it has one", async () => {
    await harness.navigateByUrl('/home');
    const fixture = TestBed.createComponent(Breadcrumb);
    const title = TestBed.inject(PageTitle);
    const host = fixture.nativeElement as HTMLElement;
    title.show('Security / Agent / Permissions');
    await fixture.whenStable();
    expect(host.textContent?.trim()).toBe('Security / Agent / Permissions');

    title.hide('Something else');
    await fixture.whenStable();
    expect(host.textContent?.trim()).toBe('Security / Agent / Permissions');

    title.hide('Security / Agent / Permissions');
    await fixture.whenStable();
    expect(host.textContent?.trim()).toBe('Home');
  });
});
