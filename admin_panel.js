const fs = require('fs');
const path = require('path');
const config = require('./config');
const settings = require('./settings');
const { getJson, saveJson } = require('./db');
const {
  getCustomPanels,
  saveCustomPanels,
  getCustomRoles,
  saveCustomRoles,
  getMergedPanelConfig,
  publishPanelToChannel,
  refreshPublishedPanel,
  deletePublishedPanels
} = require('./panel_manager');

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const FILES = {
  ECONOMY: 'economy_data.json',
  WARNS: 'warns_data.json',
  ADMIN: 'admin_data.json',
  STAFF_RATING: 'staff_rating.json',
  ACTIVITY: 'activity_data.json'
};

const EDITABLE_PANELS = {
  ADMIN_PANEL: { name: '🛠 Админ-панель (/админ_панель)' },
  RECRUIT: { name: '👋 Рекрутинг (/панель_рекрутинга)' },
  PROMO: { name: '📈 Повышение (/панель_повышения)' },
  PORTFOLIO: { name: '💼 Портфель (/панель_портфеля)' },
  AFK: { name: '💤 АФК и Отпуск (/панель_афк)' },
  EVENTS: { name: '⚔️ Сборы на МП (/панель_сборов)' },
  TIER: { name: '🎯 Tier-проверка (/панель_тира)' },
  STAFF_APPS: { name: '👔 Заявки на должности (/панель_должностей)' },
  POINTS_PANEL: { name: '💎 Заработок баллов (/панель_баллов)' },
  SHOP_PANEL: { name: '🛍 Магазин наград (/панель_магазина)' },
  PAYOUT_PANEL: { name: '💸 Выплаты (/панель_выплат)' },
  FEEDBACK: { name: '💬 Идеи и вопросы (/панель_связи)' },
  SKUPKA_PANEL: { name: '🔫 Скупка оружия (/панель_скупки)' },
  CONTRACTS_PANEL: { name: '📦 Контракты (/панель_контрактов)' },
  GIVEAWAY_PANEL: { name: '🎉 Розыгрыши (/панель_розыгрышей)' },
  WARNS_INFO: { name: '⚠️ Инфо о выговорах (/панель_информация)' },
  SCLAD: { name: '📦 Склад: нормы дня (/панель_склада)' },
  DISCIPLINE: { name: '⚖️ Отдел Discipline (/панель_дисциплины)' },
  MAPS: { name: '🗺 Карты каптов (/панель_карт)' },
  RULES: { name: '📜 Правила семьи (/панель_правил)' }
};

function hasAdminAccess(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (Array.isArray(config.OWNER_IDS) && config.OWNER_IDS.includes(member.id)) return true;

  const allowed = [
    config.ROLES.HIGH_STAFF,
    config.ROLES.CALLER,
    config.ROLES.CHIEF_RECRUIT,
    config.ROLES.DEP_CHIEF_RECRUIT,
    config.ROLES.DEP_LEADER,
    config.ROLES.LEADER
  ].filter(Boolean);

  return allowed.some(roleId => member.roles.cache.has(roleId));
}

function getAllRankRoleIds() {
  return [
    config.ROLES.RANK_1,
    config.ROLES.RANK_2_BEGOV,
    config.ROLES.RANK_3_MAIN,
    config.ROLES.RANK_4_MAIN_PLUS,
    config.ROLES.RECRUIT,
    config.ROLES.RANK_6_HIGH,
    config.ROLES.DEP_CHIEF_RECRUIT,
    config.ROLES.CHIEF_RECRUIT,
    config.ROLES.CALLER,
    config.ROLES.DEP_LEADER,
    config.ROLES.LEADER
  ].filter(Boolean);
}

function buildAdminPanelEmbed(guild) {
  const embed = settings.applyPanelStyle(new EmbedBuilder(), settings.PANELS.ADMIN_PANEL, '#2B2D31');
  if (!settings.PANELS.ADMIN_PANEL.thumbnail && guild) {
    embed.setThumbnail(guild.iconURL({ dynamic: true }));
  }
  return embed;
}

function buildAdminPanelRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_manage_user').setLabel('👤 Управление игроком').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_activity').setLabel('📊 Активность и неактив').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_audit').setLabel('🔍 Аудит ролей и ников').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_portfolios').setLabel('💼 Портфели').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_blacklist').setLabel('⛔ Чёрный список').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ap_warns').setLabel('⚠️ Выговор').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ap_request_vods').setLabel('🎥 Запрос откатов').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_mod').setLabel('🛡 Модерация').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_add_points').setLabel('💵 Добавить баллы').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ap_rem_points').setLabel('📉 Снять баллы').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ap_vacations').setLabel('📅 Отпуск участников').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_afk_stats').setLabel('💤 Статистика АФК').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_shop').setLabel('🛒 Магазин и баллы').setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_recruit_ctl').setLabel('📋 Набор в семью').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_recruit_stats').setLabel('🕵️ Актив рекрутов').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_staff_list').setLabel('👑 Состав стаффа').setStyle(ButtonStyle.Secondary)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_edit_panel').setLabel('🎨 Оформление панелей').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_roles_cfg').setLabel('🎭 Роли и обзвонники').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_role_builder').setLabel('🛡 Конструктор ролей и каналов').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_panels_hub').setLabel('🗂 Мастер панелей').setStyle(ButtonStyle.Success)
  );

  return [row1, row2, row3, row4, row5];
}

async function syncWarnRoles(member, count) {
  if (!member) return;
  const { WARN_1: w1, WARN_2: w2, WARN_3: w3 } = config.ROLES;
  const tasks = [];

  if (count <= 0) {
    if (w1) tasks.push(member.roles.remove(w1));
    if (w2) tasks.push(member.roles.remove(w2));
    if (w3) tasks.push(member.roles.remove(w3));
  } else if (count === 1) {
    if (w2) tasks.push(member.roles.remove(w2));
    if (w3) tasks.push(member.roles.remove(w3));
    if (w1) tasks.push(member.roles.add(w1));
  } else if (count === 2) {
    if (w1) tasks.push(member.roles.remove(w1));
    if (w3) tasks.push(member.roles.remove(w3));
    if (w2) tasks.push(member.roles.add(w2));
  } else if (count >= 3) {
    if (w1) tasks.push(member.roles.remove(w1));
    if (w2) tasks.push(member.roles.remove(w2));
    if (w3) tasks.push(member.roles.add(w3));
  }

  await Promise.allSettled(tasks);
}

function sendAdminLog(guild, title, description, color = '#5865F2') {
  if (!guild || !config.CHANNELS.ADMIN_LOGS) return;
  const ch = guild.channels.cache.get(config.CHANNELS.ADMIN_LOGS);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  ch.send({ embeds: [embed] }).catch(() => {});
}
function buildPanelsHubEmbed() {
  const customAll = getCustomPanels();
  const lines = Object.entries(EDITABLE_PANELS)
    .filter(([key]) => key !== 'ADMIN_PANEL')
    .map(([key, info]) => {
      const saved = customAll[key];
      const chText = saved?.channelId ? `<#${saved.channelId}>` : '*не назначен*';
      const statusIcon = saved?.messageId ? '🟢' : (saved?.channelId ? '🟡' : '⚪');
      return `${statusIcon} **${info.name}** ➔ ${chText}`;
    });

  return new EmbedBuilder()
    .setTitle('🗂 Мастер публикации и удаления панелей')
    .setColor('#5865F2')
    .setDescription(
      'Привязка каждой панели к каналу на сервере:\n' +
      '🟢 — опубликована | 🟡 — канал назначен | ⚪ — канал не выбран\n\n' +
      lines.join('\n')
    )
    .setFooter({ text: 'Назначьте каналы и нажмите «Опубликовать все назначенные»' });
}

