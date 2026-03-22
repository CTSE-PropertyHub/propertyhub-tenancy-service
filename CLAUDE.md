# propertyhub-tenancy-service

Node.js 22 / Express 4 microservice managing tenancy agreements.

## Run locally
```bash
npm install
npm start
# or
docker build -t propertyhub-tenancy-service .
docker run -p 3000:3000 propertyhub-tenancy-service
```

## Security model
Trusts `X-User-Id` and `X-User-Role` headers injected by the gateway. No JWT validation.

## Endpoints
| Method | Path | Roles |
|--------|------|-------|
| GET | /health | Anonymous |
| GET | /tenancy | Any authenticated |
| GET | /tenancy/:id | Landlord/Tenant involved, or Admin |
| POST | /tenancy | Landlord |
| PATCH | /tenancy/:id/status | Landlord (owner) or Admin |
| DELETE | /tenancy/:id | Admin |

## Storage
In-memory `Map` — data is lost on restart.
