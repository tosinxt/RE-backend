import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

function normalizePrivateKey(value: string) {
  // Render/env vars often store literal "\n" sequences.
  return value.replace(/\\n/g, '\n');
}

@Injectable()
export class FirebaseAdminService {
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  private init() {
    if (this.app) return this.app;
    if (admin.apps.length) {
      this.app = admin.app();
      return this.app;
    }

    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (serviceAccountJson) {
      const creds = JSON.parse(serviceAccountJson);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(creds),
      });
      return this.app;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    if (projectId && clientEmail && privateKey) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: normalizePrivateKey(privateKey),
        }),
      });
      return this.app;
    }

    // Fallback to GOOGLE_APPLICATION_CREDENTIALS / ADC
    this.app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return this.app;
  }

  auth() {
    return this.init().auth();
  }

  firestore() {
    return this.init().firestore();
  }
}

