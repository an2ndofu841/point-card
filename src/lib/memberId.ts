const MEMBER_ID_LENGTH = 12;

const getRandomBytes = (length: number) => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const generateMemberId = () => {
  const bytes = getRandomBytes(MEMBER_ID_LENGTH);
  const digits = Array.from(bytes, b => (b % 10).toString()).join('');
  return digits.slice(0, MEMBER_ID_LENGTH);
};

export const formatMemberId = (memberId?: string | null) => {
  if (!memberId) return '---- ---- ----';
  const padded = memberId.padEnd(MEMBER_ID_LENGTH, '-');
  return padded.replace(/(.{4})/g, '$1 ').trim();
};
