import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import type {
  AuditEvent,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  NetSheetRecord,
  Template,
  TemplateRow,
  TemplateVersion,
  NetSheetStatus,
} from './domain.types';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

const defaultTemplateRows: TemplateRow[] = [
  { id: 'salePrice', label: 'Sales price', key: 'salePrice', format: 'usd' },
  { id: 'buyerCredits', label: 'Buyer credits', key: 'buyerCredits', format: 'usd' },
  { id: 'sellerCredits', label: 'Seller credits', key: 'sellerCredits', format: 'usd' },
  { id: 'titleFees', label: 'Title fees (estimate)', key: 'titleFees', format: 'usd' },
];

@Injectable()
export class FirestoreDomainService {
  private readonly logger = new Logger(FirestoreDomainService.name);

  constructor(private readonly firebase: FirebaseAdminService) {}

  private db() {
    return this.firebase.firestore();
  }

  private companyRef(companyId: string) {
    return this.db().collection('companies').doc(companyId);
  }

  private async audit(companyId: string, type: AuditEvent['type'], meta?: Record<string, unknown>) {
    const evt: AuditEvent = { id: id('evt'), at: nowIso(), type, meta };
    await this.companyRef(companyId).collection('audit').doc(evt.id).set(evt);
  }

  async ensureSeed(companyId: string) {
    const company = this.companyRef(companyId);
    const companySnap = await company.get();
    if (!companySnap.exists) {
      await company.set({ name: 'Company', createdAt: nowIso() }, { merge: true });
    }

    const templatesCol = company.collection('templates');
    const existing = await templatesCol.limit(1).get();
    if (!existing.empty) return;

    const templateId = id('tpl');
    const versionId = id('tplv');
    const createdAt = nowIso();

    const template: Template = {
      id: templateId,
      name: 'Default seller net sheet',
      scope: 'company',
      createdAt,
      latestPublishedVersionId: versionId,
    };

    const version: TemplateVersion = {
      id: versionId,
      templateId,
      version: 1,
      status: 'published',
      createdAt,
      rows: defaultTemplateRows,
    };

    await company.collection('templates').doc(templateId).set(template);
    await company.collection('templateVersions').doc(versionId).set(version);
    await this.audit(companyId, 'template.version.published', { templateId, versionId });
  }

  async listDocuments(companyId: string) {
    await this.ensureSeed(companyId);
    const snap = await this.companyRef(companyId)
      .collection('documents')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    return snap.docs.map((d) => d.data() as DocumentRecord);
  }

  async createDocument(companyId: string, input: {
    fileName: string;
    documentType: DocumentType;
    status?: DocumentStatus;
    parsedText?: string;
  }) {
    await this.ensureSeed(companyId);
    const doc: DocumentRecord = {
      id: id('doc'),
      fileName: input.fileName,
      documentType: input.documentType,
      createdAt: nowIso(),
      status: input.status ?? 'uploaded',
      parsedText: input.parsedText,
    };
    await this.companyRef(companyId).collection('documents').doc(doc.id).set(doc);
    await this.audit(companyId, 'document.created', { documentId: doc.id, documentType: doc.documentType });
    return doc;
  }

  async listTemplates(companyId: string) {
    try {
      await this.ensureSeed(companyId);
      // Avoid orderBy here: avoids composite-index requirements and works if createdAt is missing on older docs.
      const snap = await this.companyRef(companyId).collection('templates').get();
      const list = snap.docs.map((d) => d.data() as Template);
      list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      return list;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error({ companyId, err: message }, 'listTemplates failed');
      throw e;
    }
  }

  async listTemplateVersions(companyId: string, templateId: string) {
    await this.ensureSeed(companyId);
    const snap = await this.companyRef(companyId)
      .collection('templateVersions')
      .where('templateId', '==', templateId)
      .get();
    const list = snap.docs.map((d) => d.data() as TemplateVersion);
    list.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    return list;
  }

  async createTemplateDraftFromPublished(companyId: string, templateId: string) {
    await this.ensureSeed(companyId);
    const templateSnap = await this.companyRef(companyId).collection('templates').doc(templateId).get();
    if (!templateSnap.exists) return null;
    const template = templateSnap.data() as Template;
    if (!template.latestPublishedVersionId) return null;

    const publishedSnap = await this.companyRef(companyId)
      .collection('templateVersions')
      .doc(template.latestPublishedVersionId)
      .get();
    if (!publishedSnap.exists) return null;
    const published = publishedSnap.data() as TemplateVersion;

    const latestSnap = await this.companyRef(companyId)
      .collection('templateVersions')
      .where('templateId', '==', templateId)
      .get();
    const versionRows = latestSnap.docs.map((d) => d.data() as TemplateVersion);
    versionRows.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    const nextVersion = versionRows[0]?.version ?? published.version;

    const draft: TemplateVersion = {
      id: id('tplv'),
      templateId,
      version: nextVersion + 1,
      status: 'draft',
      createdAt: nowIso(),
      rows: published.rows,
    };
    await this.companyRef(companyId).collection('templateVersions').doc(draft.id).set(draft);
    await this.audit(companyId, 'template.version.created', { templateId, versionId: draft.id, version: draft.version });
    return draft;
  }

