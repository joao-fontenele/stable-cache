const { Policy, SamplingBreaker } = require('cockatiel');
const MyPolicy = require('./policy');
const RTAEmitter = require('../rta-emitter');

class CircuitBreaker extends MyPolicy {
  constructor(options) {
    super();
    this.defaultOptions = {
      threshold: 0.3,
      duration: 30 * 1000,
      samplingDuration: 1000,
      minimumRps: 5,
      openAfter: 30000,
      name: '',
    };

    this.options = options;
    this.policy = Policy.noop;
    this.rta = RTAEmitter.rtaEmitter;
    this.listeners = [];
    this.circuitBreaker = null;

    if (typeof options === 'object') {
      const configuredOptions = { ...this.defaultOptions, ...options };
      const { name, openAfter, ...cbOPtions } = configuredOptions;
      this.circuitBreaker = new SamplingBreaker(cbOPtions);
      this.policy = Policy.handleAll()
        .circuitBreaker(openAfter, this.circuitBreaker);

      const onBreakListener = this.policy.onBreak(
        () => this.rta.emitCircuitStateChange(name, 'opened'),
      );
      const onResetListener = this.policy.onReset(
        () => this.rta.emitCircuitStateChange(name, 'closed'),
      );
      this.listeners.push(onBreakListener);
      this.listeners.push(onResetListener);
    }
  }
}

module.exports = CircuitBreaker;
