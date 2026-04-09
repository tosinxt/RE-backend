import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import type { Request } from 'express';

export type AuthContext = {
  uid: string;
  companyId: string;
  role: 'admin' | 'staff';
  token: Record<string, unknown>;
};

type AuthedRequest = Request & { auth?: AuthContext };

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const value = Array.isArray(header) ? header[0] : header;
    const token = value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException('Missing Authorization bearer token');

    try {
      const decoded = await this.firebase.auth().verifyIdToken(token);
      const uid = decoded.uid;
      const companyId = (decoded.companyId as string | undefined) ?? uid;
      const role = (decoded.role as 'admin' | 'staff' | undefined) ?? 'staff';
      req.auth = { uid, companyId, role, token: decoded as any };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }
}

