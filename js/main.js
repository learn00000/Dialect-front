(function () {
  const toastEl = document.getElementById("toast");
  const avatarStatus = document.getElementById("avatar-status");
  const body = document.body;
  const cards = document.querySelectorAll("[data-tilt]");
  const digitalHost = document.getElementById("digital-human-host");

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

  document.querySelectorAll(".feature-card__cta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const map = {
        pick: "方音拾级：学习闯关页可在此挂载。",
        map: "声绘山河：录音上传与地图语料库可在此挂载。",
        opera: "方音戏韵：TTS 合成与戏韵交互可在此挂载。",
      };
      showToast(map[action] || "功能开发中，敬请期待。");
    });
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
