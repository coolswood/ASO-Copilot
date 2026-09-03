.PHONY: start-web stop-web

start-web:
	docker compose up -d db
	bun run dev

stop-web:
	docker compose down
