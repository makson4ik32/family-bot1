const config = require('./config');
const { getJson, saveJson } = require('./db');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const CUSTOM_PANELS_FILE = 'panels_custom.json';
const CUSTOM_ROLES_FILE = 'roles_custom.json';

function getCustomPanels() {
  return getJson(CUSTOM_PANELS_FILE, {});
}

function saveCustomPanels(data) {
  saveJson(CUSTOM_PANELS_FILE, data);
}

function getCustomRoles() {
  return getJson(CUSTOM_ROLES_FILE, {});
}

function saveCustomRoles(data) {
  saveJson(CUSTOM_ROLES_FILE, data);
}

function resolveColor(hexColor, fallback = '#2B2D31') {
  if (!hexColor || typeof hexColor !== 'string') return fallback;
  const clean = hexColor.trim();
  return /^#?[0-9A-Fa-f]{6}$/.test(clean)
    ? (clean.startsWith('#') ? clean : `#${clean}`)
    : fallback;
}

// Слияние стандартных настроек панели с кастомными из админки
function getMergedPanelConfig(panelKey) {
  const settings = require('./settings');
  const defaultsMap = {
    RECRUIT: settings.PANELS.RECRUIT,
    TIER: settings.PANELS.TIER,
    STAFF_APPS: settings.PANELS.STAFF_APPS,
    PROMO: settings.PANELS.PROMO,
    PORTFOLIO: settings.PANELS.PORTFOLIO,
    AFK: settings.PANELS.AFK,
    EVENTS: settings.PANELS.EVENTS,
    POINTS_PANEL: settings.PANELS.ECONOMY.POINTS_PANEL,
    SHOP_PANEL: settings.PANELS.ECONOMY.SHOP_PANEL,
    PAYOUT_PANEL: settings.PANELS.ECONOMY.PAYOUT_PANEL,
    GIVEAWAY_PANEL: settings.PANELS.EXTRA.GIVEAWAY_PANEL,
    SKUPKA_PANEL: settings.PANELS.EXTRA.SKUPKA_PANEL,
    CONTRACTS_PANEL: settings.PANELS.EXTRA.CONTRACTS_PANEL,
    FEEDBACK: settings.PANELS.FEEDBACK,
    WARNS_INFO: settings.PANELS.WARNS.INFO_PANEL,
    WARNS_ADMIN: settings.PANELS.WARNS.ADMIN_PANEL,
    SCLAD: settings.PANELS.SCLAD,
    DISCIPLINE: settings.PANELS.DISCIPLINE,
    MAPS: settings.PANELS.MAPS,
    ADMIN_PANEL: settings.PANELS.ADMIN_PANEL
  };

  const base = defaultsMap[panelKey] || {};
  const custom = getCustomPanels()[panelKey] || {};
  return { ...base, ...custom };
}

