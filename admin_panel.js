const fs = require('fs');
const path = require('path');
const config = require('./config');
const settings = require('./settings');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const FILES = {
  ECONOMY: path.join(__dirname, 'economy_data.json'),
  WARNS: path.join(__dirname, 'warns_data.json'),
  ADMIN: path.join(__dirname, 'admin_data.json'),
  GIVEAWAYS: path.join(__dirname, 'giveaways_data.json'),
  STAFF_RATING: path.join(__dirname, 'staff_rating.json'),
  CUSTOM_PANELS: path.join(__dirname, 'panels_custom.json')
};

const vodRequestsCache = new Map();

// Список всех панелей, доступных для редактирования через админ-панель
const EDITABLE_PANELS = {
  ADMIN_PANEL: { name: '🛠 Админ-панель (/админ_панель)', getCfg: () => settings.PANELS.ADMIN_PANEL },
  RECRUIT: { name: '👋 Рекрутинг (/панель_рекрутинга)', getCfg: () => settings.PANELS.RECRUIT },
  PROMO: { name: '📈 Повышение (/панель_повышения)', getCfg: () => settings.PANELS.PROMO },
  PORTFOLIO: { name: '💼 Портфель (/панель_портфеля)', getCfg: () => settings.PANELS.PORTFOLIO },
  AFK: { name: '💤 АФК и Отпуск (/панель_афк)', getCfg: () => settings.PANELS.AFK },
  EVENTS: { name: '⚔️ Сборы на МП (/панель_сборов)', getCfg: () => settings.PANELS.EVENTS },
  TIER: { name: '🎯 Tier-проверка (/панель_тира)', getCfg: () => settings.PANELS.TIER },
  STAFF_APPS: { name: '👔 Заявки на должности (/панель_должностей)', getCfg: () => settings.PANELS.STAFF_APPS },
  POINTS_PANEL: { name: '💎 Заработок баллов (/панель_баллов)', getCfg: () => settings.PANELS.ECONOMY.POINTS_PANEL },
  SHOP_PANEL: { name: '🛍 Магазин наград (/панель_магазина)', getCfg: () => settings.PANELS.ECONOMY.SHOP_PANEL },
  PAYOUT_PANEL: { name: '💸 Выплаты (/панель_выплат)', getCfg: () => settings.PANELS.ECONOMY.PAYOUT_PANEL },
  FEEDBACK: { name: '💬 Идеи и вопросы (/панель_связи)', getCfg: () => settings.PANELS.FEEDBACK },
  SKUPKA_PANEL: { name: '🔫 Скупка оружия (/панель_скупки)', getCfg: () => settings.PANELS.EXTRA.SKUPKA_PANEL },
  CONTRACTS_PANEL: { name: '📦 Контракты (/панель_контрактов)', getCfg: () => settings.PANELS.EXTRA.CONTRACTS_PANEL },
  GIVEAWAY_PANEL: { name: '🎉 Розыгрыши (/панель_розыгрышей)', getCfg: () => settings.PANELS.EXTRA.GIVEAWAY_PANEL },
  WARNS_INFO: { name: '⚠️ Инфо о выговорах (/панель_информация)', getCfg: () => settings.PANELS.WARNS.INFO_PANEL }
};

function loadJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function hasAdminAccess(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (Array.isArray(config.OWNER_IDS) && config.OWNER_IDS.includes(member.id)) return true;

  const allowed = [
    config.ROLES.HIGH_STAFF,
    config.ROLES.CHIEF,
    config.ROLES.DEP_CHIEF,
    config.ROLES.ASSISTANT,
    config.ROLES.CHIEF_RECRUIT,
    config.ROLES.DEP_CHIEF_RECRUIT
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
    config.ROLES.DEP_CHIEF,
    config.ROLES.CHIEF,
    config.ROLES.CALLER,
    config.ROLES.ASSISTANT
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
    new ButtonBuilder().setCustomId('ap_activity').setLabel('📊 Активность').setStyle(ButtonStyle.Primary),
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
    new ButtonBuilder().setCustomId('ap_shop').setLabel('🛒 Магазин').setStyle(ButtonStyle.Secondary)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_recruit_ctl').setLabel('📋 Набор в семью').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_recruit_stats').setLabel('🕵️ Актив рекрутов').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_staff_list').setLabel('👑 Состав стаффа').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_giveaway').setLabel('🎉 Розыгрыш').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ap_backup').setLabel('💾 Бэкап баз').setStyle(ButtonStyle.Secondary)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ap_edit_panel').setLabel('🎨 Оформление и текст панелей').setStyle(ButtonStyle.Primary)
  );

  return [row1, row2, row3, row4, row5];
}

async function syncWarnRoles(member, count) {
  if (!member) return;
  const w1 = config.ROLES.WARN_1;
  const w2 = config.ROLES.WARN_2;
  const w3 = config.ROLES.WARN_3;

  try {
    if (count <= 0) {
      if (w1) await member.roles.remove(w1).catch(() => {});
      if (w2) await member.roles.remove(w2).catch(() => {});
      if (w3) await member.roles.remove(w3).catch(() => {});
    } else if (count === 1) {
      if (w2) await member.roles.remove(w2).catch(() => {});
      if (w3) await member.roles.remove(w3).catch(() => {});
      if (w1) await member.roles.add(w1).catch(() => {});
    } else if (count === 2) {
      if (w1) await member.roles.remove(w1).catch(() => {});
      if (w3) await member.roles.remove(w3).catch(() => {});
      if (w2) await member.roles.add(w2).catch(() => {});
    } else if (count >= 3) {
      if (w1) await member.roles.remove(w1).catch(() => {});
      if (w2) await member.roles.remove(w2).catch(() => {});
      if (w3) await member.roles.add(w3).catch(() => {});
    }
  } catch (err) {
    console.error('Ошибка синхронизации ролей выговоров:', err);
  }
}

