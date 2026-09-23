import {
  Client,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  type Interaction,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import { log } from './logger.js';
import { parisDateStr } from './week.js';
import { saveScrimResult } from './scrims.js';

const CMD_NAME = 'resultat';
const MODAL_ID = 'resultat_modal';

/** Enregistre la slash-command sur le serveur (dispo immédiate, contrairement au global). */
export async function registerCommands(client: Client, guildId: string): Promise<void> {
  const cmd = new SlashCommandBuilder()
    .setName(CMD_NAME)
    .setDescription('Renseigner le résultat d’un scrim / match')
    .toJSON();
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set([cmd]);
    log.info('Slash-command enregistrée', { guildId, command: CMD_NAME });
  } catch (e) {
    log.error('Échec enregistrement slash-command', { err: String(e) });
  }
}

function buildModal(): ModalBuilder {
  const row = (c: TextInputBuilder) =>
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(c);
  return new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Résultat de scrim')
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId('adversaire')
          .setLabel('Adversaire')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('games')
          .setLabel('Résultats V/D par game (ex : VDV)')
          .setPlaceholder('V = victoire, D = défaite — dans l’ordre des games')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('date')
          .setLabel('Date (AAAA-MM-JJ) — vide = aujourd’hui')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Commentaire (optionnel)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
}

/** Extrait la suite de V/D (max 5 games) d'une saisie libre. */
function parseGames(raw: string): ('V' | 'D')[] {
  return raw
    .toUpperCase()
    .split('')
    .filter((c): c is 'V' | 'D' => c === 'V' || c === 'D')
    .slice(0, 5);
}

const isValidDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Point d'entrée des interactions Discord (à brancher sur Events.InteractionCreate). */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === CMD_NAME) {
      await interaction.showModal(buildModal());
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
      const opponent = interaction.fields.getTextInputValue('adversaire').trim();
      const games = parseGames(interaction.fields.getTextInputValue('games'));
      const dateRaw = interaction.fields.getTextInputValue('date').trim();
      const note = interaction.fields.getTextInputValue('note').trim();

      if (games.length === 0) {
        await interaction.reply({
          content: '❌ Aucun résultat lu. Utilise des V et des D, ex : `VDV`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const date = isValidDate(dateRaw) ? dateRaw : parisDateStr();
      const wins = games.filter((g) => g === 'V').length;

      await saveScrimResult({ opponent, games, date, note: note || undefined });
      await interaction.reply({
        content: `✅ Résultat enregistré dans ARCHI : **${opponent}** — ${wins}-${games.length - wins} (${games.join('')}) le ${date}.`,
      });
      return;
    }
  } catch (e) {
    log.error('Interaction échouée', { err: String(e) });
    if (interaction.isRepliable()) {
      await interaction
        .reply({ content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
}
