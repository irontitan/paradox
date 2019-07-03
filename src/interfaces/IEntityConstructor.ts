import { IEvent } from '@irontitan/tardis'

export interface IEntityConstructor<Entity> {
    new(events?: IEvent<any>[]): Entity
}
