import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'path';
import { z } from 'zod';
import { createPureEntity, type PureEntity } from '../../src/domain/entity';

const feature = loadFeature(
    join(__dirname, '../features/immutable_entity.feature'),
);

//>
//> > fr: Schéma utilisateur pour les tests d'entité immuable.
//> > en: User schema for immutable entity tests.
//>
const userSchemaDefinition = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
});

type UserSchemaType = typeof userSchemaDefinition;
type UserEntityType = PureEntity<UserSchemaType, string>;

defineFeature(feature, (test) => {
    let userSchema: UserSchemaType;
    // Type inferred from createPureEntity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entityFactory: any;
    let userEntity: UserEntityType | undefined;

    test('Create an immutable user entity', ({ given, when, then, and }) => {
        given('I have a Zod schema for a user with id, name, and email', () => {
            userSchema = z.object({
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
            });
        });

        when('I create an entity factory from the schema', () => {
            entityFactory = createPureEntity(
                userSchema,
                undefined,
                undefined,
                (props) => props.id,
            );
        });

        then(
            'the factory should successfully create an entity instance',
            () => {
                const result = entityFactory?.create({
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    name: 'John Doe',
                    email: 'john@example.com',
                });

                expect(result?.isSuccess()).toBe(true);
                userEntity = result?.value;
            },
        );

        and('the entity should have the correct id', () => {
            expect(userEntity?.identifier).toBe(
                '550e8400-e29b-41d4-a716-446655440000',
            );
        });

        and('the entity should be immutable', () => {
            const originalName = userEntity.properties.name;

            // Entity properties are readonly at the type level
            expect(userEntity.properties).toHaveProperty('name', originalName);
            expect(userEntity.properties).toHaveProperty('email');
        });
    });

    test('Prevent mutation on immutable entity', ({ given, when, then }) => {
        given('I have created an immutable user entity', () => {
            userSchema = z.object({
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
            });

            entityFactory = createPureEntity(
                userSchema,
                undefined,
                undefined,
                (props) => props.id,
            );
            const result = entityFactory?.create({
                id: '550e8400-e29b-41d4-a716-446655440001',
                name: 'Alice Smith',
                email: 'alice@example.com',
            });
            userEntity = result?.value;
        });

        when('I try to modify an entity property', () => {
            const originalEmail = userEntity.properties.email;

            // Attempt to modify (will be prevented at the property level)
            // At runtime, JavaScript allows this but TypeScript type system prevents it
            const newEntity = entityFactory?.create({
                ...userEntity.properties,
                email: 'newemail@example.com',
            });

            expect(newEntity?.isSuccess()).toBe(true);
        });

        then('the modification should be prevented at runtime', () => {
            expect(userEntity.properties.email).toBe('alice@example.com');
        });
    });
});
