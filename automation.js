const config = require('./config');
const settings = require('./settings');
const { getJson, saveJson } = require('./db');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const ADMIN_FILE = 'admin_data.json';
const MAPS_FILE = 'maps_data.json';

function isStaffOrCaller(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return [
    config.ROLES.HIGH_STAFF,
    config.ROLES.CALLER,
    config.ROLES.COACH,
    config.ROLES.DEP_LEADER,
    config.ROLES.LEADER
  ].filter(Boolean).some(r => member.roles.cache.has(r));
}



// =========================================================================
// 1. АВТОМАТИЧЕСКИЕ СОБЫТИЯ (ЛИВ С СЕРВЕРА + УДАЛЕНИЕ ПОРТФЕЛЯ + ЧС)
// =========================================================================
function setupAutomation(client) {
  client.on('guildMemberRemove', async (member) => {
    try {
      if (!member.guild || member.user?.bot) return;

      const hadFamilyRole = config.ROLES.FAMQ ? member.roles.cache.has(config.ROLES.FAMQ) : false;
      const savedRoles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.name);

      // Удаляем личный портфель вышедшего игрока
      let portfolioDeleted = false;
      const catId = config.CHANNELS.PORTFOLIO_CATEGORY;
      if (catId) {
        const portfolioCh = member.guild.channels.cache.find(
          ch => ch.parentId === catId && ch.topic && ch.topic.includes(member.id)
        );
        if (portfolioCh) {
          portfolioDeleted = await portfolioCh.delete('Автоудаление портфеля: участник покинул сервер')
            .then(() => true)
            .catch(() => false);
        }
      }

      if (!hadFamilyRole) return;

      // Записываем в leftMembers в admin_data.json
      const adminData = getJson(ADMIN_FILE, { recruitOpen: true, blacklist: [], leftMembers: [] });
      if (!Array.isArray(adminData.leftMembers)) adminData.leftMembers = [];

      adminData.leftMembers.unshift({
        userId: member.id,
        tag: member.user.tag,
        displayName: member.displayName,
        leftAt: Date.now(),
        roles: savedRoles
      });
      adminData.leftMembers = adminData.leftMembers.slice(0, 50);
      saveJson(ADMIN_FILE, adminData);

      // Отправляем карточку в #админ-логи с кнопкой "Внести в ЧС"
      const logsCh = member.guild.channels.cache.get(config.CHANNELS.ADMIN_LOGS);
      if (logsCh) {
        const embed = new EmbedBuilder()
          .setTitle('🏃 Участник семьи покинул сервер')
          .setColor('#E74C3C')
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: '👤 Игрок', value: `<@${member.id}> (\`${member.displayName}\`)`, inline: true },
            { name: '🆔 Discord ID', value: `\`${member.id}\``, inline: true },
            { name: '💼 Личный портфель', value: portfolioDeleted ? '🗑 Удалён автоматически' : 'Не найден', inline: true },
            { name: '🎭 Были роли', value: savedRoles.length > 0 ? savedRoles.join(', ').slice(0, 1000) : 'Нет', inline: false }
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`auto_bl_left_${member.id}`)
            .setLabel('⛔ Внести в ЧС за лив без отписи')
            .setStyle(ButtonStyle.Danger)
        );

        await logsCh.send({ embeds: [embed], components: [row] }).catch(() => {});
      }
    } catch (err) {
      console.error('Ошибка в setupAutomation (guildMemberRemove):', err);
    }
  });
}

// =========================================================================
// 2. ПЕРЕКИДЫВАНИЕ НА ОБЗВОН В СВОБОДНЫЙ КАНАЛ (Обзвон-1 / 2 / 3)
// =========================================================================
async function moveToFreeInterviewChannel(guild, recruiterMember, candidateId) {
  const candidateMember = guild.members.cache.get(candidateId) || await guild.members.fetch(candidateId).catch(() => null);
  if (!candidateMember || !candidateMember.voice?.channelId) return null;

  const interviewChannels = guild.channels.cache.filter(
    ch => ch.type === ChannelType.GuildVoice && /обзвон/i.test(ch.name) && ch.members.size === 0
  );

  const freeCh = interviewChannels.first();
  if (!freeCh) return null;

  await candidateMember.voice.setChannel(freeCh.id).catch(() => {});
  if (recruiterMember?.voice?.channelId) {
    await recruiterMember.voice.setChannel(freeCh.id).catch(() => {});
  }
  return freeCh;
}

// =========================================================================
// 3. КОМАНДЫ И ОБРАБОТЧИК КАРТ КАПТОВ + КНОПКИ АВТОМАТИЗАЦИИ
// =========================================================================
const automationCommands = [
  new SlashCommandBuilder()
    .setName('панель_карт')
    .setDescription('Отправить интерактивный справочник по картам каптов')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('добавить_карту')
    .setDescription('Добавить или обновить тактику карты капта')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
];

