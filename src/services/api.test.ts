import { expect, describe, it, beforeEach } from 'vitest';
import { CrossmintApiService } from './api';

describe('CrossmintApiService', () => {
  let apiService: CrossmintApiService;

  beforeEach(() => {
    apiService = new CrossmintApiService();
  });

  it('should be defined', () => {
    expect(apiService).toBeDefined();
  });
});
