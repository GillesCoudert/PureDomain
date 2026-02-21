# PureDomain

> TypeScript framework for building business domains following Domain-Driven Design (DDD) principles,
> built on top of PureTrace for functional error handling and Zod for schema validation.

## Why PureDomain ?

- **Pure Domain Models**: Focus on business logic without infrastructure concerns
- **Type-Safe**: Full TypeScript support with Zod schema validation
- **Functional Error Handling**: Leverages PureTrace for composable error management
- **DDD-First**: Designed specifically for Domain-Driven Design patterns
- **Framework Agnostic**: Use with any persistence or application layer

## PureDomain in the PureFramework

PureDomain is part of the **PureFramework** ecosystem:

```
┌─────────────────────────────────────────┐
│         Application Layer               │
├─────────────────────────────────────────┤
│         PureDomain (this package)       │
│    - Entities & Aggregate Roots         │
│    - Value Objects                      │
│    - Domain Events                      │
├─────────────────────────────────────────┤
│         PureTrace (Error Handling)      │
└─────────────────────────────────────────┘
```

## Quick Start

```typescript
import {
    createPureEntity,
    createPureAggregateRoot,
    createPureDomainEvent,
} from '@gilles-coudert/pure-domain';
import { z } from 'zod';

// Define your schema
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
});

// Create your entity
const User = createPureEntity(UserSchema, (props) => props.id);

// Use it
const userResult = User.create({
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    name: 'John Doe',
});

if (userResult.isSuccess) {
    console.log('User created:', userResult.value.properties.name);
}
```

## Core Concepts

### Entities

Entities are domain objects distinguished by their unique identity rather than their properties.

```typescript
const Order = createPureEntity(OrderSchema, (props) => props.id);
```

### Aggregate Roots

Aggregate Roots manage transactional consistency within aggregate boundaries and can emit domain events.

```typescript
const User = createPureAggregateRoot(UserSchema, (props) => props.id);
```

### Value Objects

Value Objects are immutable domain objects identified by their properties.

```typescript
const Money = createPureValueObject(MoneySchema);
```

### Domain Events

Model important business events that occur within your domain.

```typescript
const UserCreated = createPureDomainEvent({
    name: 'UserCreated',
    schema: z.object({
        userId: z.string(),
        email: z.string(),
    }),
});
```

### Capabilities

Use capability interfaces to describe optional domain features:

```typescript
import type { HasOwnership } from '@gilles-coudert/pure-domain';

interface AdminUser extends HasOwnership {
    // ...
}
```

## Advanced documentation

- [Best practices](docs/best_practices.md)
- [Examples](docs/examples.md)

## Contributing

Contributions are welcome.

### Mandatory branch naming

Branch prefixes are **required** and define the semantic impact of the change:

- `upgrade/` → breaking changes (major version)
- `us/` → new features (minor version)
- `fix/` → bug fixes (patch version)

### Why not Conventional Commits?

Versioning information belongs to the **branch**, not individual commits.

Branches express intent and scope.
Commits should stay frequent, descriptive, and free of artificial prefixes that often degrade into `wip:` or `chore:` without semantic value.

## License

This project is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

## Author

**Gilles Coudert**

- Email: [pure.framework@gmail.com](mailto:pure.framework@gmail.com)
- GitHub: [https://github.com/GillesCoudert](https://github.com/GillesCoudert)

## Links
