# Stable Cache

[![npm](https://img.shields.io/npm/v/stable-cache.svg)](https://www.npmjs.com/package/stable-cache)
[![Dependency Status](https://david-dm.org/joao-fontenele/stable-cache.svg)](https://david-dm.org/joao-fontenele/stable-cache)
[![devDependency Status](https://david-dm.org/joao-fontenele/stable-cache/dev-status.svg)](https://david-dm.org/joao-fontenele/stable-cache#info=devDependencies)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Test Coverage](https://api.codeclimate.com/v1/badges/4a36da1b2ed3bc53f940/test_coverage)](https://codeclimate.com/github/joao-fontenele/stable-cache/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/4a36da1b2ed3bc53f940/maintainability)](https://codeclimate.com/github/joao-fontenele/stable-cache/maintainability)
[![Gitter chat](https://badges.gitter.im/gitterHQ/gitter.png)](https://gitter.im/stable-cache/community)

This lib makes extensive use of a concept called producer. A producer is the source of truth of a cached value. Producers are only called when needed to set a cache, and are usually not needed when there's a cache hit.

The proposal of this library is to make it easier to manage producers and how keys are fetched/saved to redis.

Features:

- there's easily configurable resilience against producer failures:
  - timeout
  - retry with exponential backoff, and [decorrelated jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
  - circuit breaker
- optionally set redis ttl for produced values
- optionally ignoring cached values and forcing values refresh
- optionally refreshing keys in background. Useful when you want keys to be updated before their ttl would evict them.
- optionally producing values in background, while returning the cached value, even on cache misses
- builtin RTA for prometheus

## Usage

### Cache instance

If the `circuitBreaker` config is not provided this cache instance simply will not have a circuit breaker flow, and will still be usable.

I recommend to instantiate a cache for each service you consume, or else the circuit breaker would be shared. Which in turn could mean that a failing service would open the circuit for working services too.

```js
const Redis = require('ioredis');
const { Cache } = require('stable-cache');

const redis = new Redis({
  port: 6379,
  host: 'redis', // localhost
});

const cache = new Cache({
  redis, // required to inject a redis client
  options: { // everything is optional from here
    name: 'someService', // name of the service the cache will handle, useful for RTA
    circuitBreaker: { // circuit breaker config for the service
      // percentage of failing producer requests to trigger the circuit breaker
      threshold: 0.2,
      // time window to be considered by the threshold, in milliseconds
      duration: 10000,
      // attempt to half open the circuit after this time in milliseconds
      halfOpenAfter: 20000,
      // don't open the circuit if there's less than this amount of RPS.
      // This avoids opening the circuit, during failures in low load periods.
      minimumRps: 5,
    },
  },
});
```

### Cache.get method

Only the `key` argument is required. Other options are used to augment the producer flow. See more usage examples at `lib/examples/cache-get-usage.js`

Cache get options are:

> NOTE: circuit breaker policy is configured only when instantiating the `Cache` class.

| Option | Description | Default Behavior | Default Value |
| -: | :- | :- | :- |
| `producer` | A function that will be called when the source of the truth of the key is needed, has the signature `function(): Promise<string>` | No producer to call | `null` |
| `ttl` | Time in milliseconds for the redis key ttl, in case the producer resolves | No ttl set | `null` |
| `producerRetry` | Object configuration for the exponential backoff | No retry | `null` |
| `producerRetry.maxDelay` | Max amount of delay between retry attempts, in milliseconds | - | `30000` |
| `producerRetry.maxAttempts` | Max amount of retries for the producer | - | `10` |
| `producerRetry.initialDelay` | Initial delay, in milliseconds before the retry | - | `128` |
| `producerTimeout` | Timeout in milliseconds for the producer. Even if there's a timeout, if the producer eventually resolves, the key will be set in background so it would be best if you configure a greater timeout on the producer itself, together with this config | No timeout | `null` |
| `returnEarlyFromCache` | Whether to return the cached value, and make the producer call on background, on cache miss | Await the producer on cache miss | `false` |
| `overrideCache` | Whether to ignore cached values and request producer, regardless of cache hits | Don't ignore cache hits, and call producer only if needed | `false` |
| `shouldRefreshKey` | A callback that if returns `true`, calls the producer and sets the key on background. Has the signature `function(key, currentTTL, options): boolean` | No automatic refresh of keys | `null` |

Example of all the configs:

```js
function producer() {
  return new Promise((resolve) => {
    setTimeout(() => resolve('some-value'), 2000);
  });
}

cache.get(
  'some^key', // required redis key to get
  { // optional configs
    producer,
    ttl: 1000,
    producerRetry: {
      maxDelay: 30000,
      maxAttempts: 10,
      initialDelay: 128
    },
    producerTimeout: 1000,
    returnEarlyFromCache: false,
    overrideCache: false,
    shouldRefreshKey(key, currentTTL, options) {
      if (!options.ttl || currentTTL <= 0) {
        return false;
      }
      // options.ttl is the usually configured ttl for the given key
      const halfLife = options.ttl / 2;
      // refresh key if currentTTL is 50% below the initial ttl
      return currentTTL <= halfLife;
    }
  },
);
```

### Cache.set method

Sets a key with a value, and receives an optional ttl for the key.


Cache set options:

| Option | Description | Default Behavior | Default Value |
| -: | :- | :- | :- |
| `ttl` | Time in milliseconds for the redis key ttl | No ttl set | `null` |

Example:

```js
// sets `some^key` with value `a-value` with ttl of 30 seconds
cache.set(
  'some^key', // required key
  'a-value', // required value
  { // optional configs
    ttl: 30000, // 30 seconds
  }
);
```

## Prometheus Exporter

There's an exporter for prometheus that exposes the following metrics

- `cache_results_count`: counts cache hits/misses, with labels: `['service', 'operation', 'result']`
- `cache_operations_duration_seconds`: histogram for cache RT, with labels: `['service', 'operation']`
- `cache_operations_count`: counts cache operations made, with labels: `['service', 'operation']`
- `producer_operations_duration_seconds`: histogram with RT for producer calls, with labels: `['service']`
- `producer_operations_result_count`: counts the successes/errors for producer calls, with labels: `['service', 'result']`
- `producer_circuit_break_state`: gauge for the state of a service circuit breaker. A value of `0` means the circuit is closed (working normally), and a value of `1` means the circuit is open (fail fast is activated).

What labels mean?

- `service`: is the cache `name` option
- cache `operation`: type of redis operation, e.g. `set`, `get`.
- cache `result`: cache `hit` or `miss`
- producer `result`: `success`, or `error`

### Usage

Prometheus exporter options for the constructor are:

| Option | Description | Default Behavior | Default Value |
| -: | :- | :- | :- |
| `prefix` | Prefix to be added to every exported metric | No prefix added | `''` |
| `registers` | Array of prometheus registers to which metrics should be exported | Use default `prom-client` register | `[Prometheus.register]` |
| `cacheBuckets` | Array of numbers, representing the histogram buckets for cache RT | Use default value | `Prometheus.exponentialBuckets(0.05, 2, 8)` |
| `producerBuckets` | Array of numbers, representing the histogram buckets for producer RT | Use default value | `Prometheus.exponentialBuckets(0.1, 2, 8)` |

Example:

```js
const Prometheus = require('prom-client');
const { PrometheusExporter } = require('stable-cache');

const exporter = new PrometheusExporter({
  prefix: 'my_app_',
  registers: [Prometheus.register],
  cacheBuckets: Prometheus.exponentialBuckets(0.05, 2, 8),
  producerBuckets: Prometheus.exponentialBuckets(0.1, 2, 8),
});

exporter.collectMetrics(); // start collecting metrics
```
