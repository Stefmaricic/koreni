export interface ChangelogEntry {
  /** ISO date (yyyy-mm-dd) — kept separate from display formatting. */
  date: string
  cyrl: string[]
  latn: string[]
}

// Newest first. Add one entry here whenever something user-visible ships —
// short bullet phrases, the way you'd casually tell someone what's new.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-27',
    cyrl: [
      'Позивање чланова породице да заједно уређују стабло',
      'Дугме за пријаву проблема и предлога',
      'Линк ка Трело табли испод новости',
      'Поправљен пад апликације при брзом померању стабла',
      'Имејл потврда налога сада у Корени дизајну',
    ],
    latn: [
      'Pozivanje članova porodice da zajedno uređuju stablo',
      'Dugme za prijavu problema i predloga',
      'Link ka Trello tabli ispod novosti',
      'Popravljen pad aplikacije pri brzom pomeranju stabla',
      'Imejl potvrda naloga sada u Koreni dizajnu',
    ],
  },
  {
    date: '2026-09-26',
    cyrl: [
      'Додат dark mode (тамна тема)',
      'Додата могућност експортовања породичног стабла (SVG, PNG, PDF)',
      'Стабло сада почиње од најстаријег претка',
    ],
    latn: [
      'Dodat dark mode (tamna tema)',
      'Dodata mogućnost exportovanja porodičnog stabla (SVG, PNG, PDF)',
      'Stablo sada počinje od najstarijeg pretka',
    ],
  },
  {
    date: '2026-09-24',
    cyrl: [
      'Покренут Корени',
      'Регистрација и пријава',
      'Прављење породичних стабала',
      'Додавање и повезивање рођака',
      'Подршка за српски језик (ћирилица и латиница)',
    ],
    latn: [
      'Pokrenut Koreni',
      'Registracija i prijava',
      'Pravljenje porodičnih stabala',
      'Dodavanje i povezivanje rođaka',
      'Podrška za srpski jezik (ćirilica i latinica)',
    ],
  },
]
