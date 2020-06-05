const config = require('./config.json');
const { MessageEmbed } = require('discord.js');
const util = require('util');
const fs = require('fs');

const logType = {
  MESSAGE_DELETE: 'message_delete',
  MESSAGE_UPDATE: 'message_update'
}

const messageType = {
  NO_ACCESS: 'type_noaccess',
  USAGE: 'type_usage',
  SUCCESS: 'type_sucess',
  ERROR: 'type_error',
  CODE: 'type_code',
  NORMAL: 'type_normal',
  ATTACHMENT: 'type_attachment'
}

module.exports.resolveUser = function(message, userId, checkString = false) {
  return new Promise(async (resolve, reject) => {
    userId = userId.replace('!', '');
    if (userId.startsWith('<@')) userId = userId.slice(2, userId.length - 1);

    try {
      resolve(await message.client.users.fetch(userId));
    } catch {
      try {
        if (checkString) return resolve(await resolveUserString(message, userId));
        resolve();
      } catch { resolve(); }
    }
  })
}

module.exports.resolveChannel = function(message, channelId, channelType, checkString = false) {
  return new Promise(async (resolve, reject) => {
    if (channelId.startsWith('<#')) channelId = channelId.slice(2, channelId.length - 1);

    try {
      resolve(await message.guild.channels.fetch(channelId));
    } catch {
      try {
        if (checkString) return resolve(await resolveChannelString(message, channelId, channelType));
        resolve();
      } catch { resolve(); }
    }
  })
}

module.exports.sendLogMessage = function(guild, data, type) {
  return new Promise(async (resolve, reject) => {
    if (!guild.db.log.enabledModules.includes(type)) return resolve();

    switch (type) {
      case logType.MESSAGE_DELETE: return resolve(await logDelete(guild, data));
      case logType.MESSAGE_UPDATE: return resolve(await logUpdate(guild, data));
    }
  })
}

function logDelete(guild, data) {
  return new Promise(async (resolve, reject) => {
    if (!guild.ready || guild.db.log.channel == null) return resolve();
    let message = lengthCheck(data.cleanContent);

    console.log(message);

    /*
    let message 
    
    let embed = new MessageEmbed();
    embed.setDescription(data);
    embed.setColor('YELLOW');
    embed.setFooter(`${data.author.tag}${data.guild.member(data.author).displayName != data.author.username ? ` [${data.guild.member(data.author).displayName}]` : ''} deleted in #${data.channel.name}`);

    if (data.attachments.size > 0) {
      let attachment = data.attachments.first();
      if (config.discord.log.downloadAttachments) embed.setImage(`./attachments/${data.channel.id}/${attachment.id}/${attachment.name}`);
      else if (data.guild.db.log.files != null) embed.setImage(attachment.link.url);
    }
    
    if (guild.hasOwnProperty('logHook')) {
      try {
        return resolve(await guild.logHook.send(embed));
      } catch { }
    }

    let guildChannel = guild.channels.cache.find(channel => channel.id == guild.db.log.channel);

    try { resolve(await guildChannel.send(embed)); }
    catch { resolve(); }
    */
  })
}

function resolveUserString(message, string) {
  return new Promise(async (resolve, reject) => {
    string = string.toLowerCase();

    let findUsers = message.client.users.cache.filter(user => {
      if (!message.guild && user.tag.toLowerCase().includes(string)) return user;
      else {
        let member = message.guild.member(user);
        if (member && (user.tag.toLowerCase().includes(string) || message.guild.member(user).displayName.toLowerCase().includes(string))) return user;
      }
      return;  
    }).array();

    if (findUsers.length == 0) { await sendMessage(message.channel, util.format(translatePhrase('target_notfound', message.guild ? message.guild.db.lang : config.discord.language), string), messageType.ERROR); return resolve(); }
    if (findUsers.length == 1) return resolve(findUsers[0]);

    let reply = '';

    for (let i = 0; i < findUsers.length; i++) {
      let user = findUsers[i];

      if (reply.length > 0) reply += `\n`;
      reply += `[${i}] ${user.tag} (${user.id})`;
    }

    let selection = await sendMessage(message.channel, reply, messageType.CODE);
    
    await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 10000, errors: ['time'] })
    .then(collection => {
      let collectedMessage = collection.first();

      deleteMessage(collectedMessage, true);
      if (isNaN(collectedMessage.content)) { sendMessage(message.channel, util.format(translatePhrase('target_invalid', message.guild ? message.guild.db.lang : config.discord.language), collectedMessage.content, findUsers.length - 1), messageType.ERROR); resolve(); }
      else {
        let pick = parseInt(collectedMessage.content);
        if (pick < 0 || pick > findUsers.length - 1 || pick == 'NaN') { sendMessage(message.channel, util.format(translatePhrase('target_invalid', message.guild ? message.guild.db.lang : config.discord.language), collectedMessage.content, findUsers.length - 1), messageType.ERROR); resolve(); }

        resolve(findUsers[pick]);
      }
    })
    .catch(collection => {
      if (collection.size == 0) sendMessage(message.channel, translatePhrase('target_toolong', message.guild ? message.guild.db.lang : config.discord.language), messageType.ERROR); resolve();
    })

    deleteMessage(selection, true);
  })
}

