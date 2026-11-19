const config = require('./config');
const settings = require('./settings');
const REPORTS_CHANNEL_ID = config.CHANNELS.PROMO_REPORTS;
const LOGS_CHANNEL_ID = config.CHANNELS.PROMO_LOGS;
const CHECKER_ROLE_ID = config.ROLES.CHECKER;

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

const promoCommand = new SlashCommandBuilder()
  .setName('панель_повышения')
  .setDescription('Отправить в этот канал меню подачи отчетов на повышение')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Вспомогательная функция: собирает название и список ролей с учётом отдела (формат: rankKey или rankKey:deptKey)
function resolvePromoTarget(ranksCfg, fullKey) {
  const [rankKey, deptKey] = fullKey.split(':');
  const rankInfo = ranksCfg[rankKey];
  if (!rankInfo) return null;

  if (deptKey && rankInfo.departments && rankInfo.departments[deptKey]) {
    const deptInfo = rankInfo.departments[deptKey];
    return {
      label: deptInfo.label || `${rankInfo.label} (${deptKey})`,
      requirements: deptInfo.requirements || rankInfo.requirements,
      add: [...(rankInfo.add || []), ...(deptInfo.add || [])].filter(Boolean),
      remove: [...(rankInfo.remove || []), ...(deptInfo.remove || [])].filter(Boolean)
    };
  }

  return {
    label: rankInfo.label,
    requirements: rankInfo.requirements,
    add: (rankInfo.add || []).filter(Boolean),
    remove: (rankInfo.remove || []).filter(Boolean)
  };
}

