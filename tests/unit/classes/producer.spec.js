const Bluebird = require('bluebird');
const Producer = require('../../../lib/classes/producer');
const testUtils = require('../../utils');
const CircuitBreakerPolicy = require('../../../lib/classes/policies/circuit-breaker');

describe('Producer', function () {
  let sandbox;
  let clock;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(function () {
    sandbox.restore();
    clock.restore();
  });

  describe('timeout should work', function () {
    it('should do nothing if no timeout is provided', async function () {
      const someValue = 'some value';
      const rawProducer = sinon.stub().resolves(someValue);

      const producer = new Producer(rawProducer);
      const promise = producer.execute();
      clock.tick(20);
      const result = await promise;

      expect(result).to.be.equal(someValue);
    });

    it('should return ok if timeout is not reached', async function () {
      const someValue = 'some value';
      const rawProducer = () => new Promise((resolve) => {
        setTimeout(() => resolve(someValue), 10);
      });
      const producer = new Producer(rawProducer, { timeout: 20 });

      const promise = producer.execute();
      clock.tick(15);
      const result = await promise;

      expect(result).to.be.equal(someValue);
    });

    it('should throw if timeout is reached', async function () {
      const someValue = 'some value';
      const rawProducer = () => new Promise((resolve) => {
        setTimeout(() => {
          resolve(someValue);
        }, 20);
      });
      const producer = new Producer(rawProducer, { timeout: 10 });

      const promise = producer.execute();
      clock.tick(19);
      await testUtils.expectToThrow(promise);
    });
  });

  describe('backoff should work', function () {
    it('should do nothing if no backoff config is provided', async function () {
      const someValue = 'some value';
      const rawProducer = sinon.stub().resolves(someValue);

      const producer = new Producer(rawProducer);
      const promise = producer.execute();
      clock.tick(20);
      const result = await promise;

      expect(result).to.be.equal(someValue);
    });

    it('should use the provided backoff config, and throw in case the producer keeps throwing', async function () {
      const error = new Error('msg');
      const rawProducer = sandbox.stub().rejects(error);

      const producer = new Producer(
        rawProducer,
        { retry: { maxAttempts: 2, initialDelay: 100, maxDelay: 3000 } },
      );

      const delays = [];
      // tick the clock, so the backoff delay can kick in
      const listener = producer.policies[0].onRetry(({ delay }) => {
        delays.push(delay);
        clock.tick(delay || 1);
      });

      const promise = producer.execute();

      // producer ended up always throwing, so we expect it to throw
      await testUtils.expectToThrow(promise);

      // 1st retry is always 0 delay
      expect(delays[0]).to.be.equal(0);
      // close to the initial delay,
      // since the jittering is used, this can't be precise
      expect(delays[1]).to.be.within(0, 200);

      // once for the inital request, plus 2 attempts
      expect(rawProducer).to.have.been.calledThrice;

      listener.dispose();
    });

    it('should use the provided backoff config, and producer eventually succeeds', async function () {
      let calls = 0;
      const rawProducer = () => new Promise((resolve, reject) => {
        calls += 1;
        if (calls > 1) {
          return resolve(true);
        }
        return reject(new Error('msg'));
      });

      const producer = new Producer(
        sandbox.stub(rawProducer),
        { retry: { maxAttempts: 3, initialDelay: 100, maxDelay: 3000 } },
      );

      // tick the clock, so the backoff delay can kick in
      const listener = producer.policies[0].onRetry(({ delay }) => {
        clock.tick(delay || 1);
      });

      const result = await producer.execute();

      // first call failed, and the second one succeeded
      expect(calls).to.be.equal(2);
      expect(result).to.be.equal(true);

      listener.dispose();
    });
  });

  describe('circuit breaker should work', function () {
    it('should do nothing if not circuit breaker config is provided', async function () {
      const someValue = 'some value';
      const rawProducer = sinon.stub().resolves(someValue);

      const producer = new Producer(rawProducer);
      const promise = producer.execute();
      clock.tick(20);
      const result = await promise;

      expect(result).to.be.equal(someValue);
    });

    it('should fail fast when the circuit is open', async function () {
      const rawProducer = sinon.stub().resolves(true);

      const circuitBreakerPolicy = new CircuitBreakerPolicy({
        threshold: 0.2,
        duration: 30000,
        openAfter: 30000,
      });

      const producer = new Producer(rawProducer, { circuitBreakerPolicy });

      // force circuit breaker to open
      const trigger = producer.policies[1].isolate();

      const promise = producer.execute();
      await testUtils.expectToThrow(promise);

      trigger.dispose();
    });

    it('should work in case the circuit is closed and producer resolves', async function () {
      const rawProducer = sinon.stub().resolves(true);

      const circuitBreakerPolicy = new CircuitBreakerPolicy({
        threshold: 0.2,
        duration: 30000,
        openAfter: 30000,
      });

      const producer = new Producer(rawProducer, { circuitBreakerPolicy });

      const result = await producer.execute();

      expect(result).to.be.equal(true);
    });
  });

  describe('should work with all policies together', function () {
    it('should resolve if the producer eventually resolves', async function () {
      clock.restore(); // TODO: couldn't use fake timers in this test, fix later

      let delay = 20;
      let calls = 0;
      const rawProducer = async () => {
        calls += 1;

        if (calls > 2) {
          delay = 5;
        }

        await Bluebird.delay(delay);
        return true;
      };

      const circuitBreakerPolicy = new CircuitBreakerPolicy({
        threshold: 0.2,
        duration: 30000,
        openAfter: 30000,
      });
      const producer = new Producer(
        rawProducer,
        {
          retry: { maxAttempts: 4, initialDelay: 10, maxDelay: 90 },
          timeout: 10,
          circuitBreakerPolicy,
        },
      );

      const result = await producer.execute();

      expect(result).to.be.equal(true);
      expect(calls).to.be.equal(3);
    });
  });

  describe('should work with no policies are configured', function () {
    it('should throw in case the producer throws', async function () {
      const rawProducer = sandbox.stub().rejects(new Error('msg'));
      const producer = new Producer(rawProducer);

      const promise = producer.execute();
      await testUtils.expectToThrow(promise);
    });

    it('should resolve if producer eventually resolves', async function () {
      const rawProducer = sandbox.stub().resolves('OK');
      const producer = new Producer(rawProducer);

      const result = await producer.execute();

      expect(result).to.be.equal('OK');
    });
  });
});
