const { Policy, decorrelatedJitterGenerator } = require('cockatiel');
const MyPolicy = require('./policy');

class Retry extends MyPolicy {
  constructor(options) {
    super();
    this.policy = Policy.noop;

    this.defaultOptions = {
      maxDelay: 30000,
      maxAttempts: 10,
      exponent: 2,
      initialDelay: 128,
      generator: decorrelatedJitterGenerator,
      name: '',
    };

    if (typeof options === 'object') {
      const backoff = { ...this.defaultOptions, ...options };
      this.policy = Policy.handleAll().retry().exponential(backoff);
    }
  }
}

module.exports = Retry;
