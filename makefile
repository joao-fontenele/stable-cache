.PHONY: build
build:
	docker-compose build
	docker-compose run --rm --no-deps npm i

.PHONY: run
run:
	docker-compose run --rm app sh

.PHONY: redis
redis:
	docker-compose exec redis redis-cli
