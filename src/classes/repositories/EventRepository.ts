import { IEvent } from '@nxcd/tardis'
import { IEventEntity } from '../../interfaces/IEventEntity'
import { IEntityConstructor } from '../../interfaces/IEntityConstructor'
import { IPaginatedQueryResult } from '../../interfaces/IPaginatedQueryResult'

export abstract class EventRepository<TEntity extends IEventEntity> {

  protected readonly _Entity: IEntityConstructor<TEntity>

  constructor (Entity: IEntityConstructor<TEntity>) {
    this._Entity = Entity
  }

  abstract async save (entity: TEntity): Promise<TEntity>

  abstract async findById (id: any): Promise<TEntity | null>

  abstract async _runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [field: string]: 1 | -1 }): Promise<IPaginatedQueryResult<{ events: IEvent<TEntity>[] }>>
}