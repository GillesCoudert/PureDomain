import type { Result } from '@gilles-coudert/pure-trace';
import { pureZodParse, Success } from '@gilles-coudert/pure-trace';
import { type z } from 'zod';
import type { IdentifierExtractor, UpdateValidator } from './entity.js';

//>
//> > fr: Interface pour les instances d'agrégat créées par une factory.
//> > en: Interface for aggregate root instances created by a factory.
//>
export interface PureAggregateRoot<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TId,
    TEventClass = unknown,
> {
    /**
     * The unique identifier of the aggregate.
     */
    readonly identifier: TId;

    /**
     * The underlying properties of the aggregate.
     */
    readonly properties: z.infer<TSchema>;

    /**
     * All uncommitted domain events.
     */
    readonly domainEvents: ReadonlyArray<TEventClass>;

    /**
     * Adds a domain event from this aggregate.
     *
     * @param event - The event to add
     * @returns A new aggregate root instance with the event added
     */
    addEvent(event: TEventClass): PureAggregateRoot<TSchema, TId, TEventClass>;

    /**
     * Clears all domain events from this aggregate root.
     *
     * @returns A new aggregate root instance without events
     */
    clearEvents(): PureAggregateRoot<TSchema, TId, TEventClass>;

    /**
     * Compares this aggregate with another for equality based on ID.
     *
     * @param other - The aggregate to compare with
     * @returns True if both aggregates have the same identifier
     */
    equals(other: PureAggregateRoot<TSchema, TId, TEventClass>): boolean;

    /**
     * Returns a string representation of the aggregate.
     *
     * @returns A string containing the aggregate root class name and identifier
     */
    toString(): string;
}

/**
 * Factory for creating Aggregate Root classes with validation, identity, and event management.
 *
 * Aggregate Roots are domain objects that serve as entry points to aggregates and maintain
 * transactional consistency. Like Entities, they support optional update validation.
 *
 * @template TSchema - The Zod schema for aggregate properties
 * @template TUpdateSchema - The Zod schema for aggregate updates (use z.never() for immutable aggregates)
 * @template TId - The identifier type
 * @template TEventClass - The type of domain events that can be added
 * @param schema - The Zod schema for aggregate properties
 * @param updateSchema - Optional schema restricting what can be updated. Use z.never() for immutable aggregates
 * @param validateUpdate - Optional function to validate updates with business rules
 * @param identifierExtractor - Optional function to extract the identifier. Defaults to extracting the 'id' property
 * @returns An Aggregate Root class
 *
 * @example
 * ```typescript
 * // Basic mutable aggregate (assumes 'id' property)
 * const OrderSchema = z.object({
 *     id: z.string().uuid(),
 *     customerId: z.string(),
 *     status: z.enum(['draft', 'confirmed', 'shipped']),
 *     items: z.array(ItemSchema)
 * });
 *
 * const Order = createPureAggregateRoot(OrderSchema);
 *
 * // Immutable aggregate (useful for archived/published aggregates)
 * const PublishedOrder = createPureAggregateRoot(
 *     OrderSchema,
 *     z.never() // Never allow modifications
 * );
 *
 * // Aggregate with restricted updates and business validation
 * const OrderUpdateSchema = z.object({
 *     status: z.enum(['confirmed', 'shipped'])
 * });
 *
 * const Order = createPureAggregateRoot(
 *     OrderSchema,
 *     OrderUpdateSchema,
 *     (current, updates) => {
 *         if (updates.status === 'shipped' && current.status !== 'confirmed') {
 *             return generateFailure('cannotShipUnconfirmedOrder');
 *         }
 *         return new Success(undefined);
 *     }
 * );
 *
 * // Custom identifier extraction
 * const customAggregate = createPureAggregateRoot(
 *     Schema,
 *     undefined,
 *     undefined,
 *     (props) => `${props.namespace}:${props.name}`
 * );
 * ```
 */
