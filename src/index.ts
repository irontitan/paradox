export { Event, ICommitFunction, IEvent, Reducer } from '@nxcd/tardis'

/**
 * Classes
 * =======
 */
export { EventEntity } from './classes/EventEntity'
export { SegregatedEventEntity } from './classes/SegregatedEventEntity'
export { EventRepository } from './classes/repositories/EventRepository'
export { MongodbEventRepository } from './classes/repositories/MongodbEventRepository'
export { SegregatedMongodbEventRepository } from './classes/repositories/SegregatedMongodbEventRepository'

 /**
  * Interfaces
  */
export { IEventEntity } from './interfaces/IEventEntity'
export { ISegregatedEvent } from './interfaces/ISegregatedEvent'
export { IEntityConstructor } from './interfaces/IEntityConstructor'
export { IPaginatedQueryResult } from './interfaces/IPaginatedQueryResult'