function buildPanelsHubRows() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ap_hub_bind_select')
    .setPlaceholder('📌 Выберите панель, чтобы назначить ей канал...')
    .addOptions(
      Object.entries(EDITABLE_PANELS)
        .filter(([key]) => key !== 'ADMIN_PANEL')
        .map(([key, info]) => ({
          label: info.name.slice(0, 100),
          description: 'Выбрать канал для публикации этой панели',
          value: key
        }))
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_hub_publish_all').setLabel('🚀 Опубликовать все назначенные').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ap_hub_republish_all').setLabel('🔄 Перезалить все заново').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ap_hub_delete_all').setLabel('🗑 Удалить все панели').setStyle(ButtonStyle.Danger)
  );

  return [new ActionRowBuilder().addComponents(select), buttons];
}

const adminCommand = new SlashCommandBuilder()
  .setName('админ_панель')
  .setDescription('Открыть главную панель управления семьёй')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

async function handleAdmin(interaction, client) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'админ_панель') {
    if (!hasAdminAccess(interaction.member)) {
      return interaction.reply({ content: '❌ У вас нет доступа к панели управления!', ephemeral: true });
    }

    const msg = await interaction.channel.send({
      embeds: [buildAdminPanelEmbed(interaction.guild)],
      components: buildAdminPanelRows()
    });
    await msg.pin().catch(() => {});

    const customAll = getCustomPanels();
    customAll.ADMIN_PANEL = { ...(customAll.ADMIN_PANEL || {}), channelId: interaction.channel.id, messageId: msg.id };
    saveCustomPanels(customAll);

    return interaction.reply({ content: '✅ Главная панель управления создана и закреплена!', ephemeral: true });
  }

  if (
    (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) &&
    interaction.customId && interaction.customId.startsWith('ap_')
  ) {
    if (!hasAdminAccess(interaction.member)) {
      return interaction.reply({ content: '❌ У вас нет доступа к этой панели!', ephemeral: true });
    }
  }

  // =========================================================================
  // 🗂 МАСТЕР ПУБЛИКАЦИИ И УДАЛЕНИЯ ПАНЕЛЕЙ
  // =========================================================================
  if (interaction.isButton() && interaction.customId === 'ap_panels_hub') {
    return interaction.reply({
      embeds: [buildPanelsHubEmbed()],
      components: buildPanelsHubRows(),
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_hub_bind_select') {
    const panelKey = interaction.values.at(0);
    const panelName = EDITABLE_PANELS[panelKey]?.name || panelKey;

    const chSelect = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`ap_hub_ch_${panelKey}`)
        .setPlaceholder(`Выберите канал для: ${panelName}`)
        .setChannelTypes(ChannelType.GuildText)
    );

    return interaction.reply({
      content: `📌 Выберите текстовый канал, в котором должна находиться панель **${panelName}**:`,
      components: [chSelect],
      ephemeral: true
    });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('ap_hub_ch_')) {
    const panelKey = interaction.customId.replace('ap_hub_ch_', '');
    const channelId = interaction.values.at(0);
    const panelName = EDITABLE_PANELS[panelKey]?.name || panelKey;

    const customAll = getCustomPanels();
    customAll[panelKey] = { ...(customAll[panelKey] || {}), channelId };
    saveCustomPanels(customAll);

    const pubRes = await publishPanelToChannel(interaction.guild, panelKey, channelId);

    return interaction.update({
      content: pubRes.ok
        ? `✅ Панель **${panelName}** привязана к каналу <#${channelId}> и сразу опубликована!`
        : `⚠️ Канал <#${channelId}> сохранён, но не удалось отправить сообщение: ${pubRes.error}`,
      components: []
    });
  }

  if (interaction.isButton() && (interaction.customId === 'ap_hub_publish_all' || interaction.customId === 'ap_hub_republish_all')) {
    await interaction.deferUpdate();
    const isRepublish = interaction.customId === 'ap_hub_republish_all';
    const customAll = getCustomPanels();

    const keys = Object.keys(EDITABLE_PANELS).filter(k => k !== 'ADMIN_PANEL');
    if (isRepublish) {
      await deletePublishedPanels(interaction.guild, keys);
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const key of keys) {
      const chId = customAll[key]?.channelId;
      if (!chId) {
        skippedCount++;
        continue;
      }
      const res = await publishPanelToChannel(interaction.guild, key, chId);
      if (res.ok) sentCount++;
    }

    sendAdminLog(
      interaction.guild,
      isRepublish ? '🔄 Массовая перезаливка панелей' : '🚀 Массовая публикация панелей',
      `Выполнил: <@${interaction.user.id}>\nОпубликовано: **${sentCount}** | Без канала: **${skippedCount}**`,
      '#2ECC71'
    );

    return interaction.editReply({
      content: `✅ Готово! Опубликовано панелей: **${sentCount}** (пропущено без назначенного канала: **${skippedCount}**).`,
      embeds: [buildPanelsHubEmbed()],
      components: buildPanelsHubRows()
    });
  }

  if (interaction.isButton() && interaction.customId === 'ap_hub_delete_all') {
    await interaction.deferUpdate();
    const keys = Object.keys(EDITABLE_PANELS).filter(k => k !== 'ADMIN_PANEL');
    const deleted = await deletePublishedPanels(interaction.guild, keys);

    sendAdminLog(
      interaction.guild,
      '🗑 Удаление всех панелей',
      `Выполнил: <@${interaction.user.id}>\nУдалено сообщений из каналов: **${deleted}**`,
      '#E74C3C'
    );

    return interaction.editReply({
      content: `🗑 Удалено опубликованных панелей из каналов: **${deleted}**. Привязки к каналам сохранены — вы можете опубликовать их заново одной кнопкой!`,
      embeds: [buildPanelsHubEmbed()],
      components: buildPanelsHubRows()
    });
  }
  // =========================================================================
  // 🎨 КОНСТРУКТОР ОФОРМЛЕНИЯ ВСЕХ ПАНЕЛЕЙ
  // =========================================================================
  if (interaction.isButton() && interaction.customId === 'ap_edit_panel') {
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ap_sel_edit_panel')
        .setPlaceholder('🎨 Выберите панель для редактирования...')
        .addOptions(
          Object.entries(EDITABLE_PANELS).map(([k, v]) => ({
            label: v.name.slice(0, 100),
            description: 'Изменить текст, картинку, цвет или футер',
            value: k
          }))
        )
    );

    return interaction.reply({
      content: '🎨 Выберите панель, которую хотите настроить (изменения применятся сразу в канале):',
      components: [select],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_sel_edit_panel') {
    const panelKey = interaction.values.at(0);
    const current = getMergedPanelConfig(panelKey);

    const modal = new ModalBuilder()
      .setCustomId(`ap_modal_editpanel_${panelKey}`)
      .setTitle(`Редактор: ${panelKey}`.slice(0, 45));

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('p_title')
          .setLabel('Заголовок панели')
          .setValue((current.title || '').slice(0, 250))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('p_desc')
          .setLabel('Основной текст (описание)')
          .setValue((current.description || '').slice(0, 3900))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('p_color')
          .setLabel('Цвет полоски HEX (например #002fff)')
          .setValue((current.color || '#2B2D31').slice(0, 10))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('p_image')
          .setLabel('Ссылка на большую картинку / баннер (URL)')
          .setValue((current.image || '').slice(0, 500))
          .setPlaceholder('https://... (оставьте пустым, чтобы убрать)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('p_footer')
          .setLabel('Нижний текст (футер) и мини-иконка (через |)')
          .setValue(`${current.footer || ''}${current.thumbnail ? ` | ${current.thumbnail}` : ''}`.slice(0, 500))
          .setPlaceholder('Текст футера | https://ссылка_на_мини_иконку')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_editpanel_')) {
    const panelKey = interaction.customId.replace('ap_modal_editpanel_', '');
    const title = interaction.fields.getTextInputValue('p_title').trim();
    const description = interaction.fields.getTextInputValue('p_desc').trim();
    const color = interaction.fields.getTextInputValue('p_color').trim() || '#2B2D31';
    const image = interaction.fields.getTextInputValue('p_image').trim();
    const footerRaw = interaction.fields.getTextInputValue('p_footer').trim();

    let footer = footerRaw;
    let thumbnail = '';
    if (footerRaw.includes('|')) {
      const parts = footerRaw.split('|');
      footer = (parts[0] || '').trim();
      thumbnail = parts.slice(1).join('|').trim();
    }

    const customAll = getCustomPanels();
    customAll[panelKey] = {
      ...(customAll[panelKey] || {}),
      title,
      description,
      color,
      image,
      thumbnail,
      footer
    };
    saveCustomPanels(customAll);

    const updatedLive = await refreshPublishedPanel(interaction.guild, panelKey);

    sendAdminLog(
      interaction.guild,
      '🎨 Изменено оформление панели',
      `Админ: <@${interaction.user.id}>\nПанель: **${EDITABLE_PANELS[panelKey]?.name || panelKey}**`,
      '#5865F2'
    );

    return interaction.reply({
      content: updatedLive
        ? `✅ Панель **${EDITABLE_PANELS[panelKey]?.name || panelKey}** сохранена и **сразу обновлена в канале**!`
        : `✅ Настройки панели **${EDITABLE_PANELS[panelKey]?.name || panelKey}** сохранены!`,
      ephemeral: true
    });
  }

  // =========================================================================
  // 🎭 НАСТРОЙКА РОЛЕЙ И ОБЗВОННИКОВ
  // =========================================================================
  if (interaction.isButton() && interaction.customId === 'ap_roles_cfg') {
    const captRoles = settings.getJoinRoles('Capt').add.map(id => `<@&${id}>`).join(', ') || 'нет';
    const rpRoles = settings.getJoinRoles('RP').add.map(id => `<@&${id}>`).join(', ') || 'нет';
    const recCallers = settings.CALLERS.RECRUIT_CALLER_ROLES.map(id => `<@&${id}>`).join(', ') || 'нет';
    const recPings = settings.CALLERS.RECRUIT_PING_ROLES.map(id => `<@&${id}>`).join(', ') || 'нет';
    const staffCallers = settings.CALLERS.STAFF_CALLER_ROLES.map(id => `<@&${id}>`).join(', ') || 'нет';
    const staffPings = settings.CALLERS.STAFF_PING_ROLES.map(id => `<@&${id}>`).join(', ') || 'нет';
    const promoRanks = settings.getPromoRanks();

    const promoLines = Object.entries(promoRanks).map(([k, info]) => {
      const addStr = (info.add || []).map(id => `<@&${id}>`).join(', ') || 'нет';
      const remStr = (info.remove || []).map(id => `<@&${id}>`).join(', ') || 'нет';
      return `• **${info.label}**: выдать [${addStr}] | снять [${remStr}]`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎭 Настройка ролей и обзвонников')
      .setColor('#9B59B6')
      .setDescription(
        `**📞 Обзвонники (Рекрутинг):**\n` +
        `• **Могут обзванивать:** ${recCallers}\n` +
        `• **Тегать при новой заявке:** ${recPings}\n\n` +
        `**👔 Обзвонники (Должности):**\n` +
        `• **Могут обзванивать:** ${staffCallers}\n` +
        `• **Тегать при заявке на должность:** ${staffPings}\n\n` +
        `**Вступление в семью:**\n` +
        `• **Capt Состав:** ${captRoles}\n` +
        `• **RP Состав:** ${rpRoles}\n\n` +
        `**Система повышений:**\n${promoLines}`
      );

    const options = [
      { label: '📞 Обзвонники набора (кто проводит обзвон)', value: 'RECRUIT_CALLER_ROLES', description: 'Роли с доступом к кнопкам заявок в семью' },
      { label: '🔔 Пинг при заявке в семью (кого тегать)', value: 'RECRUIT_PING_ROLES', description: 'Какие роли тегать при новой анкете' },
      { label: '👔 Обзвонники должностей (кто проверяет)', value: 'STAFF_CALLER_ROLES', description: 'Роли с доступом к заявкам на должности' },
      { label: '📣 Пинг при заявке на должность', value: 'STAFF_PING_ROLES', description: 'Какие роли тегать при заявке на ранг/должность' },
      { label: '⚔️ Вступление: Capt Состав (выдача)', value: 'JOIN_CAPT_ADD', description: 'Какие роли выдавать при одобрении в Capt' },
      { label: '🎭 Вступление: RP Состав (выдача)', value: 'JOIN_RP_ADD', description: 'Какие роли выдавать при одобрении в RP' },
      ...Object.entries(promoRanks).map(([k, info]) => ({
        label: `📈 Повышение: ${info.label} (выдать)`,
        value: `PROMO_ADD_${k}`,
        description: 'Какие роли выдавать при одобрении этого ранга'
      })),
      ...Object.entries(promoRanks).map(([k, info]) => ({
        label: `📉 Повышение: ${info.label} (снять)`,
        value: `PROMO_REM_${k}`,
        description: 'Какие старые роли снимать при выдаче этого ранга'
      }))
    ];

    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ap_role_pick_target')
        .setPlaceholder('👇 Выберите, что хотите настроить...')
        .addOptions(options.slice(0, 25))
    );

    return interaction.reply({ embeds: [embed], components: [select], ephemeral: true });
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_role_pick_target') {
    const targetKey = interaction.values.at(0);
    const roleSelect = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`ap_role_save_${targetKey}`)
        .setPlaceholder('Выберите роли (от 0 до 10)...')
        .setMinValues(0)
        .setMaxValues(10)
    );

    return interaction.reply({
      content: `🎭 Выберите нужные роли в меню ниже для настройки **${targetKey}**:`,
      components: [roleSelect],
      ephemeral: true
    });
  }

  if (interaction.isRoleSelectMenu() && interaction.customId.startsWith('ap_role_save_')) {
    const targetKey = interaction.customId.replace('ap_role_save_', '');
    const selectedRoleIds = interaction.values;
    const customRoles = getCustomRoles();

    if (['RECRUIT_CALLER_ROLES', 'RECRUIT_PING_ROLES', 'STAFF_CALLER_ROLES', 'STAFF_PING_ROLES', 'JOIN_CAPT_ADD', 'JOIN_RP_ADD'].includes(targetKey)) {
      customRoles[targetKey] = selectedRoleIds;
    } else if (targetKey.startsWith('PROMO_ADD_')) {
      const rankKey = targetKey.replace('PROMO_ADD_', '');
      if (!customRoles.PROMO) customRoles.PROMO = {};
      if (!customRoles.PROMO[rankKey]) customRoles.PROMO[rankKey] = {};
      customRoles.PROMO[rankKey].add = selectedRoleIds;
    } else if (targetKey.startsWith('PROMO_REM_')) {
      const rankKey = targetKey.replace('PROMO_REM_', '');
      if (!customRoles.PROMO) customRoles.PROMO = {};
      if (!customRoles.PROMO[rankKey]) customRoles.PROMO[rankKey] = {};
      customRoles.PROMO[rankKey].remove = selectedRoleIds;
    }

    saveCustomRoles(customRoles);

    const mentions = selectedRoleIds.length > 0 ? selectedRoleIds.map(id => `<@&${id}>`).join(', ') : '*список очищен*';
    return interaction.update({
      content: `✅ Настройка **${targetKey}** обновлена: ${mentions}`,
      components: []
    });
  }

  // =========================================================================
  // 🛡 КОНСТРУКТОР РОЛЕЙ И ДОСТУПА К КАНАЛАМ
  // =========================================================================
  if (interaction.isButton() && interaction.customId === 'ap_role_builder') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_rb_create_role').setLabel('➕ Создать новую роль').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ap_rb_edit_perms').setLabel('👁 Настроить доступ к каналам').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ap_rb_create_ch').setLabel('📁 Создать канал').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: '🛡 **Конструктор ролей и каналов сервера:**\nСоздавайте роли, настраивайте какие каналы/категории они видят и где могут писать.',
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.isButton() && interaction.customId === 'ap_rb_create_role') {
    const modal = new ModalBuilder()
      .setCustomId('ap_modal_rb_createrole')
      .setTitle('Создание новой роли');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('r_name').setLabel('Название роли').setPlaceholder('Например: 4 | Main+').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('r_color').setLabel('HEX-цвет (например #3498DB)').setValue('#5865F2').setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('r_preset').setLabel('Шаблон прав (member / mod / high / admin)').setValue('member').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('r_hoist').setLabel('Показывать отдельно в списке? (Да / Нет)').setValue('Да').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ap_modal_rb_createrole') {
    const name = interaction.fields.getTextInputValue('r_name').trim();
    const color = interaction.fields.getTextInputValue('r_color').trim() || '#5865F2';
    const preset = interaction.fields.getTextInputValue('r_preset').trim().toLowerCase();
    const hoist = ['да', 'yes', '+'].includes(interaction.fields.getTextInputValue('r_hoist').trim().toLowerCase());

    const permMap = {
      member: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      mod: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      high: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      admin: [PermissionFlagsBits.Administrator]
    };

    try {
      const createdRole = await interaction.guild.roles.create({
        name,
        color: settings.resolveColor(color, '#5865F2'),
        hoist,
        mentionable: true,
        permissions: permMap[preset] || permMap.member,
        reason: `Создано через админ-панель (${interaction.user.tag})`
      });

      const chSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`ap_rb_setch_${createdRole.id}`)
          .setPlaceholder('Выберите каналы/категории, которые видит эта роль (до 15)...')
          .setMinValues(0)
          .setMaxValues(15)
      );

      sendAdminLog(interaction.guild, '🛡 Создана роль через админ-панель', `Админ: <@${interaction.user.id}>\nРоль: <@&${createdRole.id}> (\`${name}\`)`, '#2ECC71');
      return interaction.reply({
        content: `✅ Роль <@&${createdRole.id}> создана! Теперь выберите каналы или категории, к которым ей нужно открыть доступ (или закройте меню):`,
        components: [chSelect],
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({ content: '❌ Не удалось создать роль. Проверьте права бота («Управлять ролями»).', ephemeral: true });
    }
  }

  if (interaction.isButton() && interaction.customId === 'ap_rb_edit_perms') {
    const roleSelect = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('ap_rb_pick_role_perms')
        .setPlaceholder('Выберите роль для настройки видимости каналов...')
    );
    return interaction.reply({ content: '🎭 Выберите роль, которой нужно настроить доступ к каналам:', components: [roleSelect], ephemeral: true });
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === 'ap_rb_pick_role_perms') {
    const roleId = interaction.values.at(0);
    const chSelect = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`ap_rb_setch_${roleId}`)
        .setPlaceholder('Выберите каналы/категории для открытия доступа (до 15)...')
        .setMinValues(1)
        .setMaxValues(15)
    );
    return interaction.update({ content: `👁 Выберите каналы или категории, которые должна **видеть** роль <@&${roleId}>:`, components: [chSelect] });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('ap_rb_setch_')) {
    const roleId = interaction.customId.replace('ap_rb_setch_', '');
    const channelIds = interaction.values;
    let updatedCount = 0;

    for (const chId of channelIds) {
      const ch = interaction.guild.channels.cache.get(chId);
      if (ch && ch.permissionOverwrites) {
        await ch.permissionOverwrites.edit(roleId, {
          ViewChannel: true,
          SendMessages: true,
          Connect: true,
          Speak: true,
          ReadMessageHistory: true
        }).then(() => updatedCount++).catch(() => {});
      }
    }

    return interaction.update({
      content: `✅ Доступ (просмотр, отправка сообщений, вход в войс) для роли <@&${roleId}> открыт в **${updatedCount}** каналах/категориях!`,
      components: []
    });
  }
  if (interaction.isButton() && interaction.customId === 'ap_rb_create_ch') {
    const modal = new ModalBuilder().setCustomId('ap_modal_rb_createch').setTitle('Создание нового канала');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ch_name').setLabel('Название канала').setPlaceholder('Например: информация-состава').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ch_type').setLabel('Тип канала (text или voice)').setValue('text').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ch_cat').setLabel('ID категории (необязательно)').setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ch_private').setLabel('Приватный только для семьи? (Да / Нет)').setValue('Да').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ap_modal_rb_createch') {
    const name = interaction.fields.getTextInputValue('ch_name').trim();
    const typeStr = interaction.fields.getTextInputValue('ch_type').trim().toLowerCase();
    const catId = interaction.fields.getTextInputValue('ch_cat').trim() || undefined;
    const isPrivate = ['да', 'yes', '+'].includes(interaction.fields.getTextInputValue('ch_private').trim().toLowerCase());

    const overwrites = isPrivate && config.ROLES.FAMQ
      ? [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: config.ROLES.FAMQ, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      : undefined;

    try {
      const ch = await interaction.guild.channels.create({
        name,
        type: typeStr === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: catId,
        permissionOverwrites: overwrites
      });
      return interaction.reply({ content: `✅ Канал ${ch} успешно создан!`, ephemeral: true });
    } catch {
      return interaction.reply({ content: '❌ Ошибка создания канала. Проверьте ID категории и права бота.', ephemeral: true });
    }
  }

  // =========================================================================
  // 👤 УПРАВЛЕНИЕ ИГРОКОМ (РАНГ, TIER, НИК, ИСКЛЮЧЕНИЕ)
  // =========================================================================
  if (interaction.isButton() && interaction.customId === 'ap_manage_user') {
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('ap_sel_manage_user')
        .setPlaceholder('Выберите участника семьи...')
    );
    return interaction.reply({ content: '👤 Выберите участника для управления:', components: [row], ephemeral: true });
  }

  if (interaction.isUserSelectMenu() && interaction.customId === 'ap_sel_manage_user') {
    const targetId = interaction.values.at(0);
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.update({ content: '❌ Участник не найден на сервере.', components: [] });

    const eco = getJson(FILES.ECONOMY, {});
    const warns = getJson(FILES.WARNS, {});
    const pts = eco[targetId]?.points || 0;
    const wCount = warns[targetId] || 0;

    const embed = new EmbedBuilder()
      .setTitle(`👤 Карточка игрока: ${member.displayName}`)
      .setColor('#5865F2')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Discord', value: `<@${targetId}> (\`${targetId}\`)`, inline: true },
        { name: 'Баллы / Выговоры', value: `💎 **${pts}** б. | ⚠️ **${wCount}/3**`, inline: true },
        { name: 'Роли', value: member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(' ') || 'Нет' }
      );

    const r1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ap_u_nick_${targetId}`).setLabel('✏️ Изменить ник').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ap_u_tier_${targetId}`).setLabel('🎯 Выдать Tier').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ap_u_kick_${targetId}`).setLabel('👢 Исключить из семьи').setStyle(ButtonStyle.Danger)
    );

    const extraLeaderRanks = [
      { key: 'rank_10_depl', label: '10 | Dep Leader', add: [config.ROLES.DEP_LEADER, config.ROLES.HIGH_STAFF].filter(Boolean) },
      { key: 'rank_11_lead', label: '11 | Leader', add: [config.ROLES.LEADER, config.ROLES.HIGH_STAFF].filter(Boolean) }
    ].filter(r => r.add.length > 0);

    const allCardRanks = [
      ...Object.entries(settings.getPromoRanks()).map(([k, info]) => ({ key: k, label: info.label })),
      ...extraLeaderRanks.map(r => ({ key: r.key, label: r.label }))
    ];

    const rankOptions = allCardRanks.map(r => ({
      label: r.label,
      description: 'Назначить этот ранг игроку',
      value: `${targetId}:${r.key}`
    }));

    const r2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ap_u_setrank')
        .setPlaceholder('📈 Установить ранг игроку...')
        .addOptions(rankOptions)
    );

    return interaction.update({ content: null, embeds: [embed], components: [r1, r2] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_u_setrank') {
    const [targetId, rankKey] = interaction.values.at(0).split(':');
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);

    const extraMap = {
      rank_10_depl: { label: '10 | Dep Leader', add: [config.ROLES.DEP_LEADER, config.ROLES.HIGH_STAFF].filter(Boolean) },
      rank_11_lead: { label: '11 | Leader', add: [config.ROLES.LEADER, config.ROLES.HIGH_STAFF].filter(Boolean) }
    };

    const rankInfo = settings.getPromoRanks()[rankKey] || extraMap[rankKey];
    if (!member || !rankInfo) return interaction.reply({ content: '❌ Ошибка выбора ранга.', ephemeral: true });

    const allRankIds = getAllRankRoleIds();
    await member.roles.remove(allRankIds).catch(() => {});
    if (Array.isArray(rankInfo.add) && rankInfo.add.length > 0) {
      await member.roles.add(rankInfo.add).catch(() => {});
    }

    sendAdminLog(interaction.guild, '📈 Смена ранга через админ-панель', `Админ: <@${interaction.user.id}>\nИгрок: <@${targetId}>\nНовый ранг: **${rankInfo.label}**`, '#2ECC71');
    return interaction.reply({ content: `✅ Игроку <@${targetId}> установлен ранг **${rankInfo.label}**!`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('ap_u_nick_')) {
    const targetId = interaction.customId.replace('ap_u_nick_', '');
    const modal = new ModalBuilder().setCustomId(`ap_modal_nick_${targetId}`).setTitle('Смена ника игроку');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('new_nick').setLabel('Новый ник (Имя_Фамилия | #Статик)').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_nick_')) {
    const targetId = interaction.customId.replace('ap_modal_nick_', '');
    const newNick = interaction.fields.getTextInputValue('new_nick').trim();
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Участник не найден.', ephemeral: true });

    await member.setNickname(newNick).catch(() => {});
    return interaction.reply({ content: `✅ Ник игрока <@${targetId}> изменён на \`${newNick}\`.`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('ap_u_tier_')) {
    const targetId = interaction.customId.replace('ap_u_tier_', '');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ap_settier_${targetId}_1`).setLabel('Tier 1').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ap_settier_${targetId}_2`).setLabel('Tier 2').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ap_settier_${targetId}_3`).setLabel('Tier 3').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ content: `🎯 Выберите уровень Tier для <@${targetId}>:`, components: [row], ephemeral: true });
  }
  if (interaction.isButton() && interaction.customId.startsWith('ap_settier_')) {
    const [, targetId, tierNum] = interaction.customId.split('_');
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.update({ content: '❌ Участник не найден.', components: [] });

    const tierMap = { '1': config.ROLES.TIER_1, '2': config.ROLES.TIER_2, '3': config.ROLES.TIER_3 };
    const allTiers = Object.values(tierMap).filter(Boolean);
    await member.roles.remove(allTiers).catch(() => {});
    if (tierMap[tierNum]) await member.roles.add(tierMap[tierNum]).catch(() => {});

    return interaction.update({ content: `✅ Игроку <@${targetId}> выдана роль **Tier ${tierNum}**!`, components: [] });
  }

  if (interaction.isButton() && interaction.customId.startsWith('ap_u_kick_')) {
    const targetId = interaction.customId.replace('ap_u_kick_', '');
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Участник не найден.', ephemeral: true });

    const rolesToRemove = member.roles.cache.filter(r => r.id !== interaction.guild.id && !r.managed).map(r => r.id);
    await member.roles.remove(rolesToRemove).catch(() => {});

    const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
    if (catId) {
      const pCh = interaction.guild.channels.cache.find(c => c.parentId === catId && c.topic && c.topic.startsWith('Личный портфель') && c.topic.includes(targetId));
      if (pCh) await pCh.delete('Исключение из семьи').catch(() => {});
    }

    sendAdminLog(interaction.guild, '👢 Исключение из семьи', `Админ: <@${interaction.user.id}>\nИсключён: <@${targetId}>`, '#E74C3C');
    return interaction.reply({ content: `✅ У игрока <@${targetId}> сняты все семейные роли и удалён портфель.`, ephemeral: true });
  }

  // =========================================================================
  // 💵 БАЛЛЫ / ⚠️ ВЫГОВОРЫ / ⛔ ЧС / 📋 РАЗДЕЛЬНОЕ УПРАВЛЕНИЕ НАБОРОМ
  // =========================================================================
  if (interaction.isButton() && (interaction.customId === 'ap_add_points' || interaction.customId === 'ap_rem_points')) {
    const mode = interaction.customId === 'ap_add_points' ? 'add' : 'rem';
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`ap_pts_user_${mode}`).setPlaceholder('Выберите игрока...')
    );
    return interaction.reply({ content: mode === 'add' ? '💵 Кому начислить баллы?' : '📉 У кого снять баллы?', components: [row], ephemeral: true });
  }

  if (interaction.isUserSelectMenu() && interaction.customId.startsWith('ap_pts_user_')) {
    const mode = interaction.customId.replace('ap_pts_user_', '');
    const targetId = interaction.values.at(0);
    const modal = new ModalBuilder().setCustomId(`ap_modal_pts_${mode}_${targetId}`).setTitle(mode === 'add' ? 'Начислить баллы' : 'Снять баллы');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('amount').setLabel('Количество баллов').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Причина').setStyle(TextInputStyle.Short).setRequired(false)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_pts_')) {
    const [, , , mode, targetId] = interaction.customId.split('_');
    const amount = parseInt(interaction.fields.getTextInputValue('amount').trim(), 10);
    const reason = interaction.fields.getTextInputValue('reason').trim() || 'Через админ-панель';
    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Введите корректное число.', ephemeral: true });

    const eco = getJson(FILES.ECONOMY, {});
    if (!eco[targetId]) eco[targetId] = { points: 0, voiceMinutes: 0 };
    eco[targetId].points = mode === 'add' ? (eco[targetId].points || 0) + amount : Math.max(0, (eco[targetId].points || 0) - amount);
    saveJson(FILES.ECONOMY, eco);

    sendAdminLog(interaction.guild, mode === 'add' ? '💵 Начисление баллов' : '📉 Снятие баллов', `Админ: <@${interaction.user.id}>\nИгрок: <@${targetId}>\nСумма: **${amount}** б.\nПричина: ${reason}`, mode === 'add' ? '#2ECC71' : '#E74C3C');
    return interaction.reply({ content: `✅ Баланс <@${targetId}> обновлён: **${eco[targetId].points}** б.`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ap_warns') {
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('ap_warn_user').setPlaceholder('Выберите игрока...')
    );
    return interaction.reply({ content: '⚠️ Выберите игрока для выдачи/снятия выговора:', components: [row], ephemeral: true });
  }

  if (interaction.isUserSelectMenu() && interaction.customId === 'ap_warn_user') {
    const targetId = interaction.values.at(0);
    const warns = getJson(FILES.WARNS, {});
    const count = warns[targetId] || 0;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ap_w_give_${targetId}`).setLabel('➕ Выдать выговор').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ap_w_rem_${targetId}`).setLabel('➖ Снять выговор').setStyle(ButtonStyle.Success)
    );
    return interaction.update({ content: `⚠️ У игрока <@${targetId}> сейчас **${count}/3** выговоров:`, components: [row] });
  }

  if (interaction.isButton() && (interaction.customId.startsWith('ap_w_give_') || interaction.customId.startsWith('ap_w_rem_'))) {
    const isGive = interaction.customId.startsWith('ap_w_give_');
    const targetId = interaction.customId.replace(isGive ? 'ap_w_give_' : 'ap_w_rem_', '');
    const warns = getJson(FILES.WARNS, {});
    const current = warns[targetId] || 0;
    const next = isGive ? Math.min(3, current + 1) : Math.max(0, current - 1);

    if (next === 0) delete warns[targetId];
    else warns[targetId] = next;
    saveJson(FILES.WARNS, warns);

    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    await syncWarnRoles(member, next);

    sendAdminLog(interaction.guild, isGive ? '⚠️ Выдан выговор' : '✅ Снят выговор', `Админ: <@${interaction.user.id}>\nИгрок: <@${targetId}>\nТекущий счётчик: **${next}/3**`, isGive ? '#E74C3C' : '#2ECC71');
    return interaction.update({ content: `✅ Обновлено! У <@${targetId}> теперь **${next}/3** выговоров.`, components: [] });
  }

  if (interaction.isButton() && interaction.customId === 'ap_blacklist') {
    const adminData = getJson(FILES.ADMIN, { recruitOpen: true, captOpen: true, rpOpen: true, blacklist: [] });
    const list = (adminData.blacklist || []).map((b, i) => `${i + 1}. <@${b.userId}> (\`${b.userId}\`) — ${b.reason}`).join('\n') || '*Чёрный список пуст*';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_bl_add_btn').setLabel('➕ Добавить в ЧС').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ap_bl_rem_btn').setLabel('➖ Убрать из ЧС').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ content: `⛔ **Чёрный список семьи:**\n${list.slice(0, 1800)}`, components: [row], ephemeral: true });
  }

  if (interaction.isButton() && (interaction.customId === 'ap_bl_add_btn' || interaction.customId === 'ap_bl_rem_btn')) {
    const isAdd = interaction.customId === 'ap_bl_add_btn';
    const modal = new ModalBuilder().setCustomId(isAdd ? 'ap_modal_bl_add' : 'ap_modal_bl_rem').setTitle(isAdd ? 'Добавить в ЧС' : 'Убрать из ЧС');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('uid').setLabel('Discord ID игрока').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      ...(isAdd ? [new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Причина занесения в ЧС').setStyle(TextInputStyle.Short).setRequired(true)
      )] : [])
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && (interaction.customId === 'ap_modal_bl_add' || interaction.customId === 'ap_modal_bl_rem')) {
    const uid = interaction.fields.getTextInputValue('uid').trim();
    const adminData = getJson(FILES.ADMIN, { recruitOpen: true, captOpen: true, rpOpen: true, blacklist: [] });
    if (!Array.isArray(adminData.blacklist)) adminData.blacklist = [];

    if (interaction.customId === 'ap_modal_bl_add') {
      const reason = interaction.fields.getTextInputValue('reason').trim();
      adminData.blacklist.push({ userId: uid, reason, by: interaction.user.username });
      saveJson(FILES.ADMIN, adminData);
      return interaction.reply({ content: `⛔ \`${uid}\` добавлен в чёрный список.`, ephemeral: true });
    } else {
      adminData.blacklist = adminData.blacklist.filter(b => b.userId !== uid);
      saveJson(FILES.ADMIN, adminData);
      return interaction.reply({ content: `✅ \`${uid}\` удалён из чёрного списка.`, ephemeral: true });
    }
  }
  // 📋 РАЗДЕЛЬНОЕ УПРАВЛЕНИЕ НАБОРОМ (ОБЩИЙ / CAPT / RP)
  if (interaction.isButton() && (interaction.customId === 'ap_recruit_ctl' || interaction.customId.startsWith('ap_rec_tog_'))) {
    const adminData = getJson(FILES.ADMIN, { recruitOpen: true, captOpen: true, rpOpen: true, blacklist: [] });
    if (adminData.recruitOpen === undefined) adminData.recruitOpen = true;
    if (adminData.captOpen === undefined) adminData.captOpen = true;
    if (adminData.rpOpen === undefined) adminData.rpOpen = true;

    if (interaction.customId === 'ap_rec_tog_all') adminData.recruitOpen = !adminData.recruitOpen;
    if (interaction.customId === 'ap_rec_tog_capt') adminData.captOpen = !adminData.captOpen;
    if (interaction.customId === 'ap_rec_tog_rp') adminData.rpOpen = !adminData.rpOpen;

    if (interaction.customId.startsWith('ap_rec_tog_')) {
      saveJson(FILES.ADMIN, adminData);
    }

    const statusText =
      `📋 **Управление статусами набора в семью:**\n\n` +
      `• **Общий набор:** ${adminData.recruitOpen ? '🟢 ОТКРЫТ' : '🔴 ЗАКРЫТ'}\n` +
      `• **⚔️ Capt-состав:** ${adminData.captOpen ? '🟢 ОТКРЫТ' : '🔴 ЗАКРЫТ'}\n` +
      `• **🎭 RP-состав:** ${adminData.rpOpen ? '🟢 ОТКРЫТ' : '🔴 ЗАКРЫТ'}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_rec_tog_all').setLabel(adminData.recruitOpen ? 'Закрыть общий набор' : 'Открыть общий набор').setStyle(adminData.recruitOpen ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ap_rec_tog_capt').setLabel(adminData.captOpen ? 'Закрыть Capt' : 'Открыть Capt').setStyle(adminData.captOpen ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ap_rec_tog_rp').setLabel(adminData.rpOpen ? 'Закрыть RP' : 'Открыть RP').setStyle(adminData.rpOpen ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    if (interaction.customId === 'ap_recruit_ctl') {
      return interaction.reply({ content: statusText, components: [row], ephemeral: true });
    }
    return interaction.update({ content: statusText, components: [row] });
  }

  // 🔍 АУДИТ РОЛЕЙ И НИКОВ
  if (interaction.isButton() && interaction.customId === 'ap_audit') {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});
    const famMembers = interaction.guild.members.cache.filter(m => !m.user.bot && config.ROLES.FAMQ && m.roles.cache.has(config.ROLES.FAMQ));
    const badNicks = famMembers.filter(m => !m.displayName.includes('|') && !m.displayName.includes('#'));

    const embed = new EmbedBuilder()
      .setTitle('🔍 Аудит состава семьи')
      .setColor('#3498DB')
      .addFields(
        { name: '👥 Всего с ролью семьи', value: `**${famMembers.size}** чел.`, inline: true },
        { name: '⚠️ Ник не по форме (без | и #)', value: badNicks.size > 0 ? badNicks.map(m => `<@${m.id}> (\`${m.displayName}\`)`).slice(0, 20).join('\n') : 'Все ники в норме!', inline: false }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  // 💼 КОНТРОЛЬ ПОРТФЕЛЕЙ (КТО НЕ СОЗДАЛ + НАПОМИНАНИЕ В ЛС)
  if (interaction.isButton() && interaction.customId === 'ap_portfolios') {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});

    const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
    const pChannels = interaction.guild.channels.cache.filter(
      c => c.parentId === catId && c.topic && c.topic.startsWith('Личный портфель')
    );

    const famMembers = interaction.guild.members.cache.filter(
      m => !m.user.bot && config.ROLES.FAMQ && m.roles.cache.has(config.ROLES.FAMQ)
    );

    const missing = famMembers.filter(m => !pChannels.some(ch => ch.topic.includes(m.id)));

    const missingList = missing.size > 0
      ? missing.map(m => `• <@${m.id}> (\`${m.displayName}\`)`).slice(0, 35).join('\n')
      : '✅ Все участники семьи создали личный портфель!';

    const embed = new EmbedBuilder()
      .setTitle('💼 Контроль личных портфелей')
      .setColor('#9B59B6')
      .addFields(
        { name: '📁 Создано портфелей', value: `**${pChannels.size} шт.** в <#${catId}>`, inline: true },
        { name: '⚠️ Без портфеля', value: `**${missing.size} чел.**`, inline: true },
        { name: '📋 Список участников без портфеля', value: missingList.slice(0, 1024), inline: false }
      )
      .setTimestamp();

    const components = [];
    if (missing.size > 0) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ap_portfolios_remind')
            .setLabel(`📩 Напомнить в ЛС (${missing.size} чел.)`)
            .setStyle(ButtonStyle.Primary)
        )
      );
    }

    return interaction.editReply({ embeds: [embed], components });
  }

  if (interaction.isButton() && interaction.customId === 'ap_portfolios_remind') {
    await interaction.deferUpdate();
    if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});

    const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
    const pChannels = interaction.guild.channels.cache.filter(
      c => c.parentId === catId && c.topic && c.topic.startsWith('Личный портфель')
    );
    const famMembers = interaction.guild.members.cache.filter(
      m => !m.user.bot && config.ROLES.FAMQ && m.roles.cache.has(config.ROLES.FAMQ)
    );
    const missing = famMembers.filter(m => !pChannels.some(ch => ch.topic.includes(m.id)));

    let sent = 0;
    for (const [, m] of missing) {
      const ok = await m.send(
        `💼 **Напоминание от руководства ${interaction.guild.name}!**\nУ вас до сих пор не создан **личный портфель**. Пожалуйста, создайте его в канале портфелей, иначе вы не сможете получить повышение!`
      ).then(() => true).catch(() => false);
      if (ok) sent++;
    }

    return interaction.editReply({
      content: `✅ Напоминание о создании портфеля отправлено в ЛС **${sent} из ${missing.size}** участников!`,
      components: []
    });
  }

  // 🛡 МОДЕРАЦИЯ (ВЫБОР КАНАЛА -> КОЛИЧЕСТВО СООБЩЕНИЙ)
  if (interaction.isButton() && interaction.customId === 'ap_mod') {
    const chSelect = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('ap_mod_sel_channel')
        .setPlaceholder('Выберите канал для очистки сообщений...')
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({
      content: '🛡 Выберите текстовый канал, в котором нужно удалить сообщения:',
      components: [chSelect],
      ephemeral: true
    });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'ap_mod_sel_channel') {
    const channelId = interaction.values.at(0);
    const modal = new ModalBuilder()
      .setCustomId(`ap_modal_clear_${channelId}`)
      .setTitle('Очистка сообщений в канале');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cnt')
          .setLabel('Сколько сообщений удалить (1–100)?')
          .setPlaceholder('Например: 20')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_clear_')) {
    const channelId = interaction.customId.replace('ap_modal_clear_', '');
    const targetCh = interaction.guild.channels.cache.get(channelId);
    if (!targetCh) {
      return interaction.reply({ content: '❌ Выбранный канал не найден.', ephemeral: true });
    }

    const cnt = Math.min(100, Math.max(1, parseInt(interaction.fields.getTextInputValue('cnt'), 10) || 10));
    const deleted = await targetCh.bulkDelete(cnt, true).catch(() => null);

    sendAdminLog(
      interaction.guild,
      '🧹 Очистка сообщений (Модерация)',
      `Админ: <@${interaction.user.id}>\nКанал: <#${channelId}>\nУдалено: **${deleted ? deleted.size : 0}** шт.`,
      '#E67E22'
    );

    return interaction.reply({
      content: `🧹 В канале <#${channelId}> удалено сообщений: **${deleted ? deleted.size : 0}**.`,
      ephemeral: true
    });
  }
  // 📊 АКТИВНОСТЬ И НЕАКТИВ УЧАСТНИКОВ
  if (interaction.isButton() && interaction.customId === 'ap_activity') {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});

    const eco = getJson(FILES.ECONOMY, {});
    const act = getJson(FILES.ACTIVITY, {});

    const top = Object.entries(eco)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 10);

    const topText = top.length > 0
      ? top.map(([uid, d], i) => `${i + 1}. <@${uid}> — **${d.points || 0}** б. | 🎙 ${Math.floor((d.voiceMinutes || 0) / 60)} ч.`).join('\n')
      : 'Данных пока нет.';

    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const famMembers = interaction.guild.members.cache.filter(
      m => !m.user.bot &&
           config.ROLES.FAMQ && m.roles.cache.has(config.ROLES.FAMQ) &&
           (!config.ROLES.VACATION || !m.roles.cache.has(config.ROLES.VACATION))
    );

    const inactive = famMembers.filter(m => {
      const last = act[m.id]?.lastSeen || 0;
      return last > 0 && (now - last) > fiveDaysMs;
    });

    const inactiveText = inactive.size > 0
      ? inactive.map(m => {
          const days = Math.floor((now - act[m.id].lastSeen) / (24 * 60 * 60 * 1000));
          return `• <@${m.id}> — неактив **${days} дн.**`;
        }).slice(0, 15).join('\n')
      : '✅ Неактивных (более 5 дней без отпуска) не найдено.';

    const embed = new EmbedBuilder()
      .setTitle('📊 Активность и контроль неактива')
      .setColor('#3498DB')
      .addFields(
        { name: '🏆 Топ-10 по баллам и войсу', value: topText.slice(0, 1024), inline: false },
        { name: '💤 Неактив > 5 дней (без отпуска)', value: inactiveText.slice(0, 1024), inline: false }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // 📅 ОТПУСК / 💤 АФК / 🕵️ АКТИВ РЕКРУТОВ / 👑 СОСТАВ СТАФФА / 🎥 ОТКАТЫ
  if (interaction.isButton() && ['ap_vacations', 'ap_afk_stats', 'ap_recruit_stats', 'ap_staff_list', 'ap_request_vods'].includes(interaction.customId)) {
    if (interaction.customId === 'ap_vacations') {
      if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});
      const vac = interaction.guild.members.cache.filter(m => !m.user.bot && config.ROLES.VACATION && m.roles.cache.has(config.ROLES.VACATION));
      return interaction.reply({ content: `📅 **В отпуске сейчас (${vac.size}):**\n${vac.map(m => `• <@${m.id}>`).join('\n') || 'Никого нет в отпуске.'}`, ephemeral: true });
    }
    if (interaction.customId === 'ap_afk_stats') {
      const afkCh = interaction.guild.channels.cache.get(config.CHANNELS.AFK_VOICE);
      const inAfk = afkCh ? afkCh.members.filter(m => !m.user.bot) : null;
      return interaction.reply({ content: `💤 **В АФК-войсе сейчас (${inAfk ? inAfk.size : 0}):**\n${inAfk && inAfk.size > 0 ? inAfk.map(m => `• <@${m.id}>`).join('\n') : 'В АФК-канале пусто.'}`, ephemeral: true });
    }
    if (interaction.customId === 'ap_recruit_stats') {
      const stats = getJson(FILES.STAFF_RATING, {});
      const list = Object.entries(stats).map(([uid, s], i) => `${i + 1}. <@${uid}> — Принято: **${s.accepted || 0}** | Отказов: **${s.declined || 0}** | Tier: **${s.tierChecks || 0}**`).join('\n') || 'Статистика пока пуста.';
      return interaction.reply({ content: `🕵️ **Статистика отдела рекрутинга:**\n${list}`, ephemeral: true });
    }
    if (interaction.customId === 'ap_request_vods') {
      const select = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId('ap_vods_users').setPlaceholder('Выберите игроков (до 10)...').setMinValues(1).setMaxValues(10)
      );
      return interaction.reply({ content: '🎥 Выберите игроков для запроса отката:', components: [select], ephemeral: true });
    }
    if (interaction.customId === 'ap_staff_list') {
      if (interaction.guild.members.cache.size < 5) await interaction.guild.members.fetch().catch(() => {});
      const staffRoles = [
        { name: '11 | Leader', id: config.ROLES.LEADER },
        { name: '10 | Dep Leader', id: config.ROLES.DEP_LEADER },
        { name: '9 | Caller', id: config.ROLES.CALLER },
        { name: '8 | Chief Recruit', id: config.ROLES.CHIEF_RECRUIT },
        { name: '7 | Dep Chief Recruit', id: config.ROLES.DEP_CHIEF_RECRUIT },
        { name: '6 | High', id: config.ROLES.RANK_6_HIGH }
      ].filter(r => r.id);

      const lines = staffRoles.map(r => {
        const members = interaction.guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(r.id));
        const list = members.size > 0 ? members.map(m => `<@${m.id}>`).join(', ') : '*пусто*';
        return `• **${r.name}:** ${list}`;
      });

      return interaction.reply({ content: `👑 **Руководящий состав семьи:**\n\n${lines.join('\n')}`, ephemeral: true });
    }
  }

  // 🛒 РЕДАКТОР МАГАЗИНА, НАГРАД ЗА ЗАДАНИЯ И ВОЙСА
  if (interaction.isButton() && interaction.customId === 'ap_shop') {
    const ecoCfg = settings.PANELS.ECONOMY;
    const v = ecoCfg.voice;
    const itemsText = Object.values(ecoCfg.shopItems).map(it => `• **${it.label}** — \`${it.cost} б.\``).join('\n');
    const actsText = Object.values(ecoCfg.activities).map(ac => `• **${ac.label}** — \`+${ac.points} б.\``).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🛒 Настройка магазина, заданий и войса')
      .setColor('#9B59B6')
      .addFields(
        { name: '🎙 Начисление за голосовой онлайн', value: `**+${v.POINTS_PER_INTERVAL} б.** каждые **${v.CHECK_INTERVAL_MINUTES} мин.**`, inline: false },
        { name: '💎 Награды за задания', value: actsText, inline: false },
        { name: '🛍 Товары в магазине', value: itemsText, inline: false }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_eco_edit_shop').setLabel('🛍 Изменить цены товаров').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ap_eco_edit_acts').setLabel('💎 Изменить баллы за задания').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ap_eco_edit_voice').setLabel('🎙 Настроить войс').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ap_eco_edit_shop') {
    const items = settings.PANELS.ECONOMY.shopItems;
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ap_eco_sel_shop')
        .setPlaceholder('👇 Выберите товар для изменения...')
        .addOptions(Object.entries(items).map(([k, v]) => ({ label: `${v.label} (${v.cost} б.)`, description: (v.description || '').slice(0, 100), value: k })))
    );
    return interaction.reply({ content: '🛍 Выберите товар:', components: [select], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_eco_sel_shop') {
    const key = interaction.values.at(0);
    const item = settings.PANELS.ECONOMY.shopItems[key];
    const modal = new ModalBuilder().setCustomId(`ap_modal_ecoshop_${key}`).setTitle('Редактор товара');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s_label').setLabel('Название товара').setValue(item.label).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s_cost').setLabel('Цена в баллах (число)').setValue(String(item.cost)).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s_desc').setLabel('Описание товара').setValue(item.description || '').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_ecoshop_')) {
    const key = interaction.customId.replace('ap_modal_ecoshop_', '');
    const label = interaction.fields.getTextInputValue('s_label').trim();
    const cost = Math.max(1, parseInt(interaction.fields.getTextInputValue('s_cost').trim(), 10) || 100);
    const description = interaction.fields.getTextInputValue('s_desc').trim();

    const customEco = getJson('economy_custom.json', {});
    if (!customEco.shopItems) customEco.shopItems = {};
    customEco.shopItems[key] = { label, cost, description };
    saveJson('economy_custom.json', customEco);

    await refreshPublishedPanel(interaction.guild, 'SHOP_PANEL');
    return interaction.reply({ content: `✅ Товар **${label}** обновлён (цена: **${cost} б.**), панель магазина в канале перерисована!`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ap_eco_edit_acts') {
    const acts = settings.PANELS.ECONOMY.activities;
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ap_eco_sel_act')
        .setPlaceholder('👇 Выберите задание...')
        .addOptions(Object.entries(acts).map(([k, v]) => ({ label: `${v.label} (+${v.points} б.)`, description: (v.desc || '').slice(0, 100), value: k })))
    );
       return interaction.reply({ content: '💎 Выберите активность:', components: [select], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ap_eco_sel_act') {
    const key = interaction.values.at(0);
    const act = settings.PANELS.ECONOMY.activities[key];
    const modal = new ModalBuilder().setCustomId(`ap_modal_ecoact_${key}`).setTitle('Награда за задание');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a_label').setLabel('Название задания').setValue(act.label).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a_pts').setLabel('Сколько баллов давать (число)').setValue(String(act.points)).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a_desc').setLabel('Описание / условие').setValue(act.desc || '').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_ecoact_')) {
    const key = interaction.customId.replace('ap_modal_ecoact_', '');
    const label = interaction.fields.getTextInputValue('a_label').trim();
    const points = Math.max(1, parseInt(interaction.fields.getTextInputValue('a_pts').trim(), 10) || 10);
    const desc = interaction.fields.getTextInputValue('a_desc').trim();

    const customEco = getJson('economy_custom.json', {});
    if (!customEco.activities) customEco.activities = {};
    customEco.activities[key] = { label, points, desc };
    saveJson('economy_custom.json', customEco);

    await refreshPublishedPanel(interaction.guild, 'POINTS_PANEL');
    return interaction.reply({ content: `✅ Задание **${label}** обновлено (**+${points} б.**), панель баллов в канале перерисована!`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ap_eco_edit_voice') {
    const v = settings.PANELS.ECONOMY.voice;
    const modal = new ModalBuilder().setCustomId('ap_modal_ecovoice').setTitle('Настройка баллов за войс');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_mins').setLabel('Интервал в минутах (например: 20)').setValue(String(v.CHECK_INTERVAL_MINUTES)).setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_pts').setLabel('Сколько баллов за интервал (например: 5)').setValue(String(v.POINTS_PER_INTERVAL)).setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ap_modal_ecovoice') {
    const mins = Math.max(1, parseInt(interaction.fields.getTextInputValue('v_mins').trim(), 10) || 20);
    const pts = Math.max(1, parseInt(interaction.fields.getTextInputValue('v_pts').trim(), 10) || 5);

    const customEco = getJson('economy_custom.json', {});
    customEco.voice = { CHECK_INTERVAL_MINUTES: mins, POINTS_PER_INTERVAL: pts, IGNORE_DEAFENED: true };
    saveJson('economy_custom.json', customEco);

    const { startVoicePointsTracker } = require('./economy');
    startVoicePointsTracker(client);
    await refreshPublishedPanel(interaction.guild, 'POINTS_PANEL');

    return interaction.reply({ content: `✅ Настройки войса обновлены: **+${pts} б.** каждые **${mins} мин.** (таймер перезапущен, панель обновлена)!`, ephemeral: true });
  }

  if (interaction.isUserSelectMenu() && interaction.customId === 'ap_vods_users') {
    const ids = interaction.values;
    const modal = new ModalBuilder().setCustomId(`ap_modal_vods_${ids.join('-')}`).setTitle('Массовый запрос откатов');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vod_mp').setLabel('С какого МП нужен откат?').setPlaceholder('Капт / ВЗ / MCL').setStyle(TextInputStyle.Short).setRequired(true)));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ap_modal_vods_')) {
    const ids = interaction.customId.replace('ap_modal_vods_', '').split('-');
    const mp = interaction.fields.getTextInputValue('vod_mp').trim();
    let ok = 0;
    for (const uid of ids) {
      const u = await client.users.fetch(uid).catch(() => null);
      if (u) {
        const sent = await u.send(`🎥 **Запрос отката от руководства ${interaction.guild.name}!**\nСрочно загрузите откат с мероприятия: **${mp}** в свой личный портфель.`).then(() => true).catch(() => false);
        if (sent) ok++;
      }
    }
    return interaction.reply({ content: `✅ Запрос отката отправлен в ЛС **${ok} из ${ids.length}** игрокам.`, ephemeral: true });
  }
}

module.exports = { adminCommand, handleAdmin, buildAdminPanelEmbed, buildAdminPanelRows };
