var cog = console.log;

/*
    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT
*/
import fs from "node:fs";
import path from 'node:path';
const token = fs.readFileSync(path.resolve("./keys/discord_bot_token"), {encoding:'utf8'});

import {Client, Events, GatewayIntentBits, VoiceChannel, SlashCommandBuilder, Collection, Snowflake, CommandInteraction, MessageFlags} from "discord.js";
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
function login(){
  client.once(Events.ClientReady, readyClient => {
    cog(`clientready: ${readyClient.user.tag}`);
  });
  client.login(token);
}

/*
    COMMANDS    COMMANDS    COMMANDS    COMMANDS    COMMANDS    COMMANDS    COMMANDS    COMMANDS    COMMANDS
*/
const beepcom = {
  data: new SlashCommandBuilder()
    .setName("beep")
    .setDescription("beep beep"),
  async execute(interaction: CommandInteraction){
    await interaction.reply({content:"beep beep", flags: MessageFlags.Ephemeral});
  }
}
const commands = new Collection();
commands.set(beepcom.data.name, beepcom);

client.on(Events.InteractionCreate, async interaction =>{
  if (interaction.isCommand()){
    const com = commands.get(interaction.commandName) as typeof beepcom | undefined;
    if (com) {
      try {
        await com.execute(interaction);
      } catch (e){
        cog(e);
      }
    }
  }
});

/*
    VOICE CHAT    VOICE CHAT    VOICE CHAT    VOICE CHAT    VOICE CHAT    VOICE CHAT    VOICE CHAT    VOICE CHAT
*/
import { joinVoiceChannel, createAudioPlayer, createAudioResource,StreamType, AudioPlayer, getVoiceConnection } from "@discordjs/voice";

const players: Record<Snowflake, AudioPlayer> = Object.create(null);

/**
 * 
 * @param channel_id This is the voice channel id
 */
async function getinchat(channel_id: Snowflake){
  const channel = await client.channels.fetch(channel_id);

  if (channel instanceof VoiceChannel){
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    const player = createAudioPlayer();
    connection.subscribe(player);
    players[channel_id] = player;
  }
}
/**
 * 
 * @param channel_id voice channel id
 */
async function leave_chat(channel_id: Snowflake){
  const channel = await client.channels.fetch(channel_id);

  if (channel instanceof VoiceChannel){
    const connection = getVoiceConnection(channel.guild.id);
    connection?.destroy();
    const player = players[channel_id];
    player?.stop();
    delete players[channel_id];
  }
}

/*
  memory management
*/
import {Readable} from "node:stream";
import { LRUCache } from "lru-cache";
const opode_cache = new LRUCache<string, Buffer>({
  maxSize: 50 * 2**20, // 50 MB
  sizeCalculation: (value, key) => {
    return value.byteLength;
  },
  ttl: 1000 * 60 * 60 * 24, // 1 day
});

function getOpodeResource(fpath: string) {
  let audioBuffer = opode_cache.get(fpath);
  if (!audioBuffer) {
    const fullPath = path.join("./opodes", fpath + ".opus");
    if (fs.existsSync(fullPath)) {
      audioBuffer = fs.readFileSync(fullPath);
      opode_cache.set(fpath, audioBuffer);
    }
  }
  const stream = Readable.from(audioBuffer!);
  let audioResource = createAudioResource(stream, {inputType: StreamType.OggOpus});
  return audioResource;
}

/*
    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO
*/
// copy all the audio file paths into ram first
let opodes: Set<string>;
function refreshOpodes(){
  opodes = new Set(
    fs.readdirSync("./opodes",{encoding:"utf8",recursive:true})
    .filter(s=>s.endsWith(".opus"))
    .map(fname=>fname.replace('\\','/').slice(0,-5))
  );
  opode_cache.clear();
  console.log(`refreshed opodes: ${opodes.size} files`);
}
refreshOpodes();

function beep(channel_id: Snowflake, fpath:string){
  if (players[channel_id] && opodes.has(fpath)){
    players[channel_id]?.play(getOpodeResource(fpath));
  }
}

/*
    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER
*/
import * as qs from 'node:querystring';
import * as http from 'node:http';
const server = http.createServer({noDelay:true});
server.on('request', (req, res) => {
  if (req.method !== "GET"){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('sorry nothing');
  } else if(req.url?.startsWith('/cmd?')){
    const qobj = qs.parse(req.url.slice(5));
    const channel_id = qobj["q"];
    const somedata = qobj["f"];
    if (typeof channel_id === "string" && typeof somedata === "string") {
      if (somedata === "getinchat()"){
        getinchat(channel_id);
      } else if (somedata === "leave_chat()"){
        leave_chat(channel_id);
      } else{
        beep(channel_id, somedata);
      }      
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('');
    }
  } else {
    refreshOpodes();
    res.end('');
  }
});
server.listen(39692, 'localhost');

login();
