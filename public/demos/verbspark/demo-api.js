// Portfolio demo: the app runs without its Node/OpenAI backend.
// Accounts and progress are kept in this browser only; feedback uses the built-in local engine.
(function () {
  var KEY = "verbspark-demo";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function json(status, body) {
    return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json" } });
  }
  var realFetch = window.fetch.bind(window);

  window.fetch = function (input, options) {
    options = options || {};
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname.indexOf("/api/") !== 0) return realFetch(input, options);

    var path = url.pathname;
    var method = (options.method || "GET").toUpperCase();
    var s = load();
    var body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; } catch (e) {}

    return new Promise(function (r) { setTimeout(r, 120); }).then(function () {
      if (path === "/api/config") throw new TypeError("demo: no AI server"); // -> local mode
      if (path === "/api/auth/session") return json(200, { ok: true, authenticated: !!s.user, user: s.user || null });
      if (path === "/api/auth/register" || path === "/api/auth/login") {
        var email = String(body.email || "").trim().toLowerCase();
        if (!email || !body.password) return json(400, { ok: false, error: "Enter email and password." });
        s.user = { id: "demo-user", email: email, displayName: body.displayName || (s.user && s.user.displayName) || email.split("@")[0] };
        save(s);
        return json(path.endsWith("register") ? 201 : 200, { ok: true, user: s.user });
      }
      if (path === "/api/auth/logout") { s.user = null; save(s); return json(200, { ok: true }); }
      if (path === "/api/state" && method === "GET") {
        if (!s.user) return json(401, { ok: false, error: "Sign in first." });
        return json(200, { ok: true, state: s.state || null, updatedAt: s.updatedAt || 0 });
      }
      if (path === "/api/state" && method === "PUT") {
        if (!s.user) return json(401, { ok: false, error: "Sign in first." });
        s.state = body.state || null;
        s.updatedAt = Math.max(Date.now(), Number(body.updatedAt) || 0);
        save(s);
        return json(200, { ok: true, updatedAt: s.updatedAt });
      }
      if (path === "/api/feedback") return json(503, { ok: false, error: "Demo mode.", fallbackAvailable: true });
      return json(404, { ok: false, error: "Not found" });
    });
  };
})();
