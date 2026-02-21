# PureDomain Best Practices

## Update Schemas and Immutability

One of the key features of PureDomain is the ability to express entity update constraints through the update schema parameter. This allows you to enforce domain rules at the type system level.

### Basic Usage

When creating an entity or aggregate root, you specify:

1. **Schema**: The ZodSchema describing the complete entity properties
2. **updateSchema**: Optional schema describing what can be updated (most commonly overridden)
3. **validateUpdate**: Optional function for additional business rule validation
4. **identifierExtractor**: Optional function to extract identifier (defaults to 'id' property)

```typescript
import { createPureEntity } from '@gilles-coudert/pure-domain';
import { z } from 'zod';

// Full schema for the entity
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    status: z.enum(['active', 'inactive']),
});

// Define what can be updated
const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
});

// Creates an entity with default 'id' extraction
const User = createPureEntity(UserSchema, UserUpdateSchema);
```

### Immutable Entities with z.never()

To declare an entity as completely immutable, use `z.never()` as the update schema:

```typescript
// Value Object - immutable by nature
const Money = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
});

// Pass z.never() as second parameter to make completely immutable
const MoneyEntity = createPureEntity(
    Money,
    z.never(), // ← Entity is completely immutable
);

// Type system prevents modifications
const money = MoneyEntity.create({ amount: 100, currency: 'USD' });
money.patch({}); // ❌ Compilation error: Argument of type '{}'
//    is not assignable to parameter of type 'never'
```

The `z.never()` type acts as a compile-time guarantee of immutability. It makes it impossible to call `patch()` with any arguments, effectively preventing modifications.

### Business Rule Validation

Use the `validateUpdate` parameter to enforce domain logic that cannot be expressed through Zod schemas alone:

```typescript
const OrderUpdateSchema = z.object({
    status: z.enum(['confirmed', 'shipped', 'delivered']),
    items: z.array(ItemSchema).optional(),
});

const validateOrderUpdate = (
    current: OrderProperties,
    updates: OrderUpdateProperties,
): Result<void> => {
    // Can't ship an unconfirmed order
    if (updates.status === 'shipped' && current.status !== 'confirmed') {
        return generateFailure(
            'cannotShipUnconfirmedOrder',
            'Order must be confirmed before shipping',
        );
    }

    // Can't have negative item quantities
    if (updates.items) {
        for (const item of updates.items) {
            if (item.quantity < 0) {
                return generateFailure(
                    'invalidQuantity',
                    'Quantity must be positive',
                );
            }
        }
    }

    return new Success(undefined);
};

const Order = createPureAggregateRoot(
    OrderSchema,
    OrderUpdateSchema,
    validateOrderUpdate,
);
```

### Functional Composition with Results

The `patch()` method returns a `Result`, allowing you to compose updates functionally:

```typescript
const order = await Order.create({
    id: '123',
    status: 'draft',
    items: [],
});

// Chain multiple updates
const updated = order
    .patch({ status: 'confirmed' })
    .chainSuccess((confirmed) => confirmed.patch({ items: newItems }))
    .mapSuccess((final) => {
        console.log('Order updated:', final.properties);
        return final;
    });

if (updated.isFailure) {
    console.error('Update failed:', updated.errors);
}
```

## When to Use Immutable Entities

### Good candidates for immutability:

1. **Value Objects**

    ```typescript
    const Address = z.object({
        street: z.string(),
        city: z.string(),
        zipCode: z.string(),
    });

    const AddressEntity = createPureEntity(Address, z.never());
    ```

2. **Published/Archived Aggregates**

    ```typescript
    // An article can't be modified after publication
    const PublishedArticle = createPureAggregateRoot(ArticleSchema, z.never());
    ```

3. **Domain Events** (when stored as entities)
    ```typescript
    // Events represent facts and cannot change
    const DomainEvent = createPureEntity(EventSchema, z.never());
    ```

### Good candidates for restricted updates:

1. **Status-based workflows**

    ```typescript
    const statusTransitions: Record<Status, Status[]> = {
        draft: ['published', 'archived'],
        published: ['archived'],
        archived: [],
    };

    // Only allow transitions to valid next states
    const ValidatedEntity = createPureEntity(
        EntitySchema,
        z.object({
            status: z.enum(statusTransitions[current.status]),
        }),
        validateStatusTransition,
    );
    ```

2. **Partial updates with business rules**
    ```typescript
    // Users can update email and name, but not id or createdAt
    const User = createPureEntity(
        UserSchema,
        z.object({
            email: z.string().email().optional(),
            name: z.string().optional(),
        }),
        validateUserUpdate,
    );
    ```

## DDD Patterns

### Aggregate Roots with Domain Events

Use aggregate roots to maintain consistency across multiple entities:

```typescript
const Order = createPureAggregateRoot(
    OrderSchema,
    OrderUpdateSchema,
    validateOrderUpdate,
);

// Add domain events when state changes
const orderCreated = Order.create(orderData).mapSuccess((order) =>
    order.addEvent(
        OrderCreated({
            orderId: order.identifier,
            customerId: order.properties.customerId,
            total: order.properties.total,
        }),
    ),
);
```

### Encapsulation Through Update Schemas

The update schema serves as a contract about what external code can modify on your aggregate:

```typescript
// Customers can only change their email and name
const CustomerAggregate = createPureAggregateRoot(
    CustomerSchema,
    z.object({
        email: z.string().email().optional(),
        name: z.string().optional(),
    }),
);

// The system can approve but not customers
const ApprovalAggregate = createPureAggregateRoot(
    ApprovalSchema,
    z.object({
        approvedAt: z.date().optional(),
        approvedBy: z.string().optional(),
    }),
);
```

## Error Handling

Always check `Result` states before using aggregates:

```typescript
const updated = entity.patch(updates);

if (updated.isSuccess) {
    const modifiedEntity = updated.value;
    // Use modifiedEntity
} else {
    // Handle validation or business rule errors
    for (const error of updated.errors) {
        console.log(`${error.code}: ${error.message}`);
    }
}
```

## Type Safety

The type system prevents invalid operations at compile time:

```typescript
const immutable = createPureEntity(Schema, z.never());
const mutable = createPureEntity(Schema);

immutable.patch({}); // ❌ Compiler error
mutable.patch({}); // ✅ OK (empty patch is valid)
```

This eliminates entire classes of bugs at development time.
