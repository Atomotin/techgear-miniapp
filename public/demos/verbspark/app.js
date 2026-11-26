const STORAGE_KEY = "verbspark-ai-state-v1";
const I18N = window.VerbSparkI18n || {};
const SUPPORTED_LOCALES = Array.isArray(I18N.locales) && I18N.locales.length > 0 ? I18N.locales : ["en"];
const SUPPORTED_THEMES = ["day", "space"];
const HERO_REVISIONS = {
  interview: 'I <del>improved</del> <ins>rebuilt</ins> our support flow because users waited <del>too long</del> <ins>up to two days</ins> for answers.',
  travel: 'My flight was delayed, so I arrived <del>late</del> <ins>after midnight</ins>. Could I still check in<ins>, please</ins>?',
  it: 'The payment callback failed after <del>deployment</del> <ins>Tuesday’s release</ins>, so <ins>about 40</ins> users saw duplicate orders.',
  daily: 'I <del>want</del> <ins>’d like</ins> to go somewhere quiet, so maybe we could <del>visit</del> <ins>try</ins> the new cafe near the river<ins> — free on Saturday?</ins>',
};
const HERO_REVISION_LABEL = { en: "Stronger version", ru: "Как сказать сильнее", uz: "Kuchliroq variant" };

const THEME_COPY = {
  en: {
    switchLabel: "Theme switch",
    label: "Theme",
    space: "Dark",
    day: "Light",
  },
  ru: {
    switchLabel: "Переключение темы",
    label: "Тема",
    space: "Тёмная",
    day: "Светлая",
  },
  uz: {
    switchLabel: "Mavzu almashuvi",
    label: "Mavzu",
    space: "Tungi",
    day: "Kunduzgi",
  },
};
const PAGE_LEAD_COPY = {
  en: {
    roadmap: {
      eyebrow: "Roadmap",
      heading: "Where you are now, and *what to train next*.",
      text: "Level test, profile and tutor notes on one page. After the test, this is where your focus for the next few days shows up.",
      asideTitle: "Next",
      asideText: "Once your level is clear, head to Practice — and close out today’s plan in the evening.",
      primaryAction: "Open practice",
      secondaryAction: "Today’s plan",
    },
    practice: {
      eyebrow: "Practice",
      heading: "Answer first, then see *how to say it stronger*.",
      text: "Pick a situation, write your answer in English and get a review: what to fix, a stronger version and the next drill.",
      asideTitle: "Tip",
      asideText: "Write the first answer yourself, no translator. Mistakes are exactly what this page works with.",
      primaryAction: "Level test",
      secondaryAction: "Today’s plan",
    },
    plan: {
      eyebrow: "Today’s plan",
      heading: "A few tasks for today. *Tick them off and you’re done.*",
      text: "A short list for your track and level. Every finished task moves your streak and confidence forward.",
      asideTitle: "Order",
      asideText: "Roadmap first, practice second, this list last. It makes it easier not to quit after a week.",
      primaryAction: "Open practice",
      secondaryAction: "Roadmap",
    },
  },
  ru: {
    roadmap: {
      eyebrow: "Маршрут",
      heading: "Где ты сейчас и *что тренировать дальше*.",
      text: "Тест уровня, профиль и заметки тьютора на одной странице. После теста здесь появится твой фокус на ближайшие дни.",
      asideTitle: "Дальше",
      asideText: "Когда уровень понятен — переходи в «Практику», а вечером закрой задания в плане на сегодня.",
      primaryAction: "Открыть практику",
      secondaryAction: "План на сегодня",
    },
    practice: {
      eyebrow: "Практика",
      heading: "Сначала ответь, потом посмотри, *как сказать сильнее*.",
      text: "Выбери ситуацию, напиши ответ по-английски и получи разбор: что исправить, более сильная версия и следующее упражнение.",
      asideTitle: "Совет",
      asideText: "Первый ответ пиши сам, без переводчика. Ошибки — ровно то, с чем здесь работают.",
      primaryAction: "К тесту уровня",
      secondaryAction: "План на сегодня",
    },
    plan: {
      eyebrow: "План на сегодня",
      heading: "Пара заданий на сегодня. *Отметь — и день закрыт.*",
      text: "Короткий список под твой трек и уровень. Каждое выполненное задание продлевает серию и поднимает уверенность.",
      asideTitle: "Порядок",
      asideText: "Сначала маршрут, потом практика, в конце — этот список. Так проще не бросить через неделю.",
      primaryAction: "Открыть практику",
      secondaryAction: "Маршрут",
    },
  },
  uz: {
    roadmap: {
      eyebrow: "O'quv rejasi",
      heading: "Darajangiz, profilingiz, tutor xotirasi va AI statusini bitta alohida sahifada ko'ring.",
      text: "Bu sizning learning control center'ingiz: placement qiling, profilingizni saqlang va tutor keyin nimani yaxshilashni aytayotganini ko'ring.",
      asideTitle: "Keyingi qadam",
      asideText: "Placement'dan keyin Practice Lab'ga o'ting, javoblarni mashq qiling va keyin Daily Plan orqali kunni yakunlang.",
      primaryAction: "Amaliyotni ochish",
      secondaryAction: "Kunlik plan",
    },
    practice: {
      eyebrow: "Amaliyot",
      heading: "Speaking, writing va vocabulary'ni uzun umumiy sahifasiz alohida joyda mashq qiling.",
      text: "Bu sizning active training zone'ingiz: yo'nalishni tanlang, inglizcha javob bering, feedback oling va darhol keyingi drill'ga o'ting.",
      asideTitle: "Birga ishlating",
      asideText: "Agar yangi bo'lsangiz, avval Roadmap'da placement qiling, so'ng feedback'dan keyin Daily Plan orqali ritmni ushlab turing.",
      primaryAction: "Roadmap'ni ochish",
      secondaryAction: "Kunlik plan",
    },
    plan: {
      eyebrow: "Kunlik plan",
      heading: "Bugungi vazifalar uchun alohida sahifa bo'lsin, hammasi bir joyda aralashib ketmasin.",
      text: "Bu sahifa faqat bajarish uchun: yo'nalishni tanlang, vazifalarni tugating va streak hamda confidence'ni real ish orqali oshiring.",
      asideTitle: "Tsiklni yig'ing",
      asideText: "Yo'nalish uchun Roadmap'dan, mashq uchun Practice Lab'dan foydalaning va keyin kunni toza yopish uchun shu yerga qayting.",
      primaryAction: "Amaliyotni ochish",
      secondaryAction: "Roadmap'ni ochish",
    },
  },
};
const PRACTICE_SHOWCASE_COPY = {
  en: {
    eyebrow: "Session Flow",
    tag: "Speaking now",
    heading: "One loop: answer, improve, lock the phrase.",
    text: "Practice feels stronger when you keep one clear rhythm instead of jumping randomly between tools.",
    scenarioLabel: "Current scenario",
    targetsLabel: "Focus words",
    rhythmLabel: "Session rhythm",
    rhythm: [
      "Answer naturally first.",
      "Use the feedback to fix one weak point.",
      "Carry one upgraded phrase into the next drill.",
    ],
    note: "Keep the first answer real. The tutor is here to refine your English, not replace your voice.",
  },
  ru: {
    eyebrow: "Сценарий сессии",
    tag: "Сейчас: речь",
    heading: "Один цикл: ответь, улучши, закрепи фразу.",
    text: "Практика работает лучше, когда у тебя есть один понятный ритм, а не хаотичные прыжки между блоками.",
    scenarioLabel: "Текущий сценарий",
    targetsLabel: "Фокус-слова",
    rhythmLabel: "Ритм сессии",
    rhythm: [
      "Сначала ответь естественно.",
      "Потом исправь одно слабое место по разбору.",
      "Перенеси одну улучшенную фразу в следующее упражнение.",
    ],
    note: "Первый ответ должен звучать по-настоящему. Тьютор улучшает твой английский, а не говорит вместо тебя.",
  },
  uz: {
    eyebrow: "Sessiya oqimi",
    tag: "Hozir: speaking",
    heading: "Bitta sikl: javob bering, yaxshilang, iborani mustahkamlang.",
    text: "Mashq sahifa bo'ylab tartibsiz yurishdan ko'ra, bitta aniq ritm bilan ancha samarali bo'ladi.",
    scenarioLabel: "Hozirgi ssenariy",
    targetsLabel: "Fokus so'zlar",
    rhythmLabel: "Sessiya ritmi",
    rhythm: [
      "Avval tabiiy javob bering.",
      "Keyin feedback orqali bitta zaif joyni tuzating.",
      "Yaxshilangan bitta iborani keyingi mashqqa olib o'ting.",
    ],
    note: "Birinchi javob haqiqiy bo'lsin. Tutor sizning ovozingizni almashtirmaydi, inglizingizni silliqlaydi.",
  },
};
const PLAN_SUMMARY_COPY = {
  en: {
    eyebrow: "Today Snapshot",
    heading: "See your real progress before you mark the next task.",
    text: "A visible score makes the day feel finishable and keeps the plan from turning into a vague list.",
    progressLabel: "Day progress",
    completedLabel: "Completed",
    remainingLabel: "Remaining",
    streakLabel: "Streak",
    focusLabel: "Today's focus",
    noteLabel: "Momentum",
    focusIssue: "Push {track} through one cleaner win on: {issue}.",
    focusGeneric: "Build one clean win inside {track} today.",
    noteStart: "Start the first mission and the page will turn into a real streak builder.",
    noteMid: "Nice pace. Finish one more mission and the day will feel much more complete.",
    noteDone: "Today's plan is complete. Come back tomorrow to protect the streak.",
  },
  ru: {
    eyebrow: "Срез дня",
    heading: "Смотри реальный прогресс до того, как отмечать следующую задачу.",
    text: "Когда прогресс виден сразу, день ощущается выполнимым, а план не превращается в размытый список.",
    progressLabel: "Прогресс дня",
    completedLabel: "Сделано",
    remainingLabel: "Осталось",
    streakLabel: "Стрик",
    focusLabel: "Фокус на сегодня",
    noteLabel: "Темп",
    focusIssue: "Прокачай {track} через одно более чистое улучшение: {issue}.",
    focusGeneric: "Сделай одну чистую победу в {track} сегодня.",
    noteStart: "Начни с первой миссии, и страница сразу станет ощущаться как реальный трекер прогресса.",
    noteMid: "Темп уже хороший. Закрой еще одну миссию, и день будет ощущаться гораздо собраннее.",
    noteDone: "План на сегодня закрыт. Вернись завтра, чтобы сохранить стрик.",
  },
  uz: {
    eyebrow: "Bugungi holat",
    heading: "Keyingi vazifani belgilashdan oldin haqiqiy progressni ko'ring.",
    text: "Progress ko'rinib tursa, kun bajariladigan bo'lib tuyuladi va reja oddiy noaniq ro'yxatga aylanmaydi.",
    progressLabel: "Kun progressi",
    completedLabel: "Bajarildi",
    remainingLabel: "Qoldi",
    streakLabel: "Streak",
    focusLabel: "Bugungi fokus",
    noteLabel: "Temp",
    focusIssue: "{track} bo'yicha bitta tozaroq yaxshilanish qiling: {issue}.",
    focusGeneric: "Bugun {track} ichida bitta toza yutuq quring.",
    noteStart: "Birinchi missiyani boshlang, shunda sahifa haqiqiy progress trekeriga o'xshaydi.",
    noteMid: "Temp yaxshi. Yana bitta missiyani tugatsangiz, kun ancha yig'ilgan ko'rinadi.",
    noteDone: "Bugungi reja tugadi. Streakni saqlash uchun ertaga qayting.",
  },
};
const JOURNEY_COPY = {
  en: {
    done: "Done",
    now: "Now",
    next: "Next",
  },
  ru: {
    done: "Готово",
    now: "Сейчас",
    next: "Дальше",
  },
  uz: {
    done: "Bajarildi",
    now: "Hozir",
    next: "Keyin",
  },
};
const LESSON_COPY = {
  en: {
    eyebrow: "Personal lesson",
    focusTag: "Focus now",
    heading: "Train the exact issue your tutor keeps seeing.",
    durationLabel: "Length",
    trackLabel: "Track",
    focusLabel: "Focus",
    refresh: "Generate another lesson",
    apply: "Load into Practice",
    warmupTitle: "Warm-up",
    speakingTitle: "Speaking drill",
    writingTitle: "Writing drill",
    vocabularyTitle: "Word focus",
    memoryTitle: "Tutor memory",
    winLabel: "Finish line",
    durationValue: "{count} min",
    wordsRuleLabel: "Word rule",
    summaryBase: "This mini-lesson is assembled from your level, active track, and tutor memory so you can stop guessing what to do next.",
    summaryMemory: "Tutor note: {note}",
    warmupText: "Say two short English lines inside {track} and focus only on {issue}.",
    speakingIntro: "Use this speaking prompt:",
    writingIntro: "Use this writing prompt:",
    speakingCheckOne: "Answer in 3 to 5 clear sentences.",
    speakingCheckTwo: "Fix one thing around {issue}.",
    speakingCheckThree: "Use at least one focus word naturally.",
    writingCheckOne: "Write 4 to 6 sentences with a clean structure.",
    writingCheckTwo: "Keep the text stronger around {issue}.",
    writingCheckThree: "Reuse one upgraded phrase from speaking.",
    wordTip: "Use all three words in one answer or one short paragraph.",
    winText: "This lesson is done when your final answer sounds cleaner in {issue} than your previous attempt.",
  },
  ru: {
    eyebrow: "Персональный урок",
    focusTag: "Фокус сейчас",
    heading: "Тренируй именно ту проблему, которую тьютор видит чаще всего.",
    durationLabel: "Длина",
    trackLabel: "Трек",
    focusLabel: "Фокус",
    refresh: "Сгенерировать другой урок",
    apply: "Загрузить в Practice",
    warmupTitle: "Разогрев",
    speakingTitle: "Speaking drill",
    writingTitle: "Writing drill",
    vocabularyTitle: "Фокус на словах",
    memoryTitle: "Память тьютора",
    winLabel: "Финиш",
    durationValue: "{count} мин",
    wordsRuleLabel: "Правило для слов",
    summaryBase: "Этот мини-урок собирается из твоего уровня, текущего трека и памяти тьютора, чтобы ты не гадал, что делать дальше.",
    summaryMemory: "Заметка тьютора: {note}",
    warmupText: "Скажи 2 короткие фразы на английском в треке {track} и сфокусируйся только на теме {issue}.",
    speakingIntro: "Используй этот speaking prompt:",
    writingIntro: "Используй этот writing prompt:",
    speakingCheckOne: "Ответь в 3-5 ясных предложениях.",
    speakingCheckTwo: "Исправь одно слабое место вокруг темы {issue}.",
    speakingCheckThree: "Естественно используй хотя бы одно фокус-слово.",
    writingCheckOne: "Напиши 4-6 предложений с чистой структурой.",
    writingCheckTwo: "Сделай текст сильнее именно в теме {issue}.",
    writingCheckThree: "Перенеси одну улучшенную фразу из speaking.",
    wordTip: "Используй все 3 слова в одном ответе или в одном коротком абзаце.",
    winText: "Урок закрыт, когда финальный ответ звучит чище по теме {issue}, чем твоя предыдущая попытка.",
  },
  uz: {
    eyebrow: "Shaxsiy dars",
    focusTag: "Hozirgi fokus",
    heading: "Tutor eng ko'p ko'rayotgan muammoni mashq qiling.",
    durationLabel: "Davomiylik",
    trackLabel: "Yo'nalish",
    focusLabel: "Fokus",
    refresh: "Boshqa dars yaratish",
    apply: "Practice'ga yuklash",
    warmupTitle: "Qizish",
    speakingTitle: "Speaking drill",
    writingTitle: "Writing drill",
    vocabularyTitle: "So'z fokusi",
    memoryTitle: "Tutor xotirasi",
    winLabel: "Finish line",
    durationValue: "{count} min",
    wordsRuleLabel: "So'z qoidasi",
    summaryBase: "Bu mini-dars sizning darajangiz, joriy yo'nalishingiz va tutor xotirasidan yig'iladi, shunda keyin nima qilishni taxmin qilmaydi.",
    summaryMemory: "Tutor eslatmasi: {note}",
    warmupText: "{track} ichida ingliz tilida 2 ta qisqa gap ayting va faqat {issue} ga e'tibor bering.",
    speakingIntro: "Mana shu speaking prompt bilan ishlang:",
    writingIntro: "Mana shu writing prompt bilan ishlang:",
    speakingCheckOne: "3-5 ta aniq gap bilan javob bering.",
    speakingCheckTwo: "{issue} atrofidagi bitta zaif joyni tuzating.",
    speakingCheckThree: "Kamida bitta fokus-so'zni tabiiy ishlating.",
    writingCheckOne: "Toza struktura bilan 4-6 ta gap yozing.",
    writingCheckTwo: "Matnni aynan {issue} tomondan kuchaytiring.",
    writingCheckThree: "Speaking'dan bitta yaxshilangan iborani olib o'ting.",
    wordTip: "Uchala so'zni bitta javobda yoki bitta qisqa paragrafda ishlating.",
    winText: "Final javobingiz oldingi urinishga qaraganda {issue} bo'yicha tozaroq eshitilsa, dars bajarildi.",
  },
};
const ONBOARDING_COPY = {
  en: {
    launcherOpen: "Open setup wizard",
    launcherEdit: "Edit setup",
    eyebrow: "First-time setup",
    topTag: "Quick setup",
    progress: "Step {current} of {total}",
    steps: ["Language", "Goal", "Look", "Start"],
    back: "Back",
    continue: "Continue",
    finish: "Go to the test",
    skip: "Skip for now",
    close: "Close",
    language: {
      title: "Which language should the hints be in?",
      text: "The interface and explanations will use it. The tasks themselves are always in English.",
      hint: "You can change this later in the header.",
      options: {
        en: { label: "English", description: "Use the interface in English from the start." },
        ru: { label: "Русский", description: "Если ты только начинаешь, объяснения будут понятнее на русском." },
        uz: { label: "O'zbekcha", description: "Interfeysni o'zbekcha ko'rish va keyin inglizchaga o'tish mumkin." },
      },
    },
    goal: {
      title: "What do you need English for?",
      text: "This changes the questions, the words and your daily tasks.",
      hint: "Start with the track you need most often in real situations.",
      descriptions: {
        interview: "Job interviews, confident answers, and measurable impact stories.",
        travel: "Airport, hotel, directions, food, and polite requests.",
        it: "Work updates, bugs, standups, and clearer technical English.",
        daily: "Messages, small talk, errands, and everyday conversations.",
      },
    },
    theme: {
      title: "Light or dark — and what should we call you?",
      text: "You can switch the look any time. Your name is only used in greetings.",
      hint: "This only changes the interface. Your learning data stays the same.",
      themeLabel: "Look",
      nameLabel: "Learner name",
      namePlaceholder: "What should the tutor call you?",
      themes: {
        space: { description: "Dark background, softer contrast — easier on the eyes at night." },
        day: { description: "Light, paper-like page. The default." },
      },
    },
    start: {
      title: "All set. Start with the test?",
      text: "Five questions, a couple of minutes — then the tasks adjust to your level.",
      hint: "You can retake the test any time.",
      languageLabel: "Interface",
      goalLabel: "Track",
      themeLabel: "Theme",
      nameLabel: "Learner",
      emptyName: "Learner",
      nextTitle: "What happens next",
      nextSteps: [
        "Take the 5-question test in Roadmap.",
        "Answer your first question in Practice and read the review.",
        "Check the daily plan tomorrow — that’s day two of your streak.",
      ],
    },
  },
  ru: {
    launcherOpen: "Открыть быструю настройку",
    launcherEdit: "Изменить настройки",
    eyebrow: "Первый запуск",
    topTag: "Быстрая настройка",
    progress: "Шаг {current} из {total}",
    steps: ["Язык", "Цель", "Вид", "Старт"],
    back: "Назад",
    continue: "Далее",
    finish: "Перейти к тесту",
    skip: "Пропустить пока",
    close: "Закрыть",
    language: {
      title: "На каком языке показывать подсказки?",
      text: "На нём будут интерфейс и объяснения. Сами задания — всегда на английском.",
      hint: "Позже это всегда можно поменять в шапке сайта.",
      options: {
        en: { label: "English", description: "Если хочешь сразу привыкать к английскому интерфейсу." },
        ru: { label: "Русский", description: "Лучший старт, если тебе пока нужны понятные объяснения." },
        uz: { label: "O'zbekcha", description: "Можно начать с узбекского интерфейса и спокойно перейти дальше." },
      },
    },
    goal: {
      title: "Для чего тебе английский?",
      text: "От этого зависят вопросы, слова и задания в плане на день.",
      hint: "Начни с того трека, который нужен тебе чаще всего на практике.",
      descriptions: {
        interview: "Собеседования, уверенные ответы и сильные истории про результат.",
        travel: "Аэропорт, отель, дорога, еда и вежливые просьбы.",
        it: "Рабочие апдейты, баги, стендапы и более чистый технический английский.",
        daily: "Сообщения, small talk, бытовые дела и обычные разговоры.",
      },
    },
    theme: {
      title: "Светлая или тёмная — и как к тебе обращаться?",
      text: "Оформление можно поменять в любой момент. Имя нужно только для приветствия.",
      hint: "Это меняет только интерфейс, а не твои данные обучения.",
      themeLabel: "Оформление",
      nameLabel: "Имя ученика",
      namePlaceholder: "Как тьютор должен к тебе обращаться?",
      themes: {
        space: { description: "Тёмный фон и мягкий контраст — удобно вечером." },
        day: { description: "Светлая «бумажная» страница. Стоит по умолчанию." },
      },
    },
    start: {
      title: "Готово. Начнём с теста?",
      text: "Пять вопросов, пара минут — и задания подстроятся под твой уровень.",
      hint: "Тест можно пересдать в любой момент.",
      languageLabel: "Интерфейс",
      goalLabel: "Трек",
      themeLabel: "Тема",
      nameLabel: "Ученик",
      emptyName: "Ученик",
      nextTitle: "Что будет дальше",
      nextSteps: [
        "Пройди тест из 5 вопросов в «Маршруте».",
        "Ответь на первый вопрос в «Практике» и посмотри разбор.",
        "Завтра загляни в план на день — это второй день серии.",
      ],
    },
  },
  uz: {
    launcherOpen: "Setup wizard ochish",
    launcherEdit: "Setup o'zgartirish",
    eyebrow: "Birinchi ishga tushirish",
    topTag: "Tez sozlash",
    progress: "{total} bosqichdan {current}-bosqich",
    steps: ["Til", "Maqsad", "Mavzu", "Start"],
    back: "Orqaga",
    continue: "Davom etish",
    finish: "Placement ochish",
    skip: "Hozircha o'tkazib yuborish",
    close: "Yopish",
    language: {
      title: "Avval interfeys tilini tanlang.",
      text: "Keyingi bosqichlar tushunarli bo'lishi uchun eng qulay til bilan boshlang.",
      hint: "Buni keyin ham header ichidan almashtirish mumkin.",
      options: {
        en: { label: "English", description: "Interfeysni boshidanoq inglizcha ko'rishni xohlasangiz." },
        ru: { label: "Русский", description: "Tushuntirishlar rus tilida qulayroq bo'lsa, shu variantdan boshlang." },
        uz: { label: "O'zbekcha", description: "Eng sodda start uchun interfeysni o'zbekcha qoldiring." },
      },
    },
    goal: {
      title: "Hayotda ko'proq kerak bo'ladigan yo'nalishni tanlang.",
      text: "Bu tanlov topshiriqlarni, lug'atni, AI ssenariylarini va kunlik rejani o'zgartiradi.",
      hint: "Ko'proq ishlatadigan real vaziyatdan boshlash eng to'g'ri yo'l.",
      descriptions: {
        interview: "Suhbatlar, ishonchli javoblar va natija ko'rsatadigan hikoyalar.",
        travel: "Aeroport, mehmonxona, yo'l, ovqat va muloyim so'rovlar.",
        it: "Ish update'lari, bug'lar, standup va tozaroq texnik inglizcha.",
        daily: "Xabarlar, small talk, kundalik ishlar va oddiy suhbatlar.",
      },
    },
    theme: {
      title: "Ko'rinishni tanlang va tutorni shaxsiyroq qiling.",
      text: "O'zingizga yoqadigan interfeys rejimini tanlang va ism kiriting, shunda mahsulot jonliroq seziladi.",
      hint: "Bu faqat ko'rinishni o'zgartiradi, o'quv ma'lumotlari o'sha-o'sha qoladi.",
      themeLabel: "Vizual rejim",
      nameLabel: "O'quvchi ismi",
      namePlaceholder: "Tutor sizni qanday chaqirsin?",
      themes: {
        space: { description: "Kosmik, kinodek va atmosferasi kuchli ko'rinish." },
        day: { description: "Yorug', toza va kundalik o'qish uchun tinch ko'rinish." },
      },
    },
    start: {
      title: "Birinchi sessiyangiz tayyor.",
      text: "Muhim narsalar allaqachon sozlandi. Endi eng kuchli qadam bu 5 savollik placement.",
      hint: "Placement sizga daraja, o'quv rejasi va kuchliroq birinchi mashq beradi.",
      languageLabel: "Interfeys",
      goalLabel: "Yo'nalish",
      themeLabel: "Mavzu",
      nameLabel: "O'quvchi",
      emptyName: "O'quvchi",
      nextTitle: "Keyin nima bo'ladi",
      nextSteps: [
        "Roadmap sahifasini ochib, 5 savollik placement'ni tugating.",
        "Keyin birinchi AI tahlili uchun Practice Lab'ga o'ting.",
        "So'ng ritmni ushlab turish uchun Daily Plan'dan foydalaning.",
      ],
    },
  },
};
const AUTH_COPY = {
  en: {
    open: "Sign in",
    signedIn: "Account",
    loading: "Checking...",
    eyebrow: "Account sync",
    asideTitle: "Back up your level, streak, and tutor memory.",
    asideText: "Create an account to keep your progress on the server and continue on every page with the same learning state.",
    benefits: ["Save progress safely.", "Keep one synced profile.", "Restore your learning state later."],
    loginTab: "Sign in",
    registerTab: "Create account",
    close: "Close",
    loginTitle: "Sign in to your learning account.",
    registerTitle: "Create your learning account.",
    loginText: "Use your email and password to continue from your saved level and roadmap.",
    registerText: "Start with a simple account, then your current progress will sync to the server.",
    nameLabel: "Account name",
    namePlaceholder: "Optional display name",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 8 characters",
    requiredError: "Email and password are required.",
    fileModeError: "Run the local server first to use account sync.",
    submitLogin: "Sign in",
    submitRegister: "Create account",
    loggedInTitle: "Your progress is connected.",
    loggedInText: "This account can now back up your roadmap, practice progress, and tutor memory.",
    syncNow: "Sync now",
    logout: "Log out",
    syncIdle: "Waiting for the next change.",
    syncPending: "Changes are queued to sync.",
    syncSyncing: "Syncing your latest progress...",
    syncSynced: "Progress saved on the server.",
    syncError: "Sync failed. Your local progress is still safe in this browser.",
    signedInAs: "Signed in as",
    learnerLabel: "Learner profile",
    lastSyncLabel: "Last sync",
    notSynced: "Not synced yet",
    registerSuccess: "Account created. Current progress is ready to sync.",
    loginLocalWon: "Signed in. This device had newer progress, so it was uploaded.",
    loginRemoteWon: "Signed in. Newer saved progress was loaded from the server.",
    loginEmptyState: "Signed in. No saved server state was found yet.",
    logoutSuccess: "You signed out. Local progress stays in this browser.",
  },
  ru: {
    open: "Войти",
    signedIn: "Аккаунт",
    loading: "Проверка...",
    eyebrow: "Синхронизация аккаунта",
    asideTitle: "Сохрани уровень, streak и память тьютора.",
    asideText: "Создай аккаунт, чтобы держать прогресс на сервере и продолжать обучение на любой странице с одним и тем же состоянием.",
    benefits: ["Безопасно сохраняй прогресс.", "Держи один синхронизированный профиль.", "Восстанавливай состояние обучения позже."],
    loginTab: "Вход",
    registerTab: "Регистрация",
    close: "Закрыть",
    loginTitle: "Войди в свой учебный аккаунт.",
    registerTitle: "Создай учебный аккаунт.",
    loginText: "Используй email и пароль, чтобы продолжить с сохраненного уровня и roadmap.",
    registerText: "Начни с простого аккаунта, и текущий прогресс сразу можно будет синхронизировать с сервером.",
    nameLabel: "Имя аккаунта",
    namePlaceholder: "Необязательное имя",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Минимум 8 символов",
    requiredError: "Сначала введи email и пароль.",
    fileModeError: "Сначала запусти локальный сервер, чтобы использовать синхронизацию аккаунта.",
    submitLogin: "Войти",
    submitRegister: "Создать аккаунт",
    loggedInTitle: "Прогресс подключен.",
    loggedInText: "Этот аккаунт теперь может сохранять roadmap, практику и память тьютора.",
    syncNow: "Синхронизировать",
    logout: "Выйти",
    syncIdle: "Ждем следующее изменение.",
    syncPending: "Изменения поставлены в очередь на синхронизацию.",
    syncSyncing: "Синхронизируем последний прогресс...",
    syncSynced: "Прогресс сохранен на сервере.",
    syncError: "Синхронизация не удалась. Локальный прогресс в этом браузере не потерян.",
    signedInAs: "Вход выполнен как",
    learnerLabel: "Профиль ученика",
    lastSyncLabel: "Последняя синхронизация",
    notSynced: "Еще не синхронизировано",
    registerSuccess: "Аккаунт создан. Текущий прогресс готов к синхронизации.",
    loginLocalWon: "Вход выполнен. На этом устройстве был более новый прогресс, поэтому он был загружен на сервер.",
    loginRemoteWon: "Вход выполнен. Более новый сохраненный прогресс был загружен с сервера.",
    loginEmptyState: "Вход выполнен. Сохраненного состояния на сервере пока нет.",
    logoutSuccess: "Ты вышел из аккаунта. Локальный прогресс остался в этом браузере.",
  },
  uz: {
    open: "Kirish",
    signedIn: "Akkaunt",
    loading: "Tekshirilmoqda...",
    eyebrow: "Akkaunt sinxi",
    asideTitle: "Daraja, streak va tutor xotirasini saqlang.",
    asideText: "Serverda progressni saqlash va har bir sahifada bitta learning state bilan davom etish uchun akkaunt yarating.",
    benefits: ["Progressni xavfsiz saqlang.", "Bitta sinxron profil bilan ishlang.", "Learning holatini keyin tiklang."],
    loginTab: "Kirish",
    registerTab: "Akkaunt yaratish",
    close: "Yopish",
    loginTitle: "Learning akkauntingizga kiring.",
    registerTitle: "Learning akkauntingizni yarating.",
    loginText: "Saqlangan daraja va roadmap bilan davom etish uchun email va paroldan foydalaning.",
    registerText: "Oddiy akkaunt yarating, keyin joriy progress serverga sinxron qilinadi.",
    nameLabel: "Akkaunt nomi",
    namePlaceholder: "Ixtiyoriy nom",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Parol",
    passwordPlaceholder: "Kamida 8 ta belgi",
    requiredError: "Avval email va parolni kiriting.",
    fileModeError: "Akkaunt sinxronidan foydalanish uchun avval local serverni ishga tushiring.",
    submitLogin: "Kirish",
    submitRegister: "Akkaunt yaratish",
    loggedInTitle: "Progress ulandi.",
    loggedInText: "Bu akkaunt endi roadmap, practice progress va tutor xotirasini saqlashi mumkin.",
    syncNow: "Hozir sinxronlash",
    logout: "Chiqish",
    syncIdle: "Keyingi o'zgarishni kutmoqda.",
    syncPending: "O'zgarishlar sinxron navbatiga qo'yildi.",
    syncSyncing: "Oxirgi progress sinxronlanmoqda...",
    syncSynced: "Progress serverda saqlandi.",
    syncError: "Sinxronlash muvaffaqiyatsiz tugadi. Brauzerdagi local progress saqlanib qoldi.",
    signedInAs: "Quyidagicha kirilgan",
    learnerLabel: "O'quvchi profili",
    lastSyncLabel: "Oxirgi sinxron",
    notSynced: "Hali sinxron qilinmagan",
    registerSuccess: "Akkaunt yaratildi. Joriy progress sinxronlashga tayyor.",
    loginLocalWon: "Kirish bajarildi. Bu qurilmadagi yangiroq progress serverga yuklandi.",
    loginRemoteWon: "Kirish bajarildi. Serverdagi yangiroq progress yuklab olindi.",
    loginEmptyState: "Kirish bajarildi. Serverda hali saqlangan holat topilmadi.",
    logoutSuccess: "Akkauntdan chiqildi. Local progress shu brauzerda saqlanib qoldi.",
  },
};
const GOAL_IDS = ["interview", "travel", "it", "daily"];
const MEMORY_WEAKNESS_TAGS = [
  "connector",
  "punctuation",
  "past_tense",
  "follow_up",
  "specificity",
  "length",
  "keyword",
  "structure",
  "capitalization",
  "agreement",
];
const MEMORY_STRENGTH_TAGS = ["detail", "structure", "vocabulary", "clarity", "confidence", "follow_up", "connector"];

