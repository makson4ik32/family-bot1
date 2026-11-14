const config = require('./config');
const AFK_LOGS_CHANNEL_ID = config.CHANNELS.AFK_LOGS;
const VACATION_ROLE_ID = config.ROLES.VACATION;

// ===========================================================

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

const STORAGE_FILE = path.join(__dirname, 'vacation_roles.json');

function loadSavedRoles() {
  if (!fs.existsSync(STORAGE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveRolesData(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const afkCommand = new SlashCommandBuilder()
  .setName('панель_афк')
  .setDescription('Отправить в этот канал панель для оформления АФК и Отпуска')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleAfk(interaction, client) {
  // 1. Отправка панели с 3 кнопками
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_афк') {
    const embed = new EmbedBuilder()
      .setTitle('💤 Учёт отсутствия | АФК и Отпуск')
      .setDescription(
        'Если ты отходишь от компьютера или уезжаешь на несколько дней, обязательно отметься через кнопки ниже, чтобы не получить выговор за неявку на сборы.\n\n' +
        '• **💤 Взять АФК** — если отходишь на пару часов (фиксируется в логах без снятия ролей).\n' +
        '• **🏖 Взять отпуск** — если тебя не будет 1 день и более (временная роль отпуска, прежние роли сохраняются).\n' +
        '• **🟢 Вернуться в строй** — снимает отпуск и возвращает все твои прежние роли.'
      )
      .setColor('#F39C12');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_take_afk')
        .setLabel('💤 Взять АФК')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_take_vacation')
        .setLabel('🏖 Взять отпуск')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_return_active')
        .setLabel('🟢 Вернуться в строй')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель АФК и Отпуска успешно создана!', ephemeral: true });
  }

  // 2. Нажатие кнопок АФК, Отпуск или Возвращение
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_take_afk') {
      const modal = new ModalBuilder()
        .setCustomId('modal_submit_afk')
        .setTitle('Оформление АФК');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('afk_nick')
            .setLabel('Ваш игровой Ник и Статик')
            .setPlaceholder('Например: Ivan Begov | #12345')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('afk_time')
            .setLabel('На сколько отходите?')
            .setPlaceholder('Например: на 2 часа / до 22:00 по МСК')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('afk_reason')
            .setLabel('Причина АФК')
            .setPlaceholder('Например: Ушёл по делам / учёба / отдых')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_take_vacation') {
      if (interaction.member.roles.cache.has(VACATION_ROLE_ID)) {
        return interaction.reply({ content: '⚠️ Ты уже находишься в отпуске!', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_submit_vacation')
        .setTitle('Оформление отпуска');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vac_nick')
            .setLabel('Ваш игровой Ник и Статик')
            .setPlaceholder('Например: Ivan Begov | #12345')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vac_dates')
            .setLabel('Сроки отпуска (с какого по какое число)')
            .setPlaceholder('Например: с 12.11 по 16.11 (4 дня)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('vac_reason')
            .setLabel('Причина отпуска')
            .setPlaceholder('Например: Уезжаю в другой город / работа')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_return_active') {
      const isOnVacation = interaction.member.roles.cache.has(VACATION_ROLE_ID);
      const savedData = loadSavedRoles();
      const userRolesToRestore = savedData[interaction.user.id];

      let statusText = 'Вышел из АФК и снова активен.';

      if (isOnVacation || userRolesToRestore) {
        try {
          if (isOnVacation) {
            await interaction.member.roles.remove(VACATION_ROLE_ID);
          }

          if (userRolesToRestore && userRolesToRestore.length > 0) {
            const botHighestPos = interaction.guild.members.me.roles.highest.position;
            const validRoles = userRolesToRestore.filter(roleId => {
              const role = interaction.guild.roles.cache.get(roleId);
              return role && !role.managed && role.position < botHighestPos;
            });

            if (validRoles.length > 0) {
              await interaction.member.roles.add(validRoles);
            }
          }

          delete savedData[interaction.user.id];
          saveRolesData(savedData);

          statusText = 'Вернулся из отпуска. Прежние роли успешно восстановлены!';
        } catch (err) {
          console.error('Ошибка восстановления ролей:', err);
          return interaction.reply({
            content: '❌ Не удалось восстановить роли. Проверь, что роль бота стоит выше всех ролей семьи.',
            ephemeral: true
          });
        }
      }

      const logsChannel = client.channels.cache.get(AFK_LOGS_CHANNEL_ID);
      if (logsChannel) {
        const returnEmbed = new EmbedBuilder()
          .setTitle('🟢 Участник вернулся в строй')
          .setColor('#2ECC71')
          .setDescription(`**Игрок:** <@${interaction.user.id}> (${interaction.user.tag})\n**Статус:** ${statusText}`)
          .setTimestamp();
        await logsChannel.send({ embeds: [returnEmbed] });
      }

      return interaction.reply({
        content: `✅ С возвращением! ${statusText}`,
        ephemeral: true
      });
    }
  }

  // 3. Обработка отправленной формы АФК или Отпуска
  if (interaction.isModalSubmit()) {
    const isAfk = interaction.customId === 'modal_submit_afk';
    const isVac = interaction.customId === 'modal_submit_vacation';

    if (!isAfk && !isVac) return;

    const nick = interaction.fields.getTextInputValue(isAfk ? 'afk_nick' : 'vac_nick');
    const duration = interaction.fields.getTextInputValue(isAfk ? 'afk_time' : 'vac_dates');
    const reason = interaction.fields.getTextInputValue(isAfk ? 'afk_reason' : 'vac_reason');

    let footerNote = 'Отметка АФК зафиксирована в логах';

    if (isVac) {
      const botHighestPos = interaction.guild.members.me.roles.highest.position;

      const currentRoles = interaction.member.roles.cache.filter(
        role => role.id !== interaction.guild.id && !role.managed && role.position < botHighestPos && role.id !== VACATION_ROLE_ID
      );

      const roleIds = currentRoles.map(r => r.id);

      const savedData = loadSavedRoles();
      savedData[interaction.user.id] = roleIds;
      saveRolesData(savedData);

      try {
        if (roleIds.length > 0) {
          await interaction.member.roles.remove(roleIds);
        }
        await interaction.member.roles.add(VACATION_ROLE_ID);
        footerNote = `Сохранено и временно снято ролей: ${roleIds.length} шт.`;
      } catch (err) {
        console.error('Ошибка при выдаче отпуска:', err);
        footerNote = '⚠️ Ошибка изменения ролей (проверь иерархию роли бота)';
      }
    }

    const logsChannel = client.channels.cache.get(AFK_LOGS_CHANNEL_ID);
    if (logsChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle(isAfk ? '💤 Уход в АФК' : '🏖 Заявление на отпуск')
        .setColor(isAfk ? '#95A5A6' : '#3498DB')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '👤 Участник', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '🆔 Ник и Статик', value: nick, inline: true },
          { name: isAfk ? '⏳ Время отсутствия' : '📅 Сроки отпуска', value: duration, inline: false },
          { name: '📝 Причина', value: reason, inline: false }
        )
        .setFooter({ text: footerNote })
        .setTimestamp();

      await logsChannel.send({ embeds: [logEmbed] });
    }

    return interaction.reply({
      content: isAfk
        ? `💤 Ты отметился в **АФК** (${duration}). Не забудь нажать «Вернуться в строй», когда придёшь!`
        : `🏖 Твой **отпуск** (${duration}) оформлен! Твои текущие роли сохранены и вернутся автоматически, когда ты нажмёшь «Вернуться в строй».`,
      ephemeral: true
    });
  }
}

module.exports = { afkCommand, handleAfk };
