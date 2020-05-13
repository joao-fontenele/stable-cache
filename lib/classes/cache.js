const { SamplingBreaker } = require('cockatiel');
const Producer = require('./producer');

class Cache {
  constructor({ redis, options = {} }) {
    this.redis = redis;
    this.circuitBreaker = null;
    this.options = options;

    if (options.circuitBreaker) {
      this.circuitBreaker = new SamplingBreaker(options.circuitBreaker);
    }
  }

  async produceAndSet(key, options) {
    const { producer } = options;
    const value = await producer();
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

    let value = await this.redis.get(key);

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

    return this.redis.set(...args);
  }
}

module.exports = Cache;