const assessmentQuestions = [
  {
    question: "Choose the most natural sentence.",
    options: [
      { text: "I am work in a software company.", points: 1 },
      { text: "I work at a software company.", points: 4 },
      { text: "I working on software company.", points: 2 },
      { text: "I do work in software company every day.", points: 3 },
    ],
  },
  {
    question: 'Pick the best answer to: "How was your weekend?"',
    options: [
      { text: "It was relaxing. I met my cousin and cooked dinner.", points: 4 },
      { text: "Weekend was yes, I stay home.", points: 1 },
      { text: "I am go to the park and good.", points: 2 },
      { text: "It was fine because weekend is free.", points: 3 },
    ],
  },
  {
    question: "Which sentence shows the clearest opinion?",
    options: [
      { text: "Remote work is maybe useful.", points: 2 },
      { text: "I think remote work is effective because it saves commute time.", points: 4 },
      { text: "Remote work very good people.", points: 1 },
      { text: "Remote work can good for some person.", points: 3 },
    ],
  },
  {
    question: "Choose the best follow-up question in a conversation.",
    options: [
      { text: "You like it?", points: 2 },
      { text: "Why you choose that?", points: 3 },
      { text: "What made you choose that option?", points: 4 },
      { text: "You choose that option why?", points: 1 },
    ],
  },
  {
    question: 'Pick the strongest upgrade of this idea: "I solved a problem."',
    options: [
      { text: "I solved a problem.", points: 1 },
      { text: "I solved a problem quickly.", points: 2 },
      { text: "I solved a client issue by clarifying the process and updating the checklist.", points: 4 },
      { text: "I was solving problem with many actions.", points: 3 },
    ],
  },
];

const goalContent = {
  interview: {
    label: "Interview English",
    previewPrompt: "Tell me about a project where you improved a process.",
    previewAnswer: "I improved our support flow because users waited too long for answers.",
    miniMission: 'Use one answer with "because", one with a past-tense verb, and one follow-up question.',
    miniHint: "Strong answers sound specific. Add one measurable detail or one real example.",
    scenarios: [
      {
        id: "impact",
        title: "Impact Story",
        prompt: "Answer like a candidate: Tell me about a time you improved a process or result.",
        targetWords: ["improved", "because", "result", "team", "process"],
      },
      {
        id: "challenge",
        title: "Hard Problem",
        prompt: "Explain a difficult problem you faced at work and how you solved it.",
        targetWords: ["challenge", "solved", "first", "then", "outcome"],
      },
      {
        id: "future",
        title: "Career Goal",
        prompt: "Describe what kind of role you want next and why it fits your strengths.",
        targetWords: ["role", "strength", "want", "grow", "because"],
      },
    ],
    prompts: [
      "Write a short answer for: Why do you want to work with our team?",
      "Describe a project where you had to learn something quickly.",
      "Explain one mistake you made and what you changed after it.",
    ],
    vocabulary: [
      { word: "deadline", type: "noun", definition: "A time when something must be finished.", example: "We moved faster because the client deadline was on Friday." },
      { word: "ownership", type: "noun", definition: "Responsibility for a task or result.", example: "I took ownership of the onboarding checklist and improved it." },
      { word: "streamline", type: "verb", definition: "To make a process simpler and more efficient.", example: "We streamlined the approval flow to reduce waiting time." },
      { word: "outcome", type: "noun", definition: "The result of an action or process.", example: "The outcome was a faster response rate and happier users." },
      { word: "initiative", type: "noun", definition: "The ability to act without waiting for instructions.", example: "She showed initiative by documenting the new workflow." },
      { word: "collaborate", type: "verb", definition: "To work together with other people.", example: "I collaborated with design and support to launch the update." },
    ],
    plan: [
      { title: "90-second answer", detail: "Practice one interview answer with a clear situation, action, and result." },
      { title: "Rewrite for confidence", detail: "Turn one weak sentence into a stronger one using a connector and one detail." },
      { title: "Vocabulary in context", detail: "Use two career words from Word Forge inside a new response." },
    ],
  },
  travel: {
    label: "Travel English",
    previewPrompt: "You are checking into a hotel after a delayed flight.",
    previewAnswer: "My flight was delayed, so I arrived late. Could I still check in now?",
    miniMission: "Use one polite request, one problem description, and one follow-up question.",
    miniHint: "Travel English feels natural when you are direct, polite, and specific about what you need.",
    scenarios: [
      {
        id: "hotel",
        title: "Hotel Check-in",
        prompt: "Tell the receptionist your flight was delayed and ask for a quick check-in.",
        targetWords: ["delayed", "reservation", "check", "please", "room"],
      },
      {
        id: "airport",
        title: "Airport Help",
        prompt: "Ask airport staff how to get to your next gate after a schedule change.",
        targetWords: ["gate", "next", "flight", "where", "time"],
      },
      {
        id: "restaurant",
        title: "Restaurant Order",
        prompt: "Order food, ask about ingredients, and request one small change politely.",
        targetWords: ["order", "could", "without", "recommend", "please"],
      },
    ],
    prompts: [
      "Write a message to your host explaining that you will arrive later than expected.",
      "Describe your ideal travel day from morning to evening.",
      "Write about a travel problem and how you solved it.",
    ],
    vocabulary: [
      { word: "reservation", type: "noun", definition: "A booking made in advance.", example: "I have a reservation under the name Akmalov." },
      { word: "boarding pass", type: "noun", definition: "A document that lets you get on a plane.", example: "I checked my boarding pass before going to the gate." },
      { word: "delay", type: "noun", definition: "A situation when something happens later than planned.", example: "The delay was two hours because of the weather." },
      { word: "recommend", type: "verb", definition: "To suggest something as a good choice.", example: "Could you recommend a local dish?" },
      { word: "available", type: "adjective", definition: "Ready to be used or free at that time.", example: "Is there another room available tonight?" },
      { word: "itinerary", type: "noun", definition: "A plan of your trip or schedule.", example: "I saved my itinerary on my phone." },
    ],
    plan: [
      { title: "Polite request drill", detail: 'Say three requests with "Could I...?", "Could you...?", and "Would it be possible...?"' },
      { title: "Travel problem solver", detail: "Describe one delay, one change, and one question you would ask next." },
      { title: "Useful nouns", detail: "Use two travel words in one realistic airport or hotel dialogue." },
    ],
  },
};

