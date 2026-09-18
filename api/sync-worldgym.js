export default async function handler(req, res) {
  const url =
    "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
    });

    const html = await response.text();

    // ------------------------------------------------------------
    // 基本資訊
    // ------------------------------------------------------------

    const clean = (text) =>
      text
        ? text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\s+/g, " ")
            .trim()
        : "";

    const decode = (text) => {
      return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#x2F;/gi, "/");
    };

    // ------------------------------------------------------------
    // 1. 抓所有日期
    // ------------------------------------------------------------

    const days = [];

    const dayRegex =
      /<input[^>]*id=["']day["'][^>]*value=["']([^"']+)["'][^>]*>/gi;

    let dayMatch;

    while ((dayMatch = dayRegex.exec(html)) !== null) {
      days.push({
        index: dayMatch.index,
        date: dayMatch[1],
      });
    }

    // 去除重複日期
    const uniqueDays = [];
    const seenDates = new Set();

    for (const day of days) {
      if (!seenDates.has(day.date)) {
        seenDates.add(day.date);
        uniqueDays.push(day);
      }
    }

    // ------------------------------------------------------------
    // 2. 找 schedule_area
    // ------------------------------------------------------------

    const scheduleIndex = html.indexOf('id="schedule_area"');

    // ------------------------------------------------------------
    // 3. 找所有 sch_classbox
    // ------------------------------------------------------------

    const classboxRegex =
      /<[^>]*class=["'][^"']*sch_classbox[^"']*["'][^>]*>/gi;

    const classboxes = [];

    let boxMatch;

    while ((boxMatch = classboxRegex.exec(html)) !== null) {
      const start = boxMatch.index;

      // 往後找下一個 sch_classbox
      const nextMatch = html.slice(start + 1).search(
        /<[^>]*class=["'][^"']*sch_classbox[^"']*["'][^>]*>/i
      );

      const end =
        nextMatch === -1
          ? Math.min(start + 30000, html.length)
          : start + 1 + nextMatch;

      const block = html.slice(start, end);

      classboxes.push({
        index: start,
        length: block.length,
        openingTag: boxMatch[0],
        text: clean(block).slice(0, 1500),
        datesBefore: uniqueDays
          .filter((d) => d.index < start)
          .slice(-10)
          .map((d) => d.date),
      });
    }

    // ------------------------------------------------------------
    // 4. 分析每一個 sch_classbox 裡面有多少 class_list
    // ------------------------------------------------------------

    const inspectBoxes = classboxes.slice(0, 50).map((box, boxIndex) => {
      const start = box.index;

      const nextBox = classboxes[boxIndex + 1];

      const end = nextBox
        ? nextBox.index
        : Math.min(start + 30000, html.length);

      const block = html.slice(start, end);

      // class_list
      const classListRegex =
        /<[^>]*class=["'][^"']*class_list[^"']*["'][^>]*>/gi;

      const classLists = [];

      let classListMatch;

      while ((classListMatch = classListRegex.exec(block)) !== null) {
        const clsStart = classListMatch.index;

        const snippet = block.slice(
          clsStart,
          Math.min(clsStart + 5000, block.length)
        );

        const text = clean(snippet);

        // 找時間
        const timeMatch = text.match(
          /\b([0-2]\d:[0-5]\d)\s*\|\s*([0-2]\d:[0-5]\d)\b/
        );

        // 找教室
        const roomMatch = text.match(
          /(4F團體有氧教室|3F飛輪教室|團體有氧教室|飛輪教室)/
        );

        classLists.push({
          index: clsStart,
          time: timeMatch
            ? {
                start: timeMatch[1],
                end: timeMatch[2],
              }
            : null,
          classroom: roomMatch ? roomMatch[1] : null,
          text: text.slice(0, 800),
        });
      }

      // ----------------------------------------------------------
      // 嘗試從 classbox 的 HTML 找日期
      // ----------------------------------------------------------

      const datesInside = [];

      const datePatterns = [
        /\b20\d{2}\/\d{2}\/\d{2}\b/g,
        /\b20\d{2}-\d{2}-\d{2}\b/g,
      ];

      for (const pattern of datePatterns) {
        const matches = block.match(pattern) || [];

        for (const date of matches) {
          if (!datesInside.includes(date)) {
            datesInside.push(date);
          }
        }
      }

      // ----------------------------------------------------------
      // 找 classbox 上的 id / data-* / name 等屬性
      // ----------------------------------------------------------

      const attributes = {};

      const openingTag = box.openingTag;

      const attrRegex =
        /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=["']([^"']*)["']/g;

      let attrMatch;

      while ((attrMatch = attrRegex.exec(openingTag)) !== null) {
        const key = attrMatch[1];
        const value = decode(attrMatch[2]);

        attributes[key] = value;
      }

      return {
        boxIndex,
        htmlIndex: start,
        htmlLength: block.length,
        attributes,
        datesInside,
        datesBefore: box.datesBefore,
        classListCount: classLists.length,
        firstClasses: classLists.slice(0, 8),
        textPreview: clean(block).slice(0, 1500),
      };
    });

    // ------------------------------------------------------------
    // 5. 找所有 type_box
    // ------------------------------------------------------------

    const typeBoxRegex =
      /<[^>]*class=["'][^"']*type_box[^"']*["'][^>]*>/gi;

    const typeBoxes = [];

    let typeMatch;

    while ((typeMatch = typeBoxRegex.exec(html)) !== null) {
      const start = typeMatch.index;

      const snippet = html.slice(
        start,
        Math.min(start + 10000, html.length)
      );

      typeBoxes.push({
        index: start,
        openingTag: typeMatch[0],
        text: clean(snippet).slice(0, 1200),
      });
    }

    // ------------------------------------------------------------
    // 6. 找 schedule_area 後的前幾個 sch_classbox 原始片段
    // ------------------------------------------------------------

    let schedulePreview = null;

    if (scheduleIndex !== -1) {
      schedulePreview = clean(
        html.slice(scheduleIndex, scheduleIndex + 20000)
      ).slice(0, 6000);
    }

    // ------------------------------------------------------------
    // 7. 找 class_list 的總數
    // ------------------------------------------------------------

    const totalClassLists = (
      html.match(
        /<[^>]*class=["'][^"']*class_list[^"']*["'][^>]*>/gi
      ) || []
    ).length;

    // ------------------------------------------------------------
    // 8. 回傳診斷資料
    // ------------------------------------------------------------

    return res.status(200).json({
      success: true,
      version: "v14",
      source: "World Gym Taiwan",
      branch: "台北統領",
      status: response.status,
      htmlLength: html.length,

      dayCount: uniqueDays.length,
      days: uniqueDays,

      scheduleIndex,

      totalClassLists,

      schClassboxCount: classboxes.length,

      typeBoxCount: typeBoxes.length,

      classboxes: inspectBoxes,

      typeBoxes: typeBoxes.slice(0, 20),

      schedulePreview,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      version: "v14",
      error: error.message,
      stack: error.stack,
    });
  }
}
