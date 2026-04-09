import { applyDecorators, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';

export function RequireAuth() {
  return applyDecorators(UseGuards(FirebaseAuthGuard));
}

