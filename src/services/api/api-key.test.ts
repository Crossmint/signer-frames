import { parseApiKey } from './api-key';
import { describe, it, expect } from 'vitest';

describe('parseApiKey function', () => {
  it('should correctly parse different types of API keys', () => {
    // Server-side keys
    expect(parseApiKey('sk_development_123')).toEqual({
      origin: 'server',
      environment: 'development',
    });
    expect(parseApiKey('sk_staging_123')).toEqual({ origin: 'server', environment: 'staging' });
    expect(parseApiKey('sk_production_123')).toEqual({
      origin: 'server',
      environment: 'production',
    });

    // Client-side keys
    expect(parseApiKey('ck_production_123')).toEqual({
      origin: 'client',
      environment: 'production',
    });

    // Invalid keys
    expect(() => parseApiKey('invalid123')).toThrow('Invalid API key');
  });
});
