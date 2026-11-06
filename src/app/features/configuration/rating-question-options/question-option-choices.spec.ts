import { optionsFromTypeName } from './question-option-choices';

describe('optionsFromTypeName (v21 rule)', () => {
  it('splits a type name into its answers', () => {
    expect(optionsFromTypeName('Yes/No')).toEqual(['Yes', 'No']);
    expect(optionsFromTypeName('Pass | Fail')).toEqual(['Pass', 'Fail']);
    expect(optionsFromTypeName('Excellent, Good; Fair')).toEqual(['Excellent', 'Good', 'Fair']);
  });

  it('drops empty parts and repeats, keeping the first spelling', () => {
    expect(optionsFromTypeName(' Yes // yes / No ')).toEqual(['Yes', 'No']);
  });

  it('gives no answers for a missing name', () => {
    expect(optionsFromTypeName(null)).toEqual([]);
    expect(optionsFromTypeName('')).toEqual([]);
  });

  it('treats a name without separators as a single answer', () => {
    expect(optionsFromTypeName('Satisfaction')).toEqual(['Satisfaction']);
  });
});
