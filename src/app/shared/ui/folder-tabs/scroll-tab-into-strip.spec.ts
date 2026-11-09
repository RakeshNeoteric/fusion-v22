import { scrollTabIntoStrip } from './folder-tabs';

/** The strip scrolls only itself to show a tab, never the window (RESPONSIVE.md). */
describe('scrollTabIntoStrip', () => {
  function element(left: number, right: number): HTMLElement {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left, right }) as DOMRect;
    return el;
  }

  it('scrolls right just enough to show a tab past the right edge', () => {
    const strip = element(100, 600);
    strip.scrollLeft = 0;
    scrollTabIntoStrip(strip, element(550, 700));
    expect(strip.scrollLeft).toBe(100);
  });

  it('scrolls left just enough to show a tab past the left edge', () => {
    const strip = element(100, 600);
    strip.scrollLeft = 200;
    scrollTabIntoStrip(strip, element(40, 180));
    expect(strip.scrollLeft).toBe(140);
  });

  it('leaves the strip alone when the tab is in view, and never scrolls the window', () => {
    const strip = element(100, 600);
    strip.scrollLeft = 50;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    scrollTabIntoStrip(strip, element(200, 300));
    expect(strip.scrollLeft).toBe(50);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
