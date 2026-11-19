const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const settings = require('./settings');
const { getJson, saveJson } = require('./db');

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

function getBasePanelConfig(panelKey) {
  const map = {
    ADMIN_PANEL: settings.PANELS.ADMIN_PANEL,
    RECRUIT: settings.PANELS.RECRUIT,
    PROMO: settings.PANELS.PROMO,
    PORTFOLIO: settings.PANELS.PORTFOLIO,
    AFK: settings.PANELS.AFK,
    EVENTS: settings.PANELS.EVENTS,
    TIER: settings.PANELS.TIER,
    STAFF_APPS: settings.PANELS.STAFF_APPS,
    POINTS_PANEL: settings.PANELS.ECONOMY.POINTS_PANEL,
    SHOP_PANEL: settings.PANELS.ECONOMY.SHOP_PANEL,
    PAYOUT_PANEL: settings.PANELS.ECONOMY.PAYOUT_PANEL,
    FEEDBACK: settings.PANELS.FEEDBACK,
    SKUPKA_PANEL: settings.PANELS.EXTRA.SKUPKA_PANEL,
    CONTRACTS_PANEL: settings.PANELS.EXTRA.CONTRACTS_PANEL,
    GIVEAWAY_PANEL: settings.PANELS.EXTRA.GIVEAWAY_PANEL,
    WARNS_INFO: settings.PANELS.WARNS.INFO_PANEL,
    SCLAD: settings.PANELS.SCLAD,
    DISCIPLINE: settings.PANELS.DISCIPLINE,
    MAPS: settings.PANELS.MAPS,
    RULES: {
      title: '📜 Устав и Правила Семьи',
      description: 'Незнание правил не освобождает от ответственности. Соблюдайте дисциплину и субординацию.',
      color: '#E74C3C',
      footer: 'Администрация семьи оставляет за собой право изменять правила.'
    }
  };
  return map[panelKey] || { title: panelKey, description: '', color: '#2B2D31' };
}

function getMergedPanelConfig(panelKey) {
  const base = getBasePanelConfig(panelKey);
  const custom = getCustomPanels()[panelKey] || {};
  return { ...base, ...custom };
}

function renderPanelPayload(panelKey, guild) {
  const cfg = getMergedPanelConfig(panelKey);
  const embed = settings.applyPanelStyle(new EmbedBuilder(), { ...cfg, _panelKey: panelKey }, '#2B2D31');

  if (panelKey === 'ADMIN_PANEL') {
    const { buildAdminPanelRows } = require('./admin_panel');
    if (!cfg.thumbnail && guild) embed.setThumbnail(guild.iconURL({ dynamic: true }));
    return { embeds: [embed], components: buildAdminPanelRows() };
  }

  if (panelKey === 'RECRUIT') {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('recruit_select_branch')
        .setPlaceholder(cfg.placeholder || '👇 Выбери направление для вступления...')
        .addOptions([
          { label: cfg.options?.captLabel || '⚔️ Capt Состав', description: cfg.options?.captDesc || 'Капты и турниры', value: 'Capt' },
          { label: cfg.options?.rpLabel || '🎭 RP Состав', description: cfg.options?.rpDesc || 'RP контент и развитие', value: 'RP' }
        ])
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'PROMO') {
    const ranks = settings.getPromoRanks();
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_promo_rank')
        .setPlaceholder(cfg.placeholder || '👇 Выбери ранг для повышения...')
        .addOptions(
          Object.entries(ranks).map(([k, v]) => ({
            label: v.label,
            description: (v.description || '').slice(0, 100),
            value: k
          }))
        )
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'PORTFOLIO') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_portfolio_modal')
        .setLabel(cfg.buttonLabel || '📁 Создать личный портфель')
        .setStyle(ButtonStyle.Primary)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'AFK') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_take_afk').setLabel(cfg.btnAfk || '💤 Взять АФК').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_take_vacation').setLabel(cfg.btnVacation || '🏖 Взять отпуск').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_return_active').setLabel(cfg.btnReturn || '🟢 Вернуться в строй').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'EVENTS') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('evt_create_capt').setLabel(cfg.btnCapt || '🔫 Капт').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('evt_create_mcl').setLabel(cfg.btnMcl || '🏆 MCL / Турнир').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('evt_create_vz').setLabel(cfg.btnVz || '📦 ВЗ / Поставка / ФЗ').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('evt_create_rp').setLabel(cfg.btnRp || '🎭 Семейное РП').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'POINTS_PANEL') {
    const acts = settings.PANELS.ECONOMY.activities;
    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('eco_select_activity')
        .setPlaceholder(cfg.placeholder || '👇 Выбери активность...')
        .addOptions(
          Object.entries(acts).map(([k, v]) => ({
            label: `${v.label} (+${v.points} б.)`,
            description: (v.desc || '').slice(0, 100),
            value: k
          }))
        )
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Мой баланс и войс').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('eco_show_top').setLabel('🏆 Топ по баллам').setStyle(ButtonStyle.Primary)
    );
    return { embeds: [embed], components: [row1, row2] };
  }

  if (panelKey === 'SHOP_PANEL') {
    const items = settings.PANELS.ECONOMY.shopItems;
    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('eco_shop_buy')
        .setPlaceholder(cfg.placeholder || '👇 Выбери товар...')
        .addOptions(
          Object.entries(items).map(([k, v]) => ({
            label: `${v.label} — ${v.cost} б.`,
            description: (v.description || '').slice(0, 100),
            value: k
          }))
        )
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_my_balance').setLabel('💳 Проверить мой баланс').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row1, row2] };
  }
  if (panelKey === 'PAYOUT_PANEL') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_request_payout').setLabel(cfg.buttonLabel || '💰 Запросить выплату').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'FEEDBACK') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fb_btn_idea').setLabel(cfg.btnIdea || '💡 Предложить идею').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('fb_btn_question').setLabel(cfg.btnQuestion || '👑 Вопрос лидеру').setStyle(ButtonStyle.Primary)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'SKUPKA_PANEL') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_skupka_btn').setLabel(cfg.buttonLabel || '📦 Сдать лут на премию').setStyle(ButtonStyle.Primary)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'CONTRACTS_PANEL') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_contract_take').setLabel(cfg.btnTake || '⏳ Взял контракт').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ext_contract_done').setLabel(cfg.btnDone || '✅ Закрыл контракт').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'GIVEAWAY_PANEL') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ext_gw_create_btn').setLabel(cfg.buttonLabel || '🎁 Создать розыгрыш').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'WARNS_INFO') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_warn_appeal').setLabel(cfg.btnAppeal || '⚖️ Обжаловать выговор').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_warn_workoff').setLabel(cfg.btnWorkoff || '🛠 Отработать выговор').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_staff_give_warn').setLabel('⚠️ Выдать выговор').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row] };
  }

  if (panelKey === 'SCLAD') {
    const { buildScladEmbed, buildScladButtons } = require('./sclad_discipline');
    return { embeds: [buildScladEmbed()], components: buildScladButtons() };
  }

  if (panelKey === 'DISCIPLINE') {
    const { buildDisciplineEmbed, buildDisciplineButtons } = require('./sclad_discipline');
    return { embeds: [buildDisciplineEmbed()], components: buildDisciplineButtons() };
  }

  if (panelKey === 'MAPS') {
    const maps = getJson('maps_data.json', settings.DEFAULT_MAPS || {});
    const options = Object.entries(maps).map(([k, v]) => ({
      label: (v.name || k).slice(0, 100),
      description: (v.shortDesc || '').slice(0, 100),
      value: k
    }));
    if (options.length > 0) {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('auto_select_map')
          .setPlaceholder(cfg.placeholder || '👇 Выберите карту капта...')
          .addOptions(options)
      );
      return { embeds: [embed], components: [row] };
    }
  }

  if (panelKey === 'RULES') {
    const rulesData = getJson('rules_data.json', {});
    const rulesEmbed = new EmbedBuilder()
      .setTitle(cfg.title || rulesData.title || '📜 Устав и Правила Семьи')
      .setDescription(cfg.description || rulesData.description || ' ')
      .setColor(settings.resolveColor(cfg.color || rulesData.color, '#E74C3C'));

    if (Array.isArray(rulesData.sections)) {
      rulesData.sections.forEach(sec => rulesEmbed.addFields({ name: sec.name, value: sec.value, inline: false }));
    }
    if (cfg.image || rulesData.image) rulesEmbed.setImage(cfg.image || rulesData.image);
    if (cfg.footer || rulesData.footer) rulesEmbed.setFooter({ text: cfg.footer || rulesData.footer });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rules_builder_open').setLabel('🛠 Редактор правил (Админ)').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [rulesEmbed], components: [row] };
  }

  return { embeds: [embed], components: [] };
}

