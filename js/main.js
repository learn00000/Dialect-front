(function () {
  const toastEl = document.getElementById("toast");
  const avatarStatus = document.getElementById("avatar-status");
  const body = document.body;
  const cards = document.querySelectorAll("[data-tilt]");
  const digitalHost = document.getElementById("digital-human-host");
  const viewHome = document.getElementById("view-home");
  const viewOpera = document.getElementById("view-opera");
  const viewNianbai = document.getElementById("view-nianbai");
  const viewDuanzhang = document.getElementById("view-duanzhang");
  const btnOperaBack = document.getElementById("btn-opera-back");
  const btnNbBack = document.getElementById("btn-nb-back");
  const btnDzBack = document.getElementById("btn-dz-back");
  const btnDzRefresh = document.getElementById("btn-dz-refresh");
  const cardEnterDz = document.querySelector(".opera-card--enter-dz");
  const cardEnterNb = document.querySelector(".opera-card--enter-nb");
  const appRoot = document.querySelector(".app");

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("toast--show"));
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toastEl.classList.remove("toast--show");
      window.setTimeout(() => {
        toastEl.hidden = true;
      }, 350);
    }, 2600);
  }

  document.getElementById("btn-auth")?.addEventListener("click", () => {
    showToast("登录 / 注册流程可在此对接统一认证。");
  });

  /** 回到首页：关闭戏韵、断章等所有子视图 */
  function showHomeView() {
    if (!viewHome) return;
    viewHome.hidden = false;
    viewHome.setAttribute("aria-hidden", "false");
    if (viewOpera) {
      viewOpera.hidden = true;
      viewOpera.setAttribute("aria-hidden", "true");
    }
    if (viewNianbai) {
      viewNianbai.hidden = true;
      viewNianbai.setAttribute("aria-hidden", "true");
    }
    if (viewDuanzhang) {
      viewDuanzhang.hidden = true;
      viewDuanzhang.setAttribute("aria-hidden", "true");
    }
    appRoot?.classList.remove("app--opera", "app--duanzhang");
  }

  function openOperaView() {
    if (!viewHome || !viewOpera) return;
    if (viewNianbai) {
      viewNianbai.hidden = true;
      viewNianbai.setAttribute("aria-hidden", "true");
    }
    if (viewDuanzhang) {
      viewDuanzhang.hidden = true;
      viewDuanzhang.setAttribute("aria-hidden", "true");
    }
    viewHome.hidden = true;
    viewHome.setAttribute("aria-hidden", "true");
    viewOpera.hidden = false;
    viewOpera.setAttribute("aria-hidden", "false");
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
    btnOperaBack?.focus({ preventScroll: true });
  }

  /** 入戏念白：从方音戏韵中间卡片进入 */
  function openNianbaiView() {
    if (!viewOpera || !viewNianbai) return;
    viewOpera.hidden = true;
    viewOpera.setAttribute("aria-hidden", "true");
    viewNianbai.hidden = false;
    viewNianbai.setAttribute("aria-hidden", "false");
    if (viewDuanzhang) {
      viewDuanzhang.hidden = true;
      viewDuanzhang.setAttribute("aria-hidden", "true");
    }
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
    btnNbBack?.focus({ preventScroll: true });
  }

  function closeNianbaiView() {
    if (!viewOpera || !viewNianbai) return;
    viewNianbai.hidden = true;
    viewNianbai.setAttribute("aria-hidden", "true");
    viewOpera.hidden = false;
    viewOpera.setAttribute("aria-hidden", "false");
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
  }

  /** 断章寻韵：从方音戏韵左侧卡片进入 */
  function openDuanzhangView() {
    if (!viewOpera || !viewDuanzhang) return;
    viewOpera.hidden = true;
    viewOpera.setAttribute("aria-hidden", "true");
    viewDuanzhang.hidden = false;
    viewDuanzhang.setAttribute("aria-hidden", "false");
    appRoot?.classList.remove("app--opera");
    appRoot?.classList.add("app--duanzhang");
    btnDzBack?.focus({ preventScroll: true });
  }

  function closeDuanzhangView() {
    if (!viewOpera || !viewDuanzhang) return;
    viewDuanzhang.hidden = true;
    viewDuanzhang.setAttribute("aria-hidden", "true");
    viewOpera.hidden = false;
    viewOpera.setAttribute("aria-hidden", "false");
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
  }

  document.querySelectorAll(".feature-card__cta").forEach((btn) => {
    if (btn.classList.contains("feature-card__cta--link")) return;
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "opera") {
        openOperaView();
        return;
      }
      const map = {
        pick: "方音拾级：学习闯关页可在此挂载。",
      };
      showToast(map[action] || "功能开发中，敬请期待。");
    });
  });

  btnOperaBack?.addEventListener("click", () => {
    showHomeView();
  });

  btnDzBack?.addEventListener("click", () => {
    closeDuanzhangView();
  });

  btnNbBack?.addEventListener("click", () => {
    closeNianbaiView();
  });

  btnDzRefresh?.addEventListener("click", () => {
    showToast("已模拟刷新题目（可接题库接口）。");
  });

  cardEnterDz?.addEventListener("click", () => {
    if (!viewOpera || viewOpera.hidden) return;
    openDuanzhangView();
  });
  cardEnterDz?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!viewOpera || viewOpera.hidden) return;
    e.preventDefault();
    openDuanzhangView();
  });

  cardEnterNb?.addEventListener("click", () => {
    if (!viewOpera || viewOpera.hidden) return;
    openNianbaiView();
  });
  cardEnterNb?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!viewOpera || viewOpera.hidden) return;
    e.preventDefault();
    openNianbaiView();
  });

  document.querySelectorAll('a[href="#top"]').forEach((a) => {
    a.addEventListener("click", () => {
      showHomeView();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (viewDuanzhang && !viewDuanzhang.hidden) {
      closeDuanzhangView();
      return;
    }
    if (viewNianbai && !viewNianbai.hidden) {
      closeNianbaiView();
      return;
    }
    if (viewOpera && !viewOpera.hidden) {
      showHomeView();
    }
  });

  /** 背景视差（尊重 reduced motion） */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    let raf = 0;
    body.addEventListener(
      "mousemove",
      (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const x = (e.clientX / window.innerWidth - 0.5) * 14;
          const y = (e.clientY / window.innerHeight - 0.5) * 10;
          body.style.setProperty("--bg-x", `${x}px`);
          body.style.setProperty("--bg-y", `${y}px`);
        });
      },
      { passive: true }
    );
  }

  /** 卡片 3D 倾斜 */
  function bindTilt(el) {
    const max = 7;
    el.addEventListener(
      "pointermove",
      (e) => {
        if (reduceMotion) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        const rx = (0.5 - py) * max;
        const ry = (px - 0.5) * max;
        el.style.setProperty("--tilt-x", `${rx}deg`);
        el.style.setProperty("--tilt-y", `${ry}deg`);
      },
      { passive: true }
    );
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    });
  }

  cards.forEach(bindTilt);

  /** 数字人区域：轻量「可交互」演示 */
  let engaged = false;
  function toggleDigitalHost() {
    engaged = !engaged;
    if (avatarStatus) {
      avatarStatus.textContent = engaged ? "演示：交互已唤醒（可接 RTC / 模型）" : "交互引擎待接入";
    }
    showToast(engaged ? "已模拟唤醒数字人宿主，可替换为真实管线。" : "数字人宿主处于待机。");
  }

  digitalHost?.addEventListener("click", toggleDigitalHost);
  digitalHost?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDigitalHost();
    }
  });

  digitalHost?.setAttribute("title", "点击切换演示状态（后续可接入数字人 SDK）");
})();
