import {
  fingerprintRefreshToken,
  matchesRefreshToken,
} from './refresh-token-fingerprint';

describe('refresh-token fingerprint', () => {
  it('stores a versioned digest and accepts only the bound credential', () => {
    const credential = 'isolated-test-credential';
    const fingerprint = fingerprintRefreshToken(credential);
    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain(credential);
    expect(matchesRefreshToken(credential, fingerprint)).toBe(true);
    expect(matchesRefreshToken('other-test-credential', fingerprint)).toBe(false);
  });

  it('fails closed for old and malformed stored values', () => {
    for (const value of ['', 'pending', '$2b$12$legacy', 'sha256:00'])
      expect(matchesRefreshToken('isolated-test-credential', value)).toBe(false);
  });
});
