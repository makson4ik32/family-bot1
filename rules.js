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
  PermissionFlagsBits
} = require('discord.js');

const RULES_FILE = path.join(__dirname, 'rules_data.json');

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    return {
      title: '📜 Устав и Правила Семьи',
      description: 'Незнание правил не освобождает от ответственности. Соблюдайте дисциплину и субординацию.',
      color: '#E74C3C',
      image: '',
      footer: 'Администрация семьи оставляет за собой право изменять правила.',
      sections: [
        {
          name: '1. Общие положения',
          value: '• Уважать всех участников семьи, запрещены оскорбления и токсичность.\n• Запрещён слив информации и имущества со склада.'
        },
        {
          name: '2. Сборы и мероприятия',
          value: '• При теге в канале сборов обязательна явка или отметка в АФК.\n• В голосовом канале соблюдать тишину во время коллов.'
        }
      ]
    };
  }
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveRules(data) {
  fs.writeFileSync(RULES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function buildRulesEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle(data.title || '📜 Правила семьи')
    .setDescription(data.description || ' ')
    .setColor(data.color || '#E74C3C')
    .setTimestamp();

  if (data.sections && data.sections.length > 0) {
    data.sections.forEach(sec => {
      embed.addFields({ name: sec.name, value: sec.value, inline: false });
    });
  }

  if (data.image && (data.image.startsWith('http://') || data.image.startsWith('https://'))) {
    embed.setImage(data.image);
  }

  if (data.footer) {
    embed.setFooter({ text: data.footer });
  }

  return embed;
}

const rulesCommand = new SlashCommandBuilder()
  .setName('панель_правил')
  .setDescription('Опубликовать и настроить правила семьи в этом канале (Билдер правил)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleRules(interaction) {
  // 1. Отправка сообщения с правилами и кнопкой управления
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_правил') {
    const data = loadRules();
    const embed = buildRulesEmbed(data);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rules_builder_open')
        .setLabel('🛠 Редактор правил (Админ)')
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    data.channelId = interaction.channel.id;
    data.messageId = msg.id;
    saveRules(data);

    return interaction.reply({ content: '✅ Правила опубликованы! Нажми кнопку под постом, чтобы настроить разделы.', ephemeral: true });
  }

  // Проверка прав администратора для всех кнопок билдера
  if ((interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith('rules_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Настраивать правила может только администратор!', ephemeral: true });
    }
  }

  // 2. Открытие меню конструктора
  if (interaction.isButton() && interaction.customId === 'rules_builder_open') {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rules_edit_header')
        .setLabel('✏️ Шапка, цвет и баннер')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('rules_add_section')
        .setLabel('➕ Добавить пункт/раздел')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rules_del_section_menu')
        .setLabel('🗑 Удалить раздел')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: '🛠 **Конструктор правил** — выберите действие (изменения сразу обновят сообщение в канале):',
      components: [row1],
      ephemeral: true
    });
  }

  // 3. Редактирование заголовка, описания, цвета и картинки
  if (interaction.isButton() && interaction.customId === 'rules_edit_header') {
    const data = loadRules();
    const modal = new ModalBuilder()
      .setCustomId('rules_modal_header')
      .setTitle('Настройка шапки правил');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('r_title')
          .setLabel('Заголовок')
          .setValue(data.title || '')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('r_desc')
          .setLabel('Вступительный текст')
          .setValue(data.description || '')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('r_color')
          .setLabel('HEX-цвет полоски (например #E74C3C)')
          .setValue(data.color || '#E74C3C')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('r_image')
          .setLabel('Ссылка на баннер/картинку (необязательно)')
          .setValue(data.image || '')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'rules_modal_header') {
    const data = loadRules();
    data.title = interaction.fields.getTextInputValue('r_title');
    data.description = interaction.fields.getTextInputValue('r_desc');
    data.color = interaction.fields.getTextInputValue('r_color');
    data.image = interaction.fields.getTextInputValue('r_image').trim();
    saveRules(data);

    await updateRulesMessage(interaction, data);
    return interaction.reply({ content: '✅ Шапка и оформление правил обновлены!', ephemeral: true });
  }

  // 4. Добавление нового раздела правил
  if (interaction.isButton() && interaction.customId === 'rules_add_section') {
    const data = loadRules();
    if ((data.sections || []).length >= 25) {
      return interaction.reply({ content: '❌ Достигнут лимит Discord (максимум 25 разделов в одном сообщении).', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('rules_modal_addsec')
      .setTitle('Новый раздел правил');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sec_name')
          .setLabel('Название раздела (например: 3. Склад и авто)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sec_value')
          .setLabel('Текст пунктов правил')
          .setPlaceholder('• Пункт 3.1...\n• Пункт 3.2...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'rules_modal_addsec') {
    const data = loadRules();
    if (!data.sections) data.sections = [];
    data.sections.push({
      name: interaction.fields.getTextInputValue('sec_name'),
      value: interaction.fields.getTextInputValue('sec_value')
    });
    saveRules(data);

    await updateRulesMessage(interaction, data);
    return interaction.reply({ content: '✅ Новый раздел добавлен в правила!', ephemeral: true });
  }

  // 5. Удаление раздела правил
  if (interaction.isButton() && interaction.customId === 'rules_del_section_menu') {
    const data = loadRules();
    if (!data.sections || data.sections.length === 0) {
      return interaction.reply({ content: '⚠️ В правилах пока нет разделов для удаления.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('rules_select_delsec')
      .setPlaceholder('👇 Выберите раздел для удаления...')
      .addOptions(
        data.sections.map((sec, index) => ({
          label: sec.name.slice(0, 100),
          description: sec.value.slice(0, 50),
          value: String(index)
        }))
      );

    return interaction.reply({
      content: 'Выберите раздел, который нужно удалить:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'rules_select_delsec') {
    const idx = parseInt(interaction.values[0], 10);
    const data = loadRules();
    if (data.sections && data.sections[idx]) {
      const removed = data.sections.splice(idx, 1);
      saveRules(data);
      await updateRulesMessage(interaction, data);
      return interaction.update({ content: `🗑 Раздел **«${removed[0].name}»** удалён!`, components: [] });
    }
  }
}

async function updateRulesMessage(interaction, data) {
  if (!data.channelId || !data.messageId) return;
  const ch = interaction.guild.channels.cache.get(data.channelId);
  if (!ch) return;
  const msg = await ch.messages.fetch(data.messageId).catch(() => null);
  if (msg) {
    await msg.edit({ embeds: [buildRulesEmbed(data)] }).catch(() => {});
  }
}

module.exports = { rulesCommand, handleRules };
