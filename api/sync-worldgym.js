export default async function handler(req, res) {
  const sourceUrl =
    "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `World Gym HTTP ${response.status}`,
      });
    }

    const html = await response.text();

    // ============================================================
    // 基本工具
    // ============================================================

    const decode = (value = "") =>
      value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#x2F;/gi, "/");

    const stripHtml = (value = "") =>
      decode(
        value
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
      )
        .replace(/\s+/g, " ")
        .trim();

    const getAttributes = (tag = "") => {
      const attrs = {};

      const regex =
        /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g;

      let match;

      while ((match = regex.exec(tag)) !== null) {
        attrs[match[1]] = decode(match[3]);
      }

      return attrs;
    };

    // ============================================================
    // 1. 找所有日期
    // ============================================================

    const dateNodes = [];

    const dayRegex =
      /<input[^>]*id=["']day["'][^>]*value=["']([^"']+)["'][^>]*>/gi;

    let dayMatch;

    while ((dayMatch = dayRegex.exec(html)) !== null) {
      dateNodes.push({
        date: dayMatch[1],
        index: dayMatch.index,
      });
    }

    const dates = [];

    for (const item of dateNodes) {
      if (!dates.includes(item.date)) {
        dates.push(item.date);
      }
    }

    // ============================================================
    // 2. 找課表區域
    // ============================================================

    const scheduleIndex = html.indexOf('id="schedule_area"');

    if (scheduleIndex === -1) {
      return res.status(500).json({
        success: false,
        error: "找不到 schedule_area",
      });
    }

    const scheduleHtml = html.slice(scheduleIndex);

    // ============================================================
    // 3. 找 class_list
    // ============================================================

    const classRegex =
      /<div[^>]*class=["'][^"']*\bclass_list\b[^"']*["'][^>]*>/gi;

    const classStarts = [];

    let classMatch;

    while ((classMatch = classRegex.exec(scheduleHtml)) !== null) {
      classStarts.push({
        index: classMatch.index,
        openingTag: classMatch[0],
        attributes: getAttributes(classMatch[0]),
      });
    }

    // ============================================================
    // 4. 課程名稱清單
    // ============================================================

    const knownClasses = [
      "BODYCOMBAT®",
      "BODYPUMP®",
      "BODYBALANCE®",
      "BODYJAM®",
      "BODYSTEP®",
      "BODYATTACK®",

      "GROUP POWER",
      "GROUP CENTERGY",
      "GROUP FIGHT",
      "GROUP BLAST",
      "GROUP GROOVE",

      "Step Move",
      "Stepforce",
      "Latin Jam",
      "Dance Aerobics",
      "Total Body Sculpt",
      "Lean Flow",
      "Hi Low",
      "Ball Sculpt",
      "Jazz Dance",
      "Zumba",
      "MV Dance",
      "Hip Hop",

      "Hatha Yoga",
      "Flow Yoga",
      "Gentle Yoga",
      "Yoga Basic",
      "Yoga Ball",
      "Pilates",
      "Stretch Yoga",
      "Yo Yo Stretch",

      "BODYTURN",
      "Interval",
      "Fat Burning",
      "World Ball",
      "Aero Power",
      "Freestyle Step",
      "Dance Party",
      "Aerobics Intro",

      "Taichi Zen Martial Arts",
      "Restorative Yoga",
      "Power Yoga",
      "Yogalates",
      "Meridian Yoga",
      "Double Pop",

      "Core Stability Enhancement Training",
      "Explosive Power Training",
      "Sandbag Boxing Training",
    ];

    const classroomPatterns = [
      "4F團體有氧教室",
      "3F飛輪教室",
      "2F團體有氧教室",
      "1F團體有氧教室",
      "團體有氧教室",
      "飛輪教室",
    ];

    // ============================================================
    // 5. 解析每一堂課
    // ============================================================

    const classes = [];

    for (let i = 0; i < classStarts.length; i++) {
      const current = classStarts[i];

      const start = current.index;

      const end =
        i + 1 < classStarts.length
          ? classStarts[i + 1].index
          : scheduleHtml.length;

      const block = scheduleHtml.slice(start, end);

      const text = stripHtml(block);

      // ----------------------------------------------------------
      // 時間
      // ----------------------------------------------------------

      const timeMatch = text.match(
        /\b([0-2]\d:[0-5]\d)\s*\|\s*([0-2]\d:[0-5]\d)\b/
      );

      if (!timeMatch) {
        continue;
      }

      const startTime = timeMatch[1];
      const endTime = timeMatch[2];

      // ----------------------------------------------------------
      // 課程名稱
      // ----------------------------------------------------------

      let className = null;

      for (const name of knownClasses) {
        if (text.includes(name)) {
          className = name;
          break;
        }
      }

      // ----------------------------------------------------------
      // 教室
      // ----------------------------------------------------------

      let classroom = null;

      for (const room of classroomPatterns) {
        if (text.includes(room)) {
          classroom = room;
          break;
        }
      }

      // ----------------------------------------------------------
      // 教練
      // ----------------------------------------------------------

      let instructor = null;

      const teacherMatch = block.match(
        /<div[^>]*class=["'][^"']*\bteacher\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
      );

      if (teacherMatch) {
        instructor = stripHtml(teacherMatch[1]);
      }

      // ==========================================================
      // 找課程卡內部的 class
      // ==========================================================

      const innerClassNames = [];

      const classAttrRegex =
        /class=["']([^"']+)["']/gi;

      let classAttrMatch;

      while (
        (classAttrMatch = classAttrRegex.exec(block)) !== null
      ) {
        innerClassNames.push(classAttrMatch[1]);
      }

      // ==========================================================
      // 找 data-* 屬性
      // ==========================================================

      const dataAttributes = {};

      const dataRegex =
        /\s(data-[a-zA-Z0-9_-]+)=["']([^"']*)["']/gi;

      let dataMatch;

      while ((dataMatch = dataRegex.exec(block)) !== null) {
        dataAttributes[dataMatch[1]] = decode(dataMatch[2]);
      }

      // ==========================================================
      // 找課程本身是否包含日期
      // ==========================================================

      const embeddedDates = [];

      const embeddedDateRegex =
        /\b20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}\b/g;

      let embeddedDateMatch;

      while (
        (embeddedDateMatch = embeddedDateRegex.exec(block)) !== null
      ) {
        const date = embeddedDateMatch[0].replace(/\//g, "-");

        if (!embeddedDates.includes(date)) {
          embeddedDates.push(date);
        }
      }

      // ==========================================================
      // 找可能的日期／星期／欄位屬性
      // ==========================================================

      const possibleColumnValues = [];

      const columnRegex =
        /(?:column|col|day|weekday|week_day|weekDay)[-_a-zA-Z0-9]*=["']([^"']+)["']/gi;

      let columnMatch;

      while ((columnMatch = columnRegex.exec(block)) !== null) {
        possibleColumnValues.push(columnMatch[1]);
      }

      // ==========================================================
      // 找所有 style
      // ==========================================================

      const styles = [];

      const styleRegex =
        /style=["']([^"']+)["']/gi;

      let styleMatch;

      while ((styleMatch = styleRegex.exec(block)) !== null) {
        const style = decode(styleMatch[1]);

        const left = style.match(
          /(?:^|;)\s*left\s*:\s*(-?\d+(?:\.\d+)?)\s*(px|%)?/i
        );

        const width = style.match(
          /(?:^|;)\s*width\s*:\s*(-?\d+(?:\.\d+)?)\s*(px|%)?/i
        );

        const transform = style.match(
          /translateX\s*\(\s*(-?\d+(?:\.\d+)?)\s*(px|%)?/i
        );

        styles.push({
          raw: style,

          left: left
            ? {
                value: Number(left[1]),
                unit: left[2] || null,
              }
            : null,

          width: width
            ? {
                value: Number(width[1]),
                unit: width[2] || null,
              }
            : null,

          translateX: transform
            ? {
                value: Number(transform[1]),
                unit: transform[2] || null,
              }
            : null,
        });
      }

      // ==========================================================
      // 找課程前方的父層結構
      // ==========================================================

      const before = scheduleHtml.slice(
        Math.max(0, start - 12000),
        start
      );

      const parentTags = [];

      const parentRegex =
        /<(div|section|td|li|article)[^>]*class=["']([^"']+)["'][^>]*>/gi;

      let parentMatch;

      while ((parentMatch = parentRegex.exec(before)) !== null) {
        parentTags.push({
          tag: parentMatch[1],
          className: parentMatch[2],
          index: parentMatch.index,
        });
      }

      // ==========================================================
      // 保存
      // ==========================================================

      classes.push({
        index: i,

        startTime,
        endTime,

        className,
        classroom,
        instructor,

        embeddedDates,

        possibleColumnValues,

        dataAttributes,

        styles,

        classNames: innerClassNames,

        nearbyParents: parentTags.slice(-20),

        text: text.slice(0, 900),

        htmlPreview: block.slice(0, 7000),
      });
    }

    // ============================================================
    // 6. 去除完全重複
    // ============================================================

    const uniqueClasses = [];

    const seen = new Set();

    for (const item of classes) {
      const key = [
        item.startTime,
        item.endTime,
        item.className,
        item.classroom,
        item.instructor,
        item.text,
      ].join("|");

      if (!seen.has(key)) {
        seen.add(key);
        uniqueClasses.push(item);
      }
    }

    // ============================================================
    // 7. 日期配對預覽
    // ============================================================

    const dateAssociationPreview =
      uniqueClasses.slice(0, 30).map((item) => {
        const candidateDates = [];

        for (const date of item.embeddedDates) {
          candidateDates.push({
            date,
            method: "embedded-date",
          });
        }

        return {
          index: item.index,

          time: `${item.startTime}-${item.endTime}`,

          className: item.className,

          instructor: item.instructor,

          classroom: item.classroom,

          candidateDates,

          possibleColumnValues:
            item.possibleColumnValues,

          styles: item.styles,

          nearbyParents:
            item.nearbyParents,
        };
      });

    // ============================================================
    // 8. 回傳結果
    // ============================================================

    return res.status(200).json({
      success: true,

      version: "worldgym-date-mapping-1",

      source: "World Gym Taiwan",

      branch: "台北統領",

      fetchedAt: new Date().toISOString(),

      htmlLength: html.length,

      dateCount: dates.length,

      dates,

      classCount: uniqueClasses.length,

      dateAssociationPreview,

      classes: uniqueClasses.slice(0, 20),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      version: "worldgym-date-mapping-1",

      error: error.message,

      stack: error.stack,
    });
  }
}
