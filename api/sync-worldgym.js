const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";

function getSnippet(html, index, before = 1000, after = 12000) {
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

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
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

    /*
     * =====================================================
     * 1. 找 schedule_area
     * =====================================================
     */

    const scheduleIndex = html.indexOf(
      'id="schedule_area"'
    );

    if (scheduleIndex === -1) {
      return res.status(200).json({
        success: false,
        message: "找不到 schedule_area",
        htmlLength: html.length
      });
    }

    /*
     * =====================================================
     * 2. 只分析真正的課表區域
     * =====================================================
     */

    const scheduleHtml = html.slice(
      scheduleIndex,
      Math.min(
        html.length,
        scheduleIndex + 150000
      )
    );

    /*
     * =====================================================
     * 3. 找 class_list
     * =====================================================
     */

    const classListMatches = collectMatches(
      scheduleHtml,
      /class=["'][^"']*class_list[^"']*["']/gi,
      100
    );

    /*
     * =====================================================
     * 4. 找 class_inbox
     * =====================================================
     */

    const classInboxMatches = collectMatches(
      scheduleHtml,
      /class=["'][^"']*class_inbox[^"']*["']/gi,
      100
    );

    /*
     * =====================================================
     * 5. 找課程時間
     * =====================================================
     */

    const timeMatches = collectMatches(
      scheduleHtml,
      /<div[^>]*class=["'][^"']*newclass_time[^"']*["'][^>]*>[\s\S]{0,500}?<\/div>/gi,
      100
    );

    /*
     * =====================================================
     * 6. 找課程名稱
     * =====================================================
     */

    const typeMatches = collectMatches(
      scheduleHtml,
      /<div[^>]*class=["'][^"']*newclass_type[^"']*["'][^>]*>[\s\S]{0,1500}?<\/div>/gi,
      100
    );

    /*
     * =====================================================
     * 7. 找教室
     * =====================================================
     */

    const classroomMatches = collectMatches(
      scheduleHtml,
      /class=["'][^"']*classroom[^"']*["'][^>]*>[\s\S]{0,1500}?<\/[^>]+>/gi,
      100
    );

    /*
     * =====================================================
     * 8. 找 teacher / instructor
     * =====================================================
     */

    const teacherMatches = collectMatches(
      scheduleHtml,
      /class=["'][^"']*(teacher|instructor)[^"']*["'][^>]*>[\s\S]{0,1500}?<\/[^>]+>/gi,
      100
    );

    /*
     * =====================================================
     * 9. 每一個 class_list 的 HTML 片段
     * =====================================================
     */

    const classListSamples =
      classListMatches.slice(0, 20).map(
        (item, index) => ({
          number: index + 1,
          relativeIndex: item.index,
          html: getSnippet(
            scheduleHtml,
            item.index,
            300,
            7000
          )
        })
      );

    /*
     * =====================================================
     * 10. 每一個 class_inbox 的 HTML 片段
     * =====================================================
     */

    const classInboxSamples =
      classInboxMatches.slice(0, 10).map(
        (item, index) => ({
          number: index + 1,
          relativeIndex: item.index,
          html: getSnippet(
            scheduleHtml,
            item.index,
            300,
            9000
          )
        })
      );

    /*
     * =====================================================
     * 11. 課表開頭 50,000 字
     * =====================================================
     */

    const scheduleBeginning =
      scheduleHtml.slice(0, 50000);

    /*
     * =====================================================
     * 12. 日期 daybox
     * =====================================================
     */

    const dayMatches = collectMatches(
      html,
      /<div[^>]*class=["'][^"']*daybox[^"']*["'][^>]*>[\s\S]{0,1500}?<\/div>/gi,
      30
    );

    /*
     * =====================================================
     * 回傳偵察資料
     * =====================================================
     */

    return res.status(200).json({
      success: true,
      source: "World Gym Taiwan",
      branch: "台北統領",
      status: response.status,
      htmlLength: html.length,

      scheduleIndex,

      scheduleHtmlLength:
        scheduleHtml.length,

      dayCount:
        dayMatches.length,

      days:
        dayMatches.map(item =>
          cleanText(item.match)
        ),

      classListCount:
        classListMatches.length,

      classInboxCount:
        classInboxMatches.length,

      timeCount:
        timeMatches.length,

      typeCount:
        typeMatches.length,

      classroomCount:
        classroomMatches.length,

      teacherCount:
        teacherMatches.length,

      timeMatches:
        timeMatches.slice(0, 30).map(
          item => item.match
        ),

      typeMatches:
        typeMatches.slice(0, 30).map(
          item => item.match
        ),

      classroomMatches:
        classroomMatches.slice(0, 30).map(
          item => item.match
        ),

      teacherMatches:
        teacherMatches.slice(0, 30).map(
          item => item.match
        ),

      classListSamples,

      classInboxSamples,

      scheduleBeginning
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "World Gym Sync 發生錯誤",
      error: error.message
    });
  }
}
