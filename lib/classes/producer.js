const {
  Policy,
  TimeoutStrategy,
  decorrelatedJitterGenerator,
} = require('cockatiel');

class Producer {
  constructor(producer, options = {}) {
    this.options = options;
    this.producer = producer;
    this.policies = Producer.getPolicies(options);
  }

  static parseBackoffPolicy(options) {
    const { backoff } = options;
    let policy = null;

    if (backoff) {
      backoff.generator = decorrelatedJitterGenerator;
      policy = Policy.handleAll().retry().exponential(backoff);
    }

    return policy;
  }

  static parseCircuitBreakerPoliciy(options) {
    const { circuitBreaker, openCircuitAfter } = options;
    let policy = null;

    if (circuitBreaker) {
      policy = Policy.handleAll().circuitBreaker(openCircuitAfter, circuitBreaker);
    }

    return policy;
  }

  static parseTimeoutPolicy(options) {
    const { timeout } = options;
    let policy = null;

    if (timeout) {
      policy = Policy.timeout(timeout, TimeoutStrategy.Aggressive);
    }

    return policy;
  }

  static getPolicies(options) {
    const timeoutPolicy = this.parseTimeoutPolicy(options);
    const backoffPolicy = this.parseBackoffPolicy(options);
    const circuitBreakerPolicy = this.parseCircuitBreakerPoliciy(options);

    const allPolicies = [
      backoffPolicy,
      circuitBreakerPolicy,
      timeoutPolicy,
    ];

    return allPolicies.filter((policy) => policy);
  }

  execute() {
    if (this.policies && this.policies.length) {
      const policy = Policy.wrap(...this.policies);
      return policy.execute(this.producer);
    }

    return this.producer();
  }
}

module.exports = Producer;
