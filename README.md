<div style='width: 100%; text-align: center;'>
  <img style='margin: 0 auto;' src='./assets/logo.png'/>
</div>
<br/>
<br/>

> Toolkit to help developers implement the [event sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) architecture

[![Build Status](https://travis-ci.org/nxcd/paradox.svg?branch=master)](https://travis-ci.org/nxcd/paradox)
[![GitHub license](https://img.shields.io/github/license/nxcd/paradox.svg)](https://github.com/nxcd/paradox/blob/master/LICENSE)
[![Javascript code Style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![Github All Releases](https://img.shields.io/github/downloads/nxcd/paradox/total.svg)](https://github.com/nxcd/paradox)
[![GitHub package version](https://img.shields.io/github/package-json/v/nxcd/paradox.svg)](https://github.com/nxcd/paradox) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/0aa3e759b33b4fb6a11dae3e6ae6aca2)](https://app.codacy.com/app/khaosdoctor/paradox?utm_source=github.com&utm_medium=referral&utm_content=nxcd/paradox&utm_campaign=Badge_Grade_Dashboard)
[![Known Vulnerabilities](https://snyk.io/test/github/nxcd/paradox/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nxcd/paradox?targetFile=package.json)

## Summary

- [Summary](#summary)
- [Instalation](#instalation)
- [Example](#example)
  - [PersonWasCreated.ts event](#personwascreatedts-event)
  - [PersonEmailChanged.ts event](#personemailchangedts-event)
  - [Person.ts class](#personts-class)
  - [Putting it all together](#putting-it-all-together)
- [What does this toolkit have?](#what-does-this-toolkit-have)
  - [API Summary](#api-summary)
- [EventEntity](#evententity)
- [Repositories](#repositories)
- [Interfaces](#interfaces)
  - [IPaginatedQueryResult](#ipaginatedqueryresult)
  - [IEntityConstructor](#ientityconstructor)
- [My repository is not included, what do I do?](#my-repository-is-not-included-what-do-i-do)
  - [Adding your repository to the list](#adding-your-repository-to-the-list)

## Instalation

```shell
$ pnpm i @nxcd/paradox
```

```shell
$ npm i @nxcd/paradox
```

```shell
$ yarn add @nxcd/paradox
```

## Example

### PersonWasCreated.ts event

Event that will create the `Person` class

```ts
import { Event } from '@nxcd/paradox'
import { Person } from './classes/Person'
import ObjectId from 'bson-objectid'

interface IPersonCreationParams {
  id?: ObjectId
  name: string
  email: string
}

class PersonWasCreated extends Event<IPersonCreationParams> {
  static readonly eventName: string = 'person-was-created'
  user: string

  constructor(data: IPersonCreationParams, user: string) {
    super(PersonWasCreated.eventName, data)
    this.user = user
  }

  static commit(state: Person, event: PersonWasCreated) {
    state.id = event.data.id
    state.name = event.data.name
    state.email = event.data.email
    state.updatedAt = event.timestamp
    state.updatedBy = event.user

    return state
  }
}
```

### PersonEmailChanged.ts event

Triggered when a Person's email changes

```ts
import { Event } from '@nxcd/paradox'
import { Person } from './classes/Person'
import ObjectId from 'bson-objectid'

interface IPersonEmailChangeParams {
  newEmail: string
}

class PersonEmailChanged extends Event<IPersonEmailChangeParams> {
  static readonly eventName: string = 'person-email-changed'
  user: string

  constructor(data: IPersonEmailChangeParams, user: string) {
    super(PersonWasCreated.eventName, data)
    this.user = user
  }

  static commit(state: Person, event: PersonEmailChanged) {
    state.email = event.data.newEmail
    state.updatedAt = event.timestamp
    state.updatedBy = event.user

    return state
  }
}
```

> **Important**
> - The `commit` method is in the event class in this example, but it can be at any place in the code
> - The `eventName` property is required

### Person.ts class

The main `Person` entity.

> Since version 2.9.0, EventEntity's constructor receives, as a second parameter the Entity class itself. This is used to update the state internally when adding new events. For now, this second parameter is optional. Not passing it, though, is considered deprecated and will stop being supported on the future

```ts
import ObjectId from 'bson-objectid'
import { EventEntity } from '@nxcd/paradox'
import { PersonWasCreated } from './events/PersonWasCreated'
import { PersonEmailChanged } from './events/PersonEmailChanged'

export class Person extends EventEntity<Person> {
  name: string | null = null
  email: string | null = null
  updatedAt: Date | null = null
  updatedBy: string | null = null
  static readonly collection: string = 'people'

  constructor() {
    super({
      [ PersonWasCreated.eventName ]: PersonWasCreated.commit
    }, Person)
  }

  static create (email: string, name: string, user: string): Person { // Method to create a person
    const id = new ObjectId()
    const person = new Person()
    person.pushNewEvents([ new PersonWasCreated({id, name, email}, user) ]) // Includes a new event on creation
    return person // Returns new instance
  }

  changeEmail (newEmail: string, user: string) {
    this.pushNewEvents([ new PersonEmailChanged({ newEmail }, user) ])
    return this
  }

  get state() {
    const currentState = this.reducer.reduce(new Person, [
      ...this.persistedEvents,
      ...this.pendingEvents
    ])

    return {
      id: currentState.id,
      name: currentState.name,
      email: currentState.email
    }
  }
}
```

### Putting it all together

```ts
import { Db, MongoClient } from 'mongodb'
import { MongodbEventRepository } from '@nxcd/paradox'
import { Person } from './classes/Person'

class PersonRepository extends MongodbEventRepository<Person> {
  constructor(connection: Db) {
    super(connection.collection(Person.collection), Person)
  }

  async search (filters: { name: string }, page: number = 1, size: number = 50) {
    const query = filters.name
      ? { 'state.name': filters.name }
      : { }

    const { documents, count, range, total } = await this._runPaginatedQuery(query, page, size)
    const entities = documents.map(({ events }) => new Person().setPersistedEvents(events))

    return { entities, count, range, total }
  }
}

(async function () {
  const connection = (await MongoClient.connect('mongodb://mongodburl')).db('crowd')
  const personRepository = new PersonRepository(connection)
  const johnDoe = Person.create('johndoe@doe.com', 'jdoe') // Will create a new event in the class
  await personRepository.save(johnDoe) // Will persist the data to the database
  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Will return an object implementing the IPaginatedQueryResultinterface

  // If you like, there's a possibility to update multiple classes at the same time
  johnDoe.changeEmail({ newEmail: 'johndoe@company.com' }, 'jdoe')
  const [ janeDoe ] = allJanes
  janeDoe.changeEmail({ newEmail: 'janedoe@doe.com' }, 'janedoe')

  await personRepository.bulkUpdate([ johnDoe, janeDoe ]) // Updates both entities in the database using `bulkWrite`
})() // This IIFE is just to generate our async/await scope
```

## What does this toolkit have?

- `EventEntity`: Pre-made event-based class. It contains all the implementations to create a fully functional event sourcing entity
- `MongoDBEventRepository`: MongoDB event-based repository (If you use another database, feel free to help us by writing a PR and adding it to the list :D)
- Typing helpers
- A bare export of the [Tardis](https://github.com/nxcd/tardis) toolkit

### API Summary

> EventEntity<BusinessEntity>

**TL;DR**: Represents an business entity with event sourcing properties. Must **always** be extended. Must **always** contain a `state` getter which returns the final state of the entity

**Properties**:

- *public* `persistedEvents`: Array of events that were persisted to the database
- *public* `pendingEvents`: Array of events that have not yet been persisted to the database
- *protected* `reducer`: A reducer instance as described in the [Tardis](https://github.com/nxcd/tardis) documentation
- *get* `state`: Returns the final state of the entity (**must** be implemented)

**Methods:**

- *public* `setPersistedEvents(events: Array<{id, name, data, timestamp}>)`: Sets the `persistedEvents` property with the `events` array
- *public* `pushNewEvents(events: Array<{id, name, data, timestamp}>)`: Pushes a new event to the `pendingEvents` array
- *public* `confirmEvents()`: Transfers all the content from the `pendingEvents` array to the `persistedEvents` array

> MongodbEventRepository<BusinessEntity>

**TL;DR**: Represents a database that is fully suited to use event-based classes

**Properties**:

- *protected* `_collection`: Collection name

**Methods**:

- *public* `save(entity: BusinessEntity)`: Saves the current entity to the database
- *public* `bulkUpdate(entities: EventEntity[], session)`: Updates multiple entities at once
- *public* `bulkInsert(entities: EventEntity[], session)`: Inserts multiple entities at once
- *public* `findById(id: string | ObjectId)`: Finds an entity by the provided ID
- *public* `withSession(session: ClientSession)`: Starts a MongoDB session and returns the available methods that can be used with the provided session
- *protected* `_runPaginatedQuery(query: {[key: string]: any}, page: number, size: number, sort?: {[field: string]: 1|-1})`: Runs a query in the database and return the paginated results

## EventEntity

An `EventEntity` is a business class which posesses the implementation of all events this class can have. All event-based entity **must** extends `EventEntity` class, since it is an abstract/generic class. Extending it will give your own class some cool functionalities out-of-the-box:

- `persistedEvents`: An array of events which were already persistted to the database. It follows the `{id, name, data, timestamp}` format
- `pendingEvents`: An array of events which were not yet saved to the database

When created, the new entity will receive (as a parameter) an object, of which the keys must be the name of an event and its value must be the `commit` function, which can be located anywhere, but, in our little example above, we created it as a static method inside the event entity itself. Since v2.9.0, it also receives the entity class itself, to be used for internal purposes.

This procedure is the same for all the events that entity might have, this is due to the fact that the `EventEntity`, when instantiated, will create a [Reducer](http://github.com/nxcd/tardis#reducer) instance in the property `this.reducer` and it'll pass on all these known events to it so it can be possible to manage all events inside the same class, without the need to instantiate something new.

This class **must** also have a getter caled `state`. This getter exists in the parent class (`EventEntity`) as a "Non implemented method", which will throw an error if used as default. This way, it becomes necessary for the child class to overwrite the parent class' method, implementing in it the responsability to reduce the previous state to the current state and returning it.

> Refer to the `Person.ts` class for more information

Besides `state`, the `EventEntity` class will disclose several other methods such:

- `setPersistedEvents`: Which will receive an array of events in the `{id, name, data, timestamp}` format, fetched from the database, and it'll include these events into the `persistedEvents` array. It'll be often used when loading a class for the first time from the database.
- `pushNewEvents`: Will receive an event array following the same `{id, name, data, timestamp}` format, but instead of adding them to the persisted events array, it'll add the events to the `pendingEvents` array and thus, notifying that there are events which were not yet persisted to the database and are only available inside this instance.
- `confirmEvents`: Will move all the items from the `pendingEvents` array to the `persistedEvents` array. This will confirm that all the events were successfuly saved into the database. This will be often used after we save the last state of the entity to the database.

All of the three methods above call the private method `updateState`, which sets all properties from the current state back to the instance of the entity class.

## Repositories

Repositories are places where data resides, by default, we would not have to create an event-base class for them, but, in order to standardize all the events saved into the database, it was necessary to create such class.

Since different databases have different event sourcing implementations, for now, we only have the ones listed below.

> Note that different repository classes might behave differently depending on who created the class, please refer to the PR section or fill in an issue if you're experiencing troubles.

- [MongoDB event-based repository](./docs/MongodbEventRepository.md)

## Interfaces

### IPaginatedQueryResult

Represents a paginated query:

```ts
interface IPaginatedQueryResult<TDocument> { // TDocument is the type that represents the data which will be returned from the database (it is used internally)
  documents: TDocument[] // Documents in the current page
  count: number // Total results in the page
  range: {
    from: number, // Index of the first result
    to: number // Index of the last result
  }
  total: number // Query total
}
```

### IEntityConstructor

Represents the constructor of an entity

```ts
interface IEntityConstructor<Entity> {
  new(events?: IEvent<any>[]): Entity
}
```

## My repository is not included, what do I do?

Since this lib is open source and generic enough to be used by multiple repositories, there's no way to know which repositories the users are going to be using. So we added a way for you to create your own.

In order to create a repository, your class **must** extend the `EventRepository` class, which is fully abstract and is as follows:

```ts
export interface IEntityConstructor<Entity> {
  new(events?: IEvent<any>[]): Entity
}

export abstract class EventRepository<TEntity extends IEventEntity> {

  protected readonly _Entity: IEntityConstructor<TEntity>

  constructor (Entity: IEntityConstructor<TEntity>) {
    this._Entity = Entity
  }

  abstract async save (entity: TEntity): Promise<TEntity>

  abstract async findById (id: any): Promise<TEntity | null>

  abstract async runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [field: string]: 1 | -1 }): Promise<IPaginatedQueryResult<{ events: IEvent<TEntity>[] }>>
}
```

In order to maintain consistency between implementations, the following methods **must** be implemented:

- `save`: Should save the given entity to the database and return the entity
- `findById`: Should find an entity by its ID in the database. It is important to notice that, once found, the returned value should be a newly created instance of that entity (this is where you're going to use the `setPersistedEvents` method)
- `runPaginatedQuery`: Should return a paginated query from the database

Besides these methods, any class that extends `EventRepository` will inherit the `_Entity` property, which refers to the entity constructor. This will be used when returning the newly created entity from the database during the `findById` method and seting its persisted events on the newly instantiated class, like so:

```ts
async function findById (id) {
  /* finds the data */
  const instance = this._Entity() // Creates a new instance of <Entity>
  return instance.setPersistedEvents(yourEvents) // Sets the returned data into the instance
}
```

Those are the required implementations, any additional functionalities you'd like to include in the repository can be added at will.

> For further explanation and examples, refer to the [MongodbEventRepository file in the `src` folder](./docs/MongodbEventRepository.md)

### Adding your repository to the list

If you'd like to add your repository to the list of included repositories, please fill in a PR and don't forget to stick to some conventions:

- All names are CamelCase
- Private variables come with an `_` preceding it
- Do **not** forget to add the documentation to this repository in the `docs/` folder (the file should be the same name as your class)
- Do **not** forget to add your repository to the list in this README along with the link to its own docs

Thank you for your contribution :D