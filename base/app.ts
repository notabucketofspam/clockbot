var cog = console.log;

/*
    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT    DISCORD CLIENT
*/
import * as fs from "node:fs";
import * as path from 'node:path';
const token = fs.readFileSync(path.resolve("./keys/discord_bot_token"), {encoding:'utf8'});

import {Client, Events, GatewayIntentBits, VoiceChannel, SlashCommandBuilder, Collection, Snowflake, CommandInteraction, MessageFlags, Guild} from "discord.js";
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
import { joinVoiceChannel, VoiceConnection, createAudioPlayer, createAudioResource,StreamType, AudioPlayer, getVoiceConnection } from "@discordjs/voice";

const players = new Map<Snowflake, AudioPlayer>();

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
    players.set(channel_id, player);
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
    const player = players.get(channel_id);
    player?.stop();
    players.delete(channel_id);
  }
}

/*
    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO    PLAY AUDIO
*/
import * as stream from "node:stream";
// copy all the audio files into ram first
const opodes = new Map(
  fs.readdirSync("./opodes",{encoding:"utf8",recursive:true})
  .filter(s=>s.endsWith(".opus"))
  .map(fname=>[fname.replace('\\','/').slice(0,-5), fs.readFileSync(`opodes/${fname}`)])
);

function brstm(somebuffer:Buffer){
  const stm = new stream.Readable({highWaterMark:somebuffer.length});
  stm.push(somebuffer);
  stm.push(null);
  return stm;
}

function beep(channel_id: Snowflake, fpath:string){
  if (players.has(channel_id) && opodes.has(fpath)){
    players.get(channel_id)!.play(createAudioResource(brstm(opodes.get(fpath)!), {inputType:StreamType.OggOpus}));
  }
}

/*
    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER    HTTP SERVER
*/
import * as http from 'node:http';
const server = http.createServer();
server.on('request', (req, res) => {
  if (req.method === "GET"){
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('sorry nothing');
  } else if(req.url){
    const earl = new URL("http://localhost"+req.url);
    const sparams = earl.searchParams;
    const channel_id = sparams.get("q");
    if (typeof channel_id === "string") {
      if (req.method === "POST") {
        req.setEncoding("utf8");
        let somedata = "";
        req.on("data", chunk=>{
          somedata += chunk;
        });
        req.once("end", ()=>{
          //cog(somedata);
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
        });
      }
    }
  }
});
server.listen(39692, 'localhost');

login();
