const { Policy, TimeoutStrategy } = require('cockatiel');
const MyPolicy = require('./policy');

class TimeoutPolicy extends MyPolicy {
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
