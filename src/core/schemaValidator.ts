import { Ajv, type AnySchema, type ErrorObject } from 'ajv';

const ajv = new Ajv({ allErrors: true });

export function validateSchema(
  schema: unknown,
  value: unknown,
): { valid: boolean; errors: string[] } {
  const validate = ajv.compile(schema as AnySchema);
  const valid = validate(value);
  return {
    valid: valid === true,
    errors: (validate.errors ?? []).map(
      (error: ErrorObject) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
    ),
  };
}
