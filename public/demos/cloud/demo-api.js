// Portfolio demo: Campus Cloud without its Node server.
// Any login/password works; files live only in this browser tab (uploads are never sent anywhere).
(function () {
  var KEY = "campus-cloud-demo";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ user: s.user, files: s.files }));
    } catch (e) {}
  }
  var s = load();
  var blobs = {}; // id -> object URL for files uploaded in this tab

  function uid() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ (Math.random() * 16) >> (c / 4)).toString(16);
    });
  }
  function seed() {
    if (s.files) return;
    var now = Date.now();
    function f(name, size, type, hoursAgo) {
      return { id: uid(), name: name, size: size, type: type, uploadedAt: new Date(now - hoursAgo * 3600e3).toISOString() };
    }
    s.files = [
      f("Курсовая работа.docx", 184320, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 2),
      f("Расписание на семестр.xlsx", 24576, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 26),
      f("Презентация проекта.pdf", 2457600, "application/pdf", 50),
      f("photo_2026-11-20.jpg", 1843200, "image/jpeg", 140),
      f("Конспект лекций.txt", 9216, "text/plain", 300)
    ];
    save(s);
  }
  function pub(m) {
    var demoText = "Демо-файл из портфолио Campus Cloud: " + m.name;
    return {
      id: m.id, name: m.name, size: m.size, type: m.type, uploadedAt: m.uploadedAt,
      downloadUrl: blobs[m.id] || "data:text/plain;charset=utf-8," + encodeURIComponent(demoText)
    };
  }
  function json(status, body) {
    return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json" } });
  }
  function apiPath(u) {
    var p = new URL(u, location.href).pathname;
    var i = p.indexOf("/api/");
    return i === -1 ? null : p.slice(i);
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, options) {
    options = options || {};
    var path = apiPath(typeof input === "string" ? input : input.url);
    if (!path) return realFetch(input, options);
    var method = (options.method || "GET").toUpperCase();
    var body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; } catch (e) {}

    return new Promise(function (r) { setTimeout(r, 150); }).then(function () {
      if (path === "/api/health") return json(200, { status: "ok" });
      if (path === "/api/register" || path === "/api/login") {
        var login = String(body.login || "").trim();
        if (login.length < 3 || String(body.password || "").length < 4) {
          return json(400, { error: "Логин от 3 символов, пароль от 4." });
        }
        s.user = { id: "demo", login: login, createdAt: new Date().toISOString() };
        seed();
        save(s);
        return json(path === "/api/register" ? 201 : 200, { user: s.user });
      }
      if (path === "/api/logout") { s.user = null; save(s); return json(200, { message: "Ты вышел из аккаунта." }); }
      if (path === "/api/me") return s.user ? json(200, { user: s.user }) : json(401, { error: "Сессия истекла." });
      if (!s.user) return json(401, { error: "Сессия истекла." });
      if (path === "/api/files" && method === "GET") return json(200, { files: s.files.map(pub) });
      if (path.indexOf("/api/files/") === 0 && method === "DELETE") {
        var id = path.split("/").pop();
        s.files = s.files.filter(function (x) { return x.id !== id; });
        if (blobs[id]) { URL.revokeObjectURL(blobs[id]); delete blobs[id]; }
        save(s);
        return json(200, { message: "Файл удалён." });
      }
      return json(404, { error: "Не найдено." });
    });
  };

  // uploads go through XMLHttpRequest (for the progress bar): simulate them locally
  var RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    var listeners = {}, upListeners = {}, method = "GET", url = "", headers = {};
    var fake = {
      status: 0, responseText: "",
      upload: { addEventListener: function (t, fn) { (upListeners[t] = upListeners[t] || []).push(fn); } },
      open: function (m, u) { method = m; url = u; },
      setRequestHeader: function (k, v) { headers[k.toLowerCase()] = v; },
      addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      send: function (file) {
        var path = apiPath(url);
        if (!(path === "/api/files" && method === "POST")) {
          var real = new RealXHR(); real.open(method, url); real.send(file); return;
        }
        var emit = function (map, t, e) { (map[t] || []).forEach(function (fn) { fn(e || {}); }); };
        if (!s.user) { fake.status = 401; fake.responseText = "{}"; emit(listeners, "load"); return; }
        var total = (file && file.size) || 1, step = 0, steps = 12;
        var timer = setInterval(function () {
          step++;
          emit(upListeners, "progress", { lengthComputable: true, loaded: Math.min(total, total * step / steps), total: total });
          if (step >= steps) {
            clearInterval(timer);
            var meta = {
              id: uid(),
              name: decodeURIComponent(headers["x-file-name"] || (file && file.name) || "file"),
              size: total,
              type: headers["content-type"] || "application/octet-stream",
              uploadedAt: new Date().toISOString()
            };
            try { blobs[meta.id] = URL.createObjectURL(file); } catch (e) {}
            s.files.unshift(meta);
            save(s);
            fake.status = 201;
            fake.responseText = JSON.stringify({ message: "Файл успешно загружен.", file: pub(meta) });
            emit(listeners, "load");
          }
        }, 70);
      }
    };
    return fake;
  };
})();
