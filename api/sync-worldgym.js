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

function getSnippet(html, index, before = 2000, after = 12000) {
  const start = Math.max(0, index - before);
  const end = Math.min(html.length, index + after);

  return html.slice(start, end);
}

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

function findDays(html) {
  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bdaybox\b[^"']*["'][^>]*>[\s\S]{0,1200}?<\/div>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const block = match[0];

    const valueMatch =
      block.match(
        /id=["']day["'][^>]*value=["']([^"']+)["']/i
      );

    const dayMatch =
      block.match(
        /<span[^>]*>(Mon|Tue|Wed|Thu|Fri|Sat|Sun)<\/span>/i
      );

    results.push({
      index: match.index,

      date:
        valueMatch
          ? valueMatch[1]
          : null,

      day:
        dayMatch
          ? dayMatch[1]
          : null
    });
  }

  return results;
}

/*
 * 找出 class_list 所在的最近一個 <td>
 */
function findNearestTd(html, index) {

  const before =
    html.slice(
      0,
      index
    );

  const tdStart =
    before.lastIndexOf("<td");

  const tdEnd =
    html.indexOf(
      "</td>",
      index
    );

  if (
    tdStart === -1 ||
    tdEnd === -1
  ) {
    return null;
  }

  return {
    start: tdStart,
    end: tdEnd + 5,
    html:
      html.slice(
        tdStart,
        tdEnd + 5
      )
  };
}

/*
 * 找 class_list 所在的最近一個 table row
 */
function findNearestTr(html, index) {

  const before =
    html.slice(
      0,
      index
    );

  const trStart =
    before.lastIndexOf("<tr");

  const trEnd =
    html.indexOf(
      "</tr>",
      index
    );

  if (
    trStart === -1 ||
    trEnd === -1
  ) {
    return null;
  }

  return {
    start: trStart,
    end: trEnd + 5,
    html:
      html.slice(
        trStart,
        trEnd + 5
      )
  };
}

/*
 * 找課程資料
 */
function parseClassList(
  html,
  index
) {

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
    html.slice(
      index,
      end
    );

  /*
   * 時間
   *
   * 例如：
   * <div class="newclass_time ...">
   *   <div>09:00<span>|</span>10:00</div>
   */
  const timeMatch =
    block.match(
      /class=["'][^"']*newclass_time[^"']*["'][^>]*>\s*<div[^>]*>\s*(\d{2}:\d{2})\s*<span[^>]*>\|<\/span>\s*(\d{2}:\d{2})/i
    );

  /*
   * 課程名稱
   */
  const typeMatch =
    block.match(
      /class=["'][^"']*newclass_type[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i
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

  return {

    startTime:
      timeMatch
        ? timeMatch[1]
        : null,

    endTime:
      timeMatch
        ? timeMatch[2]
        : null,

    className:
      typeMatch
        ? cleanText(
            typeMatch[1]
          )
        : null,

    classroom:
      classroomMatch
        ? cleanText(
            classroomMatch[1]
          )
        : null,

    teacher:
      teacherMatch
        ? cleanText(
            teacherMatch[1]
          )
        : null,

    store:
      storeMatch
        ? cleanText(
            storeMatch[1]
          )
        : null,

    paid:
      /Paid Class/i.test(
        block
      ),

    substitute:
      /Substitute/i.test(
        block
      ),

    exclusive:
      /Exclusive/i.test(
        block
      ),

    raw:
      block.slice(
        0,
        10000
      )
  };
}

export default async function handler(
  req,
  res
) {

  try {

    const response =
      await fetch(
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

        status:
          response.status
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

    if (
      scheduleIndex === -1
    ) {

      return res.status(200).json({
        success: false,

        message:
          "找不到 schedule_area",

        htmlLength:
          html.length
      });

    }

    /*
     * 課表區域
     */
    const scheduleHtml =
      html.slice(
        scheduleIndex,
        Math.min(
          html.length,
          scheduleIndex + 150000
        )
      );

    /*
     * 日期
     */
    const days =
      findDays(html);

    /*
     * 課程
     */
    const classLists =
      findClassLists(
        scheduleHtml
      );

    /*
     * 分析前 15 堂
     */
    const samples =
      classLists
        .slice(0, 15)
        .map(
          (item, i) => {

            const absoluteIndex =
              scheduleIndex +
              item.index;

            const td =
              findNearestTd(
                html,
                absoluteIndex
              );

            const tr =
              findNearestTr(
                html,
                absoluteIndex
              );

            const data =
              parseClassList(
                scheduleHtml,
                item.index
              );

            return {

              number:
                i + 1,

              classListIndex:
                absoluteIndex,

              data,

              td: td
                ? {
                    start:
                      td.start,

                    end:
                      td.end,

                    length:
                      td.html.length,

                    openingTag:
                      td.html.slice(
                        0,
                        Math.min(
                          1000,
                          td.html.length
                        )
                      ),

                    html:
                      td.html.slice(
                        0,
                        12000
                      )
                  }
                : null,

              tr: tr
                ? {
                    start:
                      tr.start,

                    end:
                      tr.end,

                    length:
                      tr.html.length,

                    openingTag:
                      tr.html.slice(
                        0,
                        Math.min(
                          1000,
                          tr.html.length
                        )
                      ),

                    html:
                      tr.html.slice(
                        0,
                        20000
                      )
                  }
                : null
            };

          }
        );

    /*
     * 找所有 td 的 class / data 屬性
     */
    const tdAttributes = [];

    const tdRegex =
      /<td\b([^>]*)>/gi;

    let tdMatch;

    while (
      (tdMatch =
        tdRegex.exec(
          scheduleHtml
        )) !== null
    ) {

      tdAttributes.push(
        tdMatch[1]
      );

      if (
        tdAttributes.length >= 100
      ) {
        break;
      }

    }

    /*
     * 找所有可能代表欄位的 class
     */
    const columnClasses = [];

    const classRegex =
      /class=["']([^"']*(?:col|week|day|schedule|class|box)[^"']*)["']/gi;

    let classMatch;

    while (
      (classMatch =
        classRegex.exec(
          scheduleHtml
        )) !== null
    ) {

      columnClasses.push(
        classMatch[1]
      );

      if (
        columnClasses.length >= 100
      ) {
        break;
      }

    }

    /*
     * 回傳
     */
    return res.status(200).json({

      success:
        true,

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

      days,

      /*
       * 課程數
       */
      classListCount:
        classLists.length,

      /*
       * 課程樣本
       */
      sampleCount:
        samples.length,

      samples,

      /*
       * TD 結構
       */
      tdCount:
        tdAttributes.length,

      tdAttributes,

      /*
       * 欄位 class
       */
      columnClasses:

        [
          ...new Set(
            columnClasses
          )
        ]

    });

  } catch (error) {

    return res.status(500).json({

      success:
        false,

      message:
        "World Gym Sync 發生錯誤",

      error:
        error.message

    });

  }

}
