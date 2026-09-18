const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

/*
 * 清理 HTML 文字
 */
function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * 解析 HTML tag 的屬性
 */
function parseAttributes(attributeText) {
  const result = {};

  const regex =
    /([a-zA-Z_:][a-zA-Z0-9_:-]*)\s*=\s*["']([^"']*)["']/g;

  let match;

  while ((match = regex.exec(attributeText)) !== null) {
    result[match[1]] = match[2];
  }

  return result;
}

/*
 * 判斷 class 是否包含指定名稱
 */
function hasClass(attrs, name) {
  if (!attrs.class) return false;

  return attrs.class
    .split(/\s+/)
    .includes(name);
}

/*
 * 解析一堂課
 */
function parseClassBlock(block) {

  /*
   * 時間
   */
  const timeMatch =
    block.match(
      /class=["'][^"']*newclass_time[^"']*["'][^>]*>[\s\S]*?<div[^>]*>\s*(\d{2}:\d{2})\s*<span[^>]*>\|<\/span>\s*(\d{2}:\d{2})/i
    );

  /*
   * 課程名稱
   *
   * World Gym 實際結構：
   *
   * newclass_type
   *   └── a
   *       └── BODYCOMBAT
   */
  const typeMatch =
    block.match(
      /class=["'][^"']*newclass_type[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
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

    paid:
      /Paid Class/i.test(block),

    substitute:
      /Substitute/i.test(block),

    exclusive:
      /Exclusive/i.test(block)
  };
}

/*
 * 找日期 daybox
 */
function findDays(html) {

  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bdaybox\b[^"']*["'][^>]*>[\s\S]{0,1500}?<\/div>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {

    const block = match[0];

    const dateMatch =
      block.match(
        /id=["']day["'][^>]*value=["']([^"']+)["']/i
      );

    const dayNameMatch =
      block.match(
        />(Mon|Tue|Wed|Thu|Fri|Sat|Sun)<\/div>/i
      );

    results.push({

      index:
        match.index,

      date:
        dateMatch
          ? dateMatch[1]
          : null,

      day:
        dayNameMatch
          ? dayNameMatch[1]
          : null

    });
  }

  return results;
}

/*
 * ==========================================================
 * 核心：
 *
 * 真正追蹤 HTML 的父層結構
 * ==========================================================
 */
function inspectStructure(html) {

  const results = [];

  /*
   * 把 HTML 切成 tag / text
   */
  const tokenRegex =
    /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;

  let match;

  const stack = [];

  let lastIndex = 0;

  while (
    (match = tokenRegex.exec(html)) !== null
  ) {

    const token = match[0];

    /*
     * ------------------------------------------------------
     * 開始 tag
     * ------------------------------------------------------
     */
    if (
      /^<div\b/i.test(token)
    ) {

      const attributeText =
        token
          .replace(/^<div\b/i, "")
          .replace(/>$/, "");

      const attrs =
        parseAttributes(
          attributeText
        );

      stack.push({

        tag: "div",

        class:
          attrs.class || null,

        id:
          attrs.id || null,

        data:
          Object.keys(attrs)
            .filter(
              key =>
                key.startsWith(
                  "data-"
                )
            )
            .reduce(
              (obj, key) => {
                obj[key] =
                  attrs[key];
                return obj;
              },
              {}
            )

      });

      /*
       * 如果這個 div 就是 class_list
       */
      if (
        hasClass(
          attrs,
          "class_list"
        )
      ) {

        /*
         * 找這堂課的結尾
         */
        const nextClass =
          html.indexOf(
            'class="class_list',
            match.index + token.length
          );

        const end =
          nextClass === -1
            ? Math.min(
                html.length,
                match.index + 15000
              )
            : nextClass;

        const block =
          html.slice(
            match.index,
            end
          );

        results.push({

          index:
            match.index,

          parents:
            stack.map(
              item => ({
                tag:
                  item.tag,

                class:
                  item.class,

                id:
                  item.id,

                data:
                  item.data
              })
            ),

          data:
            parseClassBlock(
              block
            )

        });

        /*
         * 我們只需要前 20 堂
         */
        if (
          results.length >= 20
        ) {
          break;
        }
      }
    }

    /*
     * ------------------------------------------------------
     * 關閉 div
     * ------------------------------------------------------
     */
    else if (
      /^<\/div\s*>/i.test(token)
    ) {

      if (
        stack.length > 0
      ) {
        stack.pop();
      }
    }

    lastIndex =
      tokenRegex.lastIndex;
  }

  return results;
}

export default async function handler(
  req,
  res
) {

  try {

    /*
     * 取得 World Gym 官方頁面
     */
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

        success:
          false,

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

        success:
          false,

        message:
          "找不到 schedule_area",

        htmlLength:
          html.length

      });
    }

    /*
     * 只分析課表區域
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
     * HTML 結構
     */
    const structure =
      inspectStructure(
        scheduleHtml
      );

    /*
     * 找出所有父層 class
     */
    const parentClasses = [];

    structure.forEach(
      item => {

        item.parents.forEach(
          parent => {

            if (
              parent.class
            ) {

              parentClasses.push(
                parent.class
              );

            }

          }
        );

      }
    );

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
       * 課程
       */
      classCount:
        structure.length,

      classes:
        structure,

      /*
       * 所有父層 class
       */
      parentClasses:
        [
          ...new Set(
            parentClasses
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
