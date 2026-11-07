import { caseDetails } from '../../../../../testing/case.fixtures';
import {
  callerMobile,
  contactEmails,
  documentsText,
  messageHtml,
  parseEmails,
} from './message-rules';

const contact = (email: string | null, number: string | null = null) => ({
  Id: 1,
  FirstName: 'Ann',
  LastName: 'Lee',
  Email: email,
  ContactNumber: number,
  Relationship: null,
});

describe('message rules', () => {
  it('reads addresses split by commas, semicolons or spaces, once each', () => {
    expect(parseEmails(' a@x.com; b@y.org ,A@x.com  nope ')).toEqual({
      valid: ['a@x.com', 'b@y.org'],
      invalid: ['nope'],
    });
    expect(parseEmails('')).toEqual({ valid: [], invalid: [] });
  });

  it("addresses the email to the callers' valid addresses (v21)", () => {
    const details = caseDetails({
      ContactDetails: [contact('ann@x.com'), contact(null), contact('bad'), contact('ANN@x.com')],
    });
    expect(contactEmails(details)).toEqual(['ann@x.com']);
    expect(contactEmails(null)).toEqual([]);
  });

  it("texts the main caller's number (v21)", () => {
    expect(callerMobile(caseDetails({ ContactDetails: [contact(null, '821234567')] }))).toBe(
      '+27821234567',
    );
    expect(callerMobile(caseDetails({ ContactDetails: [] }))).toBe('');
  });

  it('turns the typed message into safe HTML, keeping line breaks', () => {
    expect(messageHtml('Hi <b>Ann</b> & co\nBye')).toBe(
      'Hi &#60;b&#62;Ann&#60;/b&#62; &#38; co<br>Bye',
    );
  });

  it('names the documents an email is about', () => {
    expect(documentsText([{ name: 'Claim Form' }, { name: 'Death Certificate' }])).toBe(
      'Documents for this case:\n- Claim Form\n- Death Certificate',
    );
    expect(documentsText([])).toBe('');
  });
});
