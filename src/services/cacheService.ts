import NodeCache from 'node-cache';

class CacheService {
  private readonly cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 600 });
  }

  /**
   * Get data from cache
   * @param key Unique identifier (e.g., "AAPL")
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Save data to cache
   * @param key Unique identifier
   * @param value The data to save
   */
  set(key: string, value: any): boolean {
    return this.cache.set(key, value);
  }
}

// Singleton pattern: Export a single instance to be used everywhere
export const cacheService = new CacheService();