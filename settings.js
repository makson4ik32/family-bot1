const config = require('./config');
const { getJson } = require('./db');

function loadCustomPanels() {
  return getJson('panels_custom.json', {});
}

function loadCustomRoles() {
  return getJson('roles_custom.json', {});
}

function resolveColor(hexColor, fallback = '#2B2D31') {
  if (!hexColor || typeof hexColor !== 'string') return fallback;
  const clean = hexColor.trim();
  return /^#?[0-9A-Fa-f]{6}$/.test(clean)
    ? (clean.startsWith('#') ? clean : `#${clean}`)
    : fallback;
}

function applyPanelStyle(embed, panelCfg = {}, defaultColor = '#2B2D31') {
  const customAll = loadCustomPanels();
  const custom = panelCfg._panelKey ? (customAll[panelCfg._panelKey] || {}) : {};
  const merged = { ...panelCfg, ...custom };

  if (merged.title) embed.setTitle(merged.title);
  if (merged.description) embed.setDescription(merged.description);
  embed.setColor(resolveColor(merged.color, defaultColor));

  if (merged.image && /^https?:\/\//i.test(merged.image.trim())) {
    embed.setImage(merged.image.trim());
  }
  if (merged.thumbnail && /^https?:\/\//i.test(merged.thumbnail.trim())) {
    embed.setThumbnail(merged.thumbnail.trim());
  }
  if (merged.footer) {
    embed.setFooter({ text: merged.footer });
  }
  return embed;
}

