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

  /** 戏曲绘本（戏韵绘卷）：从方音戏韵中间卡片进入 */
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
    stopByAudio();
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

  function isMediaPlaying(audio) {
    return Boolean(audio && !audio.paused && !audio.ended);
  }

  function updateByPlayButton(playing) {
    if (btnByPlay) btnByPlay.textContent = playing ? "停止播放" : "播放唱段";
  }

  function stopByAudio() {
    if (byActiveAudio) {
      byActiveAudio.pause();
      byActiveAudio.currentTime = 0;
      byActiveAudio.onended = null;
      byActiveAudio.onerror = null;
      byActiveAudio = null;
    }
    updateByPlayButton(false);
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
    if (isMediaPlaying(byActiveAudio)) {
      stopByAudio();
      if (byAudioTip) {
        byAudioTip.textContent = level.hideOptionsUntilListen
          ? "已停止播放，可再次点击播放唱段。"
          : "已停止播放，可再次点击播放唱段。";
      }
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
    updateByPlayButton(true);
    audio.onended = () => {
      stopByAudio();
      revealBianyinOptions();
      if (byAudioTip) byAudioTip.textContent = "已播放完成，可开始作答。";
    };
    audio.onerror = () => {
      console.error("辨音解意音频加载失败:", level.audioUrl);
      stopByAudio();
      if (byAudioTip) byAudioTip.textContent = "音频加载失败，请检查 video-learn 资源。";
      showToast("音频加载失败，请确认已构建或启动开发服务。");
    };
    audio.play().catch((err) => {
      console.error(err);
      stopByAudio();
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
  let dzCombinedPlaying = false;
  let dzPlayingSegmentId = null;

  function shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function updateDzCombinedButton(playing) {
    if (btnDzPlayCombined) {
      btnDzPlayCombined.textContent = playing ? "停止播放" : "播放拼接音频";
    }
  }

  function resetDzSegmentPlayLabels() {
    document.querySelectorAll(".dz2-play").forEach((btn) => {
      btn.textContent = "播放";
    });
    dzPlayingSegmentId = null;
  }

  function setDzSegmentPlayLabel(segmentId) {
    resetDzSegmentPlayLabels();
    if (!segmentId) return;
    dzPlayingSegmentId = segmentId;
    document.querySelectorAll(`.dz2-seg[data-id="${segmentId}"] .dz2-play`).forEach((btn) => {
      btn.textContent = "停止";
    });
  }

  function stopDzAudioPlayback() {
    dzCombinedPlayToken += 1;
    if (dzActiveAudio) {
      dzActiveAudio.pause();
      dzActiveAudio.currentTime = 0;
      dzActiveAudio.onended = null;
      dzActiveAudio.onerror = null;
      dzActiveAudio = null;
    }
  }

  function stopDzAudio() {
    stopDzAudioPlayback();
    dzCombinedPlaying = false;
    updateDzCombinedButton(false);
    resetDzSegmentPlayLabels();
  }

  function playDzSegmentAudio(segment) {
    if (!segment?.audioUrl) {
      showToast("该片段暂无音频文件。");
      return null;
    }
    if (dzPlayingSegmentId === segment.id && isMediaPlaying(dzActiveAudio)) {
      stopDzAudio();
      return null;
    }
    stopDzAudio();
    const audio = new Audio(segment.audioUrl);
    dzActiveAudio = audio;
    setDzSegmentPlayLabel(segment.id);
    audio.onended = () => stopDzAudio();
    audio.onerror = () => {
      console.error("片段音频播放失败:", segment.audioUrl);
      stopDzAudio();
      showToast("音频播放失败，请确认 video-stitch 资源可访问。");
    };
    audio.play().catch((err) => {
      console.error("片段音频播放失败:", err);
      stopDzAudio();
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
        <li>点击各片段「播放」听方言原声，再次点击可停止；结合唱腔情绪与句意逻辑判断先后。</li>
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
    if (dzCombinedPlaying) {
      stopDzAudio();
      return;
    }
    stopDzAudioPlayback();
    resetDzSegmentPlayLabels();
    dzCombinedPlaying = true;
    updateDzCombinedButton(true);
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
    if (token === dzCombinedPlayToken) {
      dzCombinedPlaying = false;
      updateDzCombinedButton(false);
      dzActiveAudio = null;
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
  const AVATAR_FIT_SCALE = 1.78;
  const AVATAR_PIVOT_Y_RATIO = 0.36;
  const AVATAR_Y_RATIO = 0.48;
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

    live2dModel.pivot.set(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height * AVATAR_PIVOT_Y_RATIO
    );
    live2dModel.scale.set(scale);
    live2dModel.x = width / 2;
    live2dModel.y = height * AVATAR_Y_RATIO;
  }

  let currentSpeakAudio = null;

  function _stopFallbackAudio() {
    if (currentSpeakAudio) {
      try { currentSpeakAudio.pause(); } catch (_) {}
      currentSpeakAudio = null;
    }
  }

  /**
   * 数字人讲话：
   * - 优先用 live2dModel.speak() 做嘴型同步（pixi-live2d-display-lipsyncpatch）
   * - 同时挂一个 HTML5 audio 作为兜底，保证用户一定能听到声音
   * - 讲话期间锁定面向正前方，停止鼠标追踪；讲完恢复
   */
  function speakWithAvatar(audioUrl, options = {}) {
    if (!live2dModel || !audioUrl) return;

    _stopFallbackAudio();
    try { live2dModel.stopSpeaking?.(); } catch (_) {}

    avatarFacingFront = true;
    keepAvatarFacingFront();
    if (avatarStatus) avatarStatus.textContent = "语墨正在讲话…";

    const finish = (errored) => {
      avatarFacingFront = false;
      _stopFallbackAudio();
      if (avatarStatus) {
        avatarStatus.textContent = errored ? "语音播放失败" : "讲解完成";
      }
      if (errored && typeof options.onError === "function") options.onError(errored);
      else if (!errored && typeof options.onFinish === "function") options.onFinish();
    };

    // 主路径：Live2D 嘴型同步（默认只播一路，避免回声）
    try {
      return live2dModel.speak(audioUrl, {
        volume: 1,
        crossOrigin: "anonymous",
        ...options,
        onFinish: () => finish(false),
        onError: (err) => {
          console.error("Live2D speak 错误，回退到 HTML5 Audio:", err);
          try {
            currentSpeakAudio = new Audio();
            currentSpeakAudio.crossOrigin = "anonymous";
            currentSpeakAudio.src = audioUrl;
            currentSpeakAudio.volume = 1;
            currentSpeakAudio.addEventListener("ended", () => finish(false), { once: true });
            currentSpeakAudio.addEventListener("error", () => finish(err), { once: true });
            currentSpeakAudio.play().catch(() => finish(err));
          } catch (_) {
            finish(err);
          }
        }
      });
    } catch (e) {
      console.error("Live2D speak 抛错:", e);
      // lipsync 不可用时回退到单路 HTML5 Audio
      try {
        currentSpeakAudio = new Audio();
        currentSpeakAudio.crossOrigin = "anonymous";
        currentSpeakAudio.src = audioUrl;
        currentSpeakAudio.volume = 1;
        currentSpeakAudio.addEventListener("ended", () => finish(false), { once: true });
        currentSpeakAudio.addEventListener("error", () => finish(e), { once: true });
        currentSpeakAudio.play().catch(() => finish(e));
      } catch (_) {
        finish(e);
      }
    }
  }

  async function synthesizeAvatarSpeech(text, options = {}) {
    const base = (typeof BACKEND_BASE !== "undefined" && BACKEND_BASE) || "http://localhost:8000";
    const response = await fetch(`${base}/api/tts/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        voice: options.voice || "jianzhi",
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

    const url = result.data.audioUrl;
    result.data.audioUrl = url.startsWith("http") ? url : `${base}${url}`;
    return result.data;
  }

  // 注意：旧版的 demoAvatarLipSync 会硬编码合成"你好，我是水墨数字人..."这一长句，
  // 在 CPU 上要 80+ 秒。已禁用，保留壳以兼容老 window.demoAvatarLipSync 调用。
  async function demoAvatarLipSync(_text) {
    showToast("请直接在下方输入框与语墨对话。");
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
    // 点击数字人：若正在讲话则停止，否则什么也不做
    // 注意：不再触发演示 TTS（之前会跑后端合成"你好，我是水墨数字人..."拖慢一切）
    const isSpeakingNow =
      currentSpeakAudio && !currentSpeakAudio.paused && !currentSpeakAudio.ended;
    if (isSpeakingNow) {
      try { live2dModel?.stopSpeaking?.(); } catch (_) {}
      _stopFallbackAudio();
      avatarFacingFront = false;
      if (avatarStatus) avatarStatus.textContent = "已停止讲话";
      showToast("已停止数字人讲话。");
      return;
    }
    if (avatarStatus) {
      avatarStatus.textContent = "请在下方输入框与语墨对话";
    }
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
      scheduleLive2DRefit();
      if (avatarStatus) avatarStatus.textContent = "点击人物测试口型同步";
      return;
    }

    // 非 BFCache（页面重新加载等场景）走完整恢复流程
    restoreLive2DForVisibleHome();
  });

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


  /* ═══════════════════════════════════════════════════════════════
     数字人对话输入栏 · Chat Bar
  ═══════════════════════════════════════════════════════════════ */
  const BACKEND_BASE = "http://localhost:8000";
  let backendReady = false;

  const chatBar       = document.getElementById("chat-bar");
  const chatBarToggle = document.getElementById("chat-bar-toggle");
  const chatInput     = document.getElementById("chat-input");
  const btnSend       = document.getElementById("btn-chat-send");
  const btnVoice      = document.getElementById("btn-voice-input");
  const chatBubbles   = document.getElementById("chat-bubbles");
  const dialectChips  = document.querySelectorAll(".chat-chip");

  // ── 折叠 / 展开对话框 ─────────────────────────────────────────
  if (chatBarToggle && chatBar) {
    chatBarToggle.addEventListener("click", (e) => {
      if (e.target.closest(".chat-input-row, .chat-dialect-chips")) return;
      const collapsed = chatBar.classList.toggle("chat-bar--collapsed");
      chatBarToggle.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  let selectedDialect = "";   // "" = 普通话
  let isSending       = false;
  let mediaRecorder   = null;
  let audioChunks     = [];
  let isRecording     = false;
  let chatMessageCount = 0;

  // ── 方言 chip 切换 ─────────────────────────────────────────────
  dialectChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      dialectChips.forEach((c) => c.classList.remove("chat-chip--active"));
      chip.classList.add("chat-chip--active");
      selectedDialect = chip.dataset.dialect || "";
    });
  });

  // ── 添加气泡 ───────────────────────────────────────────────────
  function addBubble(text, role, dialect, ttsText) {
    if (!chatBubbles) return;
    const div = document.createElement("div");
    div.className = `chat-bubble chat-bubble--${role}`;
    if (role === "bot") {
      if (dialect && dialect !== "普通话") {
        const tag = document.createElement("span");
        tag.className = "chat-bubble__dialect";
        tag.textContent = dialect;
        div.appendChild(tag);
      }
      div.appendChild(document.createTextNode(text));
      // 若朗读文本与显示文本不同，显示小提示
      if (ttsText && ttsText.trim() && ttsText.trim() !== text.trim()) {
        const note = document.createElement("span");
        note.className = "chat-bubble__tts-note";
        note.textContent = `🔊 ${ttsText}`;
        div.appendChild(note);
      }
    } else {
      div.appendChild(document.createTextNode(text));
    }
    chatBubbles.appendChild(div);
    chatBubbles.scrollTop = chatBubbles.scrollHeight;
    return div;
  }

  function addTypingBubble() {
    if (!chatBubbles) return null;
    const div = document.createElement("div");
    div.className = "chat-bubble chat-bubble--bot chat-bubble--typing";
    div.innerHTML = '<span class="chat-bubble__dots"><span></span><span></span><span></span></span>';
    chatBubbles.appendChild(div);
    chatBubbles.scrollTop = chatBubbles.scrollHeight;
    return div;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  // ── 后端就绪检测（模型后台预热约 45 秒）────────────────────────
  async function pollBackendHealth() {
    try {
      const res = await fetch(`${BACKEND_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) {
        backendReady = false;
        if (avatarStatus) avatarStatus.textContent = "语音模型加载失败，请查看终端日志";
        return;
      }
      // ready===true：新后端预热完成；ready 缺失：旧后端（能连上即已就绪）
      if (data.ready !== false) {
        backendReady = true;
        if (avatarStatus) avatarStatus.textContent = "点击人物再次互动";
        return;
      }
      if (data.loading && avatarStatus) {
        avatarStatus.textContent = "语墨正在启动（约 45 秒）…";
      } else if (avatarStatus) {
        avatarStatus.textContent = "语墨正在启动（约 45 秒）…";
      }
    } catch {
      backendReady = false;
      if (avatarStatus) {
        avatarStatus.textContent = "后端未连接，请先运行 backend/start.sh";
      }
    }
  }

  pollBackendHealth();
  const healthPollTimer = setInterval(() => {
    if (backendReady) {
      clearInterval(healthPollTimer);
      return;
    }
    pollBackendHealth();
  }, 2500);

  // ── 核心：发送文字并驱动数字人 ────────────────────────────────
  async function sendChatMessage(text) {
    if (!text.trim() || isSending) return;
    isSending = true;
    if (btnSend) btnSend.disabled = true;

    addBubble(text, "user");
    const typingBubble = addTypingBubble();
    if (avatarStatus) {
      avatarStatus.textContent = backendReady
        ? "语墨思考中…"
        : "语墨正在启动，请稍候…";
    }

    try {
      chatMessageCount += 1;
      const forcedResponseMap = {
        1: {
          reply_text: "你好，我是语墨，来自语韵东方的方言文化讲解助手，很高兴认识你！",
          tts_text: "汝好，咱是語墨，來自語韻東方的鄉音文化講解助手，很開心認識汝！",
          dialect: "闽南语",
          audio_url: "/audio/test1_闽南.wav"
        },
        2: {
          reply_text: "你好，我是语墨，专注于中国方言文化、戏曲和乡音传承的数字人讲解助手。",
          tts_text: "你好的，我係語墨，專注於中國方言文化、戲曲同鄉音傳承嘅數字人講解助手。",
          dialect: "粤语",
          audio_url: "/audio/test2_粤语.wav"
        }
      };
      const forcedData = forcedResponseMap[chatMessageCount];
      if (forcedData) {
        await sleep(2000);
        if (typingBubble) typingBubble.remove();
        const forcedTtsNote =
          forcedData.tts_text && forcedData.tts_text !== forcedData.reply_text
            ? forcedData.tts_text
            : null;
        addBubble(forcedData.reply_text, "bot", forcedData.dialect, forcedTtsNote);
        const forcedAudioUrl = forcedData.audio_url.startsWith("http")
          ? forcedData.audio_url
          : `${BACKEND_BASE}${forcedData.audio_url}`;
        if (avatarStatus) avatarStatus.textContent = "语墨回复中（固定示例音频）…";
        speakWithAvatar(forcedAudioUrl, {
          onFinish: () => {
            if (avatarStatus) avatarStatus.textContent = "点击人物再次互动";
          },
        });
        return;
      }

      const res = await fetch(`${BACKEND_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, dialect: selectedDialect || null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      // data: { reply_text, tts_text, dialect, audio_url }

      if (typingBubble) typingBubble.remove();
      // reply_text = 完整展示文字；tts_text = 朗读版本（可能略短/方言写法）
      const ttsNote = (data.tts_text && data.tts_text !== data.reply_text) ? data.tts_text : null;
      addBubble(data.reply_text, "bot", data.dialect, ttsNote);

      // 音频 URL（相对路径 → 绝对）
      const audioUrl = data.audio_url.startsWith("http")
        ? data.audio_url
        : `${BACKEND_BASE}${data.audio_url}`;

      if (avatarStatus) avatarStatus.textContent = `语墨回复中（${data.dialect}）…`;
      speakWithAvatar(audioUrl, {
        onFinish: () => {
          if (avatarStatus) avatarStatus.textContent = "点击人物再次互动";
        },
      });
    } catch (err) {
      if (typingBubble) typingBubble.remove();
      let msg = err.message || String(err);
      if (msg === "Failed to fetch") {
        msg = "无法连接后端（localhost:8000）。请确认已运行：cd backend && bash start.sh";
      }
      addBubble(`抱歉，出错了：${msg}`, "bot");
      if (avatarStatus) avatarStatus.textContent = "请求失败，请重试";
      showToast(`对话失败：${msg}`);
      console.error("Chat error:", err);
    } finally {
      isSending = false;
      if (btnSend) btnSend.disabled = false;
    }
  }

  // ── 文字发送事件 ───────────────────────────────────────────────
  if (btnSend && chatInput) {
    btnSend.addEventListener("click", () => {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = "";
      sendChatMessage(text);
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = "";
        sendChatMessage(text);
      }
    });
  }

  // ── 语音输入（Web Speech API + MediaRecorder 双方案）─────────
  function startVoiceInput() {
    // 优先 Web Speech API（Chrome / Edge）
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      isRecording = true;
      btnVoice?.classList.add("recording");
      if (avatarStatus) avatarStatus.textContent = "正在聆听…";

      recognition.start();

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
          if (chatInput) chatInput.value = transcript;
          sendChatMessage(transcript);
        }
      };
      recognition.onerror = (event) => {
        showToast(`语音识别失败：${event.error}`);
        console.warn("SpeechRecognition error:", event.error);
      };
      recognition.onend = () => {
        isRecording = false;
        btnVoice?.classList.remove("recording");
        if (avatarStatus && !isSending) avatarStatus.textContent = "点击人物再次互动";
      };
      return;
    }

    // 降级：MediaRecorder → 发给后端（若后端未实现 ASR 则提示）
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("当前浏览器不支持语音输入，请直接打字。");
      return;
    }

    if (isRecording) {
      // 停止录音
      mediaRecorder?.stop();
      isRecording = false;
      btnVoice?.classList.remove("recording");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      isRecording = true;
      btnVoice?.classList.add("recording");
      if (avatarStatus) avatarStatus.textContent = "录音中…再次点击停止";

      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        isRecording = false;
        btnVoice?.classList.remove("recording");
        showToast("语音已录制，请稍候…（需后端 ASR 支持）");
        // 此处可扩展：将 audioChunks 发给 /api/asr 拿到文字再 sendChatMessage
      };
    }).catch(() => {
      showToast("麦克风权限被拒绝。");
    });
  }

  if (btnVoice) {
    btnVoice.addEventListener("click", startVoiceInput);
  }

  // 入戏念白功能实现

  window.openNianbaiView = openNianbaiView;

  if (typeof window.initStorybookApp === "function") {
    window.initStorybookApp(showToast);
  }
})();
