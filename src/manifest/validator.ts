import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { venueManifestSchema } from './schema.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(venueManifestSchema);

export function validateManifest(manifest: unknown): ValidationResult {
  const valid = validate(manifest);
  if (valid) {
    return { valid: true, errors: [] };
  }
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}
