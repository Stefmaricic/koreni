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
    date: '2026-09-29',
    cyrl: [
      'Нове улоге на стаблу: Администратор, Уредник и Посматрач',
      'Уредник бира коју особу на стаблу представља и може да уређује само своју ужу породицу (означену зеленим оквиром)',
      'Сви чланови сада виде ко је на стаблу и коју улогу има',
      'Администратор може да мења улогу постојећег члана',
      'PDF извоз је сада оштар на било ком увећању и аутоматски дели велика стабла на више страна за штампу',
      'Поправљена ћирилица у PDF извозу',
      'Поправљено приказивање године смрти када недостаје година рођења',
    ],
    latn: [
      'Nove uloge na stablu: Administrator, Urednik i Posmatrač',
      'Urednik bira koju osobu na stablu predstavlja i može da uređuje samo svoju užu porodicu (označenu zelenim okvirom)',
      'Svi članovi sada vide ko je na stablu i koju ulogu ima',
      'Administrator može da menja ulogu postojećeg člana',
      'PDF izvoz je sada oštar na bilo kom uvećanju i automatski deli velika stabla na više strana za štampu',
      'Popravljena ćirilica u PDF izvozu',
      'Popravljeno prikazivanje godine smrti kada nedostaje godina rođenja',
    ],
  },
  {
    date: '2026-09-28',
    cyrl: [
      'Могућност уклањања чланова са породичног стабла',
      'Историја измена стабла — ко је шта променио и када',
      'Нов, органски распоред стабла — сада заиста личи на дрво',
      'Ручно померање особа на стаблу превлачењем',
      'Поправљено сецкање презимена код особа са сликом',
      'Поправљено случајно означавање текста при померању стабла',
    ],
    latn: [
      'Mogućnost uklanjanja članova sa porodičnog stabla',
      'Istorija izmena stabla — ko je šta promenio i kada',
      'Nov, organski raspored stabla — sada zaista liči na drvo',
      'Ručno pomeranje osoba na stablu prevlačenjem',
      'Popravljeno sečkanje prezimena kod osoba sa slikom',
      'Popravljeno slučajno označavanje teksta pri pomeranju stabla',
    ],
  },
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
