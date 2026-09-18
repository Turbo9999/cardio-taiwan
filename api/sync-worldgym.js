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

    const html = await response.text();

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

    function getAttributes(tag) {
      const attrs = {};

      const regex =
        /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g;

      let match;

      while ((match = regex.exec(tag)) !== null) {
        attrs[match[1]] = decode(match[3]);
      }

      return attrs;
    }

    // ------------------------------------------------------------
    // 日期
    // ------------------------------------------------------------

    const dates = [];

    const dateRegex =
      /<input[^>]*id=["']day["'][^>]*value=["']([^"']+)["'][^>]*>/gi;

    let dateMatch;

    while ((dateMatch = dateRegex.exec(html)) !== null) {
      const date = dateMatch[1];

      if (!dates.includes(date)) {
        dates.push(date);
      }
    }

    // ------------------------------------------------------------
    // 找目前課表
    // ------------------------------------------------------------

    const scheduleIndex = html.indexOf('id="schedule_area"');

    if (scheduleIndex === -1) {
      return res.status(500).json({
        success: false,
        error: "找不到 schedule_area",
      });
    }

    const scheduleHtml = html.slice(scheduleIndex);

    // ------------------------------------------------------------
    // 課程名稱
    // ------------------------------------------------------------

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
      "Interval",
      "Fat Burning",
      "World Ball",
      "Aero Power",
      "Freestyle Step",
      "Dance Party",
      "Aerobics Intro",
      "Taichi Zen Martial Arts",
      "Yogalates",
      "Hip Hop",
      "Double Pop",
      "Restorative Yoga",
      "Meridian Yoga",
      "Power Yoga",
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

    // ------------------------------------------------------------
    // 找 class_list
    // ------------------------------------------------------------

    const classRegex =
      /<[^>]*class=["'][^"']*\bclass_list\b[^"']*["'][^>]*>[\s\S]*?(?=<[^>]*class=["'][^"']*\bclass_list\b[^"']*["']>|$)/gi;

    const classes = [];

    let classMatch;

    while ((classMatch = classRegex.exec(scheduleHtml)) !== null) {
      const block = classMatch[0];

      const text = stripHtml(block);

      const timeMatch = text.match(
        /\b([0-2]\d:[0-5]\d)\s*\|\s*([0-2]\d:[0-5]\d)\b/
      );

      if (!timeMatch) {
        continue;
      }

      let className = null;

      for (const name of knownClasses) {
        if (text.includes(name)) {
          className = name;
          break;
        }
      }

      let classroom = null;

      for (const room of classroomPatterns) {
        if (text.includes(room)) {
          classroom = room;
          break;
        }
      }

      // ----------------------------------------------------------
      // 嘗試取得教練
      // ----------------------------------------------------------

      let instructor = null;

      const instructorText = text
        .replace(timeMatch[0], "")
        .replace(className || "", "")
        .replace(classroom || "", "");

      const instructorParts = instructorText
        .split(/\s+/)
        .filter(Boolean);

      if (instructorParts.length > 0) {
        instructor = instructorParts[instructorParts.length - 1];
      }

      // ----------------------------------------------------------
      // ⭐ 找 class_ribo
      // ----------------------------------------------------------

      const riboMatches = [];

      const riboRegex =
        /<[^>]*class=["'][^"']*\bclass_ribo\b[^"']*["'][^>]*>/gi;

      let riboMatch;

      while ((riboMatch = riboRegex.exec(block)) !== null) {
        riboMatches.push({
          tag: riboMatch[0],
          attributes: getAttributes(riboMatch[0]),
        });
      }

      // ----------------------------------------------------------
      // ⭐ 找所有可能與位置有關的元素
      // ----------------------------------------------------------

      const positionalElements = [];

      const tagRegex =
        /<(div|span|a|li|td|section|article|p)[^>]*>/gi;

      let tagMatch;

      while ((tagMatch = tagRegex.exec(block)) !== null) {
        const tag = tagMatch[0];
        const attributes = getAttributes(tag);

        const attrText = JSON.stringify(attributes).toLowerCase();

        const interesting =
          attrText.includes("left") ||
          attrText.includes("top") ||
          attrText.includes("width") ||
          attrText.includes("translate") ||
          attrText.includes("column") ||
          attrText.includes("day") ||
          attrText.includes("date") ||
          attrText.includes("week") ||
          attrText.includes("style") ||
          attrText.includes("data-");

        if (interesting) {
          positionalElements.push({
            tag,
            attributes,
          });
        }
      }

      // ----------------------------------------------------------
      // 找 style 裡面的 left / width / translateX
      // ----------------------------------------------------------

      const styles = [];

      const styleRegex =
        /style=["']([^"']+)["']/gi;

      let styleMatch;

      while ((styleMatch = styleRegex.exec(block)) !== null) {
        const style = decode(styleMatch[1]);

        const left = style.match(
          /(?:left|margin-left)\s*:\s*(-?\d+(?:\.\d+)?)\s*(px|%|rem)?/i
        );

        const width = style.match(
          /width\s*:\s*(-?\d+(?:\.\d+)?)\s*(px|%|rem)?/i
        );

        const translate = style.match(
          /translateX\s*\(\s*(-?\d+(?:\.\d+)?)\s*(px|%|rem)?/i
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
          translateX: translate
            ? {
                value: Number(translate[1]),
                unit: translate[2] || null,
              }
            : null,
        });
      }

      classes.push({
        startTime: timeMatch[1],
        endTime: timeMatch[2],
        className,
        classroom,
        instructor,

        text: text.slice(0, 1000),

        ribo: riboMatches,

        positionalElements,

        styles,

        // 方便我們確認原始 HTML
        htmlPreview: block.slice(0, 5000),
      });
    }

    // ------------------------------------------------------------
    // 去重
    // ------------------------------------------------------------

    const unique = [];

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
        unique.push(item);
      }
    }

    // ------------------------------------------------------------
    // 統計位置資訊
    // ------------------------------------------------------------

    const styleSummary = [];

    for (const item of unique) {
      for (const style of item.styles) {
        if (
          style.left ||
          style.width ||
          style.translateX
        ) {
          styleSummary.push({
            className: item.className,
            time: `${item.startTime}-${item.endTime}`,
            instructor: item.instructor,
            style,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      version: "worldgym-position-analysis-1",

      source: "World Gym Taiwan",
      branch: "台北統領",

      fetchedAt: new Date().toISOString(),

      htmlLength: html.length,

      dateCount: dates.length,
      dates,

      classCount: unique.length,

      classes: unique.slice(0, 30),

      styleSummary: styleSummary.slice(0, 50),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}
