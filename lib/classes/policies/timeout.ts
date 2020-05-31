import { Policy, TimeoutStrategy, IPolicy } from 'cockatiel';
import { MyPolicy } from './policy';

/**
 * @typedef {Object} TimeoutOptions
 * @property {?number} [timeout=null] - max amount of time in milliseconds a
 * producer call can be waited
 * @property {?string} [name=''] - name of the service for the configured retry
 * policy.
 */

export interface TimeoutOptions {
  timeout?: number,
  name?: string,
}

/**
 * Creates and holds a retry policy with exponential backoff
 */
export class TimeoutPolicy extends MyPolicy {
  options: TimeoutOptions;
  policy: IPolicy<any>;

  /**
   * @constructor
   * @param {TimeoutOptions} options
   */
  constructor(options) {
    super();
    this.options = options;
    const { timeout } = this.options;
    this.policy = Policy.noop;

    if (timeout) {
      this.policy = Policy.timeout(timeout, TimeoutStrategy.Aggressive);
    }
  }
}
