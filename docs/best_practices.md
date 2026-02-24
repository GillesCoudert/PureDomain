# PureDomain Development Guide

> **Note**: This guide is designed for both human developers and AI coding agents. It provides clear, actionable rules for working with PureDomain.

## Core Principles

PureDomain is a TypeScript framework for building domain models following Domain-Driven Design (DDD) principles. It leverages:

- **Zod**: For schema validation
- **PureTrace**: For functional error handling with `Result` types
- **TypeScript**: For compile-time safety
- **Immutability**: All domain objects are immutable

### Key Rules

1. **Never mutate domain objects directly** - Always use factory methods and `patch()` to create new instances
2. **Always validate inputs** - Use Zod schemas for type and business rule validation
3. **Handle results functionally** - Check `isSuccess()` or `isFailure()` before accessing values
4. **Express constraints through types** - Use `updateSchema` and `validateUpdate` to enforce domain rules

## API Reference

### Creating Entities

**Signature:**

```typescript
createPureEntity<TSchema, TUpdateSchema, TId>(
    schema: TSchema,
    updateSchema?: TUpdateSchema,
    validateUpdate?: UpdateValidator<TSchema, TUpdateSchema>,
    identifierExtractor?: IdentifierExtractor<TSchema, TId>
): EntityClass
```

**Parameters:**

1. `schema` - Full Zod schema describing all entity properties
2. `updateSchema` (optional) - Zod schema defining what fields can be updated
    - **Omit**: Entity is fully mutable (all fields can be updated)
    - **`z.never()`**: Entity is completely immutable (patch() becomes unusable)
    - **Partial schema**: Only specified fields can be modified
3. `validateUpdate` (optional) - Function for business rule validation
4. `identifierExtractor` (optional) - Function to extract identifier (defaults to `id` property)

**Usage Patterns:**

```typescript
// Fully mutable entity (default)
const Product = createPureEntity(ProductSchema);

// Restricted updates
const User = createPureEntity(UserSchema, UserUpdateSchema);

// Immutable entity (value object pattern)
const Money = createPureEntity(MoneySchema, z.never());

// With business validation
const Order = createPureEntity(
    OrderSchema,
    OrderUpdateSchema,
    validateOrderUpdate,
);

// Custom identifier
const Article = createPureEntity(
    ArticleSchema,
    undefined,
    undefined,
    (props) => `${props.namespace}:${props.slug}`,
);
```

### Creating Aggregate Roots

**Signature:**

```typescript
createPureAggregateRoot<TSchema, TUpdateSchema, TId, TEventClass>(
    schema: TSchema,
    updateSchema?: TUpdateSchema,
    validateUpdate?: UpdateValidator<TSchema, TUpdateSchema>,
    identifierExtractor?: IdentifierExtractor<TSchema, TId>
): AggregateRootClass
```

**Parameters:** Same as entities, plus support for domain events.

**Additional Methods:**

- `addEvent(event: TEventClass)` - Adds a domain event
- `clearEvents()` - Clears all domain events
- `domainEvents` - Read-only array of uncommitted events

### Creating Value Objects

**Signature:**

```typescript
createPureValueObject<TSchema>(schema: TSchema): ValueObjectClass
```

Value objects are **always immutable** and compared by **structural equality** (not identity).

### Creating Domain Events

**Signature:**

```typescript
createPureDomainEvent<TPayloadSchema>(
    eventName: string,
    payloadSchema: TPayloadSchema
): DomainEventClass
```

Events are immutable facts that represent something meaningful that happened in the domain.

## Immutability Patterns

### When to Use `z.never()` (Completely Immutable)

✅ **Use for:**

- Value objects (Money, Email, Address, etc.)
- Published/archived aggregates (articles, closed orders)
- Domain events stored as entities
- Historical records (audit logs, snapshots)

```typescript
// Value object - never changes
const Money = createPureEntity(MoneySchema, z.never());

// Published article - cannot be modified after publication
const PublishedArticle = createPureAggregateRoot(ArticleSchema, z.never());
```

