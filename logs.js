const config = require('./config');
const SERVER_LOGS_CHANNEL_ID = config.CHANNELS.SERVER_LOGS;
const ADMIN_LOGS_CHANNEL_ID = config.CHANNELS.ADMIN_LOGS;

const { EmbedBuilder, AuditLogEvent } = require('discord.js');

function setupLogs(client) {
  async function sendLog(channelId, embed) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  async function getExecutor(guild, type, targetId) {
    try {
      await new Promise(res => setTimeout(res, 750));
      const fetchedLogs = await guild.fetchAuditLogs({ limit: 5, type });
      const entry = fetchedLogs.entries.find(e => {
        const isTargetMatch = targetId ? e.target?.id === targetId : true;
        const isRecent = Date.now() - e.createdTimestamp < 12000;
        return isTargetMatch && isRecent;
      });
      return entry || null;
    } catch {
      return null;
    }
  }

  // ==================== ЗАЩИТА ОТ СНОСА (ANTI-RAID) ====================
  async function triggerAntiRaid(guild, executor, actionText) {
    if (!executor) return;
    // Не трогаем самого бота и владельцев из config.js
    if (executor.id === client.user.id || config.OWNER_IDS.includes(executor.id)) return;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    let punishStatus = '⚠️ Не удалось снять роли (роль нарушителя выше роли бота).';

    if (member && member.manageable) {
      const rolesCount = member.roles.cache.size - 1;
      await member.roles.set([], 'Система Анти-снос: несанкционированное удаление').catch(() => {});
      punishStatus = `✅ С нарушителя моментально сняты все роли (${rolesCount} шт.)!`;
    }

    const alertEmbed = new EmbedBuilder()
      .setTitle('🚨 СРАБОТАЛА СИСТЕМА АНТИ-СНОС!')
      .setColor('#FF0000')
      .addFields(
        { name: '👤 Нарушитель', value: `<@${executor.id}> (${executor.tag})`, inline: true },
        { name: '💥 Действие', value: actionText, inline: true },
        { name: '🛡 Итог', value: punishStatus, inline: false }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, alertEmbed);

    // Отправляем тревогу в ЛС всем владельцам сервера
    for (const ownerId of config.OWNER_IDS) {
      const owner = await client.users.fetch(ownerId).catch(() => null);
      if (owner) await owner.send({ embeds: [alertEmbed] }).catch(() => {});
    }
  }

  // ==================== 1. УЧАСТНИКИ ====================
  client.on('guildMemberAdd', async member => {
    const embed = new EmbedBuilder()
      .setTitle('📥 Новый участник на сервере')
      .setColor('#2ECC71')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '👤 Пользователь', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
        { name: '📅 Аккаунт создан', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
      )
      .setFooter({ text: `Всего участников: ${member.guild.memberCount}` })
      .setTimestamp();

    await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
  });

  client.on('guildMemberRemove', async member => {
    const roles = member.roles.cache
      .filter(r => r.id !== member.guild.id)
      .map(r => `<@&${r.id}>`)
      .join(', ') || 'Нет ролей';

    const kickEntry = await getExecutor(member.guild, AuditLogEvent.MemberKick, member.id);

    if (kickEntry) {
      const kickEmbed = new EmbedBuilder()
        .setTitle('👢 Участник КИКНУТ с сервера')
        .setColor('#E67E22')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '👤 Кикнут', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: '👮 Кикнул', value: `<@${kickEntry.executor.id}> (${kickEntry.executor.tag})`, inline: true },
          { name: '📝 Причина', value: kickEntry.reason || 'Не указана', inline: false },
          { name: '🎭 Были роли', value: roles, inline: false }
        )
        .setTimestamp();

      await sendLog(ADMIN_LOGS_CHANNEL_ID, kickEmbed);
    } else {
      const leaveEmbed = new EmbedBuilder()
        .setTitle('📤 Участник покинул сервер')
        .setColor('#E74C3C')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '👤 Пользователь', value: `${member.user.tag} (\`${member.id}\`)`, inline: false },
          { name: '🎭 Были роли', value: roles, inline: false }
        )
        .setTimestamp();

      await sendLog(SERVER_LOGS_CHANNEL_ID, leaveEmbed);
    }
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Смена никнейма
    if (oldMember.nickname !== newMember.nickname) {
      const nickEntry = await getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const executorText = nickEntry ? `<@${nickEntry.executor.id}>` : 'Сам участник / Неизвестно';

      const embed = new EmbedBuilder()
        .setTitle('✏️ Изменение никнейма')
        .setColor('#3498DB')
        .addFields(
          { name: '👤 Участник', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
          { name: '👮 Изменил', value: executorText, inline: true },
          { name: 'Было', value: oldMember.nickname || oldMember.user.username, inline: true },
          { name: 'Стало', value: newMember.nickname || newMember.user.username, inline: true }
        )
        .setTimestamp();

      await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
    }

    // Выдача или снятие ролей
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const roleEntry = await getExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      const executorText = roleEntry ? `<@${roleEntry.executor.id}> (${roleEntry.executor.tag})` : 'Система / Неизвестно';

      const embed = new EmbedBuilder()
        .setTitle('🎭 Изменение ролей участника')
        .setColor(removedRoles.size > 0 && addedRoles.size === 0 ? '#E74C3C' : '#9B59B6')
        .addFields(
          { name: '👤 Участник', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
          { name: '👮 Изменил', value: executorText, inline: true }
        )
        .setTimestamp();

      if (addedRoles.size > 0) {
        embed.addFields({ name: '➕ Выданы роли', value: addedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join('\n'), inline: false });
      }
      if (removedRoles.size > 0) {
        embed.addFields({ name: '➖ Сняты роли', value: removedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join('\n'), inline: false });
      }

      await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
    }

    // Тайм-аут (Мут)
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const muteEntry = await getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const executorText = muteEntry ? `<@${muteEntry.executor.id}>` : 'Неизвестно';

      if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now()) {
        const untilUnix = Math.floor(newMember.communicationDisabledUntilTimestamp / 1000);
        const muteEmbed = new EmbedBuilder()
          .setTitle('🔇 Выдан тайм-аут (МУТ)')
          .setColor('#E67E22')
          .addFields(
            { name: '👤 Участник', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: '👮 Выдал', value: executorText, inline: true },
            { name: '⏳ До', value: `<t:${untilUnix}:f> (<t:${untilUnix}:R>)`, inline: false },
            { name: '📝 Причина', value: muteEntry?.reason || 'Не указана', inline: false }
          )
          .setTimestamp();

        await sendLog(ADMIN_LOGS_CHANNEL_ID, muteEmbed);
      } else {
        const unmuteEmbed = new EmbedBuilder()
          .setTitle('🔊 Снят тайм-аут (РАЗМУТ)')
          .setColor('#2ECC71')
          .addFields(
            { name: '👤 Участник', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: '👮 Снял', value: executorText, inline: true }
          )
          .setTimestamp();

        await sendLog(ADMIN_LOGS_CHANNEL_ID, unmuteEmbed);
      }
    }

    // Буст сервера
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const boostEmbed = new EmbedBuilder()
        .setTitle('💎 Новый буст сервера!')
        .setColor('#F47FFF')
        .setDescription(`Участник <@${newMember.id}> (${newMember.user.tag}) забустил сервер!`)
        .setTimestamp();

      await sendLog(SERVER_LOGS_CHANNEL_ID, boostEmbed);
    }
  });

  // ==================== 2. СООБЩЕНИЯ И РЕАКЦИИ ====================
  client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;

    const attachments = message.attachments.size > 0 ? message.attachments.map(a => a.url).join('\n') : null;
    const embed = new EmbedBuilder()
      .setTitle('🗑 Сообщение удалено')
      .setColor('#E67E22')
      .addFields(
        { name: '👤 Автор', value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Неизвестно', inline: true },
        { name: '📍 Канал', value: `<#${message.channel.id}>`, inline: true },
        { name: '💬 Текст', value: message.content ? message.content.slice(0, 1000) : '*[Без текста]*', inline: false }
      )
      .setTimestamp();

    if (attachments) embed.addFields({ name: '📎 Вложения', value: attachments.slice(0, 1000), inline: false });
    await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
  });

  client.on('messageDeleteBulk', async (messages, channel) => {
    if (!channel.guild) return;
    const entry = await getExecutor(channel.guild, AuditLogEvent.MessageBulkDelete, null);
    const executorText = entry ? `<@${entry.executor.id}>` : 'Неизвестно';

    const embed = new EmbedBuilder()
      .setTitle('🧹 Массовая очистка сообщений')
      .setColor('#E74C3C')
      .addFields(
        { name: '📍 Канал', value: `<#${channel.id}>`, inline: true },
        { name: '📊 Удалено сообщений', value: `**${messages.size} шт.**`, inline: true },
        { name: '👮 Очистил', value: executorText, inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;

        // Закрепление / открепление сообщения
    if (oldMessage.pinned !== newMessage.pinned) {
      const pinEmbed = new EmbedBuilder()
        .setTitle(newMessage.pinned ? '📌 Сообщение закреплено' : '📍 Сообщение откреплено')
        .setColor('#3498DB')
        .addFields(
          { name: '👤 Автор сообщения', value: `<@${newMessage.author.id}>`, inline: true },
          { name: '📍 Канал', value: `<#${newMessage.channel.id}>`, inline: true },
          { name: '🔗 Ссылка', value: `[Перейти к сообщению](${newMessage.url})`, inline: true }
        )
        .setTimestamp();

      return sendLog(SERVER_LOGS_CHANNEL_ID, pinEmbed);
    }

    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setTitle('📝 Сообщение изменено')
      .setColor('#F1C40F')
      .addFields(
        { name: '👤 Автор', value: `<@${newMessage.author.id}> в канале <#${newMessage.channel.id}>`, inline: false },
        { name: 'Было', value: oldMessage.content ? oldMessage.content.slice(0, 500) : '*Пусто*', inline: false },
        { name: 'Стало', value: newMessage.content ? newMessage.content.slice(0, 500) : '*Пусто*', inline: false }
      )
      .setTimestamp();

    await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
  });

  client.on('messageReactionRemoveAll', async message => {
    if (!message.guild) return;
    const embed = new EmbedBuilder()
      .setTitle('🚫 Сняты все реакции с сообщения')
      .setColor('#95A5A6')
      .addFields(
        { name: '📍 Канал', value: `<#${message.channel.id}>`, inline: true },
        { name: '🔗 Ссылка', value: `[Перейти к сообщению](${message.url})`, inline: true }
      )
      .setTimestamp();

    await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
  });

  // ==================== 3. ГОЛОСОВЫЕ КАНАЛЫ (ПОЛНЫЙ КОНТРОЛЬ) ====================
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const actions = [];
    let color = '#95A5A6';

    // Вход / выход / переход / перемещение / кик из войса
    if (!oldState.channelId && newState.channelId) {
      actions.push(`🔊 Зашёл в голосовой канал <#${newState.channelId}>`);
      color = '#2ECC71';
    } else if (oldState.channelId && !newState.channelId) {
      const discEntry = await getExecutor(member.guild, AuditLogEvent.MemberDisconnect, null);
      if (discEntry) {
        actions.push(`👢 Отключён от канала <#${oldState.channelId}> модератором <@${discEntry.executor.id}>`);
      } else {
        actions.push(`🔇 Вышел из голосового канала <#${oldState.channelId}>`);
      }
      color = '#E74C3C';
    } else if (oldState.channelId !== newState.channelId) {
      const moveEntry = await getExecutor(member.guild, AuditLogEvent.MemberMove, null);
      if (moveEntry) {
        actions.push(`🔀 Перемещён из <#${oldState.channelId}> в <#${newState.channelId}> модератором <@${moveEntry.executor.id}>`);
      } else {
        actions.push(`🔄 Перешёл из <#${oldState.channelId}> в <#${newState.channelId}>`);
      }
      color = '#3498DB';
    }

    // Серверный мут микрофона / наушников
    if (oldState.serverMute !== newState.serverMute) {
      actions.push(newState.serverMute ? '🎙❌ Серверный мут микрофона ВКЛЮЧЁН' : '🎙✅ Серверный мут микрофона СНЯТ');
      color = '#E67E22';
    }
    if (oldState.serverDeaf !== newState.serverDeaf) {
      actions.push(newState.serverDeaf ? '🎧❌ Серверное отключение звука ВКЛЮЧЕНО' : '🎧✅ Серверное отключение звука СНЯТО');
      color = '#E67E22';
    }

    // Стрим (демонстрация экрана) и камера
    if (oldState.streaming !== newState.streaming) {
      actions.push(newState.streaming ? `🖥 Запустил стрим в <#${newState.channelId}>` : `🖥 Завершил стрим в <#${newState.channelId}>`);
      color = '#9B59B6';
    }
    if (oldState.selfVideo !== newState.selfVideo) {
      actions.push(newState.selfVideo ? `📹 Включил веб-камеру` : `📹 Выключил веб-камеру`);
    }

    if (actions.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('🎙 Активность в голосовом канале')
        .setColor(color)
        .setDescription(`**Участник:** <@${member.id}> (${member.user.tag})\n${actions.join('\n')}`)
        .setTimestamp();

      await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
    }
  });

  // ==================== 4. БАНЫ И ПРИГЛАШЕНИЯ ====================
  client.on('guildBanAdd', async ban => {
    const banEntry = await getExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const executorText = banEntry ? `<@${banEntry.executor.id}> (${banEntry.executor.tag})` : 'Неизвестно';

    const embed = new EmbedBuilder()
      .setTitle('🔨 Выдан БАН на сервере')
      .setColor('#992D22')
      .addFields(
        { name: '👤 Забанен', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: '👮 Забанил', value: executorText, inline: true },
        { name: '📝 Причина', value: ban.reason || banEntry?.reason || 'Не указана', inline: false }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('guildBanRemove', async ban => {
    const unbanEntry = await getExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    const executorText = unbanEntry ? `<@${unbanEntry.executor.id}> (${unbanEntry.executor.tag})` : 'Неизвестно';

    const embed = new EmbedBuilder()
      .setTitle('🔓 Снят БАН (Разбан)')
      .setColor('#2ECC71')
      .addFields(
        { name: '👤 Разбанен', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: '👮 Разбанил', value: executorText, inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('inviteCreate', async invite => {
    if (!invite.guild) return;
    const embed = new EmbedBuilder()
      .setTitle('🔗 Создана ссылка-приглашение')
      .setColor('#1ABC9C')
      .addFields(
        { name: '👤 Создал', value: invite.inviter ? `<@${invite.inviter.id}>` : 'Неизвестно', inline: true },
        { name: '📍 Канал', value: invite.channel ? `<#${invite.channel.id}>` : 'Неизвестно', inline: true },
        { name: '🔑 Код', value: `\`discord.gg/${invite.code}\` (Макс. исп.: ${invite.maxUses || '∞'})`, inline: false }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('inviteDelete', async invite => {
    if (!invite.guild) return;
    const embed = new EmbedBuilder()
      .setTitle('✂️ Удалена ссылка-приглашение')
      .setColor('#E74C3C')
      .addFields({ name: '🔑 Код', value: `\`discord.gg/${invite.code}\``, inline: true })
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

    // ==================== 5. КАНАЛЫ, ВЕТКИ, РОЛИ, ЭМОДЗИ, СЕРВЕР ====================
  client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const entry = await getExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    const embed = new EmbedBuilder()
      .setTitle('➕ Создан канал')
      .setColor('#1ABC9C')
      .addFields(
        { name: '📍 Канал', value: `${channel.name} (<#${channel.id}>)`, inline: true },
        { name: '👮 Создал', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const entry = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    if (entry) await triggerAntiRaid(channel.guild, entry.executor, `Удаление канала #${channel.name}`);

    const embed = new EmbedBuilder()
      .setTitle('➖ Удалён канал')
      .setColor('#E74C3C')
      .addFields(
        { name: '📍 Название', value: `#${channel.name}`, inline: true },
        { name: '👮 Удалил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });


  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`**Название:** #${oldChannel.name} ➔ #${newChannel.name}`);
    if (oldChannel.topic !== newChannel.topic) changes.push(`**Описание канала обновлено**`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`**Медленный режим:** ${oldChannel.rateLimitPerUser}с ➔ ${newChannel.rateLimitPerUser}с`);
    }
    if (changes.length === 0) return;

    const entry = await getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Изменён канал')
      .setColor('#3498DB')
      .addFields(
        { name: '📍 Канал', value: `<#${newChannel.id}>`, inline: true },
        { name: '👮 Изменил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true },
        { name: '📝 Изменения', value: changes.join('\n'), inline: false }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('threadCreate', async thread => {
    const embed = new EmbedBuilder()
      .setTitle('🧵 Создана ветка (тред)')
      .setColor('#1ABC9C')
      .addFields(
        { name: '📍 Ветка', value: `<#${thread.id}> (\`${thread.name}\`)`, inline: true },
        { name: '👤 Автор', value: thread.ownerId ? `<@${thread.ownerId}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(SERVER_LOGS_CHANNEL_ID, embed);
  });

  client.on('threadDelete', async thread => {
    const embed = new EmbedBuilder()
      .setTitle('🗑 Удалена ветка (тред)')
      .setColor('#E74C3C')
      .addFields({ name: '📍 Название', value: `\`${thread.name}\``, inline: true })
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('roleCreate', async role => {
    const entry = await getExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    const embed = new EmbedBuilder()
      .setTitle('🛡 Создана роль')
      .setColor('#1ABC9C')
      .addFields(
        { name: '🎭 Роль', value: `<@&${role.id}> (\`${role.name}\`)`, inline: true },
        { name: '👮 Создал', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

    client.on('roleDelete', async role => {
    const entry = await getExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    if (entry) await triggerAntiRaid(role.guild, entry.executor, `Удаление роли @${role.name}`);

    const embed = new EmbedBuilder()
      .setTitle('🗑 Удалена роль')
      .setColor('#E74C3C')
      .addFields(
        { name: '🎭 Название', value: `\`${role.name}\``, inline: true },
        { name: '👮 Удалил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });


  client.on('roleUpdate', async (oldRole, newRole) => {
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`**Название:** ${oldRole.name} ➔ ${newRole.name}`);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Цвет:** ${oldRole.hexColor} ➔ ${newRole.hexColor}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(`**Изменены права доступа роли**`);
    if (changes.length === 0) return;

    const entry = await getExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Изменена роль')
      .setColor('#F39C12')
      .addFields(
        { name: '🎭 Роль', value: `<@&${newRole.id}>`, inline: true },
        { name: '👮 Изменил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true },
        { name: '📝 Изменения', value: changes.join('\n'), inline: false }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('emojiCreate', async emoji => {
    const entry = await getExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
    const embed = new EmbedBuilder()
      .setTitle('😀 Добавлен новый эмодзи')
      .setColor('#2ECC71')
      .addFields(
        { name: 'Эмодзи', value: `${emoji} (\`:${emoji.name}:\`)`, inline: true },
        { name: '👮 Добавил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('emojiDelete', async emoji => {
    const entry = await getExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
    const embed = new EmbedBuilder()
      .setTitle('❌ Удалён эмодзи')
      .setColor('#E74C3C')
      .addFields(
        { name: 'Название', value: `\`:${emoji.name}:\``, inline: true },
        { name: '👮 Удалил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('webhookUpdate', async channel => {
    const entry = await getExecutor(channel.guild, AuditLogEvent.WebhookCreate, null);
    const embed = new EmbedBuilder()
      .setTitle('🪝 Изменены вебхуки канала')
      .setColor('#9B59B6')
      .addFields(
        { name: '📍 Канал', value: `<#${channel.id}>`, inline: true },
        { name: '👮 Инициатор', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });

  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (oldGuild.name === newGuild.name) return;
    const entry = await getExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);
    const embed = new EmbedBuilder()
      .setTitle('🏰 Изменено название сервера')
      .setColor('#F1C40F')
      .addFields(
        { name: 'Было', value: oldGuild.name, inline: true },
        { name: 'Стало', value: newGuild.name, inline: true },
        { name: '👮 Изменил', value: entry ? `<@${entry.executor.id}>` : 'Неизвестно', inline: true }
      )
      .setTimestamp();

    await sendLog(ADMIN_LOGS_CHANNEL_ID, embed);
  });
}

module.exports = { setupLogs };
