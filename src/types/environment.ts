export interface EnvironmentFile {
  name?: string;
  variables?: Record<string, string | number | boolean>;
  secrets?: Record<string, string>;
}

export interface ResolvedEnvironment {
  name?: string;
  values: Record<string, string>;
  secretKeys: Set<string>;
}