Object.assign(goalContent, {
  it: {
    label: "IT English",
    previewPrompt: "Explain a production bug to a teammate in clear English.",
    previewAnswer: "The payment callback failed after deployment, so users saw duplicate orders.",
    miniMission: "Explain one bug, one cause, and one next step in plain English.",
    miniHint: 'IT English improves fast when you choose precise verbs instead of vague words like "do" or "make".',
    scenarios: [
      {
        id: "bug",
        title: "Bug Report",
        prompt: "Describe a bug in simple English: what happened, why it matters, and what you will check next.",
        targetWords: ["issue", "users", "after", "check", "next"],
      },
      {
        id: "meeting",
        title: "Sprint Update",
        prompt: "Give a short sprint update about what you finished, what is blocked, and what you need.",
        targetWords: ["finished", "blocked", "need", "today", "deploy"],
      },
      {
        id: "review",
        title: "Code Review",
        prompt: "Explain a code review suggestion politely and clearly.",
        targetWords: ["suggest", "clear", "because", "change", "maintain"],
      },
    ],
    prompts: [
      "Write a short update for your team about a feature that needs one more day.",
      "Explain a bug you fixed and how you verified the solution.",
      "Describe a technical decision and why your team chose it.",
    ],
    vocabulary: [
      { word: "deployment", type: "noun", definition: "The process of releasing software to users.", example: "The issue started right after the deployment." },
      { word: "rollback", type: "noun", definition: "A return to an earlier version of the software.", example: "We did a rollback to stop the errors quickly." },
      { word: "maintainable", type: "adjective", definition: "Easy to understand and update later.", example: "This approach is more maintainable for the team." },
      { word: "edge case", type: "noun", definition: "An unusual situation that can still happen.", example: "We missed an edge case when the cart was empty." },
      { word: "investigate", type: "verb", definition: "To examine a problem carefully.", example: "I will investigate the logs after lunch." },
      { word: "reproduce", type: "verb", definition: "To make the same bug happen again to understand it.", example: "First I need to reproduce the issue on staging." },
    ],
    plan: [
      { title: "Bug in plain English", detail: "Explain one technical issue without jargon, as if you were speaking to product support." },
      { title: "Short sprint update", detail: "Write a three-part update: done, blocked, next." },
      { title: "Precision vocabulary", detail: "Use two IT words in one explanation of a problem or decision." },
    ],
  },
  daily: {
    label: "Daily Life English",
    previewPrompt: "Make a weekend plan with a friend and suggest one activity.",
    previewAnswer: "I want to go somewhere quiet, so maybe we could visit the new cafe near the river.",
    miniMission: "Use one suggestion, one reason, and one question to keep the conversation going.",
    miniHint: "Daily English sounds strong when your ideas are simple, connected, and easy to react to.",
    scenarios: [
      {
        id: "weekend",
        title: "Weekend Plan",
        prompt: "Invite a friend to do something this weekend and ask what they prefer.",
        targetWords: ["weekend", "maybe", "want", "because", "what"],
      },
      {
        id: "shopping",
        title: "Shopping Help",
        prompt: "Ask for help in a store and explain what you need in a simple way.",
        targetWords: ["need", "looking", "size", "color", "help"],
      },
      {
        id: "neighbors",
        title: "Friendly Talk",
        prompt: "Start a light conversation with a neighbor about your area or building.",
        targetWords: ["here", "near", "usually", "recommend", "place"],
      },
    ],
    prompts: [
      "Write a short message inviting a friend to meet after work.",
      "Describe your perfect Saturday in 5 to 6 sentences.",
      "Write about a small problem at home and how you handled it.",
    ],
    vocabulary: [
      { word: "errand", type: "noun", definition: "A short practical trip to do something such as shopping.", example: "I need to run a few errands before dinner." },
      { word: "cozy", type: "adjective", definition: "Comfortable and pleasant in a warm way.", example: "That cafe is small but really cozy." },
      { word: "nearby", type: "adjective", definition: "Not far away.", example: "Is there a nearby place to buy flowers?" },
      { word: "suggest", type: "verb", definition: "To offer an idea for someone to consider.", example: "I suggest meeting after six because traffic is lighter." },
      { word: "available", type: "adjective", definition: "Free to do something or not busy.", example: "Are you available on Saturday evening?" },
      { word: "prefer", type: "verb", definition: "To like one option more than another.", example: "I prefer quiet places when I want to talk." },
    ],
    plan: [
      { title: "Natural invitation", detail: "Invite someone to meet and give one reason for your suggestion." },
      { title: "Small talk builder", detail: "Ask two follow-up questions in a casual conversation." },
      { title: "Memory loop", detail: "Use two daily-life words in a new message or dialogue." },
    ],
  },
});

const defaultState = {
  profile: { name: "Learner", goal: "interview", level: "A2", streak: 0, lastActiveDate: null },
  assessment: { index: 0, answers: [], complete: false },
  progress: { sessions: 0, confidence: 36, wordsLearned: [] },
  coach: { scenarioIndexByGoal: { interview: 0, travel: 0, it: 0, daily: 0 } },
  writing: { promptIndexByGoal: { interview: 0, travel: 0, it: 0, daily: 0 } },
  vocab: { indexByGoal: { interview: 0, travel: 0, it: 0, daily: 0 }, revealed: false },
  tasks: { date: null, goal: "interview", items: [] },
  preferences: { locale: null, theme: "day" },
  memory: createEmptyMemoryState(),
  lesson: createEmptyLessonState(),
  onboarding: { completed: false, dismissed: false, step: 0 },
  meta: { updatedAt: 0, lastSyncedAt: 0 },
};

const state = loadState();
const runtime = {
  provider: "local",
  model: "Local heuristic",
  hasLiveFeedback: false,
  recommendedModel: "gpt-5.4",
  statusKey: "runtime.checkingTitle",
  noteKey: "runtime.checkingNote",
  statusVars: {},
  noteVars: {},
};
const authSession = {
  user: null,
  loading: false,
  busy: false,
  modalOpen: false,
  mode: "login",
  form: { displayName: "", email: "", password: "" },
  message: "",
  messageType: "neutral",
  syncStatus: "idle",
};
let motionObserver = null;
let scrollMotionFrame = 0;
let recentCompletedTaskId = "";
let lastVocabRenderState = { signature: "", revealed: false };
let onboardingOpen = false;
let authSyncTimer = 0;
let authSyncInFlight = null;

ensureAuthShell();

const elements = {
  languageSwitch: document.getElementById("languageSwitch"),
  localeButtons: [...document.querySelectorAll("[data-locale]")],
  themeSwitch: document.getElementById("themeSwitch"),
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  goalChips: document.getElementById("goalChips"),
  authTriggerButton: document.getElementById("authTriggerButton"),
  authOverlay: document.getElementById("authOverlay"),
  authEyebrow: document.getElementById("authEyebrow"),
  authAsideTitle: document.getElementById("authAsideTitle"),
  authAsideText: document.getElementById("authAsideText"),
  authBenefitList: document.getElementById("authBenefitList"),
  authModeSwitch: document.getElementById("authModeSwitch"),
  authCloseButton: document.getElementById("authCloseButton"),
  authView: document.getElementById("authView"),
  onboardingLaunchButton: document.getElementById("onboardingLaunchButton"),
  onboardingOverlay: document.getElementById("onboardingOverlay"),
  onboardingEyebrow: document.getElementById("onboardingEyebrow"),
  onboardingProgressText: document.getElementById("onboardingProgressText"),
  onboardingProgressBar: document.getElementById("onboardingProgressBar"),
  onboardingStepList: document.getElementById("onboardingStepList"),
  onboardingTopTag: document.getElementById("onboardingTopTag"),
  onboardingCloseButton: document.getElementById("onboardingCloseButton"),
  onboardingTitle: document.getElementById("onboardingTitle"),
  onboardingText: document.getElementById("onboardingText"),
  onboardingStage: document.getElementById("onboardingStage"),
  onboardingHint: document.getElementById("onboardingHint"),
  onboardingBackButton: document.getElementById("onboardingBackButton"),
  onboardingNextButton: document.getElementById("onboardingNextButton"),
  heroLevel: document.getElementById("heroLevel"),
  heroFocus: document.getElementById("heroFocus"),
  heroStreak: document.getElementById("heroStreak"),
  heroMode: document.getElementById("heroMode"),
  previewPrompt: document.getElementById("previewPrompt"),
  previewAnswer: document.getElementById("previewAnswer"),
  miniMission: document.getElementById("miniMission"),
  miniHint: document.getElementById("miniHint"),
  assessmentStep: document.getElementById("assessmentStep"),
  assessmentBar: document.getElementById("assessmentBar"),
  assessmentQuestion: document.getElementById("assessmentQuestion"),
  assessmentOptions: document.getElementById("assessmentOptions"),
  assessmentSummary: document.getElementById("assessmentSummary"),
  nameInput: document.getElementById("nameInput"),
  saveNameButton: document.getElementById("saveNameButton"),
  levelBadge: document.getElementById("levelBadge"),
  streakValue: document.getElementById("streakValue"),
  lessonValue: document.getElementById("lessonValue"),
  vocabValue: document.getElementById("vocabValue"),
  confidenceValue: document.getElementById("confidenceValue"),
  confidenceBar: document.getElementById("confidenceBar"),
  confidenceNote: document.getElementById("confidenceNote"),
  recommendationBox: document.getElementById("recommendationBox"),
  memoryBox: document.getElementById("memoryBox"),
  runtimeDot: document.getElementById("runtimeDot"),
  runtimeStatus: document.getElementById("runtimeStatus"),
  runtimeNote: document.getElementById("runtimeNote"),
  scenarioTabs: document.getElementById("scenarioTabs"),
  coachPrompt: document.getElementById("coachPrompt"),
  coachInput: document.getElementById("coachInput"),
  coachButton: document.getElementById("coachButton"),
  coachFeedback: document.getElementById("coachFeedback"),
  practiceShowcaseEyebrow: document.getElementById("practiceShowcaseEyebrow"),
  practiceShowcaseTag: document.getElementById("practiceShowcaseTag"),
  practiceShowcaseHeading: document.getElementById("practiceShowcaseHeading"),
  practiceShowcaseText: document.getElementById("practiceShowcaseText"),
  lessonEyebrow: document.getElementById("lessonEyebrow"),
  lessonFocusTag: document.getElementById("lessonFocusTag"),
  lessonHeading: document.getElementById("lessonHeading"),
  lessonText: document.getElementById("lessonText"),
  lessonMeta: document.getElementById("lessonMeta"),
  lessonStepGrid: document.getElementById("lessonStepGrid"),
  generateLessonButton: document.getElementById("generateLessonButton"),
  applyLessonButton: document.getElementById("applyLessonButton"),
  practiceScenarioLabel: document.getElementById("practiceScenarioLabel"),
  practiceScenarioTrack: document.getElementById("practiceScenarioTrack"),
  practiceScenarioTitle: document.getElementById("practiceScenarioTitle"),
  practiceScenarioPrompt: document.getElementById("practiceScenarioPrompt"),
  practiceTargetsLabel: document.getElementById("practiceTargetsLabel"),
  practiceTargetList: document.getElementById("practiceTargetList"),
  practiceRhythmLabel: document.getElementById("practiceRhythmLabel"),
  practiceRhythmList: document.getElementById("practiceRhythmList"),
  practiceRhythmNote: document.getElementById("practiceRhythmNote"),
  writingPromptSelect: document.getElementById("writingPromptSelect"),
  writingInput: document.getElementById("writingInput"),
  writingButton: document.getElementById("writingButton"),
  writingFeedback: document.getElementById("writingFeedback"),
  flashcard: document.getElementById("flashcard"),
  vocabWord: document.getElementById("vocabWord"),
  vocabType: document.getElementById("vocabType"),
  vocabDefinition: document.getElementById("vocabDefinition"),
  vocabExample: document.getElementById("vocabExample"),
  revealExampleButton: document.getElementById("revealExampleButton"),
  markLearnedButton: document.getElementById("markLearnedButton"),
  nextWordButton: document.getElementById("nextWordButton"),
  vocabCounter: document.getElementById("vocabCounter"),
  planSummaryEyebrow: document.getElementById("planSummaryEyebrow"),
  planSummaryTrack: document.getElementById("planSummaryTrack"),
  planSummaryHeading: document.getElementById("planSummaryHeading"),
  planSummaryText: document.getElementById("planSummaryText"),
  planProgressLabel: document.getElementById("planProgressLabel"),
  planProgressValue: document.getElementById("planProgressValue"),
  planProgressBar: document.getElementById("planProgressBar"),
  planDoneLabel: document.getElementById("planDoneLabel"),
  planDoneValue: document.getElementById("planDoneValue"),
  planRemainingLabel: document.getElementById("planRemainingLabel"),
  planRemainingValue: document.getElementById("planRemainingValue"),
  planStreakLabel: document.getElementById("planStreakLabel"),
  planStreakValue: document.getElementById("planStreakValue"),
  planFocusLabel: document.getElementById("planFocusLabel"),
  planFocusText: document.getElementById("planFocusText"),
  planNoteLabel: document.getElementById("planNoteLabel"),
  planNoteText: document.getElementById("planNoteText"),
  planGrid: document.getElementById("planGrid"),
};

const copyElements = {
  metaDescription: document.getElementById("metaDescription"),
  navLinks: [...document.querySelectorAll(".nav a")],
  topbarOpenApp: document.querySelector(".topbar > a.button"),
  themeSwitchLabel: document.getElementById("themeSwitchLabel"),
  pageLeadEyebrow: document.getElementById("pageLeadEyebrow"),
  pageLeadHeading: document.getElementById("pageLeadHeading"),
  pageLeadText: document.getElementById("pageLeadText"),
  pageLeadAsideTitle: document.getElementById("pageLeadAsideTitle"),
  pageLeadAsideText: document.getElementById("pageLeadAsideText"),
  pageLeadPrimaryAction: document.getElementById("pageLeadPrimaryAction"),
  pageLeadSecondaryAction: document.getElementById("pageLeadSecondaryAction"),
  journeyStrip: document.getElementById("journeyStrip"),
  heroBadges: [...document.querySelectorAll(".hero-badge")],
  heroEyebrow: document.querySelector(".hero-copy .eyebrow"),
  heroHeading: document.querySelector(".hero-copy h1"),
  heroText: document.querySelector(".hero-text"),
  goalLabel: document.querySelector(".goal-label"),
  heroActionButtons: [...document.querySelectorAll(".hero-actions .button")],
  heroStatLabels: [...document.querySelectorAll(".hero-stats .stat-label")],
  heroPreviewTitle: document.querySelector(".hero-card-header span:last-of-type"),
  heroAnswerTag: document.querySelector(".hero-card-answer .tag"),
  heroFeedbackNames: [...document.querySelectorAll(".hero-card-main .feedback-name")],
  heroMiniTitles: [...document.querySelectorAll(".hero-card-stack .mini-title")],
  assistantTag: document.getElementById("assistantTag"),
  assistantTitle: document.getElementById("assistantTitle"),
  assistantText: document.getElementById("assistantText"),
  assistantBubbleOne: document.getElementById("assistantBubbleOne"),
  assistantBubbleTwo: document.getElementById("assistantBubbleTwo"),
  heroStartTitle: document.getElementById("heroStartTitle"),
  heroChecklist: document.getElementById("heroChecklist"),
  guideEyebrow: document.getElementById("guideEyebrow"),
  guideHeading: document.getElementById("guideHeading"),
  guideText: document.getElementById("guideText"),
  guideWindowLabel: document.getElementById("guideWindowLabel"),
  guideFlowList: document.getElementById("guideFlowList"),
  guideAsideTitle: document.getElementById("guideAsideTitle"),
  guideAsideText: document.getElementById("guideAsideText"),
  guidePrimaryAction: document.getElementById("guidePrimaryAction"),
  guideSecondaryAction: document.getElementById("guideSecondaryAction"),
  focusCards: [...document.querySelectorAll(".focus-card")],
  learnEyebrow: document.querySelector(".dashboard-section .section-heading .eyebrow"),
  learnHeading: document.querySelector(".dashboard-section .section-heading h2"),
  learnText: document.getElementById("learnText"),
  learnNoteTag: document.getElementById("learnNoteTag"),
  learnNoteText: document.getElementById("learnNoteText"),
  learnSpotlightTitle: document.getElementById("learnSpotlightTitle"),
  learnSpotlightTag: document.getElementById("learnSpotlightTag"),
  learnSpotlightOne: document.getElementById("learnSpotlightOne"),
  learnSpotlightTwo: document.getElementById("learnSpotlightTwo"),
  learnSpotlightThree: document.getElementById("learnSpotlightThree"),
  placementTopline: document.querySelector(".placement-card .card-topline span:last-of-type"),
  profileTopline: document.querySelector(".profile-card .card-topline span:last-of-type"),
  learnerNameLabel: document.querySelector('label[for="nameInput"]'),
  metricLabels: [...document.querySelectorAll(".profile-card .metric-label")],
  confidenceLabel: document.querySelector(".confidence-header span"),
  labEyebrow: document.querySelector(".lab-section .section-heading .eyebrow"),
  labHeading: document.querySelector(".lab-section .section-heading h2"),
  coachTopline: document.querySelector(".lab-grid .lab-card:nth-of-type(1) .card-topline span:last-of-type"),
  coachInputLabel: document.querySelector('label[for="coachInput"]'),
  writingTopline: document.querySelector(".lab-grid .lab-card:nth-of-type(2) .card-topline span:last-of-type"),
  writingPromptLabel: document.querySelector('label[for="writingPromptSelect"]'),
  writingInputLabel: document.querySelector('label[for="writingInput"]'),
  vocabTopline: document.querySelector(".vocab-card .card-topline span:last-of-type"),
  planEyebrow: document.querySelector(".plan-section .section-heading .eyebrow"),
  planHeading: document.querySelector(".plan-section .section-heading h2"),
  footerText: document.querySelector(".footer p"),
};

function createEmptyGoalMemory() {
  return {
    reviewedSessions: 0,
    recentSessions: [],
    lastFocusTag: "",
    lastCoachNote: "",
    lastRecommendedDrill: "",
    lastLocale: "",
    updatedAt: null,
  };
}

function createEmptyMemoryState() {
  return {
    byGoal: GOAL_IDS.reduce((accumulator, goal) => {
      accumulator[goal] = createEmptyGoalMemory();
      return accumulator;
    }, {}),
  };
}

function createEmptyLessonState() {
  return {
    variantByGoal: GOAL_IDS.reduce((accumulator, goal) => {
      accumulator[goal] = 0;
      return accumulator;
    }, {}),
  };
}

