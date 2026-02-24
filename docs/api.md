# PureDomain API Reference

Complete reference documentation for PureDomain TypeScript API.

## Table of Contents

- [Entities](#entities)
    - [createPureEntity](#createpureentity)
    - [PureEntity Interface](#pureentity-interface)
- [Value Objects](#value-objects)
    - [createPureValueObject](#createpurevalueobject)
    - [PureValueObject Interface](#purevalueobject-interface)
- [Aggregate Roots](#aggregate-roots)
    - [createPureAggregateRoot](#createpureaggregateroot)
    - [PureAggregateRoot Interface](#pureaggregateroot-interface)
- [Domain Events](#domain-events)
    - [createPureDomainEvent](#createpuredomainevent)
    - [DomainEvent Interface](#domainevent-interface)
- [Type Utilities](#type-utilities)
    - [IdentifierExtractor](#identifierextractor)
    - [UpdateValidator](#updatevalidator)

---

## Entities

### createPureEntity

Factory function for creating Entity classes with validation and identity management.

**Signature:**

```typescript
function createPureEntity<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TUpdateSchema extends z.ZodObject<z.ZodRawShape> =
        z.ZodObject<z.ZodRawShape>,
    TId = unknown,
>(
    schema: TSchema,
    updateSchema?: TUpdateSchema,
    validateUpdate?: UpdateValidator<TSchema, TUpdateSchema>,
    identifierExtractor?: IdentifierExtractor<TSchema, TId>,
): EntityClass;
```

**Parameters:**

| Parameter             | Type                                      | Required | Default               | Description                                                                            |
| --------------------- | ----------------------------------------- | -------- | --------------------- | -------------------------------------------------------------------------------------- |
| `schema`              | `z.ZodObject<z.ZodRawShape>`              | Yes      | -                     | Full Zod schema describing all entity properties                                       |
| `updateSchema`        | `z.ZodObject<z.ZodRawShape>`              | No       | Same as `schema`      | Zod schema defining what fields can be updated. Use `z.never()` for immutable entities |
| `validateUpdate`      | `UpdateValidator<TSchema, TUpdateSchema>` | No       | `undefined`           | Function for business rule validation during updates                                   |
| `identifierExtractor` | `IdentifierExtractor<TSchema, TId>`       | No       | `(props) => props.id` | Function to extract the identifier from properties                                     |

**Returns:**

An Entity class with the following static and instance methods:

**Static Methods:**

- `create(data: z.infer<TSchema>): Result<PureEntity<TSchema, TId>>` - Creates a new entity instance

**Instance Properties:**

- `identifier: TId` - The unique identifier
- `properties: z.infer<TSchema>` - The entity properties

**Instance Methods:**

- `patch(updates: Partial<z.infer<TUpdateSchema>>): Result<PureEntity<TSchema, TId>>` - Creates a new entity with updated properties
- `equals(other: PureEntity<TSchema, TId>): boolean` - Compares entities by identifier
- `toString(): string` - Returns string representation

**Examples:**

```typescript
// Basic entity with default 'id' extraction
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
});

const User = createPureEntity(UserSchema);
```

```typescript
// Entity with restricted updates
const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
});

const User = createPureEntity(UserSchema, UserUpdateSchema);
```

```typescript
// Immutable entity
const Money = createPureEntity(MoneySchema, z.never());
```

```typescript
// Entity with business validation
const validateOrderUpdate: UpdateValidator<
    typeof OrderSchema,
    typeof OrderUpdateSchema
> = (current, updates) => {
    if (updates.status === 'shipped' && current.status !== 'confirmed') {
        return generateFailure('cannotShipUnconfirmedOrder');
    }
    return new Success(undefined);
};

const Order = createPureEntity(
    OrderSchema,
    OrderUpdateSchema,
    validateOrderUpdate,
);
```

```typescript
// Custom identifier extraction
const Article = createPureEntity(
    ArticleSchema,
    undefined,
    undefined,
    (props) => `${props.namespace}:${props.slug}`,
);
```

---

### PureEntity Interface

Interface representing an entity instance.

```typescript
interface PureEntity<TSchema extends z.ZodObject<z.ZodRawShape>, TId> {
    readonly identifier: TId;
    readonly properties: z.infer<TSchema>;

    equals(other: PureEntity<TSchema, TId>): boolean;
    toString(): string;
}
```

**Properties:**

- `identifier: TId` (readonly) - The unique identifier of the entity
- `properties: z.infer<TSchema>` (readonly) - The underlying properties

**Methods:**

- `equals(other: PureEntity<TSchema, TId>): boolean` - Compares this entity with another based on identifier
- `toString(): string` - Returns a string representation containing class name and identifier

---

## Value Objects

### createPureValueObject

Factory function for creating Value Object classes with immutability and validation.

**Signature:**

```typescript
function createPureValueObject<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema,
): ValueObjectClass;
```

**Parameters:**

| Parameter | Type                         | Required | Description               |
| --------- | ---------------------------- | -------- | ------------------------- |
| `schema`  | `z.ZodObject<z.ZodRawShape>` | Yes      | Zod schema for validation |

**Returns:**

A Value Object class with the following static and instance methods:

**Static Methods:**

- `create(data: z.infer<TSchema>): Result<PureValueObject<TSchema>>` - Creates a new value object instance

**Instance Properties:**

- `properties: z.infer<TSchema>` - The value object properties

**Instance Methods:**

- `equals(other: PureValueObject<TSchema>): boolean` - Compares value objects by structural equality

**Examples:**

```typescript
const EmailSchema = z.object({
    value: z.string().email(),
});

const Email = createPureValueObject(EmailSchema);

const emailResult = Email.create({ value: 'user@example.com' });
if (emailResult.isSuccess()) {
    const email = emailResult.value;
    console.log(email.properties.value);
}
```

```typescript
const MoneySchema = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
});

const Money = createPureValueObject(MoneySchema);

const money1 = Money.create({ amount: 100, currency: 'USD' }).value;
const money2 = Money.create({ amount: 100, currency: 'USD' }).value;

console.log(money1.equals(money2)); // true (structural equality)
```

---

### PureValueObject Interface

Interface representing a value object instance.

```typescript
interface PureValueObject<TSchema extends z.ZodObject<z.ZodRawShape>> {
    readonly properties: z.infer<TSchema>;

    equals(other: PureValueObject<TSchema>): boolean;
}
```

**Properties:**

- `properties: z.infer<TSchema>` (readonly) - The underlying properties

**Methods:**

- `equals(other: PureValueObject<TSchema>): boolean` - Compares this value object with another for structural equality

---

## Aggregate Roots

### createPureAggregateRoot

Factory function for creating Aggregate Root classes with validation, identity, and event management.

**Signature:**

```typescript
function createPureAggregateRoot<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TUpdateSchema extends z.ZodObject<z.ZodRawShape> =
        z.ZodObject<z.ZodRawShape>,
    TId = unknown,
    TEventClass = unknown,
>(
    schema: TSchema,
    updateSchema?: TUpdateSchema,
    validateUpdate?: UpdateValidator<TSchema, TUpdateSchema>,
    identifierExtractor?: IdentifierExtractor<TSchema, TId>,
): AggregateRootClass;
```

**Parameters:**

Same as `createPureEntity`, plus support for domain events via the `TEventClass` generic parameter.

**Returns:**

An Aggregate Root class with the following static and instance methods:

**Static Methods:**

- `create(data: z.infer<TSchema>): Result<PureAggregateRoot<TSchema, TId, TEventClass>>` - Creates a new aggregate root instance

**Instance Properties:**

- `identifier: TId` - The unique identifier
- `properties: z.infer<TSchema>` - The aggregate properties
- `domainEvents: ReadonlyArray<TEventClass>` - Uncommitted domain events

**Instance Methods:**

- `patch(updates: Partial<z.infer<TUpdateSchema>>): Result<PureAggregateRoot<TSchema, TId, TEventClass>>` - Updates properties (preserves events)
- `addEvent(event: TEventClass): PureAggregateRoot<TSchema, TId, TEventClass>` - Adds a domain event
- `clearEvents(): PureAggregateRoot<TSchema, TId, TEventClass>` - Clears all domain events
- `equals(other: PureAggregateRoot<TSchema, TId, TEventClass>): boolean` - Compares aggregates by identifier
- `toString(): string` - Returns string representation

**Examples:**

```typescript
const OrderSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    status: z.enum(['draft', 'confirmed', 'shipped']),
    total: z.number(),
});

const OrderUpdateSchema = z.object({
    status: z.enum(['confirmed', 'shipped']).optional(),
});

const BaseOrder = createPureAggregateRoot<
    typeof OrderSchema,
    typeof OrderUpdateSchema,
    string,
    InstanceType<typeof OrderCreatedEvent>
>(OrderSchema, OrderUpdateSchema);

class Order extends BaseOrder {
    static override create(data: z.infer<typeof OrderSchema>) {
        return super.create(data).mapSuccess((order) => {
            const eventResult = OrderCreatedEvent.create({
                orderId: order.identifier,
                total: data.total,
            });

            if (eventResult.isSuccess()) {
                return order.addEvent(eventResult.value);
            }
            return order;
        });
    }
}
```

---

### PureAggregateRoot Interface

Interface representing an aggregate root instance.

```typescript
interface PureAggregateRoot<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TId,
    TEventClass = unknown,
> {
    readonly identifier: TId;
    readonly properties: z.infer<TSchema>;
    readonly domainEvents: ReadonlyArray<TEventClass>;

    addEvent(event: TEventClass): PureAggregateRoot<TSchema, TId, TEventClass>;
    clearEvents(): PureAggregateRoot<TSchema, TId, TEventClass>;
    equals(other: PureAggregateRoot<TSchema, TId, TEventClass>): boolean;
    toString(): string;
}
```

**Properties:**

- `identifier: TId` (readonly) - The unique identifier
- `properties: z.infer<TSchema>` (readonly) - The aggregate properties
- `domainEvents: ReadonlyArray<TEventClass>` (readonly) - All uncommitted domain events

**Methods:**

- `addEvent(event: TEventClass): PureAggregateRoot<TSchema, TId, TEventClass>` - Returns a new aggregate with the event added
- `clearEvents(): PureAggregateRoot<TSchema, TId, TEventClass>` - Returns a new aggregate without events
- `equals(other: PureAggregateRoot<TSchema, TId, TEventClass>): boolean` - Compares aggregates by identifier
- `toString(): string` - Returns string representation

---

## Domain Events

### createPureDomainEvent

Factory function for creating Domain Event classes with validation.

**Signature:**

```typescript
function createPureDomainEvent<
    TPayloadSchema extends z.ZodObject<z.ZodRawShape>,
>(eventName: string, payloadSchema: TPayloadSchema): DomainEventClass;
```

**Parameters:**

| Parameter       | Type                         | Required | Description                                 |
| --------------- | ---------------------------- | -------- | ------------------------------------------- |
| `eventName`     | `string`                     | Yes      | The unique name/type of the event           |
| `payloadSchema` | `z.ZodObject<z.ZodRawShape>` | Yes      | Zod schema for validating the event payload |

**Returns:**

A Domain Event class with the following static method:

**Static Methods:**

- `create(payload: z.infer<TPayloadSchema>): Result<DomainEvent>` - Creates a new domain event instance

**Instance Properties:**

- `eventName: string` - The event name/type
- `occurredOn: Date` - When the event occurred (automatically set)
- `payload: z.infer<TPayloadSchema>` - The event payload data

**Examples:**

```typescript
const UserCreatedPayloadSchema = z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
});

const UserCreatedEvent = createPureDomainEvent(
    'UserCreated',
    UserCreatedPayloadSchema,
);

const eventResult = UserCreatedEvent.create({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
});

if (eventResult.isSuccess()) {
    const event = eventResult.value;
    console.log(event.eventName); // 'UserCreated'
    console.log(event.occurredOn); // Current date
    console.log(event.payload.userId);
}
```

---

### DomainEvent Interface

Type helper to extract the domain event class type from a factory.

```typescript
type DomainEvent<TPayloadSchema extends z.ZodObject<z.ZodRawShape>> =
    ReturnType<typeof createPureDomainEvent<TPayloadSchema>>;
```

**Usage:**

```typescript
const MyEvent = createPureDomainEvent('MyEvent', PayloadSchema);
type MyEventInstance = InstanceType<typeof MyEvent>;
```

---

## Type Utilities

### IdentifierExtractor

Function type for extracting an identifier from entity properties.

**Signature:**

```typescript
type IdentifierExtractor<TSchema extends z.ZodObject<z.ZodRawShape>, TId> = (
    properties: z.infer<TSchema>,
) => TId;
```

**Example:**

```typescript
const extractCompositeId: IdentifierExtractor<typeof ArticleSchema, string> = (
    props,
) => `${props.namespace}:${props.slug}`;

const Article = createPureEntity(
    ArticleSchema,
    undefined,
    undefined,
    extractCompositeId,
);
```

---

### UpdateValidator

Function type for validating entity updates with business rules.

**Signature:**

```typescript
type UpdateValidator<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TUpdateSchema extends z.ZodObject<z.ZodRawShape>,
> = (
    current: z.infer<TSchema>,
    updates: z.infer<TUpdateSchema>,
) => Result<void>;
```

**Example:**

```typescript
const validateStatusTransition: UpdateValidator<
    typeof OrderSchema,
    typeof OrderUpdateSchema
> = (current, updates) => {
    if (updates.status === 'shipped' && current.status !== 'confirmed') {
        return generateFailure(
            'cannotShipUnconfirmedOrder',
            'Order must be confirmed before shipping',
        );
    }
    return new Success(undefined);
};

const Order = createPureEntity(
    OrderSchema,
    OrderUpdateSchema,
    validateStatusTransition,
);
```

---

## Error Handling

All factory methods (`create`, `patch`) return `Result<T>` from PureTrace. Always check success before accessing values:

```typescript
const result = User.create(data);

if (result.isSuccess()) {
    const user = result.value;
    // Use user safely
} else {
    console.error('Validation errors:', result.errors);
}
```

## Type Safety

TypeScript will prevent invalid operations at compile time:

```typescript
const immutable = createPureEntity(Schema, z.never());
immutable.patch({}); // ❌ TypeScript error: never type

const restricted = createPureEntity(Schema, UpdateSchema);
restricted.patch({ unauthorizedField: 'value' }); // ❌ TypeScript error
```

---

## See Also

- [Best Practices](best_practices.md) - Development guide for humans and AI agents
- [Examples](examples.md) - Practical examples and patterns
