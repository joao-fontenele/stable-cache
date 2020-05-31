import { EventEmitter } from 'events';
import { EventTypes } from '../constants/event-types';

export class RTAEmitter extends EventEmitter {
  emitCircuitStateChange(name, state) {
    return this.emit(
      EventTypes.CIRCUIT_BREAKER_STATE_CHANGE,
      { name, state },
    );
  }

  onCircuitStateChange(callback) {
    return this.on(EventTypes.CIRCUIT_BREAKER_STATE_CHANGE, callback);
  }

  emitCacheResult(name, operation, result) {
    return this.emit(
      EventTypes.CACHE_RESULT,
      { name, operation, result },
    );
  }

  onCacheResult(callback) {
    return this.on(EventTypes.CACHE_RESULT, callback);
  }

  emitCacheRT(name, operation, time) {
    return this.emit(
      EventTypes.CACHE_RT,
      { name, operation, time },
    );
  }

  onCacheRT(callback) {
    return this.on(EventTypes.CACHE_RT, callback);
  }

  emitCacheOperation(name, operation) {
    return this.emit(
      EventTypes.CACHE_OPERATION,
      { name, operation },
    );
  }

  onCacheOperation(callback) {
    return this.on(EventTypes.CACHE_OPERATION, callback);
  }

  emitProducerRT(name, time) {
    return this.emit(
      EventTypes.PRODUCER_RT,
      { name, time },
    );
  }

  onProducerRT(callback) {
    return this.on(EventTypes.PRODUCER_RT, callback);
  }

  emitProducerResult(name, result) {
    return this.emit(
      EventTypes.PRODUCER_RESULT,
      { name, result },
    );
  }

  onProducerResult(callback) {
    return this.on(EventTypes.PRODUCER_RESULT, callback);
  }
}

export const rtaEmitter = new RTAEmitter();
