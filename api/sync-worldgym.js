const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

/*
 * ============================================================
 * 基本工具
 * ============================================================
 */

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(text) {
  const result = {};

  const regex =
    /([a-zA-Z_:][a-zA-Z0-9_:-]*)\s*=\s*["']([^"']*)["']/g;

  let match;

  while ((match = regex.exec(text)) !== null) {
    result[match[1]] = match[2];
  }

  return result;
}

function hasClass(attrs, className) {
  if (!attrs.class) {
    return false;
  }

  return attrs.class
    .split(/\s+/)
    .includes(className);
}

/*
 * ============================================================
 * 解析日期
 * ============================================================
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

    /*
     * 這個網站日期名稱在 HTML 中可能不是
     * 我們之前假設的格式，因此先保留 null。
     */

    results.push({
      index: match.index,
      date: dateMatch
        ? dateMatch[1]
        : null
    });
  }

  return results;
}

/*
 * ============================================================
 * 找一堂課的完整區塊
 * ============================================================
 */

function extractClassBlock(
  html,
  startIndex
) {

  const nextIndex =
    html.indexOf(
      'class="class_list',
      startIndex + 20
    );

  const endIndex =
    nextIndex === -1
      ? Math.min(
          html.length,
          startIndex + 20000
        )
      : nextIndex;

  return html.slice(
    startIndex,
    endIndex
  );
}

/*
 * ============================================================
 * 解析一堂課
 * ============================================================
 */

function parseClassBlock(block) {

  /*
   * 時間
   */
  const timeMatch =
    block.match(
      /class=["'][^"']*\bnewclass_time\b[^"']*["'][^>]*>[\s\S]*?(\d{2}:\d{2})\s*<span[^>]*>\|<\/span>\s*(\d{2}:\d{2})/i
    );

  /*
   * 課程名稱
   *
   * 實際 World Gym 結構：
   *
   * <div class="newclass_type">
   *   <a ...>BODYCOMBAT®</a>
   * </div>
   */
  const typeMatch =
    block.match(
      /<div[^>]*class=["'][^"']*\bnewclass_type\b[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i
    );

  /*
   * 如果上面沒抓到，
   * 再用 class_boxctx 裡面的第一個 a。
   */
  let className = null;

  if (typeMatch) {
    className =
      cleanText(typeMatch[1]);
  }

  if (!className) {

    const fallbackMatch =
      block.match(
        /class=["'][^"']*\bclass_boxctx\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
      );

    if (fallbackMatch) {
      className =
        cleanText(
          fallbackMatch[1]
        );
    }
  }

  /*
   * 教室
   */
  const classroomMatch =
    block.match(
      /<div[^>]*class=["']classroom["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 教練
   */
  const teacherMatch =
    block.match(
      /<div[^>]*class=["']teacher["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 分店
   */
  const storeMatch =
    block.match(
      /<div[^>]*class=["']class_store["'][^>]*>([\s\S]*?)<\/div>/i
    );

  /*
   * 特殊標記
   */
  const paid =
    /Paid Class/i.test(block);

  const substitute =
    /Substitute/i.test(block);

  const exclusive =
    /Exclusive/i.test(block);

  return {

    startTime:
      timeMatch
        ? timeMatch[1]
        : null,

    endTime:
      timeMatch
        ? timeMatch[2]
        : null,

    className,

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

    paid,

    substitute,

    exclusive
  };
}

/*
 * ============================================================
 * HTML 結構解析
 *
 * 注意：
 * 這次從「完整 HTML」開始解析，
 * 不從 schedule_area 中間開始。
 * ============================================================
 */

function inspectClasses(html) {

  const results = [];

  const tokenRegex =
    /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;

  const stack = [];

  let match;

  while (
    (match =
      tokenRegex.exec(html)) !== null
  ) {

    const token =
      match[0];

    /*
     * --------------------------------------------------------
     * 開始 div
     * --------------------------------------------------------
     */

    if (
      /^<div\b/i.test(token)
    ) {

      const attributeText =
        token
          .replace(
            /^<div\b/i,
            ""
          )
          .replace(
            />$/,
            ""
          );

      const attrs =
        parseAttributes(
          attributeText
        );

      const node = {

        tag:
          "div",

        class:
          attrs.class ||
          null,

        id:
          attrs.id ||
          null,

        data:
          Object.keys(attrs)
            .filter(
              key =>
                key.startsWith(
                  "data-"
                )
            )
            .reduce(
              (
                obj,
                key
              ) => {

                obj[key] =
                  attrs[key];

                return obj;

              },
              {}
            )
      };

      /*
       * 如果這個 div 是 class_list，
       * 先記錄「真正父層」
       */
      if (
        hasClass(
          attrs,
          "class_list"
        )
      ) {

        /*
         * stack 此時就是
         * class_list 的真正父層。
         */
        const parents =
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
          );

        const block =
          extractClassBlock(
            html,
            match.index
          );

        const data =
          parseClassBlock(
            block
          );

        results.push({

          index:
            match.index,

          parents,

          data

        });

        /*
         * 暫時只取 50 堂
         */
        if (
          results.length >= 50
        ) {
          break;
        }
      }

      /*
       * 最後才 push 到 stack
       */
      stack.push(
        node
      );
    }

    /*
     * --------------------------------------------------------
     * 關閉 div
     * --------------------------------------------------------
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
  }

  return results;
}

/*
 * ============================================================
 * 找 schedule_area 附近資訊
 * ============================================================
 */

function findScheduleInfo(html) {

  const index =
    html.indexOf(
      'id="schedule_area"'
    );

  if (index === -1) {
    return null;
  }

  return {
    index,

    before:
      html.slice(
        Math.max(
          0,
          index - 5000
        ),
        index
      ),

    after:
      html.slice(
        index,
        Math.min(
          html.length,
          index + 20000
        )
      )
  };
}

/*
 * ============================================================
 * API
 * ============================================================
 */

export default async function handler(
  req,
  res
) {

  try {

    /*
     * 取得 World Gym 官方公開課表
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
     * 日期
     */
    const days =
      findDays(
        html
      );

    /*
     * 課表區域
     */
    const scheduleInfo =
      findScheduleInfo(
        html
      );

    if (!scheduleInfo) {

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
     * 解析整個 HTML
     *
     * 這是這一版最大的修正。
     */
    const classes =
      inspectClasses(
        html
      );

    /*
     * 把父層 class 整理出來
     */
    const parentClasses = [];

    classes.forEach(
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
        classes.length,

      classes,

      /*
       * 父層 class
       */
      parentClasses:
        [
          ...new Set(
            parentClasses
          )
        ],

      /*
       * schedule_area
       */
      scheduleIndex:
        scheduleInfo.index

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
