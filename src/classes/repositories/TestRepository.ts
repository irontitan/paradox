import { MongodbEventRepository } from './MongodbEventRepository'
import { EventEntity } from '../EventEntity'
import { MongoClient, Db } from 'mongodb'

class Person extends EventEntity<Person> {

}

class TestRepository extends MongodbEventRepository<Person>{
  constructor (connection: Db) {
    super(connection.collection('production-orders'), Person)
  }
}
