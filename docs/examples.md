# Examples

## Simple Entity without Restrictions

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

const ProductSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    price: z.number().positive(),
});

// Entity with default 'id' extraction and full mutability
const Product = createPureEntity(ProductSchema);

const productResult = Product.create({
    id: 'prod-1',
    name: 'Laptop',
    price: 999.99,
});

if (productResult.isSuccess()) {
    const product = productResult.value;
    console.log(product.identifier); // 'prod-1'
    console.log(product.properties.name); // 'Laptop'

    // Update the product
    const updatedResult = product.patch({ price: 1099.99 });
    if (updatedResult.isSuccess()) {
        console.log(updatedResult.value.properties.price); // 1099.99
    }
}
```

## Entity with Restricted Updates

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

// Full schema
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['user', 'admin']),
    createdAt: z.date(),
});

// Only email and name can be updated
const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
});

const User = createPureEntity(UserSchema, UserUpdateSchema);

const userResult = User.create({
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'john@example.com',
    name: 'John Doe',
    role: 'user',
    createdAt: new Date(),
});

if (userResult.isSuccess()) {
    const user = userResult.value;

    // This works - email is in updateSchema
    const updated = user.patch({ email: 'newemail@example.com' });

    // This would be a TypeScript error - role is not in updateSchema
    // const invalid = user.patch({ role: 'admin' });
}
```

## Entity with Business Rule Validation

```typescript
import { z } from 'zod';
import {
    createPureEntity,
    type UpdateValidator,
} from '@gilles-coudert/pure-domain';
import { generateFailure, Success } from '@gilles-coudert/pure-trace';

const OrderSchema = z.object({
    id: z.string(),
    status: z.enum(['draft', 'confirmed', 'shipped', 'delivered']),
    total: z.number().positive(),
});

const OrderUpdateSchema = z.object({
    status: z.enum(['confirmed', 'shipped', 'delivered']).optional(),
});

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

    // Cannot go backwards in status
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

const Order = createPureEntity(
    OrderSchema,
    OrderUpdateSchema,
    validateOrderUpdate,
);

const orderResult = Order.create({
    id: 'order-1',
    status: 'draft',
    total: 100,
});

if (orderResult.isSuccess()) {
    const order = orderResult.value;

    // This works
    const confirmed = order.patch({ status: 'confirmed' });

    // This fails validation - cannot ship unconfirmed order
    const invalid = order.patch({ status: 'shipped' });
    if (invalid.isFailure()) {
        console.log(invalid.errors[0].code); // 'cannotShipUnconfirmedOrder'
    }
}
```

## Immutable Entity with z.never()

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

const MoneySchema = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
});

// Completely immutable entity (value object pattern)
const Money = createPureEntity(MoneySchema, z.never());

const moneyResult = Money.create({ amount: 100, currency: 'USD' });

if (moneyResult.isSuccess()) {
    const money = moneyResult.value;
    console.log(money.properties.amount); // 100

    // This is a TypeScript compilation error
    // money.patch({ amount: 200 });
    // Error: Argument of type '{ amount: number }' is not assignable to parameter of type 'never'
}
```

## Entity with Timestamps and Soft Delete Pattern

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

// Manually compose schema with timestamps
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
});

const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    updatedAt: z.date().optional(),
    deletedAt: z.date().nullable().optional(),
});

const BaseUser = createPureEntity(UserSchema, UserUpdateSchema);

// Extend to add domain methods
class User extends BaseUser {
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
        });
    }

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
     * Override patch to automatically update the updatedAt timestamp.
     */
    override patch(updates: Partial<z.infer<typeof UserUpdateSchema>>) {
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

## Custom Identifier Extraction

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

const ArticleSchema = z.object({
    namespace: z.string(),
    slug: z.string(),
    title: z.string(),
    content: z.string(),
});

// Custom identifier: namespace:slug
const Article = createPureEntity(
    ArticleSchema,
    undefined,
    undefined,
    (props) => `${props.namespace}:${props.slug}`,
);

const articleResult = Article.create({
    namespace: 'blog',
    slug: 'hello-world',
    title: 'Hello World',
    content: 'This is my first post',
});

if (articleResult.isSuccess()) {
    console.log(articleResult.value.identifier); // 'blog:hello-world'
}
```

## Value Object

```typescript
import { z } from 'zod';
import { createPureValueObject } from '@gilles-coudert/pure-domain';

const EmailSchema = z.object({
    value: z.string().email(),
});

// Value objects are immutable by nature
const Email = createPureValueObject(EmailSchema);

const emailResult = Email.create({ value: 'john@example.com' });

if (emailResult.isSuccess()) {
    const email = emailResult.value;
    console.log(email.properties.value); // 'john@example.com'

    // Value objects are compared by value, not identity
    const email2Result = Email.create({ value: 'john@example.com' });
    if (email2Result.isSuccess()) {
        console.log(email.equals(email2Result.value)); // true
    }
}
```

