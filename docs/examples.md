# Examples

## Basic Entity with Timestamps and Soft Delete

```typescript
import { z } from 'zod';
import {
    createPureEntity,
    buildSchema,
    type HasSoftDelete,
} from '@gilles-coudert/pure-domain';

// Define your base schema and extend it with timestamps and soft delete
const UserSchema = buildSchema(
    z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
    }),
)
    .withCreatedAt()
    .withUpdatedAt()
    .withSoftDelete()
    .build();

// Create entity class
const BaseUser = createPureEntity(UserSchema, (props) => props.id);

// Extend the class to implement soft delete capability
class User extends BaseUser implements HasSoftDelete {
    /**
     * Marks the user as soft-deleted.
     */
    softDelete() {
        return this.patch({ deletedAt: new Date(), updatedAt: new Date() });
    }

    /**
     * Restores a soft-deleted user.
     */
    restore() {
        return this.patch({ deletedAt: null, updatedAt: new Date() });
    }

    /**
     * Checks if the user is currently soft-deleted.
     */
    isDeleted(): boolean {
        return this.properties.deletedAt !== null;
    }

    /**
     * Static method to create a new user with automatic timestamps.
     */
    static override create(
        data: Omit<
            z.infer<typeof UserSchema>,
            'createdAt' | 'updatedAt' | 'deletedAt'
        >,
    ) {
        const now = new Date();
        return super.create({
            ...data,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        } as z.infer<typeof UserSchema>);
    }

    /**
     * Override patch to automatically update the updatedAt timestamp.
     */
    override patch(updates: Partial<z.infer<typeof UserSchema>>) {
        return super.patch({
            ...updates,
            updatedAt: new Date(),
        });
    }
}

// Usage
const userResult = User.create({
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'john@example.com',
    name: 'John Doe',
});

if (userResult.isSuccess()) {
    const user = userResult.value;
    console.log(user.properties.createdAt); // Current date
    console.log(user.isDeleted()); // false

    // Soft delete the user
    const deletedResult = user.softDelete();
    if (deletedResult.isSuccess()) {
        console.log(deletedResult.value.isDeleted()); // true
    }
}
```

## Using Individual Schema Extensions

```typescript
import { z } from 'zod';
import {
    createPureEntity,
    withCreatedAt,
    withUpdatedAt,
} from '@gilles-coudert/pure-domain';

// Compose schema extensions manually
const ProductSchema = withUpdatedAt(
    withCreatedAt(
        z.object({
            id: z.string(),
            name: z.string().min(1),
            price: z.number().positive(),
        }),
    ),
);

const Product = createPureEntity(ProductSchema, (props) => props.id);
```

## Simple Entity without Timestamps

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

const ProductSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    price: z.number().positive(),
});

const Product = createPureEntity(ProductSchema, (props) => props.id);

const productResult = Product.create({
    id: 'prod-1',
    name: 'Laptop',
    price: 999.99,
});
```

## Value Object

```typescript
import { z } from 'zod';
import { createPureValueObject } from '@gilles-coudert/pure-domain';

const EmailSchema = z.object({
    value: z.string().email(),
});

const Email = createPureValueObject(EmailSchema);

const emailResult = Email.create({ value: 'john@example.com' });
```

## Aggregate Root with Events

```typescript
import { z } from 'zod';
import {
    createPureAggregateRoot,
    createPureDomainEvent,
} from '@gilles-coudert/pure-domain';

// Define event
const OrderCreatedPayloadSchema = z.object({
    orderId: z.string(),
    customerId: z.string(),
    total: z.number(),
});

const OrderCreatedEvent = createPureDomainEvent(
    'OrderCreated',
    OrderCreatedPayloadSchema,
);

// Define aggregate root
const OrderSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    items: z.array(
        z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().positive(),
        }),
    ),
    total: z.number(),
});

const BaseOrder = createPureAggregateRoot<
    typeof OrderSchema,
    string,
    InstanceType<typeof OrderCreatedEvent>
>(OrderSchema, (props) => props.id);

class Order extends BaseOrder {
    static override create(data: z.infer<typeof OrderSchema>) {
        const result = super.create(data);

        if (result.isSuccess()) {
            const order = result.value;
            const eventResult = OrderCreatedEvent.create({
                orderId: data.id,
                customerId: data.customerId,
                total: data.total,
            });

            if (eventResult.isSuccess()) {
                order.addEvent(eventResult.value);
            }
        }

        return result;
    }
}

// Usage
const orderResult = Order.create({
    id: 'order-1',
    customerId: 'customer-1',
    items: [{ productId: 'prod-1', quantity: 2, price: 999.99 }],
    total: 1999.98,
});

if (orderResult.isSuccess()) {
    const order = orderResult.value;
    console.log(order.domainEvents); // Contains OrderCreatedEvent
}
```

## Using in Repository (Clean Architecture)

```typescript
import type { HasSoftDelete } from '@gilles-coudert/pure-domain';

// Repository for soft-deletable entities
class UserRepository {
    async softDelete(user: HasSoftDelete) {
        const result = user.softDelete();
        if (result.isSuccess()) {
            await this.persist(result.value);
        }
        return result;
    }

    async findActive<T extends HasSoftDelete>(entities: T[]): T[] {
        return entities.filter((e) => !e.isDeleted());
    }

    private async persist(entity: unknown) {
        // Persistence logic
    }
}
```
