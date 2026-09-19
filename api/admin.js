const SUPABASE_URL = process.env.SUPABASE_URL || "https://wylfqwzictkepnefwksx.supabase.co";

function serviceHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}

async function requireAdmin(req, serviceKey) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("請先登入");
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user.id) throw new Error("登入狀態已失效");
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`, { headers: serviceHeaders(serviceKey) });
  const profiles = await profileResponse.json().catch(() => []);
  const isConfiguredAdmin = String(user.email || "").toLowerCase() === "pkddqq@gmail.com";
  if (profiles[0]?.is_admin !== true && !isConfiguredAdmin) throw new Error("沒有後台管理權限");
  return user;
}

async function rest(serviceKey, path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: serviceHeaders(serviceKey, options.headers) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "資料庫操作失敗");
  return { response, payload };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(503).json({ error: "後台尚未完成安全設定" });
  try {
    const actor = await requireAdmin(req, serviceKey);
    const { action, query = "", id } = req.body || {};
    if (action === "members") {
      const term = String(query).trim().slice(0, 40).replace(/[,*()]/g, "");
      const filter = term ? `&display_name=ilike.*${encodeURIComponent(term)}*` : "";
      const { response, payload } = await rest(serviceKey, `profiles?select=id,display_name,xp,streak_days,created_at&order=created_at.desc&limit=100${filter}`, { headers: { Prefer: "count=exact" } });
      const total = Number(String(response.headers.get("content-range") || "").split("/")[1]) || 0;
      return res.status(200).json({ total, members: payload || [] });
    }
    if (action === "delete_member") {
      if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) throw new Error("會員識別碼不正確");
      if (id === actor.id) throw new Error("不能移除目前登入的管理員");
      const deletion = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: serviceHeaders(serviceKey) });
      if (!deletion.ok) throw new Error("無法移除會員帳號");
      await Promise.all([rest(serviceKey, `profiles?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }), rest(serviceKey, `workouts?user_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }), rest(serviceKey, `user_badges?user_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })]);
      return res.status(200).json({ success: true });
    }
    if (action === "clear_statistics") {
      await Promise.all([rest(serviceKey, "workouts?id=not.is.null", { method: "DELETE" }), rest(serviceKey, "search_events?id=not.is.null", { method: "DELETE" }), rest(serviceKey, "profiles?id=not.is.null", { method: "PATCH", body: JSON.stringify({ xp: 0, streak_days: 0 }) })]);
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "未知的後台操作" });
  } catch (error) {
    return res.status(/權限|登入/.test(error.message) ? 403 : 400).json({ error: error.message || "後台操作失敗" });
  }
}
