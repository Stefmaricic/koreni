import type { MemberGender } from '@/types/models'

export interface DemoPerson {
  key: string
  firstName: string
  lastName?: string
  maidenName?: string
  gender: MemberGender
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  bio?: string
}

export interface DemoEdge {
  type: 'parent' | 'partner'
  /** parent -> child for 'parent'; either order for 'partner' */
  a: string
  b: string
}

// A four-generation demo family used to stress-test the tree layout. This
// data is intentionally separate from anything a real user creates — it is
// only ever inserted by seedDemoTree() into a tree flagged is_demo = true.
export const DEMO_PEOPLE: DemoPerson[] = [
  // Generation 0 — great-grandparents
  { key: 'jovan', firstName: 'Jovan', lastName: 'Marić', gender: 'male', birthDate: '1945-03-12', deathDate: '2019-06-02', birthPlace: 'Užice', bio: 'A carpenter who built half the houses on his street.' },
  { key: 'zorka', firstName: 'Zorka', lastName: 'Marić', maidenName: 'Radović', gender: 'female', birthDate: '1948-09-25', birthPlace: 'Užice' },

  // Generation 1 — grandparents
  { key: 'radovan', firstName: 'Radovan', lastName: 'Marić', gender: 'male', birthDate: '1970-01-14', birthPlace: 'Užice' },
  { key: 'ljubica', firstName: 'Ljubica', lastName: 'Marić', maidenName: 'Ilić', gender: 'female', birthDate: '1972-11-03', birthPlace: 'Čačak' },
  { key: 'desanka', firstName: 'Desanka', lastName: 'Popović', maidenName: 'Marić', gender: 'female', birthDate: '1974-05-19', birthPlace: 'Užice' },
  { key: 'milutin', firstName: 'Milutin', lastName: 'Popović', gender: 'male', birthDate: '1971-07-08', birthPlace: 'Kraljevo' },

  // Generation 2 — parents
  { key: 'stefan', firstName: 'Stefan', lastName: 'Marić', gender: 'male', birthDate: '1995-02-20', birthPlace: 'Beograd' },
  { key: 'ana', firstName: 'Ana', lastName: 'Marić', maidenName: 'Kovač', gender: 'female', birthDate: '1996-08-11', birthPlace: 'Novi Sad' },
  { key: 'marija', firstName: 'Marija', lastName: 'Marić', gender: 'female', birthDate: '1997-12-01', birthPlace: 'Beograd', bio: 'Loves hiking and photography.' },
  { key: 'petar', firstName: 'Petar', lastName: 'Marić', gender: 'male', birthDate: '1999-04-27', birthPlace: 'Beograd' },
  { key: 'sofija', firstName: 'Sofija', lastName: 'Marić', maidenName: 'Vuković', gender: 'female', birthDate: '2000-10-09', birthPlace: 'Niš' },
  { key: 'ivana', firstName: 'Ivana', lastName: 'Popović', gender: 'female', birthDate: '1996-06-30', birthPlace: 'Kraljevo' },
  { key: 'marko', firstName: 'Marko', lastName: 'Đukić', gender: 'male', birthDate: '1994-03-15', birthPlace: 'Kragujevac' },
  { key: 'filip', firstName: 'Filip', lastName: 'Popović', gender: 'male', birthDate: '1999-09-22', birthPlace: 'Kraljevo' },

  // Generation 3 — children
  { key: 'luka', firstName: 'Luka', lastName: 'Marić', gender: 'male', birthDate: '2018-05-17', birthPlace: 'Beograd' },
  { key: 'mila', firstName: 'Mila', lastName: 'Marić', gender: 'female', birthDate: '2021-07-04', birthPlace: 'Beograd' },
  { key: 'nemanja', firstName: 'Nemanja', lastName: 'Marić', gender: 'male', birthDate: '2022-11-11', birthPlace: 'Beograd' },
  { key: 'teodora', firstName: 'Teodora', lastName: 'Đukić', gender: 'female', birthDate: '2019-02-28', birthPlace: 'Kragujevac' },
]

export const DEMO_EDGES: DemoEdge[] = [
  // partners
  { type: 'partner', a: 'jovan', b: 'zorka' },
  { type: 'partner', a: 'radovan', b: 'ljubica' },
  { type: 'partner', a: 'desanka', b: 'milutin' },
  { type: 'partner', a: 'stefan', b: 'ana' },
  { type: 'partner', a: 'petar', b: 'sofija' },
  { type: 'partner', a: 'ivana', b: 'marko' },

  // generation 0 -> 1
  { type: 'parent', a: 'jovan', b: 'radovan' },
  { type: 'parent', a: 'zorka', b: 'radovan' },
  { type: 'parent', a: 'jovan', b: 'desanka' },
  { type: 'parent', a: 'zorka', b: 'desanka' },

  // generation 1 -> 2
  { type: 'parent', a: 'radovan', b: 'stefan' },
  { type: 'parent', a: 'ljubica', b: 'stefan' },
  { type: 'parent', a: 'radovan', b: 'marija' },
  { type: 'parent', a: 'ljubica', b: 'marija' },
  { type: 'parent', a: 'radovan', b: 'petar' },
  { type: 'parent', a: 'ljubica', b: 'petar' },
  { type: 'parent', a: 'desanka', b: 'ivana' },
  { type: 'parent', a: 'milutin', b: 'ivana' },
  { type: 'parent', a: 'desanka', b: 'filip' },
  { type: 'parent', a: 'milutin', b: 'filip' },

  // generation 2 -> 3
  { type: 'parent', a: 'stefan', b: 'luka' },
  { type: 'parent', a: 'ana', b: 'luka' },
  { type: 'parent', a: 'stefan', b: 'mila' },
  { type: 'parent', a: 'ana', b: 'mila' },
  { type: 'parent', a: 'petar', b: 'nemanja' },
  { type: 'parent', a: 'sofija', b: 'nemanja' },
  { type: 'parent', a: 'ivana', b: 'teodora' },
  { type: 'parent', a: 'marko', b: 'teodora' },
]
