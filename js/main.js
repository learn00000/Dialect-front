(function () {
  const toastEl = document.getElementById("toast");
  const avatarStatus = document.getElementById("avatar-status");
  const body = document.body;
  const cards = document.querySelectorAll("[data-tilt]");
  const digitalHost = document.getElementById("digital-human-host");
  const viewHome = document.getElementById("view-home");
  const viewOpera = document.getElementById("view-opera");
  const viewNianbai = document.getElementById("view-nianbai");
  const viewBianyin = document.getElementById("view-bianyin");
  const viewDuanzhang = document.getElementById("view-duanzhang");
  const btnOperaBack = document.getElementById("btn-opera-back");
  const btnNbBack = document.getElementById("btn-nb-back");
  const btnByBack = document.getElementById("btn-by-back");
  const btnDzBack = document.getElementById("btn-dz-back");
  const cardEnterDz = document.querySelector(".opera-card--enter-dz");
  const cardEnterNb = document.querySelector(".opera-card--enter-nb");
  const cardEnterBianyin = document.querySelector(".opera-card--enter-bianyin");
  const appRoot = document.querySelector(".app");

  // 断章寻韵相关元素
  const dzInfo = document.getElementById("dz2-info");
  const dzReference = document.getElementById("dz2-reference");
  const dzSourceList = document.getElementById("dz2-source-list");
  const dzTrack = document.getElementById("dz2-track");
  const btnDzReset = document.getElementById("btn-dz-reset");
  const btnDzPlayCombined = document.getElementById("btn-dz-play-combined");
  const btnDzConfirm = document.getElementById("btn-dz-confirm");
  const dzResult = document.getElementById("dz2-result");
  const dzScoreWrap = document.getElementById("dz2-score-wrap");
  const dzWiki = document.getElementById("dz2-wiki");
  const dzMedia = document.getElementById("dz2-media");
  const dzLevels = document.getElementById("dz2-levels");

  // 入戏念白相关元素
  const nbUserInput = document.getElementById("nb-user-input");
  const btnNbGenerate = document.getElementById("btn-nb-generate");
  const nbWaveVisualizer = document.getElementById("nb-wave-visualizer");
  const nbBgUpload = document.getElementById("nb-bg-upload");
  const nbBackgroundPreview = document.getElementById("nb-background-preview");
  const nbShareCardContainer = document.getElementById("nb-share-card-container");
  const nbShareCanvas = document.getElementById("nb-share-canvas");
  const btnNbShare = document.getElementById("btn-nb-share");

  // 辨音解意相关元素
  const byLevelGrid = document.getElementById("by-level-grid");
  const byLevelName = document.getElementById("by-level-name");
  const byProgress = document.getElementById("by-progress");
  const byQuestion = document.getElementById("by-question");
  const byOptionA = document.getElementById("by-option-a");
  const byOptionB = document.getElementById("by-option-b");
  const byOptionC = document.getElementById("by-option-c");
  const byOptionTagA = document.getElementById("by-option-tag-a");
  const byOptionTagB = document.getElementById("by-option-tag-b");
  const byOptionTagC = document.getElementById("by-option-tag-c");
  const byOptions = document.getElementById("by-options");
  const byAudioTip = document.getElementById("by-audio-tip");
  const btnByPlay = document.getElementById("btn-by-play");
  const btnBySubmit = document.getElementById("btn-by-submit");
  const btnByNext = document.getElementById("btn-by-next");
  const byModal = document.getElementById("by-modal");
  const byModalBackdrop = document.getElementById("by-modal-backdrop");
  const btnByModalClose = document.getElementById("btn-by-modal-close");
  const byModalResult = document.getElementById("by-modal-result");
  const byModalOriginal = document.getElementById("by-modal-original");
  const byModalMeaning = document.getElementById("by-modal-meaning");
  const byModalSource = document.getElementById("by-modal-source");
  const byModalGenre = document.getElementById("by-modal-genre");
  const byModalDialect = document.getElementById("by-modal-dialect");
  const byModalEtymology = document.getElementById("by-modal-etymology");
  const byModalCulture = document.getElementById("by-modal-culture");

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // 模拟的音频数据 (实际项目中会从后端获取)
  const mockAudioBuffers = {};
  async function loadAudioBuffer(url) {
    if (mockAudioBuffers[url]) return mockAudioBuffers[url];
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    mockAudioBuffers[url] = audioBuffer;
    return audioBuffer;
  }

  // 生成模拟音频 (用于 TTS 拼接)
  async function generateMockTTSAudio(text) {
    // 模拟 TTS 合成，返回一个 AudioBuffer
    // 实际应调用 TTS API，这里简单返回一个短的模拟音
    return new Promise(resolve => {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.8, audioContext.sampleRate); // 0.8秒音频
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(i / 100 * (text.length * 0.1)); // 简单生成波形
      }
      resolve(buffer);
    });
  }

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
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
    }
    if (viewDuanzhang) {
      viewDuanzhang.hidden = true;
      viewDuanzhang.setAttribute("aria-hidden", "true");
      if(typeof resetDuanzhangGame === "function") {
        resetDuanzhangGame();
      }
    }
    closeBianyinModal();
    appRoot?.classList.remove("app--opera", "app--duanzhang");
    restoreLive2DForVisibleHome();
  }

  function openOperaView() {
    if (!viewHome || !viewOpera) return;
    prepareLive2DForHiddenView();
    if (viewNianbai) {
      viewNianbai.hidden = true;
      viewNianbai.setAttribute("aria-hidden", "true");
    }
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
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
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
    }
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
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
    }
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
  }

  function openBianyinView() {
    if (!viewOpera || !viewBianyin) return;
    viewOpera.hidden = true;
    viewOpera.setAttribute("aria-hidden", "true");
    viewBianyin.hidden = false;
    viewBianyin.setAttribute("aria-hidden", "false");
    if (viewNianbai) {
      viewNianbai.hidden = true;
      viewNianbai.setAttribute("aria-hidden", "true");
    }
    if (viewDuanzhang) {
      viewDuanzhang.hidden = true;
      viewDuanzhang.setAttribute("aria-hidden", "true");
    }
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
    btnByBack?.focus({ preventScroll: true });
  }

  function closeBianyinView() {
    if (!viewOpera || !viewBianyin) return;
    viewBianyin.hidden = true;
    viewBianyin.setAttribute("aria-hidden", "true");
    viewOpera.hidden = false;
    viewOpera.setAttribute("aria-hidden", "false");
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
    closeBianyinModal();
  }

  /** 断章寻韵：从方音戏韵左侧卡片进入 */
  function openDuanzhangView() {
    if (!viewOpera || !viewDuanzhang) return;
    viewOpera.hidden = true;
    viewOpera.setAttribute("aria-hidden", "true");
    viewDuanzhang.hidden = false;
    viewDuanzhang.setAttribute("aria-hidden", "false");
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
    }
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
    if (viewBianyin) {
      viewBianyin.hidden = true;
      viewBianyin.setAttribute("aria-hidden", "true");
    }
    appRoot?.classList.remove("app--duanzhang");
    appRoot?.classList.add("app--opera");
  }

  // 首页功能卡入口：戏韵走视图切换，其他保留占位提示
  document.querySelectorAll(".feature-card__cta").forEach((btn) => {
    if (btn.classList.contains("feature-card__cta--link")) {
      btn.addEventListener("click", prepareLive2DForHiddenView);
      return;
    }
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "opera") {
        openOperaView();
        return;
      }
      const tips = {
        pick: "方音拾级：学习闯关页可在此挂载。",
      };
      showToast(tips[action] || "功能开发中，敬请期待。");
    });
  });

  // 视图内返回按钮
  btnOperaBack?.addEventListener("click", () => {
    showHomeView();
  });
  btnDzBack?.addEventListener("click", () => {
    if (typeof stopDzAudio === "function") stopDzAudio();
    closeDuanzhangView();
  });
  btnNbBack?.addEventListener("click", () => {
    closeNianbaiView();
  });
  btnByBack?.addEventListener("click", () => {
    closeBianyinView();
  });

  const byWall = window.BIANYIN_WALL || [];
  const byQuestions = window.BIANYIN_QUESTIONS || [];
  const byQuestionIndexById = new Map(byQuestions.map((q, i) => [q.id, i]));

  let byUnlockedQuestionCount = 1;
  let byCurrentIndex = -1;
  const byClearedQuestionIds = new Set();
  let byLastCorrect = false;
  let byActiveAudio = null;
  let byOptionsRevealed = true;
  let bySelectedAnswer = "";

  const BY_OPTION_TEXT_ELS = [
    { key: "A", text: byOptionA, tag: byOptionTagA },
    { key: "B", text: byOptionB, tag: byOptionTagB },
    { key: "C", text: byOptionC, tag: byOptionTagC }
  ];

  function applyBianyinOptionTags() {
    BY_OPTION_TEXT_ELS.forEach(({ key, tag }) => {
      if (tag) tag.textContent = `选项 ${key}`;
    });
  }

  function getBianyinOptionButtons() {
    return byOptions ? [...byOptions.querySelectorAll(".by-option[data-by-value]")] : [];
  }

  function clearBianyinSelection() {
    bySelectedAnswer = "";
    getBianyinOptionButtons().forEach((btn) => {
      btn.classList.remove("by-option--picked");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  function selectBianyinAnswer(value) {
    const level = byQuestions[byCurrentIndex];
    if (!level || !value) return;
    if (level.hideOptionsUntilListen && !byOptionsRevealed) {
      showToast("请先播放唱段，待选项显示后再选择。");
      return;
    }
    bySelectedAnswer = value;
    getBianyinOptionButtons().forEach((btn) => {
      const picked = btn.dataset.byValue === value;
      btn.classList.toggle("by-option--picked", picked);
      btn.setAttribute("aria-pressed", picked ? "true" : "false");
    });
  }

  function applyBianyinOptionTexts(level, revealed) {
    const masked = level.hideOptionsUntilListen && !revealed;
    BY_OPTION_TEXT_ELS.forEach(({ key, text }) => {
      if (!text) return;
      text.textContent = masked ? "听完唱段后显示" : level.options[key];
    });
    if (byOptions) {
      byOptions.classList.toggle("by-options--masked", masked);
    }
    getBianyinOptionButtons().forEach((btn) => {
      btn.disabled = masked;
    });
    if (btnBySubmit) btnBySubmit.disabled = masked;
    if (!masked) clearBianyinSelection();
  }

  function revealBianyinOptions() {
    const level = byQuestions[byCurrentIndex];
    if (!level || byOptionsRevealed) return;
    byOptionsRevealed = true;
    applyBianyinOptionTexts(level, true);
  }

  function closeBianyinModal() {
    if (!byModal) return;
    byModal.hidden = true;
    byModal.setAttribute("aria-hidden", "true");
  }

  function openBianyinModal() {
    if (!byModal) return;
    byModal.hidden = false;
    byModal.setAttribute("aria-hidden", "false");
  }

  function stopByAudio() {
    if (byActiveAudio) {
      byActiveAudio.pause();
      byActiveAudio.currentTime = 0;
      byActiveAudio.onended = null;
      byActiveAudio.onerror = null;
      byActiveAudio = null;
    }
  }

  function isWallItemCleared(wallItem) {
    if (wallItem.placeholder) return false;
    const ids = wallItem.questionIds || [];
    return ids.length > 0 && ids.every((id) => byClearedQuestionIds.has(id));
  }

  function getWallItemProgress(wallItem) {
    const ids = wallItem.questionIds || [];
    if (!ids.length) return "";
    const done = ids.filter((id) => byClearedQuestionIds.has(id)).length;
    return `（${done}/${ids.length}）`;
  }

  function findFirstOpenQuestionIndex(wallItem) {
    const ids = wallItem.questionIds || [];
    for (const id of ids) {
      const idx = byQuestionIndexById.get(id);
      if (idx === undefined) continue;
      if (!byClearedQuestionIds.has(id)) return idx;
    }
    return byQuestionIndexById.get(ids[0]);
  }

  function updateBianyinProgress() {
    if (!byProgress) return;
    const clearedWall = byWall.filter((item) => isWallItemCleared(item)).length;
    byProgress.textContent = `已点亮 ${clearedWall} / ${byWall.length}`;
  }

  function renderBianyinWall() {
    if (!byLevelGrid) return;
    byLevelGrid.innerHTML = "";
    const currentQuestion = byQuestions[byCurrentIndex];
    byWall.forEach((wallItem, wallIndex) => {
      const isPlaceholder = Boolean(wallItem.placeholder);
      const isLocked = isPlaceholder;
      const isActive = currentQuestion?.wallId === wallItem.id;
      const isCleared = isWallItemCleared(wallItem);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "by-level-item";
      if (isLocked) btn.classList.add("by-level-item--locked");
      if (isActive) btn.classList.add("by-level-item--active");
      if (isCleared) btn.classList.add("by-level-item--cleared");
      btn.dataset.wallIndex = String(wallIndex);
      btn.disabled = isLocked;
      btn.innerHTML = `
        <span class="by-level-item__icon">${wallItem.icon}</span>
        <span class="by-level-item__name">${wallItem.genreName}${getWallItemProgress(wallItem)}</span>
      `;
      byLevelGrid.appendChild(btn);
    });
    updateBianyinProgress();
  }

  function setBianyinLevel(index) {
    const level = byQuestions[index];
    if (!level) return;
    stopByAudio();
    byCurrentIndex = index;
    byLastCorrect = false;
    byOptionsRevealed = !level.hideOptionsUntilListen;
    if (byLevelName) {
      const seq = byQuestions.findIndex((q) => q.id === level.id) + 1;
      const titlePart = level.hidePlayTitle
        ? `听辨第 ${seq} 题`
        : level.playTitle || `第 ${seq} 题`;
      byLevelName.textContent = `当前关卡：${titlePart} · ${level.genreName} · ${level.dialectName}`;
    }
    if (byQuestion) byQuestion.textContent = level.question;
    applyBianyinOptionTags();
    applyBianyinOptionTexts(level, byOptionsRevealed);
    if (byAudioTip) {
      byAudioTip.textContent = level.hideOptionsUntilListen
        ? "提示：先播放唱段，选项将在播放结束后显示。"
        : "提示：先听音，再作答。";
    }
    clearBianyinSelection();
    if (btnByPlay) btnByPlay.disabled = false;
    if (btnByNext) btnByNext.disabled = true;
    renderBianyinWall();
  }

  function playBianyinAudio() {
    const level = byQuestions[byCurrentIndex];
    if (!level) {
      showToast("请先从左侧「粤剧」图标开启关卡。");
      return;
    }
    if (!level.audioUrl) {
      showToast("本题暂无音频资源。");
      return;
    }
    if (byAudioTip) {
      byAudioTip.textContent = level.hidePlayTitle
        ? "正在播放原声唱段…"
        : `正在播放：${level.playTitle || level.genreName} 原声唱段…`;
    }
    stopByAudio();
    const audio = new Audio(level.audioUrl);
    byActiveAudio = audio;
    audio.onended = () => {
      revealBianyinOptions();
      if (byAudioTip) byAudioTip.textContent = "已播放完成，可开始作答。";
    };
    audio.onerror = () => {
      console.error("辨音解意音频加载失败:", level.audioUrl);
      if (byAudioTip) byAudioTip.textContent = "音频加载失败，请检查 video-learn 资源。";
      showToast("音频加载失败，请确认已构建或启动开发服务。");
    };
    audio.play().catch((err) => {
      console.error(err);
      showToast("无法播放音频，请检查浏览器自动播放策略。");
    });
  }

  function fillBianyinModal(level, isCorrect) {
    const answerText = level.options[level.answer] || "";
    if (byModalResult) {
      byModalResult.textContent = isCorrect
        ? `回答正确，已点亮「${level.genreName}」图标。标准答案：选项 ${level.answer}（${answerText}）`
        : `本次未答对。标准答案：选项 ${level.answer}（${answerText}），可结合下方文化解析再听一遍。`;
    }
    if (byModalOriginal) byModalOriginal.textContent = level.explain.original;
    if (byModalMeaning) byModalMeaning.textContent = level.explain.meaning;
    if (byModalSource) byModalSource.textContent = level.explain.source;
    if (byModalGenre) byModalGenre.textContent = level.explain.genre;
    if (byModalDialect) byModalDialect.textContent = level.explain.dialect;
    if (byModalEtymology) byModalEtymology.textContent = level.explain.etymology;
    if (byModalCulture) byModalCulture.textContent = level.explain.culture;
  }

  function submitBianyinAnswer() {
    const level = byQuestions[byCurrentIndex];
    if (!level || !byOptions) {
      showToast("请先开启一个关卡。");
      return;
    }
    if (level.hideOptionsUntilListen && !byOptionsRevealed) {
      showToast("请先播放唱段，待选项显示后再提交。");
      return;
    }
    if (!bySelectedAnswer) {
      showToast("请选择 A/B/C 中的一项后再提交。");
      return;
    }
    const isCorrect = bySelectedAnswer === level.answer;
    byLastCorrect = isCorrect;
    if (isCorrect) {
      byClearedQuestionIds.add(level.id);
      byUnlockedQuestionCount = Math.min(
        byQuestions.length,
        Math.max(byUnlockedQuestionCount, byCurrentIndex + 2)
      );
      if (btnByNext) btnByNext.disabled = false;
      const wallItem = byWall.find((w) => w.id === level.wallId);
      if (wallItem && isWallItemCleared(wallItem)) {
        showToast(`答对了，「${wallItem.genreName}」图鉴已点亮。`);
      } else {
        showToast("答对了，可进入下一题。");
      }
    } else {
      if (btnByNext) btnByNext.disabled = true;
      showToast("答案暂不正确，先看解析再试一次。");
    }
    renderBianyinWall();
    fillBianyinModal(level, isCorrect);
    openBianyinModal();
  }

  function gotoNextBianyinLevel() {
    if (!byLastCorrect || byCurrentIndex < 0) {
      showToast("请先答对当前关卡，再进入下一关。");
      return;
    }
    const nextIndex = byCurrentIndex + 1;
    if (nextIndex >= byUnlockedQuestionCount || nextIndex >= byQuestions.length) {
      if (byClearedQuestionIds.size === byQuestions.length) {
        showToast("恭喜完成全部粤剧听辨关卡，其余剧种素材筹备中。");
      } else {
        showToast("当前已是已解锁的最后一题。");
      }
      return;
    }
    setBianyinLevel(nextIndex);
    closeBianyinModal();
  }

  byLevelGrid?.addEventListener("click", (e) => {
    const target = e.target.closest(".by-level-item");
    if (!target) return;
    const wallIndex = Number(target.dataset.wallIndex);
    if (Number.isNaN(wallIndex)) return;
    const wallItem = byWall[wallIndex];
    if (!wallItem) return;
    if (wallItem.placeholder) {
      showToast(`${wallItem.genreName}关卡筹备中，敬请期待。`);
      return;
    }
    const questionIndex = findFirstOpenQuestionIndex(wallItem);
    if (questionIndex === undefined) {
      showToast(`「${wallItem.genreName}」已全部通关，可重听解析。`);
      const lastId = wallItem.questionIds?.[wallItem.questionIds.length - 1];
      const lastIndex = byQuestionIndexById.get(lastId);
      if (lastIndex !== undefined) setBianyinLevel(lastIndex);
      return;
    }
    setBianyinLevel(questionIndex);
  });

  byOptions?.addEventListener("click", (e) => {
    const btn = e.target.closest(".by-option[data-by-value]");
    if (!btn || btn.disabled) return;
    selectBianyinAnswer(btn.dataset.byValue);
  });

  btnByPlay?.addEventListener("click", playBianyinAudio);
  btnBySubmit?.addEventListener("click", submitBianyinAnswer);
  btnByNext?.addEventListener("click", gotoNextBianyinLevel);
  btnByModalClose?.addEventListener("click", closeBianyinModal);
  byModalBackdrop?.addEventListener("click", closeBianyinModal);

  renderBianyinWall();
  if (byQuestions.length > 0) {
    setBianyinLevel(0);
  }

  // 断章寻韵功能实现（数据来自 /video-stitch，见 js/duanzhang-data.js）
  const dzLibrary = window.DUANZHANG_LIBRARY || [];

  let dzCurrentLevelIndex = 0;
  let dzSourceSegments = [];
  let dzTrackSegments = [];
  let dzActiveAudio = null;
  let dzCombinedPlayToken = 0;

  function shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function stopDzAudio() {
    dzCombinedPlayToken += 1;
    if (dzActiveAudio) {
      dzActiveAudio.pause();
      dzActiveAudio.currentTime = 0;
      dzActiveAudio.onended = null;
      dzActiveAudio.onerror = null;
      dzActiveAudio = null;
    }
  }

  function playDzSegmentAudio(segment) {
    if (!segment?.audioUrl) {
      showToast("该片段暂无音频文件。");
      return null;
    }
    stopDzAudio();
    const audio = new Audio(segment.audioUrl);
    dzActiveAudio = audio;
    audio.play().catch((err) => {
      console.error("片段音频播放失败:", err);
      showToast("音频播放失败，请确认 video-stitch 资源可访问。");
    });
    return audio;
  }

  function renderDzInfo(level) {
    if (!dzInfo || !dzReference) return;
    const wikiTitle = level.wiki?.title ? `<p class="dz2-info__wiki-title">${level.wiki.title}</p>` : "";
    dzInfo.innerHTML = `
      <h2>${level.name}</h2>
      <p><strong>所属方言：</strong>${level.dialect} ｜ <strong>剧种：</strong>${level.genre}</p>
      <small>${level.intro}</small>
      ${wikiTitle}
    `;
    const segCount = level.segments.length;
    dzReference.innerHTML = `
      <h3>听辨提示</h3>
      <ul class="dz2-hint-list">
        <li>本关共 <strong>${segCount}</strong> 句唱词，已打乱在下方「待拖拽语音片段区」。</li>
        <li>点击各片段「播放」听方言原声，结合唱腔情绪与句意逻辑判断先后。</li>
        <li>拖入「拼接目标轨道区」后可调整顺序，并用「播放拼接音频」预听效果。</li>
        <li>全部片段入轨后再提交；正确顺序与完整视频将在提交后解锁展示。</li>
      </ul>
    `;
  }

  function buildSegmentCard(segment, zone) {
    const item = document.createElement("article");
    item.className = "dz2-seg";
    item.draggable = true;
    item.dataset.id = segment.id;
    item.dataset.zone = zone;
    item.innerHTML = `
      <div class="dz2-seg__body">
        <span class="dz2-seg__badge">片段</span>
        <p class="dz2-seg__text">${segment.text}</p>
      </div>
      <div class="dz2-seg__actions">
        <button type="button" class="dz2-play" data-action="play">播放</button>
        <button type="button" class="dz2-remove" data-action="remove">移出</button>
      </div>
    `;
    return item;
  }

  function renderDzSource() {
    if (!dzSourceList) return;
    dzSourceList.innerHTML = "";
    dzSourceSegments.forEach((seg) => {
      dzSourceList.appendChild(buildSegmentCard(seg, "source"));
    });
  }

  function renderDzTrack() {
    if (!dzTrack) return;
    dzTrack.innerHTML = "";
    if (dzTrackSegments.length === 0) {
      dzTrack.innerHTML = `<p class="dz2-track__empty">拖拽片段到此形成拼接队列，可在轨道内继续拖动调整顺序。</p>`;
    } else {
      dzTrackSegments.forEach((seg) => {
        dzTrack.appendChild(buildSegmentCard(seg, "track"));
      });
    }
    const hasTrack = dzTrackSegments.length > 0;
    if (btnDzPlayCombined) btnDzPlayCombined.disabled = !hasTrack;
    if (btnDzConfirm) btnDzConfirm.disabled = !hasTrack;
  }

  function renderDzLevels() {
    if (!dzLevels) return;
    dzLevels.innerHTML = "";
    dzLibrary.forEach((level, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dz2-level";
      if (index === dzCurrentLevelIndex) btn.classList.add("dz2-level--active");
      btn.dataset.level = String(index);
      btn.innerHTML = `<strong>${level.name}</strong><span>${level.genre} · ${level.dialect}</span>`;
      dzLevels.appendChild(btn);
    });
  }

  function renderDzResult(level, score, analysis) {
    if (!dzResult || !dzScoreWrap || !dzWiki || !dzMedia) return;
    const stars = Math.max(1, Math.min(5, Math.ceil(score / 20)));
    const starText = "★".repeat(stars) + "☆".repeat(5 - stars);
    dzScoreWrap.innerHTML = `
      <div class="dz2-score">${score}</div>
      <div class="dz2-score__meta">
        <h3>评分结果</h3>
        <p>${starText}（${stars} 星）</p>
        <p>${analysis}</p>
      </div>
    `;
    const wiki = level.wiki || {};
    dzWiki.innerHTML = `
      <h4>${wiki.title || "戏曲文化百科介绍"}</h4>
      <ul>
        <li><strong>剧目背景：</strong>${wiki.background || ""}</li>
        <li><strong>方言特色：</strong>${wiki.dialectFeature || ""}</li>
        <li><strong>唱段出处：</strong>${wiki.source || ""}</li>
        <li><strong>历史科普：</strong>${wiki.history || ""}</li>
        <li><strong>词句释义：</strong>${wiki.glossary || ""}</li>
      </ul>
    `;
    const lyricLines = [...level.segments]
      .sort((a, b) => a.order - b.order)
      .map((seg) => `${seg.order}. ${seg.text}`)
      .join("\n");
    dzMedia.innerHTML = `
      <h4>完整选段视频</h4>
      <div class="dz2-video">
        <video
          class="dz2-video__player"
          controls
          playsinline
          preload="metadata"
          src="${level.fullVideoUrl}"
          title="${level.name} 完整片段"
        ></video>
      </div>
      <h4 class="dz2-media__subtitle-title">唱词全文（与音频编号一致）</h4>
      <pre class="dz2-subtitle">${lyricLines}</pre>
    `;
    dzResult.hidden = false;
    dzResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function resetDuanzhangGame() {
    const level = dzLibrary[dzCurrentLevelIndex];
    if (!level) return;
    stopDzAudio();
    dzSourceSegments = shuffleArray(level.segments);
    dzTrackSegments = [];
    if (dzResult) dzResult.hidden = true;
    renderDzInfo(level);
    renderDzSource();
    renderDzTrack();
    renderDzLevels();
  }

  function moveToTrack(segmentId) {
    const idx = dzSourceSegments.findIndex((seg) => seg.id === segmentId);
    if (idx === -1) return;
    dzTrackSegments.push(dzSourceSegments[idx]);
    dzSourceSegments.splice(idx, 1);
    renderDzSource();
    renderDzTrack();
  }

  function removeFromTrack(segmentId) {
    const idx = dzTrackSegments.findIndex((seg) => seg.id === segmentId);
    if (idx === -1) return;
    dzSourceSegments.push(dzTrackSegments[idx]);
    dzTrackSegments.splice(idx, 1);
    renderDzSource();
    renderDzTrack();
  }

  function reorderTrack(fromId, toId) {
    if (fromId === toId) return;
    const fromIndex = dzTrackSegments.findIndex((seg) => seg.id === fromId);
    const toIndex = dzTrackSegments.findIndex((seg) => seg.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const moved = dzTrackSegments.splice(fromIndex, 1)[0];
    dzTrackSegments.splice(toIndex, 0, moved);
    renderDzTrack();
  }

  async function playDzTrack() {
    if (dzTrackSegments.length === 0) {
      showToast("轨道为空，请先拖拽片段。");
      return;
    }
    stopDzAudio();
    const token = dzCombinedPlayToken;
    for (const seg of dzTrackSegments) {
      if (token !== dzCombinedPlayToken) return;
      await new Promise((resolve) => {
        const audio = new Audio(seg.audioUrl);
        dzActiveAudio = audio;
        audio.onended = () => resolve();
        audio.onerror = () => {
          console.error("拼接播放失败:", seg.audioUrl);
          showToast(`片段「${seg.text}」播放失败`);
          resolve();
        };
        audio.play().catch((err) => {
          console.error(err);
          showToast(`片段「${seg.text}」无法播放`);
          resolve();
        });
      });
    }
  }

  function submitDzTrack() {
    const level = dzLibrary[dzCurrentLevelIndex];
    if (!level || dzTrackSegments.length === 0) {
      showToast("请先完成片段拼接。");
      return;
    }
    if (dzTrackSegments.length !== level.segments.length) {
      showToast(`请将全部 ${level.segments.length} 个片段拖入轨道后再提交。`);
      return;
    }
    const expected = level.segments.map((seg) => seg.id);
    const current = dzTrackSegments.map((seg) => seg.id);
    let correctCount = 0;
    const wrongDetail = [];
    current.forEach((id, idx) => {
      if (id === expected[idx]) {
        correctCount += 1;
      } else {
        const label = dzTrackSegments[idx]?.text || `片段${idx + 1}`;
        wrongDetail.push(`第${idx + 1}位「${label}」应为第${expected.indexOf(id) + 1}句`);
      }
    });
    const score = Math.round((correctCount / expected.length) * 100);
    const analysis =
      wrongDetail.length === 0
        ? "顺序完全正确，拼接准确还原了完整唱段。"
        : `正确片段 ${correctCount}/${expected.length}。错位分析：${wrongDetail.join("；")}`;
    renderDzResult(level, score, analysis);
  }

  if (dzLibrary.length > 0) {
    resetDuanzhangGame();
  }

  dzSourceList?.addEventListener("click", (e) => {
    const card = e.target.closest(".dz2-seg");
    if (!card) return;
    const id = card.dataset.id;
    const seg = dzSourceSegments.find((item) => item.id === id);
    const action = e.target.closest("button")?.dataset.action;
    if (action === "play" && seg) {
      playDzSegmentAudio(seg);
      return;
    }
    moveToTrack(id);
  });

  dzTrack?.addEventListener("click", (e) => {
    const card = e.target.closest(".dz2-seg");
    if (!card) return;
    const id = card.dataset.id;
    const seg = dzTrackSegments.find((item) => item.id === id);
    const action = e.target.closest("button")?.dataset.action;
    if (action === "play" && seg) {
      playDzSegmentAudio(seg);
      return;
    }
    if (action === "remove") {
      removeFromTrack(id);
    }
  });

  let dzDragId = "";
  let dzDragZone = "";

  function bindDragRoot(root) {
    root?.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".dz2-seg");
      if (!card) return;
      dzDragId = card.dataset.id || "";
      dzDragZone = card.dataset.zone || "";
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dzDragId);
    });
    root?.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
  }

  bindDragRoot(dzSourceList);
  bindDragRoot(dzTrack);

  dzTrack?.addEventListener("drop", (e) => {
    e.preventDefault();
    const targetCard = e.target.closest(".dz2-seg");
    if (!dzDragId) return;
    if (dzDragZone === "source") {
      moveToTrack(dzDragId);
      dzDragId = "";
      dzDragZone = "";
      return;
    }
    if (dzDragZone === "track" && targetCard?.dataset.id) {
      reorderTrack(dzDragId, targetCard.dataset.id);
    }
    dzDragId = "";
    dzDragZone = "";
  });

  dzSourceList?.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dzDragZone === "track" && dzDragId) {
      removeFromTrack(dzDragId);
    }
    dzDragId = "";
    dzDragZone = "";
  });

  btnDzReset?.addEventListener("click", resetDuanzhangGame);
  btnDzPlayCombined?.addEventListener("click", playDzTrack);
  btnDzConfirm?.addEventListener("click", submitDzTrack);

  dzLevels?.addEventListener("click", (e) => {
    const btn = e.target.closest(".dz2-level");
    if (!btn) return;
    const idx = Number(btn.dataset.level);
    if (Number.isNaN(idx) || idx < 0 || idx >= dzLibrary.length) return;
    dzCurrentLevelIndex = idx;
    resetDuanzhangGame();
    showToast(`已切换关卡：${dzLibrary[idx].name}`);
  });

  window.resetDuanzhangGame = resetDuanzhangGame;

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

  cardEnterBianyin?.addEventListener("click", () => {
    if (!viewOpera || viewOpera.hidden) return;
    openBianyinView();
  });
  cardEnterBianyin?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!viewOpera || viewOpera.hidden) return;
    e.preventDefault();
    openBianyinView();
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
    if (viewBianyin && !viewBianyin.hidden) {
      if (byModal && !byModal.hidden) {
        closeBianyinModal();
      } else {
        closeBianyinView();
      }
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

  /** 数字人区域：Live2D 接入与口型同步 */
  let engaged = false;
  let live2dApp = null;
  let live2dModel = null;
  let avatarFacingFront = false;
  let avatarBaseBounds = null;
  let avatarResizeObserver = null;
  let avatarReloadPromise = null;
  let avatarReloadRequested = false;
  const AVATAR_FIT_SCALE = 1.28;
  const AVATAR_Y_RATIO = 0.56;
  const SHUIMO_VISIBLE_PART_IDS = [
    "Part",
    "Part2",
    "Part3",
    "Part4",
    "Part5",
    "Part6",
    "Part7",
    "Part8",
    "Part9",
    "Part10",
    "Part11",
    "Part12",
    "Part13",
    "Part14",
    "Part15",
    "Part16",
    "Part17",
    "Part18",
    "Part19",
    "Part20",
    "Part21"
  ];

  function setLive2DParameter(parameterId, value) {
    if (!live2dModel?.internalModel?.coreModel) return;
    const core = live2dModel.internalModel.coreModel;
    try {
      if (typeof core.setParameterValueById === "function") {
        core.setParameterValueById(parameterId, value);
        return;
      }

      const count = typeof core.getParameterCount === "function" ? core.getParameterCount() : 0;
      for (let i = 0; i < count; i++) {
        const id =
          typeof core.getParameterId === "function"
            ? core.getParameterId(i)
            : typeof core.getParameterIds === "function"
              ? core.getParameterIds()[i]
              : null;
        if (id === parameterId && typeof core.setParameterValueByIndex === "function") {
          core.setParameterValueByIndex(i, value);
          break;
        }
      }
    } catch (_) {}
  }

  function setLive2DPartOpacity(partId, value) {
    if (!live2dModel?.internalModel?.coreModel) return;
    const core = live2dModel.internalModel.coreModel;
    try {
      if (typeof core.setPartOpacityById === "function") {
        core.setPartOpacityById(partId, value);
        return;
      }

      const count = typeof core.getPartCount === "function" ? core.getPartCount() : 0;
      for (let i = 0; i < count; i++) {
        const id =
          typeof core.getPartId === "function"
            ? core.getPartId(i)
            : typeof core.getPartIds === "function"
              ? core.getPartIds()[i]
              : null;
        if (id === partId && typeof core.setPartOpacityByIndex === "function") {
          core.setPartOpacityByIndex(i, value);
          break;
        }
      }
    } catch (_) {}
  }

  function keepShuimoAvatarPartsVisible() {
    SHUIMO_VISIBLE_PART_IDS.forEach((partId) => setLive2DPartOpacity(partId, 1));
  }

  /** 水墨模型自带预览水印，由参数 Param24「水印关闭」控制，需在每帧覆盖以免待机动作写回 */
  function hideShuimoWatermark() {
    setLive2DParameter("Param24", 1);
  }

  function keepAvatarFacingFront() {
    if (!avatarFacingFront) return;
    try {
      live2dModel?.focus?.(live2dApp.renderer.width / 2, live2dApp.renderer.height / 2);
      const focusController = live2dModel?.internalModel?.focusController || live2dModel?.focusController;
      if (focusController) {
        focusController.targetX = 0;
        focusController.targetY = 0;
        focusController.x = 0;
        focusController.y = 0;
      }
    } catch (_) {}
    setLive2DParameter("ParamAngleX", 0);
    setLive2DParameter("ParamAngleY", 0);
    setLive2DParameter("ParamAngleZ", 0);
    setLive2DParameter("ParamBodyAngleX", 0);
    setLive2DParameter("ParamBodyAngleY", 0);
    setLive2DParameter("ParamBodyAngleZ", 0);
    setLive2DParameter("ParamEyeBallX", 0);
    setLive2DParameter("ParamEyeBallY", 0);
  }

  function isHomeViewVisible() {
    return !viewHome?.hidden && viewHome?.getAttribute("aria-hidden") !== "true";
  }

  function scheduleLive2DRefit() {
    if (!live2dApp || !live2dModel) return;

    const refit = () => {
      fitLive2DAvatar();
      if (!avatarFacingFront) {
        try {
          live2dModel.focus?.(live2dApp.renderer.width / 2, live2dApp.renderer.height / 2);
        } catch (_) {}
      }
    };

    requestAnimationFrame(() => {
      refit();
      requestAnimationFrame(refit);
    });
    window.setTimeout(refit, 120);
    window.setTimeout(refit, 360);
  }

  function restoreLive2DForVisibleHome() {
    showAvatarLoading(false);
    if (!live2dApp) {
      initLive2DAvatar();
      return;
    }
    if (live2dApp.ticker && !live2dApp.ticker.started) {
      live2dApp.ticker.start();
    }
    reloadLive2DModel();
  }

  function prepareLive2DForHiddenView() {
    avatarFacingFront = false;
    avatarReloadRequested = true;
    if (live2dModel) {
      try { live2dModel.stopSpeaking?.(); } catch (_) {}
    }
  }

  function showAvatarLoading(show) {
    const el = document.getElementById("live2d-loading");
    if (!el) return;
    el.hidden = !show;
  }

  async function reloadLive2DModel() {
    if (!live2dApp || !window.PIXI?.live2d?.Live2DModel) return;
    if (!avatarReloadRequested) {
      scheduleLive2DRefit();
      return;
    }
    if (avatarReloadPromise) return avatarReloadPromise;

    const modelUrl = digitalHost?.dataset?.live2dModel;
    if (!modelUrl) return;

    showAvatarLoading(true);
    avatarReloadPromise = (async () => {
      try {
        const previous = live2dModel;
        const Live2DModel = window.PIXI.live2d.Live2DModel;
        const fresh = await Live2DModel.from(modelUrl);
        live2dApp.stage.addChild(fresh);
        if (previous) {
          live2dApp.stage.removeChild(previous);
          try { previous.destroy({ children: true, texture: false, baseTexture: false }); } catch (_) {}
        }
        live2dModel = fresh;
        avatarBaseBounds = null;
        avatarFacingFront = false;
        fitLive2DAvatar();
        keepShuimoAvatarPartsVisible();
        hideShuimoWatermark();
        scheduleLive2DRefit();
        avatarReloadRequested = false;
        if (avatarStatus) avatarStatus.textContent = "点击人物测试口型同步";
      } catch (error) {
        console.error("Live2D 模型重载失败:", error);
        if (avatarStatus) avatarStatus.textContent = "数字人恢复失败，请刷新页面";
      } finally {
        showAvatarLoading(false);
        avatarReloadPromise = null;
      }
    })();
    return avatarReloadPromise;
  }

  async function initLive2DAvatar() {
    const modelUrl = digitalHost?.dataset?.live2dModel;
    const canvas = document.getElementById("live2d-canvas");
    const fallbackImg = digitalHost?.querySelector(".avatar-panel__img");

    if (!canvas || !modelUrl) {
      if (avatarStatus) avatarStatus.textContent = "未配置模型路径（可先使用静态图）";
      return;
    }

    if (!window.PIXI || !window.PIXI.live2d?.Live2DModel) {
      if (avatarStatus) avatarStatus.textContent = "Live2D 运行时未加载成功";
      return;
    }

    showAvatarLoading(true);
    try {
      const frame = canvas.parentElement;
      const frameRect = frame.getBoundingClientRect();

      live2dApp = new window.PIXI.Application({
        view: canvas,
        width: Math.max(1, Math.round(frameRect.width)),
        height: Math.max(1, Math.round(frameRect.height)),
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        antialias: true,
        backgroundAlpha: 0
      });

      const Live2DModel = window.PIXI.live2d.Live2DModel;
      live2dModel = await Live2DModel.from(modelUrl);

      live2dApp.stage.addChild(live2dModel);
      avatarBaseBounds = null;
      avatarReloadRequested = false;
      fitLive2DAvatar();
      window.addEventListener("resize", scheduleLive2DRefit);
      avatarResizeObserver = new ResizeObserver(scheduleLive2DRefit);
      avatarResizeObserver.observe(frame);
      live2dApp.ticker.add(keepAvatarFacingFront, undefined, -1000);

      if (modelUrl.includes("水墨")) {
        hideShuimoWatermark();
        keepShuimoAvatarPartsVisible();
        live2dApp.ticker.add(hideShuimoWatermark, undefined, -1000);
        live2dApp.ticker.add(keepShuimoAvatarPartsVisible, undefined, -999);
      }

      fallbackImg?.classList.add("avatar-panel__img--hidden");
      if (avatarStatus) avatarStatus.textContent = "点击人物测试口型同步";
    } catch (error) {
      console.error("Live2D 初始化失败:", error);
      if (avatarStatus) avatarStatus.textContent = "模型加载失败，当前使用静态图";
    } finally {
      showAvatarLoading(false);
    }
  }

  function fitLive2DAvatar() {
    const canvas = document.getElementById("live2d-canvas");
    const frame = canvas?.parentElement;
    if (!live2dApp || !live2dModel || !frame) return;
    if (!isHomeViewVisible()) return;

    const frameRect = frame.getBoundingClientRect();
    const width = Math.max(1, Math.round(frameRect.width));
    const height = Math.max(1, Math.round(frameRect.height));
    if (width < 20 || height < 20) return;
    live2dApp.renderer.resize(width, height);

    live2dModel.scale.set(1);
    live2dModel.pivot.set(0, 0);
    if (!avatarBaseBounds) {
      const bounds = live2dModel.getLocalBounds();
      avatarBaseBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      };
    }

    const bounds = avatarBaseBounds;
    const scale = Math.min((width * AVATAR_FIT_SCALE) / bounds.width, (height * AVATAR_FIT_SCALE) / bounds.height);

    live2dModel.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    live2dModel.scale.set(scale);
    live2dModel.x = width / 2;
    live2dModel.y = height * AVATAR_Y_RATIO;
  }

  function speakWithAvatar(audioUrl, options = {}) {
    if (!live2dModel || !audioUrl) return;
    avatarFacingFront = true;
    keepAvatarFacingFront();
    if (avatarStatus) avatarStatus.textContent = "数字人讲解中...";
    return live2dModel.speak(audioUrl, {
      volume: 1,
      crossOrigin: "anonymous",
      ...options,
      onFinish: () => {
        avatarFacingFront = false;
        if (avatarStatus) avatarStatus.textContent = "讲解完成";
        if (typeof options.onFinish === "function") options.onFinish();
      },
      onError: (err) => {
        avatarFacingFront = false;
        console.error("Live2D 语音播放失败:", err);
        if (avatarStatus) avatarStatus.textContent = "语音播放失败";
        if (typeof options.onError === "function") options.onError(err);
      }
    });
  }

  async function synthesizeAvatarSpeech(text, options = {}) {
    const response = await fetch("/api/tts/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        voice: options.voice || "shuimo",
        dialect: options.dialect || "demo"
      })
    });

    if (!response.ok) {
      throw new Error(`TTS 接口请求失败：${response.status}`);
    }

    const result = await response.json();
    if (result.code !== 0 || !result.data?.audioUrl) {
      throw new Error(result.message || "TTS 接口未返回音频地址");
    }

    return result.data;
  }

  async function demoAvatarLipSync(text = "你好，我是水墨数字人。现在正在展示音频驱动的口型同步效果。") {
    try {
      if (avatarStatus) avatarStatus.textContent = "正在合成演示语音...";
      const { audioUrl } = await synthesizeAvatarSpeech(text);
      speakWithAvatar(audioUrl);
    } catch (error) {
      console.error("口型同步演示失败:", error);
      if (avatarStatus) avatarStatus.textContent = "口型演示失败，请检查 TTS 接口";
      showToast("口型同步演示失败，请查看控制台。");
    }
  }

  function stopAvatarSpeaking() {
    if (!live2dModel) return;
    avatarFacingFront = false;
    live2dModel.stopSpeaking();
    if (avatarStatus) avatarStatus.textContent = "已停止讲解";
  }

  window.speakWithAvatar = speakWithAvatar;
  window.synthesizeAvatarSpeech = synthesizeAvatarSpeech;
  window.demoAvatarLipSync = demoAvatarLipSync;
  window.stopAvatarSpeaking = stopAvatarSpeaking;

  function toggleDigitalHost() {
    engaged = !engaged;
    if (!engaged) {
      stopAvatarSpeaking();
      showToast("数字人已切换到待机状态。");
      return;
    }

    if (avatarStatus) {
      avatarStatus.textContent = live2dModel ? "已唤醒，可播放语音" : "已唤醒（模型加载中）";
    }
    showToast("正在播放口型同步演示。");
    demoAvatarLipSync();
  }

  digitalHost?.addEventListener("click", toggleDigitalHost);
  digitalHost?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDigitalHost();
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (!isHomeViewVisible()) return;

    if (event.persisted && live2dApp && live2dModel) {
      // BFCache 恢复：模型实例仍在内存，不需要重新加载，直接恢复视觉状态
      avatarReloadRequested = false;
      avatarFacingFront = false;
      if (live2dApp.ticker && !live2dApp.ticker.started) {
        live2dApp.ticker.start();
      }
      keepShuimoAvatarPartsVisible();
      hideShuimoWatermark();
      scheduleLive2DRefit();
      if (avatarStatus) avatarStatus.textContent = "点击人物测试口型同步";
      return;
    }

    // 非 BFCache（页面重新加载等场景）走完整恢复流程
    restoreLive2DForVisibleHome();
  });

  window.addEventListener("pagehide", prepareLive2DForHiddenView);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      prepareLive2DForHiddenView();
    } else if (isHomeViewVisible()) {
      restoreLive2DForVisibleHome();
    }
  });

  initLive2DAvatar();

  // 入戏念白功能实现
  let currentPlayingSource = null;
  let currentAudioBlob = null;
  let currentBgImage = null;

  async function playCombinedNianbaiAudio(pre1Url, userText, pre2Url) {
    if (currentPlayingSource) {
      currentPlayingSource.stop();
      currentPlayingSource = null;
    }

    const pre1Buffer = await loadAudioBuffer(pre1Url);
    const ttsBuffer = await generateMockTTSAudio(userText);
    const pre2Buffer = await loadAudioBuffer(pre2Url);

    const totalLength = pre1Buffer.duration + ttsBuffer.duration + pre2Buffer.duration;
    const combinedBuffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * totalLength,
      audioContext.sampleRate
    );

    let offset = 0;
    combinedBuffer.getChannelData(0).set(pre1Buffer.getChannelData(0), offset);
    offset += pre1Buffer.length;
    combinedBuffer.getChannelData(0).set(ttsBuffer.getChannelData(0), offset);
    offset += ttsBuffer.length;
    combinedBuffer.getChannelData(0).set(pre2Buffer.getChannelData(0), offset);

    const source = audioContext.createBufferSource();
    source.buffer = combinedBuffer;
    source.connect(audioContext.destination);
    source.start();
    currentPlayingSource = source;

    // 存储当前组合音频的 Blob，用于分享
    const offlineContext = new OfflineAudioContext(1, combinedBuffer.length, audioContext.sampleRate);
    const offlineSource = offlineContext.createBufferSource();
    offlineSource.buffer = combinedBuffer;
    offlineSource.connect(offlineContext.destination);
    offlineSource.start();
    const renderedBuffer = await offlineContext.startRendering();
    const wavBlob = await audioBufferToWaveBlob(renderedBuffer);
    currentAudioBlob = wavBlob;

    // 可视化波形图
    drawWaveform(combinedBuffer);
  }

  function audioBufferToWaveBlob(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels, 
          length = audioBuffer.length * numOfChan, 
          result = new Float32Array(length),
          nowBuffering = audioBuffer.getChannelData(0);
    let index = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      result[index++] = nowBuffering[i];
    }

    const worker = new Worker(
      URL.createObjectURL(
        new Blob(
          [`
          self.onmessage = function(e) {
            const data = e.data.audioData;
            const sampleRate = e.data.sampleRate;
            const numChannels = e.data.numChannels;
            const bytesPerSample = 2; // 16-bit
            const blockAlign = numChannels * bytesPerSample;
            const byteRate = sampleRate * blockAlign;

            function writeString(view, offset, string) {
              for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            }

            function floatTo16BitPCM(output, offset, input) {
              for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
              }
            }

            const dataLength = data.length * bytesPerSample;
            const buffer = new ArrayBuffer(44 + dataLength);
            const view = new DataView(buffer);

            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataLength, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, byteRate, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bytesPerSample * 8, true);
            writeString(view, 36, 'data');
            view.setUint32(40, dataLength, true);

            floatTo16BitPCM(view, 44, data);

            self.postMessage(view.buffer, [view.buffer]);
          };
        `],
          { type: 'application/javascript' }
        )
      )
    );
    
    return new Promise(resolve => {
      worker.onmessage = (e) => {
        const blob = new Blob([e.data], { type: 'audio/wav' });
        resolve(blob);
      };
      worker.postMessage({ audioData: result, sampleRate: audioContext.sampleRate, numChannels: numOfChan });
    });
  }

  function drawWaveform(audioBuffer) {
    if (!nbWaveVisualizer) return;
    nbWaveVisualizer.innerHTML = ""; // 清除旧的波形图

    const canvas = document.createElement("canvas");
    canvas.width = nbWaveVisualizer.offsetWidth;
    canvas.height = nbWaveVisualizer.offsetHeight;
    nbWaveVisualizer.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const data = audioBuffer.getChannelData(0); // 获取第一个通道的数据
    const step = Math.ceil(data.length / canvas.width); // 每列取样点
    const amp = canvas.height / 2; // 振幅

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1d5d56"; // 波形颜色
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, amp);
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
  }

  btnNbGenerate?.addEventListener("click", async () => {
    const userInput = nbUserInput?.value.trim() || "";
    if (!userInput) {
      showToast("请输入你的名字或自定义文本。");
      return;
    }
    // 模拟的预录音频路径
    const pre1Audio = "assets/audio/nianbai-pre1.mp3"; // "小生乃是那——"
    const pre2Audio = "assets/audio/nianbai-pre2.mp3"; // "——是也！"

    showToast("正在拼接并生成语音...");
    await playCombinedNianbaiAudio(pre1Audio, userInput, pre2Audio);
    showToast("语音生成成功，请试听。");

    // 显示分享卡片区域
    nbShareCardContainer.hidden = false;
  });

  // 背景图选择与预览
  nbBgUpload?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          nbBackgroundPreview.innerHTML = '';
          nbBackgroundPreview.appendChild(img);
          currentBgImage = img;
        };
      };
      reader.readAsDataURL(file);
    }
  });

  // 生成分享卡片
  btnNbShare?.addEventListener("click", async () => {
    if (!nbShareCanvas || !currentAudioBlob) {
      showToast("请先生成语音并选择背景图。");
      return;
    }

    const ctx = nbShareCanvas.getContext("2d");
    const canvasWidth = nbShareCanvas.width;
    const canvasHeight = nbShareCanvas.height;

    // 1. 绘制背景
    if (currentBgImage) {
      ctx.drawImage(currentBgImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = "#fef6e1"; // 默认背景色
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // 2. 绘制标题
    ctx.font = "bold 30px 'Songti SC', serif";
    ctx.fillStyle = "#1a3d36";
    ctx.textAlign = "center";
    ctx.fillText("我的戏韵明信片", canvasWidth / 2, 50);

    // 3. 绘制用户输入文本
    ctx.font = "20px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#3a4a49";
    ctx.fillText(nbUserInput.value, canvasWidth / 2, 100);

    // 4. 绘制二维码 (模拟)
    const qrCodeSize = 100;
    const qrCodeX = (canvasWidth - qrCodeSize) / 2;
    const qrCodeY = canvasHeight - qrCodeSize - 30;
    ctx.fillStyle = "#1a3d36";
    ctx.fillRect(qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
    ctx.font = "12px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("扫码听我", canvasWidth / 2, qrCodeY + qrCodeSize / 2 + 5); // 模拟二维码文字

    // 5. 导出并分享
    const dataUrl = nbShareCanvas.toDataURL("image/png");
    // 在实际应用中，这里可以将 dataUrl 上传到服务器或直接提供下载/分享链接
    console.log("分享卡片 Data URL:", dataUrl);
    showToast("分享卡片已生成，请查看控制台或自行保存。");
    
    // 模拟提供下载
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = '戏韵明信片.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
})();
