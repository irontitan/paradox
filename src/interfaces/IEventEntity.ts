import { IEvent } from '@nxcd/tardis'

export interface IEventEntity {
  id: any
  state: any
  persistedEvents: IEvent<any>[]
  pendingEvents: IEvent<any>[]
  /**
   * Pushes new events to the "Pending Events" array
   * @param {IEvent<any>[]} events Array of events to add to pendingEvents
   * @returns {Entity} The entity with the new events pushed to the "Pending Events" array
   */
  pushNewEvents (events: IEvent<any>[]): any
  /**
   * Sets the persisted events array with the parameters passed
   * @param {IEvent<any>[]} events The array of persisted events
   * @returns {Entity} The entity loaded with the persisted events
   */
  setPersistedEvents (events: IEvent<any>[]): any
  /**
   * Moves all pending events to the normal events array
   * @returns {Entity} The entity with the new state and with no pending events
   */
  confirmEvents (): any
}
