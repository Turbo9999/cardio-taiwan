const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getSnippet(html, index, before = 1500, after = 10000) {
  const start = Math.max(0, index - before);
  const end = Math.min(html.length, index + after);

  return html.slice(start, end);
}

/*
 * 找出所有 class_list 的位置
 */
function findClassLists(html) {
  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bclass_list\b[^"']*["'][^>]*>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    results.push({
      index: match.index,
      tag: match[0]
    });

    if (results.length >= 100) break;
  }

  return results;
}

/*
 * 嘗試找出 class_list 外面的父層結構。
 *
 * 這裡不是完整 HTML parser，
 * 而是從 class_list 往前找最近的幾層 div，
 * 把 class / id / data-* 抓出來。
 */
function findParentCandidates(html, index) {
  const before = html.slice(
    Math.max(0, index - 15000),
    index
  );

  const candidates = [];

  const regex =
    /<div\b([^>]*)>/gi;

  let match;

  while ((match = regex.exec(before)) !== null) {
    const attrs = match[1];

    const classMatch =
      attrs.match(
        /class=["']([^"']+)["']/i
      );

    const idMatch =
      attrs.match(
        /id=["']([^"']+)["']/i
      );

    const dataMatches =
      attrs.match(
        /data-[a-zA-Z0-9_-]+=["'][^"']*["']/gi
      ) || [];

    if (
      classMatch ||
      idMatch ||
      dataMatches.length > 0
    ) {
      candidates.push({
        position:
          Math.max(0, index - 15000) +
          match.index,

        className:
          classMatch
            ? classMatch[1]
            : null,

        id:
          idMatch
            ? idMatch[1]
            : null,

        data:
          dataMatches
      });
    }
  }

  return candidates.slice(-30);
}

/*
 * 把一個 class_list 裡面的資料先抽出來
 */
function parseClassList(html, index) {
  const start = index;

  const nextClassList =
    html.indexOf(
      'class="class_list',
      index + 20
    );

  const end =
    nextClassList === -1
      ? Math.min(
          html.length,
          index + 15000
        )
      : nextClassList;

  const block =
    html.slice(start, end);

  /*
   * 時間
   */
  const timeMatch =
    block.match(
      /class=["'][^"']*newclass_time[^"']*["'][^>]*>[\s\S]{0,500}?<div[^>]*>([\s\S]{0,100})<\/div>/i
    );

  /*
   * 課程名稱
   */
  const typeMatch =
    block.match(
      /class=["'][^"']*newclass_type[^"']*["'][^>]*>[\s\S]{0,1500}?<a[^>]*>([\s\S]*?)<\/a>/i
    );

  /*
   * 教室
   */
  const classroomMatch =
    block.match(
      /class=["']classroom["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 教練
   */
  const teacherMatch =
    block.match(
      /class=["']teacher["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 分店
   */
  const storeMatch =
    block.match(
      /class=["']class_store["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 是否有 Paid / Substitute / Exclusive
   */
  const paid =
    /Paid Class/i.test(block);

  const substitute =
    /Substitute/i.test(block);

  const exclusive =
    /Exclusive/i.test(block);

  return {
    index,

    time:
      timeMatch
        ? cleanText(timeMatch[1])
        : null,

    className:
      typeMatch
        ? cleanText(typeMatch[1])
        : null,

    classroom:
      classroomMatch
        ? cleanText(classroomMatch[1])
        : null,

    teacher:
      teacherMatch
        ? cleanText(teacherMatch[1])
        : null,

    store:
      storeMatch
        ? cleanText(storeMatch[1])
        : null,

    paid,
    substitute,
    exclusive,

    rawStart:
      block.slice(0, 12000)
  };
}

/*
 * 找所有日期 daybox
 */
function findDays(html) {
  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bdaybox\b[^"']*["'][^>]*>[\s\S]{0,1200}?<\/div>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const valueMatch =
      match[0].match(
        /id=["']day["'][^>]*value=["']([^"']+)["']/i
      );

    const dayNameMatch =
      match[0].match(
        /class=["']dayitem[^"']*["'][\s\S]*?<span[^>]*>([^<]+)<\/span>/i
      );

    results.push({
      index: match.index,

      date:
        valueMatch
          ? valueMatch[1]
          : null,

      day:
        dayNameMatch
          ? cleanText(dayNameMatch[1])
          : null,

      html:
        match[0]
    });
  }

  return results;
}

export default async function handler(req, res) {
  try {
    const response = await fetch(
      WORLD_GYM_URL,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CARDIO-TAIWAN/1.0)"
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message:
          "無法取得 World Gym 官方課表",
        status: response.status
      });
    }

    const html =
      await response.text();

    /*
     * 找 schedule_area
     */
    const scheduleIndex =
      html.indexOf(
        'id="schedule_area"'
      );

    if (scheduleIndex === -1) {
      return res.status(200).json({
        success: false,
        message:
          "找不到 schedule_area",
        htmlLength:
          html.length
      });
    }

    const scheduleHtml =
      html.slice(
        scheduleIndex,
        Math.min(
          html.length,
          scheduleIndex + 150000
        )
      );

    /*
     * 找日期
     */
    const days =
      findDays(html);

    /*
     * 找 class_list
     */
    const classLists =
      findClassLists(
        scheduleHtml
      );

    /*
     * 解析前 20 堂
     */
    const parsedClasses =
      classLists
        .slice(0, 20)
        .map((item, index) => {

          const absoluteIndex =
            scheduleIndex +
            item.index;

          return {
            number:
              index + 1,

            relativeIndex:
              item.index,

            absoluteIndex,

            data:
              parseClassList(
                scheduleHtml,
                item.index
              ),

            parentCandidates:
              findParentCandidates(
                html,
                absoluteIndex
              )
          };
        });

    /*
     * 找 schedule_area 周邊可能的日期 / 欄位資訊
     */
    const scheduleContext =
      getSnippet(
        html,
        scheduleIndex,
        2000,
        50000
      );

    return res.status(200).json({

      success: true,

      source:
        "World Gym Taiwan",

      branch:
        "台北統領",

      status:
        response.status,

      htmlLength:
        html.length,

      scheduleIndex,

      scheduleHtmlLength:
        scheduleHtml.length,

      /*
       * 日期
       */
      dayCount:
        days.length,

      days:
        days.slice(0, 30),

      /*
       * 課程
       */
      classListCount:
        classLists.length,

      parsedClassCount:
        parsedClasses.length,

      parsedClasses,

      /*
       * 課表附近原始 HTML
       */
      scheduleContext

    });

  } catch (error) {

    return res.status(500).json({
      success: false,

      message:
        "World Gym Sync 發生錯誤",

      error:
        error.message
    });
  }
}
