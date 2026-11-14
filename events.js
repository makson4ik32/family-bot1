const config = require('./config');
const settings = require('./settings');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const activeEvents = new Map();

const eventCommand = new SlashCommandBuilder()
  .setName('панель_сборов')
  .setDescription('Отправить в этот канал панель для запуска сборов на Капты, MCL, ВЗ и РП')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function getMemberPriority(member) {
  const priorities = config.EVENTS?.ROLE_PRIORITIES || [];
  let best = { priority: 99, label: '' };

  for (const p of priorities) {
    if (p.roleId && member.roles.cache.has(p.roleId) && p.priority < best.priority) {
      best = { priority: p.priority, label: p.label };
    }
  }
  return best;
}

function buildEventEmbed(eventData) {
  const sorted = [...eventData.participants.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.joinedAt - b.joinedAt;
  });

  const mainList = sorted.slice(0, eventData.maxSlots);
  const reserveList = sorted.slice(eventData.maxSlots);

  const formatUser = (u, idx) => {
    const tag = u.roleLabel ? ` **[${u.roleLabel}]**` : '';
    return `${idx + 1}. <@${u.id}>${tag}`;
  };

  const mainText = mainList.length > 0
    ? mainList.map((u, i) => formatUser(u, i)).join('\n')
    : '*Пока никого нет. Нажми «Записаться (+)»!*';

  let color = settings.resolveColor(settings.PANELS.EVENTS.color, '#E74C3C');
  let statusText = '🟢 **Идёт набор**';

  if (eventData.result === 'WIN') {
    color = '#2ECC71';
    statusText = '🏆 **ПОБЕДА (WIN)**';
  } else if (eventData.result === 'LOSE') {
    color = '#992D22';
    statusText = '💀 **ПОРАЖЕНИЕ (LOSE)**';
  } else if (eventData.closed) {
    color = '#95A5A6';
    statusText = '🔒 **Запись закрыта**';
  }

  const embed = new EmbedBuilder()
    .setTitle(`${eventData.type} | Сбор состава`)
    .setColor(color)
    .addFields(
      { name: '⏰ Время сбора', value: `**${eventData.time}**`, inline: true },
      { name: '📍 Где сбор', value: `**${eventData.location}**`, inline: true },
      { name: '👥 Слоты', value: `**${sorted.length}** / ${eventData.maxSlots}`, inline: true },
      { name: '📢 Статус', value: statusText, inline: true }
    )
    .setFooter({ text: `Организатор: ${eventData.organizerTag}` })
    .setTimestamp();

  if (eventData.description) {
    embed.setDescription(`📌 **Доп. информация:** ${eventData.description}`);
  }

  embed.addFields({
    name: `📋 Основной состав (${mainList.length}/${eventData.maxSlots})`,
    value: mainText.slice(0, 1024),
    inline: false
  });

  if (reserveList.length > 0) {
    const reserveText = reserveList.map((u, i) => formatUser(u, i)).join('\n');
    embed.addFields({
      name: `⏳ Запас / Очередь (${reserveList.length})`,
      value: reserveText.slice(0, 1024),
      inline: false
    });
  }

  return embed;
}

function buildEventButtons(closed) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('evt_join').setLabel('✅ Записаться (+)').setStyle(ButtonStyle.Success).setDisabled(closed),
      new ButtonBuilder().setCustomId('evt_leave').setLabel('❌ Выписаться (-)').setStyle(ButtonStyle.Danger).setDisabled(closed),
      new ButtonBuilder().setCustomId('evt_manage').setLabel('⚙️ Управление сбором').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function isEventOrganizer(member) {
  const staffRoles = [config.ROLES.HIGH_STAFF, config.ROLES.CHECKER, config.ROLES.CALLER, config.ROLES.COACH].filter(Boolean);
  return staffRoles.some(r => member.roles.cache.has(r)) || member.permissions.has(PermissionFlagsBits.Administrator);
}

function isFamilyMember(member) {
  const familyRoles = [
    config.ROLES.FAMQ, config.ROLES.RP_SQUAD, config.ROLES.CAPT_SQUAD,
    config.ROLES.TIER_1, config.ROLES.TIER_2, config.ROLES.TIER_3,
    config.ROLES.CALLER, config.ROLES.COACH, config.ROLES.HIGH_STAFF
  ].filter(Boolean);
  return familyRoles.some(r => member.roles.cache.has(r)) || member.permissions.has(PermissionFlagsBits.Administrator);
}

