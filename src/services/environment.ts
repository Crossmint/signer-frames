export type Environment = 'development' | 'staging' | 'production';
const DEFAULT_ENVIRONMENT: Environment = 'staging';

export const isEnvironment = (env: unknown): env is Environment => {
  return ['development', 'staging', 'production'].includes(env as Environment);
};

export function getEnvironment(): Environment {
  console.log("here's the hostname");
  console.log(window.location.hostname);

  if (window.location.hostname === 'localhost') {
    return 'development';
  }

  const urlParams = new URLSearchParams(window.location.search);
  const envParam = urlParams.get('environment');
  if (isEnvironment(envParam)) {
    return envParam;
  }

  return DEFAULT_ENVIRONMENT;
}

export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}
