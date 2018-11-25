import { IEvent } from '@nxcd/tardis'
import { Collection, ObjectId, ClientSession } from 'mongodb'
import { IEventEntity } from '../../interfaces/IEventEntity'
import { IEventRepository } from '../../interfaces/IEventRepository'
import { IPaginatedQueryResult } from '../../interfaces/IPaginatedQueryResult'

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

  protected async _tryRunningWithSession (fn: Function, session: ClientSession) {
    session.startTransaction()
    try {
      const result = await fn()
      session.commitTransaction()
      return result
    } catch (err) {
      session.abortTransaction()
      throw err
    }
  }

  /**
   * Creates a new entity on the database
   * @param {TEntity} entity Entity to be created
   */
  private async _create (entity: TEntity): Promise<TEntity> {
    await this._collection.insertOne({
      _id: new ObjectId(entity.id),
      events: entity.pendingEvents,
      state: entity.state
    })

    return entity.confirmEvents()
  }

  /**
   * Creates or updates an entity in the database
   * @param {TEntity} entity Entity to be saved (upserted) to the bank
   */
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

  /**
   * Performs a paginated query and returns the result
   * @param {{[key: string]: any}}  query Query to be performed
   * @param {number} page Page to be returned
   * @param {number} size Number of results per page
   * @param {{[field: string]: 1|-1}} sort Fields to sort
   * @returns {Promise} Set of results
   */
  protected async _runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [field: string]: 1 | -1 } = {}): Promise<IPaginatedQueryResult<{ events: IEvent<TEntity>[] }>> {
    const skip = (Number(page) - 1) * Number(size)
    const limit = Number(size)

    const total = await this._collection.countDocuments(query)

    if (total === 0) return { documents: [], count: 0, range: { from: 0, to: 0 }, total }

    const documents = await this._collection.find(query, { skip, limit, projection: { events: 1 }, sort }).toArray()

    const count = documents.length
    const range = { from: skip, to: skip + count }

    return { documents, count, range, total }
  }


  /**
   * Updates a series of entities on the database
   * without knowing or caring if they exist or not
   * This uses a transaction to ensure no leftovers in case of failure
   * If mongodb version is inferior to 4.0, no transactions are used,
   * and the operations become ACID
   * @param {TEntity[]} entities Array of entities to be updated
   */
  async bulkUpdate (entities: IEventEntity[], session?: ClientSession): Promise<void> {
    const operations = entities.filter((entity) => entity.pendingEvents.length > 0)
      .map(productionOrder => {
        return {
          updateOne: {
            filter: { _id: productionOrder.id },
            update: {
              $set: { state: productionOrder.state },
              $push: { events: { $each: productionOrder.pendingEvents } }
            }
          }
        }
      })

    await this._collection.bulkWrite(operations, { ordered: true, session })
  }

  /**
   * Finds a document given its ID
   * If the given Id is a string, it *will* be converted to an ObjectId
   * @param {string|ObjectId} id Id of the desired document
   */
  async findById (id: string | ObjectId): Promise<TEntity | null> {
    if (!ObjectId.isValid(id)) return null

    const document: IDatabaseDocument = await this._collection.findOne(
      { _id: new ObjectId(id) },
      { projection: { state: 1, events: 1 } }
    )

    if (!document) return null

    return new this._Entity().setPersistedEvents(document.events)
  }

  withSession (session: ClientSession) {
    return {
      bulkUpdate: (entities: IEventEntity[]) => this._tryRunningWithSession(() => this.bulkUpdate(entities, session), session)
    }
  }
}
