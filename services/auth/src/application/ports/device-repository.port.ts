export interface DeviceRecord {
  id: string;
  userId: string;
  fingerprint: string;
  name: string | null;
  platform: string | null;
  appVersion: string | null;
  userAgent: string | null;
  trusted: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface UpsertDeviceInput {
  userId: string;
  fingerprint: string;
  name?: string;
  platform?: string;
  appVersion?: string;
  userAgent?: string;
}

export const DEVICE_REPOSITORY = Symbol('DEVICE_REPOSITORY');

export interface DeviceRepositoryPort {
  findByFingerprint(userId: string, fingerprint: string): Promise<DeviceRecord | null>;
  upsert(input: UpsertDeviceInput): Promise<DeviceRecord>;
  listByUserId(userId: string): Promise<DeviceRecord[]>;
  revoke(deviceId: string): Promise<void>;
  touch(deviceId: string): Promise<void>;
}
