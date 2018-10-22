import { IEvent, Reducer, ICommitFunction } from '@nxcd/tardis'
import { IEventEntity } from '../interfaces/IEventEntity'

export abstract class EventEntity<TEntity> implements IEventEntity {
  [key: string]: any
  persistedEvents: IEvent<any>[] = []
  pendingEvents: IEvent<any>[] = []
  id: any = null

  protected reducer: Reducer<TEntity>

  constructor (knownEvents: { [eventName: string]: ICommitFunction<TEntity, any> }) {
    this.reducer = new Reducer<TEntity>(knownEvents)
  }

  get state (): any {
    throw new Error('Method not implemented.')
  }

  private updateState () {
    for (const propertyName of Object.keys(this.state)) {
      this[propertyName] = this.state[propertyName]
    }
  }

  setPersistedEvents (events: IEvent<any>[]) {
    this.persistedEvents = events
    this.updateState()
    return this
  }

  pushNewEvents (events: IEvent<any>[]) {
    this.pendingEvents = this.pendingEvents.concat(events)
    this.updateState()
    return this
  }

  confirmEvents () {
    this.persistedEvents = this.persistedEvents.concat(this.pendingEvents)
    this.pendingEvents = []
    return this
  }
}
