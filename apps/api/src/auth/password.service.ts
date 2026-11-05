import { BadRequestException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { checkPasswordStrength } from '@asva/shared';

/** OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    // Always perform a verification so response time does not reveal whether the account exists.
    const target = hash ?? (await (this.dummyHash ??= argon2.hash('timing-equaliser-not-a-password', ARGON2_OPTIONS)));
    try {
      const ok = await argon2.verify(target, password);
      return Boolean(hash) && ok;
    } catch {
      return false;
    }
  }

  assertStrong(password: string, email?: string): void {
    const problems = checkPasswordStrength(password, email);
    if (problems.length) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: problems[0],
        details: problems.map((message) => ({ path: 'password', message })),
      });
    }
  }
}
