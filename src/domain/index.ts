//>──────────────────────────────────────────────────────────────────────────────────────────────────────────<
//> fr: Exports principaux - Types et fonctions de base pour la construction de domaines métier avec DDD. <
//>──────────────────────────────────────────────────────────────────────────────────────────────────────────<
//>────────────────────────────────────────────────────────────────────────────────────────────────────────────<
//> en: Main exports - Base types and functions for building business domains with DDD. <
//>────────────────────────────────────────────────────────────────────────────────────────────────────────────<

//>
//> > fr: Value Objects
//> > en: Value Objects
//>
export type { ValueObject } from './value_object.js';
export { createPureValueObject } from './value_object.js';

//>
//> > fr: Entities
//> > en: Entities
//>
export type { Entity, IdentifierExtractor } from './entity.js';
export { createPureEntity } from './entity.js';

//>
//> > fr: Aggregate Roots
//> > en: Aggregate Roots
//>
export type { AggregateRoot } from './aggregate_root.js';
export { createPureAggregateRoot } from './aggregate_root.js';

//>
//> > fr: Domain Events
//> > en: Domain Events
//>
export type { DomainEvent } from './domain_event.js';
export { createPureDomainEvent } from './domain_event.js';
