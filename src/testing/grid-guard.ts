/**
 * Fails any test in which AG Grid reports a problem, such as a column using `cellStyle` while the
 * grid's `modules` lack `CellStyleModule`. AG Grid only logs these to the console (and shows a
 * development overlay), so without this guard a misconfigured grid passes every test.
 */
type ConsoleMethod = (...args: unknown[]) => void;

const gridProblems: string[] = [];

function recordGridProblems(original: ConsoleMethod): ConsoleMethod {
  return (...args) => {
    const [first, second] = args;
    if (typeof first === 'string' && first.startsWith('AG Grid:')) {
      gridProblems.push(`${first} ${typeof second === 'string' ? second : ''}`.trim());
    }
    original(...args);
  };
}

console.error = recordGridProblems(console.error.bind(console));
console.warn = recordGridProblems(console.warn.bind(console));

beforeEach(() => {
  gridProblems.length = 0;
});

afterEach(() => {
  expect(gridProblems, 'AG Grid reported a problem').toEqual([]);
});
