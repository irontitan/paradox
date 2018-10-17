export interface IEventRepository<Entity> {
  save (entity: Entity): Promise<Entity>
  findById (id: any): Promise<Entity | null>
}
