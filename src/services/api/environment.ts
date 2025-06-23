export type Environment = 'development' | 'staging' | 'production';
const DEFAULT_ENVIRONMENT: Environment = 'staging';

export function getEnvironment(): Environment {
  if (window.location.hostname === 'localhost') {
    return 'development';
  }

  if (window.location.hostname === 'signers.crossmint.com') {
    return 'production';
  }

  return DEFAULT_ENVIRONMENT;
}

export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}
