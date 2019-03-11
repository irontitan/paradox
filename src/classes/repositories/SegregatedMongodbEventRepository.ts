import { EventRepository } from './EventRepository'
import { Collection, ObjectId, ClientSession } from 'mongodb'
import { SegregatedEventEntity } from '../SegregatedEventEntity'
import { ISegregatedEvent } from '../../interfaces/ISegregatedEvent'
import { IEntityConstructor } from '../../interfaces/IEntityConstructor'
import { IPaginatedQueryResult } from '../../interfaces/IPaginatedQueryResult'

interface IHashMap<T> {
  [key: string]: T[]
}

export class SegregatedMongodbEventRepository<TEntity extends SegregatedEventEntity<TEntity>> extends EventRepository<TEntity> {
  protected readonly _stateCollection: Collection
  protected readonly _eventCollection: Collection

  constructor (stateCollection: Collection, eventCollection: Collection, Entity: IEntityConstructor<TEntity>) {
    super(Entity)
    this._stateCollection = stateCollection
    this._eventCollection = eventCollection
  }

  /**
   * Tries to execute function using given session
   * @param {Function} fn Function to be executed
   * @param {ClientSession} session MongoDB user session
   * @returns {*} Function result
   */
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


  async findById (id: string | ObjectId): Promise<TEntity | null> {
    const events = await this._eventCollection.find({ entityId: new ObjectId(id) })
      .toArray()

    if (!events.length) {
      return null
    }

    return new this._Entity().setPersistedEvents(events)
  }

  async hasEvents (query: { [ key: string ]: any }): Promise<boolean> {
    return this._eventCollection.find(query)
      .count()
      .then(count => count > 0)
  }

  async hasState (query: { [ key: string ]: any }): Promise<boolean> {
    return this._stateCollection.find(query)
      .limit(1)
      .count()
      .then(count => count > 0)
  }

  async existBy (query: { [ key: string ]: any }): Promise<boolean> {
    const [ hasEvents, hasState ] = await Promise.all([
      this.hasEvents(query),
      this.hasState(query)
    ])

    return hasEvents && hasState
  }

  private async _updateState (entity: TEntity, session?: ClientSession): Promise<TEntity> {
    const { id: _id, ...state } = entity.state

    await this._stateCollection.updateOne({ _id: entity.id }, {
      $set: { _id, ...state }
    }, { session })

    return entity
  }

  async save (entity: TEntity, force: boolean = false, session?: ClientSession): Promise<TEntity> {
    const events = force ? entity.events : entity.pendingEvents

    if (force) await this._eventCollection.remove({ entityId: entity.id }, { session })

    await this._eventCollection.insertMany(events, { ordered: true, session })

    entity.confirmEvents()

    if (await this.hasState({ _id: entity.id })) {
      return this._updateState(entity, session)
    }

    await this._stateCollection.insertOne(entity.state, { session })

    return entity
  }

  async _runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [field: string]: 1 | -1 } = {}): Promise<IPaginatedQueryResult<{ events: ISegregatedEvent<unknown>[] }>> {
    const skip = (Number(page) - 1) * Number(size)
    const limit = Number(size)

    const total = await this._stateCollection.countDocuments(query)

    if (total === 0) return { documents: [], count: 0, range: { from: 0, to: 0 }, total }

    const entityIds = await this._stateCollection.find(query, { skip, limit, projection: { _id: 1 }, sort })
      .toArray()
      .then(states => states.map(({ _id }: { _id: ObjectId }) => _id.toHexString()))

    const events = await this._eventCollection.find({ entityId: { $in: entityIds } }, { skip, limit, projection: { events: 1 }, sort }).toArray()

    const eventsHashMap: IHashMap<ISegregatedEvent<unknown>> = events.reduce((hashMap: IHashMap<ISegregatedEvent<unknown>>, event: ISegregatedEvent<unknown>) => {
      hashMap[event.entityId as string] = hashMap[event.entityId as any] || []
      hashMap[event.entityId as string].push(event)
      return hashMap
    }, {})

    const documents = Object.values(eventsHashMap).map(events => ({ events }))

    const count = entityIds.length
    const range = { from: skip, to: skip + count }

    return { documents, count, range, total }
  }

  withSession (session: ClientSession) {
    return {
      save: (entity: TEntity, force: boolean = false) => this._tryRunningWithSession(() => this.save(entity, force, session), session)
    }
  }
}
