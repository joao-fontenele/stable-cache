const Redis = require('./clients/redis');

async function main() {
  await Redis.connect();

  const redis = Redis.getRedis();
  console.log('conected');
  await redis.set('test', 'hello world!');
  console.log('set done');
}

main()
  .then(() => console.log('main exited successfully'))
  .catch((err) => console.log('main error', err));
