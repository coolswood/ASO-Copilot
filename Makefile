.PHONY: start-web stop-web

start-web:
	docker compose up -d
	npm run dev

stop-web:
	docker compose down
