import { IEvent } from '@nxcd/tardis'
import { Collection, ObjectId } from 'mongodb'
import { IEventEntity } from '../interfaces/IEventEntity'
import { IEventRepository } from '../interfaces/IEventRepository'

interface IDatabaseDocument {
  state: any
  events: IEvent[]
}

interface Constructor<Entity> {
  new (events?: IEvent[]): Entity
}

export class MongodbEventRepository<TEntity extends IEventEntity<TEntity>> implements IEventRepository<TEntity> {
  private _collection: Collection
  private _Entity: Constructor<TEntity>

  constructor (collection: Collection, Entity: Constructor<TEntity>) {
    this._collection = collection
    this._Entity = Entity
  }

  private async _create (entity: TEntity): Promise<TEntity> {
    await this._collection.insertOne({
      _id: entity.id,
      events: entity.persistedEvents,
      state: entity.state
    })

    return entity.confirmEvents()
  }

  async save (entity: TEntity): Promise<TEntity> {
    const { state, pendingEvents } = entity
    const document = await this.findById(entity.id)

    if (!document) return this._create(entity)

    const operations = {
      $set: { state },
      $push: { events: { $each: pendingEvents } }
    }

    await this._collection.updateOne({ _id: entity.id }, operations)

    return entity.confirmEvents()
  }

  async findById (id: ObjectId): Promise<TEntity | null> {
    const document: IDatabaseDocument = await this._collection.findOne(
      { _id: id },
      { projection: { state: 1, events: 1 } }
    )

    if (!document) return null

    return new this._Entity().setPersistedEvents(document.events)
  }
}
