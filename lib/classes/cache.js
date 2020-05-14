const { SamplingBreaker } = require('cockatiel');
const Producer = require('./producer');
const RTAEmitter = require('./rta-emitter');

class Cache {
  constructor({ redis, options = {} }) {
    this.redis = redis;
    this.circuitBreaker = null;
    this.options = options;
    this.rta = RTAEmitter.rtaEmitter;

    if (options.circuitBreaker) {
      this.circuitBreaker = new SamplingBreaker(options.circuitBreaker);
    }
  }

  static calculateElapsedMilliseconds(start) {
    const end = process.hrtime(start);
    const elapsedTime = end[0] * 1000 + end[1] / 1e6;
    return elapsedTime;
  }

  async produceAndSet(key, options) {
    const value = await this.rawProduce(options);
    await this.set(key, value, options);
    return value;
  }

  // TODO: remove eslint-disable
  // TODO: implement eventemitter?
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  handleAsyncProducerError(error, key, options) {
  }

  getProducerOptions(options) {
    const producerOptions = {
      circuitBreaker: this.circuitBreaker,
      openCircuitAfter: this.options.openCircuitAfter,
      timeout: options.producerTimeout,
      backoff: options.producerBackoff,
    };

    return producerOptions;
  }

  produce(key, options) {
    const producerOptions = this.getProducerOptions(options);
    const producer = new Producer(
      () => this.produceAndSet(key, options),
      producerOptions,
    );

    return producer.execute();
  }

  async get(key, options = {}) {
    const { producer, returnEarlyFromCache, overrideCache } = options;

    let value = await this.rawGet(key);

    if ((overrideCache || value === null) && producer) {
      const promise = this.produce(key, options);
      if (returnEarlyFromCache) {
        promise.catch((error) => this.handleAsyncProducerError(error, key, options));
      } else {
        value = await promise;
      }
    }

    return value;
  }

  async set(key, value, options = {}) {
    const { ttl } = options;
    const args = [key, value];

    if (ttl) {
      args.push('PX', ttl);
    }

    return this.rawSet(...args);
  }

  async rawGet(...args) {
    const start = process.hrtime();
    const { name } = this.options;

    let value;
    try {
      value = await this.redis.get(...args);
    } finally {
      const elapsedTime = Cache.calculateElapsedMilliseconds(start);

      this.rta.emitCacheOperation(name, 'get');
      this.rta.emitCacheRT(name, 'get', elapsedTime);
      this.rta.emitCacheResult(name, 'get', !!value);
    }

    return value;
  }

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

module.exports = Cache;