async function handleAutomation(interaction) {
  // Команда /панель_карт
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_карт') {
    const { publishPanelToChannel } = require('./panel_manager');
    const res = await publishPanelToChannel(interaction.guild, 'MAPS', interaction.channel.id);
    return interaction.reply({
      content: res.ok ? '✅ Справочник карт каптов опубликован!' : `❌ Ошибка: ${res.error}`,
      ephemeral: true
    });
  }

  // Команда /добавить_карту
  if (interaction.isChatInputCommand() && interaction.commandName === 'добавить_карту') {
    if (!isStaffOrCaller(interaction.member)) {
      return interaction.reply({ content: '❌ Редактировать карты могут только Caller, Coach и High Staff!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('auto_modal_addmap')
      .setTitle('Добавить / Обновить карту капта');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('map_key')
          .setLabel('Ключ карты на латинице (например: factory)')
          .setPlaceholder('factory / port / mall / stroyka')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('map_name')
          .setLabel('Название карты')
          .setPlaceholder('Например: 🏭 Завод (Factory)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('map_short')
          .setLabel('Краткое описание (для списка)')
          .setPlaceholder('Ближние дистанции, контроль крыш')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('map_tactics')
          .setLabel('Коллы, оружие и тактика')
          .setPlaceholder('Опишите ключевые позиции, оружие и план захода...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('map_image')
          .setLabel('Ссылка на схему/скриншот карты (необязательно)')
          .setPlaceholder('https://...')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }
  // Выбор карты капта из выпадающего меню
  if (interaction.isStringSelectMenu() && interaction.customId === 'auto_select_map') {
    const mapKey = interaction.values.at(0);
    const mapsData = getJson(MAPS_FILE, settings.DEFAULT_MAPS || {});
    const mapInfo = mapsData[mapKey];

    if (!mapInfo) {
      return interaction.reply({ content: '❌ Выбранная карта не найдена.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🗺 Карта капта: ${mapInfo.name}`)
      .setDescription(mapInfo.tactics || 'Описание тактики не заполнено.')
      .setColor('#E67E22')
      .setFooter({ text: 'Тактический справочник • Обновляется через /добавить_карту' });

    if (mapInfo.image && /^https?:\/\//i.test(mapInfo.image)) {
      embed.setImage(mapInfo.image);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Сохранение новой или обновлённой карты капта
  if (interaction.isModalSubmit() && interaction.customId === 'auto_modal_addmap') {
    const key = interaction.fields.getTextInputValue('map_key').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const name = interaction.fields.getTextInputValue('map_name').trim();
    const shortDesc = interaction.fields.getTextInputValue('map_short').trim();
    const tactics = interaction.fields.getTextInputValue('map_tactics').trim();
    const image = interaction.fields.getTextInputValue('map_image').trim();

    if (!key) {
      return interaction.reply({ content: '❌ Ключ карты должен содержать латинские буквы или цифры.', ephemeral: true });
    }
    if (image && !/^https?:\/\//i.test(image)) {
      return interaction.reply({ content: '❌ Ссылка на картинку должна начинаться с `http://` или `https://`.', ephemeral: true });
    }

    const mapsData = getJson(MAPS_FILE, settings.DEFAULT_MAPS || {});
    mapsData[key] = { name, shortDesc, tactics, image };
    saveJson(MAPS_FILE, mapsData);

    const { refreshPublishedPanel } = require('./panel_manager');
    await refreshPublishedPanel(interaction.guild, 'MAPS');

    return interaction.reply({
      content: `✅ Карта **${name}** (\`${key}\`) сохранена и обновлена в справочнике!`,
      ephemeral: true
    });
  }

  // Кнопка "Внести в ЧС за лив без отписи" из #админ-логи
  if (interaction.isButton() && interaction.customId.startsWith('auto_bl_left_')) {
    const targetId = interaction.customId.replace('auto_bl_left_', '');

    const adminData = getJson(ADMIN_FILE, { recruitOpen: true, blacklist: [], leftMembers: [] });
    if (!Array.isArray(adminData.blacklist)) adminData.blacklist = [];

    const already = adminData.blacklist.some(b => b.userId === targetId);
    if (already) {
      return interaction.reply({ content: `⚠️ Игрок \`${targetId}\` уже находится в чёрном списке!`, ephemeral: true });
    }

    adminData.blacklist.push({
      userId: targetId,
      reason: 'Выход из семьи / Discord без отписи',
      by: interaction.user.username
    });
    saveJson(ADMIN_FILE, adminData);

    const oldEmbed = interaction.message.embeds.at(0);
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor('#992D22')
      .addFields({ name: '⛔ Статус ЧС', value: `Внесён в ЧС модератором <@${interaction.user.id}>`, inline: false });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
    return interaction.followUp({ content: `⛔ \`${targetId}\` успешно добавлен в чёрный список семьи!`, ephemeral: true });
  }
}

module.exports = {
  setupAutomation,
  moveToFreeInterviewChannel,
  automationCommands,
  handleAutomation
};