async function sendAdminLog(guild, title, description, color = '#5865F2') {
  if (!guild || !config.CHANNELS.ADMIN_LOGS) return;
  const ch = await guild.channels.fetch(config.CHANNELS.ADMIN_LOGS).catch(() => null);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

const adminCommand = new SlashCommandBuilder()
  .setName('админ_панель')
  .setDescription('Отправить панель управления для доверенных членов семьи')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleAdmin(interaction, client) {
  const isPanelAction =
    (interaction.isChatInputCommand() && interaction.commandName === 'админ_панель') ||
    ((interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) &&
      interaction.customId.startsWith('ap_'));

  if (!isPanelAction) return false;

  // Участие в розыгрыше доступно всем
  if (interaction.isButton() && interaction.customId === 'ap_gw_join') {
    const giveaways = loadJson(FILES.GIVEAWAYS, {});
    const gw = giveaways[interaction.message.id];

    if (!gw || gw.ended) {
      return interaction.reply({ content: '⚠️ Этот розыгрыш уже завершён.', ephemeral: true });
    }

    if (gw.participants.includes(interaction.user.id)) {
      return interaction.reply({ content: '✅ Вы уже участвуете в этом розыгрыше!', ephemeral: true });
    }

    gw.participants.push(interaction.user.id);
    saveJson(FILES.GIVEAWAYS, giveaways);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ap_gw_join')
        .setLabel(`🎉 Участвовать (${gw.participants.length})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ap_gw_end')
        .setLabel('🏆 Завершить и выбрать победителя')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ components: [row] });
    return true;
  }

  if (!hasAdminAccess(interaction.member)) {
    return interaction.reply({
      content: '❌ У вас нет доступа к панели управления семьёй!',
      ephemeral: true
    });
  }

    // 1. ОТПРАВКА ПАНЕЛИ (/админ_панель)
  if (interaction.isChatInputCommand() && interaction.commandName === 'админ_панель') {
    const embed = buildAdminPanelEmbed(interaction.guild);
    const rows = buildAdminPanelRows();

    const sentMsg = await interaction.channel.send({
      embeds: [embed],
      components: rows
    });

    const customPanels = loadJson(FILES.CUSTOM_PANELS, {});
    if (!customPanels.ADMIN_PANEL) customPanels.ADMIN_PANEL = {};
    customPanels.ADMIN_PANEL.channelId = interaction.channel.id;
    customPanels.ADMIN_PANEL.messageId = sentMsg.id;
    saveJson(FILES.CUSTOM_PANELS, customPanels);

    return interaction.reply({ content: '✅ Панель управления семьёй успешно опубликована!', ephemeral: true });
  }

  // 2. ОБРАБОТКА КНОПОК
  if (interaction.isButton()) {
    const id = interaction.customId;

    // 🎨 Выбор панели для редактирования текста и картинки
    if (id === 'ap_edit_panel') {
      const options = Object.entries(EDITABLE_PANELS).map(([key, info]) => ({
        label: info.name.slice(0, 100),
        description: 'Изменить заголовок, текст, цвет и картинку',
        value: key
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`ap_select_edit_panel_${interaction.message.id}`)
        .setPlaceholder('👇 Выберите панель, которую хотите изменить...')
        .addOptions(options);

      return interaction.reply({
        content: '🎨 **Редактор панелей:** выберите нужную панель из списка ниже.\n*Примечание: чтобы бот сам обновил уже отправленную панель в канале, укажите ссылку на её сообщение (или ID сообщения) в форме, если она была создана до этого обновления.*',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // 👤 Управление игроком
    if (id === 'ap_manage_user') {
      const select = new UserSelectMenuBuilder()
        .setCustomId('ap_select_manage_user')
        .setPlaceholder('👇 Выберите участника для управления...');

      return interaction.reply({
        content: '👤 **Управление составом:** выберите участника из списка:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // Повышение / понижение ранга на 1 ступень
    if (id.startsWith('ap_u_rankup_') || id.startsWith('ap_u_rankdown_')) {
      const isUp = id.startsWith('ap_u_rankup_');
      const targetId = id.split('_').at(3);

      const member = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Участник не найден.', ephemeral: true });

      const orderedRanks = [
        { name: '1 | Test', id: config.ROLES.RANK_1 },
        { name: '2 | Begov', id: config.ROLES.RANK_2_BEGOV },
        { name: '3 | Main', id: config.ROLES.RANK_3_MAIN },
        { name: '4 | Main+', id: config.ROLES.RANK_4_MAIN_PLUS },
        { name: '5 | Recruit', id: config.ROLES.RECRUIT },
        { name: '6 | High', id: config.ROLES.RANK_6_HIGH },
        { name: '7 | Dep Chief', id: config.ROLES.DEP_CHIEF },
        { name: '8 | Chief', id: config.ROLES.CHIEF },
        { name: '9 | Caller', id: config.ROLES.CALLER },
        { name: '10 | Assistant', id: config.ROLES.ASSISTANT }
      ].filter(r => r.id);

      const currentIndex = orderedRanks.findIndex(r => member.roles.cache.has(r.id));
      let nextIndex = isUp ? currentIndex + 1 : currentIndex - 1;

      if (currentIndex === -1) nextIndex = 0;
      if (nextIndex < 0 || nextIndex >= orderedRanks.length) {
        return interaction.reply({ content: '⚠️ Достигнут крайний ранг в линейке (1–10).', ephemeral: true });
      }

      const oldRank = currentIndex !== -1 ? orderedRanks[currentIndex] : null;
      const newRank = orderedRanks[nextIndex];

      if (oldRank) await member.roles.remove(oldRank.id).catch(() => {});
      await member.roles.add(newRank.id).catch(() => {});

      await sendAdminLog(
        interaction.guild,
        isUp ? '📈 Повышение ранга (Админ-панель)' : '📉 Понижение ранга (Админ-панель)',
        `**Участник:** <@${targetId}>\n**Ранг:** ${oldRank ? oldRank.name : 'Нет'} ➔ **${newRank.name}**\n**Модератор:** <@${interaction.user.id}>`,
        isUp ? '#2ECC71' : '#E67E22'
      );

      return interaction.reply({
        content: `✅ Ранг <@${targetId}> изменён: **${oldRank ? oldRank.name : 'Без ранга'} ➔ ${newRank.name}**!`,
        ephemeral: true
      });
    }

    // Циклическое переключение Tier
    if (id.startsWith('ap_u_tier_')) {
      const targetId = id.replace('ap_u_tier_', '');
      const member = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Участник не найден.', ephemeral: true });

      const allTiers = [config.ROLES.TIER_1, config.ROLES.TIER_2, config.ROLES.TIER_3].filter(Boolean);
      let nextRole = null;
      let nextLabel = 'Снят (Без Tier)';

      if (member.roles.cache.has(config.ROLES.TIER_3)) {
        nextRole = config.ROLES.TIER_2;
        nextLabel = 'Tier 2';
      } else if (member.roles.cache.has(config.ROLES.TIER_2)) {
        nextRole = config.ROLES.TIER_1;
        nextLabel = 'Tier 1';
      } else if (member.roles.cache.has(config.ROLES.TIER_1)) {
        nextRole = null;
        nextLabel = 'Снят (Без Tier)';
      } else {
        nextRole = config.ROLES.TIER_3;
        nextLabel = 'Tier 3';
      }

      await member.roles.remove(allTiers).catch(() => {});
      if (nextRole) await member.roles.add(nextRole).catch(() => {});

      await sendAdminLog(
        interaction.guild,
        '🎯 Изменение Tier участника',
        `**Участник:** <@${targetId}>\n**Новый Tier:** **${nextLabel}**\n**Модератор:** <@${interaction.user.id}>`,
        '#9B59B6'
      );

      return interaction.reply({
        content: `🎯 Для <@${targetId}> установлен статус: **${nextLabel}**.`,
        ephemeral: true
      });
    }

    // Смена ника игроку
    if (id.startsWith('ap_u_nick_')) {
      const targetId = id.replace('ap_u_nick_', '');
      const modal = new ModalBuilder()
        .setCustomId(`ap_modal_unick_${targetId}`)
        .setTitle('Смена ника участнику');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('new_nick')
            .setLabel('Новый ник по форме (Имя_Фамилия | #Статик)')
            .setPlaceholder('Например: Ivan_Begov | #12345')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    // 📊 Активность участников
    if (id === 'ap_activity') {
      const ecoData = loadJson(FILES.ECONOMY);
      const sorted = Object.entries(ecoData)
        .map(([uid, stats]) => ({
          uid,
          points: stats?.points || 0,
          voiceMinutes: stats?.voiceMinutes || 0
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 15);

      const list = sorted.length > 0
        ? sorted.map((u, i) => {
            const hrs = Math.floor(u.voiceMinutes / 60);
            const mins = u.voiceMinutes % 60;
            return `**${i + 1}.** <@${u.uid}> — **${u.points}** баллов *(войс: ${hrs} ч. ${mins} мин.)*`;
          }).join('\n')
        : '*Данные об активности и баллах пока отсутствуют.*';

      const embed = new EmbedBuilder()
        .setTitle('📊 Рейтинг активности и баллов участников')
        .setDescription(list)
        .setColor('#3498DB');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 🔍 Аудит ролей и ников
    if (id === 'ap_audit') {
      await interaction.guild.members.fetch().catch(() => {});
      const rankIds = getAllRankRoleIds();
      const famMembers = interaction.guild.members.cache.filter(
        m => !m.user.bot && (!config.ROLES.FAMQ || m.roles.cache.has(config.ROLES.FAMQ))
      );

      const noRank = [];
      const badNick = [];

      famMembers.forEach(m => {
        if (rankIds.length > 0 && !rankIds.some(rId => m.roles.cache.has(rId))) {
          noRank.push(`<@${m.id}>`);
        }
        if (!/^[A-Za-zА-Яа-яЁё]+[\s_][A-Za-zА-Яа-яЁё]+\s*\|\s*#?\d+/.test(m.displayName)) {
          badNick.push(`<@${m.id}> (\`${m.displayName}\`)`);
        }
      });

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Аудит состава семьи (${famMembers.size} чел.)`)
        .addFields(
          {
            name: `⚠️ Без роли ранга (${noRank.length})`,
            value: noRank.length > 0 ? noRank.slice(0, 20).join(', ') : '✅ У всех есть ранг',
            inline: false
          },
          {
            name: `✏️ Ник не по форме Имя_Фамилия | #Статик (${badNick.length})`,
            value: badNick.length > 0 ? badNick.slice(0, 15).join('\n') : '✅ Все ники соответствуют форме',
            inline: false
          }
        )
        .setColor('#F39C12');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

        // 💼 Контроль личных портфелей
    if (id === 'ap_portfolios') {
      await interaction.guild.members.fetch().catch(() => {});
      const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
      if (!catId) {
        return interaction.reply({ content: '❌ Категория портфелей не указана в `config.js` (`PORTFOLIO_CATEGORY`).', ephemeral: true });
      }

      const portfolioChannels = interaction.guild.channels.cache.filter(ch => ch.parentId === catId);
      const ownerIdsWithChannel = new Set();
      const orphanChannels = [];

      portfolioChannels.forEach(ch => {
        const match = ch.topic?.match(/Owner ID:\s*(\d+)/);
        if (match && match[1]) {
          const ownerId = match[1];
          ownerIdsWithChannel.add(ownerId);
          if (!interaction.guild.members.cache.has(ownerId)) {
            orphanChannels.push(`${ch} (владелец \`${ownerId}\` вышел)`);
          }
        }
      });

      const famMembers = interaction.guild.members.cache.filter(
        m => !m.user.bot && (!config.ROLES.FAMQ || m.roles.cache.has(config.ROLES.FAMQ))
      );

      const withoutPortfolio = [];
      famMembers.forEach(m => {
        if (!ownerIdsWithChannel.has(m.id)) {
          withoutPortfolio.push(`<@${m.id}>`);
        }
      });

      const embed = new EmbedBuilder()
        .setTitle(`💼 Контроль личных портфелей (Всего каналов: ${portfolioChannels.size})`)
        .addFields(
          {
            name: `⚠️ Участники без портфеля (${withoutPortfolio.length})`,
            value: withoutPortfolio.length > 0 ? withoutPortfolio.slice(0, 25).join(', ') : '✅ У всех участников создан портфель',
            inline: false
          },
          {
            name: `🗑 Портфели вышедших игроков (${orphanChannels.length})`,
            value: orphanChannels.length > 0 ? orphanChannels.slice(0, 15).join('\n') : '✅ Лишних каналов не найдено',
            inline: false
          }
        )
        .setColor('#9B59B6');

      const components = [];
      if (orphanChannels.length > 0) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ap_portfolios_clean')
              .setLabel(`🗑 Удалить портфели вышедших (${orphanChannels.length})`)
              .setStyle(ButtonStyle.Danger)
          )
        );
      }

      return interaction.reply({ embeds: [embed], components, ephemeral: true });
    }

    if (id === 'ap_portfolios_clean') {
      await interaction.guild.members.fetch().catch(() => {});
      const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
      const portfolioChannels = interaction.guild.channels.cache.filter(ch => ch.parentId === catId);

      let deletedCount = 0;
      for (const ch of portfolioChannels.values()) {
        const match = ch.topic?.match(/Owner ID:\s*(\d+)/);
        if (match && match[1] && !interaction.guild.members.cache.has(match[1])) {
          await ch.delete('Очистка портфеля вышедшего участника').catch(() => {});
          deletedCount++;
        }
      }

      await sendAdminLog(
        interaction.guild,
        '🗑 Очистка заброшенных портфелей',
        `**Удалено каналов:** ${deletedCount} шт.\n**Модератор:** <@${interaction.user.id}>`,
        '#E74C3C'
      );

      return interaction.update({
        content: `✅ Удалено портфелей вышедших участников: **${deletedCount} шт.**`,
        embeds: [],
        components: []
      });
    }

    // ⛔ Чёрный список (ЧС)
    if (id === 'ap_blacklist') {
      const adminData = loadJson(FILES.ADMIN, { blacklist: [] });
      const list = Array.isArray(adminData.blacklist) ? adminData.blacklist : [];

      const text = list.length > 0
        ? list.slice(0, 20).map((b, i) => `**${i + 1}.** \`${b.userId}\` — *${b.reason}* (добавил: ${b.by})`).join('\n')
        : '*Чёрный список семьи пуст.*';

      const embed = new EmbedBuilder()
        .setTitle(`⛔ Чёрный список семьи (${list.length})`)
        .setDescription(text)
        .setColor('#E74C3C');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ap_bl_add').setLabel('➕ Добавить в ЧС').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ap_bl_rem').setLabel('➖ Убрать из ЧС').setStyle(ButtonStyle.Success)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (id === 'ap_bl_add' || id === 'ap_bl_rem') {
      const isAdd = id === 'ap_bl_add';
      const modal = new ModalBuilder()
        .setCustomId(isAdd ? 'ap_modal_bl_add' : 'ap_modal_bl_rem')
        .setTitle(isAdd ? 'Внести в ЧС семьи' : 'Удалить из ЧС семьи');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('bl_id')
            .setLabel('Discord ID или игровой Статик')
            .setPlaceholder('Например: 862369839124447273')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      if (isAdd) {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('bl_reason')
              .setLabel('Причина занесения в ЧС')
              .setPlaceholder('Слив склада / неадекватное поведение')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      }

      return interaction.showModal(modal);
    }

    // ⚠️ Выговор
    if (id === 'ap_warns') {
      const select = new UserSelectMenuBuilder()
        .setCustomId('ap_select_warn')
        .setPlaceholder('👇 Выберите участника для выдачи/снятия выговора...');

      return interaction.reply({
        content: 'Выберите участника из списка:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // 🎥 Запрос откатов у группы игроков
    if (id === 'ap_request_vods') {
      const select = new UserSelectMenuBuilder()
        .setCustomId('ap_select_vods')
        .setPlaceholder('👇 Выберите игроков (от 1 до 10 чел.)...')
        .setMinValues(1)
        .setMaxValues(10);

      return interaction.reply({
        content: '🎥 Выберите игроков, у которых нужно запросить откат в ЛС:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // 🛡 Модерация чата
    if (id === 'ap_mod') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ap_mod_clear20').setLabel('🧹 Очистить 20').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ap_mod_clear50').setLabel('🧹 Очистить 50').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ap_mod_lock').setLabel('🔒 Закрыть канал').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ap_mod_unlock').setLabel('🔓 Открыть канал').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ap_mod_ann').setLabel('📢 Объявление').setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content: '🛡 **Инструменты модерации текущего канала:**',
        components: [row],
        ephemeral: true
      });
    }

    if (id === 'ap_mod_clear20' || id === 'ap_mod_clear50') {
      const count = id === 'ap_mod_clear50' ? 50 : 20;
      const deleted = await interaction.channel.bulkDelete(count, true).catch(() => null);
      return interaction.update({
        content: `🧹 Удалено сообщений: **${deleted ? deleted.size : 0} шт.**`,
        components: []
      });
    }

    if (id === 'ap_mod_lock' || id === 'ap_mod_unlock') {
      const isLock = id === 'ap_mod_lock';
      const targetRole = config.ROLES.FAMQ || interaction.guild.roles.everyone.id;
      await interaction.channel.permissionOverwrites.edit(targetRole, { SendMessages: !isLock }).catch(() => {});

      return interaction.update({
        content: isLock ? '🔒 Канал закрыт для отправки сообщений.' : '🔓 Канал снова открыт для общения.',
        components: []
      });
    }

    if (id === 'ap_mod_ann') {
      const modal = new ModalBuilder()
        .setCustomId('ap_modal_ann')
        .setTitle('Новое объявление в канал');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ann_title')
            .setLabel('Заголовок объявления')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ann_text')
            .setLabel('Текст объявления')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ann_ping')
            .setLabel('Тегнуть роль семьи? (да / нет)')
            .setValue('нет')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }

    // 💵 Добавить / 📉 Снять баллы
    if (id === 'ap_add_points' || id === 'ap_rem_points') {
      const isAdd = id === 'ap_add_points';
      const select = new UserSelectMenuBuilder()
        .setCustomId(isAdd ? 'ap_select_pts_add' : 'ap_select_pts_rem')
        .setPlaceholder(isAdd ? '👇 Кому начислить баллы?' : '👇 У кого снять баллы?');

      return interaction.reply({
        content: 'Выберите участника из списка:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

       // 📅 Отпуск участников
    if (id === 'ap_vacations') {
      await interaction.guild.members.fetch().catch(() => {});
      const vacMembers = interaction.guild.members.cache.filter(m => m.roles.cache.has(config.ROLES.VACATION));

      const desc = vacMembers.size > 0
        ? vacMembers.map(m => `• <@${m.id}> (\`${m.displayName}\`)`).join('\n')
        : '*Сейчас никто из участников не находится в отпуске.*';

      const embed = new EmbedBuilder()
        .setTitle(`📅 Участники в отпуске (${vacMembers.size})`)
        .setDescription(desc)
        .setColor('#F39C12');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 💤 Статистика АФК
    if (id === 'ap_afk_stats') {
      const afkVoice = config.CHANNELS.AFK_VOICE ? interaction.guild.channels.cache.get(config.CHANNELS.AFK_VOICE) : null;
      const inAfkVoice = afkVoice ? afkVoice.members.filter(m => !m.user.bot) : null;

      const voiceList = inAfkVoice && inAfkVoice.size > 0
        ? inAfkVoice.map(m => `• <@${m.id}> (\`${m.displayName}\`)`).join('\n')
        : '*В голосовом АФК-канале сейчас никого нет.*';

      const embed = new EmbedBuilder()
        .setTitle('💤 Статистика АФК участников')
        .setDescription(`**Сейчас в АФК-войсе:**\n${voiceList}\n\n📑 Журнал отметок АФК и отпусков: <#${config.CHANNELS.AFK_LOGS}>`)
        .setColor('#95A5A6');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 🛒 Управление магазином
    if (id === 'ap_shop') {
      const items = settings.PANELS.ECONOMY?.shopItems || {};
      const desc = Object.entries(items)
        .map(([key, item]) => `• **${item.label}** (\`${key}\`) — **${item.cost} баллов**\n  *${item.description}*`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('🛒 Текущие товары семейного магазина')
        .setDescription(desc || '*Товары не настроены в settings.js*')
        .setFooter({ text: 'Цены и ассортимент настраиваются в settings.js -> ECONOMY.shopItems' })
        .setColor('#9B59B6');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 📋 Управление набором в семью
    if (id === 'ap_recruit_ctl') {
      const adminData = loadJson(FILES.ADMIN, { recruitOpen: true });

      const embed = new EmbedBuilder()
        .setTitle('📋 Статус набора в семью')
        .setDescription(`**Текущий статус заявок:** ${adminData.recruitOpen !== false ? '🟢 Открыт' : '🔴 Закрыт'}`)
        .setColor(adminData.recruitOpen !== false ? '#2ECC71' : '#E74C3C');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ap_toggle_recruit')
          .setLabel(adminData.recruitOpen !== false ? '🔴 Закрыть набор' : '🟢 Открыть набор')
          .setStyle(adminData.recruitOpen !== false ? ButtonStyle.Danger : ButtonStyle.Success)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (id === 'ap_toggle_recruit') {
      const adminData = loadJson(FILES.ADMIN, { recruitOpen: true });
      adminData.recruitOpen = adminData.recruitOpen === false;
      saveJson(FILES.ADMIN, adminData);

      await sendAdminLog(
        interaction.guild,
        '📋 Изменён статус набора',
        `**Новый статус:** ${adminData.recruitOpen ? '🟢 Открыт' : '🔴 Закрыт'}\n**Изменил:** <@${interaction.user.id}>`,
        adminData.recruitOpen ? '#2ECC71' : '#E74C3C'
      );

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Статус набора обновлён')
            .setDescription(`**Текущий статус заявок:** ${adminData.recruitOpen ? '🟢 Открыт' : '🔴 Закрыт'}`)
            .setColor(adminData.recruitOpen ? '#2ECC71' : '#E74C3C')
        ],
        components: []
      });
    }

    // 🕵️ Актив рекрутов
    if (id === 'ap_recruit_stats') {
      const rating = loadJson(FILES.STAFF_RATING, {});
      const entries = Object.entries(rating)
        .map(([uid, st]) => ({
          uid,
          accepted: st?.accepted || 0,
          declined: st?.declined || 0,
          gathers: st?.gathers || 0
        }))
        .sort((a, b) => (b.accepted + b.declined) - (a.accepted + a.declined))
        .slice(0, 15);

      const text = entries.length > 0
        ? entries.map((r, i) =>
            `**${i + 1}.** <@${r.uid}> — Принято: **${r.accepted}** | Отклонено: **${r.declined}** | Сборы: **${r.gathers}**`
          ).join('\n')
        : '*Статистика работы отдела рекрутов пока пуста.*';

      const embed = new EmbedBuilder()
        .setTitle('🕵️ Статистика и активность отдела Recruit')
        .setDescription(text)
        .setColor('#1ABC9C');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 👑 Состав стаффа
    if (id === 'ap_staff_list') {
      await interaction.guild.members.fetch().catch(() => {});

      const getRoleMembers = (roleId) => {
        if (!roleId) return 'Не настроено';
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role || role.members.size === 0) return '*Никого нет*';
        return role.members.map(m => `<@${m.id}>`).join(', ');
      };

      const embed = new EmbedBuilder()
        .setTitle('👑 Руководство и должностной состав семьи')
        .addFields(
          { name: '💠 Assistant (10)', value: getRoleMembers(config.ROLES.ASSISTANT), inline: false },
          { name: '⚜️ Chief (8)', value: getRoleMembers(config.ROLES.CHIEF), inline: false },
          { name: '🔰 Dep Chief (7)', value: getRoleMembers(config.ROLES.DEP_CHIEF), inline: false },
          { name: '🛡 High Staff (6)', value: getRoleMembers(config.ROLES.RANK_6_HIGH), inline: false },
          { name: '🕵️ Recruit (5 | Проверяющие)', value: getRoleMembers(config.ROLES.RECRUIT), inline: false },
          { name: '📣 Caller / Coach', value: `${getRoleMembers(config.ROLES.CALLER)} | ${getRoleMembers(config.ROLES.COACH)}`, inline: false }
        )
        .setColor('#F1C40F');

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 🎉 Запуск интерактивного розыгрыша
    if (id === 'ap_giveaway') {
      const modal = new ModalBuilder()
        .setCustomId('ap_modal_giveaway')
        .setTitle('Запуск розыгрыша');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gw_prize')
            .setLabel('Приз розыгрыша')
            .setPlaceholder('Например: 500.000$ или Тяжёлая снайперка')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gw_winners')
            .setLabel('Количество победителей (число)')
            .setValue('1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    // 🏆 Завершение розыгрыша
    if (id === 'ap_gw_end') {
      const giveaways = loadJson(FILES.GIVEAWAYS, {});
      const gw = giveaways[interaction.message.id];

      if (!gw || gw.ended) {
        return interaction.reply({ content: '⚠️ Розыгрыш не найден или уже завершён.', ephemeral: true });
      }

      if (gw.participants.length === 0) {
        return interaction.reply({ content: '❌ В розыгрыше никто не принял участие.', ephemeral: true });
      }

      const shuffled = [...gw.participants].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, gw.winnersCount);
      gw.ended = true;
      saveJson(FILES.GIVEAWAYS, giveaways);

      const winnersMentions = winners.map(uid => `<@${uid}>`).join(', ');
      const endEmbed = new EmbedBuilder()
        .setTitle('🏆 ИТОГИ СЕМЕЙНОГО РОЗЫГРЫША!')
        .setDescription(
          `**Приз:** ${gw.prize}\n` +
          `**Всего участников:** ${gw.participants.length}\n` +
          `**Победитель(и):** ${winnersMentions}`
        )
        .setColor('#2ECC71')
        .setTimestamp();

      await interaction.update({
        content: `🎉 Поздравляем победителей: ${winnersMentions}!`,
        embeds: [endEmbed],
        components: []
      });

      await sendAdminLog(
        interaction.guild,
        '🎉 Завершён розыгрыш',
        `**Приз:** ${gw.prize}\n**Победители:** ${winnersMentions}\n**Завершил:** <@${interaction.user.id}>`,
        '#F1C40F'
      );
      return true;
    }

    // 💾 Бэкап баз данных (JSON)
    if (id === 'ap_backup') {
      const fileNames = [
        'economy_data.json',
        'warns_data.json',
        'staff_rating.json',
        'admin_data.json',
        'rules_data.json',
        'vacation_roles.json',
        'giveaways_data.json',
        'users_profiles.json',
        'panels_custom.json'
      ];

      const existingFiles = fileNames
        .map(f => path.join(__dirname, f))
        .filter(p => fs.existsSync(p));

      if (existingFiles.length === 0) {
        return interaction.reply({ content: '⚠️ Файлы баз данных пока не созданы.', ephemeral: true });
      }

      return interaction.reply({
        content: `💾 **Резервная копия баз данных бота (${existingFiles.length} файлов):**`,
        files: existingFiles,
        ephemeral: true
      });
    }
  }

    // 3. ОБРАБОТКА ВЫБОРА В МЕНЮ (StringSelectMenu и UserSelectMenu)
  if (interaction.isStringSelectMenu()) {
    const id = interaction.customId;

    // Выбор конкретной панели для редактирования
    if (id.startsWith('ap_select_edit_panel_')) {
      const adminMsgId = id.replace('ap_select_edit_panel_', '');
      const panelKey = interaction.values.at(0);
      const panelEntry = EDITABLE_PANELS[panelKey];
      if (!panelEntry) {
        return interaction.reply({ content: '❌ Панель не найдена.', ephemeral: true });
      }

      const defaultCfg = panelEntry.getCfg();
      const customPanels = loadJson(FILES.CUSTOM_PANELS, {});
      const custom = customPanels[panelKey] || {};

      const defaultMsgLink = panelKey === 'ADMIN_PANEL'
        ? `${interaction.channel.id}/${adminMsgId}`
        : (custom.channelId && custom.messageId ? `${custom.channelId}/${custom.messageId}` : '');

      const modal = new ModalBuilder()
        .setCustomId(`ap_modal_edit_panel_${panelKey}`)
        .setTitle(`Редактор: ${panelEntry.name}`.slice(0, 45));

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_title')
            .setLabel('Заголовок панели')
            .setValue((custom.title || defaultCfg.title || '').slice(0, 256))
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_desc')
            .setLabel('Основной текст (описание панели)')
            .setValue((custom.description || defaultCfg.description || '').slice(0, 4000))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_color')
            .setLabel('HEX-цвет полоски (например: #5865F2)')
            .setValue(custom.color || defaultCfg.color || '#2B2D31')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_image')
            .setLabel('Ссылка на картинку / баннер (пусто = убрать)')
            .setPlaceholder('https://imgur.com')
            .setValue(custom.image !== undefined ? custom.image : (defaultCfg.image || ''))
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_msg_link')
            .setLabel('Ссылка на сообщение панели (чтобы обновить)')
            .setPlaceholder('ПКМ по сообщению панели -> Копировать ссылку')
            .setValue(defaultMsgLink)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }
  }

  if (interaction.isUserSelectMenu()) {
    const id = interaction.customId;

    // Массовый запрос откатов
    if (id === 'ap_select_vods') {
      const selectedIds = [...interaction.values];
      const token = `${Date.now().toString(36)}`;
      vodRequestsCache.set(token, selectedIds);

      const modal = new ModalBuilder()
        .setCustomId(`ap_modal_vods_${token}`)
        .setTitle(`Запрос откатов (${selectedIds.length} чел.)`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vod_event')
            .setLabel('С какого мероприятия нужен откат?')
            .setPlaceholder('Например: Капт 19:00 / ВЗ / Поставка')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vod_deadline')
            .setLabel('Срок сдачи и куда загрузить')
            .setValue('В течение 2 часов загрузить ссылку в свой личный портфель.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    const targetId = interaction.values.at(0);

    // Карточка управления игроком
    if (id === 'ap_select_manage_user') {
      const member = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        return interaction.update({ content: '❌ Участник не найден на сервере.', components: [] });
      }

      const ecoData = loadJson(FILES.ECONOMY);
      const warns = loadJson(FILES.WARNS);
      const pts = ecoData[targetId]?.points || 0;
      const warnCount = warns[targetId] || 0;

      const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
      const portfolioCh = catId
        ? interaction.guild.channels.cache.find(ch => ch.parentId === catId && ch.topic?.includes(targetId))
        : null;

      let currentTier = 'Нет';
      if (config.ROLES.TIER_1 && member.roles.cache.has(config.ROLES.TIER_1)) currentTier = 'Tier 1';
      else if (config.ROLES.TIER_2 && member.roles.cache.has(config.ROLES.TIER_2)) currentTier = 'Tier 2';
      else if (config.ROLES.TIER_3 && member.roles.cache.has(config.ROLES.TIER_3)) currentTier = 'Tier 3';

      const embed = new EmbedBuilder()
        .setTitle(`👤 Карточка игрока: ${member.displayName}`)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor('#5865F2')
        .addFields(
          { name: '🆔 Профиль', value: `<@${targetId}> (\`${targetId}\`)`, inline: true },
          { name: '💼 Личный портфель', value: portfolioCh ? `${portfolioCh}` : '⚠️ Не создан', inline: true },
          { name: '🎯 Tier / Баллы / Выг.', value: `**${currentTier}** | **${pts}** б. | **${warnCount}/3**`, inline: true }
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ap_u_rankup_${targetId}`).setLabel('📈 Повысить ранг').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ap_u_rankdown_${targetId}`).setLabel('📉 Понизить ранг').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ap_u_tier_${targetId}`).setLabel('🎯 Сменить Tier').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ap_u_nick_${targetId}`).setLabel('✏️ Сменить ник').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ content: '', embeds: [embed], components: [row1] });
    }

    // Выбор для выговоров
    if (id === 'ap_select_warn') {
      const modal = new ModalBuilder()
        .setCustomId(`ap_modal_warn_${targetId}`)
        .setTitle('Управление выговорами');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('w_action')
            .setLabel('Действие (+1 выдать, -1 снять)')
            .setValue('+1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('w_reason')
            .setLabel('Причина')
            .setPlaceholder('Укажите причину выдачи или снятия')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    // Выбор для начисления/снятия баллов
    if (id === 'ap_select_pts_add' || id === 'ap_select_pts_rem') {
      const isAdd = id === 'ap_select_pts_add';
      const modal = new ModalBuilder()
        .setCustomId(`ap_modal_pts_${isAdd ? 'add' : 'rem'}_${targetId}`)
        .setTitle(isAdd ? 'Начисление баллов' : 'Списание баллов');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('pts_amount')
            .setLabel('Количество баллов (число)')
            .setPlaceholder('Например: 25')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('pts_reason')
            .setLabel('Комментарий')
            .setPlaceholder('За участие в МП / штраф')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
      return interaction.showModal(modal);
    }
  }

  // 4. ОБРАБОТКА МОДАЛЬНЫХ ОКОН
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

        // Сохранение нового оформления и картинки выбранной панели
    if (id.startsWith('ap_modal_edit_panel_')) {
      const panelKey = id.replace('ap_modal_edit_panel_', '');
      const panelEntry = EDITABLE_PANELS[panelKey];
      if (!panelEntry) return interaction.reply({ content: '❌ Ошибка панели.', ephemeral: true });

      const title = interaction.fields.getTextInputValue('panel_title').trim();
      const description = interaction.fields.getTextInputValue('panel_desc');
      const color = settings.resolveColor(interaction.fields.getTextInputValue('panel_color'), '#2B2D31');
      const image = interaction.fields.getTextInputValue('panel_image').trim();
      const msgLinkRaw = interaction.fields.getTextInputValue('panel_msg_link').trim();

      if (image && !/^https?:\/\//i.test(image)) {
        return interaction.reply({
          content: '❌ Ссылка на картинку должна начинаться с `http://` или `https://` (или оставьте поле пустым).',
          ephemeral: true
        });
      }

      const customPanels = loadJson(FILES.CUSTOM_PANELS, {});
      if (!customPanels[panelKey]) customPanels[panelKey] = {};

      customPanels[panelKey].title = title;
      customPanels[panelKey].description = description;
      customPanels[panelKey].color = color;
      customPanels[panelKey].image = image;

      const linkMatch = msgLinkRaw.match(/(\d{17,20})\/(\d{17,20})$/);
      if (linkMatch) {
        customPanels[panelKey].channelId = linkMatch[1];
        customPanels[panelKey].messageId = linkMatch[2];
      }

      saveJson(FILES.CUSTOM_PANELS, customPanels);

      let updatedInChat = false;
      const chId = customPanels[panelKey].channelId;
      const mId = customPanels[panelKey].messageId;

      if (chId && mId) {
        const targetCh = await interaction.guild.channels.fetch(chId).catch(() => null);
        const targetMsg = targetCh ? await targetCh.messages.fetch(mId).catch(() => null) : null;

        if (targetMsg && targetMsg.embeds.length > 0) {
          const oldEmbed = targetMsg.embeds.at(0);
          const newEmbed = EmbedBuilder.from(oldEmbed)
            .setTitle(title)
            .setDescription(description)
            .setColor(color);

          if (image) newEmbed.setImage(image);
          else newEmbed.setImage(null);

          await targetMsg.edit({ embeds: [newEmbed] }).catch(() => {});
          updatedInChat = true;
        }
      }

      return interaction.reply({
        content: updatedInChat
          ? `✅ Настройки панели **${panelEntry.name}** сохранены, а сообщение в канале успешно обновлено!`
          : `✅ Настройки панели **${panelEntry.name}** сохранены! Чтобы обновить существующее сообщение в канале, вставьте ссылку на него в последнее поле формы (или отправьте панель командой заново).`,
        ephemeral: true
      });
    }

    // Отправка запроса откатов в ЛС выбранным игрокам
    if (id.startsWith('ap_modal_vods_')) {
      const token = id.replace('ap_modal_vods_', '');
      const userIds = vodRequestsCache.get(token) || [];
      vodRequestsCache.delete(token);

      const eventName = interaction.fields.getTextInputValue('vod_event').trim();
      const deadline = interaction.fields.getTextInputValue('vod_deadline').trim();

      let sentCount = 0;
      const failedMentions = [];

      for (const uid of userIds) {
        const user = await client.users.fetch(uid).catch(() => null);
        if (!user) continue;

        const dmEmbed = new EmbedBuilder()
          .setTitle('🎥 Запрос видеозаписи (отката)')
          .setColor('#E74C3C')
          .setDescription(
            `Руководство семьи **${interaction.guild.name}** запрашивает у вас откат!\n\n` +
            `📌 **Мероприятие:** ${eventName}\n` +
            `⏳ **Инструкция:** ${deadline}\n` +
            `👮 **Запросил:** <@${interaction.user.id}>`
          )
          .setTimestamp();

        const ok = await user.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false);
        if (ok) sentCount++;
        else failedMentions.push(`<@${uid}>`);
      }

      await sendAdminLog(
        interaction.guild,
        '🎥 Запрос откатов у состава',
        `**Мероприятие:** ${eventName}\n**Получатели:** ${userIds.map(u => `<@${u}>`).join(', ')}\n**Запросил:** <@${interaction.user.id}>`,
        '#E74C3C'
      );

      let replyText = `✅ Уведомление о сдаче отката отправлено в ЛС: **${sentCount} из ${userIds.length} чел.**`;
      if (failedMentions.length > 0) {
        replyText += `\n⚠️ Закрыта личка у: ${failedMentions.join(', ')}`;
      }

      return interaction.reply({ content: replyText, ephemeral: true });
    }

    // Смена ника игроку
    if (id.startsWith('ap_modal_unick_')) {
      const userId = id.replace('ap_modal_unick_', '');
      const newNick = interaction.fields.getTextInputValue('new_nick').trim();
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return interaction.reply({ content: '❌ Участник не найден на сервере.', ephemeral: true });
      }

      const oldNick = member.displayName;
      const ok = await member.setNickname(newNick).catch(() => null);
      if (!ok) {
        return interaction.reply({ content: '❌ Не удалось сменить ник (роль игрока выше роли бота).', ephemeral: true });
      }

      await sendAdminLog(
        interaction.guild,
        '✏️ Смена ника игроку',
        `**Участник:** <@${userId}>\n**Старый ник:** \`${oldNick}\`\n**Новый ник:** \`${newNick}\`\n**Изменил:** <@${interaction.user.id}>`,
        '#5865F2'
      );

      return interaction.reply({
        content: `✅ Ник участника <@${userId}> изменён на \`${newNick}\`.`,
        ephemeral: true
      });
    }

    // Чёрный список: добавление и удаление
    if (id === 'ap_modal_bl_add' || id === 'ap_modal_bl_rem') {
      const isAdd = id === 'ap_modal_bl_add';
      const userId = interaction.fields.getTextInputValue('bl_id').trim();
      const adminData = loadJson(FILES.ADMIN, { recruitOpen: true, blacklist: [], leftMembers: [] });
      if (!Array.isArray(adminData.blacklist)) adminData.blacklist = [];

      if (isAdd) {
        const reason = interaction.fields.getTextInputValue('bl_reason').trim();
        adminData.blacklist.push({ userId, reason, by: interaction.user.username });
        saveJson(FILES.ADMIN, adminData);

        await sendAdminLog(
          interaction.guild,
          '⛔ Занесение в ЧС семьи',
          `**ID / Статик:** \`${userId}\`\n**Причина:** ${reason}\n**Выдал:** <@${interaction.user.id}>`,
          '#E74C3C'
        );

        return interaction.reply({ content: `⛔ \`${userId}\` добавлен в чёрный список семьи.`, ephemeral: true });
      } else {
        adminData.blacklist = adminData.blacklist.filter(x => x.userId !== userId);
        saveJson(FILES.ADMIN, adminData);

        await sendAdminLog(
          interaction.guild,
          '🟢 Удаление из ЧС семьи',
          `**ID / Статик:** \`${userId}\`\n**Снял:** <@${interaction.user.id}>`,
          '#2ECC71'
        );

        return interaction.reply({ content: `✅ \`${userId}\` удалён из чёрного списка семьи.`, ephemeral: true });
      }
    }

    // Объявление от имени бота
    if (id === 'ap_modal_ann') {
      const title = interaction.fields.getTextInputValue('ann_title').trim();
      const text = interaction.fields.getTextInputValue('ann_text').trim();
      const ping = (interaction.fields.getTextInputValue('ann_ping') || '').trim().toLowerCase();

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setColor('#5865F2')
        .setTimestamp();

      const content = ping === 'да' && config.ROLES.FAMQ ? `<@&${config.ROLES.FAMQ}>` : undefined;
      await interaction.channel.send({ content, embeds: [embed] });

      return interaction.reply({ content: '✅ Объявление опубликовано!', ephemeral: true });
    }

    // Выговоры
    if (id.startsWith('ap_modal_warn_')) {
      const userId = id.replace('ap_modal_warn_', '');
      const act = interaction.fields.getTextInputValue('w_action').trim();
      const reason = interaction.fields.getTextInputValue('w_reason');

      const warns = loadJson(FILES.WARNS);
      const current = warns[userId] || 0;
      const delta = act.startsWith('-') ? -1 : 1;
      const updated = Math.max(0, current + delta);

      if (updated === 0) delete warns[userId];
      else warns[userId] = updated;
      saveJson(FILES.WARNS, warns);

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      await syncWarnRoles(member, updated);

      let extraNote = '';
      if (updated >= 3 && member) {
        const familyRoles = [
          config.ROLES.FAMQ,
          ...getAllRankRoleIds()
        ].filter(Boolean);
        await member.roles.remove(familyRoles).catch(() => {});
        extraNote = '\n🚨 **Достигнут лимит 3/3 — семейные роли автоматически сняты.**';
      }

      const targetUser = await client.users.fetch(userId).catch(() => null);
      if (targetUser) {
        await targetUser.send(
          `${delta > 0 ? '⚠️ Вам выдан выговор' : '🟢 С вас снят выговор'} в семье **${interaction.guild.name}**!\n` +
          `**Текущий счётчик:** ${updated}/3\n**Причина:** ${reason}`
        ).catch(() => {});
      }

      await sendAdminLog(
        interaction.guild,
        delta > 0 ? '⚠️ Выдан выговор (Админ-панель)' : '🟢 Снят выговор (Админ-панель)',
        `**Участник:** <@${userId}>\n**Счётчик:** ${current}/3 ➔ **${updated}/3**\n**Причина:** ${reason}\n**Модератор:** <@${interaction.user.id}>${extraNote}`,
        delta > 0 ? '#E74C3C' : '#2ECC71'
      );

      return interaction.reply({
        content: `⚠️ Выговоры <@${userId}> обновлены: **${current}/3 ➔ ${updated}/3**\n**Причина:** ${reason}${extraNote}`,
        ephemeral: true
      });
    }

        // Начисление / снятие баллов
    if (id.startsWith('ap_modal_pts_')) {
      const parts = id.split('_');
      const isAdd = parts.at(3) === 'add';
      const userId = parts.at(4);
      const amount = Math.abs(parseInt(interaction.fields.getTextInputValue('pts_amount'), 10));
      const reason = interaction.fields.getTextInputValue('pts_reason') || 'Без комментария';

      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ content: '❌ Введите корректное положительное число баллов.', ephemeral: true });
      }

      const ecoData = loadJson(FILES.ECONOMY);
      if (!ecoData[userId]) ecoData[userId] = { points: 0, voiceMinutes: 0 };

      const oldVal = ecoData[userId].points || 0;
      const newVal = isAdd ? oldVal + amount : Math.max(0, oldVal - amount);
      ecoData[userId].points = newVal;
      saveJson(FILES.ECONOMY, ecoData);

      const targetUser = await client.users.fetch(userId).catch(() => null);
      if (targetUser) {
        await targetUser.send(
          `${isAdd ? '💎 Вам начислено' : '📉 С вас списано'} **${amount} баллов** в семье **${interaction.guild.name}**!\n` +
          `**Текущий баланс:** ${newVal} б.\n**Комментарий:** ${reason}`
        ).catch(() => {});
      }

      await sendAdminLog(
        interaction.guild,
        isAdd ? '💵 Начисление баллов' : '📉 Снятие баллов',
        `**Участник:** <@${userId}>\n**Сумма:** ${isAdd ? `+${amount}` : `-${amount}`} б.\n**Новый баланс:** ${newVal} б.\n**Причина:** ${reason}\n**Выполнил:** <@${interaction.user.id}>`,
        isAdd ? '#2ECC71' : '#E74C3C'
      );

      return interaction.reply({
        content: `${isAdd ? '💵 Начислено' : '📉 Снято'} **${amount}** баллов участнику <@${userId}>.\nТекущий баланс: **${newVal}** баллов (*${reason}*).`,
        ephemeral: true
      });
    }

    // Создание интерактивного розыгрыша
    if (id === 'ap_modal_giveaway') {
      const prize = interaction.fields.getTextInputValue('gw_prize');
      const winnersCount = Math.max(1, parseInt(interaction.fields.getTextInputValue('gw_winners'), 10) || 1);

      const gwEmbed = new EmbedBuilder()
        .setTitle('🎉 СЕМЕЙНЫЙ РОЗЫГРЫШ!')
        .setDescription(
          `**Приз:** ${prize}\n` +
          `**Победителей:** ${winnersCount}\n` +
          `**Организатор:** <@${interaction.user.id}>\n\n` +
          'Нажмите на кнопку **«🎉 Участвовать»** ниже!'
        )
        .setColor('#F1C40F')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ap_gw_join')
          .setLabel('🎉 Участвовать (0)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ap_gw_end')
          .setLabel('🏆 Завершить и выбрать победителя')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.channel.send({ embeds: [gwEmbed], components: [row] });

      const giveaways = loadJson(FILES.GIVEAWAYS, {});
      giveaways[msg.id] = {
        prize,
        winnersCount,
        authorId: interaction.user.id,
        participants: [],
        ended: false
      };
      saveJson(FILES.GIVEAWAYS, giveaways);

      return interaction.reply({ content: '✅ Розыгрыш опубликован в текущем канале!', ephemeral: true });
    }
  }
}

module.exports = { adminCommand, handleAdmin };

