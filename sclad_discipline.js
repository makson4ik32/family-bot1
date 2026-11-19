const config = require('./config');
const { getJson, saveJson } = require('./db');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const SCLAD_FILE = 'sclad_data.json';
const WARNS_FILE = 'warns_data.json';

function hasScladAccess(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return [config.ROLES.SCLAD, config.ROLES.HIGH_STAFF]
    .filter(Boolean)
    .some(r => member.roles.cache.has(r));
}

function hasDisciplineAccess(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return [config.ROLES.DISCIPLINE, config.ROLES.HIGH_STAFF, config.ROLES.CALLER, config.ROLES.DEP_LEADER, config.ROLES.LEADER]
    .filter(Boolean)
    .some(r => member.roles.cache.has(r));
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

// =========================================================================
// СБОРКА ЭМБЕДА СКЛАДА
// =========================================================================
function buildScladEmbed() {
  const data = getJson(SCLAD_FILE, {
    mode: 'CAPT',
    status: '🟢 Укомплектован',
    deficit: 'Всё в наличии согласно норме.',
    updatedBy: null
  });

  const isCapt = data.mode === 'CAPT';

  return new EmbedBuilder()
    .setTitle('📦 Состояние и нормы семейного склада')
    .setColor(isCapt ? '#E74C3C' : '#3498DB')
    .setDescription(
      `**Активный режим дня:** ${isCapt ? '⚔️ **КАПТ-ДЕНЬ**' : '🎭 **РП / ОБЫЧНЫЙ ДЕНЬ**'}\n` +
      `**Текущий статус:** ${data.status}\n` +
      `**Требуется пополнить:** ${data.deficit}`
    )
    .addFields(
      {
        name: `${isCapt ? '🔥 ' : ''}⚔️ Норма на КАПТ-ДЕНЬ`,
        value:
          '• **Спешл Карбин Mk2** — от 30 шт.\n' +
          '• **Тяжёлый дробовик (Сайга)** — от 25 шт.\n' +
          '• **Marksman / Снайперки** — от 10 шт.\n' +
          '• **Тяжёлые бронежилеты (100%)** — от 60 шт.\n' +
          '• **Патроны 5.56 / 12ga / 7.62** — от 10.000 шт.\n' +
          '• **Аптечки / Эпинефрин / Бинты** — от 100 шт.\n' +
          '• **Модификации (ув. магаз, рукоятка, прицел)** — по 20+ шт.',
        inline: false
      },
      {
        name: `${!isCapt ? '🔥 ' : ''}🎭 Норма на РП / ОБЫЧНЫЙ ДЕНЬ`,
        value:
          '• **Карабины / ПП / Тяжёлые пистолеты** — от 25 шт.\n' +
          '• **Лёгкие и тяжёлые бронежилеты** — от 40 шт.\n' +
          '• **Патроны 5.56 / 9mm** — от 6.000 шт.\n' +
          '• **Аптечки / Бинты / Еда** — от 80 шт.\n' +
          '• **Ремкомплекты / Отмычки / Канистры** — от 15 шт.',
        inline: false
      }
    )
    .setFooter({
      text: data.updatedBy
        ? `Последнее обновление: ${data.updatedBy} • Отдел Sclad`
        : 'Управление доступно отделу Sclad и High Staff'
    })
    .setTimestamp();
}

function buildScladButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sd_sclad_mode')
        .setLabel('🔄 Капт / РП день')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('sd_sclad_status')
        .setLabel('📊 Обновить статус склада')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('sd_sclad_alert')
        .setLabel('🚨 Срочный сбор на закуп/крафт')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

// =========================================================================
// СБОРКА ЭМБЕДА ДИСЦИПЛИНЫ
// =========================================================================
function buildDisciplineEmbed() {
  return new EmbedBuilder()
    .setTitle('⚖️ Отдел Дисциплины | Контроль и санкции')
    .setColor('#F1C40F')
    .setDescription(
      'Панель управления дисциплиной для сотрудников отдела **Discipline** и **High Staff**.\n\n' +
      '• **⚠️ Выдать / Снять выговор** — управление счётчиком выговоров (`1/3`, `2/3`, `3/3` с авто-киком ролей).\n' +
      '• **📋 Активные выговоры** — список всех участников с действующими предупреждениями.\n' +
      '• **🎥 Запросить откат** — отправить игроку официальный запрос видеозаписи с МП в ЛС.\n' +
      '• **📣 Перекличка строя** — проверить, кто из онлайн-участников не зашёл в голосовой канал сбора.'
    )
    .setFooter({ text: 'Все действия фиксируются в #админ-логи' });
}

function buildDisciplineButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sd_disc_warn')
        .setLabel('⚠️ Выдать / Снять выговор')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('sd_disc_list')
        .setLabel('📋 Активные выговоры')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('sd_disc_vod')
        .setLabel('🎥 Запросить откат')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('sd_disc_rollcall')
        .setLabel('📣 Перекличка строя')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

// =========================================================================
// КОМАНДЫ И ОБРАБОТЧИК
// =========================================================================
const scladDisciplineCommands = [
  new SlashCommandBuilder()
    .setName('панель_склада')
    .setDescription('Отправить панель состояния склада и норм на Капт / РП день')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('панель_дисциплины')
    .setDescription('Отправить панель управления для отдела Discipline')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

async function handleScladDiscipline(interaction, client) {
  // 1. Публикация панелей
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'панель_склада') {
      const msg = await interaction.channel.send({
        embeds: [buildScladEmbed()],
        components: buildScladButtons()
      });
      const data = getJson(SCLAD_FILE, {
        mode: 'CAPT',
        status: '🟢 Укомплектован',
        deficit: 'Всё в наличии согласно норме.'
      });
      data.channelId = interaction.channel.id;
      data.messageId = msg.id;
      saveJson(SCLAD_FILE, data);

      return interaction.reply({ content: '✅ Панель склада успешно опубликована!', ephemeral: true });
    }

    if (interaction.commandName === 'панель_дисциплины') {
      await interaction.channel.send({
        embeds: [buildDisciplineEmbed()],
        components: buildDisciplineButtons()
      });
      return interaction.reply({ content: '✅ Панель отдела Discipline опубликована!', ephemeral: true });
    }
  }

  // 2. Обработка кнопок
  if (interaction.isButton()) {
    const id = interaction.customId;

    // --- КНОПКИ СКЛАДА ---
    if (id.startsWith('sd_sclad_')) {
      if (!hasScladAccess(interaction.member)) {
        return interaction.reply({ content: '❌ Управлять складом может только отдел Sclad или High Staff!', ephemeral: true });
      }

      if (id === 'sd_sclad_mode') {
        const data = getJson(SCLAD_FILE, {
          mode: 'CAPT',
          status: '🟢 Укомплектован',
          deficit: 'Всё в наличии согласно норме.'
        });
        data.mode = data.mode === 'CAPT' ? 'RP' : 'CAPT';
        data.updatedBy = interaction.user.tag;
        saveJson(SCLAD_FILE, data);

        await interaction.update({ embeds: [buildScladEmbed()], components: buildScladButtons() });
        return;
      }

       if (id === 'sd_sclad_status') {
        const data = getJson(SCLAD_FILE, { status: '🟢 Укомплектован', deficit: '' });
        const modal = new ModalBuilder()
          .setCustomId('sd_modal_sclad_status')
          .setTitle('Обновление состояния склада');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('sc_status')
              .setLabel('Статус (🟢 Норма / 🟡 Мало / 🔴 Пусто)')
              .setValue(data.status || '🟡 Требуется пополнение')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('sc_deficit')
              .setLabel('Чего не хватает на складе?')
              .setPlaceholder('Например: Сайги, 100% броники и патроны 5.56')
              .setValue(data.deficit || '')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

      if (id === 'sd_sclad_alert') {
        const modal = new ModalBuilder()
          .setCustomId('sd_modal_sclad_alert')
          .setTitle('Запрос помощи на склад');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('alert_text')
              .setLabel('Что нужно закупить / скрафтить и куда везти?')
              .setPlaceholder('Например: Срочно нужны 20 броников и аптечки на респу перед каптом!')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }
    }

    // --- КНОПКИ ДИСЦИПЛИНЫ ---
    if (id.startsWith('sd_disc_')) {
      if (!hasDisciplineAccess(interaction.member)) {
        return interaction.reply({ content: '❌ Эта панель доступна только отделу Discipline и High Staff!', ephemeral: true });
      }

      if (id === 'sd_disc_warn') {
        const select = new UserSelectMenuBuilder()
          .setCustomId('sd_select_disc_warn')
          .setPlaceholder('👇 Выберите нарушителя...');

        return interaction.reply({
          content: '⚖️ Выберите участника для выдачи или снятия выговора:',
          components: [new ActionRowBuilder().addComponents(select)],
          ephemeral: true
        });
      }

      if (id === 'sd_disc_list') {
        const warns = getJson(WARNS_FILE, {});
        const entries = Object.entries(warns).filter(([, count]) => count > 0);

        const desc = entries.length > 0
          ? entries.map(([uid, count], i) => `**${i + 1}.** <@${uid}> — **${count}/3** выговора`).join('\n')
          : '✅ Активных выговоров у участников семьи нет.';

        const embed = new EmbedBuilder()
          .setTitle(`📋 Список действующих выговоров (${entries.length})`)
          .setDescription(desc)
          .setColor('#E74C3C')
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (id === 'sd_disc_vod') {
        const select = new UserSelectMenuBuilder()
          .setCustomId('sd_select_disc_vod')
          .setPlaceholder('👇 Выберите игрока для запроса отката...');

        return interaction.reply({
          content: '🎥 Выберите участника, у которого нужно запросить откат:',
          components: [new ActionRowBuilder().addComponents(select)],
          ephemeral: true
        });
      }

      if (id === 'sd_disc_rollcall') {
        const voiceId = interaction.member.voice?.channelId || config.EVENTS?.CAPTS_VOICE_ID;
        const targetVoice = voiceId ? interaction.guild.channels.cache.get(voiceId) : null;

        if (!targetVoice) {
          return interaction.reply({
            content: '❌ Зайдите в голосовой канал строя/сбора перед нажатием кнопки переклички!',
            ephemeral: true
          });
        }

        const inVoiceIds = new Set(targetVoice.members.keys());
        const missing = interaction.guild.members.cache.filter(m =>
          !m.user.bot &&
          config.ROLES.FAMQ && m.roles.cache.has(config.ROLES.FAMQ) &&
          !m.roles.cache.has(config.ROLES.VACATION) &&
          m.voice.channelId !== config.CHANNELS.AFK_VOICE &&
          !inVoiceIds.has(m.id) &&
          m.presence?.status && m.presence.status !== 'offline'
        );

        const list = missing.size > 0
          ? missing.map(m => `• <@${m.id}> (\`${m.displayName}\`)`).join('\n').slice(0, 3800)
          : '✅ Все участники семьи, находящиеся в сети, присутствуют в голосовом канале!';

        const embed = new EmbedBuilder()
          .setTitle(`📣 Перекличка канала ${targetVoice.name}`)
          .setDescription(`**В войсе сейчас:** ${inVoiceIds.size} чел.\n\n**Отсутствуют (в сети, без отпуска/АФК):**\n${list}`)
          .setColor('#F39C12')
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }

  // 3. Обработка меню выбора игрока
  if (interaction.isUserSelectMenu()) {
    const targetId = interaction.values.at(0);

    if (interaction.customId === 'sd_select_disc_warn') {
      const modal = new ModalBuilder()
        .setCustomId(`sd_modal_disc_warn_${targetId}`)
        .setTitle('Выговор (Discipline)');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('w_act')
            .setLabel('Действие (+1 выдать, -1 снять)')
            .setValue('+1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('w_reason')
            .setLabel('Пункт устава / причина')
            .setPlaceholder('Например: Неявка в строй по тегу / Нарушение п. 2.1')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'sd_select_disc_vod') {
      const modal = new ModalBuilder()
        .setCustomId(`sd_modal_disc_vod_${targetId}`)
        .setTitle('Запрос отката (Discipline)');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vod_event')
            .setLabel('С какого МП / ситуации нужен откат?')
            .setPlaceholder('Например: Капт 20:00 / Поставка')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vod_time')
            .setLabel('Срок предоставления')
            .setValue('2 часа (загрузить ссылку в личный портфель)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }
  }

  // 4. Обработка модальных окон
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    if (id === 'sd_modal_sclad_status') {
      const data = getJson(SCLAD_FILE, { mode: 'CAPT' });
      data.status = interaction.fields.getTextInputValue('sc_status').trim();
      data.deficit = interaction.fields.getTextInputValue('sc_deficit').trim();
      data.updatedBy = interaction.user.tag;
      saveJson(SCLAD_FILE, data);

      await interaction.update({ embeds: [buildScladEmbed()], components: buildScladButtons() });
      return;
    }

    if (id === 'sd_modal_sclad_alert') {
      const text = interaction.fields.getTextInputValue('alert_text').trim();
      const alertEmbed = new EmbedBuilder()
        .setTitle('🚨 СРОЧНЫЙ ЗАПРОС ОТДЕЛА СКЛАДА')
        .setDescription(text)
        .addFields({ name: '📦 Запросил', value: `<@${interaction.user.id}>`, inline: true })
        .setColor('#E74C3C')
        .setTimestamp();

      const ping = config.ROLES.FAMQ ? `<@&${config.ROLES.FAMQ}>` : undefined;
      await interaction.channel.send({ content: ping, embeds: [alertEmbed] });
      return interaction.reply({ content: '✅ Уведомление о пополнении склада опубликовано!', ephemeral: true });
    }

    if (id.startsWith('sd_modal_disc_warn_')) {
      const userId = id.replace('sd_modal_disc_warn_', '');
      const act = interaction.fields.getTextInputValue('w_act').trim();
      const reason = interaction.fields.getTextInputValue('w_reason').trim();

      const warns = getJson(WARNS_FILE, {});
      const current = warns[userId] || 0;
      const delta = act.startsWith('-') ? -1 : 1;
      const updated = Math.max(0, current + delta);

      if (updated === 0) delete warns[userId];
      else warns[userId] = updated;
      saveJson(WARNS_FILE, warns);

      const member = interaction.guild.members.cache.get(userId) || await interaction.guild.members.fetch(userId).catch(() => null);
      await syncWarnRoles(member, updated);

      let extraNote = '';
      if (updated >= 3 && member) {
        const familyRoles = [config.ROLES.FAMQ, ...getAllRankRoleIds()].filter(Boolean);
        await member.roles.remove(familyRoles).catch(() => {});
        extraNote = '\n🚨 **Достигнут лимит 3/3 — семейные роли автоматически сняты.**';
      }

      client.users.fetch(userId).then(u => {
        u.send(
          `${delta > 0 ? '⚠️ Вам выдан выговор отделом Discipline' : '🟢 С вас снят выговор'} в семье **${interaction.guild.name}**!\n` +
          `**Счётчик:** ${updated}/3\n**Причина:** ${reason}`
        ).catch(() => {});
      }).catch(() => {});

           sendAdminLog(
        interaction.guild,
        delta > 0 ? '⚠️ Выговор (Discipline)' : '🟢 Снятие выговора (Discipline)',
        `**Участник:** <@${userId}>\n**Счётчик:** ${current}/3 ➔ **${updated}/3**\n**Причина:** ${reason}\n**Выдал:** <@${interaction.user.id}>${extraNote}`,
        delta > 0 ? '#E74C3C' : '#2ECC71'
      );

      return interaction.reply({
        content: `✅ Выговоры <@${userId}> обновлены: **${current}/3 ➔ ${updated}/3**\n**Причина:** ${reason}${extraNote}`,
        ephemeral: true
      });
    }

    if (id.startsWith('sd_modal_disc_vod_')) {
      const userId = id.replace('sd_modal_disc_vod_', '');
      const eventName = interaction.fields.getTextInputValue('vod_event').trim();
      const deadline = interaction.fields.getTextInputValue('vod_time').trim();

      const dmEmbed = new EmbedBuilder()
        .setTitle('🎥 Запрос отката (Отдел Discipline)')
        .setColor('#E74C3C')
        .setDescription(
          `Отдел дисциплины семьи **${interaction.guild.name}** запрашивает у вас видеозапись!\n\n` +
          `📌 **Ситуация / МП:** ${eventName}\n` +
          `⏳ **Срок сдачи:** ${deadline}\n` +
          `⚖️ **Запросил:** <@${interaction.user.id}>`
        )
        .setTimestamp();

      const targetUser = await client.users.fetch(userId).catch(() => null);
      const sent = targetUser ? await targetUser.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false) : false;

      sendAdminLog(
        interaction.guild,
        '🎥 Запрос отката (Discipline)',
        `**Игрок:** <@${userId}>\n**МП:** ${eventName}\n**Срок:** ${deadline}\n**Запросил:** <@${interaction.user.id}>`,
        '#F39C12'
      );

      return interaction.reply({
        content: sent
          ? `✅ Запрос на откат отправлен игроку <@${userId}> в ЛС!`
          : `⚠️ Запрос зафиксирован в логах, но у <@${userId}> закрыты личные сообщения.`,
        ephemeral: true
      });
    }
  }
}

module.exports = {
  scladDisciplineCommands,
  handleScladDiscipline,
  buildScladEmbed,
  buildScladButtons,
  buildDisciplineEmbed,
  buildDisciplineButtons
};


