const WORLD_GYM_BASE_URL = "https://www.worldgymtaiwan.com/find-a-club";
const DEFAULT_BRANCH_SLUG = "taipei-tonling";

const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function worldGymHeaders() {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": "Mozilla/5.0 (compatible; CARDIO-TAIWAN schedule sync; +https://cardio-taiwan.vercel.app)",
    "X-Requested-With": "XMLHttpRequest",
  };
}

function toIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(value)) return null;
  return value.replace(/\//g, "-");
}

function toWorldGymDate(isoDate) {
  return isoDate.replace(/-/g, "/");
}

function isIsoDate(value) {
  return Boolean(toIsoDate(value));
}

function sourceUrlForBranch(branchSlug) {
  if (!/^[a-z0-9-]+$/.test(branchSlug)) {
    throw new Error("Invalid World Gym branch");
  }
  return `${WORLD_GYM_BASE_URL}/${branchSlug}/aerobics-class-schedule`;
}

async function getPublicBranchConfig(branchSlug) {
  const sourceUrl = sourceUrlForBranch(branchSlug);
  const response = await fetch(sourceUrl, {
    headers: {
      ...worldGymHeaders(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) throw new Error(`World Gym HTTP ${response.status} for branch page`);
  const html = await response.text();
  const branchNo = html.match(
    /<input[^>]*id=["']current_branch_no["'][^>]*value=["']([^"']+)["'][^>]*>/i
  )?.[1];

  if (!branchNo) throw new Error("World Gym branch page did not provide current_branch_no");
  return { sourceUrl, branchNo };
}

async function postPublicSchedule(sourceUrl, branchNo, func, values = {}) {
  const body = new URLSearchParams({
    func,
    first_date: "",
    last_date: "",
    scheduleType: "week",
    isMobile: "N",
    current_branch_no: branchNo,
    ...values,
  });
  const response = await fetch(sourceUrl, {
    method: "POST",
    // This is the public page's own form action, not a member-only API.
    headers: worldGymHeaders(),
    body,
  });

  if (!response.ok) throw new Error(`World Gym HTTP ${response.status} for ${func}`);
  const payload = await response.json();
  if (!payload || payload.status !== true || payload.data == null) {
    throw new Error(`World Gym returned an invalid ${func} response`);
  }
  return payload.data;
}

// World Gym renders this title from queryCalendarDate. We use it only to
// select the displayed week; every class date below comes from class_date.
export function datesFromPublicCalendar(calendarLabel, dateList) {
  const match = String(calendarLabel).match(
    /^([A-Z][a-z]{2})\.\s*(\d{1,2})-(?:([A-Z][a-z]{2})\.\s*)?(\d{1,2}),\s*(\d{4})$/
  );
  if (!match || !MONTHS[match[1]]) {
    throw new Error(`Unexpected World Gym calendar label: ${calendarLabel}`);
  }

  const [, firstMonthName, firstDay, explicitLastMonthName, lastDay, year] = match;
  const lastMonthName = explicitLastMonthName || firstMonthName;
  if (!MONTHS[lastMonthName]) throw new Error(`Unexpected World Gym calendar label: ${calendarLabel}`);
  const lastDate = `${year}-${MONTHS[lastMonthName]}-${lastDay.padStart(2, "0")}`;
  const availableDates = dateList.map((item) => toIsoDate(item.full_date)).filter(Boolean);
  const lastIndex = availableDates.indexOf(lastDate);
  // The date list is also returned by World Gym. Selecting the closest matching
  // start date before the explicit end date handles a Dec.-Jan. display without
  // inventing a year for the first date.
  const firstSuffix = `-${MONTHS[firstMonthName]}-${firstDay.padStart(2, "0")}`;
  const firstIndex = availableDates.findIndex(
    (date, index) => index <= lastIndex && date.endsWith(firstSuffix)
  );
  if (firstIndex < 0 || lastIndex < firstIndex) {
    throw new Error("World Gym calendar range is not present in its date list");
  }
  return availableDates.slice(firstIndex, lastIndex + 1);
}

function mapClass(item) {
  const date = toIsoDate(item.class_date);
  if (!date || !item.class_stime || !item.class_etime || !item.other_class_name) return null;

  return {
    // Date is supplied by World Gym's public JSON response; it is never
    // inferred from card position, weekday, or ordering.
    date,
    startTime: item.class_stime,
    endTime: item.class_etime,
    className: item.other_class_name,
    classroom: item.room_name || null,
    instructor: item.teacher_name || null,
    substitute: item.is_sub === "Y",
    exclusive: item.exclusive_flag === "Y",
    paid: item.pay_flag === "Y",
    category: item.category_m_no || null,
    classId: item.class_uid || null,
    classUrl: item.aeb_class_url || null,
    branchNo: item.branch_no || null,
    branchName: item.branch_name || null,
  };
}

async function getWeekSchedule(config) {
  const [calendarLabel, dateList] = await Promise.all([
    postPublicSchedule(config.sourceUrl, config.branchNo, "queryCalendarDate"),
    postPublicSchedule(config.sourceUrl, config.branchNo, "queryNewDateList"),
  ]);
  if (!Array.isArray(dateList)) throw new Error("World Gym returned an invalid date list");
  const dates = datesFromPublicCalendar(calendarLabel, dateList);
  const data = await postPublicSchedule(config.sourceUrl, config.branchNo, "queryWeekSchedule", {
    first_date: toWorldGymDate(dates[0]),
    last_date: toWorldGymDate(dates[dates.length - 1]),
  });
  if (!Array.isArray(data)) throw new Error("World Gym returned an invalid week schedule");
  return { dates, data };
}

async function getDaySchedule(config, date) {
  const data = await postPublicSchedule(config.sourceUrl, config.branchNo, "queryDaySchedule", {
    first_date: toWorldGymDate(date),
    scheduleType: "day",
  });
  if (!Array.isArray(data)) throw new Error("World Gym returned an invalid day schedule");
  return { dates: [date], data };
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const requestedDate = typeof req.query?.date === "string" ? req.query.date : null;
  const branchSlug = typeof req.query?.branch === "string" ? req.query.branch : DEFAULT_BRANCH_SLUG;
  if (requestedDate && !isIsoDate(requestedDate)) {
    return res.status(400).json({
      success: false,
      error: "date must use YYYY-MM-DD, for example 2026-09-17",
    });
  }

  try {
    const config = await getPublicBranchConfig(branchSlug);
    const schedule = requestedDate
      ? await getDaySchedule(config, requestedDate)
      : await getWeekSchedule(config);
    const classes = schedule.data.map(mapClass).filter(Boolean);
    const branchName = classes.find((item) => item.branchName)?.branchName || "Taipei Tonling";

    return res.status(200).json({
      success: true,
      source: {
        provider: "World Gym Taiwan public website",
        endpoint: config.sourceUrl,
        dateField: "class_date",
      },
      branch: branchName,
      week: { start: schedule.dates[0], end: schedule.dates[schedule.dates.length - 1] },
      classCount: classes.length,
      classes,
    });
  } catch (error) {
    return res.status(502).json({ success: false, error: error.message });
  }
}