  async publishTemplateVersion(companyId: string, versionId: string) {
    await this.ensureSeed(companyId);
    const versionRef = this.companyRef(companyId).collection('templateVersions').doc(versionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) return null;
    const version = versionSnap.data() as TemplateVersion;

    await versionRef.set({ ...version, status: 'published' }, { merge: true });
    await this.companyRef(companyId)
      .collection('templates')
      .doc(version.templateId)
      .set({ latestPublishedVersionId: versionId }, { merge: true });

    await this.audit(companyId, 'template.version.published', { templateId: version.templateId, versionId });
    return { ...version, status: 'published' as const };
  }

  async listNetSheets(companyId: string) {
    await this.ensureSeed(companyId);
    const snap = await this.companyRef(companyId).collection('netsheets').orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map((d) => d.data() as NetSheetRecord);
  }

  async createNetSheet(companyId: string, input: { templateVersionId: string; documentIds: string[] }) {
    await this.ensureSeed(companyId);
    const ns: NetSheetRecord = {
      id: id('ns'),
      createdAt: nowIso(),
      templateVersionId: input.templateVersionId,
      documentIds: input.documentIds,
      status: 'draft',
    };
    await this.companyRef(companyId).collection('netsheets').doc(ns.id).set(ns);
    await this.audit(companyId, 'netsheet.created', { netsheetId: ns.id, documentIds: ns.documentIds });
    return ns;
  }

  async getNetSheet(companyId: string, netsheetId: string) {
    await this.ensureSeed(companyId);
    const ref = this.companyRef(companyId).collection('netsheets').doc(netsheetId);
    const snap = await ref.get();
    return snap.exists ? (snap.data() as NetSheetRecord) : null;
  }

  async setNetSheetFields(companyId: string, netsheetId: string, patch: Partial<NetSheetRecord>) {
    await this.ensureSeed(companyId);
    const ref = this.companyRef(companyId).collection('netsheets').doc(netsheetId);
    await ref.set(patch, { merge: true });
  }

  private async transition(
    companyId: string,
    netsheetId: string,
    nextStatus: NetSheetStatus,
    patch: Partial<NetSheetRecord>,
    auditType: AuditEvent['type'],
    auditMeta?: Record<string, unknown>,
  ) {
    const current = await this.getNetSheet(companyId, netsheetId);
    if (!current) return null;
    await this.setNetSheetFields(companyId, netsheetId, { ...patch, status: nextStatus });
    await this.audit(companyId, auditType, { netsheetId, from: current.status, to: nextStatus, ...auditMeta });
    return this.getNetSheet(companyId, netsheetId);
  }

  async submitForReview(companyId: string, netsheetId: string) {
    const current = await this.getNetSheet(companyId, netsheetId);
    if (!current) return null;
    if (!(current.status === 'draft' || current.status === 'rejected')) return 'invalid';
    return this.transition(companyId, netsheetId, 'needs_review', {}, 'netsheet.submitted_for_review');
  }

  async assign(companyId: string, netsheetId: string, assignedToUid: string | null) {
    return this.transition(
      companyId,
      netsheetId,
      (await this.getNetSheet(companyId, netsheetId))?.status ?? 'draft',
      { assignedToUid },
      'netsheet.assigned',
      { assignedToUid },
    );
  }

  async approve(companyId: string, netsheetId: string, reviewerUid: string, reviewNote?: string | null) {
    const current = await this.getNetSheet(companyId, netsheetId);
    if (!current) return null;
    if (current.status !== 'needs_review') return 'invalid';
    return this.transition(
      companyId,
      netsheetId,
      'approved',
      { reviewedByUid: reviewerUid, reviewedAt: nowIso(), reviewNote: reviewNote ?? null },
      'netsheet.approved',
    );
  }

  async reject(companyId: string, netsheetId: string, reviewerUid: string, reviewNote: string) {
    const current = await this.getNetSheet(companyId, netsheetId);
    if (!current) return null;
    if (current.status !== 'needs_review') return 'invalid';
    return this.transition(
      companyId,
      netsheetId,
      'rejected',
      { reviewedByUid: reviewerUid, reviewedAt: nowIso(), reviewNote },
      'netsheet.rejected',
    );
  }

  async finalize(companyId: string, netsheetId: string, finalizerUid: string) {
    const current = await this.getNetSheet(companyId, netsheetId);
    if (!current) return null;
    if (current.status !== 'approved') return 'invalid';
    return this.transition(
      companyId,
      netsheetId,
      'finalized',
      { finalizedByUid: finalizerUid, finalizedAt: nowIso() },
      'netsheet.finalized',
    );
  }

  async listAudit(companyId: string) {
    await this.ensureSeed(companyId);
    const snap = await this.companyRef(companyId).collection('audit').orderBy('at', 'desc').limit(200).get();
    return snap.docs.map((d) => d.data() as AuditEvent);
  }
}

