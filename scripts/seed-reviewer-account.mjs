#!/usr/bin/env node
/**
 * Server-Side Seed & Password Hash Generator for Reviewer Access
 *
 * Usage:
 *   node scripts/seed-reviewer-account.mjs "<EMAIL>" "<PLAIN_PASSWORD>"
 *
 * Outputs the SHA-256 hex hash to store in REVIEWER_PASSWORD_HASH in Vercel / .env.local
 * without ever committing the plain password or email to source code.
 */
import crypto from 'crypto';

const [, , rawEmail, rawPassword] = process.argv;

if (!rawEmail || !rawPassword) {
  console.log('Usage: node scripts/seed-reviewer-account.mjs "<EMAIL>" "<PLAIN_PASSWORD>"');
  const randomPassword = crypto.randomBytes(18).toString('base64url');
  const sampleHash = crypto.createHash('sha256').update(randomPassword, 'utf8').digest('hex');
  console.log('\nExample generated long random password & hash:');
  console.log(`  Generated Password (save securely): ${randomPassword}`);
  console.log(`  REVIEWER_PASSWORD_HASH=${sampleHash}`);
  process.exit(0);
}

const normalizedEmail = rawEmail.trim().toLowerCase();
const passwordHash = crypto.createHash('sha256').update(rawPassword, 'utf8').digest('hex');

console.log('# Add these server-only variables to Vercel Environment Variables or .env.local:');
console.log('REVIEWER_ACCESS_ENABLED=true');
console.log(`REVIEWER_EMAIL=${normalizedEmail}`);
console.log(`REVIEWER_PASSWORD_HASH=${passwordHash}`);