### When to Use Restricted Updates

✅ **Use for:**

- Entities with specific modifiable fields
- Status-based workflows
- Entities where some fields are readonly

```typescript
// Users can only change email and name, not role or createdAt
const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
});

const User = createPureEntity(UserSchema, UserUpdateSchema);
```

### When to Use Full Mutability

✅ **Use for:**

- Draft entities (still being constructed)
- Administrative entities
- When flexibility is needed

```typescript
// Draft can be freely modified
const Draft = createPureEntity(DraftSchema);
```

## Business Rule Validation

### Using `validateUpdate` Function

The `validateUpdate` parameter allows you to enforce domain logic that cannot be expressed through Zod schemas alone.

**Signature:**

```typescript
type UpdateValidator<TSchema, TUpdateSchema> = (
    current: z.infer<TSchema>,
    updates: z.infer<TUpdateSchema>,
) => Result<void>;
```

**When to Use:**

- State transition validation (e.g., cannot ship unconfirmed order)
- Cross-field validation (e.g., discount cannot exceed price)
- Time-based constraints (e.g., cannot cancel after deadline)
- Quantity/quota checks

**Example:**

```typescript
import { generateFailure, Success } from '@gilles-coudert/pure-trace';

const validateOrderUpdate: UpdateValidator<
    typeof OrderSchema,
    typeof OrderUpdateSchema
> = (current, updates) => {
    // Cannot ship an unconfirmed order
    if (updates.status === 'shipped' && current.status !== 'confirmed') {
        return generateFailure(
            'cannotShipUnconfirmedOrder',
            'Order must be confirmed before shipping',
        );
    }

    // Status can only move forward
    const statusOrder = ['draft', 'confirmed', 'shipped', 'delivered'];
    if (
        updates.status &&
        statusOrder.indexOf(updates.status) <=
            statusOrder.indexOf(current.status)
    ) {
        return generateFailure(
            'invalidStatusTransition',
            'Cannot transition to a previous status',
        );
    }

    return new Success(undefined);
};
```

## Working with Results

All factory methods (`create`, `patch`) return `Result<T>` from PureTrace. **Never access `.value` without checking success first.**

### Checking Results

```typescript
const result = User.create(data);

if (result.isSuccess()) {
    const user = result.value; // ✅ Safe
    // Use user
} else {
    console.error(result.errors); // Array of Error objects
}
```

### Functional Composition

Use PureTrace's functional methods for chaining operations:

```typescript
const result = User.create(data)
    .chainSuccess((user) => user.patch({ status: 'active' }))
    .chainSuccess((activeUser) =>
        activeUser.patch({ email: 'new@example.com' }),
    )
    .mapSuccess((finalUser) => {
        console.log('User activated:', finalUser);
        return finalUser;
    });
```

### Error Codes

Use `generateFailure` with descriptive camelCase error codes:

```typescript
return generateFailure(
    'invalidStatusTransition', // Error code
    'Cannot transition from draft to delivered', // Human-readable message
);
```

## DDD Patterns

### Entities vs Value Objects

**Entities:**

- Have a unique identifier
- Identity is important (compared by ID)
- Can be mutable (depending on design)
- Example: User, Order, Article

**Value Objects:**

- No unique identifier
- Compared by structure (value equality)
- Always immutable
- Example: Money, Email, Address, DateRange

### Aggregate Root Responsibilities

An aggregate root should:

1. **Maintain transactional consistency** within its boundary
2. **Emit domain events** when significant changes occur
3. **Enforce invariants** across contained entities
4. **Serve as the entry point** for all modifications

