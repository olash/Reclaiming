export interface MandateLetter {
  bankName: string;
  branchAddress: string;
  deceasedName: string;
  deceasedBvn: string;
  executorName: string;
  executorPhone: string;
}

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The letter as plain paragraphs — the same text feeds the on-screen preview and the PDF. */
export function mandateParagraphs(l: MandateLetter) {
  const name = l.deceasedName || '[name of the deceased]';
  const executor = l.executorName || '[your name]';
  return {
    date: today(),
    addressee: ['The Branch Manager,', l.bankName || '[bank name]', ...(l.branchAddress || '[branch address]').split('\n')],
    salutation: 'Dear Sir/Madam,',
    subject: `REQUEST FOR BVN PHONE NUMBER UPDATE FOR DIGITAL ESTATE DISCOVERY - LATE ${name.toUpperCase()}`,
    body: [
      `I, ${executor}, acting in my capacity as the legally appointed Administrator/Executor of the Estate of the late ${name}, write to formally request an administrative update to the deceased's Bank Verification Number (BVN) profile.`,
      `To facilitate the lawful discovery of the deceased's financial assets in accordance with the Letter of Administration, I require my mobile number, ${l.executorPhone || '[your phone number]'}, to be securely linked to the deceased's BVN: ${l.deceasedBvn || '[BVN]'}.`,
      'This linkage is strictly to allow the estate to receive the NIBSS/iGree network One-Time Password (OTP) required for digital asset discovery.',
      'Attached to this mandate, please find certified true copies of:',
    ],
    attachments: ['The Death Certificate', 'The Letter of Administration', 'My valid Government-Issued Identity Document'],
    closing: 'Yours faithfully,',
    signature: [executor, `Administrator, Estate of Late ${name}`],
  };
}
