import { Policy } from 'cockatiel';
import { PolicyLike } from './policies/policy';
import { TimeoutPolicy } from './policies/timeout';
import { RetryPolicy, RetryOptions } from './policies/retry';
import { CircuitBreakerPolicy } from './policies/circuit-breaker';

export interface producerFn {
  (): Promise<string | null>,
}

export interface ProducerOptions {
  name?: string,
  circuitBreakerPolicy?: CircuitBreakerPolicy,
  timeout?: number,
  retry?: RetryOptions,
}

export class Producer {
  options: ProducerOptions;

  producer: producerFn;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: any[];

  policies: PolicyLike[]

  constructor(producer: producerFn, options: ProducerOptions = {}) {
    this.options = options;
    this.producer = producer;
    this.listeners = [];
    this.policies = this.getPolicies();
  }

  parseRetryPolicy(): PolicyLike {
    const { retry } = this.options;
    const policy = (new RetryPolicy(retry)).getPolicy();
    return policy;
  }

  parseCircuitBreakerPoliciy(): PolicyLike {
    const { circuitBreakerPolicy: policy } = this.options;
    if (!policy) {
      return Policy.noop;
    }
    return policy.getPolicy();
  }

  parseTimeoutPolicy(): PolicyLike {
    const { timeout } = this.options;
    const policy = (new TimeoutPolicy({ timeout })).getPolicy();
    return policy;
  }

  getPolicies(): PolicyLike[] {
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

  execute(): Promise<string|null> {
    const policy = Policy.wrap(...this.policies);
    return policy.execute(this.producer);
  }
}
