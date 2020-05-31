import { Producer } from './producer';
import { CircuitBreakerPolicy, CircuitBreakerOptions } from './policies/circuit-breaker';
import { RetryOptions } from './policies/retry';
import { rtaEmitter, RTAEmitter } from './rta-emitter';

/**
 * @typedef {import('./policies/circuit-breaker.js').CircuitBreakerOptions} CircuitBreakerOptions
 */
/**
 * @typedef {import('./policies/timeout.js').TimeoutOptions} TimeoutOptions
 */
/**
 * @typedef {import('./policies/retry.js').RetryOptions} RetryOptions
 */

/**
 * @typedef {Object} CacheConfig
 * @property {!ioredis} redis - an instance of a redis client. You should
 * instantiate a `ioredis` instance, connect and pass it here.
 * @property {Object} [options={}] - cache general options.
 * @property {!string} options.name - name of the service this cache instance
 * will handle.
 * @property {CircuitBreakerOptions} [options.circuitBreakercircuitBreaker=null] -
 * circuit breaker config for this cache instance.
 */

/**
 * Callback to evaluate if the current key should be refreshed in the background
 * automatically.
 *
 * @typedef {function(string, number, Object):boolean} shouldRefreshKey
 * @param {!string} key - tentative cache key to perform an automatic update.
 * @param {!number} ttl - current ttl of the cache key in milliseconds.
 * @param {!CacheGetOptions} options - user defined options. Should be the same
 * configuration provided to cache get operation.
 * @returns {boolean} - whether a producer call and redis set should be
 * performed in background. Should be `true` if the refresh should be performed.
 */

/**
 * @typedef {Object} CacheGetOptions
 * @property {?(function():Promise<string>|null)} producer - async function that
 * should be called if there's need to set the cache with the redis `key`. Note
 * that this function should produce the result only when called. Should also
 * necessarily return a string. Defaults to not produce results and only return
 * cached values.
 * @property {?(number|null)} [ttl=null] - amount of time in milliseconds, a key should
 * have in case the producer is called, and a redis set is performed. Defaults to
 * never set a ttl.
 * @property {?(boolean|null)} [returnEarlyFromCache=false] - whether to resolve early
 * with only the cached result, while a producer call and redis set is made in
 * background. By default the method will resolve after the producer calls and
 * redis set are performed.
 * @property {?(boolean|null)} [overrideCache=false] - whether to ignore cache contents
 * and perform a producer and redis set flow. Useful when you want to force
 * a key refresh. Defaults to never ignore cached results
 * @property {?(shouldRefreshKey|null)} [shouldRefreshKey=null] - callback to
 * decide whether to perform background cache key refresh should be performed.
 * Defaults to never perform background cache refreshes.
 * @property {?(number|null)} [producerTimeout=null] - amount of time in milliseconds a
 * producer call should last before a timeout error is generated. Defaults to no
 * timeout.
 * @property {?(RetryOptions|null)} [producerRetry=null] - configuration for retry
 * with exponential backoff retries with decorrelated jitter, see
 * (https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).
 * Defaults to never perform retries.
 */

export type shouldRefreshKey = {
  (string, number, CacheGetOptions): boolean,
}

export type producer = {
  (): (Promise<string | null>),
}

export type CacheSetOptions = {
  ttl?: number | null ,
}

export interface CacheGetOptions {
  producer?: producer | null,
  ttl?: number | null ,
  returnEarlyFromCache?: boolean | null,
  overrideCache?: boolean | null,
  shouldRefreshKey?: shouldRefreshKey | null,
  producerTimeout?: number | null,
  producerRetry?: RetryOptions,
}

export interface CacheOptions {
  name?: string | null | undefined,
  circuitBreaker?: CircuitBreakerOptions | undefined | null,
}

export interface CacheConfig {
  redis: any,
  options?: CacheOptions
}

/**
 * This is the main class to be used for interfacing producer with a redis cache.
 *
 * I recommend instantiating a cache class for each service that you consume.
 * This is because each cache class have it's own circuit breaker. So it makes
 * sense that failures in a service doesn't affect another working service.
 */
export class Cache {
  redis: any;
  options: CacheOptions;
  rta: RTAEmitter;
  circuitBreakerPolicy: CircuitBreakerPolicy;

  /**
   * @constructor
   * @param {!CacheConfig} config
   */
  constructor({ redis, options = {} }: CacheConfig) {
    this.redis = redis;
    this.options = options;
    this.rta = rtaEmitter;

    if (typeof this.options.circuitBreaker === 'object') {
      this.options.circuitBreaker.name = this.options.name;
    }
    this.circuitBreakerPolicy = new CircuitBreakerPolicy(options.circuitBreaker);
  }

