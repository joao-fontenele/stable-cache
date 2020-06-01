import { EventEmitter } from 'events';
import { EventTypes } from '../constants/event-types';

export interface callbackFn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): void,
}

export class RTAEmitter extends EventEmitter {
  emitCircuitStateChange(name: string, state: string): boolean {
    return this.emit(
      EventTypes.CIRCUIT_BREAKER_STATE_CHANGE,
      { name, state },
    );
  }

  onCircuitStateChange(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.CIRCUIT_BREAKER_STATE_CHANGE, callback);
  }

  emitCacheResult(name: string, operation: string, result: boolean): boolean {
    return this.emit(
      EventTypes.CACHE_RESULT,
      { name, operation, result },
    );
  }

  onCacheResult(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.CACHE_RESULT, callback);
  }

  emitCacheRT(name: string, operation: string, time: number): boolean {
    return this.emit(
      EventTypes.CACHE_RT,
      { name, operation, time },
    );
  }

  onCacheRT(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.CACHE_RT, callback);
  }

  emitCacheOperation(name: string, operation: string): boolean {
    return this.emit(
      EventTypes.CACHE_OPERATION,
      { name, operation },
    );
  }

  onCacheOperation(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.CACHE_OPERATION, callback);
  }

  emitProducerRT(name: string, time: number): boolean {
    return this.emit(
      EventTypes.PRODUCER_RT,
      { name, time },
    );
  }

  onProducerRT(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.PRODUCER_RT, callback);
  }

  emitProducerResult(name: string, result: boolean): boolean {
    return this.emit(
      EventTypes.PRODUCER_RESULT,
      { name, result },
    );
  }

  onProducerResult(callback: callbackFn): EventEmitter {
    return this.on(EventTypes.PRODUCER_RESULT, callback);
  }
}

export const rtaEmitter = new RTAEmitter();
