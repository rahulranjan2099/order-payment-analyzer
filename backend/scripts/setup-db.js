#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('Running Prisma migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('Database setup complete.');
} catch (error) {
  console.error('Database setup failed.');
  process.exit(1);
}