const PANELS = {
  RECRUIT: {
    title: '👋 Путь в семью начинается здесь!',
    description:
      `• После подачи заявки для вас автоматически создастся **личный закрытый канал** для связи с рекрутами.\n` +
      `• Уведомление об итогах также дублируется в ЛС или в канал — <#${config.CHANNELS.RECRUIT_RESULTS}>.\n\n` +
      'Обычно заявки обрабатываются в течение 24 часов — всё зависит от загруженности рекрутеров.\n\n' +
      'Подать заявку можно только при открытом наборе в выбранное направление.\n\n' +
      '⚠️ **Набор в семью закрыт для лиц младше 16 лет.**\n\n' +
      '• Откаты с GG - не более 1 недели (не менее 7 минут)\n' +
      '• Откаты с МП (ВЗЗ, MCL, Capt) - не более 60 дней назад.\n' +
      '• Откаты должны быть не в виде мувиков/нарезок.\n' +
      '• Откаты должны быть с сайгой и со спешика (минимум 2 отката).',
    color: '#002fff',
    image: '',
    thumbnail: '',
    footer: 'Заявки рассматриваются Recruitami в ближайшее время',
    placeholder: '👇 Выбери направление для вступления...',
    modalTitlePrefix: 'Заявка в семью',
    replySent: '✅ Твоя заявка создана! Перейди в свой личный канал заявки и ожидай рекрута.',
    options: {
      captLabel: '⚔️ Capt Состав',
      captDesc: 'Капты и турниры (нужны откаты)',
      rpLabel: '🎭 RP Состав',
      rpDesc: 'RP контент и развитие'
    },
    fields: [
      { id: 'r_nick', label: 'Ваш игровой Ник и Возраст (ООС)', placeholder: 'Например: Ivan_Begov | 18 лет', style: 'SHORT', required: true },
      { id: 'r_static', label: 'Ваш Статик ID и онлайн в день', placeholder: 'Например: #12345 | 5+ часов', style: 'SHORT', required: true },
      { id: 'r_exp', label: 'Опыт в семьях / откаты стрельбы (ссылки)', placeholder: 'Укажите прошлые семьи и ссылки на откаты (YouTube / Imgur)', style: 'PARAGRAPH', required: true }
    ]
  },

  TIER: {
    title: '🎯 Получение Tier-роли (Tier 1 / 2 / 3)',
    description: 'Нажми кнопку ниже, чтобы создать закрытый канал для проверки твоей стрельбы (откаты или 1х1 на ГГ).',
    color: '#2ECC71',
    image: '',
    thumbnail: '',
    footer: 'Проверку проводят рекруты и проверяющие',
    buttonLabel: '🎯 Подать на Tier-проверку',
    ticketWelcome: '👋 Привет! Прикрепи сюда свои откаты стрельбы или напиши, когда готов пройти проверку на ГГ.'
  },

  STAFF_APPS: {
    title: '👔 Заявки на ранги и должности',
    description:
      'Выбери желаемый ранг или должность в меню ниже и заполни анкету.\n' +
      '⚠️ *После одобрения заявки на ранг необходимо сдать отчёт в канале повышения для получения роли.*',
    color: '#1100ff',
    image: '',
    thumbnail: '',
    footer: 'Рассмотрение проводится старшим составом',
    placeholder: '👇 Выбери должность или ранг...',
    modalTitlePrefix: 'Заявка:',
    replySent: '✅ Твоя заявка успешно отправлена руководству на рассмотрение!',
    fields: [
      { id: 's_nick', label: 'Ваш Ник, Статик и текущий ранг', placeholder: 'Например: Ivan_Begov | #12345 | 2 (Begov)', style: 'SHORT', required: true },
      { id: 's_age', label: 'Ваш возраст (ООС) и часовой пояс', placeholder: 'Например: 19 лет | МСК', style: 'SHORT', required: true },
      { id: 's_exp', label: 'Почему именно вы и какой есть опыт?', placeholder: 'Опишите ваши достижения, онлайн и опыт на должностях', style: 'PARAGRAPH', required: true }
    ]
  },

  PROMO: {
    title: '📈 СИСТЕМА ПОВЫШЕНИЯ',
    description:
      '**1(Test)-2(Begov):**\n' +
      '• Скрин что поменял фамилию\n' +
      '• Наличие 150 Баллов\n' +
      '• Скрин с 5 мп\n' +
      '• Создать личный портфель в <#1569659440477773824>\n\n' +
      '**2(Begov)-3(Main):**\n' +
      '• Наличие 150 баллов\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**3(Main)-4(Main+):**\n' +
      '• Наличие 250 баллов\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**4(Main+)-5(Recruiting):**\n' +
      '• Наличие 350 баллов\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**5(Recruiting)-6(High):**\n' +
      '• Наличие 350 баллов\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**6(High)-7(Dep Chief Recruit):**\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**7(Dep Chief Recruit)-8(Chief Recruit):**\n' +
      '• Ссылка на одобренную заявку\n\n' +
      '**8(Chief Recruit)-9(Caller):**\n' +
      '• Ссылка на одобренную заявку',
    color: '#3498DB',
    image: '',
    thumbnail: '',
    footer: 'После одобрения отчёта роль выдаётся автоматически',
    placeholder: '👇 Выбери ранг для повышения...'
  },

  PORTFOLIO: {
    title: '💼 Личный портфель участника',
    description:
      'Для получения ранга и учёта твоей активности тебе необходим личный портфель.\n\n' +
      'Нажми на кнопку ниже и заполни 3 пункта, чтобы бот автоматически создал твой личный канал.',
    color: '#9B59B6',
    image: '',
    thumbnail: '',
    footer: 'Личный портфель виден только тебе и старшему составу',
    buttonLabel: '📁 Создать личный портфель'
  },

  AFK: {
    title: '💤 Учёт отсутствия | АФК и Отпуск',
    description:
      'Если ты отходишь от компьютера или уезжаешь на несколько дней, обязательно отметься через кнопки ниже, чтобы не получить выговор за неявку на сборы.\n\n' +
      '• **💤 Взять АФК** — если отходишь на пару часов (фиксируется в логах без снятия ролей).\n' +
      '• **🏖 Взять отпуск** — если тебя не будет 1 день и более (временная роль отпуска, прежние роли сохраняются).\n' +
      '• **🟢 Вернуться в строй** — снимает отпуск и возвращает все твои прежние роли.',
    color: '#F39C12',
    image: '',
    thumbnail: '',
    footer: 'Не забывайте нажимать «Вернуться в строй» по возвращении',
    btnAfk: '💤 Взять АФК',
    btnVacation: '🏖 Взять отпуск',
    btnReturn: '🟢 Вернуться в строй'
  },
  EVENTS: {
    title: '⚔️ Панель управления сборами | Капты, MCL, ВЗ, РП',
    description:
      'Нажми на нужную кнопку ниже, чтобы запустить сбор состава.\n' +
      `• Сборы на **Капт** публикуются в <#${config.CHANNELS.CAPT_TAGS}>.\n` +
      `• Сборы на **MCL, ВЗ и РП** публикуются в <#${config.CHANNELS.TAGS}>.\n\n` +
      '• **Сортировка:** участники выстраиваются по приоритету ролей (`Caller` → `Coach` → `Tier 1–3` → `Capt` → `RP`).\n' +
      '• **Итог матча:** после окончания мероприятия нажми **«⚙️ Управление сбором»** и отметь **Победу** или **Поражение**.',
    color: '#E74C3C',
    image: '',
    thumbnail: '',
    footer: 'Запуск сборов доступен Caller, Coach и High Staff',
    btnCapt: '🔫 Капт',
    btnMcl: '🏆 MCL / Турнир',
    btnVz: '📦 ВЗ / Поставка / ФЗ',
    btnRp: '🎭 Семейное РП'
  },

  ECONOMY: {
    get voice() {
      const custom = getJson('economy_custom.json', {});
      return {
        CHECK_INTERVAL_MINUTES: custom.voice?.CHECK_INTERVAL_MINUTES ?? 20,
        POINTS_PER_INTERVAL: custom.voice?.POINTS_PER_INTERVAL ?? 5,
        IGNORE_DEAFENED: custom.voice?.IGNORE_DEAFENED ?? true
      };
    },
    get activities() {
      const base = {
        capt_win: { label: 'Победа на капте', points: 25, desc: 'Скрин итога или откат с мероприятия' },
        vz_supply: { label: 'Победа в семейном группе', points: 20, desc: 'Скриншот с мероприятия' },
        contract_done: { label: 'Закрытие семейного контракта', points: 15, desc: 'Скрин сдачи контракта' },
        invite_friend: { label: 'Поражение в семейном группе', points: 10, desc: 'Скриншот с мероприятия' }
      };
      const custom = getJson('economy_custom.json', {}).activities || {};
      for (const [k, v] of Object.entries(custom)) {
        if (base[k]) base[k] = { ...base[k], ...v };
      }
      return base;
    },
    get shopItems() {
      const base = {
        remove_warn: { label: 'Снятие 1 выговора', cost: 150, description: 'Автоматически снимает 1 активный выговор' },
        money_100k: { label: 'Выплата 50.000$', cost: 200, description: 'Перевод на ваш банковский счёт в игре' },
        heavy_sniper: { label: 'Выплата 100.000$', cost: 350, description: 'Перевод на ваш банковский счёт в игре' }
      };
      const custom = getJson('economy_custom.json', {}).shopItems || {};
      for (const [k, v] of Object.entries(custom)) {
        if (base[k]) base[k] = { ...base[k], ...v };
      }
      return base;
    },
    POINTS_PANEL: {
      title: '💎 Система заработка баллов',
      description: 'Выполняй задания, участвуй в жизни семьи и обменивай баллы в магазине наград!',
      color: '#2ECC71',
      image: '',
      thumbnail: '',
      footer: 'Отчёты проверяются старшим составом',
      placeholder: '👇 Выбери активность для сдачи отчёта...',
      fields: [
        { id: 'p_nick', label: 'Ваш Ник и Статик', placeholder: 'Например: Ivan_Begov | #12345', style: 'SHORT', required: true },
        { id: 'p_proof', label: 'Доказательства (ссылка Imgur / YouTube)', placeholder: 'Вставьте ссылку на скриншоты или откат', style: 'PARAGRAPH', required: true }
      ]
    },
    SHOP_PANEL: {
      title: '🛍 Семейный магазин наград',
      description: 'Выбери желаемую награду из списка ниже. Баллы спишутся автоматически после подтверждения.',
      color: '#9B59B6',
      image: '',
      thumbnail: '',
      footer: 'Выдача игровых предметов производится через High Staff',
      placeholder: '👇 Выбери товар для покупки...',
      shopModal: {
        detailsLabel: 'Ваш Ник, Статик и № банковского счёта',
        detailsPlaceholder: 'Например: Ivan_Begov | #12345 | Счёт: 98765'
      }
    },
    PAYOUT_PANEL: {
      title: '💸 Заявки на денежные выплаты и премии',
      description: 'Подай заявку на получение премии за участие в турнирах, каптах или закрытых контрактах.',
      color: '#F1C40F',
      image: '',
      thumbnail: '',
      footer: 'Выплаты производятся на банковский счёт',
      buttonLabel: '💰 Запросить выплату',
      payoutModal: { title: 'Заявка на выплату' },
      fields: [
        { id: 'pay_nick', label: 'Ваш Ник, Статик и банковский счёт', placeholder: 'Ivan_Begov | #12345 | Счёт: 12345', style: 'SHORT', required: true },
        { id: 'pay_sum', label: 'Сумма и за что выплата', placeholder: 'Например: 250.000$ за 5 каптов', style: 'PARAGRAPH', required: true }
      ]
    }
  },

  EXTRA: {
    GIVEAWAY_PANEL: {
      title: '🎉 Панель управления розыгрышами',
      description:
        'Нажми на кнопку ниже, чтобы запустить новый розыгрыш для участников семьи.\n' +
        '• Бот автоматически соберёт список участников и выберет случайных победителей.',
      color: '#F1C40F',
      image: '',
      thumbnail: '',
      footer: 'Запуск доступен только руководству',
      buttonLabel: '🎁 Создать розыгрыш'
    },
    SKUPKA_PANEL: {
      title: '🔫 Скупка оружия',
      description:
        'Семья скупает ваши оружия. Для вас доп. заработок, для семьи — пополнение склада. Нахождение вашего предмета на маркетплейсе — варн, при след. действиях кик с занесением в ЧС.\n\n' +
        '**📋 Прайс-лист:**\n' +
        '• Спешик мк2 — **8.500$**\n' +
        '• Тяжёлый дробовик — **3.500$**\n' +
        '• Винтовка Marksman | Mk2 — **25.000$ | 30.000$**\n' +
        '• Пулик Mk2 — **40.000$**\n' +
        '• Моды: ув. магаз / рукоятка / глушитель — **1.200$** за единицу\n' +
        '• Моды: опт. прицел — **300$** за единицу\n\n' +
        '**💸 Как получить оплату:**\n' +
        '1. Скидываете скрин с планшета — **Учёт склада**.\n' +
        '2. Ищете свой никнейм, скрините и нажимаете кнопку ниже (или отправляете в ветку с тегом <@&' + config.ROLES.SCLAD + '>).\n' +
        '3. Считаете полную сумму к выплате с подсчётом предметов и их кол-ва.\n\n' +
        '⚠️ *Уточнение для многих: скупка учитывается с МП / трассы и т.д. Не учитывается взятие со склада и возвращение назад.*',
      color: '#E67E22',
      image: '',
      thumbnail: '',
      footer: 'Проверяется отделом Sclad и High Staff',
      buttonLabel: '📦 Сдать лут на премию'
    },
    CONTRACTS_PANEL: {
      title: '📦 Семейные контракты (Учёт и КД)',
      description: 'Отмечай взятие и сдачу контрактов, чтобы семья не путалась в таймингах, а ты получал баллы и выплаты!',
      color: '#1ABC9C',
      image: '',
      thumbnail: '',
      footer: 'Указывайте точное время КД при взятии контракта',
      btnTake: '⏳ Взял контракт',
      btnDone: '✅ Закрыл контракт'
    }
  },

  FEEDBACK: {
    title: '💬 Центр идей и связи с руководством',
    description:
      'Здесь ты можешь повлиять на развитие нашей семьи и сервера или задать вопрос напрямую лидеру!\n\n' +
      `• **💡 Предложить идею** — улучшение Discord-сервера, бота, мероприятий или правил. Все идеи публикуются в <#${config.CHANNELS.IDEAS}> для голосования **👍 / 👎** и обсуждения.\n` +
      `• **👑 Вопрос лидеру** — задай любой интересующий вопрос открыто или **анонимно**. Вопросы и ответы публикуются в <#${config.CHANNELS.LEADER_QUESTIONS}>.`,
    color: '#5865F2',
    image: '',
    thumbnail: '',
    footer: 'Нажми на нужную кнопку ниже, чтобы создать обращение',
    btnIdea: '💡 Предложить идею',
    btnQuestion: '👑 Вопрос лидеру'
  },
  WARNS: {
    INFO_PANEL: {
      title: '⚠️ Система выговоров и дисциплина',
      description:
        'В семье действует система из **3 выговоров**:\n' +
        '• **1/3 выговор** — устное/письменное предупреждение.\n' +
        '• **2/3 выговор** — лишение премий и доступа к ряду мероприятий.\n' +
        '• **3/3 выговор** — автоматическое исключение из семьи.\n\n' +
        'Используй кнопки ниже, чтобы обжаловать выговор или отправить отчёт на его отработку.',
      color: '#E74C3C',
      image: '',
      thumbnail: '',
      footer: 'Снять выговор также можно в магазине за баллы',
      btnAppeal: '⚖️ Обжаловать выговор',
      btnWorkoff: '🛠 Сдать отработку выговора'
    },
    ADMIN_PANEL: {
      title: '🔨 Управление выговорами (Для старшего состава)',
      description: 'Используй кнопки ниже для выдачи или снятия выговоров участникам семьи.',
      color: '#2B2D31',
      image: '',
      thumbnail: '',
      footer: 'Доступно только High Staff и руководству',
      btnGive: '➕ Выдать выговор',
      btnRemove: '➖ Снять выговор'
    }
  },

  SCLAD: {
    title: '📦 Состояние и нормы семейного склада',
    description: 'Управление нормами склада на Капт и РП дни.',
    color: '#E74C3C',
    image: '',
    thumbnail: '',
    footer: 'Управление доступно отделу Sclad и High Staff'
  },

  DISCIPLINE: {
    title: '⚖️ Отдел Дисциплины | Контроль и санкции',
    description: 'Панель управления дисциплиной для сотрудников отдела Discipline и High Staff.',
    color: '#F1C40F',
    image: '',
    thumbnail: '',
    footer: 'Все действия фиксируются в #админ-логи'
  },

  MAPS: {
    title: '🗺 Тактический справочник | Карты каптов',
    description: 'Выберите нужную карту в меню ниже, чтобы посмотреть позиции (коллы), точки захода и тактику.',
    color: '#E67E22',
    image: '',
    thumbnail: '',
    footer: 'Справочник обновляется Caller и Coach составом',
    placeholder: '👇 Выберите карту капта...'
  },

  ADMIN_PANEL: {
    title: '🛠 Главная панель управления семьёй',
    description:
      'Полное управление составом, ролями, каналами, набором и панелями Discord-сервера.\n\n' +
      '👤 **Управление игроком** — ранг, Tier, ник и исключение.\n' +
      '📊 **Активность и неактив** — топ по баллам, войсу и список неактивных участников.\n' +
      '🔍 **Аудит ролей и ников** — проверка соответствия ников форме.\n' +
      '💼 **Портфели** — список участников семьи, которые ещё не создали портфель.\n' +
      '⛔ **Чёрный список** — управление ЧС семьи.\n' +
      '⚠️ **Выговор** — выдача и снятие предупреждений.\n' +
      '🎥 **Запрос откатов** — массовый запрос видеозаписей в ЛС.\n' +
      '🛡 **Модерация** — выбор канала и очистка сообщений.\n' +
      '💵 / 📉 **Баллы** — начисление и снятие баллов.\n' +
      '📅 **Отпуск** / 💤 **Статистика АФК** / 🛒 **Магазин**.\n' +
      '📋 **Набор в семью** — отдельное управление общим набором, Capt и RP.\n' +
      '🕵️ **Актив рекрутов** / 👑 **Состав стаффа**.\n' +
      '🎨 **Оформление панелей** / 🎭 **Обзвонники** / 🛡 **Конструктор ролей и каналов** / 🗂 **Мастер панелей**.',
    color: '#2B2D31',
    image: '',
    thumbnail: '',
    footer: 'Панель закреплена • Ответы видны только вам'
  }
};