```typescript
class Order extends BaseOrder {
    /**
     * Adds an item to the order.
     * Enforces business rules and emits events.
     */
    addItem(item: OrderItem) {
        // Validate business rules
        if (this.properties.status !== 'draft') {
            return generateFailure(
                'cannotModifyConfirmedOrder',
                'Cannot add items to a confirmed order',
            );
        }

        // Calculate new total
        const newTotal = this.properties.total + item.price * item.quantity;

        // Update and emit event
        return this.patch({
            items: [...this.properties.items, item],
            total: newTotal,
        }).mapSuccess((updated) => {
            const eventResult = OrderItemAddedEvent.create({
                orderId: this.identifier,
                item,
            });

            if (eventResult.isSuccess()) {
                return updated.addEvent(eventResult.value);
            }
            return updated;
        });
    }
}
```

### Domain Events

Emit events when:

- An aggregate is created
- State transitions occur
- Significant business actions happen
- Other bounded contexts need to react

**Pattern:**

```typescript
// 1. Define event schema
const UserCreatedPayloadSchema = z.object({
    userId: z.string(),
    email: z.string(),
});

// 2. Create event class
const UserCreatedEvent = createPureDomainEvent(
    'UserCreated',
    UserCreatedPayloadSchema,
);

// 3. Emit from aggregate
class User extends BaseUser {
    static override create(data: z.infer<typeof UserSchema>) {
        return super.create(data).mapSuccess((user) => {
            const eventResult = UserCreatedEvent.create({
                userId: user.identifier,
                email: user.properties.email,
            });

            if (eventResult.isSuccess()) {
                return user.addEvent(eventResult.value);
            }
            return user;
        });
    }
}
```

## Repository Pattern

Repositories are responsible for:

- Persistence and retrieval of aggregates
- Converting between domain objects and persistence models
- Handling queries and collections

**Structure:**

```typescript
interface Repository<T> {
    save(entity: T): Promise<Result<void>>;
    findById(id: string): Promise<Result<T | null>>;
    delete(id: string): Promise<Result<void>>;
}

class UserRepository implements Repository<User> {
    private storage = new Map<string, User>();

    async save(user: User): Promise<Result<void>> {
        this.storage.set(user.identifier, user);
        return new Success(undefined);
    }

    async findById(id: string): Promise<Result<User | null>> {
        const user = this.storage.get(id) || null;
        return new Success(user);
    }

    async delete(id: string): Promise<Result<void>> {
        this.storage.delete(id);
        return new Success(undefined);
    }

    // Domain-specific queries
    async findByEmail(email: string): Promise<Result<User | null>> {
        const user =
            Array.from(this.storage.values()).find(
                (u) => u.properties.email === email,
            ) || null;
        return new Success(user);
    }
}
```

## Common Patterns

### Timestamps Pattern

```typescript
const EntitySchema = z.object({
    id: z.string(),
    // ... other fields
    createdAt: z.date(),
    updatedAt: z.date(),
});

class Entity extends BaseEntity {
    static override create(
        data: Omit<z.infer<typeof EntitySchema>, 'createdAt' | 'updatedAt'>,
    ) {
        const now = new Date();
        return super.create({
            ...data,
            createdAt: now,
            updatedAt: now,
        });
    }

    override patch(updates: Partial<z.infer<typeof EntityUpdateSchema>>) {
        return super.patch({
            ...updates,
            updatedAt: new Date(),
        });
    }
}
```

### Soft Delete Pattern

```typescript
const EntitySchema = z.object({
    id: z.string(),
    // ... other fields
    deletedAt: z.date().nullable(),
});

class Entity extends BaseEntity {
    softDelete() {
        return this.patch({ deletedAt: new Date() });
    }

    restore() {
        return this.patch({ deletedAt: null });
    }

    isDeleted(): boolean {
        return this.properties.deletedAt !== null;
    }
}
```

### Status Lifecycle Pattern