async function handleEvents(interaction, client) {
  const evtCfg = settings.PANELS.EVENTS;

  // 1. Отправка постоянной панели создания сборов
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_сборов') {
    const embed = settings.applyPanelStyle(new EmbedBuilder(), evtCfg, '#E74C3C');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('evt_create_capt').setLabel(evtCfg.btnCapt || '🔫 Капт').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('evt_create_mcl').setLabel(evtCfg.btnMcl || '🏆 MCL / Турнир').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('evt_create_vz').setLabel(evtCfg.btnVz || '📦 ВЗ / Поставка / ФЗ').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('evt_create_rp').setLabel(evtCfg.btnRp || '🎭 Семейное РП').setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель создания сборов успешно отправлена!', ephemeral: true });
  }

  // 2. Нажатие кнопки создания сбора
  if (interaction.isButton() && interaction.customId.startsWith('evt_create_')) {
    if (!isEventOrganizer(interaction.member)) {
      return interaction.reply({ content: '❌ Запускать сборы могут только Коллер, Коуч или старший состав!', ephemeral: true });
    }

    const typeKey = interaction.customId.replace('evt_create_', '');
    const typeNames = {
      capt: evtCfg.btnCapt || '🔫 Капт',
      mcl: evtCfg.btnMcl || '🏆 MCL',
      vz: evtCfg.btnVz || '📦 ВЗ / Поставка',
      rp: evtCfg.btnRp || '🎭 Семейное РП'
    };

    const modal = new ModalBuilder()
      .setCustomId(`evt_submit_${typeKey}`)
      .setTitle(`Сбор: ${typeNames[typeKey]}`.slice(0, 45));

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('evt_time').setLabel('Время сбора').setPlaceholder('Например: 18:30 по МСК (за 15 минут до начала)').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('evt_location').setLabel('Где сбор (место / голосовой / карта)').setPlaceholder('Например: Респа / Войс Капты / Карта Завод').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('evt_slots').setLabel('Сколько слотов (число мест в основу)').setPlaceholder('Например: 25').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('evt_desc').setLabel('Дресс-код / оружие (необязательно)').setPlaceholder('Например: Чёрный верх, тяжки, броники').setStyle(TextInputStyle.Paragraph).setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }

  // 3. Публикация сбора
  if (interaction.isModalSubmit() && interaction.customId.startsWith('evt_submit_')) {
    const typeKey = interaction.customId.replace('evt_submit_', '');
    const typeNames = {
      capt: evtCfg.btnCapt || '🔫 Капт',
      mcl: evtCfg.btnMcl || '🏆 MCL',
      vz: evtCfg.btnVz || '📦 ВЗ / Поставка',
      rp: evtCfg.btnRp || '🎭 Семейное РП'
    };

    const time = interaction.fields.getTextInputValue('evt_time');
    const location = interaction.fields.getTextInputValue('evt_location');
    const slotsRaw = parseInt(interaction.fields.getTextInputValue('evt_slots'), 10);
    const maxSlots = (!isNaN(slotsRaw) && slotsRaw > 0 && slotsRaw <= 100) ? slotsRaw : 25;
    const description = interaction.fields.getTextInputValue('evt_desc') || '';

    const targetChannelId = typeKey === 'capt'
      ? (config.CHANNELS.CAPT_TAGS || config.CHANNELS.TAGS)
      : config.CHANNELS.TAGS;

    const tagsChannel = client.channels.cache.get(targetChannelId);
    if (!tagsChannel) {
      return interaction.reply({ content: '❌ Канал «Теги» не найден! Проверь `CHANNELS.TAGS` и `CAPT_TAGS` в `config.js`.', ephemeral: true });
    }

    const eventData = {
      type: typeNames[typeKey],
      channelId: tagsChannel.id,
      time,
      location,
      maxSlots,
      description,
      organizerId: interaction.user.id,
      organizerTag: interaction.user.tag,
      closed: false,
      result: null,
      participants: new Map()
    };

    const msg = await tagsChannel.send({
      content: `@everyone Новый сбор на **${eventData.type}**!`,
      embeds: [buildEventEmbed(eventData)],
      components: buildEventButtons(false)
    });

    activeEvents.set(msg.id, eventData);
    return interaction.reply({ content: `✅ Сбор успешно создан и опубликован в канале <#${tagsChannel.id}>!`, ephemeral: true });
  }

    // 4. Кнопки на самом сообщении сбора
  if (interaction.isButton() && ['evt_join', 'evt_leave', 'evt_manage'].includes(interaction.customId)) {
    const eventData = activeEvents.get(interaction.message.id);
    if (!eventData) {
      return interaction.reply({ content: '⚠️ Этот сбор устарел или бот был перезагружен.', ephemeral: true });
    }

    if (interaction.customId === 'evt_join') {
      if (!isFamilyMember(interaction.member)) {
        return interaction.reply({ content: '❌ Записываться на сборы могут только участники семьи!', ephemeral: true });
      }
      if (eventData.closed) {
        return interaction.reply({ content: '🔒 Регистрация на это мероприятие уже закрыта!', ephemeral: true });
      }
      if (eventData.participants.has(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ Ты уже записан в список!', ephemeral: true });
      }

      const { priority, label } = getMemberPriority(interaction.member);
      eventData.participants.set(interaction.user.id, {
        id: interaction.user.id,
        priority,
        roleLabel: label,
        joinedAt: Date.now()
      });

      return interaction.update({ embeds: [buildEventEmbed(eventData)], components: buildEventButtons(eventData.closed) });
    }

    if (interaction.customId === 'evt_leave') {
      if (!eventData.participants.has(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ Тебя и так нет в списке участников.', ephemeral: true });
      }
      eventData.participants.delete(interaction.user.id);
      return interaction.update({ embeds: [buildEventEmbed(eventData)], components: buildEventButtons(eventData.closed) });
    }

    if (interaction.customId === 'evt_manage') {
      if (interaction.user.id !== eventData.organizerId && !isEventOrganizer(interaction.member)) {
        return interaction.reply({ content: '❌ Управлять сбором может только организатор, Коллер, Коуч или старший состав.', ephemeral: true });
      }

      const msgId = interaction.message.id;
      const adminRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`evt_pull_${msgId}`).setLabel('🔊 Стянуть всех в войс').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`evt_ping_${msgId}`).setLabel('📢 Тегнуть кого нет в войсе').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`evt_toggle_${msgId}`).setLabel(eventData.closed ? '🔓 Открыть запись' : '🔒 Закрыть запись').setStyle(ButtonStyle.Secondary)
      );

      const adminRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`evt_time_${msgId}`).setLabel('✏️ Изменить данные сбора').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`evt_win_${msgId}`).setLabel('🏆 Победа (WIN)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`evt_lose_${msgId}`).setLabel('💀 Поражение (LOSE)').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: `⚙️ **Панель управления сбором (${eventData.type} | ${eventData.time}):**`,
        components: [adminRow1, adminRow2],
        ephemeral: true
      });
    }
  }

  // 5. Действия из панели управления
  if (interaction.isButton() && interaction.customId.startsWith('evt_')) {
    const parts = interaction.customId.split('_');
    const action = parts.at(1);
    const msgId = parts.at(2);
    const eventData = activeEvents.get(msgId);
    if (!eventData) {
      return interaction.reply({ content: '⚠️ Сбор не найден или уже завершён.', ephemeral: true });
    }

    const tagsChannel = client.channels.cache.get(eventData.channelId || config.CHANNELS.TAGS) || interaction.channel;
    const targetMessage = await tagsChannel.messages.fetch(msgId).catch(() => null);
    const voiceChannelId = interaction.member.voice?.channelId || config.EVENTS?.CAPTS_VOICE_ID;

    if (action === 'pull') {
      if (!voiceChannelId) {
        return interaction.reply({ content: '❌ Зайди в голосовой канал или укажи `CAPTS_VOICE_ID` в `config.js`!', ephemeral: true });
      }
      let movedCount = 0;
      for (const userId of eventData.participants.keys()) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && member.voice.channelId && member.voice.channelId !== voiceChannelId) {
          await member.voice.setChannel(voiceChannelId).then(() => movedCount++).catch(() => {});
        }
      }
      return interaction.reply({ content: `🔊 Перемещено игроков в канал <#${voiceChannelId}>: **${movedCount} чел.**`, ephemeral: true });
    }

    if (action === 'ping') {
      const missingMentions = [];
      for (const userId of eventData.participants.keys()) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && (!member.voice.channelId || (voiceChannelId && member.voice.channelId !== voiceChannelId))) {
          missingMentions.push(`<@${userId}>`);
        }
      }
      if (missingMentions.length === 0) {
        return interaction.reply({ content: '✅ Все записавшиеся игроки уже сидят в голосовом канале!', ephemeral: true });
      }
      await tagsChannel.send({
        content: `⏰ **Срочно заходим в голосовой канал на ${eventData.type} (${eventData.time})!**\nОтсутствуют: ${missingMentions.join(' ')}`
      });
      return interaction.reply({ content: `📢 Упомянуто отсутствующих игроков: **${missingMentions.length} чел.**`, ephemeral: true });
    }

    if (action === 'toggle') {
      eventData.closed = !eventData.closed;
      if (targetMessage) {
        await targetMessage.edit({ embeds: [buildEventEmbed(eventData)], components: buildEventButtons(eventData.closed) });
      }
      return interaction.reply({ content: eventData.closed ? '🔒 Запись на мероприятие закрыта.' : '🔓 Запись снова открыта!', ephemeral: true });
    }

    if (action === 'time') {
      const modal = new ModalBuilder().setCustomId(`evt_modaledit_${msgId}`).setTitle('Изменение параметров сбора');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_type').setLabel('Название мероприятия').setValue(eventData.type).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_time').setLabel('Время сбора').setValue(eventData.time).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_location').setLabel('Где сбор (место / карта)').setValue(eventData.location).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_slots').setLabel('Сколько слотов').setValue(String(eventData.maxSlots)).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_desc').setLabel('Дополнительная информация').setValue(eventData.description || '').setStyle(TextInputStyle.Paragraph).setRequired(false))
      );
      return interaction.showModal(modal);
    }

    if (action === 'win' || action === 'lose') {
      const isWin = action === 'win';
      eventData.closed = true;
      eventData.result = isWin ? 'WIN' : 'LOSE';

      if (targetMessage) {
        const finalEmbed = buildEventEmbed(eventData).setTitle(`${isWin ? '🏆 ПОБЕДА' : '💀 ПОРАЖЕНИЕ'} | ${eventData.type}`);
        await targetMessage.edit({ content: '', embeds: [finalEmbed], components: [] });
      }

      activeEvents.delete(msgId);
      return interaction.reply({
        content: isWin ? '🏆 Поздравляем с победой! Итог зафиксирован, запись закрыта.' : '💀 Зафиксировано поражение. Итог обновлён, запись закрыта.',
        ephemeral: true
      });
    }
  }

  // 6. Обработка модального окна редактирования сбора
  if (interaction.isModalSubmit() && interaction.customId.startsWith('evt_modaledit_')) {
    const msgId = interaction.customId.replace('evt_modaledit_', '');
    const eventData = activeEvents.get(msgId);
    if (!eventData) return interaction.reply({ content: '⚠️ Сбор не найден.', ephemeral: true });

    eventData.type = interaction.fields.getTextInputValue('new_type');
    eventData.time = interaction.fields.getTextInputValue('new_time');
    eventData.location = interaction.fields.getTextInputValue('new_location');
    const slotsRaw = parseInt(interaction.fields.getTextInputValue('new_slots'), 10);
    if (!isNaN(slotsRaw) && slotsRaw > 0 && slotsRaw <= 100) eventData.maxSlots = slotsRaw;
    eventData.description = interaction.fields.getTextInputValue('new_desc');

    const tagsChannel = client.channels.cache.get(eventData.channelId || config.CHANNELS.TAGS) || interaction.channel;
    const targetMessage = await tagsChannel.messages.fetch(msgId).catch(() => null);
    if (targetMessage) {
      await targetMessage.edit({ embeds: [buildEventEmbed(eventData)], components: buildEventButtons(eventData.closed) });
    }

    return interaction.reply({ content: '✅ Данные сбора (название, время, место и слоты) обновлены!', ephemeral: true });
  }
}

module.exports = { eventCommand, handleEvents };


