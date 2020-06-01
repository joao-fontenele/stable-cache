import {
  Policy, decorrelatedJitterGenerator, GeneratorFn,
} from 'cockatiel';
import { MyPolicy, PolicyLike } from './policy';

/**
 * @typedef {Object} RetryOptions
 * @property {?number} [maxDelay=30000] - max amount of delay in milliseconds
 * between retries.
 * @property {?number} [maxAttempts=10] - max amount of retries to perform.
 * @property {?number} [exponent=2] - exponent of the backoff formula.
 * @property {?number} [initialDelay=128] - initial delay to wait before
 * retrying. Note that for some reason cockatiel lib always retries immediately
 * on the first attempt to only later respect the `initialDelay` config.
 * @property {?function} [generator=decorrelatedJitterGenerator] - default
 * jitter generator. Avoid messing with this config since it can change in the
 * future.
 * @property {?string} [name=''] - name of the service for the configured retry
 * policy.
 */

export interface RetryOptions {
  maxDelay?: number | null,
  maxAttempts?: number | null,
  exponent?: number | null,
  initialDelay?: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator?: GeneratorFn<any>,
  name?: string | null,
}

/**
 * Creates and holds a retry policy with exponential backoff
 */
export class RetryPolicy extends MyPolicy {
  policy: PolicyLike;

  defaultOptions: RetryOptions;

  /**
   * @constructor
   * @param {RetryOptions} options
   */
  constructor(options: RetryOptions) {
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
