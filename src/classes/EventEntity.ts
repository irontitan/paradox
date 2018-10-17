import { IEvent, Reducer, ICommitFunction } from '@nxcd/tardis'
import { IEventEntity } from '../interfaces/IEventEntity'

export class EventEntity<TEntity> implements IEventEntity {
  persistedEvents: IEvent[] = []
  pendingEvents: IEvent[] = []
  id: any = null

  protected _reducer: Reducer<TEntity>

  constructor (knownEvents: { [eventName: string]: ICommitFunction<TEntity, any> }) {
    this._reducer = new Reducer<TEntity>(knownEvents)
  }

  get state (): any {
    throw new Error('Method not implemented.')
  }

  setPersistedEvents (events: IEvent[]) {
    this.persistedEvents = events
    return this
  }

  pushNewEvents (events: IEvent[]) {
    this.pendingEvents = this.pendingEvents.concat(events)
    return this
  }

  confirmEvents () {
    this.persistedEvents = this.persistedEvents.concat(this.pendingEvents)
    this.pendingEvents = []
    return this
  }
}
