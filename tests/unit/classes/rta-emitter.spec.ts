import { expect } from 'chai';
import * as sinon from 'sinon';

import * as RTAEmitter from '../../../lib/classes/rta-emitter';

describe('RTAEmitter', function () {
  const { rtaEmitter } = RTAEmitter;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('rtaEmitter instance', function () {
    it('should have methods to handle circuit break events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, state }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(state).to.be.equal('opened');

        done();
      });
      rtaEmitter.onCircuitStateChange(callback);

      rtaEmitter.emitCircuitStateChange('name', 'opened');
    });

    it('should have methods to handle cache result events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, operation, result }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(operation).to.be.equal('get');
        expect(result).to.be.equal(true);

        done();
      });
      rtaEmitter.onCacheResult(callback);

      rtaEmitter.emitCacheResult('name', 'get', true);
    });

    it('should have methods to handle cache RT events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, operation, time }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(operation).to.be.equal('get');
        expect(time).to.be.equal(1000);

        done();
      });
      rtaEmitter.onCacheRT(callback);

      rtaEmitter.emitCacheRT('name', 'get', 1000);
    });

    it('should have methods to handle cache operation events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, operation }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(operation).to.be.equal('set');

        done();
      });
      rtaEmitter.onCacheOperation(callback);

      rtaEmitter.emitCacheOperation('name', 'set');
    });

    it('should have methods to handle producer RT events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, time }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(time).to.be.equal(1000);

        done();
      });
      rtaEmitter.onProducerRT(callback);

      rtaEmitter.emitProducerRT('name', 1000);
    });

    it('should have methods to handle producer result events', function (done) {
      const callback = sandbox.stub().callsFake(({ name, result }) => {
        expect(callback).to.have.been.calledOnce;

        expect(name).to.be.equal('name');
        expect(result).to.be.equal(true);

        done();
      });
      rtaEmitter.onProducerResult(callback);

      rtaEmitter.emitProducerResult('name', true);
    });
  });
});