// Универсальная сборка сообщения (Embed + Components) для любой панели
function buildPanelPayload(panelKey, guild) {
  const settings = require('./settings');
  const cfg = getMergedPanelConfig(panelKey);

  // Особые динамические панели
  if (panelKey === 'SCLAD') {
    const { buildScladEmbed, buildScladButtons } = require('./sclad_discipline');
    return { embeds: [buildScladEmbed()], components: buildScladButtons() };
  }
  if (panelKey === 'RULES') {
    const { loadRules, buildRulesEmbed } = require('./rules');
    const rData = loadRules();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rules_builder_open').setLabel('🛠 Редактор правил (Админ)').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [buildRulesEmbed(rData)], components: [row] };
  }
  if (panelKey === 'ADMIN_PANEL') {
    const { buildAdminPanelEmbed, buildAdminPanelRows } = require('./admin_panel');
    return { embeds: [buildAdminPanelEmbed(guild)], components: buildAdminPanelRows() };
  }

  const embed = new EmbedBuilder()
    .setTitle(cfg.title || 'Панель управления')
    .setDescription(cfg.description || ' ')
    .setColor(resolveColor(cfg.color, '#2B2D31'));

  if (cfg.image && /^https?:\/\//i.test(cfg.image.trim())) {
    embed.setImage(cfg.image.trim());
  }
  if (cfg.thumbnail && /^https?:\/\//i.test(cfg.thumbnail.trim())) {
    embed.setThumbnail(cfg.thumbnail.trim());
  }
  if (cfg.footer) {
    embed.setFooter({ text: cfg.footer });
  }

  let components = [];

  if (panelKey === 'RECRUIT') {
    components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rec_select_branch')
          .setPlaceholder(cfg.placeholder || '👇 Выбери направление...')
          .addOptions([
            { label: cfg.options?.captLabel || '⚔️ Capt Состав', description: cfg.options?.captDesc || 'Капты и турниры', value: 'Capt' },
            { label: cfg.options?.rpLabel || '🎭 RP Состав', description: cfg.options?.rpDesc || 'RP контент', value: 'RP' }
          ])
      )
    ];
  } else if (panelKey === 'TIER') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rec_open_tier_ticket').setLabel(cfg.buttonLabel || '🎯 Подать на Tier-проверку').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'STAFF_APPS') {
    const options = Object.entries(settings.ROLE_REWARDS.STAFF_APPS).map(([key, info]) => ({
      label: info.label,
      description: `Подать заявку на ${info.label}`,
      value: key
    }));
    components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rec_select_staff_role')
          .setPlaceholder(cfg.placeholder || '👇 Выбери должность...')
          .addOptions(options)
      )
    ];
  } else if (panelKey === 'PROMO') {
    const ranksCfg = settings.getPromoRanks();
    components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_promo_rank')
          .setPlaceholder(cfg.placeholder || '👇 Выбери ранг...')
          .addOptions(
            Object.entries(ranksCfg).map(([key, info]) => ({
              label: info.label,
              description: (info.description || '').slice(0, 100),
              value: key
            }))
          )
      )
    ];
  } else if (panelKey === 'PORTFOLIO') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_portfolio_modal').setLabel(cfg.buttonLabel || '📁 Создать личный портфель').setStyle(ButtonStyle.Primary)
      )
    ];
  } else if (panelKey === 'AFK') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_take_afk').setLabel(cfg.btnAfk || '💤 Взять АФК').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_take_vacation').setLabel(cfg.btnVacation || '🏖 Взять отпуск').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_return_active').setLabel(cfg.btnReturn || '🟢 Вернуться в строй').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'EVENTS') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('evt_create_capt').setLabel(cfg.btnCapt || '🔫 Капт').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('evt_create_mcl').setLabel(cfg.btnMcl || '🏆 MCL / Турнир').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('evt_create_vz').setLabel(cfg.btnVz || '📦 ВЗ / Поставка / ФЗ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('evt_create_rp').setLabel(cfg.btnRp || '🎭 Семейное РП').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'POINTS_PANEL') {
    const acts = settings.PANELS.ECONOMY.activities;
    const activitiesList = Object.values(acts).map(a => `• **${a.label}** — \`+${a.points} баллов\` *(${a.desc})*`).join('\n');
    const vCfg = settings.PANELS.ECONOMY.voice;
    embed.setDescription(`${cfg.description}\n\n**Расценки за задания:**\n${activitiesList}\n\n**🎙 Бонус за голосовой онлайн:**\n• Нахождение в голосовых каналах семьи приносит **+${vCfg.POINTS_PER_INTERVAL} баллов** каждые **${vCfg.CHECK_INTERVAL_MINUTES} минут**!`);

    components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('eco_select_activity')
          .setPlaceholder(cfg.placeholder || '👇 Выбери активность...')
          .addOptions(Object.entries(acts).map(([key, info]) => ({ label: `${info.label} (+${info.points} б.)`, description: info.desc, value: key })))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Мой баланс и войс').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('eco_show_top').setLabel('🏆 Топ по баллам').setStyle(ButtonStyle.Primary)
      )
    ];
  } else if (panelKey === 'SHOP_PANEL') {
    const items = settings.PANELS.ECONOMY.shopItems;
    const itemsList = Object.values(items).map(item => `• **${item.label}** — **${item.cost} баллов**\n  *${item.description}*`).join('\n\n');
    embed.setDescription(`${cfg.description}\n\n${itemsList}`);

    components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('eco_shop_buy')
          .setPlaceholder(cfg.placeholder || '👇 Выбери товар...')
          .addOptions(Object.entries(items).map(([key, item]) => ({ label: `${item.label} — ${item.cost} б.`, description: item.description.slice(0, 100), value: key })))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Проверить мой баланс').setStyle(ButtonStyle.Secondary)
      )
    ];
  } else if (panelKey === 'PAYOUT_PANEL') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_request_payout').setLabel(cfg.buttonLabel || '💰 Запросить выплату').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'GIVEAWAY_PANEL') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ext_gw_create_btn').setLabel(cfg.buttonLabel || '🎁 Создать розыгрыш').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'SKUPKA_PANEL') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ext_skupka_btn').setLabel(cfg.buttonLabel || '📦 Сдать лут на премию').setStyle(ButtonStyle.Primary)
      )
    ];
    } else if (panelKey === 'CONTRACTS_PANEL') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ext_contract_take').setLabel(cfg.btnTake || '⏳ Взял контракт').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ext_contract_done').setLabel(cfg.btnDone || '✅ Закрыл контракт').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'FEEDBACK') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fb_btn_idea').setLabel(cfg.btnIdea || '💡 Предложить идею').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('fb_btn_question').setLabel(cfg.btnQuestion || '👑 Вопрос лидеру').setStyle(ButtonStyle.Primary)
      )
    ];
  } else if (panelKey === 'WARNS_INFO') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_warn_appeal').setLabel(cfg.btnAppeal || '⚖️ Обжаловать выговор').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_warn_workoff').setLabel(cfg.btnWorkoff || '🛠 Сдать отработку выговора').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'WARNS_ADMIN') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_warn_give').setLabel(cfg.btnGive || '➕ Выдать выговор').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_warn_remove').setLabel(cfg.btnRemove || '➖ Снять выговор').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'DISCIPLINE') {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sd_disc_warn').setLabel('⚠️ Выдать / Снять выговор').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('sd_disc_list').setLabel('📋 Активные выговоры').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('sd_disc_vod').setLabel('🎥 Запросить откат').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sd_disc_rollcall').setLabel('📣 Перекличка строя').setStyle(ButtonStyle.Success)
      )
    ];
  } else if (panelKey === 'MAPS') {
    const mapsData = getJson('maps_data.json', settings.DEFAULT_MAPS || {});
    const mapEntries = Object.entries(mapsData);
    if (mapEntries.length > 0) {
      components = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('auto_select_map')
            .setPlaceholder(cfg.placeholder || '🗺 Выберите карту капта для просмотра коллов...')
            .addOptions(
              mapEntries.slice(0, 25).map(([k, m]) => ({
                label: m.name.slice(0, 100),
                description: (m.shortDesc || 'Тактика, позиции и оружие').slice(0, 100),
                value: k
              }))
            )
        )
      ];
    }
  }

  return { embeds: [embed], components };
}

