# Multi-Tenant RBAC System with NestJS

Production-grade multi-tenant RBAC system built with NestJS, demonstrating expertise in backend architecture, security best practices, and scalable patterns.

## 🎯 Features

- **Multi-Tenancy**: Schema-per-tenant isolation using PostgreSQL
- **RBAC**: Fine-grained role-based access control with junction tables
- **JWT Authentication**: Secure authentication with refresh tokens
- **GraphQL + REST**: Dual API support for maximum flexibility
- **Event-Driven**: RabbitMQ for reliable message processing
- **Caching**: Redis for high-performance caching
- **Security**: Rate limiting, validation, audit logging
- **Production-Ready**: Docker, health checks, monitoring
- **Testing**: Comprehensive test coverage (unit, integration, e2e)
- **CI/CD**: Automated testing and deployment

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────▼───────────┐
           │    NestJS Backend     │
           │  ┌─────────────────┐  │
           │  │ REST + GraphQL  │  │
           │  │ JWT Auth + RBAC │  │
           │  │ Tenant Resolver │  │
           │  └─────────────────┘  │
           └─────┬────────┬────────┘
                 │        │
        ┌────────▼──┐  ┌──▼────────┐
        │PostgreSQL │  │  Redis     │
        │  (Multi-  │  │ (Cache +   │
        │  Schema)  │  │  Sessions) │
        └───────────┘  └────────────┘
                 │
        ┌────────▼──────────┐
        │    RabbitMQ       │
        │  (Event Streams)  │
        └───────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ifaisaldev/nestjs-multi-tenant-rbac.git
cd nestjs-multi-tenant-rbac

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start all services (PostgreSQL, Redis, RabbitMQ)
docker-compose up -d

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database (optional)
npm run prisma:seed

# Start development server
npm run start:dev
```

### Access Services

- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **PgAdmin**: http://localhost:5050 (admin@admin.com / admin)
- **RabbitMQ Management**: http://localhost:15672 (admin / admin)

## 📦 Tech Stack

### Core
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Next-generation ORM

### Database & Caching
- **PostgreSQL 16** - Relational database
- **Redis** - In-memory cache and sessions

### Messaging
- **RabbitMQ** - Message broker for events

### Authentication & Security
- **Passport JWT** - JWT authentication
- **bcrypt** - Password hashing
- **Helmet** - Security headers
- **class-validator** - Input validation
- **Throttler** - Rate limiting

### API
- **REST** - RESTful API with Swagger
- **GraphQL** - Apollo GraphQL server

### Architecture Patterns
- **CQRS** - Command Query Responsibility Segregation
- **Event-Driven** - Domain events and sagas
- **DDD** - Domain-Driven Design principles

### Testing
- **Jest** - Unit and integration tests
- **Supertest** - E2E API testing

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **GitHub Actions** - CI/CD pipeline

## 📋 Project Structure

```
├── src/
│   ├── auth/              # Authentication module (JWT, sessions)
│   ├── tenant/            # Multi-tenancy module
│   ├── rbac/              # Role-based access control
│   ├── users/             # User management
│   ├── config/            # Configuration files
│   ├── prisma/            # Prisma service
│   ├── health/            # Health checks
│   ├── common/            # Shared utilities
│   │   ├── decorators/    # Custom decorators
│   │   ├── guards/        # Auth guards
│   │   ├── interceptors/  # Interceptors
│   │   └── pipes/         # Validation pipes
│   ├── cqrs/              # CQRS implementation
│   ├── events/            # Event handlers
│   ├── graphql/           # GraphQL resolvers
│   ├── app.module.ts      # Main application module
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seeds/             # Seed data
├── test/                  # E2E tests
├── docker-compose.yml     # Docker services
├── Dockerfile             # Production Docker image
└── package.json           # Dependencies and scripts
```

## 🔐 RBAC Design

The system uses **junction tables** for flexible many-to-many relationships:

```
User ←→ UserRole ←→ Role
                     ↕
              RolePermission
                     ↕
                Permission
```

### Default Roles
- `SUPER_ADMIN` - Full system access
- `ADMIN` - Tenant administration
- `MANAGER` - Team management
- `USER` - Basic access

### Permission Format
```typescript
{
  resource: "users",  // e.g., users, products, orders
  action: "create"    // e.g., create, read, update, delete
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## 🔧 Development

```bash
# Development mode with hot-reload
npm run start:dev

# Debug mode
npm run start:debug

# Production mode
npm run start:prod

# Lint code
npm run lint

# Format code
npm run format
```

## 📊 Database Management

```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:prod

# Open Prisma Studio
npm run prisma:studio

# Seed database
npm run prisma:seed
```

## 🐳 Docker Commands

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs
```

## 🌐 API Documentation

Interactive API documentation is available via Swagger UI at `/api/docs` when the server is running.

### Key Endpoints

**Authentication**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

**Users**
- `GET /api/v1/users` - List users (paginated)
- `GET /api/v1/users/:id` - Get user details
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

**Roles**
- `GET /api/v1/roles` - List roles
- `POST /api/v1/roles` - Create role
- `POST /api/v1/roles/:id/permissions` - Assign permissions

## 🔒 Environment Variables

See `.env.example` for all available configuration options.

### Key Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `REDIS_HOST` - Redis server host
- `RABBITMQ_URL` - RabbitMQ connection URL

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes and commit: `git commit -m 'Add my feature'`
3. Push to the branch: `git push origin feature/my-feature`
4. Create a Pull Request

## 📝 License

MIT

## 👤 Author

**Faisal Mehmood**

- GitHub: [@ifaisaldev](https://github.com/ifaisaldev)
- Email: faisalmehmooddev@gmail.com

## 🙏 Acknowledgments

Built as a demonstration of:
- NestJS best practices
- Multi-tenant architecture patterns
- Production-ready backend systems
- Enterprise-grade security
- Scalable microservices design
