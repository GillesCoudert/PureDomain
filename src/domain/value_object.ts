import type { Result } from '@gilles-coudert/pure-trace';
import { pureZodParse, Success } from '@gilles-coudert/pure-trace';
import { type z } from 'zod';

//>
//> > fr: Interface pour les instances d'objet valeur créées par une factory.
//> > en: Interface for value object instances created by a factory.
//>
export interface PureValueObject<TSchema extends z.ZodObject<z.ZodRawShape>> {
    /**
     * The underlying properties of the value object.
     */
    readonly properties: z.infer<TSchema>;

    /**
     * Compares this value object with another for structural equality.
     *
     * @param other - The value object to compare with
     * @returns True if both value objects have equal properties
     */
    equals(other: PureValueObject<TSchema>): boolean;
}

/**
 * Factory for creating Value Object classes with immutability and validation.
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema for validation
 * @returns A Value Object class
 *
 * @example
 * ```typescript
 * const EmailSchema = z.object({ value: z.string().email() });
 * const Email = createPureValueObject(EmailSchema);
 *
 * const emailResult = Email.create({ value: "user@example.com" });
 * if (emailResult.isSuccess) {
 *     const email = emailResult.value;
 *     const updated = Email.create({ value: "newuser@example.com" });
 * }
 * ```
 */
export function createPureValueObject<
    TSchema extends z.ZodObject<z.ZodRawShape>,
>(
    schema: TSchema,
): {
    new (properties: z.infer<TSchema>): PureValueObject<TSchema>;
    create(data: z.infer<TSchema>): Result<PureValueObject<TSchema>>;
} {
    /**
     * Represents a Value Object in Domain-Driven Design.
     * Value Objects are immutable and identified by their properties rather than an ID.
     */
    return class ValueObject {
        /**
         * The underlying properties of the value object.
         */
        readonly properties: z.infer<TSchema>;

        constructor(properties: z.infer<TSchema>) {
            this.properties = { ...(properties as object) } as z.infer<TSchema>;
        }

        /**
         * Creates a new value object instance from raw data.
         *
         * @param data - The data to create the value object from
         * @returns A Result containing the value object or validation errors
         */
        static create(
            data: z.infer<TSchema>,
        ): Result<PureValueObject<TSchema>> {
            return pureZodParse(data, schema).mapSuccess(
                (validatedData) =>
                    new Success(
                        new ValueObject(
                            validatedData,
                        ) as PureValueObject<TSchema>,
                    ),
            );
        }

        /**
         * Compares this value object with another for structural equality.
         *
         * @param other - The value object to compare with
         * @returns True if both value objects have equal properties
         */
        equals(other: PureValueObject<TSchema>): boolean {
            return (
                JSON.stringify(this.properties) ===
                JSON.stringify((other as ValueObject).properties)
            );
        }
    };
}
