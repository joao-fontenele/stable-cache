import { Policy, IPolicy } from 'cockatiel';
import { TimeoutPolicy } from './policies/timeout';
import { RetryPolicy } from './policies/retry';

export type producer = {
  (): (Promise<string | null>),
}

export class Producer {
  options: any;

  producer: producer;

  listeners: Array<any>;

  policies: Array<IPolicy<any>>

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