export function createPureAggregateRoot<
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
): {
    new (
        properties: z.infer<TSchema>,
    ): PureAggregateRoot<TSchema, TId, TEventClass>;
    create(
        data: z.infer<TSchema>,
    ): Result<PureAggregateRoot<TSchema, TId, TEventClass>>;
} {
    /**
     * Represents an Aggregate Root in Domain-Driven Design.
     * Aggregate Roots are entities that serve as the entry point to an aggregate
     * and maintain transactional consistency within the aggregate boundary.
     *
     * Immutability is expressed through the updateSchema parameter:
     * - Omitted: Aggregate is fully mutable
     * - z.never(): Aggregate is completely immutable
     * - Partial schema: Only specified fields can be modified
     */
    return class AggregateRoot {
        /**
         * The unique identifier of the aggregate.
         */
        readonly identifier: TId;

        /**
         * The underlying properties of the aggregate.
         */
        readonly properties: z.infer<TSchema>;

        /**
         * All uncommitted domain events.
         */
        readonly domainEvents: ReadonlyArray<TEventClass>;

        constructor(
            properties: z.infer<TSchema>,
            events: ReadonlyArray<TEventClass> = [],
        ) {
            this.properties = { ...(properties as object) } as z.infer<TSchema>;
            const idExtractor: IdentifierExtractor<TSchema, TId> =
                identifierExtractor ||
                ((props: z.infer<TSchema>) =>
                    (props as Record<string, TId>).id);
            this.identifier = idExtractor(this.properties);
            this.domainEvents = [...events];
        }

        /**
         * Creates a new aggregate root instance from raw data.
         *
         * @param data - The data to create the aggregate from
         * @returns A Result containing the aggregate root or validation errors
         */
        static create(
            data: z.infer<TSchema>,
        ): Result<PureAggregateRoot<TSchema, TId, TEventClass>> {
            return pureZodParse(data, schema).mapSuccess(
                (validatedData) =>
                    new Success(
                        new AggregateRoot(validatedData) as PureAggregateRoot<
                            TSchema,
                            TId,
                            TEventClass
                        >,
                    ),
            );
        }

        /**
         * Creates a new aggregate root by patching this one.
         * Returns a new aggregate root instance with updated properties.
         * Preserves existing domain events.
         *
         * Updates are validated against the updateSchema (if provided) and
         * business rules (if validateUpdate is provided).
         *
         * @param updates - Partial updates to apply
         * @returns A Result containing the updated aggregate root or validation/business rule errors
         *
         * @example
         * ```typescript
         * const order = Order.create({ id: '123', status: 'draft' });
         *
         * const updated = order
         *     .patch({ status: 'confirmed' })
         *     .mapSuccess((updated) =>
         *         updated.patch({ status: 'shipped' })
         *     );
         * ```
         */
        patch(
            updates: TUpdateSchema extends z.ZodNever
                ? never
                : Partial<z.infer<TUpdateSchema>>,
        ): Result<PureAggregateRoot<TSchema, TId, TEventClass>> {
            const effectiveUpdateSchema =
                updateSchema || (schema as unknown as TUpdateSchema);

            return pureZodParse(updates, effectiveUpdateSchema)
                .chainSuccess((validatedUpdates) => {
                    if (validateUpdate) {
                        return validateUpdate(
                            this.properties,
                            validatedUpdates as z.infer<TUpdateSchema>,
                        ).chainSuccess(() => {
                            const mergedData = {
                                ...(this.properties as object),
                                ...(validatedUpdates as object),
                            };
                            return pureZodParse(mergedData, schema);
                        });
                    }
                    const mergedData = {
                        ...(this.properties as object),
                        ...(validatedUpdates as object),
                    };
                    return pureZodParse(mergedData, schema);
                })
                .mapSuccess(
                    (validatedData) =>
                        new Success(
                            new AggregateRoot(
                                validatedData,
                                this.domainEvents,
                            ) as PureAggregateRoot<TSchema, TId, TEventClass>,
                        ),
                );
        }

        /**
         * Adds a domain event to this aggregate root.
         * Returns a new aggregate root instance with the event added.
         *
         * @param event - The domain event to add
         * @returns A new aggregate root instance with the event
         */
        addEvent(event: TEventClass): AggregateRoot {
            const newEvents = [...this.domainEvents, event];
            return new AggregateRoot(this.properties, newEvents);
        }

        /**
         * Clears all domain events from this aggregate root.
         * Returns a new aggregate root instance without events.
         *
         * @returns A new aggregate root instance without events
         */
        clearEvents(): PureAggregateRoot<TSchema, TId, TEventClass> {
            return new AggregateRoot(this.properties, []) as PureAggregateRoot<
                TSchema,
                TId,
                TEventClass
            >;
        }

        /**
         * Compares this aggregate with another for equality based on ID.
         *
         * @param other - The aggregate to compare with
         * @returns True if both aggregates have the same identifier
         */
        equals(other: PureAggregateRoot<TSchema, TId, TEventClass>): boolean {
            return this.identifier === (other as AggregateRoot).identifier;
        }

        /**
         * Returns a string representation of the aggregate.
         *
         * @returns A string containing the aggregate root class name and identifier
         */
        toString(): string {
            return `${this.constructor.name}(${String(this.identifier)})`;
        }
    };
}
