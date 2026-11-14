const config = require('./config');
const settings = require('./settings');
const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const ECO_CFG = settings.PANELS.ECONOMY;
const POINT_ACTIVITIES = ECO_CFG.activities;
const VOICE_CONFIG = ECO_CFG.voice;
const SHOP_ITEMS = ECO_CFG.shopItems;

const ECONOMY_FILE = path.join(__dirname, 'economy_data.json');
const WARNS_FILE = path.join(__dirname, 'warns_data.json');

function loadEconomy() {
  if (!fs.existsSync(ECONOMY_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8')); } catch { return {}; }
}

function saveEconomy(data) {
  fs.writeFileSync(ECONOMY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getUserStats(data, userId) {
  if (!data[userId]) data[userId] = { points: 0, voiceMinutes: 0 };
  return data[userId];
}

function formatVoiceTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} ч. ${mins} мин.`;
}

function isHighStaff(member) {
  return member.roles.cache.has(config.ROLES.HIGH_STAFF) ||
         member.permissions.has(PermissionFlagsBits.Administrator);
}

function buildModalFromFields(customId, title, fieldsList) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
  const rows = (fieldsList || []).slice(0, 5).map(f =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(f.id)
        .setLabel(f.label.slice(0, 45))
        .setPlaceholder((f.placeholder || '').slice(0, 100))
        .setStyle(f.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(f.required !== false)
    )
  );
  return modal.addComponents(...rows);
}

const pointsPanelCommand = new SlashCommandBuilder()
  .setName('панель_баллов')
  .setDescription('Отправить панель для сдачи отчётов на баллы и просмотра топа')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const shopPanelCommand = new SlashCommandBuilder()
  .setName('панель_магазина')
  .setDescription('Отправить панель магазина наград за баллы')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const payoutPanelCommand = new SlashCommandBuilder()
  .setName('панель_выплат')
  .setDescription('Отправить панель для подачи заявок на денежную выплату / премию')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const topPointsCommand = new SlashCommandBuilder()
  .setName('топ_баллов')
  .setDescription('Показать топ-15 участников семьи по баллам и онлайну в войсе');

const givePointsCommand = new SlashCommandBuilder()
  .setName('выдать_баллы')
  .setDescription('Выдать или списать баллы участнику (для High Staff)')
  .addUserOption(opt => opt.setName('участник').setDescription('Кому изменить баланс').setRequired(true))
  .addIntegerOption(opt => opt.setName('количество').setDescription('Сколько баллов (минус для списания, например -50)').setRequired(true))
  .addStringOption(opt => opt.setName('причина').setDescription('Причина начисления/списания').setRequired(true));

const economyCommands = [
  pointsPanelCommand,
  shopPanelCommand,
  payoutPanelCommand,
  topPointsCommand,
  givePointsCommand
];

function startVoicePointsTracker(client) {
  const intervalMs = VOICE_CONFIG.CHECK_INTERVAL_MINUTES * 60 * 1000;

  setInterval(() => {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) return;

    const ecoData = loadEconomy();
    let updated = false;

    guild.voiceStates.cache.forEach(voiceState => {
      const member = voiceState.member;
      if (!member || member.user.bot || !voiceState.channelId) return;
      if (config.CHANNELS.AFK_VOICE && voiceState.channelId === config.CHANNELS.AFK_VOICE) return;
      if (VOICE_CONFIG.IGNORE_DEAFENED && (voiceState.selfDeaf || voiceState.serverDeaf)) return;
      if (config.ROLES.FAMQ && !member.roles.cache.has(config.ROLES.FAMQ)) return;

      const userStats = getUserStats(ecoData, member.id);
      userStats.points += VOICE_CONFIG.POINTS_PER_INTERVAL;
      userStats.voiceMinutes += VOICE_CONFIG.CHECK_INTERVAL_MINUTES;
      updated = true;
    });

    if (updated) saveEconomy(ecoData);
  }, intervalMs);

  console.log(`🎙 Трекер баллов за войс запущен (+${VOICE_CONFIG.POINTS_PER_INTERVAL} б. каждые ${VOICE_CONFIG.CHECK_INTERVAL_MINUTES} мин.)`);
}

function buildTopEmbed(ecoData, guildName) {
  const sorted = Object.entries(ecoData)
    .map(([id, stats]) => ({ id, points: stats.points || 0, voiceMinutes: stats.voiceMinutes || 0 }))
    .filter(u => u.points > 0 || u.voiceMinutes > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 15);

  const medals = ['🥇', '🥈', '🥉'];
  const description = sorted.length > 0
    ? sorted.map((u, idx) => {
        const place = medals[idx] || `**${idx + 1}.**`;
        return `${place} <@${u.id}> — **${u.points} б.** *(войс: ${formatVoiceTime(u.voiceMinutes)})*`;
      }).join('\n')
    : '*Пока никто не заработал баллы. Будь первым!*';

  return new EmbedBuilder()
    .setTitle(`🏆 Топ-15 участников по баллам | ${guildName}`)
    .setDescription(description)
    .setColor('#F1C40F')
    .setFooter({ text: `За войс начисляется +${VOICE_CONFIG.POINTS_PER_INTERVAL} баллов каждые ${VOICE_CONFIG.CHECK_INTERVAL_MINUTES} мин.` })
    .setTimestamp();
}

async function handleEconomy(interaction, client) {
  // 1. /панель_баллов
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_баллов') {
    const pCfg = ECO_CFG.POINTS_PANEL;
    const activitiesList = Object.values(POINT_ACTIVITIES)
      .map(a => `• **${a.label}** — \`+${a.points} баллов\` *(${a.desc})*`)
      .join('\n');

    const fullDesc =
      `${pCfg.description}\n\n` +
      `**Расценки за задания:**\n${activitiesList}\n\n` +
      `**🎙 Бонус за голосовой онлайн:**\n` +
      `• Нахождение в голосовых каналах семьи (со включённым звуком) приносит **+${VOICE_CONFIG.POINTS_PER_INTERVAL} баллов** каждые **${VOICE_CONFIG.CHECK_INTERVAL_MINUTES} минут**!`;

    const embed = settings.applyPanelStyle(
      new EmbedBuilder().setDescription(fullDesc),
      { ...pCfg, description: undefined },
      '#2ECC71'
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eco_select_activity')
      .setPlaceholder(pCfg.placeholder)
      .addOptions(
        Object.entries(POINT_ACTIVITIES).map(([key, info]) => ({
          label: `${info.label} (+${info.points} б.)`,
          description: info.desc,
          value: key
        }))
      );

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Мой баланс и войс').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('eco_show_top').setLabel('🏆 Топ по баллам').setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu), buttonsRow]
    });
    return interaction.reply({ content: '✅ Панель заработка баллов успешно создана!', ephemeral: true });
  }

  // 2. /панель_магазина
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_магазина') {
    const sCfg = ECO_CFG.SHOP_PANEL;
    const itemsList = Object.values(SHOP_ITEMS)
      .map(item => `• **${item.label}** — **${item.cost} баллов**\n  *${item.description}*`)
      .join('\n\n');

    const embed = settings.applyPanelStyle(
      new EmbedBuilder().setDescription(`${sCfg.description}\n\n${itemsList}`),
      { ...sCfg, description: undefined },
      '#9B59B6'
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eco_shop_buy')
      .setPlaceholder(sCfg.placeholder)
      .addOptions(
        Object.entries(SHOP_ITEMS).map(([key, item]) => ({
          label: `${item.label} — ${item.cost} б.`,
          description: item.description.slice(0, 100),
          value: key
        }))
      );

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Проверить мой баланс').setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu), btnRow]
    });
    return interaction.reply({ content: '✅ Панель магазина успешно создана!', ephemeral: true });
  }

  // 3. /панель_выплат
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_выплат') {
    const payCfg = ECO_CFG.PAYOUT_PANEL;
    const embed = settings.applyPanelStyle(new EmbedBuilder(), payCfg, '#F1C40F');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_request_payout').setLabel(payCfg.buttonLabel).setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель запросов на выплату успешно создана!', ephemeral: true });
  }

  // 4. /топ_баллов и кнопка "Топ по баллам"
  if ((interaction.isChatInputCommand() && interaction.commandName === 'топ_баллов') ||
      (interaction.isButton() && interaction.customId === 'eco_show_top')) {
    const ecoData = loadEconomy();
    const embed = buildTopEmbed(ecoData, interaction.guild.name);
    return interaction.reply({ embeds: [embed], ephemeral: interaction.isButton() });
  }

    // 5. Кнопка "Мой баланс и войс"
  if (interaction.isButton() && interaction.customId === 'eco_my_balance') {
    const ecoData = loadEconomy();
    const stats = getUserStats(ecoData, interaction.user.id);
    return interaction.reply({
      content: `💳 **Твоя статистика:**\n• Текущий баланс: **${stats.points} баллов**\n• Время в голосовых каналах: **${formatVoiceTime(stats.voiceMinutes)}**`,
      ephemeral: true
    });
  }

  // 6. /выдать_баллы
  if (interaction.isChatInputCommand() && interaction.commandName === 'выдать_баллы') {
    if (!isHighStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Управлять баллами может только High Staff!', ephemeral: true });
    }

    const target = interaction.options.getUser('участник');
    const amount = interaction.options.getInteger('количество');
    const reason = interaction.options.getString('причина');

    const ecoData = loadEconomy();
    const stats = getUserStats(ecoData, target.id);
    stats.points = Math.max(0, stats.points + amount);
    saveEconomy(ecoData);

    return interaction.reply({
      content: `✅ Баланс игрока <@${target.id}> изменён на **${amount > 0 ? `+${amount}` : amount} б.** (Причина: *${reason}*).\nТекущий баланс: **${stats.points} б.**`
    });
  }

  // ==================== ОТЧЁТЫ НА БАЛЛЫ ====================
  if (interaction.isStringSelectMenu() && interaction.customId === 'eco_select_activity') {
    const actKey = interaction.values[0];
    const actInfo = POINT_ACTIVITIES[actKey];
    const modal = buildModalFromFields(
      `eco_submit_${actKey}`,
      `Отчёт: +${actInfo.points} баллов`,
      ECO_CFG.POINTS_PANEL.fields
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('eco_submit_')) {
    const actKey = interaction.customId.replace('eco_submit_', '');
    const actInfo = POINT_ACTIVITIES[actKey];

    const reportsChannel = client.channels.cache.get(config.CHANNELS.POINTS_REPORTS);
    if (!reportsChannel) {
      return interaction.reply({ content: '❌ Канал проверки баллов не настроен в `config.js` (`POINTS_REPORTS`).', ephemeral: true });
    }

    const answerFields = (ECO_CFG.POINTS_PANEL.fields || []).map(f => ({
      name: f.label,
      value: interaction.fields.getTextInputValue(f.id) || 'Не указано',
      inline: false
    }));

    const embed = new EmbedBuilder()
      .setTitle('💎 Заявка на начисление баллов')
      .setColor('#3498DB')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '📌 Активность', value: `${actInfo.label} (**+${actInfo.points} баллов**)`, inline: true },
        ...answerFields
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eco_approve_${interaction.user.id}_${actInfo.points}`).setLabel(`✅ Начислить +${actInfo.points} б.`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eco_reject_${interaction.user.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger)
    );

    await reportsChannel.send({ content: `<@&${config.ROLES.HIGH_STAFF}> Новый отчёт на баллы!`, embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Твой отчёт отправлен High Staff на проверку!', ephemeral: true });
  }

  if (interaction.isButton() && (interaction.customId.startsWith('eco_approve_') || interaction.customId.startsWith('eco_reject_'))) {
    if (!isHighStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Проверять отчёты на баллы может только High Staff!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const targetUserId = parts[2];

    if (action === 'approve') {
      const pointsToAdd = parseInt(parts[3], 10) || 0;
      const ecoData = loadEconomy();
      const stats = getUserStats(ecoData, targetUserId);
      stats.points += pointsToAdd;
      saveEconomy(ecoData);

      const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#2ECC71')
        .setTitle(`✅ Начислено +${pointsToAdd} баллов`)
        .addFields({ name: '👮 Проверил (High Staff)', value: `<@${interaction.user.id}> (Новый баланс: **${stats.points} б.**)`, inline: false });

      await interaction.update({ content: '', embeds: [approvedEmbed], components: [] });

      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      if (targetUser) {
        await targetUser.send(`💎 Ваш отчёт одобрен High Staff! Начислено **+${pointsToAdd} баллов**. Ваш баланс: **${stats.points} б.**`).catch(() => {});
      }
    }

    if (action === 'reject') {
      const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#E74C3C')
        .setTitle('❌ Отчёт на баллы ОТКЛОНЁН')
        .addFields({ name: '👮 Отклонил (High Staff)', value: `<@${interaction.user.id}>`, inline: false });

      await interaction.update({ content: '', embeds: [rejectedEmbed], components: [] });
    }
  }

   // ==================== МАГАЗИН НАГРАД ====================
  if (interaction.isStringSelectMenu() && interaction.customId === 'eco_shop_buy') {
    const itemKey = interaction.values[0];
    const item = SHOP_ITEMS[itemKey];
    const ecoData = loadEconomy();
    const stats = getUserStats(ecoData, interaction.user.id);

    if (stats.points < item.cost) {
      return interaction.reply({
        content: `❌ Недостаточно баллов! Нужно **${item.cost} б.**, а у тебя сейчас **${stats.points} б.**`,
        ephemeral: true
      });
    }

    if (itemKey === 'remove_warn') {
      let warnsData = {};
      if (fs.existsSync(WARNS_FILE)) {
        try { warnsData = JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8')); } catch {}
      }

      const currentWarns = warnsData[interaction.user.id] || 0;
      if (currentWarns <= 0) {
        return interaction.reply({ content: '⚠️ У тебя нет активных выговоров, которые можно снять!', ephemeral: true });
      }

      stats.points -= item.cost;
      saveEconomy(ecoData);

      const newWarns = currentWarns - 1;
      if (newWarns === 0) delete warnsData[interaction.user.id];
      else warnsData[interaction.user.id] = newWarns;
      fs.writeFileSync(WARNS_FILE, JSON.stringify(warnsData, null, 2), 'utf8');

      if (newWarns === 0) {
        await interaction.member.roles.remove(config.ROLES.WARN_1).catch(() => {});
        await interaction.member.roles.remove(config.ROLES.WARN_2).catch(() => {});
      } else if (newWarns === 1) {
        await interaction.member.roles.remove(config.ROLES.WARN_2).catch(() => {});
        await interaction.member.roles.add(config.ROLES.WARN_1).catch(() => {});
      }

      return interaction.reply({
        content: `✅ Вы успешно купили **${item.label}** за **${item.cost} б.**!\nС вас снят 1 выговор (осталось: **${newWarns}/3**). Остаток баллов: **${stats.points} б.**`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`eco_buyform_${itemKey}`)
      .setTitle(`Покупка: ${item.cost} баллов`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('buy_details')
          .setLabel(ECO_CFG.SHOP_PANEL.shopModal.detailsLabel)
          .setPlaceholder(ECO_CFG.SHOP_PANEL.shopModal.detailsPlaceholder)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('eco_buyform_')) {
    const itemKey = interaction.customId.replace('eco_buyform_', '');
    const item = SHOP_ITEMS[itemKey];
    const details = interaction.fields.getTextInputValue('buy_details');

    const shopChannel = client.channels.cache.get(config.CHANNELS.SHOP_ORDERS);
    if (!shopChannel) {
      return interaction.reply({ content: '❌ Канал заказов магазина не настроен в `config.js` (`SHOP_ORDERS`).', ephemeral: true });
    }

    const ecoData = loadEconomy();
    const stats = getUserStats(ecoData, interaction.user.id);

    if (stats.points < item.cost) {
      return interaction.reply({ content: '❌ Недостаточно баллов для покупки.', ephemeral: true });
    }

    stats.points -= item.cost;
    saveEconomy(ecoData);

    const orderEmbed = new EmbedBuilder()
      .setTitle('🛍 Новый заказ из магазина наград')
      .setColor('#9B59B6')
      .addFields(
        { name: '👤 Покупатель', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '🎁 Товар', value: `${item.label} (**-${item.cost} б.**)`, inline: true },
        { name: '💳 Реквизиты для выдачи', value: details, inline: false }
      )
      .setTimestamp();

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eco_orderdone_${interaction.user.id}`).setLabel('✅ Товар выдан').setStyle(ButtonStyle.Success)
    );

    await shopChannel.send({ content: `<@&${config.ROLES.HIGH_STAFF}> Новая покупка в магазине!`, embeds: [orderEmbed], components: [btn] });

    return interaction.reply({
      content: `✅ Заказ на **${item.label}** оформлен! Списано **${item.cost} б.** (остаток: **${stats.points} б.**). Ожидайте выдачи.`,
      ephemeral: true
    });
  }

  if (interaction.isButton() && interaction.customId.startsWith('eco_orderdone_')) {
    if (!isHighStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Отмечать выдачу товаров может только High Staff!', ephemeral: true });
    }

    const buyerId = interaction.customId.replace('eco_orderdone_', '');
    const doneEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#2ECC71')
      .setTitle('✅ Заказ из магазина ВЫДАН')
      .addFields({ name: '👮 Выдал товар', value: `<@${interaction.user.id}>`, inline: false });

    await interaction.update({ content: '', embeds: [doneEmbed], components: [] });

    const buyer = await client.users.fetch(buyerId).catch(() => null);
    if (buyer) {
      await buyer.send('🎁 Ваш заказ из семейного магазина был успешно выдан!').catch(() => {});
    }
  }

  // ==================== ЗАЯВКИ НА ВЫПЛАТЫ ====================
  if (interaction.isButton() && interaction.customId === 'eco_request_payout') {
    const payCfg = ECO_CFG.PAYOUT_PANEL;
    const modal = buildModalFromFields('eco_submit_payout', payCfg.payoutModal.title, payCfg.fields);
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'eco_submit_payout') {
    const payoutChannel = client.channels.cache.get(config.CHANNELS.PAYOUT_REQUESTS);
    if (!payoutChannel) {
      return interaction.reply({ content: '❌ Канал выплат не настроен в `config.js` (`PAYOUT_REQUESTS`).', ephemeral: true });
    }

    const answerFields = (ECO_CFG.PAYOUT_PANEL.fields || []).map(f => ({
      name: f.label,
      value: interaction.fields.getTextInputValue(f.id) || 'Не указано',
      inline: false
    }));

    const payEmbed = new EmbedBuilder()
      .setTitle('💸 Новая заявка на выплату')
      .setColor('#F1C40F')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        ...answerFields
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eco_paydone_${interaction.user.id}`).setLabel('✅ Выплачено').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eco_paydeny_${interaction.user.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger)
    );

    await payoutChannel.send({ content: `<@&${config.ROLES.HIGH_STAFF}> Новая заявка на выплату!`, embeds: [payEmbed], components: [row] });
    return interaction.reply({ content: '✅ Твоя заявка на выплату успешно отправлена!', ephemeral: true });
  }

  if (interaction.isButton() && (interaction.customId.startsWith('eco_paydone_') || interaction.customId.startsWith('eco_paydeny_'))) {
    if (!isHighStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Подтверждать выплаты может только High Staff!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const targetUserId = parts[2];

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === 'paydone' ? '#2ECC71' : '#E74C3C')
      .setTitle(action === 'paydone' ? '✅ Выплата ПРОИЗВЕДЕНА' : '❌ Заявка на выплату ОТКЛОНЕНА')
      .addFields({
        name: action === 'paydone' ? '👮 Выплатил' : '👮 Отклонил',
        value: `<@${interaction.user.id}>`,
        inline: false
      });

    await interaction.update({ content: '', embeds: [updatedEmbed], components: [] });

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (targetUser) {
      await targetUser.send(
        action === 'paydone'
          ? '💸 Ваша заявка на выплату одобрена и переведена на указанный счёт!'
          : '❌ Ваша заявка на выплату была отклонена старшим составом.'
      ).catch(() => {});
    }
  }
}

module.exports = { economyCommands, handleEconomy, startVoicePointsTracker };
