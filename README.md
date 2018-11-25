# Paradox

> Toolkit to help developers implement the [event sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) architecture

[![Build Status](https://travis-ci.org/nxcd/paradox.svg?branch=master)](https://travis-ci.org/nxcd/paradox)
[![GitHub license](https://img.shields.io/github/license/nxcd/paradox.svg)](https://github.com/nxcd/paradox/blob/master/LICENSE)
[![Javascript code Style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![Github All Releases](https://img.shields.io/github/downloads/nxcd/paradox/total.svg)](https://github.com/nxcd/paradox)
[![GitHub package version](https://img.shields.io/github/package-json/v/nxcd/paradox.svg)](https://github.com/nxcd/paradox) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/0aa3e759b33b4fb6a11dae3e6ae6aca2)](https://app.codacy.com/app/khaosdoctor/paradox?utm_source=github.com&utm_medium=referral&utm_content=nxcd/paradox&utm_campaign=Badge_Grade_Dashboard)

## Summary

- [Paradox](#paradox)
  - [Summary](#summary)
  - [Instalation](#instalation)
  - [Example](#example)
    - [PersonWasCreated.ts event](#personwascreatedts-event)
    - [PersonEmailChanged.ts event](#personemailchangedts-event)
    - [Person.ts class](#personts-class)
    - [Putting it all together](#putting-it-all-together)
  - [What does this toolkit have?](#what-does-this-toolkit-have)
  - [EventEntity](#evententity)
  - [Repositories](#repositories)
    - [MongodbEventRepository](#mongodbeventrepository)
      - [Sessões](#sessões)
  - [Interfaces](#interfaces)
    - [IPaginatedQueryResult](#ipaginatedqueryresult)

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
import { Event } from '@nxcd/tardis'
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
import { Event } from '@nxcd/tardis'
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
    })
  }

  static create (email: string, name: string, user: string): Person { // Método para criar uma pessoa
    const id = new ObjectId()
    const person = new Person()
    person.pushNewEvents([ new PersonWasCreated({id, name, email}, user) ]) // Inclui um novo evento ao criar
    return person // Retorna a nova instancia
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
  const connection = (await MongoClient.connect('mongodb://urldomongodbaqui')).db('crowd')
  const personRepository = new PersonRepository(connection)
  const johnDoe = Person.create('johndoe@doe.com', 'jdoe')
  await personRepository.save(johnDoe) // Will create a new event in the class
  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Will return an object implementing the [IPaginatedQueryResult](#ipaginatedqueryresult) interface

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

## EventEntity

An `EventEntity` is a business class which posesses the implementation of all events this class can have. All event-based entity **must** extends `EventEntity` class, since it is an abstract/generic class. Extending it will give your own class some cool functionalities out-of-the-box:

- `persistedEvents`: An array of events which were already persistted to the database. It follows the `{id, name, data, timestamp}` format
- `pendingEvents`: An array of events which were not yet saved to the database

When created, the new entity will receive (as a parameter) an object, of which the keys must be the name of an event and its value must be the `commit` function, which can be located anywhere, but, in our little example above, we created it as a static method inside the event entity itself.

This procedure is the same for all the events that entity might have, this is due to the fact that the `EventEntity`, when instantiated, will create a [Reducer](http://github.com/nxcd/tardis#reducer) instance in the property `this.reducer` and it'll pass on all these known events to it so it can be possible to manage all events inside the same class, without the need to instantiate something new.

This class **must** also have a getter caled `state`. This getter exists in the parent class (`EventEntity`) as a "Non implemented method", which will throw an error if used as default. This way, it becomes necessary for the child class to overwrite the parent class' method, implementing in it the responsability to reduce the previous state to the current state and returning it.

> Refer to the `Person.ts` class for more information

Besides `state`, the `EventEntity` class will disclose several other methods such:

- `setPersistedEvents`: Which will receive an array of events in the `{id, name, data, timestamp}` format, fetched from the database, and it'll include these events into the `persistedEvents` array. It'll be often used when loading a class for the first time from the database.
- `pushNewEvents`: Will receive an event array following the same `{id, name, data, timestamp}` format, but instead of adding them to the persisted events array, it'll add the events to the `pendingEvents` array and thus, notifying that there are events which were not yet persisted to the database and are only available inside this instance.
- `confirmEvents`: Will move all the items from the `pendingEvents` array to the `persistedEvents` array. This will confirm that all the events were successfuly saved into the database. This will be often used after we save the last state of the entity to the database.

## Repositories

Repositories are places where data resides, by default, we would not have to create an event-base class for them, but, in order to standardize all the events saved into the database, it was necessary to create such class.

Since different databases have different event sourcing implementations, for now, we only have the ones listed below.

> Note that different repository classes might behave differently depending on who created the class, please refer to the PR section or fill in an issue if you're experiencing troubles.

### MongodbEventRepository

Data repository made for MongoDB databases. This repository **must** be extended by another class implementing its own methods. The base abstract class must have some properties when instantiated such as:

- Must receive the `Collection` object from Mongodb

> **Note:** The `collection` **OBJECT**, not the collection **NAME**

- Must receive the main entity constructor (not the instance)

By default, the class already has some base methods:

- `save (entity: TEntity)`: Which will serialize and save the received entity (which must be of the same type you passed to the generic type `TEntity` in `MongodbEventRepository<TEntity>`) on the database.

> This method works by firstly trying to find the entity by its ID, if the ID cannot be found in the database, then a new document will be created, following the `{_id, events, state}` format where `events` should start as an empty array and, at each `save`, the `pendingEvents` array will be merged to it. Soon after that, the `confirmEvents` method will be called, thus clearing the `pendingEvents` array.
>
> `state` will be the last reduced state of the entity, which will be obtained by calling the `state` getter we just defined earlier.

- `findById (id: ObjectId)`: Will search in the database for a record with the informed `id`.

> This record should be created when the class is instantiated using the `create` method

- `bulkUpdate (entities: IEventEntity[])`: Save events from several instances of an entity at once
- `withSession (session: ClientSession)`: Begins a MongoDB session to initiate a transaction (only on Mongo 4.0) and returns an object with the available methods which can be executed within a session. If this following command throws an error, the whole session suffers a rollback, otherwise it is commited.
- `_runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [key: string]: 1|-1 } = {})`: Executes a query aplying pagination to the result. Returns an object that follows the [IPaginatedQueryResult](#ipaginatedqueryresult) interface.

#### Sessões

If your MongoDB version is 4.0 or higher (with transaction support), in order to execute a command using a transaction, follow this example:

```ts
import { Db, MongoClient } from 'mongodb'
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
  const connection = (await MongoClient.connect('mongodb://urldomongodbaqui')).db('crowd')
  const personRepository = new PersonRepository(connection)
  const johnDoe = Person.create('johndoe@doe.com', 'jdoe')
  await personRepository.save(johnDoe) // Creates a new event
  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Returns an object following IPaginatedQueryResult interface

  johnDoe.changeEmail({ newEmail: 'johndoe@company.com' }, 'jdoe')
  const [ janeDoe ] = allJanes
  janeDoe.changeEmail({ newEmail: 'janedoe@doe.com' }, 'janedoe')

  const session = connection.startSession()
  await personRepository.withSession(session).bulkUpdate([ johnDoe, janeDoe ]) // Updates both entities using a transaction
})()
```

> If you version does **not** support transactions, an Database Error is thrown

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
