import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER_API_KEY = '';

const testDbPath = path.join(
  tmpdir(),
  `scholavon-test-${randomUUID()}.json`
);

process.env.SCHOLAVON_DB_FILE = testDbPath;

afterAll(() => {
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }
});
