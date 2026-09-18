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
        error: `World Gym returned HTTP ${response.status}`,
      });
    }

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

    // ------------------------------------------------------------
    // 1. 找出所有日期
    // ------------------------------------------------------------

    const dateMatches = [];
    const dateRegex =
      /<input[^>]*id=["']day["'][^>]*value=["']([^"']+)["'][^>]*>/gi;

    let match;

    while ((match = dateRegex.exec(html)) !== null) {
      const date = match[1];

      if (!dateMatches.some((item) => item.date === date)) {
        dateMatches.push({
          date,
          index: match.index,
        });
      }
    }

    // ------------------------------------------------------------
    // 2. 找 schedule_area
    // ------------------------------------------------------------

    const scheduleStart = html.indexOf('id="schedule_area"');

    if (scheduleStart === -1) {
      return res.status(500).json({
        success: false,
        error: "找不到 schedule_area",
      });
    }

    const scheduleHtml = html.slice(scheduleStart);

    // ------------------------------------------------------------
    // 3. 找 class_list
    // ------------------------------------------------------------

    const classRegex =
      /<[^>]*class=["'][^"']*class_list[^"']*["'][^>]*>[\s\S]*?(?=<[^>]*class=["'][^"']*class_list[^"']*["']>|<\/div>\s*<\/div>\s*<\/div>)/gi;

    const rawClasses = [];

    let classMatch;

    while ((classMatch = classRegex.exec(scheduleHtml)) !== null) {
      const block = classMatch[0];

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

      const knownClasses = [
        "BODYCOMBAT®",
        "BODYPUMP®",
        "BODYBALANCE®",
        "BODYJAM®",
        "BODYSTEP®",
        "BODYATTACK®",
        "DANCE®",
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
        "Yo Chi",
        "Yoga Aerobics",
        "Interval",
        "Fat Burning",
        "World Ball",
        "Aero Power",
        "Freestyle Step",
        "Dance Party",
        "Aerobics Intro",
        "Functional Training",
        "Power Yoga",
        "Taichi Zen Martial Arts",
        "Yogalates",
        "Stretch Yoga",
        "Meridian Yoga",
        "Core Stability Enhancement Training",
        "Explosive Power Training",
        "Sandbag Boxing Training",
      ];

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

      const classroomPatterns = [
        "4F團體有氧教室",
        "3F飛輪教室",
        "2F團體有氧教室",
        "1F團體有氧教室",
        "團體有氧教室",
        "飛輪教室",
      ];

      for (const room of classroomPatterns) {
        if (text.includes(room)) {
          classroom = room;
          break;
        }
      }

      // ----------------------------------------------------------
      // 分店
      // ----------------------------------------------------------

      const storeMatch = text.match(
        /(Taipei Tonling|台北統領|Taipei [A-Za-z]+)/
      );

      const store = storeMatch ? storeMatch[1] : "Taipei Tonling";

      // ----------------------------------------------------------
      // 取得 HTML 屬性
      // ----------------------------------------------------------

      const openingTagMatch = block.match(/^<[^>]+>/);

      const attributes = {};

      if (openingTagMatch) {
        const attrRegex =
          /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=["']([^"']*)["']/g;

        let attrMatch;

        while ((attrMatch = attrRegex.exec(openingTagMatch[0])) !== null) {
          attributes[attrMatch[1]] = decode(attrMatch[2]);
        }
      }

      // ----------------------------------------------------------
      // 嘗試從 style / data 欄位取得日期或欄位位置
      // ----------------------------------------------------------

      let possibleDay = null;
      let possibleDate = null;
      let possibleColumn = null;

      const allAttributesText = JSON.stringify(attributes);

      const directDateMatch = allAttributesText.match(
        /20\d{2}[\/-]\d{2}[\/-]\d{2}/
      );

      if (directDateMatch) {
        possibleDate = directDateMatch[0].replace(/\//g, "-");
      }

      const dayMatch = allAttributesText.match(
        /(?:day|date|weekday|week|column)[^0-9]*(\d{1,2})/i
      );

      if (dayMatch) {
        possibleDay = Number(dayMatch[1]);
      }

      const styleMatch = allAttributesText.match(
        /(?:left|margin-left|translateX)[^0-9-]*(-?\d+(?:\.\d+)?)/i
      );

      if (styleMatch) {
        possibleColumn = Number(styleMatch[1]);
      }

      // ----------------------------------------------------------
      // 教練
      // ----------------------------------------------------------

      let instructor = null;

      const instructorCandidates = [
        "伊森",
        "鋼鋼",
        "謝秉瑜",
        "Daniel Wang",
        "小八",
        "翔翔 H",
        "翔翔H",
        "小智",
        "Vivian",
        "Kyle",
        "Torrance",
        "Benson",
        "Jin",
        "Teily",
        "Wayne",
        "EJ",
        "安妮",
        "Antonia",
        "Hsuan",
        "Calvin",
        "恬恬",
        "Xavier",
      ];

      for (const person of instructorCandidates) {
        if (text.includes(person)) {
          instructor = person;
          break;
        }
      }

      // ----------------------------------------------------------
      // 標記
      // ----------------------------------------------------------

      const exclusive = text.includes("獨家") || text.includes("Exclusive");

      const substitute =
        text.includes("代課") || text.includes("Substitute");

      rawClasses.push({
        startTime,
        endTime,
        className,
        classroom,
        instructor,
        store,
        exclusive,
        substitute,
        possibleDate,
        possibleDay,
        possibleColumn,
        attributes,
        text: text.slice(0, 1200),
      });
    }

    // ------------------------------------------------------------
    // 4. 去除完全重複資料
    // ------------------------------------------------------------

    const classes = [];

    const seen = new Set();

    for (const item of rawClasses) {
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
        classes.push(item);
      }
    }

    // ------------------------------------------------------------
    // 5. 產生日期清單
    // ------------------------------------------------------------

    const dates = dateMatches.map((item) => item.date);

    // ------------------------------------------------------------
    // 6. 回傳
    // ------------------------------------------------------------

    return res.status(200).json({
      success: true,
      version: "worldgym-sync-1",
      source: "World Gym Taiwan",
      branch: "台北統領",

      fetchedAt: new Date().toISOString(),

      htmlLength: html.length,

      dateCount: dates.length,
      dates,

      classCount: classes.length,

      classes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}
