import type { Result } from '@gilles-coudert/pure-trace';
import { pureZodParse, Success } from '@gilles-coudert/pure-trace';
import { type z } from 'zod';

/**
 * Factory for creating Domain Event classes with validation.
 *
 * @template TPayloadSchema - The Zod schema type for the payload
 * @param eventName - The unique name/type of the event
 * @param payloadSchema - The Zod schema for validating the event payload
 * @returns A Domain Event class
 *
 * @example
 * ```typescript
 * const UserCreatedPayloadSchema = z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email()
 * });
 *
 * const UserCreated = createDomainEvent("UserCreated", UserCreatedPayloadSchema);
 *
 * const eventResult = UserCreated.create({
 *     userId: "123e4567-e89b-12d3-a456-426614174000",
 *     email: "user@example.com"
 * });
 * ```
 */
export function createPureDomainEvent<
    TPayloadSchema extends z.ZodObject<z.ZodRawShape>,
>(eventName: string, payloadSchema: TPayloadSchema) {
    /**
     * Represents a Domain Event in Domain-Driven Design.
     * Domain events capture something meaningful that happened in the domain.
     */
    return class DomainEvent {
        /**
         * The unique name/type of the event.
         */
        readonly eventName: string;

        /**
         * When the event occurred.
         */
        readonly occurredOn: Date;

        /**
         * The payload data of the event.
         */
        readonly payload: z.infer<TPayloadSchema>;

        private constructor(payload: z.infer<TPayloadSchema>) {
            this.eventName = eventName;
            this.occurredOn = new Date();
            this.payload = {
                ...(payload as object),
            } as z.infer<TPayloadSchema>;
        }

        /**
         * Creates a new domain event with validated payload.
         *
         * @param payload - The event payload data
         * @returns A Result containing the domain event or validation errors
         */
        static create(payload: z.infer<TPayloadSchema>): Result<DomainEvent> {
            return pureZodParse(payload, payloadSchema).mapSuccess(
                (validatedPayload) =>
                    new Success(new DomainEvent(validatedPayload)),
            );
        }
    };
}

/**
 * Type helper to extract the Domain Event class type from a factory.
 */
export type DomainEvent<TPayloadSchema extends z.ZodObject<z.ZodRawShape>> =
    ReturnType<typeof createPureDomainEvent<TPayloadSchema>>;
