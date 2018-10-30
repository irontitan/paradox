export interface IPaginatedQueryResult<TDocument> {
  documents: TDocument[]
  count: number
  range: { from: number, to: number }
  total: number
}