```typescript
const statusTransitions: Record<Status, Status[]> = {
    draft: ['published', 'archived'],
    published: ['archived'],
    archived: [],
};

const validateStatusUpdate: UpdateValidator<
    typeof ArticleSchema,
    typeof ArticleUpdateSchema
> = (current, updates) => {
    if (updates.status) {
        const allowedTransitions = statusTransitions[current.status];
        if (!allowedTransitions.includes(updates.status)) {
            return generateFailure(
                'invalidStatusTransition',
                `Cannot transition from ${current.status} to ${updates.status}`,
            );
        }
    }
    return new Success(undefined);
};
```

## Type Safety Rules

### Compile-Time Guarantees

The type system prevents invalid operations:

```typescript
const immutable = createPureEntity(Schema, z.never());
immutable.patch({}); // ❌ TypeScript error: never type

const restricted = createPureEntity(Schema, UpdateSchema);
restricted.patch({ role: 'admin' }); // ❌ TypeScript error: role not in UpdateSchema

const mutable = createPureEntity(Schema);
mutable.patch({ role: 'admin' }); // ✅ OK if role is in Schema
```

### Always Check Results

```typescript
// ❌ NEVER do this
const user = User.create(data).value; // Unsafe!

// ✅ ALWAYS do this
const result = User.create(data);
if (result.isSuccess()) {
    const user = result.value; // Safe
}
```

## Testing Guidelines

### Unit Testing Entities

```typescript
import { describe, it, expect } from '@jest/globals';

describe('User Entity', () => {
    it('should create a valid user', () => {
        const result = User.create({
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
        });

        expect(result.isSuccess()).toBe(true);
        if (result.isSuccess()) {
            expect(result.value.identifier).toBe('user-1');
            expect(result.value.properties.email).toBe('test@example.com');
        }
    });

    it('should reject invalid email', () => {
        const result = User.create({
            id: 'user-1',
            email: 'invalid-email',
            name: 'Test User',
        });

        expect(result.isFailure()).toBe(true);
    });

    it('should update allowed fields only', () => {
        const user = User.create(validData).value;
        const updated = user.patch({ email: 'new@example.com' });

        expect(updated.isSuccess()).toBe(true);
    });
});
```

### Testing Business Rules

```typescript
it('should enforce status transition rules', () => {
    const order = Order.create({ status: 'draft', ... }).value;

    // Valid transition
    const confirmed = order.patch({ status: 'confirmed' });
    expect(confirmed.isSuccess()).toBe(true);

    // Invalid transition
    const invalid = order.patch({ status: 'delivered' });
    expect(invalid.isFailure()).toBe(true);
    expect(invalid.errors[0].code).toBe('invalidStatusTransition');
});
```

## Performance Considerations

### Object Creation

Every `patch()` creates a new instance. This is by design for immutability. For high-frequency updates:

- Batch multiple changes into a single `patch()` call
- Consider using a builder pattern for complex construction

```typescript
// ❌ Multiple patches (creates many objects)
let user = User.create(data).value;
user = user.patch({ name: 'New Name' }).value;
user = user.patch({ email: 'new@email.com' }).value;

// ✅ Single patch (creates one object)
const updated = user.patch({
    name: 'New Name',
    email: 'new@email.com',
});
```

### Event Accumulation

Clear domain events after processing to prevent memory leaks:

```typescript
// After persisting or publishing events
const clearedAggregate = aggregate.clearEvents();
await repository.save(clearedAggregate);
```

## Summary Checklist

When implementing with PureDomain:

- [ ] Define Zod schemas for all domain objects
- [ ] Use `createPureEntity` for entities with identity
- [ ] Use `createPureValueObject` for value objects
- [ ] Use `createPureAggregateRoot` for aggregate roots
- [ ] Specify `updateSchema` to restrict what can be modified
- [ ] Use `z.never()` for immutable entities
- [ ] Implement `validateUpdate` for business rules
- [ ] Emit domain events for significant state changes
- [ ] Always check `Result` before accessing values
- [ ] Use functional composition (`chainSuccess`, `mapSuccess`)
- [ ] Write tests for validation and business rules
- [ ] Clear events after processing