// Сборка модального окна отчёта
function buildPromoModal(fullKey, targetInfo) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_promo_${fullKey}`)
    .setTitle(`Отчет: ${targetInfo.label}`.slice(0, 45));

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('promo_nick')
        .setLabel('Ваш игровой Ник и Статик ID')
        .setPlaceholder('Например: Ivan_Begov | #12345')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('promo_current')
        .setLabel('Ваш текущий ранг')
        .setPlaceholder('Например: 1 (Test)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('promo_proof')
        .setLabel('Доказательства работы (ссылки)')
        .setPlaceholder((targetInfo.requirements || 'Ссылки на скриншоты / отчёты').slice(0, 100))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

async function handlePromo(interaction, client) {
  const ranksCfg = settings.ROLE_REWARDS.PROMO_RANKS;
  const promoTxt = settings.PANELS.PROMO;

       // 1. Команда создания панели
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_повышения') {
    const embed = settings.applyPanelStyle(
      new EmbedBuilder(),
      promoTxt,
      '#3498DB'
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_promo_rank')
      .setPlaceholder(promoTxt.placeholder)
      .addOptions(
        Object.entries(ranksCfg).map(([key, info]) => ({
          label: info.label,
          description: info.description.slice(0, 100),
          value: key
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const sent = await interaction.channel.send({ embeds: [embed], components: [row] });

    const { getCustomPanels, saveCustomPanels } = require('./panel_manager');
    const customAll = getCustomPanels();
    customAll.PROMO = { ...(customAll.PROMO || {}), channelId: interaction.channel.id, messageId: sent.id };
    saveCustomPanels(customAll);

    return interaction.reply({ content: '✅ Панель повышения успешно создана!', ephemeral: true });
  }

  // 2. Выбор ранга в списке (поддерживает оба customId)
  if (interaction.isStringSelectMenu() && (interaction.customId === 'select_promo_rank' || interaction.customId === 'promo_select_rank')) {
    const rankKey = interaction.values.at(0);
    const rankInfo = ranksCfg[rankKey];
    if (!rankInfo) {
      return interaction.reply({ content: '❌ Выбранный ранг не найден в настройках.', ephemeral: true });
    }

    // Если у ранга есть отделы — показываем панель выбора отдела
    if (rankInfo.departments && Object.keys(rankInfo.departments).length > 0) {
      const deptOptions = Object.entries(rankInfo.departments).map(([deptKey, deptInfo]) => ({
        label: deptInfo.label,
        description: (deptInfo.description || `Отдел ${deptKey}`).slice(0, 100),
        value: `${rankKey}:${deptKey}`
      }));

      const deptSelect = new StringSelectMenuBuilder()
        .setCustomId('select_promo_dept')
        .setPlaceholder(`👇 Выбери отдел для ${rankInfo.label}...`)
        .addOptions(deptOptions);

      return interaction.reply({
        content: `📂 Выберите, к какому **отделу** относится ваше повышение на **${rankInfo.label}**:`,
        components: [new ActionRowBuilder().addComponents(deptSelect)],
        ephemeral: true
      });
    }

    // Если отделов нет — сразу открываем анкету
    const targetInfo = resolvePromoTarget(ranksCfg, rankKey);
    return interaction.showModal(buildPromoModal(rankKey, targetInfo));
  }


  // 2.1 Выбор конкретного отдела -> открытие анкеты
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_promo_dept') {
    const fullKey = interaction.values.at(0);
    const targetInfo = resolvePromoTarget(ranksCfg, fullKey);
    if (!targetInfo) {
      return interaction.reply({ content: '❌ Выбранный отдел не найден в настройках.', ephemeral: true });
    }

    return interaction.showModal(buildPromoModal(fullKey, targetInfo));
  }

  // 3. Отправка анкеты в канал проверки
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_promo_')) {
    const fullKey = interaction.customId.replace('modal_promo_', '');
    const targetInfo = resolvePromoTarget(ranksCfg, fullKey);
    if (!targetInfo) {
      return interaction.reply({ content: '❌ Ошибка конфигурации ранга.', ephemeral: true });
    }

    const nick = interaction.fields.getTextInputValue('promo_nick');
    const currentRank = interaction.fields.getTextInputValue('promo_current');
    const proof = interaction.fields.getTextInputValue('promo_proof');

    const reportsChannel = client.channels.cache.get(REPORTS_CHANNEL_ID);
    if (!reportsChannel) {
      return interaction.reply({ content: '❌ Ошибка: канал для отчетов не найден. Проверь `PROMO_REPORTS` в `config.js`.', ephemeral: true });
    }

    const reportEmbed = new EmbedBuilder()
      .setTitle('📋 Новый отчет на повышение')
      .setColor(settings.resolveColor(promoTxt.color, '#F1C40F'))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '🆔 Ник и Статик', value: nick, inline: true },
        { name: '📊 Повышение', value: `${currentRank} ➔ **${targetInfo.label}**`, inline: false },
        { name: '📎 Доказательства', value: proof, inline: false }
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`promo_accept_${interaction.user.id}_${fullKey}`)
        .setLabel('✅ Принять и выдать роль')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`promo_reject_${interaction.user.id}_${fullKey}`)
        .setLabel('❌ Отклонить')
        .setStyle(ButtonStyle.Danger)
    );

    await reportsChannel.send({
      content: `<@&${CHECKER_ROLE_ID}> Новый отчет на проверку!`,
      embeds: [reportEmbed],
      components: [buttons]
    });

    return interaction.reply({ content: '✅ Твой отчет отправлен старшему составу на проверку!', ephemeral: true });
  }

  // 4. Нажатие кнопок "Принять" или "Отклонить"
  if (interaction.isButton() && (interaction.customId.startsWith('promo_accept_') || interaction.customId.startsWith('promo_reject_'))) {
    if (!interaction.member.roles.cache.has(CHECKER_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ У вас нет роли для проверки отчетов!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const action = parts.at(1);
    const targetUserId = parts.at(2);
    const fullKey = parts.slice(3).join('_');
    const targetInfo = resolvePromoTarget(ranksCfg, fullKey);

        // ПРИНЯТЬ (выдаём и снимаем роли с учётом выбранного отдела)
    if (action === 'accept') {
      await interaction.deferUpdate();

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      let roleStatus = 'Роли успешно выданы';

      if (targetMember && targetInfo) {
        try {
          if (targetInfo.remove && targetInfo.remove.length > 0) {
            await targetMember.roles.remove(targetInfo.remove).catch(() => {});
          }
          if (targetInfo.add && targetInfo.add.length > 0) {
            await targetMember.roles.add(targetInfo.add);
          }
          await targetMember.send(`🎉 Поздравляем! Ваш отчет на **${targetInfo.label}** был **одобрен** проверяющим ${interaction.user.tag}! Роль выдана.`).catch(() => {});
        } catch {
          roleStatus = '⚠️ Не удалось выдать роль (проверь права и иерархию ролей бота)';
        }
      } else {
        roleStatus = '⚠️ Игрок покинул сервер или ранг не найден';
      }

      const approvedEmbed = EmbedBuilder.from(interaction.message.embeds.at(0))
        .setColor('#2ECC71')
        .setTitle('✅ Отчет на повышение ОДОБРЕН')
        .addFields({ name: '👮 Проверил', value: `<@${interaction.user.id}> (${roleStatus})`, inline: false });

      await interaction.editReply({ content: '', embeds: [approvedEmbed], components: [] });

      const logsChannel = client.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) await logsChannel.send({ embeds: [approvedEmbed] });
    }

    // ОТКЛОНИТЬ
    if (action === 'reject') {
      const rejectModal = new ModalBuilder()
        .setCustomId(`modal_reject_${targetUserId}_${interaction.message.id}_${fullKey}`)
        .setTitle('Причина отказа в повышении');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Укажите причину отклонения отчета')
        .setPlaceholder('Например: Не хватает скриншотов / не одобрена заявка')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      rejectModal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(rejectModal);
    }
  }

  // 5. Обработка причины отказа и запись в логи
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
    const parts = interaction.customId.split('_');
    const targetUserId = parts.at(2);
    const reportMessageId = parts.at(3);
    const fullKey = parts.slice(4).join('_');
    const reason = interaction.fields.getTextInputValue('reject_reason');
    const targetInfo = resolvePromoTarget(ranksCfg, fullKey);

    const reportMessage = await interaction.channel.messages.fetch(reportMessageId).catch(() => null);
    if (reportMessage) {
      const rejectedEmbed = EmbedBuilder.from(reportMessage.embeds.at(0))
        .setColor('#E74C3C')
        .setTitle('❌ Отчет на повышение ОТКЛОНЕН')
        .addFields(
          { name: '👮 Отклонил', value: `<@${interaction.user.id}>`, inline: true },
          { name: '💬 Причина отказа', value: reason, inline: false }
        );

      await reportMessage.edit({ content: '', embeds: [rejectedEmbed], components: [] });

      const logsChannel = client.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) await logsChannel.send({ embeds: [rejectedEmbed] });
    }

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (targetUser) {
      await targetUser.send(`❌ Ваш отчет на **${targetInfo ? targetInfo.label : fullKey}** был **отклонен** проверяющим ${interaction.user.tag}.\n**Причина:** ${reason}`).catch(() => {});
    }

    return interaction.reply({ content: '✅ Отчет отклонен, причина записана в логи и отправлена игроку.', ephemeral: true });
  }
}

module.exports = { promoCommand, handlePromo };
