import type { Result } from '@gilles-coudert/pure-trace';
import { pureZodParse, Success } from '@gilles-coudert/pure-trace';
import { type z } from 'zod';

/**
 * Function to extract the identifier from entity properties.
 *
 * @template TSchema - The Zod schema type
 * @template TId - The identifier type
 */
export type IdentifierExtractor<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TId,
> = (properties: z.infer<TSchema>) => TId;

/**
 * Function to validate entity updates with business rules.
 *
 * This function is called after schema validation to enforce domain-specific constraints
 * that cannot be expressed in Zod schemas alone.
 *
 * @template TSchema - The Zod schema type
 * @template TUpdateSchema - The Zod schema type for updates
 * @returns A Result indicating success or a business rule violation
 *
 * @example
 * ```typescript
 * const validateOrderUpdate = (
 *     current: OrderProperties,
 *     updates: OrderUpdateProperties,
 * ): Result<void> => {
 *     if (updates.status === 'shipped' && current.status !== 'confirmed') {
 *         return generateFailure('cannotShipUnconfirmedOrder');
 *     }
 *     return new Success(undefined);
 * };
 * ```
 */
export type UpdateValidator<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TUpdateSchema extends z.ZodObject<z.ZodRawShape>,
> = (
    current: z.infer<TSchema>,
    updates: z.infer<TUpdateSchema>,
) => Result<void>;

//>
//> > fr: Interface pour les instances d'entité créées par une factory.
//> > en: Interface for entity instances created by a factory.
//>
export interface PureEntity<TSchema extends z.ZodObject<z.ZodRawShape>, TId> {
    /**
     * The unique identifier of the entity.
     */
    readonly identifier: TId;

    /**
     * The underlying properties of the entity.
     */
    readonly properties: z.infer<TSchema>;

    /**
     * Compares this entity with another for equality based on ID.
     *
     * @param other - The entity to compare with
     * @returns True if both entities have the same identifier
     */
    equals(other: PureEntity<TSchema, TId>): boolean;

    /**
     * Returns a string representation of the entity.
     *
     * @returns A string containing the entity class name and identifier
     */
    toString(): string;
}

/**
 * Factory for creating Entity classes with validation and identity management.
 *
 * Entities are domain objects identified by their unique ID rather than their properties.
 * This factory creates type-safe entity classes with optional update validation.
 *
 * @template TSchema - The Zod schema for entity properties
 * @template TUpdateSchema - The Zod schema for entity updates (use z.never() for immutable entities)
 * @template TId - The identifier type
 * @param schema - The Zod schema for entity properties
 * @param updateSchema - Optional schema restricting what can be updated. Use z.never() for immutable entities
 * @param validateUpdate - Optional function to validate updates with business rules
 * @param identifierExtractor - Optional function to extract the identifier. Defaults to extracting the 'id' property
 * @returns An Entity class
 *
 * @example
 * ```typescript
 * // Basic mutable entity (assumes 'id' property)
 * const UserSchema = z.object({
 *     id: z.string().uuid(),
 *     email: z.string().email(),
 *     name: z.string()
 * });
 *
 * const User = createPureEntity(UserSchema);
 *
 * // Immutable entity (value object pattern)
 * const Money = createPureEntity(
 *     MoneySchema,
 *     z.never() // Never allow modifications
 * );
 *
 * // Entity with restricted updates and business validation
 * const OrderUpdateSchema = z.object({
 *     status: z.enum(['confirmed', 'shipped'])
 * });
 *
 * const Order = createPureEntity(
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
 * const customEntity = createPureEntity(
 *     Schema,
 *     undefined,
 *     undefined,
 *     (props) => `${props.namespace}:${props.name}`
 * );
 * ```
 */
export function createPureEntity<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TUpdateSchema extends z.ZodObject<z.ZodRawShape> =
        z.ZodObject<z.ZodRawShape>,
    TId = unknown,
>(
    schema: TSchema,
    updateSchema?: TUpdateSchema,
    validateUpdate?: UpdateValidator<TSchema, TUpdateSchema>,
    identifierExtractor?: IdentifierExtractor<TSchema, TId>,
): {
    new (properties: z.infer<TSchema>): PureEntity<TSchema, TId>;
    create(data: z.infer<TSchema>): Result<PureEntity<TSchema, TId>>;
} {
    /**
     * Represents an Entity in Domain-Driven Design.
     * Entities are identified by their unique ID rather than their properties.
     *
     * Immutability is expressed through the updateSchema parameter:
     * - Omitted: Entity is fully mutable
     * - z.never(): Entity is completely immutable
     * - Partial schema: Only specified fields can be modified
     */
    return class Entity {
        /**
         * The unique identifier of the entity.
         */
        readonly identifier: TId;

        /**
         * The underlying properties of the entity.
         */
        readonly properties: z.infer<TSchema>;

        constructor(properties: z.infer<TSchema>) {
            this.properties = { ...(properties as object) } as z.infer<TSchema>;
            const idExtractor: IdentifierExtractor<TSchema, TId> =
                identifierExtractor ||
                ((props: z.infer<TSchema>) =>
                    (props as Record<string, TId>).id);
            this.identifier = idExtractor(this.properties);
        }

        /**
         * Creates a new entity instance from raw data.
         *
         * @param data - The data to create the entity from
         * @returns A Result containing the entity or validation errors
         */
        static create(
            data: z.infer<TSchema>,
        ): Result<PureEntity<TSchema, TId>> {
            return pureZodParse(data, schema).mapSuccess(
                (validatedData) =>
                    new Success(
                        new Entity(validatedData) as PureEntity<TSchema, TId>,
                    ),
            );
        }

        /**
         * Creates a new entity by patching this one.
         * Returns a new entity instance with updated properties.
         *
         * Updates are validated against the updateSchema (if provided) and
         * business rules (if validateUpdate is provided).
         *
         * @param updates - Partial updates to apply
         * @returns A Result containing the updated entity or validation/business rule errors
         *
         * @example
         * ```typescript
         * const user = User.create({ id: '123', name: 'John' });
         *
         * const updated = user
         *     .patch({ name: 'Jane' })
         *     .mapSuccess((updated) =>
         *         updated.patch({ name: 'Janet' })
         *     );
         * ```
         */
        patch(
            updates: TUpdateSchema extends z.ZodNever
                ? never
                : Partial<z.infer<TUpdateSchema>>,
        ): Result<PureEntity<TSchema, TId>> {
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
                            new Entity(validatedData) as PureEntity<
                                TSchema,
                                TId
                            >,
                        ),
                );
        }

        /**
         * Compares this entity with another for equality based on ID.
         *
         * @param other - The entity to compare with
         * @returns True if both entities have the same identifier
         */
        equals(other: PureEntity<TSchema, TId>): boolean {
            return this.identifier === (other as Entity).identifier;
        }

        /**
         * Returns a string representation of the entity.
         *
         * @returns A string containing the entity class name and identifier
         */
        toString(): string {
            return `${this.constructor.name}(${String(this.identifier)})`;
        }
    };
}
