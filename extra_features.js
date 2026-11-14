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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const extraCommands = [
  new SlashCommandBuilder()
    .setName('профиль')
    .setDescription('Посмотреть полную карточку участника семьи')
    .addUserOption(opt => opt.setName('участник').setDescription('Чей профиль открыть')),
  new SlashCommandBuilder()
    .setName('панель_розыгрышей')
    .setDescription('Отправить постоянную панель для запуска розыгрышей')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('розыгрыш')
    .setDescription('Запустить розыгрыш в текущем канале')
    .addStringOption(opt => opt.setName('приз').setDescription('Что разыгрываем?').setRequired(true))
    .addIntegerOption(opt => opt.setName('победителей').setDescription('Количество победителей').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('панель_скупки')
    .setDescription('Отправить панель сдачи оружия/лута на склад за премию')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('панель_контрактов')
    .setDescription('Отправить панель учёта семейных контрактов')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const giveaways = new Map();

function readJsonSafe(filename) {
  const file = path.join(__dirname, filename);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

async function handleExtra(interaction, client) {
  const extraCfg = settings.PANELS.EXTRA;

  // 1. /ПРОФИЛЬ ИГРОКА
  if (interaction.isChatInputCommand() && interaction.commandName === 'профиль') {
    const targetUser = interaction.options.getUser('участник') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const eco = readJsonSafe('economy_data.json')[targetUser.id] || { points: 0, voiceMinutes: 0 };
    const warns = readJsonSafe('warns_data.json')[targetUser.id] || 0;
    const prof = readJsonSafe('users_profiles.json')[targetUser.id] || {};

    const hasCapt = member ? member.roles.cache.has(config.ROLES.CAPT_SQUAD) : false;
    const hasRp = member ? member.roles.cache.has(config.ROLES.RP_SQUAD) : false;

    let branchText = 'Не указано';
    if (hasCapt && hasRp) branchText = '⚔️ Capt & 🎭 RP (2 направления)';
    else if (hasCapt) branchText = '⚔️ Capt состав';
    else if (hasRp) branchText = '🎭 RP состав';
    else if (prof.branch) branchText = prof.branch;

    const hours = Math.floor((eco.voiceMinutes || 0) / 60);
    const mins = (eco.voiceMinutes || 0) % 60;
    const joinedTimestamp = prof.joinedAt
      ? Math.floor(prof.joinedAt / 1000)
      : Math.floor((member?.joinedTimestamp || Date.now()) / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`🪪 Карточка участника: ${member ? member.displayName : targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : '#3498DB')
      .addFields(
        { name: '👤 Discord', value: `<@${targetUser.id}> (\`${targetUser.tag}\`)`, inline: true },
        { name: '🎖 Высшая роль', value: member ? `${member.roles.highest}` : 'Не на сервере', inline: true },
        { name: '⚔️ Направление', value: `**${branchText}**`, inline: true },
        { name: '💎 Баланс баллов', value: `**${eco.points} б.**`, inline: true },
        { name: '⚠️ Выговоры', value: `**${warns} / 3**`, inline: true },
        { name: '🎙 Время в войсе', value: `**${hours} ч. ${mins} мин.**`, inline: true },
        { name: '📅 В семье с', value: `<t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`, inline: true },
        { name: '🤝 Принял в семью', value: prof.acceptedBy || 'Не зафиксировано', inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 2. ПАНЕЛЬ РОЗЫГРЫШЕЙ (/панель_розыгрышей) и /розыгрыш
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_розыгрышей') {
    const gwCfg = extraCfg.GIVEAWAY_PANEL;
    const embed = settings.applyPanelStyle(new EmbedBuilder(), gwCfg, '#F1C40F');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ext_gw_create_btn')
        .setLabel(gwCfg.buttonLabel || '🎁 Создать розыгрыш')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель розыгрышей успешно создана!', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ext_gw_create_btn') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(config.ROLES.HIGH_STAFF)) {
      return interaction.reply({ content: '❌ Запускать розыгрыши может только руководство!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('ext_gw_create_modal')
      .setTitle('Запуск семейного розыгрыша');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('gw_prize').setLabel('Приз розыгрыша').setPlaceholder('Например: 500.000$ / Тяжёлая снайперка / Majestic Premium').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('gw_winners').setLabel('Количество победителей (число)').setPlaceholder('Например: 1').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('gw_desc').setLabel('Условия или описание (необязательно)').setPlaceholder('Например: Итоги сегодня в 21:00 по МСК').setStyle(TextInputStyle.Paragraph).setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ext_gw_create_modal') {
    const prize = interaction.fields.getTextInputValue('gw_prize');
    const winnersRaw = parseInt(interaction.fields.getTextInputValue('gw_winners'), 10);
    const winnersCount = (!isNaN(winnersRaw) && winnersRaw > 0) ? winnersRaw : 1;
    const extraDesc = interaction.fields.getTextInputValue('gw_desc');

    const embed = new EmbedBuilder()
      .setTitle('🎉 СЕМЕЙНЫЙ РОЗЫГРЫШ!')
      .setDescription(
        `🎁 **Приз:** ${prize}\n` +
        `🏆 **Количество победителей:** ${winnersCount}\n` +
        `👥 **Участников:** 0\n` +
        (extraDesc ? `\n📌 **Условия:** ${extraDesc}\n` : '') +
        `\nНажми кнопку ниже, чтобы участвовать!`
      )
      .setColor(settings.resolveColor(extraCfg.GIVEAWAY_PANEL.color, '#F1C40F'))
      .setFooter({ text: `Запустил: ${interaction.user.tag}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_gw_join').setLabel('🎉 Участвовать').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ext_gw_end').setLabel('🏁 Подвести итоги').setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.channel.send({ content: '@everyone', embeds: [embed], components: [row] });
    giveaways.set(msg.id, { prize, winnersCount, extraDesc, users: new Set(), authorId: interaction.user.id });
    return interaction.reply({ content: '✅ Розыгрыш успешно запущен!', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'розыгрыш') {
    const prize = interaction.options.getString('приз');
    const winnersCount = interaction.options.getInteger('победителей');

    const embed = new EmbedBuilder()
      .setTitle('🎉 СЕМЕЙНЫЙ РОЗЫГРЫШ!')
      .setDescription(`🎁 **Приз:** ${prize}\n🏆 **Количество победителей:** ${winnersCount}\n👥 **Участников:** 0\n\nНажми кнопку ниже, чтобы участвовать!`)
      .setColor(settings.resolveColor(extraCfg.GIVEAWAY_PANEL.color, '#F1C40F'))
      .setFooter({ text: `Запустил: ${interaction.user.tag}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_gw_join').setLabel('🎉 Участвовать').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ext_gw_end').setLabel('🏁 Подвести итоги').setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.channel.send({ content: '@everyone', embeds: [embed], components: [row] });
    giveaways.set(msg.id, { prize, winnersCount, extraDesc: '', users: new Set(), authorId: interaction.user.id });
    return interaction.reply({ content: '✅ Розыгрыш запущен!', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ext_gw_join') {
    const gw = giveaways.get(interaction.message.id);
    if (!gw) return interaction.reply({ content: '⚠️ Розыгрыш уже завершён.', ephemeral: true });
    if (gw.users.has(interaction.user.id)) return interaction.reply({ content: '✅ Ты уже участвуешь!', ephemeral: true });

        gw.users.add(interaction.user.id);
    const updEmbed = EmbedBuilder.from(interaction.message.embeds.at(0))
      .setDescription(
        `🎁 **Приз:** ${gw.prize}\n` +
        `🏆 **Количество победителей:** ${gw.winnersCount}\n` +
        `👥 **Участников:** ${gw.users.size}\n` +
        (gw.extraDesc ? `\n📌 **Условия:** ${gw.extraDesc}\n` : '') +
        `\nНажми кнопку ниже, чтобы участвовать!`
      );
    return interaction.update({ embeds: [updEmbed] });
  }

  if (interaction.isButton() && interaction.customId === 'ext_gw_end') {
    const gw = giveaways.get(interaction.message.id);
    if (!gw) return interaction.reply({ content: '⚠️ Розыгрыш не найден.', ephemeral: true });
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(config.ROLES.HIGH_STAFF)) {
      return interaction.reply({ content: '❌ Завершить розыгрыш может только руководство.', ephemeral: true });
    }

    const pool = Array.from(gw.users);
    if (pool.length === 0) return interaction.reply({ content: '❌ Никто не участвовал в розыгрыше.', ephemeral: true });

    const shuffled = pool.sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, gw.winnersCount).map(id => `<@${id}>`).join(', ');

    const endEmbed = new EmbedBuilder()
      .setTitle('🏆 ИТОГИ РОЗЫГРЫША!')
      .setDescription(`🎁 **Приз:** ${gw.prize}\n👑 **Победитель(и):** ${winners}\n👥 **Всего участников:** ${pool.length}`)
      .setColor('#2ECC71');

    giveaways.delete(interaction.message.id);
    await interaction.update({ content: `Поздравляем победителей: ${winners}!`, embeds: [endEmbed], components: [] });
  }

  // 3. СКУПКА ОРУЖИЯ И МАТЕРИАЛОВ
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_скупки') {
    const skCfg = extraCfg.SKUPKA_PANEL;
    const embed = settings.applyPanelStyle(new EmbedBuilder(), skCfg, '#E67E22');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ext_skupka_btn')
        .setLabel(skCfg.buttonLabel || '📦 Сдать лут на премию')
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель скупки создана!', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ext_skupka_btn') {
    const modal = new ModalBuilder().setCustomId('ext_skupka_modal').setTitle('Сдача оружия / лута на склад');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sk_nick').setLabel('Ваш Ник, Статик и банковский счёт').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sk_items').setLabel('Что именно положили на склад и кол-во?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sk_proof').setLabel('Ссылка на скрин/видео (Imgur / YouTube)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ext_skupka_modal') {
    const nick = interaction.fields.getTextInputValue('sk_nick');
    const items = interaction.fields.getTextInputValue('sk_items');
    const proof = interaction.fields.getTextInputValue('sk_proof');

    const payCh = client.channels.cache.get(config.CHANNELS.PAYOUT_REQUESTS);
    if (!payCh) return interaction.reply({ content: '❌ Канал выплат не настроен.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🔫 Заявка по скупке на склад')
      .setColor(settings.resolveColor(extraCfg.SKUPKA_PANEL.color, '#E67E22'))
      .addFields(
        { name: '👤 Игрок', value: `<@${interaction.user.id}> (${nick})`, inline: false },
        { name: '📦 Сдано на склад', value: items, inline: false },
        { name: '📎 Доказательства', value: proof, inline: false }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eco_paydone_${interaction.user.id}`).setLabel('✅ Премия выплачена').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eco_paydeny_${interaction.user.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger)
    );

    await payCh.send({ content: `<@&${config.ROLES.SCLAD || config.ROLES.HIGH_STAFF}>`, embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Заявка на премию за скупку отправлена!', ephemeral: true });
  }

  // 4. УЧЁТ КОНТРАКТОВ СЕМЬИ (#контракты)
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_контрактов') {
    const cCfg = extraCfg.CONTRACTS_PANEL;
    const embed = settings.applyPanelStyle(new EmbedBuilder(), cCfg, '#1ABC9C');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_contract_take').setLabel(cCfg.btnTake || '⏳ Взял контракт').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ext_contract_done').setLabel(cCfg.btnDone || '✅ Закрыл контракт').setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель контрактов создана!', ephemeral: true });
  }

  if (interaction.isButton() && (interaction.customId === 'ext_contract_take' || interaction.customId === 'ext_contract_done')) {
    const isTake = interaction.customId === 'ext_contract_take';
    const modal = new ModalBuilder()
      .setCustomId(isTake ? 'ext_cm_take' : 'ext_cm_done')
      .setTitle(isTake ? 'Взятие контракта' : 'Закрытие контракта');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('c_name').setLabel('Название контракта').setPlaceholder('Например: Рыба / Мусор / Дары моря / Корабль').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('c_info')
          .setLabel(isTake ? 'Через сколько КД / сколько нужно людей?' : 'Ссылка на скриншот сдачи (Imgur / Yapx)')
          .setPlaceholder(isTake ? 'Например: КД 2 часа / Нужно 3 человека на точки' : 'Вставь ссылку на скриншот')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && (interaction.customId === 'ext_cm_take' || interaction.customId === 'ext_cm_done')) {
    const isTake = interaction.customId === 'ext_cm_take';
    const name = interaction.fields.getTextInputValue('c_name');
    const info = interaction.fields.getTextInputValue('c_info');

    const embed = new EmbedBuilder()
      .setTitle(isTake ? `⏳ Контракт ВЗЯТ: ${name}` : `✅ Контракт ЗАКРЫТ: ${name}`)
      .setColor(isTake ? '#3498DB' : '#2ECC71')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Участник', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📋 Контракт', value: `**${name}**`, inline: true },
        { name: isTake ? '⏱ Детали / Помощь' : '📎 Доказательство сдачи', value: info, inline: false }
      )
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Информация по контракту опубликована!', ephemeral: true });
  }
}

module.exports = { extraCommands, handleExtra };

