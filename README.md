# Event Sourcing Toolkit

> Conjunto de ferramentas para poder ajudar os desenvolvedores a utilizar event sourcing

[![pipeline status](http://gitlab.nxcd.com.br/nxcd/event-sourcing-toolkit/badges/master/pipeline.svg)](http://gitlab.nxcd.com.br/nxcd/event-sourcing-toolkit/commits/master)

## Sumário

<!-- TOC -->

- [Event Sourcing Toolkit](#event-sourcing-toolkit)
  - [Sumário](#sumário)
  - [Instalação](#instalação)
  - [Exemplo](#exemplo)
    - [Evento PersonWasCreated.ts](#evento-personwascreatedts)
    - [Event PersonEmailChanged.ts](#event-personemailchangedts)
    - [Classe Person.ts](#classe-personts)
    - [Juntando as partes](#juntando-as-partes)
  - [O que o toolkit contém?](#o-que-o-toolkit-contém)
  - [EventEntity](#evententity)
  - [Repositórios](#repositórios)
    - [MongodbEventRepository](#mongodbeventrepository)
      - [Sessões](#sessões)
  - [Interfaces](#interfaces)
    - [IPaginatedQueryResult](#ipaginatedqueryresult)

<!-- /TOC -->

## Instalação

```sh
$ pnpm i @nxcd/event-sourcing-toolkit
```

## Exemplo

### Evento PersonWasCreated.ts

Evento que será incluso na classe Person.

```ts
import { Event } from '@nxcd/tardis'
import { Person } from './classes/Person'
import ObjectId from 'bson-objectid'

interface IPersonCreationParams {
  id?: ObjectId
  name: string
  email: string
}

class PersonWasCreated extends Event<IPersonCreationParams> {
  static readonly eventName: string = 'person-was-created'
  user: string

  constructor(data: IPersonCreationParams, user: string) {
    super(PersonWasCreated.eventName, data)
    this.user = user
  }

  static commit(state: Person, event: PersonWasCreated) {
    state.id = event.data.id
    state.name = event.data.name
    state.email = event.data.email
    state.updatedAt = event.timestamp
    state.updatedBy = event.user

    return state
  }
}
```

### Event PersonEmailChanged.ts

Evento a ser chamado quando o email de uma pessoa muda

```ts
import { Event } from '@nxcd/tardis'
import { Person } from './classes/Person'
import ObjectId from 'bson-objectid'

interface IPersonEmailChangeParams {
  newEmail: string
}

class PersonEmailChanged extends Event<IPersonEmailChangeParams> {
  static readonly eventName: string = 'person-email-changed'
  user: string

  constructor(data: IPersonEmailChangeParams, user: string) {
    super(PersonWasCreated.eventName, data)
    this.user = user
  }

  static commit(state: Person, event: PersonEmailChanged) {
    state.email = event.data.newEmail
    state.updatedAt = event.timestamp
    state.updatedBy = event.user

    return state
  }
}
```

> **Importante**
> - O método `commit` esta na classe mas ele não precisa estar localizado nela
> - A propriedade `eventName` é obrigatória

### Classe Person.ts

Entidade principal de Pessoa, no exemplo.

```ts
import ObjectId from 'bson-objectid'
import { EventEntity } from '@nxcd/event-sourcing-toolkit'
import { PersonWasCreated } from './events/PersonWasCreated'
import { PersonEmailChanged } from './events/PersonEmailChanged'

export class Person extends EventEntity<Person> {
  name: string | null = null
  email: string | null = null
  updatedAt: Date | null = null
  updatedBy: string | null = null
  static readonly collection: string = 'people'

  constructor() {
    super({
      [ PersonWasCreated.eventName ]: PersonWasCreated.commit
    })
  }

  static create (email: string, name: string, user: string): Person { // Método para criar uma pessoa
    const id = new ObjectId()
    const person = new Person()
    person.pushNewEvents([ new PersonWasCreated({id, name, email}, user) ]) // Inclui um novo evento ao criar
    return person // Retorna a nova instancia
  }

  changeEmail (newEmail: string, user: string) {
    this.pushNewEvents([ new PersonEmailChanged({ newEmail }, user) ])
    return this
  }

  get state() {
    const currentState = this.reducer.reduce(new Person, [
      ...this.persistedEvents,
      ...this.pendingEvents
    ])

    return {
      id: currentState.id,
      name: currentState.name,
      email: currentState.email
    }
  }
}
```

### Juntando as partes

```ts
import { Db, MongoClient } from 'mongodb'
import { Person } from './classes/Person'

class PersonRepository extends MongodbEventRepository<Person> {
  constructor(connection: Db) {
    super(connection.collection(Person.collection), Person)
  }

  async search (filters: { name: string }, page: number = 1, size: number = 50) {
    const query = filters.name
      ? { 'state.name': filters.name }
      : { }

    const { documents, count, range, total } = await this._runPaginatedQuery(query, page, size)
    const entities = documents.map(({ events }) => new Person().setPersistedEvents(events))

    return { entities, count, range, total }
  }
}

(async function () {
  const connection = (await MongoClient.connect('mongodb://urldomongodbaqui')).db('crowd')
  const personRepository = new PersonRepository(connection)
  const johnDoe = Person.create('johndoe@doe.com', 'jdoe')
  await personRepository.save(johnDoe) // Criará um novo evento na classe
  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Retornará um objeto que segue [IPaginatedQueryResult](#ipaginatedqueryresult)

  // Por algum motivo, podemos desejar atualizar mais de uma entidade ao mesmo tempo
  johnDoe.changeEmail({ newEmail: 'johndoe@company.com' }, 'jdoe')
  const [ janeDoe ] = allJanes
  janeDoe.changeEmail({ newEmail: 'janedoe@doe.com' }, 'janedoe')

  await personRepository.bulkUpdate([ johnDoe, janeDoe ]) // Atualiza ambas as entidades no banco utilizando bulkWrite
})() // IIFE só para criar o escopo e utilizar async/await
```

## O que o toolkit contém?

- `EventEntity`: Classe para uma entidade que já é baseada em eventos
- `MongoDBEventRepository`: Repositório baseado em eventos para MongoDB
- Interfaces para auxiliar na tipagem

## EventEntity

Uma entidade de evento é uma classe de negócio que possui a implementação dos eventos do Event Sourcing. Toda entidade deve estender `EventEntity`, pois a mesma é uma classe abstrata, então a nova classe possuirá uma série de propriedades:

- `persistedEvents`: Será um array de eventos no formato `{id, name, data, timestamp}` de eventos que já foram salvos no banco de dados
- `pendingEvents`: Será um array de eventos que ainda não foram salvos no banco de dados

Ao ser criada, a entidade vai receber um objeto cuja chave é um nome de um evento e o valor é sua função `commit`, esta função pode estar localizada em qualquer lugar, no nosso exemplo acima está localizada como um método estático dentro da própria entidade. Isso deve ser feito para todos os eventos que aquela entidade pode ter, pois, ao ser criada, a `EventEntity` vai criar uma instancia de um Reducer em `this.reducer` passando estes eventos conhecidos para ele de forma que será possível fazer a gerência do evento de dentro da própria classe e não será necessário instanciar nada de fora.

Esta classe também possui um getter que **deve** ser implementado, chamado `state`. Este getter deve ser sempre sobrescrito pela implementação da classe filha e será responsável por reduzir o estado anterior para o estado atual trazendo sempre o último estado, assim como fizemos no exemplo.

Além do `state` a classe disponibilizará uma série de outros métodos como:

- `setPersistedEvents`: Que receberá um array de eventos no formato `{id, name, data, timestamp}` vindos do banco de dados e incluirá estes eventos no array `persistedEvents`, este método será muito utilizado quando carregamos uma classe pela primeira vez a partir do banco de dados
- `pushNewEvents`: Receberá um array de eventos no mesmo formato `{id, name, data, timestamp}` e irá incluir este array no array de `pendingEvents`, notificando que existem registros que ainda não foram salvos no banco de dados e estão disponíveis somente dentro da classe.
- `confirmEvents`: Irá passar todos os registros de `pendingEvents` para `persistedEvents`, confirmando que os eventos foram salvos no banco de dados, este método será muito utilizado depois de salvar o último estado da entidade no banco.

## Repositórios

Repositórios são locais onde os dados residem, por padrão não precisaríamos ter um modelo de classe para eles, mas podemos utilizar isto somente para padronização dos eventos no banco. Como podemos ter um repositório diferente para cada tipo de banco de dados então vamos listar abaixo os disponíveis por enquanto.

### MongodbEventRepository

Repositório de dados feito para trabalhar com o MongoDB. Este repositório **deve** estendido por outra classe implementando seus próprios métodos. A classe possui algumas propriedades quando é instanciada:\

- Deverá receber o objeto `Collection` do Mongo (não o nome)
- Deverá receber o construtor da entidade (não a instancia)

Por padrão a classe já possui alguns métodos base:

- `save (entity: TEntity)`: Que irá serializar e salvar a entidade passada (que deve ser do mesmo tipo passado quando estendido em `MongodbEventRepository<TEntity>`) no banco de dados. Primeiramente o método tentará encontrar a entidade pelo seu ID, se a classe não existir então uma nova linha será criada no modelo `{_id, events, state}` onde `events` começará como um array vazio e a cada `save` será incrementado e concatenado com o array de `pendingEvents` (logo depois dessa operação o método `confirmEvents` da entidade será chamado, zerando o array de `pendingEvents`), `state` será o último estado reduzido da entidade, que será obtido chamando o getter `state` que falamos na seção anterior.
- `findById (id: ObjectId)`: Irá buscar na base de dados um registro com o `id` informado em `ObjectId` que será criado pelo evento quando a classe for instanciada através do método `create`
- `bulkUpdate (entities: IEventEntity[])`: Salva os eventos de várias instâncias de uma entidade de uma vez só
- `withSession (session: ClientSession)`: Inicia uma sessão de usuário para criação de transações (somente MongoDB 4.0), retorna um objeto com os métodos disponíveis para serem rodados em uma sessão. Se o comando subsequente possuir um erro a sessão será abortada, caso contrário será enviada
- `_runPaginatedQuery (query: { [key: string]: any }, page: number, size: number, sort: { [key: string]: 1|-1 } = {})`: Executa uma query e aplica paginação, retornando um objeto que obedece a interface [IPaginatedQueryResult](#ipaginatedqueryresult)

#### Sessões

Se a versão do MongoDB for 4.0 ou superior (com suporte a transações), para rodar um comando utilizando a estrutura de transações siga o exemplo:

```ts
import { Db, MongoClient } from 'mongodb'
import { Person } from './classes/Person'

class PersonRepository extends MongodbEventRepository<Person> {
  constructor(connection: Db) {
    super(connection.collection(Person.collection), Person)
  }

  async search (filters: { name: string }, page: number = 1, size: number = 50) {
    const query = filters.name
      ? { 'state.name': filters.name }
      : { }

    const { documents, count, range, total } = await this._runPaginatedQuery(query, page, size)
    const entities = documents.map(({ events }) => new Person().setPersistedEvents(events))

    return { entities, count, range, total }
  }
}

(async function () {
  const connection = (await MongoClient.connect('mongodb://urldomongodbaqui')).db('crowd')
  const personRepository = new PersonRepository(connection)
  const johnDoe = Person.create('johndoe@doe.com', 'jdoe')
  await personRepository.save(johnDoe) // Criará um novo evento na classe
  const allJanes = await personRepository.search({ name: 'jane' }, 1, 10) // Retornará um objeto que segue [IPaginatedQueryResult](#ipaginatedqueryresult)

  johnDoe.changeEmail({ newEmail: 'johndoe@company.com' }, 'jdoe')
  const [ janeDoe ] = allJanes
  janeDoe.changeEmail({ newEmail: 'janedoe@doe.com' }, 'janedoe')

  const session = connection.startSession()
  await personRepository.withSession(session).bulkUpdate([ johnDoe, janeDoe ]) // Atualiza ambas as entidades no banco utilizando bulkWrite usando uma transação
})()
```

> Se a sua versão do MongoDB **não** suportar transações, um erro por parte de banco de dados será enviado.

## Interfaces

### IPaginatedQueryResult

Representa os resultados de uma consulta com paginação. Sua definição é a seguinte:

```ts
interface IPaginatedQueryResult<TDocument> { // TDocument é o tipo que representa os dados que serão retornados do banco de dados; utilizado internamente pelo repository
  documents: TDocument[] // Documentos da página atual
  count: number // Quantidade de resultados retornados
  range: {
    from: number, // Índice do primeiro resultado
    to: number // Índice do último resultado
  }
  total: number // Quantidade total de resultados
}
```
