(function () {
  var script = document.currentScript;
  if (!script) return;
  var origin = new URL(script.src).origin;
  var data = script.dataset;
  var host = (data.host || origin).replace(/\/+$/, "");
  var query = new URLSearchParams();
  ["key", "lang", "currency", "theme", "radius", "reviews"].forEach(function (name) {
    if (data[name] === undefined) return;
    query.set(name, name === "theme" ? data[name].replace("#", "") : name === "reviews" && data[name] === "" ? "1" : data[name]);
  });
  var src = host + "/widget/" + encodeURIComponent(data.product || "catalogo") + "?" + query.toString();
  var overlay = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(event) {
    if (event.key === "Escape") close();
  }

  function open() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(14,17,32,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    var panel = document.createElement("div");
    panel.style.cssText = "position:relative;width:min(1080px,100%);height:min(860px,100%);background:#fff;border-radius:" + Math.max(0, Math.min(24, Number(data.radius || 12))) + "px;overflow:hidden;box-shadow:0 30px 80px -30px rgba(0,0,0,.5)";
    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", data.lang === "en" ? "Close" : "Cerrar");
    button.textContent = "×";
    button.style.cssText = "position:absolute;top:8px;right:10px;z-index:1;width:36px;height:36px;border:0;border-radius:999px;background:rgba(255,255,255,.9);font-size:22px;line-height:1;cursor:pointer";
    button.addEventListener("click", close);
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.title = data.lang === "en" ? "Online booking" : "Reserva en línea";
    frame.setAttribute("allow", "payment");
    frame.style.cssText = "width:100%;height:100%;border:0";
    panel.appendChild(button);
    panel.appendChild(frame);
    overlay.appendChild(panel);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  document.addEventListener("click", function (event) {
    var target = event.target instanceof Element ? event.target.closest("[data-kipucontrol-open]") : null;
    if (!target) return;
    event.preventDefault();
    open();
  });
})();
