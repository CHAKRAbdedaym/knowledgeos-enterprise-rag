.PHONY: up down logs seed evaluate test frontend-check backend-test migrate
up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

migrate:
	docker compose exec backend alembic upgrade head

seed:
	python3 scripts/seed.py

evaluate:
	python3 scripts/evaluate.py

backend-test:
	cd backend && .venv/bin/python -m pytest -q

frontend-check:
	cd frontend && npm run lint && npm run typecheck && npm run test && npm run build

test: backend-test frontend-check

.PHONY: real-services-test portal-setup enterprise-acceptance gemini-verify
real-services-test:
	backend/.venv/bin/python scripts/test_real_services.py

portal-setup:
	backend/.venv/bin/python scripts/setup_demo_portal.py
	docker compose up -d --no-deps --force-recreate intranet

enterprise-acceptance:
	backend/.venv/bin/python scripts/enterprise_acceptance.py

gemini-verify:
	docker compose exec backend python -m app.verify_gemini
