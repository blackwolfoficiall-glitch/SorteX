// This observer is used only by the guarded, disposable Nest fixture. Never
// print the body, field lengths, hashes, values or request identifiers.
const { createHash, timingSafeEqual } = require('node:crypto');

const buyerEmail = 'sortex-ios-ui@example.test';
const classifications = new Set([
  'matches',
  'email-mismatch',
  'password-mismatch',
  'both-mismatch',
  'missing-email',
  'missing-password',
  'missing-both',
]);

const digest = (value) => createHash('sha256').update(value).digest();

function classifyInput(body, expectedPassword) {
  if (!/^[0-9a-f]{48}$/.test(expectedPassword ?? '')) return 'unknown';
  const hasEmail = typeof body?.email === 'string' && body.email.trim() !== '';
  const hasPassword = typeof body?.password === 'string' && body.password !== '';
  if (!hasEmail && !hasPassword) return 'missing-both';
  if (!hasEmail) return 'missing-email';
  if (!hasPassword) return 'missing-password';
  const emailMatch = body.email.toLowerCase() === buyerEmail;
  const passwordMatch = timingSafeEqual(digest(body.password), digest(expectedPassword));
  if (emailMatch && passwordMatch) return 'matches';
  if (emailMatch) return 'password-mismatch';
  if (passwordMatch) return 'email-mismatch';
  return 'both-mismatch';
}

function observeLogin(expectedPassword, write) {
  return (req, res, next) => {
    if (req.method === 'POST' && req.originalUrl === '/auth/login') {
      const input = classifyInput(req.body, expectedPassword);
      res.once('finish', () => write({
        event: 'sortex-ios-fixture-login-shape',
        input,
        status: res.statusCode,
      }));
    }
    next();
  };
}

module.exports = { classifications, observeLogin };
