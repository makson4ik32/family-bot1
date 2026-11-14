const config = require('./config');
const settings = require('./settings');
const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const STATS_FILE = path.join(__dirname, 'staff_rating.json');
const USERS_FILE = path.join(__dirname, 'users_profiles.json');

function loadJson(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function addStaffRating(userId, field) {
  const data = loadJson(STATS_FILE);
  if (!data[userId]) data[userId] = { accepted: 0, declined: 0, gathers: 0, tierChecks: 0 };
  data[userId][field] = (data[userId][field] || 0) + 1;
  saveJson(STATS_FILE, data);
}

function canRecruit(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roles = settings.CALLERS?.RECRUIT_CALLER_ROLES || [config.ROLES.RECRUIT, config.ROLES.HIGH_STAFF];
  return roles.filter(Boolean).some(r => member.roles.cache.has(r));
}

function canReviewStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roles = settings.CALLERS?.STAFF_CALLER_ROLES || [config.ROLES.HIGH_STAFF];
  return roles.filter(Boolean).some(r => member.roles.cache.has(r));
}

function formatPingRoles(roleIds) {
  return (roleIds || []).filter(Boolean).map(r => `<@&${r}>`).join(' ');
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

function getStaffRoleConfig(appKey) {
  const [baseKey, deptKey] = appKey.split(':');
  const baseCfg = settings.ROLE_REWARDS.STAFF_APPS[baseKey];
  if (!baseCfg) return { label: appKey, isMainOrRecruit: false };

  if (deptKey && baseCfg.departments && baseCfg.departments[deptKey]) {
    return {
      label: baseCfg.departments[deptKey].label,
      isMainOrRecruit: baseCfg.isMainOrRecruit
    };
  }

  return {
    label: baseCfg.label,
    isMainOrRecruit: baseCfg.isMainOrRecruit
  };
}

const recruitCommands = [
  new SlashCommandBuilder()
    .setName('панель_рекрутинга')
    .setDescription('Отправить панель подачи заявки в семью (Capt / RP)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('панель_тира')
    .setDescription('Отправить панель получения Tier-роли (создание приватного канала)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('панель_должностей')
    .setDescription('Отправить панель заявок на ранги и должности')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('рейтинг')
    .setDescription('Посмотреть рейтинг рекрутов и стаффа')
];

async function handleRecruit(interaction, client) {
  const recTxt = settings.PANELS.RECRUIT;
  const appTxt = settings.PANELS.STAFF_APPS;
  const tierTxt = settings.PANELS.TIER;
  const callersCfg = settings.CALLERS || {};

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'панель_рекрутинга') {
      const embed = settings.applyPanelStyle(new EmbedBuilder(), recTxt, '#E74C3C');
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rec_select_branch')
          .setPlaceholder(recTxt.placeholder)
          .addOptions([
            { label: recTxt.options.captLabel, description: recTxt.options.captDesc, value: 'Capt' },
            { label: recTxt.options.rpLabel, description: recTxt.options.rpDesc, value: 'RP' }
          ])
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Панель рекрутинга создана!', ephemeral: true });
    }

    if (interaction.commandName === 'панель_тира') {
      const embed = settings.applyPanelStyle(new EmbedBuilder(), tierTxt, '#2ECC71');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('rec_open_tier_ticket')
          .setLabel(tierTxt.buttonLabel)
          .setStyle(ButtonStyle.Success)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Панель тиров создана!', ephemeral: true });
    }

    if (interaction.commandName === 'панель_должностей') {
      const embed = settings.applyPanelStyle(new EmbedBuilder(), appTxt, '#9B59B6');
      const options = Object.entries(settings.ROLE_REWARDS.STAFF_APPS).map(([key, info]) => ({
        label: info.label,
        description: `Подать заявку на ${info.label}`,
        value: key
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rec_select_staff_role')
          .setPlaceholder(appTxt.placeholder)
          .addOptions(options)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Панель заявок создана!', ephemeral: true });
    }

    if (interaction.commandName === 'рейтинг') {
      const stats = loadJson(STATS_FILE);
      const sorted = Object.entries(stats)
        .sort((a, b) => (b[1].accepted + b[1].tierChecks) - (a[1].accepted + a[1].tierChecks))
        .slice(0, 15);

      const desc = sorted.length > 0
        ? sorted.map(([id, s], i) => `**${i + 1}.** <@${id}> — Принято: **${s.accepted}** | Отказов: **${s.declined}** | Тир-проверок: **${s.tierChecks}**`).join('\n')
        : '*Статистика пока пуста.*';

      const embed = new EmbedBuilder()
        .setTitle('📊 Рейтинг работы Рекрутов и Проверяющих')
        .setDescription(desc)
        .setColor('#F1C40F');
      return interaction.reply({ embeds: [embed] });
    }
  }

   if (interaction.isStringSelectMenu() && interaction.customId === 'rec_select_branch') {
    const adminFile = path.join(__dirname, 'admin_data.json');
    const adminData = loadJson(adminFile);

    // 1. Проверка, открыт ли набор
    if (adminData.recruitOpen === false) {
      return interaction.reply({
        content: '🔴 **Набор в семью сейчас закрыт!** Следите за новостями в каналах сервера.',
        ephemeral: true
      });
    }

    // 2. Проверка, не находится ли кандидат в чёрном списке
    const blacklist = Array.isArray(adminData.blacklist) ? adminData.blacklist : [];
    const bannedEntry = blacklist.find(b => b.userId === interaction.user.id);
    if (bannedEntry) {
      return interaction.reply({
        content: `⛔ **Вы находитесь в чёрном списке семьи!**\n**Причина:** ${bannedEntry.reason || 'Не указана'}`,
        ephemeral: true
      });
    }

    const branch = interaction.values[0];
    const modal = buildModalFromFields(
      `rec_modal_join_${branch}`,
      `${recTxt.modalTitlePrefix} (${branch})`,
      recTxt.fields
    );
    return interaction.showModal(modal);
  }


  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_modal_join_')) {
    const branch = interaction.customId.replace('rec_modal_join_', '');
    const queueCh = client.channels.cache.get(config.CHANNELS.RECRUIT_QUEUE);
    if (!queueCh) {
      return interaction.reply({ content: '❌ Канал рекрутинга не настроен в config.js', ephemeral: true });
    }

    const answerFields = (recTxt.fields || []).map(f => ({
      name: f.label,
      value: interaction.fields.getTextInputValue(f.id) || 'Не указано',
      inline: false
    }));

    const embed = new EmbedBuilder()
      .setTitle(`📩 Новая заявка | Ветка: ${branch}`)
      .setColor(settings.resolveColor(recTxt.color, branch === 'Capt' ? '#E74C3C' : '#3498DB'))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Кандидат', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        ...answerFields
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_review_${interaction.user.id}`).setLabel('👀 Взять на рассмотрение').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rec_take_${interaction.user.id}`).setLabel('📞 Вызвать на обзвон').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rec_ok_${interaction.user.id}_${branch}`).setLabel('✅ Принять').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_no_${interaction.user.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger)
    );

    const pingText = formatPingRoles(callersCfg.RECRUIT_PING_ROLES || [config.ROLES.RECRUIT]);
    await queueCh.send({ content: pingText || undefined, embeds: [embed], components: [row] });
    return interaction.reply({ content: recTxt.replySent, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_review_')) {
    if (!canRecruit(interaction.member)) {
      return interaction.reply({ content: '❌ Брать заявки на рассмотрение могут только назначенные обзвонники!', ephemeral: true });
    }

    const candidateId = interaction.customId.replace('rec_review_', '');
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#F39C12')
      .addFields({ name: '👀 На рассмотрении', value: `Заявку взял(а) <@${interaction.user.id}>`, inline: false });

    const updatedRow = ActionRowBuilder.from(interaction.message.components[0]);
    updatedRow.components[0].setDisabled(true).setLabel('👀 На рассмотрении');

    await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });

       const candidate = await client.users.fetch(candidateId).catch(() => null);
    if (candidate) {
      await candidate.send(
        `👀 Ваша заявка на вступление в семью **${interaction.guild.name}** взята на рассмотрение обзвонником **${interaction.user.tag}** (<@${interaction.user.id}>).`
      ).catch(() => {});
    }

    return interaction.followUp({ content: callersCfg.CHECKLIST || '📋 Заявка взята на рассмотрение.', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_take_')) {
    if (!canRecruit(interaction.member)) {
      return interaction.reply({ content: '❌ Вызывать на обзвон могут только назначенные обзвонники!', ephemeral: true });
    }

    const candidateId = interaction.customId.replace('rec_take_', '');
    const voiceId = callersCfg.WAITING_VOICE_ID || config.CHANNELS.WAITING_VOICE;

    const chText = (callersCfg.RECRUIT_CALL_CHANNEL_MSG || '📞 Обзвонник {caller} вызвал кандидата {candidate} на обзвон в {voice}!')
      .replace('{caller}', `<@${interaction.user.id}>`)
      .replace('{candidate}', `<@${candidateId}>`)
      .replace('{voice}', `<#${voiceId}>`);

    const dmText = (callersCfg.RECRUIT_CALL_DM_MSG || '📞 Обзвонник **{caller}** вызывает вас на обзвон в семью **{guild}**!\nЗайдите в голосовой канал ожидания: {voice}')
      .replace('{caller}', interaction.user.tag)
      .replace('{guild}', interaction.guild.name)
      .replace('{voice}', `<#${voiceId}>`);

    await interaction.reply({ content: callersCfg.CHECKLIST || '📞 Кандидат вызван на обзвон.', ephemeral: true });
    await interaction.channel.send(chText);

    const candidate = await client.users.fetch(candidateId).catch(() => null);
    if (candidate) {
      await candidate.send(dmText).catch(() => {});
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_ok_')) {
    if (!canRecruit(interaction.member)) {
      return interaction.reply({ content: '❌ Принимать заявки могут только назначенные обзвонники!', ephemeral: true });
    }
    const parts = interaction.customId.split('_');
    const candidateId = parts[2];
    const branch = parts[3];

    const fields = interaction.message.embeds[0]?.fields || [];
    const nickVal = fields[1]?.value || '';
    const staticVal = fields[2]?.value || '';
    const defaultNick = nickVal ? `${nickVal} | #${staticVal.replace(/#/g, '')}` : 'Nick_Name | #00000';

    const modal = new ModalBuilder()
      .setCustomId(`rec_finalok_${candidateId}_${branch}`)
      .setTitle('Принятие и ник по форме');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('final_nick')
          .setLabel('Ник на сервере (по форме)')
          .setValue(defaultNick.slice(0, 32))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // Финальное принятие в семью — ВЫДАЁТ начальные роли из settings.js
  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_finalok_')) {
    const parts = interaction.customId.split('_');
    const candidateId = parts[2];
    const branch = parts[3];
    const finalNick = interaction.fields.getTextInputValue('final_nick');

    const rolesToAdd = branch === 'Capt'
      ? settings.ROLE_REWARDS.JOIN_CAPT_ADD
      : settings.ROLE_REWARDS.JOIN_RP_ADD;

    const rolesToRemove = branch === 'Capt'
      ? settings.ROLE_REWARDS.JOIN_CAPT_REMOVE
      : settings.ROLE_REWARDS.JOIN_RP_REMOVE;

    const member = await interaction.guild.members.fetch(candidateId).catch(() => null);
    if (member) {
      await member.setNickname(finalNick).catch(() => {});
      if (rolesToRemove && rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove.filter(Boolean)).catch(() => {});
      }
      if (rolesToAdd && rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd.filter(Boolean)).catch(() => {});
      }
    }

    const profiles = loadJson(USERS_FILE);
    profiles[candidateId] = {
      nick: finalNick,
      branch,
      joinedAt: Date.now(),
      acceptedBy: `<@${interaction.user.id}>`
    };
    saveJson(USERS_FILE, profiles);
    addStaffRating(interaction.user.id, 'accepted');

    const resCh = client.channels.cache.get(config.CHANNELS.RECRUIT_RESULTS);
    if (resCh) {
      const resEmbed = new EmbedBuilder()
        .setTitle('✅ Заявка в семью ПРИНЯТА')
        .setColor('#2ECC71')
        .setDescription(
          `**Игрок:** <@${candidateId}>\n` +
          `**Ник по форме:** \`${finalNick}\`\n` +
          `**Состав:** ${branch}\n` +
          `**Принял:** <@${interaction.user.id}>`
        )
        .setTimestamp();
      await resCh.send({ content: `<@${candidateId}>`, embeds: [resEmbed] });
    }

    const doneEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#2ECC71')
      .setTitle('✅ Заявка ОДОБРЕНА')
      .addFields({ name: '👮 Принял', value: `<@${interaction.user.id}> (\`${finalNick}\`)`, inline: false });

    return interaction.update({ content: '', embeds: [doneEmbed], components: [] });
  }

  // Отклонить новичка
  if (interaction.isButton() && interaction.customId.startsWith('rec_no_')) {
    if (!canRecruit(interaction.member)) {
      return interaction.reply({ content: '❌ Отклонять заявки могут только назначенные обзвонники!', ephemeral: true });
    }
    const candidateId = interaction.customId.replace('rec_no_', '');
    const modal = new ModalBuilder()
      .setCustomId(`rec_finalno_${candidateId}_${interaction.message.id}`)
      .setTitle('Причина отклонения заявки');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('no_reason')
          .setLabel('Укажите причину отказа')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_finalno_')) {
    const parts = interaction.customId.split('_');
    const candidateId = parts[2];
    const msgId = parts[3];
    const reason = interaction.fields.getTextInputValue('no_reason');

    addStaffRating(interaction.user.id, 'declined');

    const resCh = client.channels.cache.get(config.CHANNELS.RECRUIT_RESULTS);
    if (resCh) {
      const resEmbed = new EmbedBuilder()
        .setTitle('❌ Заявка в семью ОТКЛОНЕНА')
        .setColor('#E74C3C')
        .setDescription(
          `**Кандидат:** <@${candidateId}>\n` +
          `**Причина отказа:** ${reason}\n` +
          `**Проверил:** <@${interaction.user.id}>`
        )
        .setTimestamp();
      await resCh.send({ content: `<@${candidateId}>`, embeds: [resEmbed] });
    }

    const origMsg = await interaction.channel.messages.fetch(msgId).catch(() => null);
    if (origMsg && origMsg.embeds.length > 0) {
      const rejEmbed = EmbedBuilder.from(origMsg.embeds[0])
        .setColor('#E74C3C')
        .setTitle('❌ Заявка ОТКЛОНЕНА')
        .addFields(
          { name: '👮 Отклонил', value: `<@${interaction.user.id}>`, inline: true },
          { name: '💬 Причина', value: reason, inline: false }
        );
      await origMsg.edit({ content: '', embeds: [rejEmbed], components: [] });
    }

    return interaction.reply({ content: '✅ Отказ опубликован в итогах заявок.', ephemeral: true });
  }

    // 3. TIER ПРОВЕРКА
  if (interaction.isButton() && interaction.customId === 'rec_open_tier_ticket') {
    const existingTicket = interaction.guild.channels.cache.find(
      c => c.parentId === config.CHANNELS.TIER_CATEGORY &&
           c.topic &&
           c.topic.startsWith('Tier-проверка') &&
           c.topic.includes(interaction.user.id)
    );
    if (existingTicket) {
      return interaction.reply({ content: `⚠️ У тебя уже открыт канал проверки: ${existingTicket}`, ephemeral: true });
    }

    const ch = await interaction.guild.channels.create({
      name: `тир-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: config.CHANNELS.TIER_CATEGORY,
      topic: `Tier-проверка участника ${interaction.user.tag} | ID: ${interaction.user.id}`,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: config.ROLES.TIER_CHECKER,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory]
        }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_givetier_1_${interaction.user.id}`).setLabel('Выдать Tier 1').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_givetier_2_${interaction.user.id}`).setLabel('Выдать Tier 2').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_givetier_3_${interaction.user.id}`).setLabel('Выдать Tier 3').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rec_close_tier').setLabel('🔒 Закрыть канал').setStyle(ButtonStyle.Danger)
    );

    await ch.send({
      content: `<@${interaction.user.id}> | <@&${config.ROLES.TIER_CHECKER}>\n${tierTxt.ticketWelcome}`,
      components: [row]
    });

    return interaction.reply({ content: `✅ Создан приватный канал для проверки: ${ch}`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_givetier_')) {
    if (!interaction.member.roles.cache.has(config.ROLES.TIER_CHECKER) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Выдавать Tier может только Tier Checker!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const tierNum = parts.at(2);
    const targetId = parts.at(3);
    const roleMap = {
      '1': config.ROLES.TIER_1,
      '2': config.ROLES.TIER_2,
      '3': config.ROLES.TIER_3
    };

    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (member) {
      await member.roles.remove([config.ROLES.TIER_1, config.ROLES.TIER_2, config.ROLES.TIER_3].filter(Boolean)).catch(() => {});
      if (roleMap[tierNum]) {
        await member.roles.add(roleMap[tierNum]).catch(() => {});
      }
    }

    addStaffRating(interaction.user.id, 'tierChecks');
    return interaction.reply(`✅ Игроку <@${targetId}> выдана роль **Tier ${tierNum}** проверяющим <@${interaction.user.id}>!`);
  }

  if (interaction.isButton() && interaction.customId === 'rec_close_tier') {
    if (!interaction.member.roles.cache.has(config.ROLES.TIER_CHECKER) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Закрыть тикет может только Tier Checker или администратор!', ephemeral: true });
    }
    await interaction.reply('🔒 Канал проверки закроется и удалится через 5 секунд...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }

  // 4. ЗАЯВКИ НА РАНГИ И ДОЛЖНОСТИ — РОЛИ НЕ ВЫДАЮТСЯ ПРИ ОДОБРЕНИИ
  if (interaction.isStringSelectMenu() && interaction.customId === 'rec_select_staff_role') {
    const roleKey = interaction.values.at(0);
    const baseCfg = settings.ROLE_REWARDS.STAFF_APPS[roleKey];

    if (baseCfg && baseCfg.departments) {
      const deptOptions = Object.entries(baseCfg.departments).map(([deptKey, deptInfo]) => ({
        label: deptInfo.label,
        description: (deptInfo.description || `Отдел ${deptKey}`).slice(0, 100),
        value: `${roleKey}:${deptKey}`
      }));

      const deptRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rec_select_staff_dept')
          .setPlaceholder(`👇 Выбери отдел для ${baseCfg.label}...`)
          .addOptions(deptOptions)
      );

      return interaction.reply({
        content: `Выберите конкретный отдел для должности **${baseCfg.label}**:`,
        components: [deptRow],
        ephemeral: true
      });
    }

    const roleInfo = getStaffRoleConfig(roleKey);
    return interaction.showModal(
      buildModalFromFields(`rec_staffapp_${roleKey}`, `${appTxt.modalTitlePrefix} ${roleInfo.label}`, appTxt.fields)
    );
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'rec_select_staff_dept') {
    const appKey = interaction.values.at(0);
    const roleInfo = getStaffRoleConfig(appKey);
    return interaction.showModal(
      buildModalFromFields(`rec_staffapp_${appKey}`, `${appTxt.modalTitlePrefix} ${roleInfo.label}`, appTxt.fields)
    );
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_staffapp_')) {
    const appKey = interaction.customId.replace('rec_staffapp_', '');
    const roleInfo = getStaffRoleConfig(appKey);

    const targetLogId = roleInfo.isMainOrRecruit
      ? (config.CHANNELS.MAIN_RECRUIT_APPS || config.CHANNELS.STAFF_APPS)
      : config.CHANNELS.STAFF_APPS;

    const staffCh = client.channels.cache.get(targetLogId);
    if (!staffCh) {
      return interaction.reply({ content: '❌ Канал проверки заявок не настроен в `config.js`.', ephemeral: true });
    }

    const answerFields = (appTxt.fields || []).map(f => ({
      name: f.label,
      value: interaction.fields.getTextInputValue(f.id) || 'Не указано',
      inline: false
    }));

    const embed = new EmbedBuilder()
      .setTitle(`👔 Новая заявка: ${roleInfo.label}`)
      .setColor(settings.resolveColor(appTxt.color, roleInfo.isMainOrRecruit ? '#3498DB' : '#9B59B6'))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Кандидат', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        ...answerFields
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_staffreview_${interaction.user.id}_${appKey}`).setLabel('👀 Взять на рассмотрение').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rec_staffcall_${interaction.user.id}_${appKey}`).setLabel('📞 Вызвать на обзвон').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rec_staffpass_${interaction.user.id}_${appKey}`).setLabel('✅ Одобрить').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_stafffail_${interaction.user.id}_${appKey}`).setLabel('❌ Отказать').setStyle(ButtonStyle.Danger)
    );

    const pingText = formatPingRoles(callersCfg.STAFF_PING_ROLES || [config.ROLES.HIGH_STAFF]);
    await staffCh.send({ content: pingText || undefined, embeds: [embed], components: [row] });
    return interaction.reply({ content: appTxt.replySent, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_staffreview_')) {
    if (!canReviewStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Брать заявки на рассмотрение могут только проверяющие из настроек!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const candidateId = parts.at(2);
    const appKey = parts.slice(3).join('_');
    const roleInfo = getStaffRoleConfig(appKey);

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds.at(0))
      .setColor('#F39C12')
      .addFields({ name: '👀 На рассмотрении', value: `Заявку взял(а) <@${interaction.user.id}>`, inline: false });

    const updatedRow = ActionRowBuilder.from(interaction.message.components.at(0));
    updatedRow.components.at(0).setDisabled(true).setLabel('👀 На рассмотрении');

    await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });

    const candidate = await client.users.fetch(candidateId).catch(() => null);
    if (candidate) {
      await candidate.send(
        `👀 Ваша заявка на **${roleInfo.label}** взята на рассмотрение проверяющим **${interaction.user.tag}** (<@${interaction.user.id}>).`
      ).catch(() => {});
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('rec_staffcall_')) {
    if (!canReviewStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Вызывать на обзвон могут только проверяющие из настроек!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const candidateId = parts.at(2);
    const appKey = parts.slice(3).join('_');
    const roleInfo = getStaffRoleConfig(appKey);
    const voiceId = callersCfg.WAITING_VOICE_ID || config.CHANNELS.WAITING_VOICE;

        const chText = (callersCfg.STAFF_CALL_CHANNEL_MSG || '📞 {caller} вызывает кандидата {candidate} на обзвон по заявке **{role}** в {voice}!')
      .replace('{caller}', `<@${interaction.user.id}>`)
      .replace('{candidate}', `<@${candidateId}>`)
      .replace('{role}', roleInfo.label)
      .replace('{voice}', `<#${voiceId}>`);

    const dmText = (callersCfg.STAFF_CALL_DM_MSG || '📞 Руководство **{caller}** вызывает вас на обзвон по заявке **{role}** в семье **{guild}**!\nЗайдите в голосовой канал: {voice}')
      .replace('{caller}', interaction.user.tag)
      .replace('{role}', roleInfo.label)
      .replace('{guild}', interaction.guild.name)
      .replace('{voice}', `<#${voiceId}>`);

    await interaction.reply(chText);

    const candidate = await client.users.fetch(candidateId).catch(() => null);
    if (candidate) {
      await candidate.send(dmText).catch(() => {});
    }
    return;
  }

    // Одобрить или отказать в заявке на ранг/должность — БЕЗ ВЫДАЧИ РОЛЕЙ (роли выдадутся только по отчёту!)
  if (interaction.isButton() && (interaction.customId.startsWith('rec_staffpass_') || interaction.customId.startsWith('rec_stafffail_'))) {
    if (!canReviewStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Доступно только проверяющим из настроек!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const actionType = parts.at(1);
    const targetId = parts.at(2);
    const appKey = parts.slice(3).join('_');
    const passed = actionType === 'staffpass';
    const roleInfo = getStaffRoleConfig(appKey);

    const resChId = config.CHANNELS.STAFF_RESULTS || config.CHANNELS.RECRUIT_RESULTS;
    const resCh = await client.channels.fetch(resChId).catch(() => null);
    if (resCh) {
      const resEmbed = new EmbedBuilder()
        .setTitle(passed ? `🎉 Одобрена заявка: ${roleInfo.label}` : `❌ Отказ по заявке: ${roleInfo.label}`)
        .setColor(passed ? '#2ECC71' : '#E74C3C')
        .setDescription(
          `**Кандидат:** <@${targetId}>\n` +
          `**Итог:** ${passed ? 'Заявка одобрена! Для получения роли подайте отчёт в канале повышения.' : 'Отказано в повышении / назначении.'}\n` +
          `**Проверил:** <@${interaction.user.id}>`
        )
        .setTimestamp();
      await resCh.send({ content: `<@${targetId}>`, embeds: [resEmbed] });
    }

    const upd = EmbedBuilder.from(interaction.message.embeds.at(0))
      .setColor(passed ? '#2ECC71' : '#E74C3C')
      .addFields({
        name: '👮 Решение руководства',
        value: `${passed ? '✅ Одобрено (роль выдаётся по отчёту)' : '❌ Отказано'} — <@${interaction.user.id}>`,
        inline: false
      });

    return interaction.update({ content: '', embeds: [upd], components: [] });
  }
}

module.exports = { recruitCommands, handleRecruit };

