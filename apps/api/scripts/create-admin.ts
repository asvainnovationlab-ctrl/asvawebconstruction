/**
 * First-administrator setup. There are no default credentials — run this once per environment.
 *
 *   npm run admin:create -- --email you@company.com --name "Your Name"
 *
 * The password is read from a hidden prompt, or from ADMIN_PASSWORD for non-interactive use
 * (e.g. a one-off CI job). If administrators already exist the script refuses to run unless
 * --force is given, so it cannot be used to silently add accounts later — use the admin panel.
 */
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { checkPasswordStrength, emailSchema } from '@asva/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';

for (const file of ['.env', '../../.env']) if (existsSync(file)) config({ path: file, quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        write.call(rl, s.startsWith(question) ? s : '*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const role = await prisma.role.findUnique({ where: { key: 'ADMINISTRATOR' } });
    if (!role) throw new Error('Roles are missing. Run `npm run db:migrate:deploy && npm run db:seed` first.');

    const existingAdmins = await prisma.userRole.count({ where: { roleId: role.id } });
    if (existingAdmins > 0 && !process.argv.includes('--force')) {
      throw new Error('An administrator already exists. Invite new users from Admin → Users, or pass --force.');
    }

    const email = emailSchema.parse(arg('email') ?? (await prompt('Admin email: ')));
    const name = (arg('name') ?? (await prompt('Full name: '))).trim();
    if (!name) throw new Error('Name is required');

    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await prompt('Password (min 12 chars, mixed character types): ', true);
      const confirm = await prompt('Confirm password: ', true);
      if (password !== confirm) throw new Error('Passwords do not match');
    }
    const problems = checkPasswordStrength(password, email);
    if (problems.length) throw new Error(`Weak password:\n - ${problems.join('\n - ')}`);

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const user = await prisma.adminUser.upsert({
      where: { email },
      create: { email, name, passwordHash, emailVerifiedAt: new Date(), roles: { create: { roleId: role.id } } },
      update: { name, passwordHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
    await prisma.auditLog.create({ data: { actorEmail: 'system:cli', action: 'user.created', targetType: 'AdminUser', targetId: user.id, metadata: { email, roles: ['ADMINISTRATOR'], via: 'admin:create' } } });
    console.log(`\n✔ Administrator ready: ${email}\n  Sign in at ${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/admin/login`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`\n✖ ${(error as Error).message}`);
  process.exitCode = 1;
});
