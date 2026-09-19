const PUBLIC_BRANCH_LIST_URL =
  "https://www.worldgymtaiwan.com/find-a-club";

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // This is the same public form request used by World Gym's Find a Club page.
    const response = await fetch(PUBLIC_BRANCH_LIST_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (compatible; CARDIO-TAIWAN schedule sync)",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({
        func: "qryBranchMark",
        location_lat: "",
        location_long: "",
        qry_keyWord: "",
      }),
    });

    if (!response.ok) throw new Error(`World Gym HTTP ${response.status}`);
    const payload = await response.json();
    const branchList = payload?.data?.branchList;

    if (!payload?.status || !Array.isArray(branchList)) {
      throw new Error("World Gym returned an invalid branch list");
    }

    const seen = new Set();
    const branches = branchList
      .map((item) => ({
        name: item.branch_show_name,
        slug: item.branch_name_e,
        branchNo: item.branch_no,
        series: item.branch_series_name,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      }))
      .filter((item) => {
        if (!item.name || !/^[a-z0-9-]+$/i.test(item.slug || "")) return false;
        const key = `${item.name}|${item.slug}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ success: true, count: branches.length, branches });
  } catch (error) {
    return res.status(502).json({ success: false, error: error.message });
  }
}
