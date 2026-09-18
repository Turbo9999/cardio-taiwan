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

function getAttribute(tag, name) {
  const regex = new RegExp(
    name + '=["\']([^"\']*)["\']',
    "i"
  );

  const match = tag.match(regex);

  return match ? match[1] : null;
}

function findDays(html) {
  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bdaybox\b[^"']*["'][^>]*>[\s\S]{0,1200}?<\/div>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const block = match[0];

    const dateMatch =
      block.match(
        /id=["']day["'][^>]*value=["']([^"']+)["']/i
      );

    results.push({
      index: match.index,
      date: dateMatch
        ? dateMatch[1]
        : null
    });
  }

  return results;
}

function extractClassData(block) {

  const timeMatch =
    block.match(
      /newclass_time[^>]*>[\s\S]*?(\d{2}:\d{2})\s*<span[^>]*>\|<\/span>\s*(\d{2}:\d{2})/i
    );

  const typeMatch =
    block.match(
      /newclass_type[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
    );

  const classroomMatch =
    block.match(
      /class=["']classroom["'][^>]*>([\s\S]*?)<\/div>/i
    );

  const teacherMatch =
    block.match(
      /class=["']teacher["'][^>]*>([\s\S]*?)<\/div>/i
    );

  return {
    startTime:
      timeMatch ? timeMatch[1] : null,

    endTime:
      timeMatch ? timeMatch[2] : null,

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
        : null
  };
}

function inspectWeekViews(html) {

  const results = [];

  const regex =
    /<div[^>]*class=["'][^"']*\bckview_div\b[^"']*["'][^>]*>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {

    const start = match.index;

    /*
     * 找下一個 ckview_div
     */
    const next =
      html.indexOf(
        '<div',
        start + match[0].length
      );

    /*
     * 不直接用下一個 div，
     * 改用下一個 ckview_div
     */
    const remaining =
      html.slice(
        start + match[0].length
      );

    const nextView =
      remaining.search(
        /<div[^>]*class=["'][^"']*\bckview_div\b[^"']*["'][^>]*>/i
      );

    const end =
      nextView === -1
        ? Math.min(
            html.length,
            start + 50000
          )
        : start +
          match[0].length +
          nextView;

    const block =
      html.slice(
        start,
        end
      );

    /*
     * 找這個 view 裡所有 class_list
     */
    const classRegex =
      /<div[^>]*class=["'][^"']*\bclass_list\b[^"']*["'][^>]*>/gi;

    const classPositions = [];

    let classMatch;

    while (
      (classMatch =
        classRegex.exec(block)) !== null
    ) {

      classPositions.push(
        classMatch.index
      );

      if (
        classPositions.length >= 100
      ) {
        break;
      }
    }

    /*
     * 找這個 view 前面最近的日期
     */
    const before =
      html.slice(
        Math.max(
          0,
          start - 15000
        ),
        start
      );

    const nearbyDates =
      [
        ...before.matchAll(
          /2026\/\d{2}\/\d{2}/g
        )
      ].map(
        item => ({
          date:
            item[0],
          index:
            item.index
        })
      );

    /*
     * 解析前 5 堂課
     */
    const classes = [];

    classPositions
      .slice(0, 5)
      .forEach(
        position => {

          const nextClass =
            block.indexOf(
              'class="class_list',
              position + 20
            );

          const classEnd =
            nextClass === -1
              ? Math.min(
                  block.length,
                  position + 12000
                )
              : nextClass;

          const classBlock =
            block.slice(
              position,
              classEnd
            );

          classes.push(
            extractClassData(
              classBlock
            )
          );
        }
      );

    results.push({

      index:
        start,

      openingTag:
        match[0],

      classListCount:
        classPositions.length,

      nearbyDates,

      firstClasses:
        classes

    });

    /*
     * 最多分析 20 個 view
     */
    if (
      results.length >= 20
    ) {
      break;
    }
  }

  return results;
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

    const days =
      findDays(html);

    const views =
      inspectWeekViews(html);

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

      dayCount:
        days.length,

      days,

      viewCount:
        views.length,

      views

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
