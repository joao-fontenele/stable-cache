import { expect } from 'chai';
import * as sinon from 'sinon';

import * as Bluebird from 'bluebird';
import { Cache } from '../../../lib/classes/cache';

import * as testUtils from '../../utils';

describe('Cache', function () {
  const serviceName = 'someService';
  let cache;
  let sandbox;
  let redis;

  beforeEach(function () {
    sandbox = sinon.createSandbox();

    redis = {
      get: sandbox.stub().callsFake(async (key) => {
        if (key === 'string') {
          return 'hello world!';
        }

        if (key === 'throw') {
          throw new Error('msg');
        }

        return null;
      }),
      set: sandbox.stub().callsFake(async (key) => {
        if (key === 'throw') {
          throw new Error('msg');
        }

        return 'OK';
      }),
      pttl: sandbox.stub().resolves(60000),
    };

    cache = new Cache({ redis, options: { name: serviceName } });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('get method', function () {
    it('should get the value from redis if there\' a cache hit', async function () {
      const response = await cache.get('string');
      expect(response).to.be.equal('hello world!');
    });

    it('should call producer correctly if a producer is provided, and there\' a cache miss', async function () {
      const producer = sandbox.stub().resolves('value');

      const response = await cache.get('miss', { producer });

      expect(response).to.be.equal('value');
      expect(producer).to.have.been.calledOnce;
    });

    it('should not break if there\' a cache miss and no producer is provided', async function () {
      const response = await cache.get('miss');
      expect(response).to.be.equal(null);
    });

    it('should throw in case producer throws', async function () {
      const error = new Error('msg');
      const producer = sandbox.stub().rejects(error);

      const promise = cache.get('miss', { producer });

      await testUtils.expectToThrow(promise, error);
    });

    it('should throw in case redis get throws', async function () {
      const promise = cache.get('throw');
      await testUtils.expectToThrow(promise);
    });

    it('should return the cached value in case the producer has to be called and returnEarlyFromCache is truthy', async function () {
      let resolveProducer;
      const producer = sandbox.stub().callsFake(
        () => new Promise((resolve) => {
          resolveProducer = resolve;
        }),
      );
      const returnEarlyFromCache = true;

      const response = await cache.get('miss', { producer, returnEarlyFromCache });
      expect(response).to.equal(null);

      // since the request is still being made in backgroud
      expect(redis.set).to.not.have.been.called;

      resolveProducer('value');

      // TODO: improve flaky test. This delay is needed for the redis.set to
      // have enough time to be called
      await Bluebird.delay(5);
      expect(redis.set).to.have.been.calledOnce;
    });

    it('should not throw in case returnEarlyFromCache flag is truthy and producer throws', async function () {
      const producer = sandbox.stub().rejects(new Error('msg'));
      const returnEarlyFromCache = true;

      sandbox.spy(cache, 'handleAsyncProducerError');

      const response = await cache.get('miss', { producer, returnEarlyFromCache });
      expect(response).to.equal(null);

      // TODO: improve flaky test. This delay is needed for the error handler to
      // have enough time to be called
      await Bluebird.delay(5);

      expect(cache.handleAsyncProducerError).to.have.been.calledOnce;
    });

    it('should call producer even if cache hit, in case overrideCache flag is truthy', async function () {
      const overrideCache = true;
      const producer = sandbox.stub().resolves('value');
      const response = await cache.get('string', { producer, overrideCache });

      expect(response).to.be.equal('value');
      expect(producer).to.have.been.calledOnce;
    });

    it('should call producer in background if there`s a cache miss and overrideCache flag is truthy', async function () {
      const overrideCache = true;
      const returnEarlyFromCache = true;
      let resolveProducer;
      const producer = sandbox.stub().callsFake(
        () => new Promise((resolve) => {
          resolveProducer = resolve;
        }),
      );
      const response = await cache.get('miss', { producer, returnEarlyFromCache, overrideCache });

      expect(response).to.equal(null);
      expect(producer).to.have.been.calledOnce;

      // since the request is still being made in backgroud
      expect(redis.set).to.not.have.been.called;

      resolveProducer('value');

      // TODO: improve flaky test. This delay is needed for the redis.set to
      // have enough time to be called
      await Bluebird.delay(5);
      expect(redis.set).to.have.been.calledOnce;
    });

    it('should perform a cache refresh in background in case the shouldRefreshKey evaluates to truthy', async function () {
      const shouldRefreshKey = sandbox.stub().returns(true);
      const producer = sandbox.stub().resolves('hello world!');

      const key = 'string';
      const ttl = 60000;
      const options = { producer, shouldRefreshKey, ttl };
      const result = await cache.get(key, options);

      expect(result).to.be.equal('hello world!');

      expect(producer).to.have.been.calledOnce;
      expect(shouldRefreshKey.withArgs(key, 60000, options))
        .to.have.been.calledOnce;
    });

    it('should not perform a cache refresh in background in case the shouldRefreshKey evaluates to truthy', async function () {
      const shouldRefreshKey = sandbox.stub().returns(false);
      const producer = sandbox.stub().resolves('a new hello world!');

      const key = 'string';
      const ttl = 60000;
      const options = { producer, shouldRefreshKey, ttl };
      const result = await cache.get(key, options);

      expect(result).to.be.equal('hello world!');

      expect(producer).to.not.have.been.called;
      expect(shouldRefreshKey.withArgs(key, 60000, options))
        .to.have.been.calledOnce;
    });
  });

  describe('set method', function () {
    it('should set the key in redis', async function () {
      const response = await cache.set('key', 'value');

      expect(redis.set.withArgs('key', 'value')).to.have.been.calledOnce;
      expect(response).to.be.equal('OK');
    });

    it('should throw in case redis set throws', async function () {
      const promise = cache.set('throw');
      await testUtils.expectToThrow(promise);
    });

    it('should set the ttl in case ttl option is provided', async function () {
      const response = await cache.set('key', 'value', { ttl: 10000 });

      expect(redis.set.withArgs('key', 'value', 'PX', '10000')).to.have.been.calledOnce;
      expect(response).to.be.equal('OK');
    });
  });

  describe('raw methods', function () {
    let clock;

    beforeEach(function () {
      clock = sandbox.useFakeTimers();
    });

    afterEach(function () {
      clock.restore();
    });

    it('rawGet should call rtaEmitter correctly', async function () {
      sandbox.spy(cache.rta, 'emitCacheOperation');
      sandbox.spy(cache.rta, 'emitCacheRT');
      sandbox.spy(cache.rta, 'emitCacheResult');

      const promise = cache.rawGet('string');
      const result = await promise;

      expect(result).to.be.equal('hello world!');

      expect(cache.rta.emitCacheOperation.withArgs(serviceName, 'get'))
        .to.have.been.calledOnce;

      expect(cache.rta.emitCacheRT.withArgs(serviceName, 'get', 0))
        .to.have.been.calledOnce;

      expect(cache.rta.emitCacheResult.withArgs(serviceName, 'get', true))
        .to.have.been.calledOnce;
    });

    it('rawSet should call rtaEmitter correctly', async function () {
      sandbox.spy(cache.rta, 'emitCacheOperation');
      sandbox.spy(cache.rta, 'emitCacheRT');

      const promise = cache.rawSet('someKey', 'someValue');
      const result = await promise;

      expect(result).to.be.equal('OK');
      expect(redis.set.withArgs('someKey', 'someValue'))
        .to.have.been.calledOnce;

      expect(cache.rta.emitCacheOperation.withArgs(serviceName, 'set'))
        .to.have.been.calledOnce;

      expect(cache.rta.emitCacheRT.withArgs(serviceName, 'set', 0))
        .to.have.been.calledOnce;
    });

    it('rawProduce should call rtaEmitter correctly', async function () {
      sandbox.spy(cache.rta, 'emitProducerRT');
      sandbox.spy(cache.rta, 'emitProducerResult');

      const producer = sandbox.stub().resolves('someValue');
      const promise = cache.rawProduce({ producer });
      const result = await promise;

      expect(result).to.be.equal('someValue');

      expect(cache.rta.emitProducerResult.withArgs(serviceName, true))
        .to.have.been.calledOnce;

      expect(cache.rta.emitProducerRT.withArgs(serviceName, 0))
        .to.have.been.calledOnce;
    });
  });
});
