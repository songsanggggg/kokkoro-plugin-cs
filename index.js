import { logger, useCommand, useEvent } from '@kokkoro/core';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const userdb = new  sqlite3.Database(__dirname + '/db/user.db', (err) => {
  if (err) throw err;
});

userdb.serialize(() => {
  userdb.run('CREATE TABLE IF NOT EXISTS user_platform_mapping (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, platform_id TEXT)');
});

/**
 * @type {import('@kokkoro/core').Metadata}
 */
export const metadata = {
  name: '完美数据',
  description: '完美相关信息查询',
};

export default function Example() {
  useEvent(
    ctx => {
      ctx.logger.mark('link start');
    },
    ['session.ready'],
  );

  //获取二次元风格壁纸
  useCommand('/acg', async ctx => {
    let url = 'https://api.gumengya.com/Api/DmImg?format=image';
    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      image: url
    });
  });

  //获取完美平台封禁情况
  useCommand('/完美ban', async ctx => {
    let url = `https://pvp.wanmei.com/user-info/forbid-stats?game_abbr_list=PVP,CSGO`
    const response = await fetch(url);
    let res = await response.json();
    if (res.code != 0) {
        return '接口错误';
    }
    let msg = "完美平台\n" + "累计封禁数:" + res.data.all + "\n日新增封禁数:" + res.data.today + "\n日期:" + res.data.date_time;
    return msg;
/*
   return ctx.api.sendChannelMessage(ctx.channel_id, {
    msg_id: ctx.id,
    file_image: await getBlobFromLocalImage(__dirname + '/img/1.jpg')
   })
   */
  });

  useCommand('/绑定 <message>', async ctx => {
    let steamId = ctx.query.message;
    let userId = ctx.author.id;
  
    const checkBinding = new Promise((resolve, reject) => {
      userdb.get(`SELECT platform_id FROM user_platform_mapping WHERE user_id = ?`, userId, (err, row) => {
        if (err) {
          console.error(err);
          reject(err);
        }
  
        if (row) {
          resolve(`已存在绑定的平台ID: ${row.platform_id}`);
        } else {
          userdb.run(`INSERT INTO user_platform_mapping (user_id, platform_id) VALUES (?, ?)`, userId, steamId, (err) => {
            if (err) {
              console.error(err);
              reject(err);
            }
            resolve('绑定成功');
          });
        }
      });
    });
  
    try {
      const result = await checkBinding;
      return result;
    } catch (error) {
      console.error(error);
    }
  });

  useCommand('/换绑 <message>', async ctx => {
    let steamId = ctx.query.message;
    let userId = ctx.author.id;
  
    const checkBinding = new Promise((resolve, reject) => {
      userdb.get(`SELECT platform_id FROM user_platform_mapping WHERE user_id = ?`, userId, (err, row) => {
        if (err) {
          console.error(err);
          reject(err);
        }
  
        if (row) {
          userdb.run(`UPDATE user_platform_mapping SET platform_id = ? WHERE user_id = ?`, steamId, userId, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve('换绑成功');
            }
          });
        } else {
          resolve('还未绑定，请先绑定');
        }
      });
    });
  
    try {
      const result = await checkBinding;
      return result;
    } catch (error) {
      console.error(error);
    }
  });
}

async function getBlobFromLocalImage(imagePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(imagePath, (error, data) => {
      if (error) {
        reject(error);
      } else {
        const blob = new Blob([data], { type: 'image/jpeg' });
        resolve(blob);
      }
    });
  });
}