// Публикация или переотправка конкретной панели в указанный канал
async function publishPanelToChannel(guild, panelKey, channelId) {
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return { ok: false, error: 'Канал не найден или не текстовый' };

  const customAll = getCustomPanels();
  if (!customAll[panelKey]) customAll[panelKey] = {};

  // Удаляем старое сообщение, если оно было
  const oldChId = customAll[panelKey].channelId;
  const oldMsgId = customAll[panelKey].messageId;
  if (oldChId && oldMsgId) {
    const oldCh = guild.channels.cache.get(oldChId) || await guild.channels.fetch(oldChId).catch(() => null);
    if (oldCh) {
      const oldMsg = await oldCh.messages.fetch(oldMsgId).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    }
  }

  const payload = buildPanelPayload(panelKey, guild);
  const sentMsg = await channel.send(payload);

  customAll[panelKey].channelId = channel.id;
  customAll[panelKey].messageId = sentMsg.id;
  saveCustomPanels(customAll);

  if (panelKey === 'RULES') {
    const { loadRules, saveRules } = require('./rules');
    const rData = loadRules();
    rData.channelId = channel.id;
    rData.messageId = sentMsg.id;
    saveRules(rData);
  }

  return { ok: true, channelId: channel.id, messageId: sentMsg.id };
}

// Живое обновление уже опубликованной панели в канале
async function refreshPublishedPanel(guild, panelKey) {
  const customAll = getCustomPanels();
  const info = customAll[panelKey];
  if (!info || !info.channelId || !info.messageId) return false;

  const channel = guild.channels.cache.get(info.channelId) || await guild.channels.fetch(info.channelId).catch(() => null);
  if (!channel) return false;

  const msg = await channel.messages.fetch(info.messageId).catch(() => null);
  if (!msg) return false;

  const payload = buildPanelPayload(panelKey, guild);
  await msg.edit(payload).catch(() => {});
  return true;
}

// Удаление опубликованных панелей
async function deletePublishedPanels(guild, keysToDelete) {
  const customAll = getCustomPanels();
  let deletedCount = 0;

  for (const key of keysToDelete) {
    const info = customAll[key];
    if (!info || !info.channelId || !info.messageId) continue;

    const ch = guild.channels.cache.get(info.channelId) || await guild.channels.fetch(info.channelId).catch(() => null);
    if (ch) {
      const msg = await ch.messages.fetch(info.messageId).catch(() => null);
      if (msg) {
        const ok = await msg.delete().then(() => true).catch(() => false);
        if (ok) deletedCount++;
      }
    }
    delete customAll[key].messageId;
  }

  saveCustomPanels(customAll);
  return deletedCount;
}

module.exports = {
  getCustomPanels,
  saveCustomPanels,
  getCustomRoles,
  saveCustomRoles,
  resolveColor,
  getMergedPanelConfig,
  buildPanelPayload,
  publishPanelToChannel,
  refreshPublishedPanel,
  deletePublishedPanels
};
