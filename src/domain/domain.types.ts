export type DocumentType = 'contract' | 'settlement_statement';
export type DocumentStatus = 'uploaded' | 'parsed' | 'extracted' | 'finalized';
export type NetSheetStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'finalized';

export type DocumentRecord = {
  id: string;
  fileName: string;
  documentType: DocumentType;
  createdAt: string;
  status: DocumentStatus;
  parsedText?: string;
};

export type TemplateRowKey = 'salePrice' | 'buyerCredits' | 'sellerCredits' | 'titleFees';

export type TemplateRow = {
  id: string;
  label: string;
  key: TemplateRowKey;
  format: 'usd';
};

export type TemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  status: 'draft' | 'published';
  createdAt: string;
  rows: TemplateRow[];
};

export type Template = {
  id: string;
  name: string;
  scope: 'company';
  createdAt: string;
  latestPublishedVersionId?: string;
};

export type NetSheetRecord = {
  id: string;
  createdAt: string;
  templateVersionId: string;
  documentIds: string[];
  extracted?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  computed?: Record<string, unknown>;
  status: NetSheetStatus;
  assignedToUid?: string | null;
  reviewedByUid?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  finalizedByUid?: string | null;
  finalizedAt?: string | null;
  exportedAt?: string | null;
};

export type AuditEvent = {
  id: string;
  at: string;
  type:
    | 'document.created'
    | 'document.parsed'
    | 'netsheet.created'
    | 'netsheet.extracted'
    | 'netsheet.updated'
    | 'netsheet.submitted_for_review'
    | 'netsheet.assigned'
    | 'netsheet.approved'
    | 'netsheet.rejected'
    | 'netsheet.finalized'
    | 'template.version.created'
    | 'template.version.published';
  meta?: Record<string, unknown>;
};