## Aggregate Root with Domain Events

```typescript
import { z } from 'zod';
import {
    createPureAggregateRoot,
    createPureDomainEvent,
} from '@gilles-coudert/pure-domain';

// Define event payload schema
const OrderCreatedPayloadSchema = z.object({
    orderId: z.string(),
    customerId: z.string(),
    total: z.number(),
});

// Create domain event class
const OrderCreatedEvent = createPureDomainEvent(
    'OrderCreated',
    OrderCreatedPayloadSchema,
);

// Define aggregate root schema
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
    status: z.enum(['draft', 'confirmed', 'shipped']),
});

// Define update schema to restrict what can be changed
const OrderUpdateSchema = z.object({
    status: z.enum(['confirmed', 'shipped']).optional(),
});

// Create base aggregate root
const BaseOrder = createPureAggregateRoot<
    typeof OrderSchema,
    typeof OrderUpdateSchema,
    string,
    InstanceType<typeof OrderCreatedEvent>
>(OrderSchema, OrderUpdateSchema);

// Extend to add domain logic
class Order extends BaseOrder {
    /**
     * Creates a new order and adds the OrderCreated event.
     */
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
                return result.mapSuccess(() =>
                    order.addEvent(eventResult.value),
                );
            }
        }

        return result;
    }

    /**
     * Confirms the order.
     */
    confirm() {
        return this.patch({ status: 'confirmed' });
    }

    /**
     * Ships the order (only if confirmed).
     */
    ship() {
        if (this.properties.status !== 'confirmed') {
            return generateFailure(
                'orderNotConfirmed',
                'Order must be confirmed before shipping',
            );
        }
        return this.patch({ status: 'shipped' });
    }
}

// Usage
const orderResult = Order.create({
    id: 'order-1',
    customerId: 'customer-1',
    items: [{ productId: 'prod-1', quantity: 2, price: 999.99 }],
    total: 1999.98,
    status: 'draft',
});

if (orderResult.isSuccess()) {
    const order = orderResult.value;
    console.log(order.domainEvents.length); // 1
    console.log(order.domainEvents[0].eventName); // 'OrderCreated'

    // Confirm and process
    const confirmed = order.confirm();
    if (confirmed.isSuccess()) {
        // Clear events after processing
        const cleared = confirmed.value.clearEvents();
    }
}
```

## Functional Composition with Results

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';

const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    status: z.enum(['pending', 'active', 'suspended']),
});

const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    status: z.enum(['active', 'suspended']).optional(),
});

const User = createPureEntity(UserSchema, UserUpdateSchema);

const userResult = User.create({
    id: 'user-1',
    email: 'user@example.com',
    status: 'pending',
});

// Chain multiple updates using PureTrace's functional composition
const updated = userResult
    .chainSuccess((user) => user.patch({ status: 'active' }))
    .chainSuccess((activeUser) =>
        activeUser.patch({ email: 'newemail@example.com' }),
    )
    .mapSuccess((finalUser) => {
        console.log('User updated:', finalUser.properties);
        return finalUser;
    });

if (updated.isFailure()) {
    console.error('Update failed:', updated.errors);
}
```

## Using in Repository (Clean Architecture)

```typescript
import { z } from 'zod';
import { createPureEntity } from '@gilles-coudert/pure-domain';
import type { Result } from '@gilles-coudert/pure-trace';

// Define User with soft delete pattern
const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.date(),
    deletedAt: z.date().nullable(),
});

const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    deletedAt: z.date().nullable().optional(),
});

// Repository interface
interface Repository<T> {
    save(entity: T): Promise<Result<void>>;
    findById(id: string): Promise<Result<T | null>>;
}

// User repository implementation
class UserRepository implements Repository<User> {
    private users = new Map<string, User>();

    async save(user: User): Promise<Result<void>> {
        this.users.set(user.identifier, user);
        return new Success(undefined);
    }

    async findById(id: string): Promise<Result<User | null>> {
        const user = this.users.get(id) || null;
        return new Success(user);
    }

    async findActive(): Promise<Result<User[]>> {
        const activeUsers = Array.from(this.users.values()).filter(
            (user) => user.properties.deletedAt === null,
        );
        return new Success(activeUsers);
    }

    async softDelete(userId: string): Promise<Result<void>> {
        const userResult = await this.findById(userId);

        return userResult.chainSuccess((user) => {
            if (!user) {
                return generateFailure('userNotFound', 'User not found');
            }

            const deletedResult = user.patch({ deletedAt: new Date() });
            return deletedResult.chainSuccess((deleted) => this.save(deleted));
        });
    }
}
```
