import * as Prometheus from 'prom-client';
import { rtaEmitter, RTAEmitter } from './rta-emitter';

/**
 * @typedef PrometheusRTAExporterOptions
 * @property {?string} [prefix=''] - prefix to be applied for each exported
 * metric.
 * @property {?Prometheus.register[]} [registers=[Prometheus.register]] -
 * registers where the collected metrics will be registered. Defaults to default
 * `prom-client` register.
 * @property {?number[]} [cacheBuckets] - buckets for the cache rt metric
 * histogram. Defaults to `Prometheus.exponentialBuckets(0.05, 2, 8)`
 * @property {?number[]} [producerBuckets] - buckets for the producer rt metric
 * histogram. Defaults to `Prometheus.exponentialBuckets(0.1, 2, 8)`
 */

export interface PrometheusExporterOptions {
  prefix?: string,
  registers?: Prometheus.Registry[],
  cacheBuckets?: number[],
  producerBuckets?: number[],
}

export interface Metrics {
  counters: { [index: string]: Prometheus.Counter<string> },
  histograms: { [index: string]: Prometheus.Histogram<string> },
  gauges: { [index: string]: Prometheus.Gauge<string> },
}

/**
 * This class is used to export RTA metrics from the cache lib to prometheus.
 */
export class PrometheusExporter {
  prefix: string;

  registers: Prometheus.Registry[];

  cacheBuckets: number[];

  producerBuckets: number[];

  rta: RTAEmitter;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: any[];

  metrics: Metrics;

  isCollectingMetrics: boolean;

  /**
   * @constructor
   * @param {PrometheusRTAExporterOptions} [options={}]
   */
  constructor(options: PrometheusExporterOptions = {}) {
    const {
      prefix,
      registers,
      cacheBuckets,
      producerBuckets,
    } = options;

    this.prefix = prefix || '';
    this.registers = registers || [Prometheus.register];
    this.cacheBuckets = cacheBuckets || Prometheus.exponentialBuckets(0.05, 2, 8);
    this.producerBuckets = producerBuckets || Prometheus.exponentialBuckets(0.1, 2, 8);

    this.metrics = PrometheusExporter.initMetrics({
      prefix: this.prefix,
      registers: this.registers,
      cacheBuckets: this.cacheBuckets,
      producerBuckets: this.producerBuckets,
    });

    this.listeners = [];
    this.rta = rtaEmitter;
    this.isCollectingMetrics = false;
  }

  /**
   * Initializes prometheus metrics instances.
   *
   * @static
   * @private
   * @param {!PrometheusRTAExporterOptions} options
   */
  static initMetrics({
    prefix,
    registers,
    cacheBuckets,
    producerBuckets,
  }): Metrics {
    const metrics: Metrics = { counters: {}, histograms: {}, gauges: {} };

    metrics.counters.cacheResults = new Prometheus.Counter({
      name: `${prefix}cache_results_count`,
      help: 'Counts the cache hits/misses of a redis get like operation',
      labelNames: ['service', 'operation', 'result'],
      registers,
    });

    metrics.histograms.cacheRT = new Prometheus.Histogram({
      name: `${prefix}cache_operations_duration_seconds`,
      help: 'Duration of redis operations',
      labelNames: ['service', 'operation'],
      buckets: cacheBuckets,
      registers,
    });

    metrics.counters.cacheOperations = new Prometheus.Counter({
      name: `${prefix}cache_operations_count`,
      help: 'Counts the amount of redis operations',
      labelNames: ['service', 'operation'],
      registers,
    });

    metrics.histograms.producerRT = new Prometheus.Histogram({
      name: `${prefix}producer_operations_duration_seconds`,
      help: 'Duration of producer operations',
      labelNames: ['service'],
      buckets: producerBuckets,
      registers,
    });

    metrics.counters.producerResults = new Prometheus.Counter({
      name: `${prefix}producer_operations_result_count`,
      help: 'Counts the outcomes of producer operations',
      labelNames: ['service', 'result'],
      registers,
    });

    metrics.gauges.circuitStateChange = new Prometheus.Gauge({
      name: `${prefix}producer_circuit_break_state`,
      help: 'State of the circuit breaker. CircuitOpen => (Not working === 1). CircuitClosed => (Working OK === 0)',
      labelNames: ['service'],
      registers,
    });

    return metrics;
  }

  /**
   * @private
   */
  collectCircuitStateChanges({ name, state }): void {
    this.metrics.gauges.circuitStateChange
      .labels(name)
      .set(state === 'opened' ? 1 : 0);
  }

  /**
   * @private
   */
  collectCacheResults({ name, operation, result }): void {
    this.metrics.counters.cacheResults
      .labels(name, operation, result ? 'hit' : 'miss')
      .inc();
  }

  /**
   * @private
   */
  collectCacheRT({ name, operation, time }): void {
    this.metrics.histograms.cacheRT
      .labels(name, operation)
      .observe(time / 1000);
  }

  /**
   * @private
   */
  collectCacheOperations({ name, operation }): void {
    this.metrics.counters.cacheOperations
      .labels(name, operation)
      .inc();
  }

  /**
   * @private
   */
  collectProducerRT({ name, time }): void {
    this.metrics.histograms.producerRT
      .labels(name)
      .observe(time / 1000);
  }

  /**
   * @private
   */
  collectProducerResults({ name, result }): void {
    this.metrics.counters.producerResults
      .labels(name, result ? 'success' : 'failure')
      .inc();
  }

  /**
   * Start collecting metrics.
   *
   * @returns {void}
   */
  collectMetrics(): void {
    if (this.isCollectingMetrics) {
      return;
    }

    this.isCollectingMetrics = true;

    this.rta.onCircuitStateChange((args) => this.collectCircuitStateChanges(args));
    this.rta.onCacheResult((args) => this.collectCacheResults(args));
    this.rta.onCacheRT((args) => this.collectCacheRT(args));
    this.rta.onCacheOperation((args) => this.collectCacheOperations(args));
    this.rta.onProducerRT((args) => this.collectProducerRT(args));
    this.rta.onProducerResult((args) => this.collectProducerResults(args));
  }

  /**
   * Stop collecting metrics.
   *
   * @returns {void}
   */
  stopCollectingMetrics(): void {
    if (!this.isCollectingMetrics) {
      return;
    }

    this.isCollectingMetrics = false;
    this.rta.removeAllListeners();
  }
}
