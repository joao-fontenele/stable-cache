class Cache {
  constructor({ redis }) {
    this.redis = redis;
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

  async get(key, options = {}) {
    const { producer, returnEarlyFromCache, overrideCache } = options;

    let value = await this.redis.get(key);

    if ((overrideCache || value === null) && producer) {
      const promise = this.produceAndSet(key, options);
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