function resolveChannelString(message, string, channelType) {
  return new Promise(async (resolve, reject) => {
    string = string.toLowerCase();

    let findChannels = message.guild.channels.cache.filter(channel => channel.name.toLowerCase().includes(string) && channel.type == channelType).array();
    if (findChannels.length == 0) { await sendMessage(message.channel, util.format(translatePhrase('target_notfound', message.guild ? message.guild.db.lang : config.discord.language), string), messageType.ERROR); return resolve(); }
    if (findChannels.length == 1) return resolve(findChannels[0]);

    let reply = '';

    for (let i = 0; i < findChannels.length; i++) {
      let guildChannel = findChannels[i];

      if (reply.length > 0) reply += `\n`;
      reply += `[${i}] ${guildChannel.name} [${guildChannel.type}] (${guildChannel.id})`;
    }

    let selection = await sendMessage(message.channel, reply, messageType.CODE);

    await message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 10000, errors: ['time'] })
    .then(async collection => {
      let collectedMessage = collection.first();

      deleteMessage(collectedMessage, true);
      if (isNaN(collectedMessage.content)) { sendMessage(message.channel, util.format(translatePhrase('target_invalid', message.guild ? message.guild.db.lang : config.discord.language), collectedMessage.content, findChannels.length - 1), messageType.ERROR); resolve(); }
      else {
        let pick = parseInt(collectedMessage.content);
        if (pick < 0 || pick > findChannels.length - 1 || pick == 'NaN') { sendMessage(message.channel, util.format(translatePhrase('target_invalid', message.guild ? message.guild.db.lang : config.discord.language), collectedMessage.content, findChannels.length - 1), messageType.ERROR); resolve(); }

        resolve(findChannels[pick]);
      }
    })
    .catch(collection => {
      if (collection.size == 0) sendMessage(message.channel, translatePhrase('target_toolong', message.guild ? message.guild.db.lang : config.discord.language), messageType.ERROR); resolve();
    })

    deleteMessage(selection, true);
  })
}

function translatePhrase(phrase, language) {
  const en = require('./translations/en.json');
  var translation = en[phrase];
  
  if (fs.existsSync(`./translations/${language}.json`)) {
    const lang = require(`./translations/${language}.json`);
    if (lang.hasOwnProperty(phrase)) translation = lang[phrase];
  }

  return translation;
}

function sendMessage(channel, message, type) {
  return new Promise(async (resolve, reject) => {
    switch (type) {
      case messageType.NO_ACCESS: return resolve(await messageNoAccess(channel, message));
      case messageType.USAGE: return resolve(await messageUsage(channel, message));
      case messageType.SUCCESS: return resolve(await messageSuccess(channel, message));
      case messageType.ERROR: return resolve(await messageError(channel, message));
      case messageType.CODE: return resolve(await messageCode(channel, message));
      case messageType.NORMAL: return resolve(await messageNormal(channel, message));
      case messageType.ATTACHMENT: return resolve(await messageAttachment(channel, message));
    }
  })
}

function messageNoAccess(user, message) {
  return new Promise(async (resolve, reject) => {
    try {
      let embed = new MessageEmbed();
      embed.setDescription(message);
      embed.setColor('RED');

      resolve(await user.send(embed));
    } catch { resolve(); }
  })
}

function messageUsage(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      let embed = new MessageEmbed();
      embed.setDescription(message);
      embed.setColor('YELLOW');

      if (!channel.guild || (channel.guild && channel.permissionsFor(channel.guild.me).has('EMBED_LINKS'))) return resolve(await channel.send(embed));
      resolve(await channel.send(message));
    } catch { resolve(); }
  })
}

function messageSuccess(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      let embed = new MessageEmbed();
      embed.setDescription(message);
      embed.setColor('GREEN');

      if (!channel.guild || (channel.guild && channel.permissionsFor(channel.guild.me).has('EMBED_LINKS'))) return resolve(await channel.send(embed));
      resolve(await channel.send(message));
    } catch { resolve(); }
  })
}

function messageError(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      let embed = new MessageEmbed();
      embed.setDescription(message);
      embed.setColor('RED');

      if (!channel.guild || (channel.guild && channel.permissionsFor(channel.guild.me).has('EMBED_LINKS'))) return resolve(await channel.send(embed));
      resolve(await channel.send(message));
    } catch { resolve(); }
  })
}

function messageCode(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(await channel.send(message, { code: true }));
    } catch { resolve(); }
  })
}

function messageNormal(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(await channel.send(message));
    } catch { resolve(); }
  })
}

function messageAttachment(channel, message) {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(await channel.send(message.content, { files: [message.attachment] }));
    } catch { resolve(); }
  })
}

function lengthCheck(string) {
  if (string.length == 0) return '';
  else if (string.length < 500 && string.split('\n').length < 5) return { type: 'text', value: string }
  else {
    if (!fs.existsSync('./messages')) fs.mkdirSync('./messages');
    fs.writeFileSync(`./messages/${id}.txt`, string);
    return { type: 'id', value: id }
  }
}

async function deleteMessage(message, botDelete = false) {
  try {
    await message.delete();
    if (botDelete) message.botDelete = true;
  } catch { }
}

module.exports.logType = logType;
module.exports.messageType = messageType;
module.exports.sendMessage = sendMessage;
module.exports.translatePhrase = translatePhrase;
module.exports.deleteMessage = deleteMessage;