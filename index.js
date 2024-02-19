import { logger, useCommand, useEvent } from '@kokkoro/core';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import dayjs from 'dayjs';

const token = '';
const device = '';
const cookie = '';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const userdb = new sqlite3.Database(__dirname + '/db/user.db', (err) => {
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
    let data = {
      totalBans: res.data.all,
      dailyBans: res.data.today,
      currentDate: res.data.date_time
    };
    const generateBanImage = async (data) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      const htmlContent = fs.readFileSync(__dirname + '/resource/html/ban.html', 'utf8');

      await page.setContent(htmlContent);

      await page.evaluate((data) => {
        document.getElementById('total-bans').textContent = data.totalBans;
        document.getElementById('daily-bans').textContent = data.dailyBans;
        document.getElementById('current-date').textContent = data.currentDate;
      }, data);

      await page.screenshot({ path: __dirname + '/tmp/ban.png', fullPage: true });
      await browser.close();
    };

    await generateBanImage(data);

    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      file_image: await getBlobFromLocalImage(__dirname + '/tmp/ban.png')
    })
  });

  useCommand('/绑定 <message>', async ctx => {
    let steamId = ctx.query.message.replace(' ', '');
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


  useCommand('/今日赛程', async ctx => {
    let timeGeter = new Date();
    let matchTime = timeGeter.getFullYear() + "-" + (timeGeter.getMonth() + 1) + "-" + timeGeter.getDate();
    let apiUrl = `https://gwapi.pwesports.cn/eventcenter/app/csgo/event/getMatchList?matchTime=${matchTime}+00:00:00`;
    const response = await fetch(apiUrl);
    let res = await response.json();
    const hotMatches = [];
    let arrNum = 0;
    for (arrNum = 0; arrNum + 1 <= res.result.matchResponse.dtoList.length; arrNum++) {
      if (res.result.matchResponse.dtoList[arrNum].csgoEventDTO.hot != true) {
        break;
      }
      else {
        hotMatches.push({
          name: res.result.matchResponse.dtoList[arrNum].csgoEventDTO.nameZh,
          team1Name: res.result.matchResponse.dtoList[arrNum].team1DTO.name,
          team1Logo: res.result.matchResponse.dtoList[arrNum].team1DTO.logoWhite,
          team2Name: res.result.matchResponse.dtoList[arrNum].team2DTO.name,
          team2Logo: res.result.matchResponse.dtoList[arrNum].team2DTO.logoWhite,
          bo: res.result.matchResponse.dtoList[arrNum].bo,
          time: dayjs(res.result.matchResponse.dtoList[arrNum].startTime).$d
        });
      }
    }
    let html = '';
    hotMatches.forEach(match => {
      html += `
        <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="text-transform: uppercase;">${match.name}</h1>
         <p>${match.time}</p>
         <p>${match.team1Name} vs ${match.team2Name}</p>
         <div style="display: flex; justify-content: center; align-items: center;">
         <img src="${match.team1Logo}" alt="${match.team1Name}" style="max-width: 100px; max-height: 100px;">
         <span style="font-size: 20px; margin: 0 10px;">VS</span>
          <img src="${match.team2Logo}" alt="${match.team2Name}" style="max-width: 100px; max-height: 100px;">
        </div>
       <p>${match.bo}</p>
     </div>
      `;
    });

    const generateTodayScheduleImage = async (html) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      await page.waitForSelector('img');
      await page.screenshot({ path: __dirname + '/tmp/todaySchedule.png', fullPage: true });

      await browser.close();
    }
    await generateTodayScheduleImage(html);

    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      file_image: await getBlobFromLocalImage(__dirname + '/tmp/todaySchedule.png')
    })
  });

  useCommand('/明日赛程', async ctx => {
    let timeGeter = new Date();
    let matchTime = timeGeter.getFullYear() + "-" + (timeGeter.getMonth() + 1) + "-" + (timeGeter.getDate() + 1);
    let apiUrl = `https://gwapi.pwesports.cn/eventcenter/app/csgo/event/getMatchList?matchTime=${matchTime}+00:00:00`;
    const response = await fetch(apiUrl);
    let res = await response.json();
    const hotMatches = [];
    let arrNum = 0;
    for (arrNum = 0; arrNum + 1 <= res.result.matchResponse.dtoList.length; arrNum++) {
      if (res.result.matchResponse.dtoList[arrNum].csgoEventDTO.hot != true) {
        break;
      }
      else {
        hotMatches.push({
          name: res.result.matchResponse.dtoList[arrNum].csgoEventDTO.nameZh,
          team1Name: res.result.matchResponse.dtoList[arrNum].team1DTO.name,
          team1Logo: res.result.matchResponse.dtoList[arrNum].team1DTO.logoWhite,
          team2Name: res.result.matchResponse.dtoList[arrNum].team2DTO.name,
          team2Logo: res.result.matchResponse.dtoList[arrNum].team2DTO.logoWhite,
          bo: res.result.matchResponse.dtoList[arrNum].bo,
          time: dayjs(res.result.matchResponse.dtoList[arrNum].startTime).$d
        });
      }
    }
    let html = '';
    hotMatches.forEach(match => {
      html += `
        <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="text-transform: uppercase;">${match.name}</h1>
         <p>${match.time}</p>
         <p>${match.team1Name} vs ${match.team2Name}</p>
         <div style="display: flex; justify-content: center; align-items: center;">
         <img src="${match.team1Logo}" alt="${match.team1Name}" style="max-width: 100px; max-height: 100px;">
         <span style="font-size: 20px; margin: 0 10px;">VS</span>
          <img src="${match.team2Logo}" alt="${match.team2Name}" style="max-width: 100px; max-height: 100px;">
        </div>
       <p>${match.bo}</p>
     </div>
      `;
    });

    const generateTodayScheduleImage = async (html) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      await page.waitForSelector('img');
      await page.screenshot({ path: __dirname + '/tmp/todaySchedule.png', fullPage: true });

      await browser.close();
    }
    await generateTodayScheduleImage(html);

    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      file_image: await getBlobFromLocalImage(__dirname + '/tmp/todaySchedule.png')
    })
  });

  useCommand('/换绑 <message>', async ctx => {
    let steamId = ctx.query.message.replace(' ', '');
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
    })
    try {
      const result = await checkBinding;
      return result;
    } catch (error) {
      console.error(error);
    }
  });

  useCommand('/buff饰品搜索 <message>', async ctx => {
    let keyword = ctx.query.message.replace(' ', '');
    const response = await fetch(`https://buff.163.com/api/market/search/suggest?text=${encodeURI(keyword)}&game=cs2`, {
      "credentials": "include",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Cookie": `${cookie}`
      },
      "referrer": "https://buff.163.com/market/csgo",
      "method": "GET",
      "mode": "cors"
    });
    const data = await response.json();
    if(data.code != 'OK'){
      return data.msg;
    }
    const items = data.data.suggestions;
    let html = `
           <!DOCTYPE html>
            <html>
          <head>
             <title>商品列表</title>
           </head>
           <body>
             <h1>商品列表 - ${keyword}</h1>
            <ul>
          `;
    items.forEach(item => {
      html += `<li>${item.goods_ids}: ${item.option}</li>`;
    });
    html += `
             </ul>
          </body>
           </html>
          `;

    const generateBuffSearchImage = async (html) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      await page.screenshot({ path: __dirname + '/tmp/buffSearch.png', fullPage: true });

      await browser.close();
    }
    await generateBuffSearchImage(html);

    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      file_image: await getBlobFromLocalImage(__dirname + '/tmp/buffSearch.png')
    })
  })

  useCommand('/buff饰品信息 <message>', async ctx => {
    let goodId = ctx.query.message.replace(' ', '');
    const response = await fetch(`https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=${goodId}`, {
      "credentials": "include",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Cookie": `${cookie}`
      },
      "referrer": "https://buff.163.com/goods/781598?from=market",
      "method": "GET",
      "mode": "cors"
    })
    const data = await response.json();
    if(data.code != 'OK'){
      return data.msg;
    }
    let goods = data.data.items;
    const maxItems = 6;
    const goodsData = [];

    for (let i = 0; i < Math.min(goods.length, maxItems); i++) {
      const good = goods[i];
      goodsData.push({
        fraudwarnings: good.asset_info.info.fraudwarnings,
        icon_url: good.asset_info.info.icon_url,
        userId: good.user_id
      });
    }

    let html = `
    <h2>${data.data.goods_infos[`${goodId}`].name}</h2>
    <h3>steam价格:${data.data.goods_infos[`${goodId}`].steam_price_cny}</h3>
    <h3>buff底价:${data.data.items[0].price}</h3>
    <h3>buff最高求购价:${data.data.items[0].lowest_bargain_price}</h3>
    `;

    goodsData.forEach(good => {
      html += `
      <div>
       <p>名称标签:${good.fraudwarnings}</p>
       <p>商家ID:${good.userId}</p>
       <img src="${good.icon_url}" alt="icon">
      </div>
      `;
    });

    const generateGoodsInfoImage = async (html) => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      await page.waitForSelector('img');
      await page.screenshot({ path: __dirname + '/tmp/goodsInfo.png', fullPage: true });

      await browser.close();
    }
    await generateGoodsInfoImage(html);

    return ctx.api.sendChannelMessage(ctx.channel_id, {
      msg_id: ctx.id,
      file_image: await getBlobFromLocalImage(__dirname + '/tmp/goodsInfo.png')
    })
  })
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
