const Bluebird = require('bluebird');
const express = require('express');
const Prometheus = require('prom-client');

const Cache = require('../classes/cache');
const Redis = require('./redis');
const PrometheusExporter = require('../classes/prometheus-exporter');

const app = express();

const PORT = 3000;

let cache;
const exporter = new PrometheusExporter();
exporter.collectMetrics();

async function success(time, value) {
  return Bluebird.delay(time || 1)
    .then(() => value);
}

async function fail(time) {
  return Bluebird.delay(time || 1)
    .then(() => {
      throw new Error('failed!');
    });
}

function getRandomInBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.get('/success', async (req, res) => {
  console.log('GET /success');
  const producer = () => success(getRandomInBetween(150, 750), 'some key value');
  try {
    const value = await cache.get(
      'service',
      {
        producer,
        ttl: 1000,
        producerRetry: { maxDelay: 5000, maxAttempts: 5 },
        producerTimeout: 1000,
      },
    );
    res.json({ value });
  } catch (err) {
    console.log('err', err);
    res.status(500).json({ err });
  }
});

app.get('/failure', async (req, res) => {
  console.log('GET /failure');
  const producer = () => fail(1);
  try {
    const value = await cache.get(
      'service',
      {
        producer,
        ttl: 1000,
        producerRetry: { maxDelay: 5000, maxAttempts: 5 },
        producerTimeout: 1000,
      },
    );
    res.json({ value });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

app.get('/metrics', (req, res) => {
  console.log('GET /metrics');
  res.set('Content-Type', Prometheus.register.contentType);
  return res.end(Prometheus.register.metrics());
});


Redis.connect()
  .then(() => {
    cache = new Cache({
      redis: Redis.redis,
      options: {
        name: 'testService',
        circuitBreaker: {
          threshold: 0.2,
          duration: 10000,
          halfOpenAfter: 20000,
        },
      },
    });
    app.listen(PORT, () => {
      console.log(`listening on port ${PORT}`);
    });
  });
