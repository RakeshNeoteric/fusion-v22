/**
 * Categorical colours, in the order they are handed out: checked for colour-blind and normal
 * vision separation on white. (v21's palette put red next to green.)
 */
const PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];

/** Past eight series, the colour gives no identity; the legend and tables still do. */
const OVERFLOW = '#898781';

/**
 * Gives each name a colour the first time it is asked for, and the same colour after, so a
 * service or province looks the same in every chart and table of a dashboard.
 */
export class SeriesColors {
  private readonly assigned = new Map<string, string>();

  /** Names that take the first colours, whether or not they come first. */
  constructor(reserved: readonly string[] = []) {
    reserved.forEach((name) => this.of(name));
  }

  of(name: string): string {
    let color = this.assigned.get(name);
    if (!color) {
      color = PALETTE[this.assigned.size] ?? OVERFLOW;
      this.assigned.set(name, color);
    }
    return color;
  }
}
