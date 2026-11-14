const fs = require('fs');
const path = require('path');
const config = require('./config');

const CUSTOM_PANELS_FILE = path.join(__dirname, 'panels_custom.json');

function loadCustomPanels() {
  if (!fs.existsSync(CUSTOM_PANELS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_PANELS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// =========================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ОФОРМЛЕНИЯ
// =========================================================================
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

// =========================================================================
// НАСТРОЙКА ВСЕХ ПАНЕЛЕЙ, ТЕКСТОВ, ЦВЕТОВ И КАРТИНОК
// =========================================================================
const PANELS = {
  // 1. РЕКРУТИНГ В СЕМЬЮ (/панель_рекрутинга)
  RECRUIT: {
    title: '👋 Путь в семью начинается здесь!',
    description:
      `• Уведомление о приглашении на обзвон обычно отправляется в личные сообщения. Если ЛС закрыты, оно отправляется в канал — <#${config.CHANNELS.RECRUIT_RESULTS}>. В этот канал также приходят уведомления об отказе в наборе.\n\n` + // Канал итогов новичков
      'Обычно заявки обрабатываются в течение 24 часов — всё зависит от того, насколько загружены наши рекрутеры на данный момент.\n\n' +
      'Подать заявку можно только при открытом наборе. Если не выходит — набор закрыт. Внимательно прочтите сообщение ниже.\n\n' +
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
    replySent: '✅ Твоя заявка отправлена Recruitam! Ожидай вызова на обзвон.',
    options: {
      captLabel: '⚔️ Capt Состав',
      captDesc: 'Капты турниры (нужны откаты)',
      rpLabel: '🎭 RP Состав',
      rpDesc: 'Rp контент'
    },
    fields: [
      { id: 'r_nick', label: 'Ваш игровой Ник и Возраст (ООС)', placeholder: 'Например: Ivan_Begov | 18 лет', style: 'SHORT', required: true },
      { id: 'r_static', label: 'Ваш Статик ID и онлайн в день', placeholder: 'Например: #12345 | 5+ часов', style: 'SHORT', required: true },
      { id: 'r_exp', label: 'Опыт в семьях / откаты стрельбы (ссылки)', placeholder: 'Укажите прошлые семьи и ссылки на откаты (YouTube / Imgur)', style: 'PARAGRAPH', required: true }
    ]
  },

  // 2. ПРОВЕРКА TIER (/панель_тира)
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

  // 3. ЗАЯВКИ НА РАНГИ И ДОЛЖНОСТИ (/панель_должностей) — РОЛИ ЗДЕСЬ НЕ ВЫДАЮТСЯ
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

  // 4. ОТЧЁТЫ НА ПОВЫШЕНИЕ (/панель_повышения)
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

      '**6(High)-7(Dep Chief):**\n' +
      '• Ссылка на одобренную заявку\n\n' +

      '**7(Dep Chief)-8(Chief):**\n' +
      '• Ссылка на одобренную заявку\n\n' +

      '**8(Chief)-9(Caller):**\n' +
      '• Ссылка на одобренную заявку\n\n' +

      '**9(Caller)-10(Assistant):**\n' +
      '• Ссылка на одобренную заявку',
    color: '#3498DB',
    image: '',
    thumbnail: '',
    footer: 'После одобрения отчёта роль выдаётся автоматически',
    placeholder: '👇 Выбери ранг для повышения...'
  },

  // 5. ЛИЧНЫЙ ПОРТФЕЛЬ (/панель_портфеля)
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

  // 6. АФК И ОТПУСК (/панель_афк)
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

  // 7. СБОРЫ НА МЕРОПРИЯТИЯ (/панель_сборов)
  EVENTS: {
    title: '⚔️ Панель управления сборами | Капты, MCL, ВЗ, РП',
    description:
      'Нажми на нужную кнопку ниже, чтобы запустить сбор состава.\n' +
      `• Сборы на **Капт** публикуются в <#${config.CHANNELS.CAPT_TAGS}>.\n` + // Канал тегов Capt
      `• Сборы на **MCL, ВЗ и РП** публикуются в <#${config.CHANNELS.TAGS}>.\n\n` + // Общий канал тегов Family
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

    // 8. ЭКОНОМИКА: БАЛЛЫ, МАГАЗИН, ВЫПЛАТЫ
  ECONOMY: {
    voice: {
      CHECK_INTERVAL_MINUTES: 20, // Раз в сколько минут начислять баллы за войс
      POINTS_PER_INTERVAL: 5,     // Сколько баллов давать за 1 интервал (20 мин)
      IGNORE_DEAFENED: true       // Не давать баллы тем, кто выключил звук (в муте ушей)
    },
    activities: {
      capt_win: { label: 'Победа на капте', points: 25, desc: 'Скрин итога или откат с мероприятия' },
      vz_supply: { label: 'Победа в семейном группе', points: 20, desc: 'Скриншот с мероприятия' },
      contract_done: { label: 'Закрытие семейного контракта', points: 15, desc: 'Скрин сдачи контракта' },
      invite_friend: { label: 'Поражение в семейном группе', points: 10, desc: 'Скриншот с мероприятия' }
    },
    shopItems: {
      remove_warn: { label: 'Снятие 1 выговора', cost: 150, description: 'Автоматически снимает 1 активный выговор' },
      money_100k: { label: 'Выплата 50.000$', cost: 200, description: 'Перевод на ваш банковский счёт в игре' },
      heavy_sniper: { label: 'Выплата 100.000$', cost: 350, description: 'Перевод на ваш банковский счёт в игре' }
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

  // 9. ДОП. ПАНЕЛИ: РОЗЫГРЫШИ, СКУПКА, КОНТРАКТЫ
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
        '2. Ищете свой никнейм, скрините и нажимаете кнопку ниже (или отправляете в ветку с тегом <@&' + config.ROLES.SCLAD + '>).\n' + // Тег роли Sclad
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

  // 10. ЦЕНТР СВЯЗИ И ИДЕЙ (/панель_связи)
  FEEDBACK: {
    title: '💬 Центр идей и связи с руководством',
    description:
      'Здесь ты можешь повлиять на развитие нашей семьи и сервера или задать вопрос напрямую лидеру!\n\n' +
      `• **💡 Предложить идею** — улучшение Discord-сервера, бота, мероприятий или правил. Все идеи публикуются в <#${config.CHANNELS.IDEAS}> для голосования **👍 / 👎** и обсуждения.\n` + // Канал идей
      `• **👑 Вопрос лидеру** — задай любой интересующий вопрос открыто или **анонимно**. Вопросы и ответы публикуются в <#${config.CHANNELS.LEADER_QUESTIONS}>.`, // Канал вопросов лидеру
    color: '#5865F2',
    image: '',
    thumbnail: '',
    footer: 'Нажми на нужную кнопку ниже, чтобы создать обращение',
    btnIdea: '💡 Предложить идею',
    btnQuestion: '👑 Вопрос лидеру'
  },

  // 11. ВЫГОВОРЫ И ИНФОРМАЦИЯ (/панель_информация, /панель_выговоров)
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

  // 12. АДМИН-ПАНЕЛЬ (/админ_панель) — 18 КНОПОК БЕЗ БАЗЫ ДАННЫХ И ВЕТОК
  ADMIN_PANEL: {
    title: 'Панель управления для доверенных членов семьи.',
    description:
      'Взаимодействие с ботом осуществляется преимущественно через это меню, которое включает **18 кнопок**.\n\n' +
      '👤 = Управление игроком (ранг, Tier, ник и поиск портфеля).\n' +
      '📊 = Голосовая активность и рейтинг участников по баллам.\n' +
      '🔍 = Аудит ролей и правильности ников состава.\n' +
      '💼 = Контроль личных портфелей (кто не создал / чьи владельцы вышли).\n' +
      '⛔ = Управление чёрным списком (ЧС) семьи.\n' +
      '⚠️ = Выдача и снятие выговоров участникам.\n' +
      '🎥 = Массовый запрос откатов в личные сообщения.\n' +
      '🛡 = Очистка чата, закрытие канала и объявления.\n' +
      '💵 = Начислить участнику баллы.\n' +
      '📉 = Уменьшить количество баллов у участника.\n' +
      '📅 = Просмотр участников в отпуске.\n' +
      '💤 = Просмотр АФК-активности членов семьи.\n' +
      '🛒 = Просмотр ассортимента и цен магазина.\n' +
      '📋 = Управление набором в семью (открыть/закрыть).\n' +
      '🕵️ = Статистика работы отдела рекрутов.\n' +
      '👑 = Список руководящего состава по должностям.\n' +
      '🎉 = Розыгрыш призов для членов семьи.\n' +
      '💾 = Скачать резервную копию баз данных (JSON).',
    color: '#2B2D31',
    image: '',
    thumbnail: '',
    footer: 'Панель закреплена • Ответы видны только вам'
  }
};

// =========================================================================
// НАСТРОЙКА ВЫДАЧИ РОЛЕЙ (ТОЛЬКО ПРИ ВСТУПЛЕНИИ И В ОТЧЁТАХ НА ПОВЫШЕНИЕ!)
// =========================================================================
const ROLE_REWARDS = {
  // 1. ПАНЕЛЬ РЕКРУТИНГА (/панель_рекрутинга) — Принятие новичка в Capt
  JOIN_CAPT_ADD: [
    config.ROLES.FAMQ,        // Общая роль участника семьи
    config.ROLES.RP_SQUAD,    // Роль RP-состава
    config.ROLES.RANK_1,      // Начальная роль 1 | Test
    config.ROLES.NO_VERIF,    // Роль No Verif (до прохождения проверки)
    config.ROLES.CAPT_SQUAD   // Роль Capt-состава
  ],
  JOIN_CAPT_REMOVE: [],

  // 1.1 ПАНЕЛЬ РЕКРУТИНГА (/панель_рекрутинга) — Принятие новичка в RP
  JOIN_RP_ADD: [
    config.ROLES.FAMQ,        // Общая роль участника семьи
    config.ROLES.RP_SQUAD,    // Роль RP-состава
    config.ROLES.RANK_1,      // Начальная роль 1 | Test
    config.ROLES.NO_VERIF     // Роль No Verif
  ],
  JOIN_RP_REMOVE: [],

  // 2. ПОВЫШЕНИЕ РАНГОВ ПО ОТЧЁТУ (/панель_повышения)
  PROMO_RANKS: {
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
      label: '7 | Dep Chief',
      description: 'Ссылка на одобренную заявку',
      requirements: 'Ссылка на одобренную заявку',
      add: [config.ROLES.DEP_CHIEF],
      remove: [config.ROLES.RANK_6_HIGH],
      departments: {
        high: {
          label: '7 | Dep Chief (High)',
          description: 'Зам. начальника отдела High Staff',
          add: [config.ROLES.DEP_CHIEF_HIGH, config.ROLES.HIGH_STAFF]
        },
        recruit: {
          label: '7 | Dep Chief (Recruit)',
          description: 'Зам. начальника отдела рекрутинга',
          add: [config.ROLES.DEP_CHIEF_RECRUIT, config.ROLES.HIGH_STAFF]
        },
        main: {
          label: '7 | Dep Chief (Main)',
          description: 'Зам. начальника отдела Main',
          add: [config.ROLES.DEP_CHIEF_MAIN, config.ROLES.HIGH_STAFF]
        },
        begov: {
          label: '7 | Dep Chief (Begov)',
          description: 'Зам. начальника отдела новичков',
          add: [config.ROLES.DEP_CHIEF_BEGOV, config.ROLES.HIGH_STAFF]
        }
      }
    },
    rank_8: {
      label: '8 | Chief',
      description: 'Ссылка на одобренную заявку',
      requirements: 'Ссылка на одобренную заявку',
      add: [config.ROLES.CHIEF],
      remove: [config.ROLES.DEP_CHIEF],
      departments: {
        high: {
          label: '8 | Chief (High)',
          description: 'Начальник отдела High Staff',
          add: [config.ROLES.CHIEF_HIGH, config.ROLES.HIGH_STAFF]
        },
        recruit: {
          label: '8 | Chief (Recruit)',
          description: 'Начальник отдела рекрутинга',
          add: [config.ROLES.CHIEF_RECRUIT, config.ROLES.HIGH_STAFF]
        },
        main: {
          label: '8 | Chief (Main)',
          description: 'Начальник отдела Main',
          add: [config.ROLES.CHIEF_MAIN, config.ROLES.HIGH_STAFF]
        },
        begov: {
          label: '8 | Chief (Begov)',
          description: 'Начальник отдела новичков',
          add: [config.ROLES.CHIEF_BEGOV, config.ROLES.HIGH_STAFF]
        }
      }
    },
    rank_9: {
      label: '9 | Caller',
      description: 'Ссылка на одобренную заявку',
      requirements: 'Ссылка на одобренную заявку',
      add: [config.ROLES.CALLER, config.ROLES.HIGH_STAFF],
      remove: [config.ROLES.CHIEF]
    },
    rank_10: {
      label: '10 | Assistant',
      description: 'Ссылка на одобренную заявку',
      requirements: 'Ссылка на одобренную заявку',
      add: [config.ROLES.ASSISTANT, config.ROLES.HIGH_STAFF],
      remove: [config.ROLES.CALLER]
    }
  },


  // 3. ЗАЯВКИ НА РАНГИ И ДОЛЖНОСТИ (/панель_должностей) — РОЛИ НЕ ВЫДАЮТСЯ ПРИ ОДОБРЕНИИ!
  STAFF_APPS: {
    main: { label: '3 | Main', isMainOrRecruit: true },          // Уходит в канал MAIN_RECRUIT_APPS
    main_plus: { label: '4 | Main+', isMainOrRecruit: true },    // Уходит в канал MAIN_RECRUIT_APPS
    recruit: { label: '5 | Recruit', isMainOrRecruit: true },    // Уходит в канал MAIN_RECRUIT_APPS
    high: { label: '6 | High', isMainOrRecruit: false },         // Уходит в скрытый канал STAFF_APPS
    dep_chief: {
      label: '7 | Dep Chief',
      isMainOrRecruit: false,
      departments: {
        high: { label: '7 | Dep Chief (High)', description: 'Зам. отдела High Staff' },
        recruit: { label: '7 | Dep Chief (Recruit)', description: 'Зам. отдела рекрутинга' },
        main: { label: '7 | Dep Chief (Main)', description: 'Зам. отдела Main' },
        begov: { label: '7 | Dep Chief (Begov)', description: 'Зам. отдела новичков' }
      }
    },
    chief: {
      label: '8 | Chief',
      isMainOrRecruit: false,
      departments: {
        high: { label: '8 | Chief (High)', description: 'Начальник отдела High Staff' },
        recruit: { label: '8 | Chief (Recruit)', description: 'Начальник отдела рекрутинга' },
        main: { label: '8 | Chief (Main)', description: 'Начальник отдела Main' },
        begov: { label: '8 | Chief (Begov)', description: 'Начальник отдела новичков' }
      }
    },
    caller: { label: '9 | Caller', isMainOrRecruit: false },       // Уходит в скрытый канал STAFF_APPS
    assistant: { label: '10 | Assistant', isMainOrRecruit: false } // Уходит в скрытый канал STAFF_APPS
  }
};

// =========================================================================
// НАСТРОЙКИ ОБЗВОННИКОВ И ПРОВЕРЯЮЩИХ
// =========================================================================
const CALLERS = {
  // Роли, которым разрешено принимать/отклонять заявки новичков и вызывать их на обзвон:
  RECRUIT_CALLER_ROLES: [
    config.ROLES.RECRUIT,           // 5 | Recruit
    config.ROLES.DEP_CHIEF_RECRUIT, // 7 | Dep Chief (Recruit)
    config.ROLES.CHIEF_RECRUIT,     // 8 | Chief (Recruit)
    config.ROLES.HIGH_STAFF         // High Staff
  ],
  // Кого тегать при подаче новой заявки новичка в семью:
  RECRUIT_PING_ROLES: [
    config.ROLES.RECRUIT            // 5 | Recruit
  ],
  // Роли, которым разрешено проверять заявки на старший состав и должности:
  STAFF_CALLER_ROLES: [
    config.ROLES.HIGH_STAFF,        // High Staff
    config.ROLES.CHIEF,             // 8 | Chief
    config.ROLES.DEP_CHIEF,         // 7 | Dep Chief
    config.ROLES.ASSISTANT          // 10 | Assistant
  ],
  // Кого тегать при подаче заявки на ранг/должность:
  STAFF_PING_ROLES: [
    config.ROLES.HIGH_STAFF         // High Staff
  ],
  WAITING_VOICE_ID: config.CHANNELS.WAITING_VOICE, // Голосовой канал ожидания обзвона
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
// Привязка ключей для живого редактирования через админ-панель
PANELS.RECRUIT._panelKey = 'RECRUIT';
PANELS.TIER._panelKey = 'TIER';
PANELS.STAFF_APPS._panelKey = 'STAFF_APPS';
PANELS.PROMO._panelKey = 'PROMO';
PANELS.PORTFOLIO._panelKey = 'PORTFOLIO';
PANELS.AFK._panelKey = 'AFK';
PANELS.EVENTS._panelKey = 'EVENTS';
PANELS.ECONOMY.POINTS_PANEL._panelKey = 'POINTS_PANEL';
PANELS.ECONOMY.SHOP_PANEL._panelKey = 'SHOP_PANEL';
PANELS.ECONOMY.PAYOUT_PANEL._panelKey = 'PAYOUT_PANEL';
PANELS.EXTRA.GIVEAWAY_PANEL._panelKey = 'GIVEAWAY_PANEL';
PANELS.EXTRA.SKUPKA_PANEL._panelKey = 'SKUPKA_PANEL';
PANELS.EXTRA.CONTRACTS_PANEL._panelKey = 'CONTRACTS_PANEL';
PANELS.FEEDBACK._panelKey = 'FEEDBACK';
PANELS.WARNS.INFO_PANEL._panelKey = 'WARNS_INFO';
PANELS.WARNS.ADMIN_PANEL._panelKey = 'WARNS_ADMIN';
PANELS.ADMIN_PANEL._panelKey = 'ADMIN_PANEL';

module.exports = {
  resolveColor,
  applyPanelStyle,
  PANELS,
  ROLE_REWARDS,
  CALLERS
};
  