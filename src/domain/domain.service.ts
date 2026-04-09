import { Injectable } from '@nestjs/common';
import { JsonStoreService } from '../store/json-store.service';
import type {
  AuditEvent,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  NetSheetRecord,
  Template,
  TemplateRow,
  TemplateVersion,
} from './domain.types';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

type StoreShape = {
  documents: DocumentRecord[];
  netsheets: NetSheetRecord[];
  templates: Template[];
  templateVersions: TemplateVersion[];
  audit: AuditEvent[];
};

const defaultTemplateRows: TemplateRow[] = [
  { id: 'salePrice', label: 'Sales price', key: 'salePrice', format: 'usd' },
  { id: 'buyerCredits', label: 'Buyer credits', key: 'buyerCredits', format: 'usd' },
  { id: 'sellerCredits', label: 'Seller credits', key: 'sellerCredits', format: 'usd' },
  { id: 'titleFees', label: 'Title fees (estimate)', key: 'titleFees', format: 'usd' },
];

@Injectable()
export class DomainService {
  constructor(private readonly store: JsonStoreService) {}

  private async readAll(): Promise<StoreShape> {
    return this.store.read<StoreShape>('mvp-store', {
      documents: [],
      netsheets: [],
      templates: [],
      templateVersions: [],
      audit: [],
    });
  }

  private async writeAll(next: StoreShape) {
    await this.store.write('mvp-store', next);
  }

  private async audit(type: AuditEvent['type'], meta?: Record<string, unknown>) {
    const db = await this.readAll();
    db.audit.unshift({ id: id('evt'), at: nowIso(), type, meta });
    db.audit = db.audit.slice(0, 200);
    await this.writeAll(db);
  }

  async ensureSeedTemplate() {
    const db = await this.readAll();
    if (db.templates.length) return;

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

    db.templates.push(template);
    db.templateVersions.push(version);
    await this.writeAll(db);
  }

  async listDocuments() {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    return db.documents;
  }

  async createDocument(input: {
    fileName: string;
    documentType: DocumentType;
    status?: DocumentStatus;
    parsedText?: string;
  }) {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    const doc: DocumentRecord = {
      id: id('doc'),
      fileName: input.fileName,
      documentType: input.documentType,
      createdAt: nowIso(),
      status: input.status ?? 'uploaded',
      parsedText: input.parsedText,
    };
    db.documents.unshift(doc);
    await this.writeAll(db);
    await this.audit('document.created', { documentId: doc.id, documentType: doc.documentType });
    return doc;
  }

  async listTemplates() {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    return db.templates;
  }

  async listTemplateVersions(templateId: string) {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    return db.templateVersions.filter((v) => v.templateId === templateId).sort((a, b) => b.version - a.version);
  }

  async createTemplateDraftFromPublished(templateId: string) {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    const template = db.templates.find((t) => t.id === templateId);
    if (!template?.latestPublishedVersionId) return null;

    const published = db.templateVersions.find((v) => v.id === template.latestPublishedVersionId);
    if (!published) return null;

    const nextVersionNumber =
      Math.max(0, ...db.templateVersions.filter((v) => v.templateId === templateId).map((v) => v.version)) + 1;

    const draft: TemplateVersion = {
      id: id('tplv'),
      templateId,
      version: nextVersionNumber,
      status: 'draft',
      createdAt: nowIso(),
      rows: published.rows,
    };
    db.templateVersions.push(draft);
    await this.writeAll(db);
    await this.audit('template.version.created', { templateId, versionId: draft.id, version: draft.version });
    return draft;
  }

  async publishTemplateVersion(versionId: string) {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    const version = db.templateVersions.find((v) => v.id === versionId);
    if (!version) return null;
    version.status = 'published';
    const template = db.templates.find((t) => t.id === version.templateId);
    if (template) template.latestPublishedVersionId = version.id;
    await this.writeAll(db);
    await this.audit('template.version.published', { templateId: version.templateId, versionId });
    return version;
  }

  async listNetSheets() {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    return db.netsheets;
  }

  async createNetSheet(input: { templateVersionId: string; documentIds: string[] }) {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    const ns: NetSheetRecord = {
      id: id('ns'),
      createdAt: nowIso(),
      templateVersionId: input.templateVersionId,
      documentIds: input.documentIds,
      status: 'draft',
    };
    db.netsheets.unshift(ns);
    await this.writeAll(db);
    await this.audit('netsheet.created', { netsheetId: ns.id, documentIds: ns.documentIds });
    return ns;
  }

  async listAudit() {
    await this.ensureSeedTemplate();
    const db = await this.readAll();
    return db.audit;
  }
}