function ensureAuthShell() {
  const topbarPrimaryAction = document.querySelector(".topbar > a.button");
  if (topbarPrimaryAction && !document.getElementById("authTriggerButton")) {
    const authTriggerButton = document.createElement("button");
    authTriggerButton.id = "authTriggerButton";
    authTriggerButton.type = "button";
    authTriggerButton.className = "button button-secondary button-small auth-trigger-button";
    authTriggerButton.textContent = "Sign in";
    topbarPrimaryAction.before(authTriggerButton);
  }

  if (!document.getElementById("authOverlay")) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="auth-overlay" id="authOverlay" aria-hidden="true">
        <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="authAsideTitle">
          <div class="auth-shell">
            <aside class="auth-aside">
              <span class="mini-title" id="authEyebrow">Account sync</span>
              <h2 id="authAsideTitle">Back up your level, streak, and tutor memory.</h2>
              <p class="section-note-text auth-aside-text" id="authAsideText">
                Create an account to keep your progress on the server and continue on every page with the same learning state.
              </p>
              <div class="auth-benefit-list" id="authBenefitList"></div>
            </aside>

            <section class="auth-main">
              <div class="auth-topbar">
                <div class="auth-mode-switch" id="authModeSwitch">
                  <button class="auth-mode-button is-active" data-auth-mode="login" type="button">Sign in</button>
                  <button class="auth-mode-button" data-auth-mode="register" type="button">Create account</button>
                </div>
                <button class="button button-secondary button-small auth-close-button" id="authCloseButton" type="button">Close</button>
              </div>
              <div class="auth-view" id="authView"></div>
            </section>
          </div>
        </div>
      </div>
    `;
    document.body.append(wrapper.firstElementChild);
  }
}

initialize();

function initializeLocalePreference() {
  const nextLocale = coerceLocale(state.preferences?.locale) || detectPreferredLocale();
  state.preferences = state.preferences || {};
  if (state.preferences.locale !== nextLocale) {
    state.preferences.locale = nextLocale;
    saveState({ touch: false, sync: false });
  }
}

function initializeThemePreference() {
  const nextTheme = coerceTheme(state.preferences?.theme) || "day";
  state.preferences = state.preferences || {};
  if (state.preferences.theme !== nextTheme) {
    state.preferences.theme = nextTheme;
    saveState({ touch: false, sync: false });
  }
  applyTheme(nextTheme);
}

function detectPreferredLocale() {
  const browserLanguage = typeof navigator !== "undefined" ? navigator.language || navigator.userLanguage || "" : "";
  return coerceLocale(browserLanguage) || "en";
}

function coerceLocale(value) {
  const normalized = String(value || "").toLowerCase().slice(0, 2);
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
}

function coerceTheme(value) {
  const normalized = String(value || "").toLowerCase().trim();
  return SUPPORTED_THEMES.includes(normalized) ? normalized : null;
}

function getLocale() {
  return coerceLocale(state.preferences?.locale) || "en";
}

function getTheme() {
  return coerceTheme(state.preferences?.theme) || "day";
}

function getLocalePack() {
  return I18N.uiCopy?.[getLocale()] || I18N.uiCopy?.en || {};
}

function getThemeCopy() {
  return THEME_COPY[getLocale()] || THEME_COPY.en;
}

function getCurrentPageId() {
  return document.body?.dataset?.page || "home";
}

function getPageLeadCopy() {
  const locale = getLocale();
  const pageId = getCurrentPageId();
  return PAGE_LEAD_COPY[locale]?.[pageId] || PAGE_LEAD_COPY.en?.[pageId] || null;
}

function getPracticeShowcaseCopy() {
  return PRACTICE_SHOWCASE_COPY[getLocale()] || PRACTICE_SHOWCASE_COPY.en;
}

function getPlanSummaryCopy() {
  return PLAN_SUMMARY_COPY[getLocale()] || PLAN_SUMMARY_COPY.en;
}

function getJourneyCopy() {
  return JOURNEY_COPY[getLocale()] || JOURNEY_COPY.en;
}

function getLessonCopy() {
  return LESSON_COPY[getLocale()] || LESSON_COPY.en;
}

function getOnboardingCopy() {
  return ONBOARDING_COPY[getLocale()] || ONBOARDING_COPY.en;
}

function getAuthCopy() {
  return AUTH_COPY[getLocale()] || AUTH_COPY.en;
}

function getDisplayLocaleLabel(locale) {
  return getOnboardingCopy().language.options?.[locale]?.label || String(locale || "").toUpperCase();
}

function readCopy(source, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current && key in current ? current[key] : undefined), source);
}

function interpolateCopy(value, vars = {}) {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : ""));
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateCopy(item, vars));
  }
  return value;
}

function t(path, vars = {}, fallback = "") {
  const value = readCopy(getLocalePack(), path);
  if (value === undefined) {
    return fallback;
  }
  return interpolateCopy(value, vars);
}

function resolveLocalizedValue(value, fallback) {
  if (typeof value === "string") {
    return value;
  }
  if (isPlainObject(value)) {
    const locale = getLocale();
    if (typeof value[locale] === "string") {
      return value[locale];
    }
    if (typeof value.en === "string") {
      return value.en;
    }
  }
  return fallback;
}

function syncDialogOpenState() {
  document.body.classList.toggle("is-dialog-open", onboardingOpen || authSession.modalOpen);
}

function getLocalizedGoal(goal = state.profile.goal) {
  const base = goalContent[goal];
  const overrides = I18N.goalTranslations?.[goal] || {};
  const locale = getLocale();

  return {
    ...base,
    label: resolveLocalizedValue(overrides.label, base.label),
    previewPrompt: resolveLocalizedValue(overrides.previewPrompt, base.previewPrompt),
    previewAnswer: base.previewAnswer,
    miniMission: resolveLocalizedValue(overrides.miniMission, base.miniMission),
    miniHint: resolveLocalizedValue(overrides.miniHint, base.miniHint),
    scenarios: base.scenarios.map((scenario, index) => ({
      ...scenario,
      title: resolveLocalizedValue(overrides.scenarios?.[index]?.title, scenario.title),
      prompt: resolveLocalizedValue(overrides.scenarios?.[index]?.prompt, scenario.prompt),
    })),
    prompts: locale === "en" ? base.prompts : overrides.prompts?.[locale] || base.prompts,
    vocabulary: base.vocabulary,
    plan: base.plan.map((task, index) => ({
      ...task,
      title: resolveLocalizedValue(overrides.plan?.[index]?.title, task.title),
      detail: resolveLocalizedValue(overrides.plan?.[index]?.detail, task.detail),
    })),
  };
}

function getAssessmentPrompt(index) {
  return I18N.assessmentPrompts?.[getLocale()]?.[index] || assessmentQuestions[index].question;
}

function setRuntimeState(statusKey, noteKey, { statusVars = {}, noteVars = {} } = {}) {
  runtime.statusKey = statusKey;
  runtime.noteKey = noteKey;
  runtime.statusVars = statusVars;
  runtime.noteVars = noteVars;
}

function getOnboardingStep() {
  return clamp(Number(state.onboarding?.step) || 0, 0, 3);
}

function shouldAutoOpenOnboarding() {
  return getCurrentPageId() === "home" && !state.onboarding?.completed && !state.onboarding?.dismissed;
}

function openOnboarding(step = 0) {
  if (!elements.onboardingOverlay) {
    return;
  }

  onboardingOpen = true;
  state.onboarding.step = clamp(step, 0, 3);
  saveState();
  renderOnboarding();
}

function closeOnboarding({ complete = false, dismissed = false } = {}) {
  onboardingOpen = false;

  if (complete) {
    state.onboarding.completed = true;
    state.onboarding.dismissed = false;
  } else if (dismissed && !state.onboarding.completed) {
    state.onboarding.dismissed = true;
  }

  saveState();
  renderOnboarding();
}

function renderOnboarding() {
  if (!elements.onboardingOverlay) {
    return;
  }

  const copy = getOnboardingCopy();
  const themeCopy = getThemeCopy();
  const step = getOnboardingStep();
  const total = copy.steps.length;
  const learnerName = state.profile.name === "Learner" ? "" : (state.profile.name || "").trim();

  if (elements.onboardingLaunchButton) {
    elements.onboardingLaunchButton.textContent = state.onboarding.completed ? copy.launcherEdit : copy.launcherOpen;
  }

  elements.onboardingOverlay.classList.toggle("is-open", onboardingOpen);
  elements.onboardingOverlay.setAttribute("aria-hidden", onboardingOpen ? "false" : "true");
  syncDialogOpenState();

  if (!onboardingOpen) {
    return;
  }

  const stageConfigs = [
    {
      title: copy.language.title,
      text: copy.language.text,
      hint: copy.language.hint,
      nextLabel: copy.continue,
      closeLabel: copy.skip,
      stageMarkup: `
        <div class="onboarding-choice-grid">
          ${SUPPORTED_LOCALES.map((locale) => {
            const option = copy.language.options?.[locale];
            return `
              <button class="onboarding-choice ${locale === getLocale() ? "is-active" : ""}" data-onboarding-locale="${locale}" type="button">
                <span class="onboarding-choice-title">${escapeHtml(option?.label || locale.toUpperCase())}</span>
                <span class="onboarding-choice-text">${escapeHtml(option?.description || "")}</span>
              </button>
            `;
          }).join("")}
        </div>
      `,
    },
    {
      title: copy.goal.title,
      text: copy.goal.text,
      hint: copy.goal.hint,
      nextLabel: copy.continue,
      closeLabel: copy.skip,
      stageMarkup: `
        <div class="onboarding-choice-grid">
          ${GOAL_IDS.map((goalId) => `
            <button class="onboarding-choice ${goalId === state.profile.goal ? "is-active" : ""}" data-onboarding-goal="${goalId}" type="button">
              <span class="onboarding-choice-title">${escapeHtml(getLocalizedGoal(goalId).label)}</span>
              <span class="onboarding-choice-text">${escapeHtml(copy.goal.descriptions?.[goalId] || "")}</span>
            </button>
          `).join("")}
        </div>
      `,
    },
    {
      title: copy.theme.title,
      text: copy.theme.text,
      hint: copy.theme.hint,
      nextLabel: copy.continue,
      closeLabel: copy.skip,
      stageMarkup: `
        <div class="onboarding-stage-stack">
          <div class="onboarding-stack-block">
            <span class="mini-title">${escapeHtml(copy.theme.themeLabel)}</span>
            <div class="onboarding-choice-grid">
              ${SUPPORTED_THEMES.map((themeId) => `
                <button class="onboarding-choice ${themeId === getTheme() ? "is-active" : ""}" data-onboarding-theme="${themeId}" type="button">
                  <span class="onboarding-choice-title">${escapeHtml(themeId === "space" ? themeCopy.space : themeCopy.day)}</span>
                  <span class="onboarding-choice-text">${escapeHtml(copy.theme.themes?.[themeId]?.description || "")}</span>
                </button>
              `).join("")}
            </div>
          </div>
          <label class="onboarding-input-wrap">
            <span class="mini-title">${escapeHtml(copy.theme.nameLabel)}</span>
            <input id="onboardingNameInput" data-onboarding-name type="text" maxlength="20" value="${escapeHtml(state.profile.name === "Learner" ? "" : state.profile.name)}" placeholder="${escapeHtml(copy.theme.namePlaceholder)}">
          </label>
        </div>
      `,
    },
    {
      title: copy.start.title,
      text: copy.start.text,
      hint: copy.start.hint,
      nextLabel: copy.finish,
      closeLabel: copy.close,
      stageMarkup: `
        <div class="onboarding-stage-stack">
          <div class="onboarding-summary-grid">
            <article class="onboarding-summary-card">
              <span class="mini-title">${escapeHtml(copy.start.languageLabel)}</span>
              <strong>${escapeHtml(getDisplayLocaleLabel(getLocale()))}</strong>
            </article>
            <article class="onboarding-summary-card">
              <span class="mini-title">${escapeHtml(copy.start.goalLabel)}</span>
              <strong>${escapeHtml(getLocalizedGoal(state.profile.goal).label)}</strong>
            </article>
            <article class="onboarding-summary-card">
              <span class="mini-title">${escapeHtml(copy.start.themeLabel)}</span>
              <strong>${escapeHtml(getTheme() === "space" ? themeCopy.space : themeCopy.day)}</strong>
            </article>
            <article class="onboarding-summary-card">
              <span class="mini-title">${escapeHtml(copy.start.nameLabel)}</span>
              <strong>${escapeHtml(learnerName || copy.start.emptyName)}</strong>
            </article>
          </div>
          <div class="onboarding-next-box">
            <span class="mini-title">${escapeHtml(copy.start.nextTitle)}</span>
            <div class="onboarding-next-list">
              ${copy.start.nextSteps
                .map(
                  (item, index) => `
                    <div class="onboarding-next-item">
                      <span class="onboarding-next-index">${String(index + 1).padStart(2, "0")}</span>
                      <span>${escapeHtml(item)}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      `,
    },
  ];

  const config = stageConfigs[step];

  elements.onboardingEyebrow.textContent = copy.eyebrow;
  elements.onboardingTopTag.textContent = copy.topTag;
  elements.onboardingProgressText.textContent = interpolateCopy(copy.progress, { current: step + 1, total });
  elements.onboardingProgressBar.style.width = `${((step + 1) / total) * 100}%`;
  elements.onboardingStepList.innerHTML = copy.steps
    .map(
      (label, index) => `
        <div class="onboarding-step ${index === step ? "is-active" : ""} ${index < step ? "is-complete" : ""}">
          <span class="onboarding-step-index">${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(label)}</span>
        </div>
      `
    )
    .join("");

  elements.onboardingTitle.textContent = config.title;
  elements.onboardingText.textContent = config.text;
  elements.onboardingStage.innerHTML = config.stageMarkup;
  elements.onboardingHint.textContent = config.hint;
  elements.onboardingCloseButton.textContent = config.closeLabel;
  elements.onboardingBackButton.textContent = copy.back;
  elements.onboardingBackButton.disabled = step === 0;
  elements.onboardingNextButton.textContent = config.nextLabel;
}

function getAuthButtonLabel(copy = getAuthCopy()) {
  if (authSession.loading) {
    return copy.loading;
  }

  if (!authSession.user) {
    return copy.open;
  }

  const learnerName = state.profile.name && state.profile.name !== "Learner" ? state.profile.name : "";
  const preferredLabel = authSession.user.displayName || learnerName || authSession.user.email.split("@")[0] || copy.signedIn;
  return preferredLabel.slice(0, 18);
}

function getAuthSyncLabel(copy = getAuthCopy()) {
  if (authSession.syncStatus === "pending") {
    return copy.syncPending;
  }
  if (authSession.syncStatus === "syncing") {
    return copy.syncSyncing;
  }
  if (authSession.syncStatus === "synced") {
    return copy.syncSynced;
  }
  if (authSession.syncStatus === "error") {
    return copy.syncError;
  }
  return copy.syncIdle;
}

function formatSyncTimestamp(value, copy = getAuthCopy()) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return copy.notSynced;
  }

  return new Intl.DateTimeFormat(getLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function setAuthMessage(message = "", type = "neutral") {
  authSession.message = message;
  authSession.messageType = type;
}

function openAuthModal(mode = authSession.user ? "account" : "login") {
  authSession.modalOpen = true;
  authSession.mode = authSession.user ? "account" : mode === "register" ? "register" : "login";
  if (!authSession.form.displayName && state.profile.name && state.profile.name !== "Learner") {
    authSession.form.displayName = state.profile.name;
  }
  renderAuthUI();
}

function closeAuthModal() {
  authSession.modalOpen = false;
  renderAuthUI();
}

function renderAuthUI() {
  if (
    !elements.authTriggerButton ||
    !elements.authOverlay ||
    !elements.authEyebrow ||
    !elements.authAsideTitle ||
    !elements.authAsideText ||
    !elements.authBenefitList ||
    !elements.authModeSwitch ||
    !elements.authCloseButton ||
    !elements.authView
  ) {
    return;
  }

  const copy = getAuthCopy();
  const isAuthenticated = Boolean(authSession.user);
  const isRegister = authSession.mode === "register";

  elements.authTriggerButton.textContent = getAuthButtonLabel(copy);
  elements.authTriggerButton.classList.toggle("is-authenticated", isAuthenticated);
  elements.authEyebrow.textContent = copy.eyebrow;
  elements.authAsideTitle.textContent = copy.asideTitle;
  elements.authAsideText.textContent = copy.asideText;
  elements.authBenefitList.innerHTML = copy.benefits
    .map(
      (item, index) => `
        <div class="auth-benefit-item">
          <span class="auth-benefit-index">${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(item)}</span>
        </div>
      `
    )
    .join("");

  elements.authOverlay.classList.toggle("is-open", authSession.modalOpen);
  elements.authOverlay.setAttribute("aria-hidden", authSession.modalOpen ? "false" : "true");
  syncDialogOpenState();

  elements.authModeSwitch.classList.toggle("is-hidden", isAuthenticated);
  const modeButtons = [...elements.authModeSwitch.querySelectorAll("[data-auth-mode]")];
  modeButtons.forEach((button) => {
    const mode = button.dataset.authMode;
    button.classList.toggle("is-active", mode === authSession.mode);
    button.textContent = mode === "register" ? copy.registerTab : copy.loginTab;
    button.disabled = authSession.busy;
  });

  elements.authCloseButton.textContent = copy.close;

  if (isAuthenticated) {
    elements.authView.innerHTML = `
      <div class="auth-panel">
        <div class="auth-copy-block">
          <h3>${escapeHtml(copy.loggedInTitle)}</h3>
          <p>${escapeHtml(copy.loggedInText)}</p>
        </div>
        <div class="auth-account-grid">
          <div class="auth-account-metric">
            <span class="mini-title">${escapeHtml(copy.signedInAs)}</span>
            <strong>${escapeHtml(authSession.user.email)}</strong>
          </div>
          <div class="auth-account-metric">
            <span class="mini-title">${escapeHtml(copy.learnerLabel)}</span>
            <strong>${escapeHtml(state.profile.name)}</strong>
          </div>
          <div class="auth-account-metric">
            <span class="mini-title">${escapeHtml(copy.lastSyncLabel)}</span>
            <strong>${escapeHtml(formatSyncTimestamp(state.meta?.lastSyncedAt, copy))}</strong>
          </div>
        </div>
        <div class="auth-sync-note auth-sync-note-${escapeHtml(authSession.syncStatus)}">${escapeHtml(getAuthSyncLabel(copy))}</div>
        ${
          authSession.message
            ? `<p class="auth-message auth-message-${escapeHtml(authSession.messageType)}">${escapeHtml(authSession.message)}</p>`
            : ""
        }
        <div class="auth-panel-actions">
          <button class="button button-small" id="authSyncButton" type="button" ${authSession.syncStatus === "syncing" ? "disabled" : ""}>${escapeHtml(
            copy.syncNow
          )}</button>
          <button class="button button-secondary button-small" id="authLogoutButton" type="button" ${authSession.busy ? "disabled" : ""}>${escapeHtml(
            copy.logout
          )}</button>
        </div>
      </div>
    `;
    return;
  }

  elements.authView.innerHTML = `
    <div class="auth-panel">
      <div class="auth-copy-block">
        <h3>${escapeHtml(isRegister ? copy.registerTitle : copy.loginTitle)}</h3>
        <p>${escapeHtml(isRegister ? copy.registerText : copy.loginText)}</p>
      </div>
      <div class="auth-form-grid">
        ${
          isRegister
            ? `
              <label class="auth-field">
                <span>${escapeHtml(copy.nameLabel)}</span>
                <input id="authDisplayNameInput" data-auth-field="displayName" type="text" maxlength="40" value="${escapeHtml(
                  authSession.form.displayName || ""
                )}" placeholder="${escapeHtml(copy.namePlaceholder)}">
              </label>
            `
            : ""
        }
        <label class="auth-field">
          <span>${escapeHtml(copy.emailLabel)}</span>
          <input id="authEmailInput" data-auth-field="email" type="email" maxlength="120" value="${escapeHtml(
            authSession.form.email || ""
          )}" placeholder="${escapeHtml(copy.emailPlaceholder)}" autocomplete="email">
        </label>
        <label class="auth-field">
          <span>${escapeHtml(copy.passwordLabel)}</span>
          <input id="authPasswordInput" data-auth-field="password" type="password" maxlength="128" value="${escapeHtml(
            authSession.form.password || ""
          )}" placeholder="${escapeHtml(copy.passwordPlaceholder)}" autocomplete="${isRegister ? "new-password" : "current-password"}">
        </label>
      </div>
      ${
        authSession.message
          ? `<p class="auth-message auth-message-${escapeHtml(authSession.messageType)}">${escapeHtml(authSession.message)}</p>`
          : ""
      }
      <div class="auth-panel-actions">
        <button class="button button-small" id="authSubmitButton" type="button" ${authSession.busy ? "disabled" : ""}>${escapeHtml(
          isRegister ? copy.submitRegister : copy.submitLogin
        )}</button>
      </div>
    </div>
  `;
}

function renderLanguageSwitch() {
  elements.localeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === getLocale());
  });
}

