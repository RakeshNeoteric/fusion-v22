import { TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  const render = async (inputs: Record<string, string> = {}) => {
    const fixture = TestBed.createComponent(Skeleton);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('is one line of text across its container by default, hidden from screen readers', async () => {
    const block = await render();
    expect(block.style.width).toBe('100%');
    expect(block.style.height).toBe('16px');
    expect(block.dataset['shape']).toBe('line');
    expect(block.dataset['tone']).toBe('grey');
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });

  it('takes the size and shape it is given', async () => {
    const block = await render({ width: '48px', height: '48px', shape: 'circle', tone: 'teal' });
    expect(block.style.width).toBe('48px');
    expect(block.style.height).toBe('48px');
    expect(block.dataset['shape']).toBe('circle');
    expect(block.dataset['tone']).toBe('teal');
  });
});
