/**
 * AI 戏曲方言绘本（入戏念白页改版）
 */
(function () {
  function initStorybookApp(showToast) {
    const opts = window.STORYBOOK_OPTIONS;
    const buildMock = window.buildStorybookResponse;
    if (!opts || !buildMock) return;

    const sbDialect = document.getElementById("sb-dialect");
    const sbOpera = document.getElementById("sb-opera");
    const sbRole = document.getElementById("sb-role");
    const btnSbGenerate = document.getElementById("btn-sb-generate");
    const btnSbRetry = document.getElementById("btn-sb-retry");
    const btnSbPrev = document.getElementById("btn-sb-prev");
    const btnSbNext = document.getElementById("btn-sb-next");
    const btnSbRegenerate = document.getElementById("btn-sb-regenerate");
    const btnSbExportPage = document.getElementById("btn-sb-export-page");
    const btnSbExportAll = document.getElementById("btn-sb-export-all");
    const btnSbCopyLink = document.getElementById("btn-sb-copy-link");
    const sbConfigPreview = document.getElementById("sb-config-preview");
    const sbPreviewList = sbConfigPreview?.querySelector(".sb-config-preview__list");
    const sbPreviewHint = sbConfigPreview?.querySelector(".sb-config-preview__hint");
    const sbPreviewDialect = document.getElementById("sb-preview-dialect");
    const sbPreviewOpera = document.getElementById("sb-preview-opera");
    const sbPreviewRole = document.getElementById("sb-preview-role");
    const sbStateIdle = document.getElementById("sb-state-idle");
    const sbStateLoading = document.getElementById("sb-state-loading");
    const sbStateError = document.getElementById("sb-state-error");
    const sbStateSuccess = document.getElementById("sb-state-success");
    const sbErrorMsg = document.getElementById("sb-error-msg");
    const sbPlayerCard = document.getElementById("sb-player-card");
    const sbPlayerContent = document.getElementById("sb-player-content");
    const sbSceneTitle = document.getElementById("sb-scene-title");
    const sbPageIndicator = document.getElementById("sb-page-indicator");
    const sbPageImage = document.getElementById("sb-page-image");
    const sbPageDialogue = document.getElementById("sb-page-dialogue");
    const sbClassicLyrics = document.getElementById("sb-classic-lyrics");
    const sbThumbWrap = document.getElementById("sb-thumb-wrap");
    const sbThumbImage = document.getElementById("sb-thumb-image");
    const sbThumbCaption = document.getElementById("sb-thumb-caption");
    const sbQrcodePlaceholder = document.getElementById("sb-qrcode-placeholder");
    const sbQrcodeCanvas = document.getElementById("sb-qrcode-canvas");

    if (!sbDialect || !btnSbGenerate) return;

    const state = {
      status: "idle",
      form: { dialect: "", opera: "", role: "" },
      loading: false,
      error: null,
      pages: [],
      meta: null,
      currentPage: 0,
    };

    function fillSelect(select, items, selected) {
      if (!select) return;
      select.innerHTML = items
        .map((v) => `<option value="${v.replace(/"/g, "&quot;")}">${v}</option>`)
        .join("");
      if (selected && items.includes(selected)) select.value = selected;
    }

    function getRolesForOpera(opera) {
      return opts.rolesByOpera[opera] || opts.rolesByOpera[opts.operas[0]] || [];
    }

    function readForm() {
      return {
        dialect: sbDialect.value,
        opera: sbOpera.value,
        role: sbRole.value,
      };
    }

    function validateForm(form) {
      return Boolean(form.dialect && form.opera && form.role);
    }

    function updateConfigPreview() {
      const form = readForm();
      state.form = form;
      const complete = validateForm(form);
      if (sbPreviewHint) sbPreviewHint.hidden = complete;
      if (sbPreviewList) sbPreviewList.hidden = !complete;
      if (complete) {
        if (sbPreviewDialect) sbPreviewDialect.textContent = form.dialect;
        if (sbPreviewOpera) sbPreviewOpera.textContent = form.opera;
        if (sbPreviewRole) sbPreviewRole.textContent = form.role;
      }
    }

    function setGenerateDisabled(disabled) {
      btnSbGenerate.disabled = disabled;
      if (btnSbRegenerate) btnSbRegenerate.disabled = disabled;
    }

    function setPlayerStatus(status) {
      state.status = status;
      if (sbStateIdle) sbStateIdle.hidden = status !== "idle";
      if (sbStateLoading) sbStateLoading.hidden = status !== "loading";
      if (sbStateError) sbStateError.hidden = status !== "error";
      if (sbStateSuccess) sbStateSuccess.hidden = status !== "success";
      if (status !== "success") clearQrcode();
    }

    function buildShareUrl() {
      const url = new URL(location.href);
      url.hash = "storybook";
      const form = readForm();
      if (validateForm(form)) {
        url.searchParams.set("dialect", form.dialect);
        url.searchParams.set("opera", form.opera);
        url.searchParams.set("role", form.role);
      }
      return url.toString();
    }

    function clearQrcode() {
      if (sbQrcodePlaceholder) sbQrcodePlaceholder.hidden = false;
      if (sbQrcodeCanvas) {
        sbQrcodeCanvas.hidden = true;
        sbQrcodeCanvas.setAttribute("aria-hidden", "true");
        const ctx = sbQrcodeCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, sbQrcodeCanvas.width, sbQrcodeCanvas.height);
      }
    }

    function updateQrcode() {
      if (state.status !== "success" || !state.pages.length) {
        clearQrcode();
        return;
      }
      const QRCode = window.QRCode;
      if (!QRCode || !sbQrcodeCanvas) return;

      const shareUrl = buildShareUrl();
      QRCode.toCanvas(
        sbQrcodeCanvas,
        shareUrl,
        {
          width: 128,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#1d5d56", light: "#ffffff" },
        },
        (err) => {
          if (err) {
            console.warn("[storybook] qrcode render failed:", err);
            clearQrcode();
            return;
          }
          if (sbQrcodePlaceholder) sbQrcodePlaceholder.hidden = true;
          sbQrcodeCanvas.hidden = false;
          sbQrcodeCanvas.setAttribute("aria-hidden", "false");
        }
      );
    }

    function applyShareParamsFromUrl() {
      const params = new URLSearchParams(location.search);
      const dialect = params.get("dialect");
      const opera = params.get("opera");
      const role = params.get("role");
      let applied = false;

      if (dialect && opts.dialects.includes(dialect)) {
        sbDialect.value = dialect;
        applied = true;
      }
      if (opera && opts.operas.includes(opera)) {
        sbOpera.value = opera;
        const roles = getRolesForOpera(opera);
        fillSelect(sbRole, roles, role && roles.includes(role) ? role : roles[0]);
        applied = true;
      } else if (role) {
        const roles = getRolesForOpera(sbOpera.value);
        if (roles.includes(role)) {
          sbRole.value = role;
          applied = true;
        }
      }
      if (applied) updateConfigPreview();

      if (location.hash.replace(/^#/, "") === "storybook" && typeof window.openNianbaiView === "function") {
        window.openNianbaiView();
        if (applied) showToast("已根据分享链接填入参数，点击「生成戏曲绘本」即可。");
      }
    }

    function scrollToPlayer() {
      sbPlayerCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function renderPage(index) {
      const page = state.pages[index];
      if (!page) return;
      state.currentPage = index;
      const total = state.pages.length;

      if (sbSceneTitle) sbSceneTitle.textContent = page.sceneTitle;
      if (sbPageIndicator) sbPageIndicator.textContent = `第 ${page.page} / ${total} 页`;
      if (sbPageImage) {
        sbPageImage.src = page.imageUrl;
        sbPageImage.alt = `${page.sceneTitle} · ${state.meta?.opera || "戏曲绘本"}剧照`;
      }
      if (sbPageDialogue) sbPageDialogue.textContent = page.dialogue;
      if (sbClassicLyrics) sbClassicLyrics.textContent = page.classicLyrics;

      if (btnSbPrev) btnSbPrev.disabled = index <= 0;
      if (btnSbNext) btnSbNext.disabled = index >= total - 1;

      if (sbThumbWrap && sbThumbImage) {
        sbThumbWrap.hidden = false;
        sbThumbImage.src = page.imageUrl;
        if (sbThumbCaption) sbThumbCaption.textContent = `${page.sceneTitle} · 第 ${page.page} 页`;
      }

      if (sbPlayerContent) {
        sbPlayerContent.classList.remove("is-fading");
        void sbPlayerContent.offsetWidth;
        sbPlayerContent.classList.add("is-fading");
        window.setTimeout(() => sbPlayerContent.classList.remove("is-fading"), 320);
      }
    }

    async function requestStorybook(form) {
      try {
        const res = await fetch("/api/storybook/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success || !Array.isArray(data.pages)) throw new Error("invalid response");
        return data;
      } catch (err) {
        console.warn("[storybook] API error, using client mock:", err);
        return buildMock(form.dialect, form.opera, form.role);
      }
    }

    async function generateStorybook() {
      const form = readForm();
      if (!validateForm(form)) {
        showToast("请先完整选择方言、剧目与角色。");
        return;
      }

      state.loading = true;
      state.error = null;
      setGenerateDisabled(true);
      setPlayerStatus("loading");
      scrollToPlayer();

      try {
        const data = await requestStorybook(form);
        state.pages = data.pages;
        state.meta = data.meta || form;
        state.loading = false;
        setGenerateDisabled(false);
        setPlayerStatus("success");
        renderPage(0);
        updateQrcode();
        showToast("戏曲绘本已生成，请翻阅欣赏。");
        scrollToPlayer();
      } catch (err) {
        state.loading = false;
        state.error = err?.message || "生成失败";
        setGenerateDisabled(false);
        if (sbErrorMsg) sbErrorMsg.textContent = state.error;
        setPlayerStatus("error");
        showToast("绘本生成失败，请重试。");
      }
    }

    function downloadJson(filename, obj) {
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    const defaultDialect = opts.dialects.includes("粤语") ? "粤语" : opts.dialects[0];
    const defaultOpera = opts.operas.includes("粤剧《牡丹亭》") ? "粤剧《牡丹亭》" : opts.operas[0];
    fillSelect(sbDialect, opts.dialects, defaultDialect);
    fillSelect(sbOpera, opts.operas, defaultOpera);
    const defaultRoles = getRolesForOpera(sbOpera.value);
    const defaultRole = defaultRoles.includes("杜丽娘（闺门旦）")
      ? "杜丽娘（闺门旦）"
      : defaultRoles[0];
    fillSelect(sbRole, defaultRoles, defaultRole);
    updateConfigPreview();

    sbOpera.addEventListener("change", () => {
      const roles = getRolesForOpera(sbOpera.value);
      fillSelect(sbRole, roles, roles[0]);
      updateConfigPreview();
    });
    sbDialect.addEventListener("change", updateConfigPreview);
    sbRole.addEventListener("change", updateConfigPreview);

    btnSbGenerate.addEventListener("click", generateStorybook);
    btnSbRetry?.addEventListener("click", generateStorybook);
    btnSbRegenerate?.addEventListener("click", generateStorybook);
    btnSbPrev?.addEventListener("click", () => {
      if (state.currentPage > 0) renderPage(state.currentPage - 1);
    });
    btnSbNext?.addEventListener("click", () => {
      if (state.currentPage < state.pages.length - 1) renderPage(state.currentPage + 1);
    });

    btnSbExportPage?.addEventListener("click", () => {
      const page = state.pages[state.currentPage];
      if (!page) {
        showToast("请先生成绘本。");
        return;
      }
      downloadJson(`storybook-page-${page.page}.json`, page);
      showToast("已导出当前页 JSON。");
    });

    btnSbExportAll?.addEventListener("click", () => {
      if (!state.pages.length) {
        showToast("请先生成绘本。");
        return;
      }
      downloadJson("storybook-all.json", {
        success: true,
        meta: state.meta,
        pages: state.pages,
      });
      showToast("已导出全部绘本数据。");
    });

    btnSbCopyLink?.addEventListener("click", async () => {
      if (state.status !== "success" || !state.pages.length) {
        showToast("请先生成绘本，再复制分享链接。");
        return;
      }
      try {
        await navigator.clipboard.writeText(buildShareUrl());
        showToast("分享链接已复制。");
      } catch {
        showToast("复制失败，请手动复制地址栏链接。");
      }
    });

    applyShareParamsFromUrl();
  }

  window.initStorybookApp = initStorybookApp;
})();