async function publishPanelToChannel(guild, panelKey, channelId) {
  if (!guild || !channelId) return { ok: false, error: 'Не указан канал' };
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return { ok: false, error: 'Канал не найден' };

  const customAll = getCustomPanels();
  const prev = customAll[panelKey];
  if (prev?.channelId && prev?.messageId) {
    const oldCh = guild.channels.cache.get(prev.channelId);
    if (oldCh) {
      const oldMsg = await oldCh.messages.fetch(prev.messageId).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    }
  }

  const payload = renderPanelPayload(panelKey, guild);
  const sent = await channel.send(payload).catch(() => null);
  if (!sent) return { ok: false, error: 'Нет прав на отправку сообщений в канал' };

  customAll[panelKey] = { ...(customAll[panelKey] || {}), channelId: channel.id, messageId: sent.id };
  saveCustomPanels(customAll);

  if (panelKey === 'RULES') {
    const rData = getJson('rules_data.json', {});
    rData.channelId = channel.id;
    rData.messageId = sent.id;
    saveJson('rules_data.json', rData);
  }
  return { ok: true, message: sent };
}

async function refreshPublishedPanel(guild, panelKey) {
  if (!guild) return false;
  const customAll = getCustomPanels();
  const saved = customAll[panelKey];
  if (!saved?.channelId || !saved?.messageId) return false;

  const ch = guild.channels.cache.get(saved.channelId) || await guild.channels.fetch(saved.channelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return false;

  const msg = await ch.messages.fetch(saved.messageId).catch(() => null);
  if (!msg) return false;

  const payload = renderPanelPayload(panelKey, guild);
  await msg.edit(payload).catch(() => {});
  return true;
}

async function deletePublishedPanels(guild, keys) {
  if (!guild) return 0;
  const customAll = getCustomPanels();
  let count = 0;

  for (const key of keys) {
    const saved = customAll[key];
    if (saved?.channelId && saved?.messageId) {
      const ch = guild.channels.cache.get(saved.channelId) || await guild.channels.fetch(saved.channelId).catch(() => null);
      if (ch && ch.isTextBased()) {
        const msg = await ch.messages.fetch(saved.messageId).catch(() => null);
        if (msg) {
          await msg.delete().catch(() => {});
          count++;
        }
      }
      delete customAll[key].messageId;
    }
  }
  saveCustomPanels(customAll);
  return count;
}

module.exports = {
  getCustomPanels,
  saveCustomPanels,
  getCustomRoles,
  saveCustomRoles,
  getMergedPanelConfig,
  renderPanelPayload,
  publishPanelToChannel,
  refreshPublishedPanel,
  deletePublishedPanels
};
