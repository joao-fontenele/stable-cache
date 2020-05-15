const Bluebird = require('bluebird');
const {
  Policy,
  TimeoutStrategy,
  decorrelatedJitterGenerator,
} = require('cockatiel');
const RTAEmitter = require('./rta-emitter');

class Producer {
  constructor(producer, options = {}) {
    this.options = options;
    this.producer = producer;
    this.listeners = [];
    this.policies = this.getPolicies();

    this.rta = RTAEmitter.rtaEmitter;
  }

  parseBackoffPolicy() {
    const { backoff } = this.options;
    let policy = null;

    if (backoff) {
      backoff.generator = decorrelatedJitterGenerator;
      policy = Policy.handleAll().retry().exponential(backoff);
    }

    return policy;
  }

  parseCircuitBreakerPoliciy() {
    const { circuitBreaker, openCircuitAfter, name } = this.options;
    let policy = null;

    if (circuitBreaker) {
      policy = Policy.handleAll().circuitBreaker(openCircuitAfter, circuitBreaker);

      const onBreakListener = policy.onBreak(
        () => this.rta.emitCircuitStateChange(name, 'opened'),
      );
      const onResetListener = policy.onReset(
        () => this.rta.emitCircuitStateChange(name, 'closed'),
      );
      this.listeners.push(onBreakListener);
      this.listeners.push(onResetListener);
    }

    return policy;
  }

  parseTimeoutPolicy() {
    const { timeout } = this.options;
    let policy = null;

    if (timeout) {
      policy = Policy.timeout(timeout, TimeoutStrategy.Aggressive);
    }

    return policy;
  }

  getPolicies() {
    const timeoutPolicy = this.parseTimeoutPolicy();
    const backoffPolicy = this.parseBackoffPolicy();
    const circuitBreakerPolicy = this.parseCircuitBreakerPoliciy();

    const allPolicies = [
      backoffPolicy,
      circuitBreakerPolicy,
      timeoutPolicy,
    ];

    return allPolicies.filter((policy) => policy);
  }

  cleanupListeners() {
    this.listeners.forEach((listener) => listener.dispose());
    this.listeners = [];
  }

  execute() {
    let promise;
    if (this.policies && this.policies.length) {
      const policy = Policy.wrap(...this.policies);
      promise = policy.execute(this.producer);
    } else {
      promise = this.producer();
    }

    return Bluebird.resolve(promise)
      .finally(() => this.cleanupListeners());
  }
}

module.exports = Producer;
