Feature: Immutable Entity Declaration
  As a domain modeler
  I want to declare immutable entities with Zod schemas
  So that I can ensure data consistency and type safety

  Scenario: Create an immutable user entity
    Given I have a Zod schema for a user with id, name, and email
    When I create an entity factory from the schema
    Then the factory should successfully create an entity instance
    And the entity should have the correct id
    And the entity should be immutable

  Scenario: Prevent mutation on immutable entity
    Given I have created an immutable user entity
    When I try to modify an entity property
    Then the modification should be prevented at runtime
