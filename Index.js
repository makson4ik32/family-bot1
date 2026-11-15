require('dotenv').config();
const config = require('./config');

const { promoCommand, handlePromo } = require('./promo');
const { portfolioCommand, handlePortfolio } = require('./portfolio');
const { afkCommand, handleAfk } = require('./afk');
const { setupLogs } = require('./logs');
const { warnCommands, handleWarns } = require('./warns');
const { eventCommand, handleEvents } = require('./events');
const { economyCommands, handleEconomy, startVoicePointsTracker } = require('./economy');

const { recruitCommands, handleRecruit } = require('./recruit');
const { extraCommands, handleExtra } = require('./extra_features');
const adminModule = require('./admin_panel');
const { rulesCommand, handleRules } = require('./rules');
const { feedbackCommand, handleFeedback } = require('./feedback');

const adminCommand = adminModule.adminCommand || (Array.isArray(adminModule.adminCommands) ? adminModule.adminCommands[0] : null);
const handleAdmin = adminModule.handleAdmin || adminModule.handleAdminPanel;

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

process.on('unhandledRejection', (reason) => {
  console.error('❌ [Anti-Crash] Необработанное отклонение промиса:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ [Anti-Crash] Непойманная ошибка:', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const embedCommand = new SlashCommandBuilder()
  .setName('эмбед')
  .setDescription('Отправить красивое Embed-сообщение от имени бота')
  .addStringOption(opt => opt.setName('заголовок').setDescription('Заголовок сообщения').setRequired(true))
  .addStringOption(opt => opt.setName('текст').setDescription('Основной текст (используй \\n для переноса)').setRequired(true))
  .addStringOption(opt => opt.setName('цвет').setDescription('Выбери цвет полоски слева или введи HEX (#FF0000)').setRequired(false))
  .addStringOption(opt => opt.setName('картинка').setDescription('Прямая ссылка на картинку').setRequired(false))
  .addChannelOption(opt => opt.setName('канал').setDescription('В какой канал отправить').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      if (cmd === 'эмбед') {
        const title = interaction.options.getString('заголовок');
        const description = interaction.options.getString('текст').replace(/\\n/g, '\n');
        const rawColor = interaction.options.getString('цвет') || '#5865F2';
        const color = /^#?[0-9A-Fa-f]{6}$/.test(rawColor.trim())
          ? (rawColor.trim().startsWith('#') ? rawColor.trim() : `#${rawColor.trim()}`)
          : '#5865F2';
        const imageUrl = interaction.options.getString('картинка');
        const targetChannel = interaction.options.getChannel('канал') || interaction.channel;

        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();

        if (imageUrl) {
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            embed.setImage(imageUrl);
          } else {
            return interaction.reply({ content: '❌ Ссылка на картинку должна начинаться с `http://` или `https://`.', ephemeral: true });
          }
        }

        await targetChannel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Embed-сообщение отправлено в ${targetChannel}!`, ephemeral: true });
      }

      if (cmd === 'панель_повышения') return await handlePromo(interaction, client);
      if (cmd === 'панель_портфеля') return await handlePortfolio(interaction);
      if (cmd === 'панель_афк') return await handleAfk(interaction, client);
      if (cmd === 'панель_сборов') return await handleEvents(interaction, client);
      if (['панель_информация', 'панель_выговоров', 'выговор', 'снять_выговор'].includes(cmd)) return await handleWarns(interaction, client);
      if (['панель_баллов', 'панель_магазина', 'панель_выплат', 'топ_баллов', 'выдать_баллы'].includes(cmd)) return await handleEconomy(interaction, client);
      if (['панель_рекрутинга', 'панель_тира', 'панель_должностей', 'рейтинг'].includes(cmd)) return await handleRecruit(interaction, client);
      if (['профиль', 'панель_розыгрышей', 'розыгрыш', 'панель_скупки', 'панель_контрактов'].includes(cmd)) return await handleExtra(interaction, client);
      if (cmd === 'админ_панель' && handleAdmin) return await handleAdmin(interaction, client);
      if (cmd === 'панель_правил') return await handleRules(interaction);
      if (cmd === 'панель_связи') return await handleFeedback(interaction, client);
    }

    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      const id = interaction.customId;

      if (id.startsWith('ap_') && handleAdmin) return await handleAdmin(interaction, client);
      if (id.includes('promo') || id.startsWith('modal_reject_')) return await handlePromo(interaction, client);
      if (id.includes('portfolio')) return await handlePortfolio(interaction);
      if (id.includes('afk') || id.includes('vacation') || id === 'btn_return_active') return await handleAfk(interaction, client);
      if (id.includes('warn')) return await handleWarns(interaction, client);
      if (id.startsWith('evt_')) return await handleEvents(interaction, client);
      if (id.startsWith('eco_')) return await handleEconomy(interaction, client);
      if (id.startsWith('rec_')) return await handleRecruit(interaction, client);
      if (id.startsWith('ext_')) return await handleExtra(interaction, client);
      if (id.startsWith('rules_')) return await handleRules(interaction);
      if (id.startsWith('fb_')) return await handleFeedback(interaction, client);
    }
  } catch (error) {
    console.error('❌ Ошибка при обработке взаимодействия:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '⚠️ Произошла внутренняя ошибка при выполнении действия.', ephemeral: true }).catch(() => {});
    }
  }
});

client.once('clientReady', async () => {
  const guild = client.guilds.cache.get(config.GUILD_ID);
  if (guild) {
    await guild.members.fetch().catch(console.error);
  }
  setupLogs(client);
  startVoicePointsTracker(client);
  console.log(`✅ Бот ${client.user.tag} успешно запущен и оптимизирован!`);
});

(async () => {
  try {
    const rawCommands = [
      embedCommand, promoCommand, portfolioCommand, afkCommand, eventCommand,
      adminCommand, rulesCommand, feedbackCommand,
      ...(warnCommands || []), ...(economyCommands || []), ...(recruitCommands || []), ...(extraCommands || [])
    ].filter(cmd => cmd && typeof cmd.toJSON === 'function');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: rawCommands.map(c => c.toJSON()) }
    );
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Критическая ошибка запуска:', error);
  }
})();