const DEFAULT_MAPS = {
  factory: {
    name: '🏭 Завод (Factory)',
    shortDesc: 'Ближние и средние дистанции, контроль крыш и ангаров',
    tactics:
      '• **Основное оружие:** Спешл Карбин Mk2, Сайга.\n' +
      '• **Ключевые точки:** Главный ангар, Верхние мостики, ЖД-пути, Синий контейнер.\n' +
      '• **Тактика:** 2 человека занимают верхние переходы, основа заходит через центральный пролёт под дым.',
    image: ''
  },
  construction: {
    name: '🏗 Стройка (Construction)',
    shortDesc: 'Многоуровневая карта, важен контроль этажей и крана',
    tactics:
      '• **Основное оружие:** Спешл Карбин Mk2, Marksman Mk2.\n' +
      '• **Ключевые точки:** 2-й и 3-й этажи, Лестничный пролёт, Бетонные плиты.\n' +
      '• **Тактика:** Быстрый прожим второго яруса с двух флангов, снайперы прикрывают перебежки.',
    image: ''
  }
};

const BASE_PROMO_RANKS = {
  rank_2: {
    label: '2 | Begov',
    description: '150 баллов, смена фамилии, 5 МП и портфель',
    requirements: 'Скрин смены фамилии, 150 баллов, 5 МП, портфель',
    add: [config.ROLES.RANK_2_BEGOV],
    remove: [config.ROLES.RANK_1]
  },
  rank_3: {
    label: '3 | Main',
    description: '150 баллов + ссылка на одобренную заявку',
    requirements: 'Скрин 150 баллов + ссылка на одобренную заявку',
    add: [config.ROLES.RANK_3_MAIN],
    remove: [config.ROLES.RANK_2_BEGOV]
  },
  rank_4: {
    label: '4 | Main+',
    description: '250 баллов + ссылка на одобренную заявку',
    requirements: 'Скрин 250 баллов + ссылка на одобренную заявку',
    add: [config.ROLES.RANK_4_MAIN_PLUS],
    remove: [config.ROLES.RANK_3_MAIN]
  },
  rank_5: {
    label: '5 | Recruiting',
    description: '350 баллов + ссылка на одобренную заявку',
    requirements: 'Скрин 350 баллов + ссылка на одобренную заявку',
    add: [config.ROLES.RECRUIT],
    remove: []
  },
  rank_6: {
    label: '6 | High',
    description: '350 баллов + ссылка на одобренную заявку',
    requirements: 'Скрин 350 баллов + ссылка на одобренную заявку',
    add: [config.ROLES.RANK_6_HIGH, config.ROLES.HIGH_STAFF],
    remove: [config.ROLES.RECRUIT]
  },
  rank_7: {
    label: '7 | Dep Chief Recruit',
    description: 'Ссылка на одобренную заявку',
    requirements: 'Ссылка на одобренную заявку',
    add: [config.ROLES.DEP_CHIEF_RECRUIT, config.ROLES.HIGH_STAFF],
    remove: [config.ROLES.RANK_6_HIGH]
  },
  chief_recruit: {
    label: '8 | Chief Recruit',
    description: 'Ссылка на одобренную заявку',
    requirements: 'Ссылка на одобренную заявку',
    add: [config.ROLES.CHIEF_RECRUIT, config.ROLES.HIGH_STAFF],
    remove: [config.ROLES.DEP_CHIEF_RECRUIT]
  },
  rank_9: {
    label: '9 | Caller',
    description: 'Ссылка на одобренную заявку',
    requirements: 'Ссылка на одобренную заявку',
    add: [config.ROLES.CALLER, config.ROLES.HIGH_STAFF],
    remove: []
  }
};

