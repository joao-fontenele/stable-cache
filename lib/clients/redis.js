const Bluebird = require('bluebird');
const Redis = require('ioredis'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = {
  redis: null,

  getRedis() {
    if (!this.redis) {
      this.redis = new Redis({
        port: 6379,
        host: 'redis',
      });
    }

    return this.redis;
  },

  connect() {
    return new Bluebird((resolve, reject) => {
      const redis = this.getRedis();
      redis.on('ready', resolve);
      redis.on('end', reject);
    });
  },

  disconnect() {
    return this.getRedis().quit();
  },
};
