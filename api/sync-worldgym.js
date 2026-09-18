const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

function getMatches(html, regex, limit = 100) {
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null && results.length < limit) {
    results.push({
      index: match.index,
      match: match[0]
    });
  }

  return results;
}

function getSnippet(html, index, before = 3000, after = 12000) {
  const start = Math.max(0, index - before);
  const end = Math.min(html.length, index + after);

  return html.slice(start, end);
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

    // 找 daybox
    const dayboxMatches = getMatches(
      html,
      /class=["'][^"']*daybox[^"']*["']/gi,
      20
    );

    // 找 newclass_time
    const newclassTimeMatches = getMatches(
      html,
      /class=["'][^"']*newclass_time[^"']*["']/gi,
      20
    );

    // 找 newclass_type
    const newclassTypeMatches = getMatches(
      html,
      /class=["'][^"']*newclass_type[^"']*["']/gi,
      20
    );

    // 找 classroom
    const classroomMatches = getMatches(
      html,
      /class=["'][^"']*classroom[^"']*["']/gi,
      20
    );

    // 找日期文字
    const dateMatches = getMatches(
      html,
      /2026[\/.-]\d{1,2}[\/.-]\d{1,2}|Sep\.\s*\d{1,2}/gi,
      50
    );

    // 取前幾個 daybox 的完整附近內容
    const dayboxSamples = dayboxMatches.slice(0, 7).map((item, i) => ({
      number: i + 1,
      index: item.index,
      match: item.match,
      html: getSnippet(html, item.index, 1000, 16000)
    }));

    // 取第一批 newclass_time 周邊 HTML
    const timeSamples = newclassTimeMatches.slice(0, 10).map((item, i) => ({
      number: i + 1,
      index: item.index,
      match: item.match,
      html: getSnippet(html, item.index, 1500, 5000)
    }));

    return res.status(200).json({
      success: true,
      source: "World Gym Taiwan",
      branch: "台北統領",
      status: response.status,
      htmlLength: html.length,

      dateMatches: dateMatches.map(x => x.match),

      dayboxCount: dayboxMatches.length,
      dayboxMatches: dayboxMatches.map(x => x.match),
      dayboxSamples,

      newclassTimeCount: newclassTimeMatches.length,
      newclassTimeMatches: newclassTimeMatches.map(x => x.match),

      newclassTypeCount: newclassTypeMatches.length,
      newclassTypeMatches: newclassTypeMatches.map(x => x.match),

      classroomCount: classroomMatches.length,
      classroomMatches: classroomMatches.map(x => x.match),

      timeSamples
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "World Gym Sync 發生錯誤",
      error: error.message
    });
  }
}
