export type ApiKeyInfo = {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};
export type ApiIncidentSource = {
  keyId: string;
  keyName: string;
  resource: string;
  createdCount: number;
  blockedCount: number;
};
export type ApiIncident = {
  bucket: number;
  firstAt: number;
  lastAt: number;
  createdCount: number;
  blockedCount: number;
  acknowledgedAt: number | null;
  sources: ApiIncidentSource[];
};
export type ApiAccessData = {
  keys: ApiKeyInfo[];
  incidents: ApiIncident[];
};
