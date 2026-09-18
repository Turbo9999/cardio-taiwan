const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

function getSnippet(html, index, before = 2500, after = 8000) {
  const start = Math.max(0, index - before);
  const end = Math.min(html.length, index + after);
  return html.slice(start, end);
}

function collectMatches(html, regex, limit = 100) {
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    results.push({
      index: match.index,
      match: match[0]
    });

    if (results.length >= limit) break;
  }

  return results;
}

export default async function handler(req, res) {
  try {
    const response = await fetch(WORLD_GYM_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CARDIO-TAIWAN/1.0)"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "無法取得 World Gym 官方課表",
        status: response.status
      });
    }

    const html = await response.text();

    // 找課表區域
    const scheduleIndex = html.indexOf('id="schedule_area"');

    // 找日期切換相關內容
    const dayboxIndex = html.indexOf('class="daybox"');

    // 找可能控制日期切換的 JavaScript / Ajax 關鍵字
    const keywordRegex =
      /(schedule_area|daybox|changeSchedul|dayclick|dayselect|ajax|schedule|aerobic_class_schedule)/gi;

    const keywordMatches = collectMatches(
      html,
      keywordRegex,
      80
    );

    // 找真正的課程時間 HTML
    const timeRegex =
      /<div[^>]*class=["'][^"']*newclass_time[^"']*["'][^>]*>[\s\S]{0,500}?<\/div>/gi;

    const timeMatches = collectMatches(
      html,
      timeRegex,
      20
    );

    // 找課程名稱相關區塊
    const typeRegex =
      /<div[^>]*class=["'][^"']*newclass_type[^"']*["'][^>]*>[\s\S]{0,1000}?<\/div>/gi;

    const typeMatches = collectMatches(
      html,
      typeRegex,
      20
    );

    // 找可能的 AJAX URL
    const urlRegex =
      /["']([^"']*(?:schedule|aerobic|class)[^"']*)["']/gi;

    const urlMatches = collectMatches(
      html,
      urlRegex,
      100
    );

    // 找日期切換按鈕附近的完整 HTML
    const daySamples = [];

    const dayRegex =
      /<[^>]*class=["'][^"']*daybox[^"']*["'][^>]*>/gi;

    let dayMatch;
    let dayCount = 0;

    while (
      (dayMatch = dayRegex.exec(html)) !== null &&
      dayCount < 5
    ) {
      daySamples.push({
        number: dayCount + 1,
        index: dayMatch.index,
        html: getSnippet(
          html,
          dayMatch.index,
          1000,
          5000
        )
      });

      dayCount++;
    }

    // 課表區域附近 HTML
    const scheduleSample =
      scheduleIndex >= 0
        ? html.slice(
            scheduleIndex,
            Math.min(
              html.length,
              scheduleIndex + 30000
            )
          )
        : null;

    return res.status(200).json({
      success: true,
      source: "World Gym Taiwan",
      branch: "台北統領",
      status: response.status,
      htmlLength: html.length,

      scheduleIndex,
      dayboxIndex,

      timeCount: timeMatches.length,
      timeMatches: timeMatches.map(
        item => item.match
      ),

      typeCount: typeMatches.length,
      typeMatches: typeMatches.map(
        item => item.match
      ),

      daySamples,

      interestingUrls: [
        ...new Set(
          urlMatches.map(item => item.match)
        )
      ].slice(0, 100),

      keywordMatches: keywordMatches.map(
        item => ({
          index: item.index,
          match: item.match,
          snippet: getSnippet(
            html,
            item.index,
            500,
            1500
          )
        })
      ),

      scheduleSample
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "World Gym Sync 發生錯誤",
      error: error.message
    });
  }
}