function getJoinRoles(branch) {
  const custom = loadCustomRoles();
  if (branch === 'Capt') {
    return {
      add: custom.JOIN_CAPT_ADD || [
        config.ROLES.FAMQ,
        config.ROLES.RP_SQUAD,
        config.ROLES.RANK_1,
        config.ROLES.NO_VERIF,
        config.ROLES.CAPT_SQUAD
      ].filter(Boolean),
      remove: custom.JOIN_CAPT_REMOVE || []
    };
  }
  return {
    add: custom.JOIN_RP_ADD || [
      config.ROLES.FAMQ,
      config.ROLES.RP_SQUAD,
      config.ROLES.RANK_1,
      config.ROLES.NO_VERIF
    ].filter(Boolean),
    remove: custom.JOIN_RP_REMOVE || []
  };
}

function getPromoRanks() {
  const custom = loadCustomRoles();
  const result = structuredClone(BASE_PROMO_RANKS);
  if (custom.PROMO) {
    for (const [key, override] of Object.entries(custom.PROMO)) {
      if (result[key]) {
        if (Array.isArray(override.add)) result[key].add = override.add;
        if (Array.isArray(override.remove)) result[key].remove = override.remove;
      }
    }
  }
  return result;
}

const ROLE_REWARDS = {
  get JOIN_CAPT_ADD() { return getJoinRoles('Capt').add; },
  get JOIN_CAPT_REMOVE() { return getJoinRoles('Capt').remove; },
  get JOIN_RP_ADD() { return getJoinRoles('RP').add; },
  get JOIN_RP_REMOVE() { return getJoinRoles('RP').remove; },
  get PROMO_RANKS() { return getPromoRanks(); },

  STAFF_APPS: {
    main: { label: '3 | Main', isMainOrRecruit: true },
    main_plus: { label: '4 | Main+', isMainOrRecruit: true },
    recruit: { label: '5 | Recruit', isMainOrRecruit: true },
    high: { label: '6 | High', isMainOrRecruit: false },
    dep_chief_recruit: { label: '7 | Dep Chief Recruit', isMainOrRecruit: false },
    chief_recruit: { label: '8 | Chief Recruit', isMainOrRecruit: false },
    caller: { label: '9 | Caller', isMainOrRecruit: false }
  }
};

