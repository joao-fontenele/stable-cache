const { Policy } = require('cockatiel');
const TimeoutPolicy = require('./policies/timeout');
const RetryPolicy = require('./policies/retry');

class Producer {
  constructor(producer, options = {}) {
    this.options = options;
    this.producer = producer;
    this.listeners = [];
    this.policies = this.getPolicies();
  }

  parseRetryPolicy() {
    const { retry } = this.options;
    const policy = (new RetryPolicy(retry)).getPolicy();
    return policy;
  }

  parseCircuitBreakerPoliciy() {
    const { circuitBreakerPolicy: policy } = this.options;
    if (!policy) {
      return Policy.noop;
    }
    return policy.getPolicy();
  }

  parseTimeoutPolicy() {
    const { timeout } = this.options;
    const policy = (new TimeoutPolicy({ timeout })).getPolicy();
    return policy;
  }

  getPolicies() {
    const timeoutPolicy = this.parseTimeoutPolicy();
    const retryPolicy = this.parseRetryPolicy();
    const circuitBreakerPolicy = this.parseCircuitBreakerPoliciy();

    const allPolicies = [
      retryPolicy,
      circuitBreakerPolicy,
      timeoutPolicy,
    ];

    return allPolicies;
  }

  execute() {
    const policy = Policy.wrap(...this.policies);
    return policy.execute(this.producer);
  }
}

module.exports = Producer;
