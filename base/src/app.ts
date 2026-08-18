var cog = console.log;

/*
    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT
*/
import fs from "node:fs";
import path from 'node:path';
const token = fs.readFileSync(path.resolve("./keys/discord_bot_token"), {encoding:'utf8'});

import {
  Client,
  Events,
  GatewayIntentBits,
  VoiceChannel,
  SlashCommandBuilder,
  Collection,
  Snowflake,
  CommandInteraction,
  MessageFlags
} from "discord.js";
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
import { 
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayer,
  getVoiceConnection,
  demuxProbe,
  AudioResource
} from "@discordjs/voice";

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
import stream from "node:stream";
import { LRUCache } from "lru-cache";
const opode_cache = new LRUCache<string, Buffer>({
  maxSize: 50 * 2**20, // 50 MB
  sizeCalculation: (value, key) => {
    return value.byteLength;
  },
  ttl: 1000 * 60 * 60 * 24, // 1 day
});

/*
    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO
*/

/**get the audio from disk or network*/
async function getOpodeResource(fpath: string): Promise<AudioResource<null> | null> {
  let audioBuffer = opode_cache.get(fpath);
  let audioResource: AudioResource<null> | null = null;

  if (audioBuffer) {
    // we have it cached
  } else {
    if (fpath.startsWith('[extern]')) {
      // he's somewhere else
      const actualPath = fpath.slice(8);
      let approval = false;
      for (const url of buckets){
        if (actualPath.startsWith(url)){
          approval = true;
          break;
        }
      }
      if (approval) {
        // we are ok to use this bucket
        const response = await fetch(actualPath);
        if (response.ok && response.body) {
          // got the item ok
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuffer);
        } else {
          // some kinda problem with fetching
          console.warn('fetch failed');
        }
      } else {
        // unapproved resource, so just ignore it I guess idk lol
        console.warn('unapproved resource');
      }
    } else {
      // is a local resource
      const fullPath = path.join("./opodes", fpath + ".opus");
      if (fs.existsSync(fullPath)) {
        // it's right here on the disk
        audioBuffer = await fs.promises.readFile(fullPath, {encoding:null});
      } else {
        // somehow wasnt found
      }
    }
  }

  if (audioBuffer){
    if (!opode_cache.has(fpath)) {      
      opode_cache.set(fpath, audioBuffer);
    }
    const stream_A = stream.Readable.from(audioBuffer);
    audioResource = createAudioResource(stream_A, {inputType: StreamType.OggOpus});
  }
  
  return audioResource;
}

// @ts-ignore
import board from "../opodes/boards.js";

/**some external buckets that we're allowed to pull from*/
let buckets: Set<string>;

/** this is all the paths for local audio files*/
let opodes: Set<string>;

function refreshOpodes(){
  opodes = new Set(
    fs.readdirSync("./opodes",{encoding:"utf8",recursive:true})
    .filter(s=>s.endsWith(".opus"))
    .map(fname=>fname.replace('\\','/').slice(0,-5))
  );
  opode_cache.clear();
  console.log(`refreshed opodes: ${opodes.size} files`);
  
  // refresh the approved buckets
  buckets = new Set(board.filter((b:any)=>'bucket' in b).map((b:any)=>b.bucket));
}
refreshOpodes();

async function beep(channel_id: Snowflake, fpath:string){
  if (players[channel_id] && (opodes.has(fpath) || fpath.startsWith('[extern]'))) {
    const opodeResource = await getOpodeResource(fpath);
    if (opodeResource) {
      players[channel_id]?.play(opodeResource);
    }
  }
}

/*
    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER
*/
import qs from 'node:querystring';
import http from 'node:http';
const server = http.createServer({noDelay:true});
server.on('request', (req, res) => {
  if (req.method !== "GET"){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('sorry nothing');
  } else if(req.url){
    // just handle everything
    if (req.url.startsWith('/cmd?')){
      parseUrlQuery(req.url);
    } else if (req.url.startsWith('/refresh')){
      refreshOpodes();
    } else {
      // do nothing, i guess
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('');
  } else {
    // basically ignore
    res.end('');
  }
});

export function parseUrlQuery(url: string){
  const justTheQuery = url.slice(url.indexOf('?') + 1);
  const qobj = qs.parse(justTheQuery);
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
  } else {
    // invalid query, ignore
  }
}

import {initWSS} from './websocket.js';

function initialization(){
  initWSS(server);
  server.listen(39692, 'localhost');
  login();
}
initialization();