function renderJourneyStrip() {
  if (!copyElements.journeyStrip) {
    return;
  }

  const copy = getJourneyCopy();
  const steps = [
    { id: "home", label: t("nav.startHere") },
    { id: "roadmap", label: t("nav.roadmap") },
    { id: "practice", label: t("nav.practice") },
    { id: "plan", label: t("nav.dailyPlan") },
  ];
  const currentIndex = Math.max(
    steps.findIndex((step) => step.id === getCurrentPageId()),
    0
  );

  copyElements.journeyStrip.innerHTML = steps
    .map((step, index) => {
      const stateClass = index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : "is-next";
      const stateLabel = index < currentIndex ? copy.done : index === currentIndex ? copy.now : copy.next;

      return `
        <div class="journey-step ${stateClass}">
          <span class="journey-step-index">${String(index + 1).padStart(2, "0")}</span>
          <div class="journey-step-copy">
            <span class="journey-step-status">${escapeHtml(stateLabel)}</span>
            <strong>${escapeHtml(step.label)}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function applyTheme(themeName = getTheme()) {
  const theme = coerceTheme(themeName) || "day";
  document.body.dataset.theme = theme;
}

function renderThemeSwitch() {
  const theme = getTheme();
  applyTheme(theme);
  elements.themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeChoice === theme);
  });
}

function setRichText(element, text) {
  if (!element) {
    return;
  }
  element.innerHTML = escapeHtml(text).replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderStaticCopy() {
  const localePack = getLocalePack();
  const themeCopy = getThemeCopy();
  document.documentElement.lang = getLocale();
  document.title = t("pageTitle", {}, document.title);
  copyElements.metaDescription?.setAttribute("content", t("metaDescription", {}, copyElements.metaDescription?.getAttribute("content") || ""));
  elements.languageSwitch?.setAttribute("aria-label", t("languageSwitch", {}, "Language switch"));
  elements.themeSwitch?.setAttribute("aria-label", themeCopy.switchLabel);
  if (copyElements.themeSwitchLabel) {
    copyElements.themeSwitchLabel.textContent = themeCopy.label;
  }
  if (elements.themeButtons[0]) {
    elements.themeButtons[0].textContent = themeCopy.space;
  }
  if (elements.themeButtons[1]) {
    elements.themeButtons[1].textContent = themeCopy.day;
  }

  if (copyElements.navLinks[0]) {
    copyElements.navLinks[0].textContent = t("nav.startHere");
  }
  if (copyElements.navLinks[1]) {
    copyElements.navLinks[1].textContent = t("nav.roadmap");
  }
  if (copyElements.navLinks[2]) {
    copyElements.navLinks[2].textContent = t("nav.practice");
  }
  if (copyElements.navLinks[3]) {
    copyElements.navLinks[3].textContent = t("nav.dailyPlan");
  }
  if (copyElements.topbarOpenApp) {
    copyElements.topbarOpenApp.textContent = t("hero.startPlacement");
  }

  const pageLeadCopy = getPageLeadCopy();
  if (pageLeadCopy) {
    if (copyElements.pageLeadEyebrow) {
      copyElements.pageLeadEyebrow.textContent = pageLeadCopy.eyebrow;
    }
    if (copyElements.pageLeadHeading) {
      setRichText(copyElements.pageLeadHeading, pageLeadCopy.heading);
    }
    if (copyElements.pageLeadText) {
      copyElements.pageLeadText.textContent = pageLeadCopy.text;
    }
    if (copyElements.pageLeadAsideTitle) {
      copyElements.pageLeadAsideTitle.textContent = pageLeadCopy.asideTitle;
    }
    if (copyElements.pageLeadAsideText) {
      copyElements.pageLeadAsideText.textContent = pageLeadCopy.asideText;
    }
    if (copyElements.pageLeadPrimaryAction) {
      copyElements.pageLeadPrimaryAction.textContent = pageLeadCopy.primaryAction;
    }
    if (copyElements.pageLeadSecondaryAction) {
      copyElements.pageLeadSecondaryAction.textContent = pageLeadCopy.secondaryAction;
    }
  }

  const heroBadges = Array.isArray(localePack.hero?.badges) ? localePack.hero.badges : [];
  copyElements.heroBadges.forEach((badge, index) => {
    badge.textContent = heroBadges[index] || badge.textContent;
  });

  if (copyElements.heroEyebrow) {
    copyElements.heroEyebrow.textContent = t("hero.eyebrow");
  }
  if (copyElements.heroHeading) {
    setRichText(copyElements.heroHeading, t("hero.heading"));
  }
  if (copyElements.heroText) {
    copyElements.heroText.textContent = t("hero.text");
  }
  if (copyElements.goalLabel) {
    copyElements.goalLabel.textContent = t("hero.chooseTrack");
  }
  if (copyElements.heroActionButtons[0]) {
    copyElements.heroActionButtons[0].textContent = t("hero.startPlacement");
  }
  if (copyElements.heroActionButtons[1]) {
    copyElements.heroActionButtons[1].textContent = t("hero.seeDailyPlan");
  }

  const statLabels = [t("hero.level"), t("hero.focus"), t("hero.streak"), t("hero.mode")];
  copyElements.heroStatLabels.forEach((label, index) => {
    label.textContent = statLabels[index] || label.textContent;
  });

  if (copyElements.heroPreviewTitle) {
    copyElements.heroPreviewTitle.textContent = t("hero.preview");
  }
  if (copyElements.heroAnswerTag) {
    copyElements.heroAnswerTag.textContent = t("hero.yourAnswer");
  }

  const heroFeedbackNames = [t("hero.clarity"), t("hero.grammar"), t("hero.confidence")];
  copyElements.heroFeedbackNames.forEach((label, index) => {
    label.textContent = heroFeedbackNames[index] || label.textContent;
  });

  const miniTitles = [t("hero.today"), t("hero.aiNote")];
  copyElements.heroMiniTitles.forEach((label, index) => {
    label.textContent = miniTitles[index] || label.textContent;
  });

  if (copyElements.assistantTag) {
    copyElements.assistantTag.textContent = t("hero.assistantTag");
  }
  if (copyElements.assistantTitle) {
    copyElements.assistantTitle.textContent = t("hero.assistantTitle");
  }
  if (copyElements.assistantText) {
    copyElements.assistantText.textContent = t("hero.assistantText");
  }
  if (copyElements.assistantBubbleOne) {
    copyElements.assistantBubbleOne.textContent = t("hero.assistantBubbleOne");
  }
  if (copyElements.assistantBubbleTwo) {
    copyElements.assistantBubbleTwo.textContent = t("hero.assistantBubbleTwo");
  }
  if (copyElements.heroStartTitle) {
    copyElements.heroStartTitle.textContent = t("hero.startTitle");
  }
  if (copyElements.heroChecklist) {
    const checklist = Array.isArray(localePack.hero?.checklist) ? localePack.hero.checklist : [];
    copyElements.heroChecklist.innerHTML = checklist
      .map(
        (item, index) => `
          <div class="hero-check-item">
            <span class="hero-step-number">${index + 1}</span>
            <span>${escapeHtml(item)}</span>
          </div>
        `
      )
      .join("");
  }

  const focusCards = Array.isArray(localePack.focusCards) ? localePack.focusCards : [];
  copyElements.focusCards.forEach((card, index) => {
    const cardCopy = focusCards[index];
    if (!cardCopy) {
      return;
    }
    const title = card.querySelector("h2");
    const text = card.querySelector("p");
    if (title) {
      title.textContent = cardCopy.title;
    }
    if (text) {
      text.textContent = cardCopy.text;
    }
  });

  if (copyElements.guideEyebrow) {
    copyElements.guideEyebrow.textContent = t("guide.eyebrow");
  }
  if (copyElements.guideHeading) {
    setRichText(copyElements.guideHeading, t("guide.heading"));
  }
  if (copyElements.guideText) {
    copyElements.guideText.textContent = t("guide.text");
  }
  if (copyElements.guideWindowLabel) {
    copyElements.guideWindowLabel.textContent = t("guide.windowLabel");
  }
  if (copyElements.guideFlowList) {
    const flow = Array.isArray(localePack.guide?.flow) ? localePack.guide.flow : [];
    copyElements.guideFlowList.innerHTML = flow
      .map(
        (item, index) => `
          <div class="guide-flow-item">
            <span class="guide-flow-index">0${index + 1}</span>
            <span>${escapeHtml(item)}</span>
          </div>
        `
      )
      .join("");
  }
  if (copyElements.guideAsideTitle) {
    copyElements.guideAsideTitle.textContent = t("guide.asideTitle");
  }
  if (copyElements.guideAsideText) {
    copyElements.guideAsideText.textContent = t("guide.asideText");
  }
  if (copyElements.guidePrimaryAction) {
    copyElements.guidePrimaryAction.textContent = t("guide.primaryAction");
  }
  if (copyElements.guideSecondaryAction) {
    copyElements.guideSecondaryAction.textContent = t("guide.secondaryAction");
  }

  if (copyElements.learnEyebrow) {
    copyElements.learnEyebrow.textContent = t("learn.eyebrow");
  }
  if (copyElements.learnHeading) {
    copyElements.learnHeading.textContent = t("learn.heading");
  }
  if (copyElements.learnText) {
    copyElements.learnText.textContent = t("learn.text");
  }
  if (copyElements.learnNoteTag) {
    copyElements.learnNoteTag.textContent = t("learn.noteTag");
  }
  if (copyElements.learnNoteText) {
    copyElements.learnNoteText.textContent = t("learn.noteText");
  }
  if (copyElements.learnSpotlightTitle) {
    copyElements.learnSpotlightTitle.textContent = t("learn.spotlightTitle");
  }
  if (copyElements.learnSpotlightTag) {
    copyElements.learnSpotlightTag.textContent = t("learn.spotlightTag");
  }
  if (copyElements.learnSpotlightOne) {
    copyElements.learnSpotlightOne.textContent = t("learn.spotlightOne");
  }
  if (copyElements.learnSpotlightTwo) {
    copyElements.learnSpotlightTwo.textContent = t("learn.spotlightTwo");
  }
  if (copyElements.learnSpotlightThree) {
    copyElements.learnSpotlightThree.textContent = t("learn.spotlightThree");
  }
  if (copyElements.placementTopline) {
    copyElements.placementTopline.textContent = t("learn.placementSprint");
  }
  if (copyElements.profileTopline) {
    copyElements.profileTopline.textContent = t("learn.profileConsole");
  }
  if (copyElements.learnerNameLabel) {
    copyElements.learnerNameLabel.textContent = t("learn.learnerName");
  }
  if (elements.nameInput) {
    elements.nameInput.placeholder = t("learn.learnerPlaceholder");
  }
  if (elements.saveNameButton) {
    elements.saveNameButton.textContent = t("learn.save");
  }

  const metricLabels = [t("learn.level"), t("learn.streak"), t("learn.sessions"), t("learn.words")];
  copyElements.metricLabels.forEach((label, index) => {
    label.textContent = metricLabels[index] || label.textContent;
  });

  if (copyElements.confidenceLabel) {
    copyElements.confidenceLabel.textContent = t("learn.confidenceMeter");
  }

  if (copyElements.labEyebrow) {
    copyElements.labEyebrow.textContent = t("lab.eyebrow");
  }
  if (copyElements.labHeading) {
    copyElements.labHeading.textContent = t("lab.heading");
  }
  if (copyElements.coachTopline) {
    copyElements.coachTopline.textContent = t("lab.conversationArena");
  }
  if (copyElements.coachInputLabel) {
    copyElements.coachInputLabel.textContent = t("lab.writeAnswerInEnglish");
  }
  if (elements.coachInput) {
    elements.coachInput.placeholder = t("lab.coachPlaceholder");
  }
  if (elements.coachButton && !elements.coachButton.classList.contains("is-loading")) {
    elements.coachButton.textContent = t("lab.getAiFeedback");
  }

  if (copyElements.writingTopline) {
    copyElements.writingTopline.textContent = t("lab.writingDoctor");
  }
  if (copyElements.writingPromptLabel) {
    copyElements.writingPromptLabel.textContent = t("lab.prompt");
  }
  if (copyElements.writingInputLabel) {
    copyElements.writingInputLabel.textContent = t("lab.write4to8");
  }
  if (elements.writingInput) {
    elements.writingInput.placeholder = t("lab.writingPlaceholder");
  }
  if (elements.writingButton && !elements.writingButton.classList.contains("is-loading")) {
    elements.writingButton.textContent = t("lab.reviewWriting");
  }

  if (copyElements.vocabTopline) {
    copyElements.vocabTopline.textContent = t("lab.wordForge");
  }

  if (copyElements.planEyebrow) {
    copyElements.planEyebrow.textContent = t("plan.eyebrow");
  }
  if (copyElements.planHeading) {
    copyElements.planHeading.textContent = t("plan.heading");
  }
  if (copyElements.footerText) {
    copyElements.footerText.textContent = t("footer");
  }

  renderLanguageSwitch();
  renderThemeSwitch();
  renderJourneyStrip();
}

function getGoalMemory(goal = state.profile.goal) {
  state.memory = state.memory || createEmptyMemoryState();
  state.memory.byGoal = state.memory.byGoal || {};
  if (!state.memory.byGoal[goal]) {
    state.memory.byGoal[goal] = createEmptyGoalMemory();
  }
  return state.memory.byGoal[goal];
}

function getMemoryTagLabel(tag) {
  return t(`memory.tagNames.${tag}`, {}, tag.replace(/_/g, " "));
}

function normalizeTags(value, allowedTags, fallback = []) {
  const input = Array.isArray(value) ? value : fallback;
  const unique = [];

  input.forEach((item) => {
    const tag = String(item || "").trim().toLowerCase();
    if (!allowedTags.includes(tag) || unique.includes(tag)) {
      return;
    }
    unique.push(tag);
  });

  return unique;
}

function buildMemoryTagStats(sessions, field) {
  const counts = new Map();
  sessions.forEach((session) => {
    const tags = Array.isArray(session[field]) ? session[field] : [];
    tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function getPrimaryMemoryIssue(goal = state.profile.goal) {
  const memory = getGoalMemory(goal);
  const topEntry = buildMemoryTagStats(memory.recentSessions, "weaknessTags")[0];
  return topEntry?.[0] || memory.lastFocusTag || "";
}

function buildGenericMemoryCoachNote(focusTag) {
  if (!focusTag) {
    return "";
  }

  return t("memory.genericCoachNote", {
    issue: getMemoryTagLabel(focusTag),
  });
}

function buildGenericMemoryDrill(goal, focusTag) {
  if (!focusTag) {
    return "";
  }

  return t("memory.genericNextDrill", {
    track: getLocalizedGoal(goal).label,
    issue: getMemoryTagLabel(focusTag),
  });
}

function normalizeMemoryUpdate(memoryUpdate, context = {}) {
  const weakestScore =
    context.feedback?.scores &&
    Object.entries(context.feedback.scores).sort((left, right) => left[1] - right[1])[0]?.[0];
  const inferredFocus =
    normalizeTags(memoryUpdate?.weakness_tags, MEMORY_WEAKNESS_TAGS)[0] ||
    (weakestScore === "grammar"
      ? "agreement"
      : weakestScore === "vocabulary"
        ? "keyword"
        : "specificity");
  const focusTag = MEMORY_WEAKNESS_TAGS.includes(memoryUpdate?.focus_tag) ? memoryUpdate.focus_tag : inferredFocus;
  const weaknessTags = normalizeTags(memoryUpdate?.weakness_tags, MEMORY_WEAKNESS_TAGS, [focusTag]);
  const strengthTags = normalizeTags(memoryUpdate?.strength_tags, MEMORY_STRENGTH_TAGS, weakestScore === "clarity" ? ["vocabulary"] : ["clarity"]);

  return {
    focus_tag: focusTag,
    weakness_tags: weaknessTags.length > 0 ? weaknessTags : [focusTag],
    strength_tags: strengthTags.length > 0 ? strengthTags : ["clarity"],
    coach_note: String(memoryUpdate?.coach_note || "").trim() || buildGenericMemoryCoachNote(focusTag),
    recommended_drill:
      String(memoryUpdate?.recommended_drill || "").trim() || buildGenericMemoryDrill(context.goal || state.profile.goal, focusTag),
  };
}

function updateTutorMemory({ mode, goal, prompt, answer, feedback }) {
  const nextMemoryUpdate = normalizeMemoryUpdate(feedback.memory_update, { mode, goal, answer, feedback });
  const memory = getGoalMemory(goal);

  memory.reviewedSessions += 1;
  memory.lastFocusTag = nextMemoryUpdate.focus_tag;
  memory.lastCoachNote = nextMemoryUpdate.coach_note;
  memory.lastRecommendedDrill = nextMemoryUpdate.recommended_drill;
  memory.lastLocale = getLocale();
  memory.updatedAt = new Date().toISOString();
  memory.recentSessions.unshift({
    id: `${Date.now()}-${mode}`,
    mode,
    prompt: prompt.slice(0, 180),
    scoreAverage: averageScores(feedback.scores),
    weaknessTags: nextMemoryUpdate.weakness_tags,
    strengthTags: nextMemoryUpdate.strength_tags,
    focusTag: nextMemoryUpdate.focus_tag,
    createdAt: memory.updatedAt,
  });
  memory.recentSessions = memory.recentSessions.slice(0, 8);
}

function buildPersonalMemoryTask(goal) {
  const focusTag = getPrimaryMemoryIssue(goal);
  if (!focusTag) {
    return null;
  }

  return {
    kind: "memory",
    issueKey: focusTag,
    title: t("memory.personalTaskTitle"),
    detail: t("memory.personalTaskDetail", {
      track: getLocalizedGoal(goal).label,
      issue: getMemoryTagLabel(focusTag),
    }),
  };
}

function renderMemoryPills(items, variant, fallbackText) {
  if (!items || items.length === 0) {
    return `<div class="memory-subtle">${escapeHtml(fallbackText)}</div>`;
  }

  return `
    <div class="memory-pills">
      ${items
        .map(
          ([tag, count]) => `
            <span class="memory-pill memory-pill-${variant}">
              <span>${escapeHtml(getMemoryTagLabel(tag))}</span>
              <span class="memory-pill-count">${count}</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTutorMemory() {
  if (!elements.memoryBox) {
    return;
  }

  const memory = getGoalMemory(state.profile.goal);
  if (memory.reviewedSessions === 0) {
    elements.memoryBox.innerHTML = `
      <div class="memory-topline">
        <strong>${escapeHtml(t("memory.title"))}</strong>
      </div>
      <p class="memory-subtle">${escapeHtml(t("memory.empty"))}</p>
    `;
    return;
  }

  const topIssues = buildMemoryTagStats(memory.recentSessions, "weaknessTags").slice(0, 3);
  const topWins = buildMemoryTagStats(memory.recentSessions, "strengthTags").slice(0, 3);
  const focusTag = getPrimaryMemoryIssue(state.profile.goal);
  const sameLocale = memory.lastLocale === getLocale();
  const coachNote = sameLocale && memory.lastCoachNote ? memory.lastCoachNote : buildGenericMemoryCoachNote(focusTag);
  const nextDrill =
    sameLocale && memory.lastRecommendedDrill ? memory.lastRecommendedDrill : buildGenericMemoryDrill(state.profile.goal, focusTag);
  const focusText = focusTag ? t("memory.focusText", { issue: getMemoryTagLabel(focusTag) }) : t("memory.noIssues");

  elements.memoryBox.innerHTML = `
    <div class="memory-topline">
      <strong>${escapeHtml(t("memory.title"))}</strong>
      <span class="memory-subtle">${escapeHtml(t("memory.tracked", { count: memory.reviewedSessions }))}</span>
    </div>
    <div>
      <span class="mini-title">${escapeHtml(t("memory.focusLabel"))}</span>
      <p class="memory-focus">${escapeHtml(focusText)}</p>
    </div>
    <div class="memory-grid">
      <div class="memory-column">
        <span class="mini-title">${escapeHtml(t("memory.repeatedLabel"))}</span>
        ${renderMemoryPills(topIssues, "issue", t("memory.noIssues"))}
      </div>
      <div class="memory-column">
        <span class="mini-title">${escapeHtml(t("memory.winsLabel"))}</span>
        ${renderMemoryPills(topWins, "win", t("memory.noWins"))}
      </div>
    </div>
    <div class="memory-note-box">
      <span class="mini-title">${escapeHtml(t("memory.coachNoteLabel"))}</span>
      <p class="memory-note">${escapeHtml(coachNote)}</p>
    </div>
    <div class="memory-next-box">
      <span class="mini-title">${escapeHtml(t("memory.nextLabel"))}</span>
      <p class="memory-next">${escapeHtml(nextDrill)}</p>
    </div>
  `;
}

function buildMemorySnapshot(goal = state.profile.goal) {
  const memory = getGoalMemory(goal);
  return {
    reviewedSessions: memory.reviewedSessions,
    focusTag: getPrimaryMemoryIssue(goal),
    topWeaknesses: buildMemoryTagStats(memory.recentSessions, "weaknessTags").slice(0, 3).map(([tag]) => tag),
    topStrengths: buildMemoryTagStats(memory.recentSessions, "strengthTags").slice(0, 3).map(([tag]) => tag),
    lastCoachNote: memory.lastLocale === getLocale() ? memory.lastCoachNote : buildGenericMemoryCoachNote(getPrimaryMemoryIssue(goal)),
    lastRecommendedDrill:
      memory.lastLocale === getLocale() ? memory.lastRecommendedDrill : buildGenericMemoryDrill(goal, getPrimaryMemoryIssue(goal)),
  };
}

function averageScores(scores) {
  const values = Object.values(scores || {}).map(Number).filter(Number.isFinite);
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function initialize() {
  initializeLocalePreference();
  initializeThemePreference();
  setupPageTransitions();
  setupMotion();
  ensureDailyTasks();
  bindEvents();
  renderAll();
  if (shouldAutoOpenOnboarding()) {
    onboardingOpen = true;
    renderOnboarding();
  }
  void hydrateApiConfig();
  void hydrateAuthSession();
}

function bindEvents() {
  elements.languageSwitch?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-locale]");
    if (!button) {
      return;
    }

    const nextLocale = coerceLocale(button.dataset.locale);
    if (!nextLocale || nextLocale === getLocale()) {
      return;
    }

    state.preferences.locale = nextLocale;
    saveState();
    renderAll();
  });

  elements.authTriggerButton?.addEventListener("click", () => {
    openAuthModal(authSession.user ? "account" : "login");
  });

  elements.authOverlay?.addEventListener("click", async (event) => {
    if (event.target === elements.authOverlay || event.target.closest("#authCloseButton")) {
      closeAuthModal();
      return;
    }

    const modeButton = event.target.closest("[data-auth-mode]");
    if (modeButton && !authSession.user) {
      authSession.mode = modeButton.dataset.authMode === "register" ? "register" : "login";
      setAuthMessage();
      renderAuthUI();
      return;
    }

    if (event.target.closest("#authSubmitButton")) {
      await submitAuthForm();
      return;
    }

    if (event.target.closest("#authLogoutButton")) {
      await logoutCurrentUser();
      return;
    }

    if (event.target.closest("#authSyncButton")) {
      await pushStateToServer({ immediate: true });
    }
  });

  elements.authOverlay?.addEventListener("input", (event) => {
    const field = event.target.dataset?.authField;
    if (!field || !Object.prototype.hasOwnProperty.call(authSession.form, field)) {
      return;
    }

    authSession.form[field] = String(event.target.value || "");
    if (authSession.message) {
      setAuthMessage();
    }
  });

  elements.themeSwitch?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-choice]");
    if (!button) {
      return;
    }

    const nextTheme = coerceTheme(button.dataset.themeChoice);
    if (!nextTheme || nextTheme === getTheme()) {
      return;
    }

    state.preferences.theme = nextTheme;
    saveState();
    renderThemeSwitch();
  });

  elements.goalChips?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goal]");
    if (!button) {
      return;
    }

    state.profile.goal = button.dataset.goal;
    state.vocab.revealed = false;
    ensureDailyTasks(true);
    saveState();
    renderAll();
  });

  elements.onboardingLaunchButton?.addEventListener("click", () => {
    openOnboarding(0);
  });

  elements.onboardingOverlay?.addEventListener("click", (event) => {
    if (event.target === elements.onboardingOverlay) {
      if (state.onboarding.completed) {
        closeOnboarding({ complete: true });
      } else {
        closeOnboarding({ dismissed: true });
      }
      return;
    }

    if (event.target.closest("#onboardingCloseButton")) {
      if (getOnboardingStep() === 3 || state.onboarding.completed) {
        closeOnboarding({ complete: true });
      } else {
        closeOnboarding({ dismissed: true });
      }
      return;
    }

    if (event.target.closest("#onboardingBackButton")) {
      if (getOnboardingStep() === 0) {
        return;
      }

      state.onboarding.step = getOnboardingStep() - 1;
      saveState();
      renderOnboarding();
      return;
    }

    if (event.target.closest("#onboardingNextButton")) {
      if (getOnboardingStep() === 3) {
        state.profile.name = (state.profile.name || "").trim() || "Learner";
        closeOnboarding({ complete: true });
        window.location.href = "roadmap.html";
        return;
      }

      if (getOnboardingStep() === 2) {
        state.profile.name = (state.profile.name || "").trim() || "Learner";
      }

      state.onboarding.step = getOnboardingStep() + 1;
      saveState();
      renderOnboarding();
      return;
    }

    const localeButton = event.target.closest("[data-onboarding-locale]");
    if (localeButton) {
      const nextLocale = coerceLocale(localeButton.dataset.onboardingLocale);
      if (!nextLocale) {
        return;
      }

      state.preferences.locale = nextLocale;
      saveState();
      renderAll();
      return;
    }

    const goalButton = event.target.closest("[data-onboarding-goal]");
    if (goalButton) {
      state.profile.goal = goalButton.dataset.onboardingGoal;
      state.vocab.revealed = false;
      ensureDailyTasks(true);
      saveState();
      renderAll();
      return;
    }

    const themeButton = event.target.closest("[data-onboarding-theme]");
    if (themeButton) {
      const nextTheme = coerceTheme(themeButton.dataset.onboardingTheme);
      if (!nextTheme) {
        return;
      }

      state.preferences.theme = nextTheme;
      saveState();
      renderAll();
    }
  });

  elements.onboardingOverlay?.addEventListener("input", (event) => {
    if (!event.target.matches("[data-onboarding-name]")) {
      return;
    }

    state.profile.name = String(event.target.value || "").slice(0, 20) || "Learner";
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (authSession.modalOpen) {
      closeAuthModal();
      return;
    }

    if (!onboardingOpen) {
      return;
    }

    if (getOnboardingStep() === 3 || state.onboarding.completed) {
      closeOnboarding({ complete: true });
    } else {
      closeOnboarding({ dismissed: true });
    }
  });

  elements.saveNameButton?.addEventListener("click", () => {
    const nextName = elements.nameInput?.value.trim();
    if (!nextName) {
      elements.nameInput?.focus();
      return;
    }

    state.profile.name = nextName;
    touchProgress(1);
    saveState();
    renderDashboard();
  });

  elements.coachButton?.addEventListener("click", async () => {
    const answer = elements.coachInput?.value.trim();
    if (!answer) {
      renderEmptyFeedback(elements.coachFeedback, t("feedback.writeAnswerFirst"));
      return;
    }

    const currentScenario = getCurrentScenario();
    try {
      setButtonLoading(elements.coachButton, true, t("lab.thinking"));
      const feedback = await requestTutorFeedback({
        mode: "speaking",
        answer,
        prompt: currentScenario.prompt,
        targetWords: currentScenario.targetWords,
      });
      updateTutorMemory({
        mode: "speaking",
        goal: state.profile.goal,
        prompt: currentScenario.prompt,
        answer,
        feedback,
      });
      touchProgress(4);
      state.progress.sessions += 1;
      ensureDailyTasks(true);
      renderCoachFeedback(feedback, currentScenario, answer);
      saveState();
      renderDashboard();
      renderPlan();
    } finally {
      setButtonLoading(elements.coachButton, false, t("lab.getAiFeedback"));
    }
  });

  elements.writingPromptSelect?.addEventListener("change", () => {
    state.writing.promptIndexByGoal[state.profile.goal] = Number(elements.writingPromptSelect.value);
    saveState();
  });

  elements.writingButton?.addEventListener("click", async () => {
    const text = elements.writingInput?.value.trim();
    if (!text) {
      renderEmptyFeedback(elements.writingFeedback, t("feedback.addParagraphFirst"));
      return;
    }

    const writingPrompt = getLocalizedGoal(state.profile.goal).prompts[state.writing.promptIndexByGoal[state.profile.goal]];
    const targetWords = getCurrentScenario().targetWords;
    try {
      setButtonLoading(elements.writingButton, true, t("lab.reviewing"));
      const feedback = await requestTutorFeedback({
        mode: "writing",
        answer: text,
        prompt: writingPrompt,
        targetWords,
      });
      updateTutorMemory({
        mode: "writing",
        goal: state.profile.goal,
        prompt: writingPrompt,
        answer: text,
        feedback,
      });
      touchProgress(5);
      state.progress.sessions += 1;
      ensureDailyTasks(true);
      renderWritingFeedback(feedback, text);
      saveState();
      renderDashboard();
      renderPlan();
    } finally {
      setButtonLoading(elements.writingButton, false, t("lab.reviewWriting"));
    }
  });

  elements.revealExampleButton?.addEventListener("click", () => {
    state.vocab.revealed = !state.vocab.revealed;
    saveState();
    renderVocabulary();
  });

  elements.markLearnedButton?.addEventListener("click", () => {
    const currentWord = getCurrentWord();
    const currentKey = wordKey(state.profile.goal, currentWord.word);
    if (!state.progress.wordsLearned.includes(currentKey)) {
      state.progress.wordsLearned.push(currentKey);
      touchProgress(3);
      saveState();
      renderDashboard();
    }
    renderVocabulary();
  });

  elements.nextWordButton?.addEventListener("click", () => {
    const goal = state.profile.goal;
    const words = goalContent[goal].vocabulary;
    state.vocab.indexByGoal[goal] = (state.vocab.indexByGoal[goal] + 1) % words.length;
    state.vocab.revealed = false;
    saveState();
    renderVocabulary();
  });

  elements.generateLessonButton?.addEventListener("click", () => {
    state.lesson = state.lesson || createEmptyLessonState();
    state.lesson.variantByGoal = state.lesson.variantByGoal || createEmptyLessonState().variantByGoal;
    state.lesson.variantByGoal[state.profile.goal] = getLessonVariant(state.profile.goal) + 1;
    saveState();
    renderLessonBuilder();
  });

  elements.applyLessonButton?.addEventListener("click", () => {
    applyLessonToPractice();
  });
}

function renderAll() {
  renderStaticCopy();
  renderAuthUI();
  renderGoalButtons();
  renderHero();
  renderAssessment();
  renderDashboard();
  renderLessonBuilder();
  renderCoach();
  renderWriting();
  renderVocabulary();
  renderPlan();
  renderOnboarding();
  refreshMotionTargets();
}

function renderGoalButtons() {
  if (!elements.goalChips) {
    return;
  }
  [...elements.goalChips.querySelectorAll("[data-goal]")].forEach((button) => {
    button.textContent = getLocalizedGoal(button.dataset.goal).label;
    button.classList.toggle("is-active", button.dataset.goal === state.profile.goal);
  });
}

function renderHeroRevision() {
  const revision = document.getElementById("previewRevision");
  const label = document.getElementById("previewRevisionLabel");
  if (revision) {
    revision.innerHTML = HERO_REVISIONS[state.profile.goal] || HERO_REVISIONS.interview;
  }
  if (label) {
    label.textContent = HERO_REVISION_LABEL[getLocale()] || HERO_REVISION_LABEL.en;
  }
}

function renderHero() {
  renderHeroRevision();
  if (!elements.heroLevel || !elements.heroFocus || !elements.heroStreak || !elements.heroMode || !elements.previewPrompt || !elements.previewAnswer || !elements.miniMission || !elements.miniHint) {
    return;
  }
  const goal = getLocalizedGoal(state.profile.goal);
  elements.heroLevel.textContent = state.profile.level;
  elements.heroFocus.textContent = goal.label;
  elements.heroStreak.textContent = state.profile.streak;
  elements.heroMode.textContent = runtime.hasLiveFeedback ? runtime.model : t("runtime.shortLocal");
  elements.previewPrompt.textContent = goal.previewPrompt;
  elements.previewAnswer.textContent = goal.previewAnswer;
  elements.miniMission.textContent = goal.miniMission;
  elements.miniHint.textContent = goal.miniHint;
}

function renderAssessment() {
  if (!elements.assessmentSummary || !elements.assessmentStep || !elements.assessmentBar || !elements.assessmentQuestion || !elements.assessmentOptions) {
    return;
  }
  const total = assessmentQuestions.length;
  const { index, complete } = state.assessment;

  if (!complete) {
    const current = assessmentQuestions[index];
    elements.assessmentSummary.classList.add("hidden");
    elements.assessmentStep.textContent = t("placement.questionOf", { current: index + 1, total });
    elements.assessmentBar.style.width = `${((index + 1) / total) * 100}%`;
    elements.assessmentQuestion.textContent = getAssessmentPrompt(index) || current.question;
    elements.assessmentOptions.innerHTML = current.options
      .map((option, optionIndex) => `
        <button class="option-button" data-option-index="${optionIndex}" type="button">${option.text}</button>
      `)
      .join("");

    [...elements.assessmentOptions.querySelectorAll("[data-option-index]")].forEach((button) => {
      button.addEventListener("click", () => {
        handleAssessmentAnswer(Number(button.dataset.optionIndex));
      });
    });
    return;
  }

  const totalPoints = state.assessment.answers.reduce((sum, points) => sum + points, 0);
  const level = mapScoreToLevel(totalPoints);
  const roadmap = roadmapCopy(level, state.profile.goal);
  const goal = getLocalizedGoal(state.profile.goal);

  elements.assessmentStep.textContent = t("placement.complete");
  elements.assessmentBar.style.width = "100%";
  elements.assessmentQuestion.textContent = t("placement.result", { name: state.profile.name, level });
  elements.assessmentOptions.innerHTML = `<button class="button button-secondary button-small" id="restartAssessmentButton" type="button">${escapeHtml(t("placement.retake"))}</button>`;
  elements.assessmentSummary.innerHTML = `<strong>${escapeHtml(goal.label)}</strong><p>${escapeHtml(roadmap)}</p>`;
  elements.assessmentSummary.classList.remove("hidden");

  document.getElementById("restartAssessmentButton").addEventListener("click", () => {
    state.assessment = cloneValue(defaultState.assessment);
    saveState();
    renderAssessment();
  });
}

function handleAssessmentAnswer(optionIndex) {
  const currentQuestion = assessmentQuestions[state.assessment.index];
  const selected = currentQuestion.options[optionIndex];

  state.assessment.answers.push(selected.points);
  const nextIndex = state.assessment.index + 1;

  if (nextIndex >= assessmentQuestions.length) {
    const totalPoints = state.assessment.answers.reduce((sum, value) => sum + value, 0);
    state.profile.level = mapScoreToLevel(totalPoints);
    state.assessment.complete = true;
    touchProgress(4);
  } else {
    state.assessment.index = nextIndex;
  }

  saveState();
  renderAssessment();
  renderDashboard();
  renderHero();
  renderPlan();
}

function renderDashboard() {
  if (!elements.nameInput || !elements.levelBadge || !elements.streakValue || !elements.lessonValue || !elements.vocabValue || !elements.confidenceValue || !elements.confidenceBar || !elements.confidenceNote || !elements.recommendationBox) {
    return;
  }
  elements.nameInput.value = state.profile.name;
  elements.levelBadge.textContent = state.profile.level;
  elements.streakValue.textContent = state.profile.streak;
  elements.lessonValue.textContent = state.progress.sessions;
  elements.vocabValue.textContent = state.progress.wordsLearned.length;
  elements.confidenceValue.textContent = `${state.progress.confidence}%`;
  elements.confidenceBar.style.width = `${state.progress.confidence}%`;
  elements.confidenceNote.textContent = confidenceNote(state.progress.confidence);
  elements.recommendationBox.textContent = roadmapCopy(state.profile.level, state.profile.goal);
  renderTutorMemory();
  renderRuntimeStatus();
}

function renderRuntimeStatus() {
  if (!elements.runtimeStatus || !elements.runtimeNote || !elements.runtimeDot) {
    return;
  }
  elements.runtimeStatus.textContent = t(runtime.statusKey, runtime.statusVars);
  elements.runtimeNote.textContent = t(runtime.noteKey, runtime.noteVars);
  elements.runtimeDot.classList.toggle("is-live", runtime.hasLiveFeedback);
  elements.runtimeDot.classList.toggle("is-local", !runtime.hasLiveFeedback);
}

function renderPracticeShowcase() {
  if (
    !elements.practiceShowcaseEyebrow ||
    !elements.practiceShowcaseTag ||
    !elements.practiceShowcaseHeading ||
    !elements.practiceShowcaseText ||
    !elements.practiceScenarioLabel ||
    !elements.practiceScenarioTrack ||
    !elements.practiceScenarioTitle ||
    !elements.practiceScenarioPrompt ||
    !elements.practiceTargetsLabel ||
    !elements.practiceTargetList ||
    !elements.practiceRhythmLabel ||
    !elements.practiceRhythmList ||
    !elements.practiceRhythmNote
  ) {
    return;
  }

  const copy = getPracticeShowcaseCopy();
  const goal = getLocalizedGoal(state.profile.goal);
  const scenario = getCurrentScenario();

  elements.practiceShowcaseEyebrow.textContent = copy.eyebrow;
  elements.practiceShowcaseTag.textContent = copy.tag;
  elements.practiceShowcaseHeading.textContent = copy.heading;
  elements.practiceShowcaseText.textContent = copy.text;
  elements.practiceScenarioLabel.textContent = copy.scenarioLabel;
  elements.practiceScenarioTrack.textContent = goal.label;
  elements.practiceScenarioTitle.textContent = scenario.title;
  elements.practiceScenarioPrompt.textContent = scenario.prompt;
  elements.practiceTargetsLabel.textContent = copy.targetsLabel;
  elements.practiceTargetList.innerHTML = scenario.targetWords
    .map((word) => `<span class="practice-target-pill">${escapeHtml(word)}</span>`)
    .join("");
  elements.practiceRhythmLabel.textContent = copy.rhythmLabel;
  elements.practiceRhythmList.innerHTML = copy.rhythm
    .map(
      (item, index) => `
        <div class="practice-rhythm-item">
          <span class="practice-rhythm-index">${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(item)}</span>
        </div>
      `
    )
    .join("");
  elements.practiceRhythmNote.textContent = copy.note;
}

function renderPlanSummary() {
  if (
    !elements.planSummaryEyebrow ||
    !elements.planSummaryTrack ||
    !elements.planSummaryHeading ||
    !elements.planSummaryText ||
    !elements.planProgressLabel ||
    !elements.planProgressValue ||
    !elements.planProgressBar ||
    !elements.planDoneLabel ||
    !elements.planDoneValue ||
    !elements.planRemainingLabel ||
    !elements.planRemainingValue ||
    !elements.planStreakLabel ||
    !elements.planStreakValue ||
    !elements.planFocusLabel ||
    !elements.planFocusText ||
    !elements.planNoteLabel ||
    !elements.planNoteText
  ) {
    return;
  }

  const copy = getPlanSummaryCopy();
  const goal = getLocalizedGoal(state.profile.goal);
  const total = state.tasks.items.length;
  const completed = state.tasks.items.filter((item) => item.done).length;
  const remaining = Math.max(total - completed, 0);
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const focusTag = getPrimaryMemoryIssue(state.profile.goal);
  const focusText = focusTag
    ? interpolateCopy(copy.focusIssue, { issue: getMemoryTagLabel(focusTag), track: goal.label })
    : interpolateCopy(copy.focusGeneric, { track: goal.label });
  const momentumText = completed === 0 ? copy.noteStart : remaining === 0 ? copy.noteDone : copy.noteMid;

  elements.planSummaryEyebrow.textContent = copy.eyebrow;
  elements.planSummaryTrack.textContent = goal.label;
  elements.planSummaryHeading.textContent = copy.heading;
  elements.planSummaryText.textContent = copy.text;
  elements.planProgressLabel.textContent = copy.progressLabel;
  elements.planProgressValue.textContent = `${progress}%`;
  elements.planProgressBar.style.width = `${progress}%`;
  elements.planDoneLabel.textContent = copy.completedLabel;
  elements.planDoneValue.textContent = String(completed);
  elements.planRemainingLabel.textContent = copy.remainingLabel;
  elements.planRemainingValue.textContent = String(remaining);
  elements.planStreakLabel.textContent = copy.streakLabel;
  elements.planStreakValue.textContent = String(state.profile.streak);
  elements.planFocusLabel.textContent = copy.focusLabel;
  elements.planFocusText.textContent = focusText;
  elements.planNoteLabel.textContent = copy.noteLabel;
  elements.planNoteText.textContent = momentumText;
}

function getLessonVariant(goal = state.profile.goal) {
  state.lesson = state.lesson || createEmptyLessonState();
  state.lesson.variantByGoal = state.lesson.variantByGoal || createEmptyLessonState().variantByGoal;
  return Math.max(0, Number(state.lesson.variantByGoal[goal]) || 0);
}

function getLessonDuration(level, focusTag) {
  const baseByLevel = {
    A1: 10,
    A2: 12,
    B1: 14,
    B2: 16,
    C1: 18,
  };
  const base = baseByLevel[level] || 12;
  const heavyFocus = ["structure", "specificity", "follow_up"].includes(focusTag) ? 2 : 0;
  return base + heavyFocus;
}

function pickLessonScenarioIndex(goal, focusTag, variant, total) {
  const focusBias = {
    connector: 0,
    punctuation: 1,
    past_tense: 2,
    follow_up: 3,
    specificity: 0,
    length: 1,
    keyword: 2,
    structure: 3,
    capitalization: 1,
    agreement: 2,
  };
  const safeTotal = Math.max(Number(total) || 0, 1);
  return (focusBias[focusTag] + variant) % safeTotal;
}

function pickLessonWritingIndex(focusTag, variant, total) {
  const focusBias = {
    connector: 1,
    punctuation: 0,
    past_tense: 2,
    follow_up: 1,
    specificity: 3,
    length: 0,
    keyword: 2,
    structure: 3,
    capitalization: 0,
    agreement: 1,
  };
  const safeTotal = Math.max(Number(total) || 0, 1);
  return (focusBias[focusTag] + variant * 2) % safeTotal;
}

function pickLessonWords(goal, variant) {
  const words = getLocalizedGoal(goal).vocabulary;
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const startIndex = (state.vocab.indexByGoal[goal] + variant) % words.length;
  return [0, 1, 2].map((offset) => words[(startIndex + offset) % words.length]);
}

function buildPersonalLesson(goal = state.profile.goal) {
  const copy = getLessonCopy();
  const localizedGoal = getLocalizedGoal(goal);
  const lessonVariant = getLessonVariant(goal);
  const focusTag = getPrimaryMemoryIssue(goal) || "specificity";
  const focusLabel = getMemoryTagLabel(focusTag);
  const memory = getGoalMemory(goal);
  const scenarioIndex = pickLessonScenarioIndex(goal, focusTag, lessonVariant, localizedGoal.scenarios.length);
  const writingIndex = pickLessonWritingIndex(focusTag, lessonVariant, localizedGoal.prompts.length);
  const scenario = localizedGoal.scenarios[scenarioIndex];
  const writingPrompt = localizedGoal.prompts[writingIndex];
  const focusWords = pickLessonWords(goal, lessonVariant);
  const currentWordIndex = focusWords[0]
    ? localizedGoal.vocabulary.findIndex((word) => word.word === focusWords[0].word)
    : state.vocab.indexByGoal[goal];
  const summaryText =
    memory.lastLocale === getLocale() && memory.lastCoachNote
      ? interpolateCopy(copy.summaryMemory, { note: memory.lastCoachNote })
      : copy.summaryBase;

  return {
    copy,
    goalLabel: localizedGoal.label,
    focusTag,
    focusLabel,
    duration: getLessonDuration(state.profile.level, focusTag),
    summaryText,
    warmupText: interpolateCopy(copy.warmupText, { track: localizedGoal.label, issue: focusLabel }),
    speakingIntro: copy.speakingIntro,
    speakingPrompt: scenario.prompt,
    speakingChecks: [
      copy.speakingCheckOne,
      interpolateCopy(copy.speakingCheckTwo, { issue: focusLabel }),
      copy.speakingCheckThree,
    ],
    writingIntro: copy.writingIntro,
    writingPrompt,
    writingChecks: [
      copy.writingCheckOne,
      interpolateCopy(copy.writingCheckTwo, { issue: focusLabel }),
      copy.writingCheckThree,
    ],
    focusWords,
    wordTip: copy.wordTip,
    memoryNote: memory.lastLocale === getLocale() && memory.lastRecommendedDrill ? memory.lastRecommendedDrill : "",
    winText: interpolateCopy(copy.winText, { issue: focusLabel }),
    scenarioIndex,
    writingIndex,
    wordIndex: currentWordIndex >= 0 ? currentWordIndex : 0,
  };
}

function renderLessonBuilder() {
  if (
    !elements.lessonEyebrow ||
    !elements.lessonFocusTag ||
    !elements.lessonHeading ||
    !elements.lessonText ||
    !elements.lessonMeta ||
    !elements.lessonStepGrid ||
    !elements.generateLessonButton ||
    !elements.applyLessonButton
  ) {
    return;
  }

  const lesson = buildPersonalLesson();
  const copy = lesson.copy;

  elements.lessonEyebrow.textContent = copy.eyebrow;
  elements.lessonFocusTag.textContent = `${copy.focusTag}: ${lesson.focusLabel}`;
  elements.lessonHeading.textContent = copy.heading;
  elements.lessonText.textContent = lesson.summaryText;
  elements.generateLessonButton.textContent = copy.refresh;
  elements.applyLessonButton.textContent = copy.apply;

  elements.lessonMeta.innerHTML = `
    <article class="lesson-meta-card">
      <span class="mini-title">${escapeHtml(copy.durationLabel)}</span>
      <strong>${escapeHtml(interpolateCopy(copy.durationValue, { count: lesson.duration }))}</strong>
    </article>
    <article class="lesson-meta-card">
      <span class="mini-title">${escapeHtml(copy.trackLabel)}</span>
      <strong>${escapeHtml(lesson.goalLabel)}</strong>
    </article>
    <article class="lesson-meta-card">
      <span class="mini-title">${escapeHtml(copy.focusLabel)}</span>
      <strong>${escapeHtml(lesson.focusLabel)}</strong>
    </article>
  `;

  elements.lessonStepGrid.innerHTML = `
    <article class="lesson-step-card">
      <span class="mini-title">${escapeHtml(copy.warmupTitle)}</span>
      <p>${escapeHtml(lesson.warmupText)}</p>
    </article>
    <article class="lesson-step-card">
      <span class="mini-title">${escapeHtml(copy.speakingTitle)}</span>
      <p class="lesson-step-prompt">${escapeHtml(lesson.speakingIntro)}</p>
      <p>${escapeHtml(lesson.speakingPrompt)}</p>
      <div class="lesson-checklist">
        ${lesson.speakingChecks
          .map(
            (item, index) => `
              <div class="lesson-check-item">
                <span class="lesson-check-index">${String(index + 1).padStart(2, "0")}</span>
                <span>${escapeHtml(item)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
    <article class="lesson-step-card">
      <span class="mini-title">${escapeHtml(copy.writingTitle)}</span>
      <p class="lesson-step-prompt">${escapeHtml(lesson.writingIntro)}</p>
      <p>${escapeHtml(lesson.writingPrompt)}</p>
      <div class="lesson-checklist">
        ${lesson.writingChecks
          .map(
            (item, index) => `
              <div class="lesson-check-item">
                <span class="lesson-check-index">${String(index + 1).padStart(2, "0")}</span>
                <span>${escapeHtml(item)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
    <article class="lesson-step-card">
      <span class="mini-title">${escapeHtml(copy.vocabularyTitle)}</span>
      <div class="lesson-word-list">
        ${lesson.focusWords.map((word) => `<span class="practice-target-pill">${escapeHtml(word.word)}</span>`).join("")}
      </div>
      <p class="lesson-step-prompt">${escapeHtml(copy.wordsRuleLabel)}</p>
      <p>${escapeHtml(lesson.wordTip)}</p>
    </article>
    <article class="lesson-step-card lesson-step-card-wide">
      <div class="lesson-step-topline">
        <span class="mini-title">${escapeHtml(copy.memoryTitle)}</span>
        <span class="tag">${escapeHtml(copy.winLabel)}</span>
      </div>
      <p>${escapeHtml(lesson.memoryNote || lesson.summaryText)}</p>
      <p class="lesson-win-text">${escapeHtml(lesson.winText)}</p>
    </article>
  `;
}

function applyLessonToPractice() {
  const goal = state.profile.goal;
  const lesson = buildPersonalLesson(goal);

  state.coach.scenarioIndexByGoal[goal] = lesson.scenarioIndex;
  state.writing.promptIndexByGoal[goal] = lesson.writingIndex;
  state.vocab.indexByGoal[goal] = lesson.wordIndex;
  state.vocab.revealed = false;
  saveState();
  renderLessonBuilder();
  renderCoach();
  renderWriting();
  renderVocabulary();

  const focusTarget = elements.scenarioTabs || elements.coachPrompt;
  focusTarget?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function renderCoach() {
  if (!elements.scenarioTabs || !elements.coachPrompt || !elements.coachFeedback) {
    return;
  }
  const scenarios = getLocalizedGoal(state.profile.goal).scenarios;
  const activeIndex = state.coach.scenarioIndexByGoal[state.profile.goal];

  elements.scenarioTabs.innerHTML = scenarios
    .map((scenario, index) => `
      <button class="scenario-tab ${index === activeIndex ? "is-active" : ""}" data-scenario-index="${index}" type="button">${scenario.title}</button>
    `)
    .join("");

  elements.coachPrompt.textContent = scenarios[activeIndex].prompt;
  renderPracticeShowcase();
  renderEmptyFeedback(elements.coachFeedback, t("feedback.emptyCoach"));

  [...elements.scenarioTabs.querySelectorAll("[data-scenario-index]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.coach.scenarioIndexByGoal[state.profile.goal] = Number(button.dataset.scenarioIndex);
      saveState();
      renderCoach();
    });
  });
}

function renderWriting() {
  if (!elements.writingPromptSelect || !elements.writingFeedback) {
    return;
  }
  const prompts = getLocalizedGoal(state.profile.goal).prompts;
  const activeIndex = state.writing.promptIndexByGoal[state.profile.goal];

  elements.writingPromptSelect.innerHTML = prompts
    .map((prompt, index) => `<option value="${index}" ${index === activeIndex ? "selected" : ""}>${prompt}</option>`)
    .join("");

  renderEmptyFeedback(elements.writingFeedback, t("feedback.emptyWriting"));
}

function renderVocabulary() {
  if (!elements.vocabType || !elements.vocabWord || !elements.vocabDefinition || !elements.vocabExample || !elements.revealExampleButton || !elements.markLearnedButton || !elements.nextWordButton || !elements.vocabCounter) {
    return;
  }
  const words = getLocalizedGoal(state.profile.goal).vocabulary;
  const index = state.vocab.indexByGoal[state.profile.goal];
  const word = words[index];
  const learned = state.progress.wordsLearned.includes(wordKey(state.profile.goal, word.word));
  const signature = wordKey(state.profile.goal, word.word);
  const shouldAnimateSwap = Boolean(elements.flashcard && lastVocabRenderState.signature && lastVocabRenderState.signature !== signature);
  const shouldAnimateExample = state.vocab.revealed && (!lastVocabRenderState.revealed || lastVocabRenderState.signature !== signature);

  elements.vocabType.textContent = t(`wordTypes.${word.type}`, {}, word.type);
  elements.vocabWord.textContent = word.word;
  elements.vocabDefinition.textContent = word.definition;
  elements.vocabExample.textContent = word.example;
  elements.vocabExample.classList.toggle("hidden", !state.vocab.revealed);
  elements.revealExampleButton.textContent = state.vocab.revealed ? t("lab.hideExample") : t("lab.revealExample");
  elements.markLearnedButton.textContent = learned ? t("lab.learned") : t("lab.markLearned");
  elements.markLearnedButton.disabled = learned;
  elements.nextWordButton.textContent = t("lab.nextWord");
  elements.vocabCounter.textContent = t("lab.wordCounter", { current: index + 1, total: words.length });

  if (shouldAnimateSwap) {
    replayClassAnimation(elements.flashcard, "is-swapping", 640);
  }
  if (shouldAnimateExample) {
    replayClassAnimation(elements.vocabExample, "is-revealed", 520);
  }

  lastVocabRenderState = {
    signature,
    revealed: state.vocab.revealed,
  };
}

function renderPlan() {
  if (!elements.planGrid) {
    return;
  }
  ensureDailyTasks();
  renderPlanSummary();
  const plan = getLocalizedGoal(state.profile.goal).plan;
  const completedTaskId = recentCompletedTaskId;
  elements.planGrid.innerHTML = state.tasks.items
    .map((item, index) => `
      <article class="plan-card ${item.done ? "is-done" : ""}" data-motion="card" data-task-card-id="${item.id}">
        <div class="plan-topline">
          <span class="tag">${escapeHtml(t("plan.mission", { index: index + 1 }))}</span>
          <span>${state.profile.level}</span>
        </div>
        <h3>${escapeHtml(resolveTaskCopy(item, plan).title)}</h3>
        <p>${escapeHtml(resolveTaskCopy(item, plan).detail)}</p>
        <button class="plan-done ${item.done ? "is-complete" : ""}" data-task-id="${item.id}" type="button">
          ${escapeHtml(item.done ? t("plan.completed") : t("plan.markDone"))}
        </button>
      </article>
    `)
    .join("");

  [...elements.planGrid.querySelectorAll("[data-task-id]")].forEach((button) => {
    button.addEventListener("click", () => {
      const task = state.tasks.items.find((item) => item.id === button.dataset.taskId);
      if (!task || task.done) {
        return;
      }

      task.done = true;
      recentCompletedTaskId = task.id;
      touchProgress(4);
      state.progress.sessions += 1;
      saveState();
      renderPlan();
      renderDashboard();
      renderHero();
      refreshMotionTargets();
    });
  });

  if (completedTaskId) {
    const completedCard = elements.planGrid.querySelector(`[data-task-card-id="${completedTaskId}"]`);
    replayClassAnimation(completedCard, "is-just-completed", 760);
    recentCompletedTaskId = "";
  }
}

function resolveTaskCopy(item, plan) {
  if (item.kind === "memory") {
    return {
      title: t("memory.personalTaskTitle"),
      detail: t("memory.personalTaskDetail", {
        track: getLocalizedGoal(state.profile.goal).label,
        issue: getMemoryTagLabel(item.issueKey),
      }),
    };
  }

  return {
    title: (plan[item.planIndex] || {}).title || item.title || "",
    detail: (plan[item.planIndex] || {}).detail || item.detail || "",
  };
}

function renderCoachFeedback(feedback, scenario, rawAnswer) {
  const engineLabel = escapeHtml(feedback.engineLabel || scenario.title);
  const summary = escapeHtml(feedback.summary);
  const strengths = feedback.strengths.map((item) => `<div class="feedback-list-item">${escapeHtml(item)}</div>`).join("");
  const improvements = feedback.improvements.map((item) => `<div class="feedback-list-item">${escapeHtml(item)}</div>`).join("");
  const rewrite = escapeHtml(feedback.rewrite);
  const nextStep = escapeHtml(feedback.next_step || followUpQuestion(rawAnswer, state.profile.goal));

  elements.coachFeedback.innerHTML = `
    <div class="feedback-card">
      <div class="feedback-topline">
        <span class="tag">${escapeHtml(t("feedback.aiCoachReview"))}</span>
        <span>${engineLabel}</span>
      </div>
      <div class="feedback-list-item">${summary}</div>
      <div class="feedback-score-row">
        <div class="score-box"><strong>${feedback.scores.clarity}</strong><div>${escapeHtml(t("feedback.clarity"))}</div></div>
        <div class="score-box"><strong>${feedback.scores.grammar}</strong><div>${escapeHtml(t("feedback.grammar"))}</div></div>
        <div class="score-box"><strong>${feedback.scores.vocabulary}</strong><div>${escapeHtml(t("feedback.vocabulary"))}</div></div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.whatWorks"))}</strong>
        <div class="strength-list">${strengths}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.upgradeNext"))}</strong>
        <div class="improvement-list">${improvements}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.strongerVersion"))}</strong>
        <div class="feedback-list-item">${rewrite}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.nextDrill"))}</strong>
        <div class="feedback-list-item">${nextStep}</div>
      </div>
    </div>
  `;
  animateFeedbackPanel(elements.coachFeedback);
}

function renderWritingFeedback(feedback, rawText) {
  const engineLabel = escapeHtml(feedback.engineLabel || estimateBand(feedback.scores.clarity));
  const summary = escapeHtml(feedback.summary);
  const strengths = feedback.strengths.map((item) => `<div class="feedback-list-item">${escapeHtml(item)}</div>`).join("");
  const improvements = feedback.improvements.map((item) => `<div class="feedback-list-item">${escapeHtml(item)}</div>`).join("");
  const rewrite = escapeHtml(feedback.rewrite);
  const nextStep = escapeHtml(feedback.next_step || nextWritingChallenge(rawText));

  elements.writingFeedback.innerHTML = `
    <div class="feedback-card">
      <div class="feedback-topline">
        <span class="tag">${escapeHtml(t("feedback.writingReview"))}</span>
        <span>${engineLabel}</span>
      </div>
      <div class="feedback-list-item">${summary}</div>
      <div class="feedback-score-row">
        <div class="score-box"><strong>${feedback.scores.clarity}</strong><div>${escapeHtml(t("feedback.clarity"))}</div></div>
        <div class="score-box"><strong>${feedback.scores.grammar}</strong><div>${escapeHtml(t("feedback.grammar"))}</div></div>
        <div class="score-box"><strong>${feedback.scores.vocabulary}</strong><div>${escapeHtml(t("feedback.range"))}</div></div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.strongParts"))}</strong>
        <div class="strength-list">${strengths}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.upgradeNext"))}</strong>
        <div class="improvement-list">${improvements}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.editedVersion"))}</strong>
        <div class="feedback-list-item">${rewrite}</div>
      </div>
      <div>
        <strong>${escapeHtml(t("feedback.nextChallenge"))}</strong>
        <div class="feedback-list-item">${nextStep}</div>
      </div>
    </div>
  `;
  animateFeedbackPanel(elements.writingFeedback);
}

function renderEmptyFeedback(element, message) {
  if (!element) {
    return;
  }
  element.innerHTML = `
    <div class="feedback-card feedback-card-placeholder">
      <div class="feedback-topline">
        <span class="tag">${escapeHtml(t("feedback.ready"))}</span>
        <span>${escapeHtml(getLocalizedGoal(state.profile.goal).label)}</span>
      </div>
      <div class="feedback-list-item">${escapeHtml(message)}</div>
    </div>
  `;
}

function getCurrentScenario() {
  const goal = state.profile.goal;
  const scenarioIndex = state.coach.scenarioIndexByGoal[goal];
  return getLocalizedGoal(goal).scenarios[scenarioIndex];
}

function getCurrentWord() {
  const goal = state.profile.goal;
  return goalContent[goal].vocabulary[state.vocab.indexByGoal[goal]];
}

async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body !== undefined && typeof body !== "string") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "Unexpected server response." }));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function getStateUpdatedAt(candidate = state) {
  return Math.max(0, Number(candidate?.meta?.updatedAt) || 0);
}

function replaceStateData(nextState) {
  const mergedState = deepMerge(cloneValue(defaultState), cloneValue(nextState || {}));
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  Object.assign(state, mergedState);
}

function markStateSynced(updatedAt) {
  state.meta = state.meta || {};
  state.meta.lastSyncedAt = Math.max(0, Number(updatedAt) || Date.now());
  if (state.meta.updatedAt < state.meta.lastSyncedAt) {
    state.meta.updatedAt = state.meta.lastSyncedAt;
  }
  saveState({ touch: false, sync: false });
}

function applyRemoteState(remoteState, updatedAt) {
  replaceStateData(remoteState);
  state.meta = state.meta || {};
  state.meta.updatedAt = Math.max(getStateUpdatedAt(remoteState), Number(updatedAt) || 0);
  state.meta.lastSyncedAt = Number(updatedAt) || state.meta.updatedAt;
  saveState({ touch: false, sync: false });
  ensureDailyTasks();
  renderAll();
}

function scheduleRemoteStateSync() {
  if (!authSession.user || window.location.protocol === "file:") {
    return;
  }

  authSession.syncStatus = "pending";
  renderAuthUI();

  window.clearTimeout(authSyncTimer);
  authSyncTimer = window.setTimeout(() => {
    void pushStateToServer({ immediate: true });
  }, 480);
}

async function pushStateToServer({ immediate = false } = {}) {
  if (!authSession.user || window.location.protocol === "file:") {
    return null;
  }

  if (!immediate) {
    scheduleRemoteStateSync();
    return null;
  }

  if (authSyncInFlight) {
    return authSyncInFlight;
  }

  window.clearTimeout(authSyncTimer);
  authSession.syncStatus = "syncing";
  renderAuthUI();

  authSyncInFlight = requestJson("/api/state", {
    method: "PUT",
    body: {
      state: cloneValue(state),
      updatedAt: getStateUpdatedAt() || Date.now(),
    },
  })
    .then((payload) => {
      authSession.syncStatus = "synced";
      markStateSynced(payload.updatedAt);
      renderAuthUI();
      return payload;
    })
    .catch((error) => {
      authSession.syncStatus = "error";
      setAuthMessage(error.message, "error");
      renderAuthUI();
      throw error;
    })
    .finally(() => {
      authSyncInFlight = null;
    });

  return authSyncInFlight;
}

async function reconcileRemoteState({
  preferLocal = false,
  emptyStateMessage = "",
  localWonMessage = "",
  remoteWonMessage = "",
} = {}) {
  const payload = await requestJson("/api/state");
  const remoteState = payload.state && typeof payload.state === "object" ? payload.state : null;
  const remoteUpdatedAt = Number(payload.updatedAt) || 0;
  const localUpdatedAt = getStateUpdatedAt();

  if (!remoteState || remoteUpdatedAt === 0) {
    if (preferLocal || localUpdatedAt > 0) {
      await pushStateToServer({ immediate: true });
    }
    if (emptyStateMessage) {
      setAuthMessage(emptyStateMessage, "success");
    }
    return;
  }

  if (preferLocal || localUpdatedAt > remoteUpdatedAt) {
    await pushStateToServer({ immediate: true });
    if (localWonMessage) {
      setAuthMessage(localWonMessage, "success");
    }
    return;
  }

  applyRemoteState(remoteState, remoteUpdatedAt);
  authSession.syncStatus = "synced";
  if (remoteWonMessage) {
    setAuthMessage(remoteWonMessage, "success");
  }
  renderAuthUI();
}

async function hydrateAuthSession() {
  if (window.location.protocol === "file:") {
    return;
  }

  authSession.loading = true;
  renderAuthUI();

  try {
    const payload = await requestJson("/api/auth/session");
    authSession.user = payload.authenticated ? payload.user : null;
    authSession.syncStatus = "idle";
    authSession.loading = false;
    renderAuthUI();

    if (!authSession.user) {
      return;
    }

    await reconcileRemoteState();
    renderAll();
  } catch (error) {
    authSession.loading = false;
    authSession.user = null;
    authSession.syncStatus = "error";
    setAuthMessage(error.message, "error");
    renderAuthUI();
  }
}

async function submitAuthForm() {
  if (window.location.protocol === "file:") {
    setAuthMessage(getAuthCopy().fileModeError, "error");
    renderAuthUI();
    return;
  }

  const isRegister = authSession.mode === "register";
  const email = String(authSession.form.email || "").trim().toLowerCase();
  const password = String(authSession.form.password || "");
  const displayName = String(authSession.form.displayName || "").trim();
  const copy = getAuthCopy();

  if (!email || !password) {
    setAuthMessage(copy.requiredError, "error");
    renderAuthUI();
    return;
  }

  authSession.busy = true;
  setAuthMessage();
  renderAuthUI();

  try {
    const payload = await requestJson(isRegister ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: {
        email,
        password,
        displayName,
      },
    });

    authSession.user = payload.user;
    authSession.mode = "account";
    authSession.form.password = "";
    authSession.syncStatus = "idle";

    if (displayName && state.profile.name === "Learner") {
      state.profile.name = displayName;
      saveState({ touch: false, sync: false });
    }

    await reconcileRemoteState(
      isRegister
        ? {
            preferLocal: true,
            emptyStateMessage: copy.registerSuccess,
            localWonMessage: copy.registerSuccess,
          }
        : {
            emptyStateMessage: copy.loginEmptyState,
            localWonMessage: copy.loginLocalWon,
            remoteWonMessage: copy.loginRemoteWon,
          }
    );
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    authSession.busy = false;
    renderAuthUI();
  }
}

async function logoutCurrentUser() {
  authSession.busy = true;
  renderAuthUI();

  try {
    if (window.location.protocol !== "file:") {
      await requestJson("/api/auth/logout", { method: "POST" });
    }
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    window.clearTimeout(authSyncTimer);
    authSession.busy = false;
    authSession.user = null;
    authSession.mode = "login";
    authSession.syncStatus = "idle";
    authSession.form.password = "";
    authSession.modalOpen = true;
    setAuthMessage(getAuthCopy().logoutSuccess, "success");
    renderAuthUI();
  }
}

async function hydrateApiConfig() {
  if (window.location.protocol === "file:") {
    runtime.provider = "local";
    runtime.model = "Local heuristic";
    runtime.hasLiveFeedback = false;
    setRuntimeState("runtime.fileTitle", "runtime.fileNote");
    renderHero();
    renderRuntimeStatus();
    return;
  }

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("The local AI server did not respond.");
    }

    const config = await response.json();
    runtime.provider = config.provider;
    runtime.model = config.model || "OpenAI";
    runtime.hasLiveFeedback = Boolean(config.hasOpenAIKey);
    runtime.recommendedModel = config.recommendedBestModel || runtime.recommendedModel;

    if (runtime.hasLiveFeedback) {
      setRuntimeState("runtime.readyTitle", "runtime.readyNote", {
        noteVars: {
          model: runtime.model,
          recommendedModel: runtime.recommendedModel,
        },
      });
    } else {
      setRuntimeState("runtime.keyMissingTitle", "runtime.keyMissingNote");
    }
  } catch (error) {
    runtime.provider = "local";
    runtime.model = "Local heuristic";
    runtime.hasLiveFeedback = false;
    setRuntimeState("runtime.localTitle", "runtime.localNote");
  }

  renderHero();
  renderRuntimeStatus();
}

async function requestTutorFeedback({ mode, answer, prompt, targetWords }) {
  if (runtime.hasLiveFeedback && window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          goal: state.profile.goal,
          locale: getLocale(),
          learnerName: state.profile.name,
          memorySnapshot: buildMemorySnapshot(state.profile.goal),
          prompt,
          answer,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Live AI feedback failed.");
      }

      runtime.model = payload.model || runtime.model;
      runtime.hasLiveFeedback = true;
      setRuntimeState("runtime.readyTitle", "runtime.readyNote", {
        noteVars: {
          model: runtime.model,
          recommendedModel: runtime.recommendedModel,
        },
      });
      renderRuntimeStatus();
      return normalizeRemoteFeedback(payload.feedback, payload.model);
    } catch (error) {
      setRuntimeState("runtime.tempTitle", "runtime.tempNote");
      renderRuntimeStatus();
    }
  }

  return createLocalFeedback({ mode, answer, targetWords });
}

function normalizeRemoteFeedback(feedback, model) {
  return {
    ...feedback,
    engineLabel: t("feedback.engineOpenAi", { model }),
    summary: feedback.summary || t("feedback.localSummaryStrong"),
    next_step: feedback.next_step || t("feedback.pushHigher"),
    memory_update: normalizeMemoryUpdate(feedback.memory_update, {
      goal: state.profile.goal,
      feedback,
    }),
  };
}

function createLocalFeedback({ mode, answer, targetWords }) {
  const local = analyzeEnglish(answer, targetWords, mode);
  const localSummary =
    local.scores.clarity >= 78
      ? t("feedback.localSummaryStrong")
      : t("feedback.localSummaryWeak");

  return {
    ...local,
    summary: localSummary,
    next_step: mode === "speaking" ? followUpQuestion(answer, state.profile.goal) : nextWritingChallenge(answer),
    engineLabel: t("feedback.engineLocalFallback"),
    memory_update: normalizeMemoryUpdate(local.memory_update, {
      mode,
      goal: state.profile.goal,
      answer,
      feedback: local,
    }),
  };
}

function setButtonLoading(button, isLoading, label) {
  if (!button) {
    return;
  }
  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
  button.textContent = label;
}

function replayClassAnimation(element, className, duration = 720) {
  if (!element || prefersReducedMotion()) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);

  window.setTimeout(() => {
    if (!element.isConnected) {
      return;
    }

    element.classList.remove(className);
  }, duration);
}

function animateFeedbackPanel(element) {
  const card = element?.querySelector(".feedback-card");
  replayClassAnimation(card, "is-entering");
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function syncScrollMotionState() {
  scrollMotionFrame = 0;
  document.body.classList.toggle("is-scrolled", window.scrollY > 18);
}

function bindScrollMotionState() {
  window.addEventListener(
    "scroll",
    () => {
      if (scrollMotionFrame) {
        return;
      }

      scrollMotionFrame = window.requestAnimationFrame(syncScrollMotionState);
    },
    { passive: true }
  );
}

function setupPageTransitions() {
  document.body.classList.add("is-page-booting");

  const revealPage = () => {
    document.body.classList.add("is-page-ready");
  };

  syncScrollMotionState();
  bindScrollMotionState();

  if (prefersReducedMotion()) {
    revealPage();
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(revealPage);
  });
}

function setupMotion() {
  document.body.classList.add("motion-ready");

  if ("IntersectionObserver" in window) {
    motionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          motionObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -8% 0px",
      }
    );
  }
}

function refreshMotionTargets() {
  const targets = [...document.querySelectorAll("[data-motion]")];

  targets.forEach((target, index) => {
    target.style.setProperty("--motion-index", String(index % 6));

    if (target.dataset.motionBound === "true") {
      return;
    }

    target.dataset.motionBound = "true";

    if (!motionObserver) {
      target.classList.add("is-visible");
      return;
    }

    motionObserver.observe(target);
  });
}

function analyzeEnglish(text, targetWords, mode) {
  const normalizedText = normalizeText(text);
  const words = normalizedText.match(/[a-z']+/g) || [];
  const sentences = normalizedText.split(/[.!?]+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const targetHits = targetWords.filter((word) => normalizedText.includes(word.toLowerCase()));
  const hasConnector = /\b(because|but|so|however|although|therefore|first|then|finally)\b/i.test(text);
  const hasQuestion = /\?/.test(text);
  const hasPastTense = /\b(was|were|had|did|built|made|worked|improved|solved|learned|fixed|went|arrived)\b/i.test(text);

  let grammar = 62;
  let clarity = 64;
  let vocabulary = 60;

  if (words.length >= 18) {
    clarity += 12;
    vocabulary += 6;
  } else if (words.length >= 10) {
    clarity += 7;
    vocabulary += 3;
  } else {
    clarity -= 10;
  }

  if (sentences.length >= 2) {
    grammar += 6;
    clarity += 4;
  }

  if (uniqueWords.size >= Math.max(6, Math.round(words.length * 0.6))) {
    vocabulary += 11;
  }

  if (targetHits.length >= 2) {
    vocabulary += 9;
    clarity += 5;
  } else if (targetHits.length === 1) {
    vocabulary += 4;
  }

  if (hasConnector) {
    clarity += 7;
  }

  if (hasQuestion && mode === "speaking") {
    clarity += 4;
  }

  if (hasPastTense) {
    grammar += 5;
  }

  const improvements = [];
  const strengths = [];
  const weaknessTags = [];
  const strengthTags = [];
  const patternChecks = [
    { regex: /\bi am agree\b/i, note: t("feedback.fixAgree"), replace: "I agree", tag: "agreement" },
    { regex: /\bi very like\b/i, note: t("feedback.fixLike"), replace: "I really like" },
    { regex: /\bmore better\b/i, note: t("feedback.fixBetter"), replace: "better", tag: "agreement" },
    { regex: /\bi am go\b/i, note: t("feedback.fixAmGo"), replace: "I am going" },
    { regex: /\bhe go\b/i, note: t("feedback.fixHeGo"), replace: "he goes", tag: "agreement" },
    { regex: /\bshe go\b/i, note: t("feedback.fixSheGo"), replace: "she goes", tag: "agreement" },
  ];

  let rewritten = text.trim();

  patternChecks.forEach((check) => {
    if (check.regex.test(rewritten)) {
      grammar -= 7;
      improvements.push(check.note);
      if (check.tag) {
        weaknessTags.push(check.tag);
      }
      rewritten = rewritten.replace(check.regex, check.replace);
    }
  });

  if (/\bi\b/.test(rewritten) && !/\bI\b/.test(rewritten)) {
    grammar -= 4;
    improvements.push(t("feedback.capitalizeI"));
    weaknessTags.push("capitalization");
  }

  rewritten = rewritten.replace(/\bi\b/g, "I");

  if (!/[.!?]$/.test(rewritten)) {
    grammar -= 3;
    improvements.push(t("feedback.finishPunctuation"));
    weaknessTags.push("punctuation");
    rewritten += ".";
  }

  if (!hasConnector) {
    improvements.push(t("feedback.addConnector"));
    weaknessTags.push("connector");
  } else {
    strengths.push(t("feedback.linkedIdeas"));
    strengthTags.push("connector");
  }

  if (targetHits.length > 0) {
    strengths.push(t("feedback.trackVocabulary", { words: targetHits.slice(0, 3).join(", ") }));
    strengthTags.push("vocabulary");
  } else {
    improvements.push(t("feedback.useKeyword"));
    weaknessTags.push("keyword");
  }

  if (words.length >= 12) {
    strengths.push(t("feedback.enoughDetail"));
    strengthTags.push("detail");
  } else {
    improvements.push(t("feedback.extendAnswer"));
    weaknessTags.push("length");
    weaknessTags.push("specificity");
  }

  if (mode === "writing" && sentences.length < 4) {
    improvements.push(t("feedback.writeFourSentences"));
    weaknessTags.push("structure");
  }

  if (mode === "writing" && /\n/.test(text)) {
    strengths.push(t("feedback.readableStructure"));
    strengthTags.push("structure");
  }

  if (mode === "speaking" && hasQuestion) {
    strengths.push(t("feedback.conversationalQuestion"));
    strengthTags.push("follow_up");
  } else if (mode === "speaking") {
    improvements.push(t("feedback.endWithQuestion"));
    weaknessTags.push("follow_up");
  }

  if (!hasPastTense && /\b(yesterday|last|ago|previous)\b/i.test(text)) {
    grammar -= 6;
    improvements.push(t("feedback.usePastTense"));
    weaknessTags.push("past_tense");
  }

  grammar = clamp(Math.round(grammar), 35, 96);
  clarity = clamp(Math.round(clarity), 35, 97);
  vocabulary = clamp(Math.round(vocabulary), 32, 95);

  if (strengths.length === 0) {
    strengths.push(t("feedback.mainIdea"));
    strengthTags.push("clarity");
  }

  if (improvements.length === 0) {
    improvements.push(t("feedback.pushHigher"));
    weaknessTags.push("specificity");
  }

  rewritten = improveRewrite(rewritten, mode);
  const normalizedWeaknessTags = normalizeTags(weaknessTags, MEMORY_WEAKNESS_TAGS, ["specificity"]);
  const normalizedStrengthTags = normalizeTags(strengthTags, MEMORY_STRENGTH_TAGS, ["clarity"]);
  const focusTag =
    normalizedWeaknessTags[0] ||
    (grammar <= clarity && grammar <= vocabulary ? "agreement" : clarity <= vocabulary ? "specificity" : "keyword");

  return {
    scores: { grammar, clarity, vocabulary },
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 4),
    rewrite: rewritten,
    memory_update: {
      focus_tag: focusTag,
      weakness_tags: normalizedWeaknessTags,
      strength_tags: normalizedStrengthTags,
      coach_note: buildGenericMemoryCoachNote(focusTag),
      recommended_drill: buildGenericMemoryDrill(state.profile.goal, focusTag),
    },
  };
}

function improveRewrite(text, mode) {
  let result = text.trim();

  if (!/\bbecause\b/i.test(result) && /\b(i|we)\b/i.test(result)) {
    result = result.replace(/[.!?]?$/, " because it matches my goal and gives me a clear result.");
  }

  if (mode === "speaking" && !/\?/.test(result)) {
    result = `${result} What would you like me to expand on next?`;
  }

  if (mode === "writing" && !/\bfirst\b|\bfor example\b|\bin addition\b/i.test(result)) {
    result = `First, ${lowercaseFirst(result)}`;
  }

  return result;
}

function lowercaseFirst(text) {
  if (!text) {
    return text;
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function followUpQuestion(answer, goal) {
  const question = t(`followUp.${goal}`, {}, t("followUp.daily"));

  if (answer.length > 120) {
    return t("followUp.longAnswer", { question });
  }

  return question;
}

function nextWritingChallenge(text) {
  const wordCount = (text.match(/[a-z']+/gi) || []).length;
  if (wordCount < 45) {
    return t("feedback.nextWritingShort");
  }

  if (!/\bhowever\b|\balthough\b|\btherefore\b/i.test(text)) {
    return t("feedback.nextWritingConnector");
  }

  return t("feedback.nextWritingShorter");
}

function estimateBand(clarityScore) {
  if (clarityScore >= 88) {
    return t("feedback.estimateBandB2");
  }
  if (clarityScore >= 78) {
    return t("feedback.estimateBandB1");
  }
  if (clarityScore >= 68) {
    return t("feedback.estimateBandA2");
  }
  return t("feedback.estimateBandA1");
}

function mapScoreToLevel(score) {
  if (score >= 18) {
    return "C1";
  }
  if (score >= 15) {
    return "B2";
  }
  if (score >= 11) {
    return "B1";
  }
  if (score >= 8) {
    return "A2";
  }
  return "A1";
}

function roadmapCopy(level, goal) {
  const label = getLocalizedGoal(goal).label;
  return t(`roadmap.${level}`, { label }, "");
}

function confidenceNote(confidence) {
  if (confidence >= 80) {
    return t("confidenceNotes.high");
  }
  if (confidence >= 60) {
    return t("confidenceNotes.midHigh");
  }
  if (confidence >= 40) {
    return t("confidenceNotes.mid");
  }
  return t("confidenceNotes.low");
}

function ensureDailyTasks(forceRegenerate = false) {
  const today = localDateKey();
  const goal = state.profile.goal;
  const plan = getLocalizedGoal(goal).plan;
  const existingItems = Array.isArray(state.tasks.items) ? state.tasks.items : [];
  const shouldCarryDone = state.tasks.date === today && state.tasks.goal === goal;
  const personalTask = buildPersonalMemoryTask(goal);
  const nextItems = [
    ...(personalTask ? [personalTask] : []),
    ...plan.map((task, index) => ({
      kind: "base",
      planIndex: index,
      title: task.title,
      detail: task.detail,
    })),
  ].slice(0, 3);
  const needsRegeneration =
    forceRegenerate ||
    state.tasks.date !== today ||
    state.tasks.goal !== goal ||
    existingItems.length === 0 ||
    existingItems.some((item) => item.kind === "memory" ? !item.issueKey : typeof item.planIndex !== "number") ||
    existingItems.length !== nextItems.length ||
    existingItems.some((item, index) => {
      const nextItem = nextItems[index];
      if (!nextItem) {
        return true;
      }
      if (item.kind !== nextItem.kind) {
        return true;
      }
      return item.kind === "memory" ? item.issueKey !== nextItem.issueKey : item.planIndex !== nextItem.planIndex;
    });

  if (needsRegeneration) {
    state.tasks = {
      date: today,
      goal,
      items: nextItems.map((task, index) => {
        const matchingExisting = shouldCarryDone
          ? existingItems.find((item) =>
              task.kind === "memory"
                ? item.kind === "memory" && item.issueKey === task.issueKey
                : item.kind !== "memory" && item.planIndex === task.planIndex
            )
          : null;

        return {
          id:
            task.kind === "memory"
              ? `${goal}-${today}-memory-${task.issueKey}`
              : `${goal}-${today}-${task.planIndex}`,
          ...task,
          done: Boolean(matchingExisting?.done),
        };
      }),
    };
    saveState();
  }
}

function touchProgress(confidenceGain) {
  const today = localDateKey();

  if (state.profile.lastActiveDate !== today) {
    if (state.profile.lastActiveDate && dateDifferenceInDays(state.profile.lastActiveDate, today) === 1) {
      state.profile.streak += 1;
    } else {
      state.profile.streak = 1;
    }
    state.profile.lastActiveDate = today;
  }

  state.progress.confidence = clamp(state.progress.confidence + confidenceGain, 20, 98);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneValue(defaultState);
    }

    const mergedState = deepMerge(cloneValue(defaultState), JSON.parse(raw));
    mergedState.meta = mergedState.meta || {};
    mergedState.meta.updatedAt = Math.max(0, Number(mergedState.meta.updatedAt) || 0);
    mergedState.meta.lastSyncedAt = Math.max(0, Number(mergedState.meta.lastSyncedAt) || 0);
    return mergedState;
  } catch (error) {
    return cloneValue(defaultState);
  }
}

function saveState({ touch = true, sync = true } = {}) {
  state.meta = state.meta || {};
  if (touch) {
    state.meta.updatedAt = Date.now();
  } else {
    state.meta.updatedAt = Math.max(0, Number(state.meta.updatedAt) || 0);
  }
  state.meta.lastSyncedAt = Math.max(0, Number(state.meta.lastSyncedAt) || 0);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (sync) {
    scheduleRemoteStateSync();
  }
}

function deepMerge(base, incoming) {
  const output = { ...base };
  Object.keys(incoming || {}).forEach((key) => {
    const baseValue = output[key];
    const incomingValue = incoming[key];
    if (isPlainObject(baseValue) && isPlainObject(incomingValue)) {
      output[key] = deepMerge(baseValue, incomingValue);
      return;
    }
    output[key] = incomingValue;
  });
  return output;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function wordKey(goal, word) {
  return `${goal}:${word}`;
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateDifferenceInDays(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate - startDate) / 86400000);
}
