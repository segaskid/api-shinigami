import { ExitCode, type ExitCodeValue } from './exitCodes.js';

export class ShinigamiError extends Error {
  readonly code: string;
  readonly exitCode: ExitCodeValue;
  readonly hint?: string;
  readonly reason?: string;

  constructor(input: {
    code: string;
    message: string;
    exitCode?: ExitCodeValue;
    hint?: string;
    reason?: string;
  }) {
    super(input.message);
    this.name = 'ShinigamiError';
    this.code = input.code;
    this.exitCode = input.exitCode ?? ExitCode.GeneralError;
    this.hint = input.hint;
    this.reason = input.reason;
  }
}

export function toShinigamiError(error: unknown): ShinigamiError {
  if (error instanceof ShinigamiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ShinigamiError({
      code: 'GENERAL_ERROR',
      message: error.message,
      exitCode: ExitCode.GeneralError,
    });
  }

  return new ShinigamiError({
    code: 'GENERAL_ERROR',
    message: 'An unknown error occurred.',
    exitCode: ExitCode.GeneralError,
  });
}
