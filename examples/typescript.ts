import {Event} from '@nxcd/tardis'
import {EventEntity} from '../src/classes/EventEntity'
import { MongodbEventRepository } from '../src/classes/MongodbEventRepository'

class PersonWasCreated extends Event {
  static eventName: string = 'person-was-created'
  user: string

 constructor (data: {email: string}, user: string) {
  super(PersonWasCreated.eventName, data)
  this.user = user
 }

  static commit (state: Person, event: PersonWasCreated) {
    state.email = event.data.email
    state.updatedAt = event.timestamp
    state.updatedBy = event.user

    return state
  }
}

export class Person extends EventEntity<Person> {
  email: string | null = null
  updatedAt: Date | null = null
  updatedBy: string | null = null
  static collection: string = 'people'

  constructor () {
    super({
      [PersonWasCreated.eventName]: PersonWasCreated.commit
    })
  }

  get state () {
    return this._reducer.reduce(new Person, [
      ...this.persistedEvents,
      ...this.pendingEvents
    ])
  }
}

// Exemplo do repositorio

import { Db, MongoClient } from 'mongodb'

class PersonRepository extends MongodbEventRepository<Person> {
  constructor (connection: Db) {
    super (connection.collection(Person.collection), Person)
  }
}

(async function () {
  const connection = (await MongoClient.connect('mongodb://salkdjkjdhfdkjsfhjkdsfhs')).db('crowd')
  const personRepository = new PersonRepository(connection)

})()
