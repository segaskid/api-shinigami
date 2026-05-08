export interface ShinigamiConfig {
  defaultTimeout: number;
  defaultRetries: number;
  color: boolean;
  history: {
    enabled: boolean;
    maxEntries: number;
  };
  redaction: {
    enabled: boolean;
  };
}
