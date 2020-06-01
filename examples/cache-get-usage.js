/* eslint-disable @typescript-eslint/no-unused-vars */
const Redis = require('ioredis');
const { Cache } = require('../dist/index');

const redis = new Redis({
  port: 6379,
  host: 'redis', // localhost
});

const cache = new Cache({
  redis, // required to inject a redis client
  options: { // everyting is optional from here
    name: 'someService', // name of the service the cache will handle, useful for RTA
    circuitBreaker: { // circuit breaker config for the service
      // percentage of failing producer requests to trigger the circuit breaker
      threshold: 0.2,
      // time window to be considered by the threshold, in milliseconds
      duration: 10000,
      // attempt to half open the circuit after this time in milliseconds
      halfOpenAfter: 20000,
    },
  },
});

function resolveAfter(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

function producer() {
  console.log('producer called');
  return resolveAfter(500)
    .then(() => 'some-produced-value');
}

let callCount = 0;
async function producerRetry() {
  callCount += 1;
  // will log 3 times
  console.log(`producerRetry called ${callCount} times`);
  if (callCount > 2) {
    return 'some-produced-value';
  }

  throw new Error('Fail!');
}

function connectRedis() {
  return new Promise((resolve, reject) => {
    redis.on('ready', resolve);
    redis.on('end', reject);
  });
}

async function getVanilla() {
  // $ redis-cli set a-key-no-ttl some-value
  await redis.set('a-key-no-ttl', 'some-value');
  return cache.get('a-key-no-ttl')
    .then(console.log); // will log `some-value`
}

function getWithProducer() {
  return cache.get('a-key-with-producer', { producer })
    .then(console.log) // will log `some-produced-value`
    // await the background producer resolving and setting the redis key
    .then(() => resolveAfter(500))
    .then(() => cache.get('a-key-with-producer', { producer }))
    // cache hit!, will not call the producer again
    .then(console.log); // will log `some-produced-value`
}

function getWithTTL() {
  // set ttl to 10 seconds
  return cache.get('a-key-with-ttl', { producer, ttl: 10 * 1000 })
    .then(console.log); // will log `some-produced-value`

  // $ redis-cli get a-key-with-ttl
  // will return `some-produced-value`
  // $ redis-cli pttl a-key-with-ttl
  // will return current ttl in milliseconds
}

function getWithTimeout() {
  // sets producer timeout to 200 milliseconds, and producer resolves after 500
  return cache.get('a-key-with-timeout', { producer, producerTimeout: 200 })
    .then(console.log)
    .catch(console.log) // will log a timeout error
    // await the background producer resolving and setting the redis key
    .then(() => resolveAfter(500))
    .then(() => cache.get('a-key-with-timeout', { producer, producerTimeout: 200 }))
    // this time since the key was already set in redis (cache hit), will log
    // `some-produced-value`, and producer will not be called
    .then(console.log);
}

function getWithRetry() {
  // sets producer that will retry 2 times, with initial delay of 10 ms and max delay of 50 ms
  return cache.get('a-key-with-timeout', { producer: producerRetry, producerRetry: { maxAttempts: 2, initialDelay: 10, maxDelay: 50 } })
    .then(console.log); // will log `some-produced-value`
}

async function getWithOverrideCache() {
  await redis.set('a-key-with-override', 'this-value-will-not-be-logged');
  // will ignore cached values and will request producer regardless of cache hits
  return cache.get('a-key-with-override', { producer, overrideCache: true })
    // will log `some-produced-value` instead of the value set above
    .then(console.log);
}

async function getWithReturnEarlyFromCache() {
  return cache.get('a-key-with-return-early', { producer, returnEarlyFromCache: true })
    // will log `null` because the cached value was not set
    .then(console.log)
    .then(() => resolveAfter(500)) // await producer and set in background
    .then(() => cache.get('a-key-with-return-early', { producer, returnEarlyFromCache: true }))
    // this time since the key was already set in redis (cache hit), will log
    // `some-produced-value`, and producer will not be called
    .then(console.log);
}

async function getWithShouldRefreshKey() {
  function shouldRefreshKey(key, currentTTL, options) {
    console.log('key, currentTTL, options.ttl', key, currentTTL, options.ttl);
    if (!options.ttl || currentTTL <= 0) {
      return false;
    }
    // options.ttl is the usually configured ttl for the given key
    const halfLife = options.ttl / 2;
    // refresh key if currentTTL is 50% bellow the initial ttl
    return currentTTL <= halfLife;
  }

  // simulate a key with current ttl of 1 second
  await redis.set('a-key-with-refresh', 'some-outdated-value', 'PX', 1000);

  return cache.get('a-key-with-refresh', { producer, ttl: 2000, shouldRefreshKey })
    .then(console.log) // cache hit, will log `some-outdated-value`
    .then(() => resolveAfter(500)) // await producer and set in background
    .then(() => cache.get('a-key-with-refresh', { producer, ttl: 2000, shouldRefreshKey }))
    // cache hit again, but will have updated value of `some-produced-value`
    .then(console.log);
}

/**
 * Uncomment calls to test
 */
async function main() {
  // Vanilla redis get without producer
  // await getVanilla();

  // Get with producer flow
  // await getWithProducer();

  // Get with producer + set key ttl
  // await getWithTTL();

  // Get with producer + producer timeout
  // await getWithTimeout();

  // Get with producer + retry with exponential backoff
  // await getWithRetry();

  // Get with producer + override cache
  // await getWithOverrideCache();

  // Get with producer + return early from cache
  // await getWithReturnEarlyFromCache();

  // Get with producer + automatic background key refresh
  // await getWithShouldRefreshKey();
}

connectRedis()
  .then(redis.flushall())
  .then(main)
  .then(() => redis.disconnect());
