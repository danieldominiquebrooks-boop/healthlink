# Auth Testing Playbook — My Healthcare Link

Admin (JWT): danieldominiquebrooks@gmail.com / HealthLink@2026!

## API test
```
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"danieldominiquebrooks@gmail.com","password":"HealthLink@2026!"}'
# → { access_token, token_type, user }

TOKEN=<access_token>
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer $TOKEN"
```

## Admin CRUD (all require Bearer token)
- providers, services, categories, articles, events: GET/POST /api/admin/<entity>, PUT/DELETE /api/admin/<entity>/{id}
- reviews: GET /api/admin/reviews?status=pending, PUT /api/admin/reviews/{id}/status?status=approved, DELETE /api/admin/reviews/{id}

## Public
- GET /api/providers (filters: island, specialty, category, in_network, q, sort)
- POST /api/reviews (public submission → status=pending)
- GET /api/reviews?provider_id=... (approved only)
