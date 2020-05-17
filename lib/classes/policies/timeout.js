const { Policy, TimeoutStrategy } = require('cockatiel');
const MyPolicy = require('./policy');

/**
 * @typedef {Object} TimeoutOptions
 * @property {?number} [timeout=null] - max amount of time in milliseconds a
 * producer call can be waited
 * @property {?string} [name=''] - name of the service for the configured retry
 * policy.
 */

/**
 * Creates and holds a retry policy with exponential backoff
 */
class TimeoutPolicy extends MyPolicy {
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

module.exports = TimeoutPolicy;
