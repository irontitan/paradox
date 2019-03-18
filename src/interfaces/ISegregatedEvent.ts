import { IEvent } from '@nxcd/tardis'

export interface ISegregatedEvent<TData> extends IEvent<TData> {
    entityId: any
}
