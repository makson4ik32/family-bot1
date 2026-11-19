const config = require('./config');
const settings = require('./settings');
const { getJson, saveJson } = require('./db');
const { getMergedPanelConfig, saveCustomPanels, getCustomPanels } = require('./panel_manager');

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

function canHandleRecruit(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (Array.isArray(config.OWNER_IDS) && config.OWNER_IDS.includes(member.id)) return true;

  const allowed = [
    ...(settings.CALLERS.RECRUIT_CALLER_ROLES || []),
    config.ROLES.HIGH_STAFF,
    config.ROLES.DEP_LEADER,
    config.ROLES.LEADER
  ].filter(Boolean);

  return allowed.some(r => member.roles.cache.has(r));
}

function addRecruitStat(userId, field) {
  const stats = getJson('staff_rating.json', {});
  if (!stats[userId]) stats[userId] = { accepted: 0, declined: 0, tierChecks: 0 };
  stats[userId][field] = (stats[userId][field] || 0) + 1;
  saveJson('staff_rating.json', stats);
}

const recruitCommand = new SlashCommandBuilder()
  .setName('панель_рекрутинга')
  .setDescription('Отправить панель набора в семью')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

async function handleRecruit(interaction, client) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_рекрутинга') {
    const cfg = getMergedPanelConfig('RECRUIT');
    const embed = settings.applyPanelStyle(new EmbedBuilder(), { ...cfg, _panelKey: 'RECRUIT' }, '#002fff');

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('recruit_select_branch')
        .setPlaceholder(cfg.placeholder || '👇 Выбери направление для вступления...')
        .addOptions([
          { label: cfg.options?.captLabel || '⚔️ Capt Состав', description: cfg.options?.captDesc || 'Капты и турниры', value: 'Capt' },
          { label: cfg.options?.rpLabel || '🎭 RP Состав', description: cfg.options?.rpDesc || 'RP контент и развитие', value: 'RP' }
        ])
    );

    const sent = await interaction.channel.send({ embeds: [embed], components: [row] });
    const customAll = getCustomPanels();
    customAll.RECRUIT = { ...(customAll.RECRUIT || {}), channelId: interaction.channel.id, messageId: sent.id };
    saveCustomPanels(customAll);

    return interaction.reply({ content: '✅ Панель рекрутинга опубликована!', ephemeral: true });
  }

  // Выбор направления (Capt / RP) + проверка статусов набора и ЧС
  if (interaction.isStringSelectMenu() && interaction.customId === 'recruit_select_branch') {
    const branch = interaction.values.at(0);
    const adminData = getJson('admin_data.json', { recruitOpen: true, captOpen: true, rpOpen: true, blacklist: [] });

    if (Array.isArray(adminData.blacklist) && adminData.blacklist.some(b => b.userId === interaction.user.id)) {
      return interaction.reply({ content: '⛔ Вы находитесь в чёрном списке семьи и не можете подать заявку.', ephemeral: true });
    }

    if (adminData.recruitOpen === false) {
      return interaction.reply({ content: '🔴 Набор в семью сейчас временно закрыт.', ephemeral: true });
    }
    if (branch === 'Capt' && adminData.captOpen === false) {
      return interaction.reply({ content: '🔴 Набор в **Capt-состав** сейчас временно закрыт.', ephemeral: true });
    }
    if (branch === 'RP' && adminData.rpOpen === false) {
      return interaction.reply({ content: '🔴 Набор в **RP-состав** сейчас временно закрыт.', ephemeral: true });
    }

    const cfg = getMergedPanelConfig('RECRUIT');
    const modal = new ModalBuilder()
      .setCustomId(`recruit_modal_${branch}`)
      .setTitle(`${cfg.modalTitlePrefix || 'Заявка в семью'} (${branch})`.slice(0, 45));

    const fields = cfg.fields || settings.PANELS.RECRUIT.fields;
    for (const f of fields.slice(0, 5)) {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(f.id)
            .setLabel(f.label.slice(0, 45))
            .setPlaceholder((f.placeholder || '').slice(0, 100))
            .setStyle(f.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(Boolean(f.required))
        )
      );
    }

    return interaction.showModal(modal);
  }

  // Отправка анкеты -> создание приватного канала заявки
  if (interaction.isModalSubmit() && interaction.customId.startsWith('recruit_modal_')) {
    await interaction.deferReply({ ephemeral: true });
    const branch = interaction.customId.replace('recruit_modal_', '');
    const nick = interaction.fields.getTextInputValue('r_nick')?.trim() || 'Не указано';
    const staticId = interaction.fields.getTextInputValue('r_static')?.trim() || 'Не указано';
    const exp = interaction.fields.getTextInputValue('r_exp')?.trim() || 'Не указано';

    const catId = config.CHANNELS.RECRUIT_CATEGORY || config.CHANNELS.PORTFOLIO_CATEGORY;
    const callerRoles = [
      ...(settings.CALLERS.RECRUIT_CALLER_ROLES || []),
      ...(settings.CALLERS.RECRUIT_PING_ROLES || []),
      config.ROLES.HIGH_STAFF
    ].filter(Boolean);

    const uniqueStaffRoles = [...new Set(callerRoles)];
    const overwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ...uniqueStaffRoles.map(roleId => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      }))
    ];

    const safeName = `заявка-${interaction.user.username.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '') || interaction.user.id}`.slice(0, 30);
    const ticketCh = await interaction.guild.channels.create({
      name: safeName,
      type: ChannelType.GuildText,
      parent: catId || undefined,
      topic: `Заявка в семью | Кандидат: ${interaction.user.id} | Направление: ${branch}`,
      permissionOverwrites: overwrites
    }).catch(() => null);

    if (!ticketCh) {
      return interaction.editReply({ content: '❌ Не удалось создать личный канал заявки. Обратитесь к старшему составу.' });
    }

    const pingRoles = (settings.CALLERS.RECRUIT_PING_ROLES || []).map(id => `<@&${id}>`).join(' ');
    const appEmbed = new EmbedBuilder()
      .setTitle(`📋 Новая заявка в семью | ${branch}-состав`)
      .setColor(branch === 'Capt' ? '#E74C3C' : '#3498DB')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Кандидат', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
        { name: '🎯 Направление', value: `**${branch}**`, inline: true },
        { name: '🪪 Ник и Возраст', value: nick, inline: false },
        { name: '🔢 Статик и онлайн', value: staticId, inline: false },
        { name: '🎥 Опыт и откаты', value: exp.slice(0, 1024), inline: false }
      )
      .setTimestamp();

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_call_${interaction.user.id}_${branch}`).setLabel('📞 Вызвать на обзвон').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rec_accept_${interaction.user.id}_${branch}`).setLabel('✅ Принять в семью').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_decline_${interaction.user.id}_${branch}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('rec_close_ticket').setLabel('🔒 Закрыть канал').setStyle(ButtonStyle.Secondary)
    );

    await ticketCh.send({
      content: `${pingRoles} <@${interaction.user.id}> — ваша заявка принята в обработку!`,
      embeds: [appEmbed],
      components: [controls]
    });

    const cfg = getMergedPanelConfig('RECRUIT');
    return interaction.editReply({
      content: `${cfg.replySent || '✅ Заявка создана!'}\n👉 Ваш личный канал: ${ticketCh}`
    });
  }
  // Кнопки управления заявкой (Вызвать на обзвон / Принять / Отклонить / Закрыть канал)
  if (interaction.isButton() && interaction.customId.startsWith('rec_')) {
    if (!canHandleRecruit(interaction.member)) {
      return interaction.reply({ content: '❌ У вас нет прав для обработки заявок в семью!', ephemeral: true });
    }

    if (interaction.customId === 'rec_close_ticket') {
      await interaction.reply({ content: '🔒 Канал заявки будет удалён через 5 секунд...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const targetId = parts[2];
    const branch = parts[3] || 'RP';

    if (action === 'call') {
      const voiceLink = config.CHANNELS.WAITING_VOICE ? `<#${config.CHANNELS.WAITING_VOICE}>` : 'голосовой канал ожидания';
      const chMsg = (settings.CALLERS.RECRUIT_CALL_CHANNEL_MSG || '📞 {caller} вызывает {candidate} на обзвон в {voice}!')
        .replace('{caller}', `<@${interaction.user.id}>`)
        .replace('{candidate}', `<@${targetId}>`)
        .replace('{voice}', voiceLink);

      const dmMsg = (settings.CALLERS.RECRUIT_CALL_DM_MSG || '📞 Обзвонник **{caller}** вызывает вас на обзвон в **{guild}**! Зайдите в {voice}')
        .replace('{caller}', interaction.member.displayName)
        .replace('{guild}', interaction.guild.name)
        .replace('{voice}', voiceLink);

      const targetUser = await client.users.fetch(targetId).catch(() => null);
      if (targetUser) await targetUser.send(dmMsg).catch(() => {});

      return interaction.reply({ content: `${chMsg}\n\n${settings.CALLERS.CHECKLIST || ''}` });
    }

    if (action === 'accept') {
      const modal = new ModalBuilder()
        .setCustomId(`rec_accmodal_${targetId}_${branch}`)
        .setTitle('Одобрение заявки в семью');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('final_nick')
            .setLabel('Ник по форме (Имя_Фамилия | #Статик)')
            .setPlaceholder('Например: Ivan_Begov | #12345')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (action === 'decline') {
      const modal = new ModalBuilder()
        .setCustomId(`rec_decmodal_${targetId}_${branch}`)
        .setTitle('Отклонение заявки');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('dec_reason')
            .setLabel('Причина отказа')
            .setPlaceholder('Например: Слабые откаты / нет 16 лет')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }
  }

  // Модалка принятия в семью
  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_accmodal_')) {
    const [, , targetId, branch] = interaction.customId.split('_');
    const finalNick = interaction.fields.getTextInputValue('final_nick').trim();
    const member = await interaction.guild.members.fetch(targetId).catch(() => null);

    if (member) {
      const joinCfg = settings.getJoinRoles(branch);
      if (Array.isArray(joinCfg.add) && joinCfg.add.length > 0) {
        await member.roles.add(joinCfg.add).catch(() => {});
      }
      if (Array.isArray(joinCfg.remove) && joinCfg.remove.length > 0) {
        await member.roles.remove(joinCfg.remove).catch(() => {});
      }
      await member.setNickname(finalNick).catch(() => {});
      await member.send(`✅ Поздравляем! Ваша заявка в семью **${interaction.guild.name}** (${branch}) одобрена рекрутом **${interaction.member.displayName}**!`).catch(() => {});
    }

    addRecruitStat(interaction.user.id, 'accepted');

    if (config.CHANNELS.RECRUIT_RESULTS) {
      const resCh = interaction.guild.channels.cache.get(config.CHANNELS.RECRUIT_RESULTS);
      if (resCh) {
        const resEmbed = new EmbedBuilder()
          .setTitle('✅ Заявка в семью одобрена')
          .setColor('#2ECC71')
          .setDescription(`**Кандидат:** <@${targetId}>\n**Направление:** ${branch}\n**Ник:** \`${finalNick}\`\n**Принял:** <@${interaction.user.id}>`)
          .setTimestamp();
        resCh.send({ content: `<@${targetId}>`, embeds: [resEmbed] }).catch(() => {});
      }
    }

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rec_close_ticket').setLabel('🔒 Закрыть канал заявки').setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content: `✅ Кандидат <@${targetId}> принят в **${branch}-состав** с ником \`${finalNick}\`!`,
      components: [closeRow]
    });
  }

  // Модалка отклонения заявки
  if (interaction.isModalSubmit() && interaction.customId.startsWith('rec_decmodal_')) {
    const [, , targetId, branch] = interaction.customId.split('_');
    const reason = interaction.fields.getTextInputValue('dec_reason').trim();

    const targetUser = await client.users.fetch(targetId).catch(() => null);
    if (targetUser) {
      await targetUser.send(`❌ Ваша заявка в семью **${interaction.guild.name}** (${branch}) отклонена.\n**Причина:** ${reason}`).catch(() => {});
    }

    addRecruitStat(interaction.user.id, 'declined');

    if (config.CHANNELS.RECRUIT_RESULTS) {
      const resCh = interaction.guild.channels.cache.get(config.CHANNELS.RECRUIT_RESULTS);
      if (resCh) {
        const resEmbed = new EmbedBuilder()
          .setTitle('❌ Заявка в семью отклонена')
          .setColor('#E74C3C')
          .setDescription(`**Кандидат:** <@${targetId}>\n**Направление:** ${branch}\n**Причина:** ${reason}\n**Рассмотрел:** <@${interaction.user.id}>`)
          .setTimestamp();
        resCh.send({ content: `<@${targetId}>`, embeds: [resEmbed] }).catch(() => {});
      }
    }

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rec_close_ticket').setLabel('🔒 Закрыть канал заявки').setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content: `❌ Заявка кандидата <@${targetId}> отклонена. Причина: **${reason}**`,
      components: [closeRow]
    });
  }
}

module.exports = {
  recruitCommand,
  recruitCommands: [recruitCommand],
  handleRecruit
};
