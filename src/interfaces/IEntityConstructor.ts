import { IEvent } from '@nxcd/tardis'

export interface IEntityConstructor<Entity> {
    new(events?: IEvent<any>[]): Entity
}
