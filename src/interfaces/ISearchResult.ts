export interface ISearchResult<Entity> {
  entities: Entity[]
  count: number
  range: {
    from: number
    to: number
  }
  total: number
}
