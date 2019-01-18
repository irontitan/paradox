import { IEvent, Reducer, ICommitFunction } from '@nxcd/tardis'
import { IEventEntity } from '../interfaces/IEventEntity'
import { IEntityConstructor } from '../interfaces/IEntityConstructor';

export abstract class EventEntity<TEntity> implements IEventEntity {
  [key: string]: any
  persistedEvents: IEvent<any>[] = []
  pendingEvents: IEvent<any>[] = []
  id: any = null

  protected reducer: Reducer<TEntity>
  protected _Entity?: IEntityConstructor<TEntity>

  constructor (knownEvents: { [eventName: string]: ICommitFunction<TEntity, any> }, entity?: IEntityConstructor<TEntity>) {
    this.reducer = new Reducer<TEntity>(knownEvents)

    // TODO: Remove this on next major version
    if (!entity) {
      console.warn("[@nxcd/paradox] DEPRECATED: Calling EventEntity's constructor without passing the Entity constructor is deprecated and will stop being supported soon")
      return
    }

    this._Entity = entity
  }

  get state (): any {
    throw new Error('Method not implemented.')
  }

  private updateState () {
    const state = this._Entity
      ? this.reducer.reduce(new this._Entity(), [ ...this.pendingEvents, ...this.persistedEvents ])
      : this.state

    for (const propertyName of Object.keys(state)) {
      this[propertyName] = state[propertyName]
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
