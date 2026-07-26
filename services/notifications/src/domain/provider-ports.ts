export type NotificationChannelCode =
  | 'EMAIL'
  | 'SMS'
  | 'PUSH'
  | 'IN_APP'
  | 'BROWSER'
  | 'WEBHOOK'
  | 'SLACK'
  | 'TEAMS';

export interface ChannelSendRequest {
  notificationId: string;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelSendResult {
  providerCode: string;
  success: boolean;
  providerRef?: string;
  latencyMs: number;
  errorMessage?: string;
}

export interface ChannelHealthResult {
  healthy: boolean;
  providerCode: string;
  checkedAt: Date;
  details?: string;
}

/** Strategy interface implemented by each channel backend (simulator, real ESP/SMS/push/webhook, etc). */
export interface ChannelProviderPort {
  getCode(): string;
  getChannel(): NotificationChannelCode;
  send(input: ChannelSendRequest): Promise<ChannelSendResult>;
  health(): Promise<ChannelHealthResult>;
}

/**
 * Resolves channel backends at send-time. Enable/disable state lives in the
 * `notification_channel_providers` table so operators can toggle channels without a deploy;
 * `resolve` re-reads it on every call.
 */
export interface ChannelProviderRegistryPort {
  resolve(channel: NotificationChannelCode): Promise<ChannelProviderPort>;
  listAll(): Promise<ChannelProviderPort[]>;
}