  /**
   * @private
   */
  static calculateElapsedMilliseconds(start) {
    const end = process.hrtime(start);
    const elapsedTime = end[0] * 1000 + end[1] / 1e6;
    return elapsedTime;
  }

  /**
   * @private
   * @param {!string} key
   * @param {Object} options
   */
  async produceAndSet(key, options) {
    const value = await this.rawProduce(options);
    await this.set(key, value, options);
    return value;
  }

  // TODO: remove eslint-disable
  // TODO: implement eventemitter?
  /**
   * @private
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  handleAsyncProducerError(error, key, options) {
  }

  /**
   * @private
   */
  getProducerOptions(options) {
    const producerOptions = {
      name: this.options.name,
      circuitBreakerPolicy: this.circuitBreakerPolicy,
      timeout: options.producerTimeout,
      retry: options.producerRetry,
    };

    return producerOptions;
  }

  /**
   * @private
   */
  produce(key, options) {
    const producerOptions = this.getProducerOptions(options);
    const producer = new Producer(
      () => this.produceAndSet(key, options),
      producerOptions,
    );

    return producer.execute();
  }

  /**
   * Interfaces a redis get method with a producer function that generates the
   * key value in case of a cache miss.
   *
   * @param {!string} key - redis key to get.
   * @param {?CacheGetOptions} [options={}]
   * @returns {(Promise<string>|Promise<null>)} - the value present in the redis key, in case of a
   * cache hit, and possible producer call. Or `null` depending on configured
   * call.
   */
  async get(key, options: CacheGetOptions = {}) {
    const {
      producer,
      returnEarlyFromCache,
      overrideCache,
      shouldRefreshKey,
    } = options;

    const valuePromise = this.rawGet(key);
    const ttl = await this.rawPTTL(key);
    let value = await valuePromise;

    let willRefresh = false;
    if (typeof shouldRefreshKey === 'function') {
      willRefresh = shouldRefreshKey(key, ttl, options);
    }

    if ((willRefresh || overrideCache || value === null) && producer) {
      const promise = this.produce(key, options);
      if (returnEarlyFromCache || willRefresh) {
        promise.catch((error) => this.handleAsyncProducerError(error, key, options));
      } else {
        value = await promise;
      }
    }

    return value;
  }

  /**
   * Perform a redis set for the given key and value.
   *
   * @param {!string} key - cache key that will hold the `value`.
   * @param {!string} value - value to be stored in the `key`.
   * @param {?Object} [options={}]
   * @param {?number} [options.ttl=null] - number of milliseconds this key will have
   * before expiring. Defaults to never set ttl.
   * @returns {Promise<string>} - returns string `OK` if successful.
   */
  async set(key, value, options: CacheSetOptions = {}) {
    const { ttl } = options;
    const args = [key, value];

    if (ttl) {
      args.push('PX', ttl);
    }

    return this.rawSet(...args);
  }

  /**
   * @private
   */
  async rawGet(key) {
    const start = process.hrtime();
    const { name } = this.options;

    let value;
    try {
      value = await this.redis.get(key);
    } finally {
      const elapsedTime = Cache.calculateElapsedMilliseconds(start);

      this.rta.emitCacheOperation(name, 'get');
      this.rta.emitCacheRT(name, 'get', elapsedTime);
      this.rta.emitCacheResult(name, 'get', !!value);
    }

    return value;
  }

  /**
   * @private
   */
  async rawSet(...args) {
    const start = process.hrtime();
    const { name } = this.options;

    let result;
    try {
      result = this.redis.set(...args);
    } finally {
      const elapsedTime = Cache.calculateElapsedMilliseconds(start);

      this.rta.emitCacheOperation(name, 'set');
      this.rta.emitCacheRT(name, 'set', elapsedTime);
    }
    return result;
  }

  /**
   * @private
   */
  async rawPTTL(key) {
    const { name } = this.options;

    let result;
    try {
      result = this.redis.pttl(key);
    } finally {
      this.rta.emitCacheOperation(name, 'pttl');
    }
    return result;
  }

  /**
   * @private
   */
  async rawProduce(options) {
    const start = process.hrtime();
    const { name } = this.options;
    const { producer } = options;

    let value;
    try {
      value = await producer();
    } finally {
      const elapsedTime = Cache.calculateElapsedMilliseconds(start);
      this.rta.emitProducerRT(name, elapsedTime);
      this.rta.emitProducerResult(name, !!value);
    }

    return value;
  }
}
