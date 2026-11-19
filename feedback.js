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

const ideaVotes = new Map();

function isLeaderOrAdmin(member) {
  return config.OWNER_IDS.includes(member.id) ||
         member.permissions.has(PermissionFlagsBits.Administrator) ||
         (config.ROLES.LEADER && member.roles.cache.has(config.ROLES.LEADER)) ||
         (config.ROLES.DEP_LEADER && member.roles.cache.has(config.ROLES.DEP_LEADER));
}


const feedbackCommand = new SlashCommandBuilder()
  .setName('панель_связи')
  .setDescription('Отправить объединённую панель: Предложения по улучшению и Вопросы к лидеру')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleFeedback(interaction, client) {
  const fbCfg = settings.PANELS.FEEDBACK;

  // 1. Установка главной панели в канале
  if (interaction.isChatInputCommand() && interaction.commandName === 'панель_связи') {
    const embed = settings.applyPanelStyle(new EmbedBuilder(), fbCfg, '#5865F2');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fb_btn_idea')
        .setLabel(fbCfg.btnIdea || '💡 Предложить идею')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('fb_btn_question')
        .setLabel(fbCfg.btnQuestion || '👑 Вопрос лидеру')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Панель идей и вопросов к лидеру успешно создана!', ephemeral: true });
  }

  // ==================== БЛОК 1: ПРЕДЛОЖЕНИЯ ПО УЛУЧШЕНИЮ ====================
  if (interaction.isButton() && interaction.customId === 'fb_btn_idea') {
    const modal = new ModalBuilder()
      .setCustomId('fb_modal_idea')
      .setTitle('💡 Предложение по улучшению');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('idea_title')
          .setLabel('Суть предложения (кратко)')
          .setPlaceholder('Например: Добавить новый канал / Изменить систему баллов')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('idea_desc')
          .setLabel('Подробное описание идеи и чем она полезна')
          .setPlaceholder('Опиши подробно, как это должно работать...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'fb_modal_idea') {
    const ideasChannel = client.channels.cache.get(config.CHANNELS.IDEAS);
    if (!ideasChannel) {
      return interaction.reply({
        content: '❌ Канал для идей не настроен в `config.js` (`CHANNELS.IDEAS`).',
        ephemeral: true
      });
    }

    const title = interaction.fields.getTextInputValue('idea_title');
    const desc = interaction.fields.getTextInputValue('idea_desc');

    const ideaEmbed = new EmbedBuilder()
      .setTitle(`💡 Идея: ${title}`)
      .setColor('#F1C40F')
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(desc)
      .addFields(
        { name: '👤 Автор идеи', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📊 Статус', value: '🟡 **На голосовании**', inline: true },
        { name: '🗳 Голоса участников', value: '👍 За: **0** | 👎 Против: **0**', inline: false }
      )
      .setTimestamp();

    const voteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fb_vote_up')
        .setLabel('👍 За (0)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('fb_vote_down')
        .setLabel('👎 Против (0)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`fb_idea_accept_${interaction.user.id}`)
        .setLabel('✅ Реализовать')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`fb_idea_reject_${interaction.user.id}`)
        .setLabel('❌ Отклонить')
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await ideasChannel.send({ embeds: [ideaEmbed], components: [voteRow] });
    ideaVotes.set(msg.id, { up: new Set(), down: new Set() });

    await msg.startThread({
      name: `💬 Обсуждение: ${title}`.slice(0, 95),
      autoArchiveDuration: 1440
    }).catch(() => {});

    return interaction.reply({
      content: `✅ Твоя идея опубликована на голосование в канале <#${ideasChannel.id}>!`,
      ephemeral: true
    });
  }

  // Голосование 👍 / 👎 за идею
  if (interaction.isButton() && (interaction.customId === 'fb_vote_up' || interaction.customId === 'fb_vote_down')) {
    const msgId = interaction.message.id;
    if (!ideaVotes.has(msgId)) {
      ideaVotes.set(msgId, { up: new Set(), down: new Set() });
    }

    const votes = ideaVotes.get(msgId);
    const userId = interaction.user.id;
    const isUp = interaction.customId === 'fb_vote_up';

    if (isUp) {
      if (votes.up.has(userId)) votes.up.delete(userId);
      else {
        votes.up.add(userId);
        votes.down.delete(userId);
      }
    } else {
      if (votes.down.has(userId)) votes.down.delete(userId);
      else {
        votes.down.add(userId);
        votes.up.delete(userId);
      }
    }

    const oldEmbed = interaction.message.embeds.at(0);
    const updatedEmbed = EmbedBuilder.from(oldEmbed);
    const fields = [...oldEmbed.fields];
    const voteFieldIndex = fields.findIndex(f => f.name.includes('Голоса'));

    if (voteFieldIndex !== -1) {
      fields[voteFieldIndex] = {
        name: '🗳 Голоса участников',
        value: `👍 За: **${votes.up.size}** | 👎 Против: **${votes.down.size}**`,
        inline: false
      };
      updatedEmbed.setFields(fields);
    }

    const updatedComponents = ActionRowBuilder.from(interaction.message.components.at(0));
    updatedComponents.components.at(0).setLabel(`👍 За (${votes.up.size})`);
    updatedComponents.components.at(1).setLabel(`👎 Против (${votes.down.size})`);

    return interaction.update({ embeds: [updatedEmbed], components: [updatedComponents] });
  }

  // Решение лидера по идее (Принять / Отклонить)
  if (interaction.isButton() && (interaction.customId.startsWith('fb_idea_accept_') || interaction.customId.startsWith('fb_idea_reject_'))) {
    if (!isLeaderOrAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Выносить решение по идеям может только лидер или администратор!', ephemeral: true });
    }

    const isAccept = interaction.customId.startsWith('fb_idea_accept_');
    const authorId = interaction.customId.split('_').at(3);

    const oldEmbed = interaction.message.embeds.at(0);
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(isAccept ? '#2ECC71' : '#E74C3C');

    const fields = [...oldEmbed.fields];
    const statusIdx = fields.findIndex(f => f.name.includes('Статус'));
    if (statusIdx !== -1) {
      fields[statusIdx] = {
        name: '📊 Статус',
        value: isAccept ? `🟢 **Принято** (<@${interaction.user.id}>)` : `🔴 **Отклонено** (<@${interaction.user.id}>)`,
        inline: true
      };
      updatedEmbed.setFields(fields);
    }

    ideaVotes.delete(interaction.message.id);
    await interaction.update({ embeds: [updatedEmbed], components: [] });

    const author = await client.users.fetch(authorId).catch(() => null);
    if (author) {
      await author.send(
        isAccept
          ? `🎉 Ваша идея **«${oldEmbed.title.replace('💡 Идея: ', '')}»** была **одобрена** руководством семьи!`
          : `❌ Ваша идея **«${oldEmbed.title.replace('💡 Идея: ', '')}»** была отклонена руководством.`
      ).catch(() => {});
    }
    return;
  }

  // ==================== БЛОК 2: ВОПРОСЫ К ЛИДЕРУ ====================
  if (interaction.isButton() && interaction.customId === 'fb_btn_question') {
    const modal = new ModalBuilder()
      .setCustomId('fb_modal_question')
      .setTitle('👑 Задать вопрос лидеру');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_text')
          .setLabel('Ваш вопрос к лидеру')
          .setPlaceholder('Напишите ваш вопрос максимально понятно...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_anon')
          .setLabel('Отправить анонимно? (Напишите: Да или Нет)')
          .setValue('Нет')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'fb_modal_question') {
    const questionsChannel = client.channels.cache.get(config.CHANNELS.LEADER_QUESTIONS);
    if (!questionsChannel) {
      return interaction.reply({
        content: '❌ Канал для вопросов лидеру не настроен в `config.js` (`CHANNELS.LEADER_QUESTIONS`).',
        ephemeral: true
      });
    }

    const questionText = interaction.fields.getTextInputValue('q_text');
    const anonRaw = interaction.fields.getTextInputValue('q_anon').trim().toLowerCase();
    const isAnon = ['да', 'yes', 'ага', '+'].includes(anonRaw);

        const qEmbed = new EmbedBuilder()
      .setTitle('👑 Вопрос к лидеру семьи')
      .setColor('#9B59B6')
      .setDescription(`**❓ Вопрос:**\n${questionText}`)
      .addFields(
        { name: '👤 От кого', value: isAnon ? '🕵️ *Анонимный участник*' : `<@${interaction.user.id}>`, inline: true },
        { name: '⏳ Статус', value: 'Ожидает ответа лидера', inline: true }
      )
      .setTimestamp();

    if (!isAnon) {
      qEmbed.setThumbnail(interaction.user.displayAvatarURL());
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fb_q_reply_${interaction.user.id}`)
        .setLabel('✍️ Ответить на вопрос (Лидер)')
        .setStyle(ButtonStyle.Primary)
    );

    await questionsChannel.send({ embeds: [qEmbed], components: [row] });
    return interaction.reply({
      content: isAnon
        ? `✅ Твой **анонимный** вопрос отправлен в канал <#${questionsChannel.id}>!`
        : `✅ Твой вопрос опубликован в канале <#${questionsChannel.id}>! Как только лидер ответит, ты получишь уведомление.`,
      ephemeral: true
    });
  }

  // Нажатие кнопки "Ответить на вопрос" лидером
  if (interaction.isButton() && interaction.customId.startsWith('fb_q_reply_')) {
    if (!isLeaderOrAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Отвечать на эти вопросы может только лидер или его ассистент!', ephemeral: true });
    }

    const authorId = interaction.customId.replace('fb_q_reply_', '');
    const modal = new ModalBuilder()
      .setCustomId(`fb_q_modalsend_${authorId}_${interaction.message.id}`)
      .setTitle('Ответ на вопрос участника');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('leader_answer')
          .setLabel('Ваш ответ')
          .setPlaceholder('Введите развёрнутый ответ на вопрос...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // Публикация ответа лидера прямо в карточку вопроса
  if (interaction.isModalSubmit() && interaction.customId.startsWith('fb_q_modalsend_')) {
    const parts = interaction.customId.split('_');
    const authorId = parts.at(3);
    const msgId = parts.at(4);
    const answerText = interaction.fields.getTextInputValue('leader_answer');

    const questionsChannel = client.channels.cache.get(config.CHANNELS.LEADER_QUESTIONS) || interaction.channel;
    const targetMsg = await questionsChannel.messages.fetch(msgId).catch(() => null);
    if (targetMsg) {
      const oldEmbed = targetMsg.embeds.at(0);
      const answeredEmbed = EmbedBuilder.from(oldEmbed)
        .setColor('#2ECC71')
        .setFields(
          oldEmbed.fields.at(0),
          { name: '✅ Статус', value: `Ответил <@${interaction.user.id}>`, inline: true },
          { name: '👑 Ответ лидера', value: answerText, inline: false }
        );

      await targetMsg.edit({ embeds: [answeredEmbed], components: [] });
    }

    const author = await client.users.fetch(authorId).catch(() => null);
    if (author) {
      await author.send(`👑 **Лидер ответил на ваш вопрос в Discord!**\n**Ответ:** ${answerText}`).catch(() => {});
    }

    return interaction.reply({ content: '✅ Ваш ответ опубликован в карточке вопроса!', ephemeral: true });
  }
}

module.exports = { feedbackCommand, handleFeedback };
