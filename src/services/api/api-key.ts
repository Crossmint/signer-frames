import { Environment } from './environment';

/**
 * Parses an API key to extract origin and environment information
 * @param apiKey - The API key to parse (format: origin_environment_key)
 * @returns Object containing origin ('server' | 'client') and environment
 * @throws Error if the API key format is invalid
 */
export function parseApiKey(apiKey: string): {
  origin: 'server' | 'client';
  environment: Environment;
} {
  let origin: 'server' | 'client';
  switch (apiKey.slice(0, 2)) {
    case 'sk':
      origin = 'server';
      break;
    case 'ck':
      origin = 'client';
      break;
    default:
      throw new Error('Invalid API key. Invalid origin');
  }

  const apiKeyWithoutOrigin = apiKey.slice(3);
  const envs = ['development', 'staging', 'production'] as const;
  const environment = envs.find(env => apiKeyWithoutOrigin.startsWith(env));
  if (!environment) {
    throw new Error('Invalid API key. Invalid environment');
  }

  return {
    origin,
    environment,
  };
}
