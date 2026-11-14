const config = require('./config');
const settings = require('./settings');
const PORTFOLIO_CATEGORY_ID = config.CHANNELS.PORTFOLIO_CATEGORY;
const STAFF_ROLE_ID = config.ROLES.STAFF_PORTFOLIO;

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

const portfolioCommand = new SlashCommandBuilder()
  .setName('панель_портфеля')
  .setDescription('Отправить в этот канал кнопку для создания личного портфеля')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePortfolio(interaction) {
  const pCfg = settings.PANELS.PORTFOLIO;

  // 1. Отправка сообщения с кнопкой
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_портфеля') {
    const embed = settings.applyPanelStyle(new EmbedBuilder(), pCfg, '#9B59B6');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_portfolio_modal')
        .setLabel(pCfg.buttonLabel || '📁 Создать личный портфель')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель создания портфеля успешно отправлена!', ephemeral: true });
  }

  // 2. Нажатие на кнопку -> открытие окна с 3 пунктами
  if (interaction.isButton() && interaction.customId === 'open_portfolio_modal') {
    const existingChannel = interaction.guild.channels.cache.find(
      ch => ch.parentId === PORTFOLIO_CATEGORY_ID && ch.topic && ch.topic.includes(interaction.user.id)
    );

    if (existingChannel) {
      return interaction.reply({
        content: `⚠️ У тебя уже есть созданный портфель: ${existingChannel}!`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_create_portfolio')
      .setTitle('Создание личного портфеля');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('port_name')
          .setLabel('1. Имя и Фамилия (в игре)')
          .setPlaceholder('Например: Ivan Begov')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('port_static')
          .setLabel('2. Ваш Статик ID')
          .setPlaceholder('Например: #12345')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('port_rank')
          .setLabel('3. Ваш текущий ранг')
          .setPlaceholder('Например: 1 (Test)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // 3. Обработка формы -> создание закрытого канала
  if (interaction.isModalSubmit() && interaction.customId === 'modal_create_portfolio') {
    const fullName = interaction.fields.getTextInputValue('port_name');
    const staticId = interaction.fields.getTextInputValue('port_static');
    const rank = interaction.fields.getTextInputValue('port_rank');

    const cleanName = fullName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
    const channelName = `портфель-${cleanName || interaction.user.username}`;

    try {
      const createdChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: PORTFOLIO_CATEGORY_ID,
        topic: `Личный портфель игрока ${fullName} | Owner ID: ${interaction.user.id}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ]
      });

      const infoEmbed = new EmbedBuilder()
        .setTitle(`📁 Личный портфель: ${fullName}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setColor(settings.resolveColor(pCfg.color, '#9B59B6'))
        .addFields(
          { name: '👤 Владелец', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🆔 Статик', value: `\`${staticId}\``, inline: true },
          { name: '🎖 Ранг', value: rank, inline: true }
        )
        .setFooter({ text: 'Сюда ты можешь загружать свои скриншоты и отчеты для старшего состава.' })
        .setTimestamp();

      await createdChannel.send({ content: `<@${interaction.user.id}>`, embeds: [infoEmbed] });

      return interaction.reply({
        content: `✅ Твой личный портфель успешно создан: ${createdChannel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Ошибка создания портфеля:', error);
      return interaction.reply({
        content: '❌ Не удалось создать канал. Проверь ID категории и право бота «Управлять каналами».',
        ephemeral: true
      });
    }
  }
}

module.exports = { portfolioCommand, handlePortfolio };
