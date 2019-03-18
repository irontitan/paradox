import { EventEntity } from './EventEntity'
import { Reducer, ICommitFunction } from '@nxcd/tardis'
import { ISegregatedEvent } from '../interfaces/ISegregatedEvent'

export abstract class SegregatedEventEntity<TEntity> extends EventEntity<TEntity> {
  persistedEvents: ISegregatedEvent<any>[] = []
  pendingEvents: ISegregatedEvent<any>[] = []

  constructor (knownEvents: { [ eventName: string ]: ICommitFunction<TEntity, ISegregatedEvent<any>> }) {
    super(knownEvents)
    this.reducer = new Reducer<TEntity>(knownEvents)
  }

  setPersistedEvents (events: ISegregatedEvent<any>[]) {
    return super.setPersistedEvents(events)
  }

  pushNewEvents (events: ISegregatedEvent<any>[]) {
    return super.pushNewEvents(events)
  }

}
