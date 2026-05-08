export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArguments: 2,
  ConfigError: 3,
  NetworkError: 4,
  Timeout: 5,
  AssertionFailed: 6,
  FileError: 7,
  AuthError: 8,
  SchemaError: 9,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
