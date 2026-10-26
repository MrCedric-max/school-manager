/* École Azobe — structure extracted from the Drive workbooks
   Canonical source: "School_Manager" (244 pupils). Working copy: "TRUE MANANGER" (241, with recorded CM1 data).
   Calendar source: "Azobe Calendrier_scolaire_2026_2027 (2).xlsx". */
window.SCHOOL = {
  name: "ÉCOLE AZOBE",
  system: "AZOBE – EFEDI",
  year: "2026/2027",
  workbookAsOf: "2026-10-12",
  schoolDays: 180,
  firstWeekMonday: "2026-09-07",
  classes: [
    { name: "SIL", code: "SIL", enrolled: 27, level: "Primary / Primaire" },
    { name: "CP", code: "CP", enrolled: 17, level: "Primary / Primaire" },
    { name: "CE1", code: "CE1", enrolled: 23, level: "Primary / Primaire" },
    { name: "CE2", code: "CE2", enrolled: 27, level: "Primary / Primaire" },
    { name: "CM1", code: "CM1", enrolled: 27, level: "Primary / Primaire" },
    { name: "CM2", code: "CM2", enrolled: 26, level: "Primary / Primaire" },
    { name: "6ème", code: "6EME", enrolled: 29, level: "Secondary / Collège" },
    { name: "5ème", code: "5EME", enrolled: 22, level: "Secondary / Collège" },
    { name: "4ème", code: "4EME", enrolled: 13, level: "Secondary / Collège" },
    { name: "3ème", code: "3EME", enrolled: 15, level: "Secondary / Collège" },
    { name: "2nde", code: "2ND", enrolled: 18, level: "Secondary / Lycée" }
  ],
  totalEnrolled: 244,
  workingCopy: {
    file: "TRUE MANANGER.xlsx", totalEnrolled: 241,
    note: "Earlier working copy with real recorded data. Differences vs canonical roll: CE2 26, CM1 26, CM2 25 (241 total).",
    recorded: {
      classFocus: "CM1", attendanceRate: 97.8,
      roll: { P: 636, A: 13, L: 0, E: 1 },
      weeklyControls: { "English Language": 12.38, "French Language": 11.25, "Mathematics": null, "Science & Technology": null },
      dailyPerformance: { "Assignments": 9.2, "Class participation": 7.64, "Order": 9.8, "Discipline": 7.8, "Cleanliness": 8.6, "Respect": 9.54, "Obedience": 9.04 }
    }
  },
  terms: [
    { name: "Term 1", start: "2026-09-07", end: "2026-12-11", weeks: "W1–W14", uaMonths: ["October", "November", "December"] },
    { name: "Term 2", start: "2027-01-04", end: "2027-03-19", weeks: "W18–W28", uaMonths: ["January", "February", "March"] },
    { name: "Term 3", start: "2027-04-05", end: "2027-06-25", weeks: "W31–W42", uaMonths: ["April", "May", "June"] }
  ],
  weeklySubjects: ["English Language", "Mathematics", "French Language", "Science & Technology"],
  dailyAreas: ["Assignments", "Class participation", "Order", "Discipline", "Cleanliness", "Respect", "Obedience"],
  rollMarks: [ { k: "P", label: "Present / Présent" }, { k: "A", label: "Absent / Absent" }, { k: "L", label: "Late / Retard" }, { k: "E", label: "Excused / Excusé" } ],
  cotes: [
    { k: "A+", min: 90, label: "Excellent mastery / Maîtrise excellente" },
    { k: "A", min: 75, label: "Acquired / Acquis" },
    { k: "ECA/B", min: 50, label: "Being acquired / En cours d'acquisition" },
    { k: "NA", min: 0, label: "Not acquired / Non acquis" }
  ],
  overallRule: "Overall score = 70% academic average (competence marks) + 30% daily-performance average (rescaled /20).",
  competences: [
    { code: "1A", comp: "C1 — Languages / Langues", name: "Communiquer en Français", max: 40, monthly: true, criteria: "Orale 10 pts · Écrite 15 pts (savoir-être)" },
    { code: "1B", comp: "C1 — Languages / Langues", name: "Communicate in English", max: 40, monthly: true, criteria: "Oral 20 marks · Written 15 marks (attitudes)" },
    { code: "1C", comp: "C1 — Languages / Langues", name: "Pratiquer une langue nationale / Use a national language", max: 20, monthly: false, criteria: "Orale 10 pts · Écrite 7 pts · Pratique 3 pts" },
    { code: "2A", comp: "C2 — Maths & Sciences", name: "Utiliser les notions de base en mathématiques / Use basic notions in mathematics", max: 30, monthly: true, criteria: "Orale 5 pts · Écrite 20 pts (savoir-être)" },
    { code: "2B", comp: "C2 — Maths & Sciences", name: "Utiliser les notions de base en Sciences et Technologies / Use basic notions in science and technology", max: 30, monthly: true, criteria: "Orale 5 pts · Écrite 5 pts · Pratique 15 pts" },
    { code: "3A", comp: "C3 — Values / Valeurs", name: "Pratiquer les valeurs sociales / Practice of social values", max: 20, monthly: false, criteria: "Orale 3 pts · Écrite 3 pts · Pratique 10 pts" },
    { code: "3B", comp: "C3 — Values / Valeurs", name: "Pratiquer les valeurs citoyennes / Practice of citizenship values", max: 20, monthly: false, criteria: "Orale 5 pts · Écrite 5 pts · Pratique 8 pts" },
    { code: "4A", comp: "C4 — Autonomy / Autonomie", name: "Démontrer l'autonomie, l'esprit d'initiative, de créativité et d'entrepreneuriat / Demonstrate autonomy, initiative, creativity and entrepreneurship", max: 20, monthly: true, criteria: "Orale 5 pts · Écrite · Pratique 10 pts" },
    { code: "5A", comp: "C5 — ICT / TIC", name: "Utiliser les concepts de base et les outils des TIC / Using basic concepts and tools of ICT", max: 20, monthly: true, criteria: "Orale 3 pts · Écrite 3 pts · Pratique 10 pts" },
    { code: "6A", comp: "C6 — Sport & Arts", name: "Pratiquer les activités physiques et sportives / Practise physical sports", max: 20, monthly: false, criteria: "Orale 3 pts · Écrite 3 pts · Pratique 10 pts" },
    { code: "6B", comp: "C6 — Sport & Arts", name: "Pratiquer les activités artistiques / Practise artistic activities", max: 20, monthly: false, criteria: "Orale 4 pts · Écrite 3 pts · Pratique 10 pts" }
  ],
  termTotal: 280, monthTotal: 180
};

