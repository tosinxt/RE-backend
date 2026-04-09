export type DocumentType = 'contract' | 'settlement_statement';

export type NetSheetExtract = {
  documentType: DocumentType;
  confidence?: number; // 0..1 best-effort
  extracted: {
    salePrice?: number | null;
    buyerCredits?: number | null;
    sellerCredits?: number | null;
    titleFees?: number | null;
    closingDate?: string | null; // ISO date (YYYY-MM-DD) if found
    propertyAddress?: string | null;
  };
  notes?: string[];
};

export type NetSheetComputed = {
  netToSeller?: number | null;
};

