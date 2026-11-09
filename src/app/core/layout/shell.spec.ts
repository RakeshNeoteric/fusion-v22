import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Shell } from './shell';

@Component({ selector: 'app-header', template: '' })
class FakeHeader {
  readonly menuToggle = output();
}

@Component({ selector: 'app-sidebar', template: '' })
class FakeSidebar {
  readonly pinned = input(false);
}

@Component({ selector: 'app-breadcrumb', template: '' })
class FakeBreadcrumb {}

describe('Shell (responsive frame)', () => {
  const screen = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
  const observe = vi.fn(() => screen.asObservable());

  async function render(compact: boolean): Promise<HTMLElement> {
    screen.next({ matches: compact, breakpoints: {} });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BreakpointObserver, useValue: { observe } }],
    });
    TestBed.overrideComponent(Shell, {
      set: { imports: [RouterOutlet, FakeHeader, FakeSidebar, FakeBreadcrumb] },
    });
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('watches for compact desktop: under 1280px wide', async () => {
    await render(false);
    expect(observe).toHaveBeenCalledWith('(width < 1280px)');
  });

  it('keeps the side menu beside the page on a standard desktop', async () => {
    const host = await render(false);
    expect(host.querySelector('.body')?.classList).not.toContain('compact');
  });

  it('opens the side menu over the page on a compact desktop', async () => {
    const host = await render(true);
    expect(host.querySelector('.body')?.classList).toContain('compact');
  });
});