/* Class 6 English — Integrated Scheme of Work (EFEDI Schools, Azobe-EFEDI): 8 themes × 4 weeks = 32 weeks.
   Weekly titles transcribed from the scheme's table of contents. */
window.CLASS6_ENGLISH = [
  { theme: 1, title: "Nature", weeks: [ [1,"Sound and Life in Nature"],[2,"Landscapes and Natural Features"],[3,"Weather and Natural Change"],[4,"Nature and Human Connection"] ], project: "Nature Language Journal: descriptive essay, nature poem, 3 persuasive statements on protecting nature, weather dialogue" },
  { theme: 2, title: "The Village/Town", weeks: [ [5,"Describing the Village/Town"],[6,"Roles and Responsibilities"],[7,"Sharing Community Experiences"],[8,"Expressing Village/Town Life"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 3, title: "The School", weeks: [ [9,"School Spaces and Routines"],[10,"People and Duties at School"],[11,"Learning and School Activities"],[12,"Reflecting on School Life"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 4, title: "Occupations", weeks: [ [13,"Local Jobs and Tools"],[14,"Workplace Behavior and Advice"],[15,"Career Choices and Aspirations"],[16,"Presenting Our Work World"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 5, title: "Travelling", weeks: [ [17,"Types of Transport and Direction"],[18,"Safety Rules and Travel Instructions"],[19,"Travel Experience and Perspective"],[20,"Travel and Safety Reflections"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 6, title: "Health and Safety", weeks: [ [21,"Personal Hygiene and Clean Habits"],[22,"Nutrition and Healthy Eating"],[23,"Safety at Home and School"],[24,"Reflecting on Health and Safety"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 7, title: "Sports and Leisure", weeks: [ [25,"Describing Games and Sports"],[26,"Rules and Fair Play"],[27,"Leisure and Free Time"],[28,"Celebrating Sport and Leisure"] ], project: "See the full scheme of work (Drive) for the culminating project" },
  { theme: 8, title: "The Universe and Space", weeks: [ [29,"Observing the Sky"],[30,"The Solar System"],[31,"Space Travel and Imagination"],[32,"Reflecting on Space and Discovery"] ], project: "See the full scheme of work (Drive) for the culminating project" }
];

/* Key dates transcribed from "Calendrier scolaire 2026-2027 — Azobe" (Aug 2026 – Jul 2027 grid). */
window.CALENDAR_EVENTS = [
  { date: "2026-08-03", label: "Rentrée des enseignants (teachers return)", type: "Staff" },
  { date: "2026-08-10", label: "Début des cours de remise à niveau (remedial classes begin)", type: "Teaching" },
  { date: "2026-08-20", label: "Formation – recyclage et préparation de l'année scolaire (teacher training)", type: "Staff" },
  { date: "2026-08-29", label: "Réunion des nouvelles familles (new families meeting)", type: "Parents" },
  { date: "2026-09-07", label: "Rentrée scolaire des élèves — Début de l'Unité d'Apprentissage n°1", type: "Term" },
  { date: "2026-09-11", label: "Messe de rentrée (opening Mass)", type: "School life" },
  { date: "2026-09-26", label: "Réunion des parents primaire et collège (parents meeting, 9h-12h)", type: "Parents" },
  { date: "2026-09-29", label: "Évaluation 1 (primaire)", type: "Evaluation" },
  { date: "2026-10-05", label: "Journée internationale de l'enseignant (World Teachers' Day)", type: "School life" },
  { date: "2026-10-27", label: "Évaluation 2 (primaire)", type: "Evaluation" },
  { date: "2026-11-24", label: "Évaluation trimestrielle primaire (24–26 Nov)", type: "Evaluation" },
  { date: "2026-12-18", label: "Fête de l'école — Noël sous l'AZOBÉ · Départ en congés", type: "School life" },
  { date: "2027-01-01", label: "Jour de l'an (New Year holiday)", type: "Holiday" },
  { date: "2027-01-04", label: "Rentrée du 2ème trimestre (Term 2 begins)", type: "Term" },
  { date: "2027-01-12", label: "Évaluation 4", type: "Evaluation" },
  { date: "2027-02-11", label: "Fête de la Jeunesse (Youth Day)", type: "Holiday" },
  { date: "2027-03-01", label: "Évaluation N°5", type: "Evaluation" },
  { date: "2027-03-25", label: "Départ en congés de Pâques (Easter break; Vendredi saint 26, Pâques 28, L. de Pâques 29)", type: "Holiday" },
  { date: "2027-04-12", label: "Rentrée du 3ème trimestre (Term 3 classes resume — calendar grid)", type: "Term" },
  { date: "2027-05-01", label: "Fête du Travail (Labour Day)", type: "Holiday" },
  { date: "2027-05-20", label: "Fête Nationale (National Day)", type: "Holiday" },
  { date: "2027-05-29", label: "Spectacle de fin d'année · Graduations des CM2 · Départ en vacances", type: "School life" },
  { date: "2027-06-08", label: "Examen du CEP 2027", type: "Exam" },
  { date: "2027-06-12", label: "2ème concours d'entrée en 6e · Début des activités de vacances EXTRA AZOBE HOLIDAYS", type: "Exam" }
];

/* TEST MASTER (Atalay Oguz, Baskent Education) — structure from the book's index.
   Playable questions below are transcribed verbatim from Book 1, Part A, Elementary Tests 1–2. */
window.TESTMASTER = {
  title: "TEST MASTER", author: "Atalay Oguz — Baskent Education Publication", totalQuestions: 16161,
  books: [
    { name: "Book 1 — Grammar", questions: 9246, parts: [
      { part: "A", pages: "2–50", desc: "14 Elementary tests, 14 Pre-Intermediate tests, 8 Intermediate tests — each on a different grammar topic (1,976 questions)" },
      { part: "B", pages: "51–102", desc: "14 tests (Elementary → Upper-intermediate), each focused on a different grammar topic (2,452 questions)" },
      { part: "C", pages: "103–150", desc: "16 multi-level grammar tests, each on a different topic (1,418 questions)" },
      { part: "D", pages: "151–190", desc: "20 multi-level grammar tests for assessment (2,000 questions)" },
      { part: "E", pages: "191–218", desc: "6 Elementary, 5 Intermediate, 3 Advanced tests — same format, level gradually increases (1,400 questions)" } ] },
    { name: "Book 2 — Vocabulary", questions: 5859, parts: [
      { part: "A", pages: "220–250", desc: "Vocabulary tests for new learners (1,657 questions)" },
      { part: "B", pages: "251–286", desc: "Vocabulary for intermediate & upper-intermediate levels (1,988 questions)" },
      { part: "C", pages: "287–302", desc: "Phrasal verbs (714 questions)" },
      { part: "D", pages: "303–327", desc: "25 upper-level vocabulary tests (1,000 questions)" },
      { part: "E", pages: "328–341", desc: "Advanced synonym questions (500 questions)" } ] },
    { name: "Book 3 — Miscellaneous", questions: 1056, parts: [
      { part: "—", pages: "342–401", desc: "Reading comprehension, dialogue building, colloquial & idiomatic expressions (1,056 questions)" } ] }
  ],
  answerKeyPages: "403–431",
  quizzes: [
    { id: "tm-elem-1", title: "Book 1 · Part A · Elementary Test 1 — Verb to be, possessives, pronouns, plurals & numbers (Q1–20)", questions: [
      { q: "Hello, what ______ your name?", options: ["is", "are", "am", "be"], answer: 0 },
      { q: "______ name is John. And my ______ is Johnson.", options: ["Your / surname", "My / surname", "I / surname", "I / name"], answer: 1 },
      { q: "My name is Lisa. ______ Lisa Peterson.", options: ["My am", "I is", "I am", "I"], answer: 2 },
      { q: "______ name is Apple. ______ Ann Apple.", options: ["His / She", "His / He's", "Her / She's", "His / His"], answer: 2 },
      { q: "“Where ______ John from?” “______ from the US.”", options: ["is / He's", "is / His", "am / He's", "is / She's"], answer: 0 },
      { q: "______ are you from? Japan.", options: ["What", "Who", "Where", "When"], answer: 2 },
      { q: "Where ______ you ______ ?", options: ["is / from", "are / in", "are / is", "are / from"], answer: 3 },
      { q: "______ from Spain. I'm Rodriguez.", options: ["I'm", "He's", "You're", "She's"], answer: 0 },
      { q: "Pierre is a French boy. ______ from ______ .", options: ["He's / France", "His's / French", "His / France", "He / France"], answer: 0 },
      { q: "Lisa and Max are Americans. ______ from U.S.A.", options: ["There", "Their", "They're", "Their're"], answer: 2 },
      { q: "“What ______ their ______?” “Alexander and Philip.”", options: ["are / name", "is / name", "is / names", "are / names"], answer: 3 },
      { q: "I ______ 22 years old, but Andrew ______ 20.", options: ["am / am", "are / am", "am / is", "are / are"], answer: 2 },
      { q: "Mark ______ 19, but Brian and Denis ______ 26 and 28.", options: ["is / are", "are / is", "are / are", "am / are"], answer: 0 },
      { q: "“What ______ this?” “It's ______ umbrella.”", options: ["are / a", "is / a", "is / an", "its / an"], answer: 2 },
      { q: "Oxford is ______ English university.", options: ["an", "the", "a", "*"], answer: 0 },
      { q: "Toyotas ______ Japanese ______ .", options: ["is a / car", "is / car", "are / cars", "is / cars"], answer: 2 },
      { q: "“What is ______?” “She is a bank manager.”", options: ["his job", "she job", "he job", "her job"], answer: 3 },
      { q: "0/2/11/18/20 — Find the correct alternative.", options: ["oh / twelve / eighteen / twenty", "zero / two / one-one / eighteen / twenty", "zero / two / eleven / eighteen / twenty", "zero / two / eleven / eighty / twenty"], answer: 2 },
      { q: "“How old is your aunt?” “______ is 29.”", options: ["She", "He", "She's", "He's"], answer: 0 },
      { q: "“Where ______ she from?” “She ______ from Japan.”", options: ["are / is", "is / is", "is / am", "are / are"], answer: 1 }
    ] },
    { id: "tm-elem-2", title: "Book 1 · Part A · Elementary Test 2 — Verb to be: questions, negatives & short answers (Q1–12)", questions: [
      { q: "“_____ her name Eliza?” “No, _____ .”", options: ["What / it isn't", "Is / she isn't", "Is / it is not", "Is / it isn't"], answer: 3 },
      { q: "Is your surname Anderson?", options: ["Yes, you are.", "Yes, it is.", "Yes, I am.", "Yes, my is."], answer: 1 },
      { q: "“Is she American?” “No, _____ .”", options: ["hers isn't", "she isn't", "she is not", "she her isn't"], answer: 1 },
      { q: "“____ their names Jack & Benny?” “Yes, _____ .”", options: ["Are / they are", "Aren't / there are", "Am / their", "Is / they're"], answer: 0 },
      { q: "“Is your dog 2 years old?” “Yes, _____ .”", options: ["it's", "dog is", "it is", "its"], answer: 2 },
      { q: "“Is your elder brother married?” “No, _____ .”", options: ["brother isn't", "he isn't", "he is not", "she isn't"], answer: 1 },
      { q: "“Are you from Senegal?” “No, _____ .”", options: ["I'm not", "I amn't", "I are not", "I not"], answer: 0 },
      { q: "“_____ Martha English?” “Yes, she _____ .”", options: ["Is / isn't", "Are / is", "Is / is", "Are / is"], answer: 2 },
      { q: "“_____ her surname Smith?” “No, it _____ .”", options: ["What / isn't", "Is / is", "Is / isn't", "Are / isn't"], answer: 2 },
      { q: "“Are you a student?” “Yes, I _____ .”", options: ["am", "have", "is", "'m not"], answer: 0 },
      { q: "“_____ you from Barcelona?” “No, I'm not.”", options: ["Is", "Are", "Do", "Where"], answer: 1 },
      { q: "“_____ you married?” “No, I _____ .”", options: ["Aren't / am", "Are / am", "Is / am not", "Are / 'm not"], answer: 3 }
    ] }
  ]
};
