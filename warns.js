const config = require('./config');
const WARNS_INFO_CHANNEL_ID = config.CHANNELS.WARNS_INFO;
const WARNS_APPEAL_CHANNEL_ID = config.CHANNELS.WARNS_APPEAL;
const WARNS_WORKOFF_CHANNEL_ID = config.CHANNELS.WARNS_WORKOFF;
const WARN_1_ROLE_ID = config.ROLES.WARN_1;
const WARN_2_ROLE_ID = config.ROLES.WARN_2;
const WARN_STAFF_ROLE_ID = config.ROLES.CHECKER;

// ===============================================================

const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder, // <-- ДОБАВИТЬ ЭТУ СТРОКУ
  PermissionFlagsBits
} = require('discord.js');


const WARNS_FILE = path.join(__dirname, 'warns_data.json');

function loadWarns() {
  if (!fs.existsSync(WARNS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Синхронизация ролей 1/3 и 2/3 у участника
async function syncWarnRoles(member, count) {
  if (!member) return;
  try {
    if (count <= 0) {
      if (WARN_1_ROLE_ID) await member.roles.remove(WARN_1_ROLE_ID).catch(() => {});
      if (WARN_2_ROLE_ID) await member.roles.remove(WARN_2_ROLE_ID).catch(() => {});
    } else if (count === 1) {
      if (WARN_2_ROLE_ID) await member.roles.remove(WARN_2_ROLE_ID).catch(() => {});
      if (WARN_1_ROLE_ID) await member.roles.add(WARN_1_ROLE_ID).catch(() => {});
    } else if (count === 2) {
      if (WARN_1_ROLE_ID) await member.roles.remove(WARN_1_ROLE_ID).catch(() => {});
      if (WARN_2_ROLE_ID) await member.roles.add(WARN_2_ROLE_ID).catch(() => {});
    }
  } catch (err) {
    console.error('Ошибка синхронизации ролей выговоров:', err);
  }
}


// Слэш-команды модуля
const warnInfoPanelCommand = new SlashCommandBuilder()
  .setName('панель_информация')
  .setDescription('Отправить информационную памятку о системе выговоров в канал Информация')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const warnPanelCommand = new SlashCommandBuilder()
  .setName('панель_выговоров')
  .setDescription('Отправить панель с кнопками Обжаловать и Отработать выговор')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const giveWarnCommand = new SlashCommandBuilder()
  .setName('выговор')
  .setDescription('Выдать выговор участнику семьи')
  .addUserOption(opt =>
    opt.setName('участник')
      .setDescription('Кому выдать выговор')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('причина')
      .setDescription('Причина выдачи выговора')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('доказательства')
      .setDescription('Ссылка на скриншот или откат (необязательно)')
      .setRequired(false)
  );

const removeWarnCommand = new SlashCommandBuilder()
  .setName('снять_выговор')
  .setDescription('Снять 1 выговор с участника семьи')
  .addUserOption(opt =>
    opt.setName('участник')
      .setDescription('С кого снять выговор')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('причина')
      .setDescription('Причина снятия выговора')
      .setRequired(true)
  );

const warnCommands = [warnInfoPanelCommand, warnPanelCommand, giveWarnCommand, removeWarnCommand];

async function handleWarns(interaction, client) {
    // 0. Команда /панель_информация (для канала Информация)
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_информация') {
    const infoEmbed = new EmbedBuilder()
      .setTitle('📌 Информация о системе выговоров семьи')
      .setDescription(
        'В данном разделе публикуются все актуальные выговоры участников семьи.\n\n' +
        '**1. Градация взысканий:**\n' +
        '• **1/3 выговор** — предупреждение, выдаётся соответствующая роль.\n' +
        '• **2/3 выговор** — строгий выговор (блокируется доступ к повышению).\n' +
        '• **3/3 выговор** — автоматическое рассмотрение на увольнение из семьи.\n\n' +
        '**2. За что можно получить выговор:**\n' +
        '• Неявка на обязательные сборы / МП без отметки в канале АФК.\n' +
        '• Нарушение правил семьи, субординации или устава.\n' +
        '• Слив склада, неадекватное поведение или игнорирование старшего состава.\n\n' +
        '**3. Условия отработки (снятия) выговора:**\n' +
        '• **1/3:** 500 Бинтов или 50.000$ на балик фамы\n' +
        '• **2/3:** 1000 Бинтов или 100.000$ на балик фамы\n' +
        '• **3/3:** 1500 Бинтов или 150.000$ на балик фамы\n' +
        '*На счёт возврата писать старшему составу.*\n\n' +
        '**4. Как снять выговор:**\n' +
        `• Если выговор выдан ошибочно — подай заявку в канале <#${WARNS_APPEAL_CHANNEL_ID}>.\n` +
        `• Если ты согласен с нарушением — выполни условие выше и отправь отчёт в <#${WARNS_WORKOFF_CHANNEL_ID}>.`
      )
      .setColor('#F1C40F')
      .setFooter({ text: 'Нажми кнопку ниже, чтобы узнать своё текущее количество выговоров.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_check_my_warns')
        .setLabel('📊 Проверить мои выговоры')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [infoEmbed], components: [row] });
    return interaction.reply({ content: '✅ Информационная панель успешно отправлена!', ephemeral: true });
  }


  // Кнопка "Проверить мои выговоры"
  if (interaction.isButton() && interaction.customId === 'btn_check_my_warns') {
    const warnsData = loadWarns();
    const count = warnsData[interaction.user.id] || 0;

    return interaction.reply({
      content: count > 0
        ? `⚠️ У тебя сейчас активных выговоров: **${count} / 3**.`
        : '✅ У тебя нет активных выговоров (**0 / 3**). Так держать!',
      ephemeral: true
    });
  }

    // 1. Команда /панель_выговоров
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_выговоров') {
    const embed = new EmbedBuilder()
      .setTitle('⚖️ Система выговоров | Обжалование, Отработка и Выдача')
      .setDescription(
        'В этом разделе фиксируются все дисциплинарные взыскания участников семьи.\n\n' +
        '• **Максимум выговоров:** `3/3` (при получении 3-го выговора следует увольнение из семьи).\n' +
        '• **⚖️ Обжаловать выговор** — если считаешь, что выговор выдан по ошибке и у тебя есть доказательства.\n' +
        '• **🛠 Отработать выговор** — чтобы отправить отчёт о выполненном задании для снятия выговора.\n' +
        '• **⚠️ Выдать выговор** — кнопка только для старшего (High) состава.'
      )
      .setColor('#E74C3C');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_warn_appeal')
        .setLabel('⚖️ Обжаловать выговор')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_warn_workoff')
        .setLabel('🛠 Отработать выговор')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_staff_give_warn')
        .setLabel('⚠️ Выдать выговор')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель выговоров успешно создана!', ephemeral: true });
  }

  // 2. Команда /выговор
  if (interaction.isChatInputCommand() && interaction.commandName === 'выговор') {
    if (!interaction.member.roles.cache.has(WARN_STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ У вас нет прав для выдачи выговоров!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('участник');
    const reason = interaction.options.getString('причина');
    const proof = interaction.options.getString('доказательства') || 'Не приложены';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const warnsData = loadWarns();
    const currentCount = (warnsData[targetUser.id] || 0) + 1;
    warnsData[targetUser.id] = currentCount;
    saveWarns(warnsData);

    await syncWarnRoles(targetMember, currentCount);

    const isCritical = currentCount >= 3;
    const infoEmbed = new EmbedBuilder()
      .setTitle(isCritical ? '🚨 ВЫДАН 3/3 ВЫГОВОР (НА УВОЛЬНЕНИЕ)' : '⚠️ Выдан выговор')
      .setColor(isCritical ? '#992D22' : '#E74C3C')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: '👮 Выдал', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📊 Всего выговоров', value: `**${currentCount} / 3**`, inline: true },
        { name: '📝 Причина', value: reason, inline: false },
        { name: '📎 Доказательства', value: proof, inline: false }
      )
      .setTimestamp();

    const infoChannel = client.channels.cache.get(WARNS_INFO_CHANNEL_ID);
    if (infoChannel) {
      await infoChannel.send({
        content: isCritical ? `<@&${WARN_STAFF_ROLE_ID}> Участник набрал **3/3** выговора!` : `<@${targetUser.id}>`,
        embeds: [infoEmbed]
      });
    }

    await targetUser.send(
      `⚠️ Вам был выдан выговор в семье!\n**Счётчик:** ${currentCount}/3\n**Выдал:** ${interaction.user.tag}\n**Причина:** ${reason}`
    ).catch(() => {});

    return interaction.reply({
      content: `✅ Выговор выдан игроку <@${targetUser.id}>. Текущий счётчик: **${currentCount}/3**.`,
      ephemeral: true
    });
  }

    // 3. Команда /снять_выговор
  if (interaction.isChatInputCommand() && interaction.commandName === 'снять_выговор') {
    if (!interaction.member.roles.cache.has(WARN_STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ У вас нет прав для снятия выговоров!', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('участник');
    const reason = interaction.options.getString('причина');
    const warnsData = loadWarns();
    const currentCount = warnsData[targetUser.id] || 0;

    if (currentCount <= 0) {
      return interaction.reply({ content: `⚠️ У игрока <@${targetUser.id}> нет активных выговоров.`, ephemeral: true });
    }

    const newCount = currentCount - 1;
    if (newCount === 0) {
      delete warnsData[targetUser.id];
    } else {
      warnsData[targetUser.id] = newCount;
    }
    saveWarns(warnsData);

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    await syncWarnRoles(targetMember, newCount);

    const infoEmbed = new EmbedBuilder()
      .setTitle('🟢 Выговор снят')
      .setColor('#2ECC71')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: '👮 Снял', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📊 Осталось выговоров', value: `**${newCount} / 3**`, inline: true },
        { name: '📝 Причина снятия', value: reason, inline: false }
      )
      .setTimestamp();

    const infoChannel = client.channels.cache.get(WARNS_INFO_CHANNEL_ID);
    if (infoChannel) {
      await infoChannel.send({ content: `<@${targetUser.id}>`, embeds: [infoEmbed] });
    }

    return interaction.reply({
      content: `✅ С игрока <@${targetUser.id}> снят 1 выговор. Осталось: **${newCount}/3**.`,
      ephemeral: true
    });
  }

  // 4. Нажатие кнопок "Обжаловать" или "Отработать"
  if (interaction.isButton() && (interaction.customId === 'btn_warn_appeal' || interaction.customId === 'btn_warn_workoff')) {
    const warnsData = loadWarns();
    const currentCount = warnsData[interaction.user.id] || 0;

    if (currentCount <= 0) {
      return interaction.reply({ content: '✅ У тебя нет активных выговоров!', ephemeral: true });
    }

    const isAppeal = interaction.customId === 'btn_warn_appeal';
    const modal = new ModalBuilder()
      .setCustomId(isAppeal ? 'modal_warn_appeal' : 'modal_warn_workoff')
      .setTitle(isAppeal ? 'Обжалование выговора' : 'Отработка выговора');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('warn_nick')
          .setLabel('Ваш игровой Ник и Статик ID')
          .setPlaceholder('Например: Ivan Begov | #12345')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('warn_who')
          .setLabel(isAppeal ? 'Кто и за что выдал выговор?' : 'За что был получен выговор?')
          .setPlaceholder(isAppeal ? 'Например: Ник старшего / неявка на строй' : 'Например: Неявка на МП')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('warn_proof')
          .setLabel(isAppeal ? 'Объяснение и доказательства (ссылки)' : 'Доказательства отработки (ссылки)')
          .setPlaceholder(isAppeal ? 'Опишите ситуацию и приложите ссылку на скрин/откат' : 'Ссылки на скриншоты выполненной работы')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // 5. Отправка формы в канал Обжалования или Отработки
  if (interaction.isModalSubmit() && (interaction.customId === 'modal_warn_appeal' || interaction.customId === 'modal_warn_workoff')) {
    const isAppeal = interaction.customId === 'modal_warn_appeal';
    const nick = interaction.fields.getTextInputValue('warn_nick');
    const who = interaction.fields.getTextInputValue('warn_who');
    const proof = interaction.fields.getTextInputValue('warn_proof');

    const warnsData = loadWarns();
    const currentCount = warnsData[interaction.user.id] || 1;

    const targetChannelId = isAppeal ? WARNS_APPEAL_CHANNEL_ID : WARNS_WORKOFF_CHANNEL_ID;
    const targetChannel = client.channels.cache.get(targetChannelId);

    if (!targetChannel) {
      return interaction.reply({
        content: `❌ Ошибка: канал для ${isAppeal ? 'обжалований' : 'отработок'} не найден. Проверь настройки ID.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(isAppeal ? '⚖️ Новое обжалование выговора' : '🛠 Отчёт на отработку выговора')
      .setColor(isAppeal ? '#F39C12' : '#3498DB')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '🆔 Ник и Статик', value: nick, inline: true },
        { name: '📊 Текущие выговоры', value: `**${currentCount} / 3**`, inline: true },
        { name: isAppeal ? '📌 Кто / за что выдал' : '📌 Причина выговора', value: who, inline: false },
        { name: '📎 Доказательства', value: proof, inline: false }
      )
      .setTimestamp();

    const typeTag = isAppeal ? 'appeal' : 'workoff';
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`warn_approve_${typeTag}_${interaction.user.id}`)
        .setLabel('✅ Одобрить и снять выговор')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`warn_deny_${typeTag}_${interaction.user.id}`)
        .setLabel('❌ Отклонить')
        .setStyle(ButtonStyle.Danger)
    );

    await targetChannel.send({
      content: `<@&${WARN_STAFF_ROLE_ID}> Новая заявка на проверку!`,
      embeds: [embed],
      components: [buttons]
    });

    return interaction.reply({
      content: isAppeal
        ? '✅ Твоё обжалование отправлено старшему составу на рассмотрение!'
        : '✅ Твой отчёт об отработке отправлен старшему составу на проверку!',
      ephemeral: true
    });
  }

  // 6. Проверка заявки старшим составом (Кнопки Одобрить / Отклонить)
  if (interaction.isButton() && (interaction.customId.startsWith('warn_approve_') || interaction.customId.startsWith('warn_deny_'))) {
    if (!interaction.member.roles.cache.has(WARN_STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ У вас нет прав для проверки этих заявок!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const decision = parts[1];     // approve или deny
    const typeTag = parts[2];      // appeal или workoff
    const targetUserId = parts[3]; // ID игрока

    if (decision === 'approve') {
      const warnsData = loadWarns();
      const currentCount = warnsData[targetUserId] || 0;
      const newCount = Math.max(0, currentCount - 1);

      if (newCount === 0) {
        delete warnsData[targetUserId];
      } else {
        warnsData[targetUserId] = newCount;
      }
      saveWarns(warnsData);

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      await syncWarnRoles(targetMember, newCount);

      const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#2ECC71')
        .setTitle(typeTag === 'appeal' ? '✅ Обжалование ОДОБРЕНО' : '✅ Отработка ЗАСЧИТАНА')
        .addFields({
          name: '👮 Проверил',
          value: `<@${interaction.user.id}> (Выговор снят, осталось: **${newCount}/3**)`,
          inline: false
        });

      await interaction.update({ content: '', embeds: [approvedEmbed], components: [] });

      // Дублируем в канал Информации о снятии выговора
      const infoChannel = client.channels.cache.get(WARNS_INFO_CHANNEL_ID);
      if (infoChannel) {
        const infoLog = new EmbedBuilder()
          .setTitle('🟢 Выговор снят')
          .setColor('#2ECC71')
          .addFields(
            { name: '👤 Участник', value: `<@${targetUserId}>`, inline: true },
            { name: '👮 Снял', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📊 Осталось выговоров', value: `**${newCount} / 3**`, inline: true },
            { name: '📝 Основание', value: typeTag === 'appeal' ? 'Одобрено обжалование' : 'Отработка выговора', inline: false }
          )
          .setTimestamp();
        await infoChannel.send({ content: `<@${targetUserId}>`, embeds: [infoLog] });
      }

      if (targetMember) {
        await targetMember.send(
          `✅ Ваша заявка (${typeTag === 'appeal' ? 'обжалование' : 'отработка'}) одобрена! 1 выговор снят. Осталось: **${newCount}/3**.`
        ).catch(() => {});
      }
    }

    if (decision === 'deny') {
      const rejectModal = new ModalBuilder()
        .setCustomId(`modal_warndeny_${typeTag}_${targetUserId}_${interaction.message.id}`)
        .setTitle('Причина отказа');

      rejectModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('deny_reason')
            .setLabel('Укажите причину отклонения')
            .setPlaceholder('Например: Недостаточно доказательств / не выполнены все условия')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      return interaction.showModal(rejectModal);
    }
  }

      // 7. Обработка причины отклонения обжалования/отработки
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_warndeny_')) {
    const parts = interaction.customId.split('_');
    const typeTag = parts[2];      // appeal или workoff
    const targetUserId = parts[3]; // ID игрока
    const msgId = parts[4];        // ID сообщения с заявкой
    const reason = interaction.fields.getTextInputValue('deny_reason');

    const targetMsg = await interaction.channel.messages.fetch(msgId).catch(() => null);
    if (targetMsg) {
      const deniedEmbed = EmbedBuilder.from(targetMsg.embeds[0])
        .setColor('#E74C3C')
        .setTitle(typeTag === 'appeal' ? '❌ Обжалование ОТКЛОНЕНО' : '❌ Отработка ОТКЛОНЕНА')
        .addFields(
          { name: '👮 Отклонил', value: `<@${interaction.user.id}>`, inline: true },
          { name: '💬 Причина', value: reason, inline: false }
        );

      await targetMsg.edit({ content: '', embeds: [deniedEmbed], components: [] });
    }

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (targetUser) {
      await targetUser.send(
        `❌ Ваша заявка (${typeTag === 'appeal' ? 'обжалование' : 'отработка'} выговора) была отклонена.\n**Причина:** ${reason}`
      ).catch(() => {});
    }

    return interaction.reply({ content: '✅ Заявка отклонена, участник уведомлён.', ephemeral: true });
  }

  // 8. Выдача выговора через кнопку на панели (только для High состава)
  if (interaction.isButton() && interaction.customId === 'btn_staff_give_warn') {
    if (!interaction.member.roles.cache.has(WARN_STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Эта кнопка доступна только старшему (High) составу!', ephemeral: true });
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('select_warn_target_user')
      .setPlaceholder('👇 Выбери участника, которому выдать выговор...');

    const row = new ActionRowBuilder().addComponents(userSelect);

    return interaction.reply({
      content: 'Выбери нарушителя из списка ниже (можно начать вводить его ник):',
      components: [row],
      ephemeral: true
    });
  }

  // Выбор участника в меню -> открытие окна с причиной
  if (interaction.isUserSelectMenu() && interaction.customId === 'select_warn_target_user') {
    const targetUserId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`modal_panel_givewarn_${targetUserId}`)
      .setTitle('Выдача выговора участнику');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_warn_reason')
          .setLabel('Причина выговора')
          .setPlaceholder('Например: Неявка на МП / нарушение правил семьи')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_warn_proof')
          .setLabel('Доказательства (ссылка, необязательно)')
          .setPlaceholder('Вставь ссылку на скриншот или откат')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }

  // Отправка формы выдачи выговора с панели
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_panel_givewarn_')) {
    const targetUserId = interaction.customId.replace('modal_panel_givewarn_', '');
    const reason = interaction.fields.getTextInputValue('panel_warn_reason');
    const proof = interaction.fields.getTextInputValue('panel_warn_proof') || 'Не приложены';

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    if (!targetUser) {
      return interaction.reply({ content: '❌ Не удалось найти выбранного пользователя.', ephemeral: true });
    }

    const warnsData = loadWarns();
    const currentCount = (warnsData[targetUser.id] || 0) + 1;
    warnsData[targetUser.id] = currentCount;
    saveWarns(warnsData);

    await syncWarnRoles(targetMember, currentCount);

    const isCritical = currentCount >= 3;
    const infoEmbed = new EmbedBuilder()
      .setTitle(isCritical ? '🚨 ВЫДАН 3/3 ВЫГОВОР (НА УВОЛЬНЕНИЕ)' : '⚠️ Выдан выговор')
      .setColor(isCritical ? '#992D22' : '#E74C3C')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: '👮 Выдал', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📊 Всего выговоров', value: `**${currentCount} / 3**`, inline: true },
        { name: '📝 Причина', value: reason, inline: false },
        { name: '📎 Доказательства', value: proof, inline: false }
      )
      .setTimestamp();

    const infoChannel = client.channels.cache.get(WARNS_INFO_CHANNEL_ID);
    if (infoChannel) {
      await infoChannel.send({
        content: isCritical ? `<@&${WARN_STAFF_ROLE_ID}> Участник набрал **3/3** выговора!` : `<@${targetUser.id}>`,
        embeds: [infoEmbed]
      });
    }

    await targetUser.send(
      `⚠️ Вам был выдан выговор в семье!\n**Счётчик:** ${currentCount}/3\n**Выдал:** ${interaction.user.tag}\n**Причина:** ${reason}`
    ).catch(() => {});

    return interaction.reply({
      content: `✅ Выговор выдан игроку <@${targetUser.id}>. Текущий счётчик: **${currentCount}/3**.`,
      ephemeral: true
    });
  }
}

module.exports = { warnCommands, handleWarns };
