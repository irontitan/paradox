import { IEvent } from '@nxcd/tardis'
import { Collection, ObjectId } from 'mongodb'
import { IEventEntity } from '../../interfaces/IEventEntity'
import { IEventRepository } from '../../interfaces/IEventRepository'

interface IDatabaseDocument {
  state: any
  events: IEvent<any>[]
}

interface Constructor<Entity> {
  new(events?: IEvent<any>[]): Entity
}

export abstract class MongodbEventRepository<TEntity extends IEventEntity> implements IEventRepository<TEntity> {
  protected _collection: Collection
  private _Entity: Constructor<TEntity>

  constructor (collection: Collection, Entity: Constructor<TEntity>) {
    this._collection = collection
    this._Entity = Entity
  }

  private async _create (entity: TEntity): Promise<TEntity> {
    await this._collection.insertOne({
      _id: new ObjectId(entity.id),
      events: entity.pendingEvents,
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

    await this._collection.updateOne({ _id: new ObjectId(entity.id) }, operations)

    return entity.confirmEvents()
  }

  async findById (id: ObjectId): Promise<TEntity | null> {
    if (!ObjectId.isValid(id)) return null

    const document: IDatabaseDocument = await this._collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { state: 1, events: 1 } }
    )

    if (!document) return null

    return new this._Entity().setPersistedEvents(document.events)
  }
}
