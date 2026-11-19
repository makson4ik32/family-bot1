const ROLES = {
  // ================= ОСНОВНЫЕ РОЛИ =================
  VACATION: '1569659425218895953',         // Временная роль "Отпуск"
  STAFF_PORTFOLIO: '1569659401722400839',  // Роль старшего состава, которая видит портфели
  CHECKER: '1569659401722400839',          // Роль проверяющих
  WARN_1: '1570176677693231274',           // Роль "Выговор 1/3"
  WARN_2: '1570176704071336066',           // Роль "Выговор 2/3"
  WARN_3: '1570176706914951268',           // Роль "Выговор 3/3"

  // ================= РАНГИ И ДОЛЖНОСТИ =================
  RANK_1: '1569659418583244800',           // 1 | Test
  RANK_2_BEGOV: '1569659417442521158',     // 2 | Begov
  RANK_3_MAIN: '1569659414783336468',      // 3 | Main
  RANK_4_MAIN_PLUS: '1569659413503938620', // 4 | Main+
  RECRUIT: '1569659405828624414',          // 5 | Recruit
  RANK_6_HIGH: '1569659399587364884',      // 6 | High
  DEP_CHIEF: '1569659398857433228',        // 7 | Dep Chief
  DEP_CHIEF_RECRUIT: '1570103807994503309',// Dep Chief Recruit
  CHIEF_RECRUIT: '1569659397230170177',    // Chief Recruit
  CALLER: '1569659393736183889',           // 9 | Caller
    DEP_LEADER: '1569659392784343120', // 10 | Dep Leader
  LEADER: '1569659391701946389',         // 11 | Leader


  // ================= РОЛИ СОСТАВА И СБОРОВ =================
  FAMQ: '1569659424401006633',             // Общая роль участника семьи
  HIGH_STAFF: '1569659401722400839',       // High Staff
  COACH: '1569659404062560337',            // Coach
  TIER_1: '1569659409238458389',           // Tier 1
  TIER_2: '1569659409972465778',           // Tier 2
  TIER_3: '1569659411058921522',           // Tier 3
  CAPT_SQUAD: '1569659421859119177',       // Capt
  RP_SQUAD: '1569659422727209012',         // RP
  NO_VERIF: '1569744048196165683',         // No Verif
  VERIF: '1569744106551255192',            // Verif
  TIER_CHECKER: '1569659406831067137',     // Tier Checker
  SCLAD: '1569659419308855377',            // Sclad
  DISCIPLINE: '1569659421066534912'        // дисциплина

};

module.exports = {
  CLIENT_ID: '1552025629237448876',
  GUILD_ID: '1560685667254542418',
  OWNER_IDS: ['1569659391701946389'],

  CHANNELS: {
    AFK_LOGS: '1569659511357050913',
    SERVER_LOGS: '1569659504013086741',
    ADMIN_LOGS: '1570435767124103269',
    PROMO_REPORTS: '1570096768333516931',
    PROMO_LOGS: '1569659504755343441',
    WARNS_INFO: '1569672441465405450',
    WARNS_APPEAL: '1570436088835743794',
    WARNS_WORKOFF: '1569659445342904353',
    PORTFOLIO_CATEGORY: '1569747363919298561',

    TAGS: '1569659437587767339',
    CAPT_TAGS: '1569659495716487178',

    POINTS_REPORTS: '1569659518944673872',
    SHOP_ORDERS: '1569659514159104100',
    PAYOUT_REQUESTS: '1569659515002167396',
    AFK_VOICE: '1570460520270794782',

    RECRUIT_QUEUE: '1570079719142068306',
    RECRUIT_RESULTS: '1569659430310510612',
    STAFF_RESULTS: '1569738855479779479',
    PROMO_RESULTS: '1569659428846837775',
    WAITING_VOICE: '1569659432470585426',
    TIER_CATEGORY: '1569747363919298561',
    STAFF_APPS: '1570524086793408534',
    MAIN_RECRUIT_APPS: '1569659510321062009',

    // Укажите ID второго канала для вопросов лидеру, если они разделены:
    IDEAS: '1569659452351713340',
    LEADER_QUESTIONS: '1569659452351713340'
  },

  ROLES,

  EVENTS: {
    CAPTS_VOICE_ID: '1569659454708781171',
    ROLE_PRIORITIES: [
      { roleId: ROLES.CALLER, label: 'Caller', priority: 1 },
      { roleId: ROLES.COACH, label: 'Coach', priority: 2 },
      { roleId: ROLES.TIER_1, label: 'Tier 1', priority: 3 },
      { roleId: ROLES.TIER_2, label: 'Tier 2', priority: 4 },
      { roleId: ROLES.TIER_3, label: 'Tier 3', priority: 5 },
      { roleId: ROLES.CAPT_SQUAD, label: 'Capt', priority: 6 },
      { roleId: ROLES.RP_SQUAD, label: 'RP', priority: 7 }
    ]
  }
};