const CALLERS = {
  get RECRUIT_CALLER_ROLES() {
    const custom = loadCustomRoles();
    return custom.RECRUIT_CALLER_ROLES || [
      config.ROLES.RECRUIT,
      config.ROLES.DEP_CHIEF_RECRUIT,
      config.ROLES.CHIEF_RECRUIT,
      config.ROLES.HIGH_STAFF
    ].filter(Boolean);
  },
  get RECRUIT_PING_ROLES() {
    const custom = loadCustomRoles();
    return custom.RECRUIT_PING_ROLES || [config.ROLES.RECRUIT].filter(Boolean);
  },
  get STAFF_CALLER_ROLES() {
    const custom = loadCustomRoles();
    return custom.STAFF_CALLER_ROLES || [
      config.ROLES.HIGH_STAFF,
      config.ROLES.CHIEF_RECRUIT,
      config.ROLES.DEP_CHIEF_RECRUIT
    ].filter(Boolean);
  },
  get STAFF_PING_ROLES() {
    const custom = loadCustomRoles();
    return custom.STAFF_PING_ROLES || [config.ROLES.HIGH_STAFF].filter(Boolean);
  },
  WAITING_VOICE_ID: config.CHANNELS.WAITING_VOICE,
  CHECKLIST:
    '📋 **Чек-лист обзвона (памятка рекруту):**\n' +
    '1. Уточнить реальный возраст и часовой пояс.\n' +
    '2. Проверить знание правил сервера Majestic RP и правил семьи.\n' +
    '3. Если идёт в Capt — посмотреть откаты с ГГ / каптов.\n' +
    '4. Объяснить систему тегов, баллов и портфелей.\n' +
    '5. При одобрении ввести ник строго по форме: `Имя_Фамилия | #Статик`.',
  RECRUIT_CALL_CHANNEL_MSG: '📞 Обзвонник {caller} вызвал кандидата {candidate} на обзвон в {voice}!',
  RECRUIT_CALL_DM_MSG: '📞 Обзвонник **{caller}** вызывает вас на обзвон в семью **{guild}**!\nЗайдите в голосовой канал ожидания: {voice}',
  STAFF_CALL_CHANNEL_MSG: '📞 {caller} вызывает кандидата {candidate} на обзвон по заявке **{role}** в {voice}!',
  STAFF_CALL_DM_MSG: '📞 Руководство **{caller}** вызывает вас на обзвон по заявке **{role}** в семье **{guild}**!\nЗайдите в голосовой канал: {voice}'
};

Object.entries(PANELS).forEach(([k, v]) => {
  if (v && typeof v === 'object' && v.title) v._panelKey = k;
});
PANELS.ECONOMY.POINTS_PANEL._panelKey = 'POINTS_PANEL';
PANELS.ECONOMY.SHOP_PANEL._panelKey = 'SHOP_PANEL';
PANELS.ECONOMY.PAYOUT_PANEL._panelKey = 'PAYOUT_PANEL';
PANELS.EXTRA.GIVEAWAY_PANEL._panelKey = 'GIVEAWAY_PANEL';
PANELS.EXTRA.SKUPKA_PANEL._panelKey = 'SKUPKA_PANEL';
PANELS.EXTRA.CONTRACTS_PANEL._panelKey = 'CONTRACTS_PANEL';
PANELS.WARNS.INFO_PANEL._panelKey = 'WARNS_INFO';
PANELS.WARNS.ADMIN_PANEL._panelKey = 'WARNS_ADMIN';

module.exports = {
  resolveColor,
  applyPanelStyle,
  PANELS,
  DEFAULT_MAPS,
  ROLE_REWARDS,
  getJoinRoles,
  getPromoRanks,
  CALLERS
};

