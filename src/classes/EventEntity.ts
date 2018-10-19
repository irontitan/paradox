import { IEvent, Reducer, ICommitFunction } from '@nxcd/tardis'
import { IEventEntity } from '../interfaces/IEventEntity'

export abstract class EventEntity<TEntity> implements IEventEntity {
  persistedEvents: IEvent<any>[] = []
  pendingEvents: IEvent<any>[] = []
  id: any = null

  protected reducer: Reducer<TEntity>

  constructor(knownEvents: { [ eventName: string ]: ICommitFunction<TEntity, any> }) {
    this.reducer = new Reducer<TEntity>(knownEvents)
  }

  get state(): any {
    throw new Error('Method not implemented.')
  }

  setPersistedEvents(events: IEvent<any>[]) {
    this.persistedEvents = events
    return this
  }

  pushNewEvents(events: IEvent<any>[]) {
    this.pendingEvents = this.pendingEvents.concat(events)
    return this
  }

  confirmEvents() {
    this.persistedEvents = this.persistedEvents.concat(this.pendingEvents)
    this.pendingEvents = []
    return this
  }
}
