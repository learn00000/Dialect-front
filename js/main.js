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
  }

  function openOperaView() {
    if (!viewHome || !viewOpera) return;
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
    if (btn.classList.contains("feature-card__cta--link")) return;
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
    closeDuanzhangView();
  });
  btnNbBack?.addEventListener("click", () => {
    closeNianbaiView();
  });
  btnByBack?.addEventListener("click", () => {
    closeBianyinView();
  });

  const byLevels = [
    {
      id: "mnx",
      icon: "🎭",
      genreName: "闽南戏",
      dialectName: "闽南语",
      question: "聆听本段方言戏韵，选出对应的文辞与文化内涵（本题请选：戏曲原文文辞）",
      audioLine: "腹内饥肠辘辘，怎生耐得今宵长夜。",
      options: {
        A: "我现在肚子很饿，夜里更难熬。",
        B: "腹内饥肠辘辘，怎生耐得今宵长夜。",
        C: "“腹内”“怎生”属闽南语保留的古汉语表达层，体现文白并行的口传传统。"
      },
      answer: "B",
      explain: {
        original: "腹内饥肠辘辘，怎生耐得今宵长夜。",
        meaning: "肚子饿得厉害，今夜漫长实在难以熬过。",
        source: "闽南传统戏曲常见行腔句式（示例唱段）",
        genre: "闽南戏重口传与南音声腔，保留大量古词与文言句式。",
        dialect: "声调抑扬明显，入声保留较多，语汇中“腹内”“怎生”具古意。",
        etymology: "“腹内”见于中古书面语，“怎生”源自古汉语疑问副词结构，沿海方言中存续。",
        culture: "用词不直接说“饿”，而借文辞渲染境况，体现戏曲“辞情并重”的审美。"
      }
    },
    {
      id: "yueju",
      icon: "🪭",
      genreName: "越剧",
      dialectName: "吴语",
      question: "聆听唱段后，选出最贴合该句文化溯源的一项（本题请选：方言文化溯源注解）",
      audioLine: "月下侬心似水，且把旧梦细细分陈。",
      options: {
        A: "月光下我的心很平静，我慢慢讲起往事。",
        B: "月下侬心似水，且把旧梦细细分陈。",
        C: "“侬”是吴语第一人称系统古层遗存，和“分陈”并用形成书面雅语与方音共存的越剧念白风格。"
      },
      answer: "C",
      explain: {
        original: "月下侬心似水，且把旧梦细细分陈。",
        meaning: "月下我的心如水般平静，慢慢把旧日心事讲给你听。",
        source: "越剧抒情板式常见句法（示例唱段）",
        genre: "越剧以婉转细腻著称，擅长人物情感层层递进。",
        dialect: "吴语词“侬”与柔化语调并行，形成亲近、绵密的听感。",
        etymology: "“分陈”见于古汉语“分而陈之”表达，后在戏曲唱词中延展为“细述”。",
        culture: "越剧常以生活口语承接文雅辞章，折射江南日常美学与文人语感。"
      }
    },
    {
      id: "kunqu",
      icon: "🎐",
      genreName: "昆曲",
      dialectName: "中州韵系",
      question: "听辨后，请选出现代口语直译项（本题请选：现代通俗白话释义）",
      audioLine: "一寸丹心寄远，愿随雁字到天涯。",
      options: {
        A: "我把真心托付远方，希望像大雁传书那样把心意带到天边。",
        B: "一寸丹心寄远，愿随雁字到天涯。",
        C: "“丹心”在古汉语中指赤诚之心，“雁字”承接鸿雁传书意象，属于典故化词组。"
      },
      answer: "A",
      explain: {
        original: "一寸丹心寄远，愿随雁字到天涯。",
        meaning: "将赤诚心意寄往远方，盼它像鸿雁书信一样传到天边。",
        source: "昆曲抒情唱段常用意象句法（示例唱段）",
        genre: "昆曲曲词讲究声律与典故，语义含蓄而层次丰富。",
        dialect: "念白虽趋雅音，但在行腔中保留区域语音特征与古典吐字法。",
        etymology: "“丹心”见《史记》等古籍，“雁字”由“鸿雁传书”文化母题发展而来。",
        culture: "昆曲重“意在言外”，借典故与意象把私人情感提升为可共鸣的文化意蕴。"
      }
    },
    {
      id: "yue",
      icon: "🥁",
      genreName: "粤剧",
      dialectName: "粤语",
      question: "请根据唱段选择对应的戏曲原文文辞（本题请选：戏曲原文文辞）",
      audioLine: "花前听雨落，心事欲同君细讲。",
      options: {
        A: "我在花前听雨，想把心里话慢慢告诉你。",
        B: "花前听雨落，心事欲同君细讲。",
        C: "“同君”属古典尊称语法，粤剧中常见文言词与粤语语气词并置，形成雅俗并举表达。"
      },
      answer: "B",
      explain: {
        original: "花前听雨落，心事欲同君细讲。",
        meaning: "在花前听雨，想把心事慢慢讲给你听。",
        source: "粤剧慢板抒情段式（示例唱段）",
        genre: "粤剧兼具市民叙事与文雅唱词，文武场面并重。",
        dialect: "粤语保留古入声尾与丰富语气层次，唱腔节拍感鲜明。",
        etymology: "“同君”沿袭古汉语敬称宾语结构，戏曲中常用于情感表达的礼貌化书写。",
        culture: "粤剧用词在“雅”与“俗”之间转换自如，反映岭南城市文化的开放兼容。"
      }
    }
  ];

  let byUnlockedCount = 1;
  let byCurrentIndex = -1;
  const byClearedSet = new Set();
  let byLastCorrect = false;

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

  function updateBianyinProgress() {
    if (!byProgress) return;
    byProgress.textContent = `已点亮 ${byClearedSet.size} / ${byLevels.length}`;
  }

  function renderBianyinWall() {
    if (!byLevelGrid) return;
    byLevelGrid.innerHTML = "";
    byLevels.forEach((level, index) => {
      const isLocked = index >= byUnlockedCount;
      const isActive = index === byCurrentIndex;
      const isCleared = byClearedSet.has(level.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "by-level-item";
      if (isLocked) btn.classList.add("by-level-item--locked");
      if (isActive) btn.classList.add("by-level-item--active");
      if (isCleared) btn.classList.add("by-level-item--cleared");
      btn.dataset.index = String(index);
      btn.disabled = isLocked;
      btn.innerHTML = `
        <span class="by-level-item__icon">${level.icon}</span>
        <span class="by-level-item__name">${level.genreName}</span>
      `;
      byLevelGrid.appendChild(btn);
    });
    updateBianyinProgress();
  }

  function setBianyinLevel(index) {
    const level = byLevels[index];
    if (!level) return;
    byCurrentIndex = index;
    byLastCorrect = false;
    if (byLevelName) {
      byLevelName.textContent = `当前关卡：${level.genreName} · ${level.dialectName}`;
    }
    if (byQuestion) byQuestion.textContent = level.question;
    if (byOptionA) byOptionA.textContent = level.options.A;
    if (byOptionB) byOptionB.textContent = level.options.B;
    if (byOptionC) byOptionC.textContent = level.options.C;
    if (byAudioTip) byAudioTip.textContent = "提示：先听音，再作答。";
    if (byOptions) {
      byOptions.querySelectorAll('input[name="by-answer"]').forEach((input) => {
        input.checked = false;
      });
    }
    if (btnByNext) btnByNext.disabled = true;
    renderBianyinWall();
  }

  function playBianyinAudio() {
    const level = byLevels[byCurrentIndex];
    if (!level) {
      showToast("请先从图标墙选择一个可解锁的剧种关卡。");
      return;
    }
    if (byAudioTip) {
      byAudioTip.textContent = `正在播放：${level.genreName}唱段示例`;
    }
    audioContext.resume().catch(() => {});
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(level.audioLine);
      utterance.lang = "zh-CN";
      utterance.rate = 0.82;
      utterance.pitch = 1.02;
      utterance.onend = () => {
        if (byAudioTip) byAudioTip.textContent = "已播放完成，可开始作答。";
      };
      window.speechSynthesis.speak(utterance);
      return;
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.value = 280;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, now + 1.4);
    osc.start(now);
    osc.stop(now + 1.45);
    window.setTimeout(() => {
      if (byAudioTip) byAudioTip.textContent = "已播放完成，可开始作答。";
    }, 1450);
  }

  function fillBianyinModal(level, isCorrect) {
    const answerLabelMap = {
      A: "选项 A · 现代通俗白话释义",
      B: "选项 B · 戏曲原文文辞",
      C: "选项 C · 方言文化溯源注解"
    };
    if (byModalResult) {
      byModalResult.textContent = isCorrect
        ? `回答正确，已点亮「${level.genreName}」图标。该题标准答案为：${answerLabelMap[level.answer]}。`
        : `本次未答对。该题标准答案为：${answerLabelMap[level.answer]}，可结合下方文化解析再听一遍。`;
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
    const level = byLevels[byCurrentIndex];
    if (!level || !byOptions) {
      showToast("请先开启一个关卡。");
      return;
    }
    const selected = byOptions.querySelector('input[name="by-answer"]:checked');
    if (!selected) {
      showToast("请选择 A/B/C 中的一项后再提交。");
      return;
    }
    const isCorrect = selected.value === level.answer;
    byLastCorrect = isCorrect;
    if (isCorrect) {
      byClearedSet.add(level.id);
      byUnlockedCount = Math.min(byLevels.length, Math.max(byUnlockedCount, byCurrentIndex + 2));
      if (btnByNext) btnByNext.disabled = false;
      showToast("答对了，已点亮该剧种图标并解锁下一关。");
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
    if (nextIndex >= byUnlockedCount || nextIndex >= byLevels.length) {
      if (byClearedSet.size === byLevels.length) {
        showToast("恭喜完成全戏曲图鉴收集。");
      } else {
        showToast("当前已是已解锁关卡的最后一题。");
      }
      return;
    }
    setBianyinLevel(nextIndex);
    closeBianyinModal();
  }

  byLevelGrid?.addEventListener("click", (e) => {
    const target = e.target.closest(".by-level-item");
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    if (index >= byUnlockedCount) {
      showToast("该剧种尚未解锁，请先通关前一关。");
      return;
    }
    setBianyinLevel(index);
  });

  btnByPlay?.addEventListener("click", playBianyinAudio);
  btnBySubmit?.addEventListener("click", submitBianyinAnswer);
  btnByNext?.addEventListener("click", gotoNextBianyinLevel);
  btnByModalClose?.addEventListener("click", closeBianyinModal);
  byModalBackdrop?.addEventListener("click", closeBianyinModal);

  renderBianyinWall();
  if (byLevels.length > 0) {
    setBianyinLevel(0);
  }

  // 断章寻韵功能实现（重制版）
  const dzLibrary = [
    {
      id: "mnx-001",
      name: "《月夜思乡》",
      dialect: "闽南语",
      genre: "闽南戏",
      intro: "乡愁题材唱段，语气婉转，常用于离乡人物独白。",
      fullReference:
        "月照古厝风过廊，我问归舟几时靠。旧巷炊烟仍在否，梦里阿母唤阿兄。",
      fullAudioText:
        "月照古厝风过廊，我问归舟几时靠。旧巷炊烟仍在否，梦里阿母唤阿兄。",
      fullVideoUrl: "https://www.youtube.com/embed/8l4u9qQv8D8",
      subtitle:
        "方言：月照古厝风过廊 ｜ 普通话：月光照着老宅，风掠过走廊。\n方言：我问归舟几时靠 ｜ 普通话：我问归来的船何时靠岸。\n方言：旧巷炊烟仍在否 ｜ 普通话：旧巷里的炊烟还在吗。\n方言：梦里阿母唤阿兄 ｜ 普通话：梦里母亲在呼唤我。",
      wiki: {
        background: "该段常见于乡情戏，借夜景推进人物内心独白。",
        dialectFeature: "闽南语保留古语词和连读韵味，句尾拖腔明显。",
        source: "地方戏改编唱本常用段式（教学示例）。",
        history: "闽南戏源流深厚，兼具民间口传与文人写作传统。",
        glossary: "“古厝”指旧宅；“归舟”指回乡之船。"
      },
      segments: [
        {
          id: "mnx-1",
          order: 1,
          text: "月光照着老宅，风掠过走廊。",
          audioText: "月照古厝风过廊"
        },
        {
          id: "mnx-2",
          order: 2,
          text: "我问归来的船何时靠岸。",
          audioText: "我问归舟几时靠"
        },
        {
          id: "mnx-3",
          order: 3,
          text: "旧巷里的炊烟还在吗。",
          audioText: "旧巷炊烟仍在否"
        },
        {
          id: "mnx-4",
          order: 4,
          text: "梦里母亲还在呼唤我。",
          audioText: "梦里阿母唤阿兄"
        }
      ]
    },
    {
      id: "yueju-001",
      name: "《花窗听雨》",
      dialect: "吴语",
      genre: "越剧",
      intro: "以雨夜叙情为线索，唱词细腻，适合作听辨练习。",
      fullReference:
        "花窗细雨一更深，纸伞未收人未归。旧约写在青灯下，怕听晨钟断梦魂。",
      fullAudioText:
        "花窗细雨一更深，纸伞未收人未归。旧约写在青灯下，怕听晨钟断梦魂。",
      fullVideoUrl: "https://www.youtube.com/embed/fx3Y3nR5P9g",
      subtitle:
        "方言：花窗细雨一更深 ｜ 普通话：花窗外细雨愈发深沉。\n方言：纸伞未收人未归 ｜ 普通话：纸伞未收，人也未归。\n方言：旧约写在青灯下 ｜ 普通话：旧日约定写在青灯旁。\n方言：怕听晨钟断梦魂 ｜ 普通话：最怕晨钟响起，惊断梦魂。",
      wiki: {
        background: "越剧常借日常景物承载人物情绪转折。",
        dialectFeature: "吴语语流柔和，叙情段落中停连节奏鲜明。",
        source: "越剧抒情慢板结构（教学示例）。",
        history: "越剧发端于江南，擅长细腻心理刻画。",
        glossary: "“青灯”多指夜读灯火；“断梦魂”用于表达惊醒与失落。"
      },
      segments: [
        {
          id: "yueju-1",
          order: 1,
          text: "花窗外细雨一夜更深。",
          audioText: "花窗细雨一更深"
        },
        {
          id: "yueju-2",
          order: 2,
          text: "纸伞未收，他还没有回来。",
          audioText: "纸伞未收人未归"
        },
        {
          id: "yueju-3",
          order: 3,
          text: "旧日约定写在灯下。",
          audioText: "旧约写在青灯下"
        },
        {
          id: "yueju-4",
          order: 4,
          text: "最怕清晨钟声打断梦魂。",
          audioText: "怕听晨钟断梦魂"
        }
      ]
    },
    {
      id: "yue-001",
      name: "《南国秋声》",
      dialect: "粤语",
      genre: "粤剧",
      intro: "岭南秋景唱段，句式短促有力，节拍感明显。",
      fullReference:
        "江风入袖月临台，旧曲新翻寄酒杯。谁道此身无归处，一腔乡语向南来。",
      fullAudioText:
        "江风入袖月临台，旧曲新翻寄酒杯。谁道此身无归处，一腔乡语向南来。",
      fullVideoUrl: "https://www.youtube.com/embed/H8VjF3h4f3M",
      subtitle:
        "方言：江风入袖月临台 ｜ 普通话：江风吹进衣袖，明月照上高台。\n方言：旧曲新翻寄酒杯 ｜ 普通话：旧曲新唱，都寄在酒杯里。\n方言：谁道此身无归处 ｜ 普通话：谁说我此身没有归处。\n方言：一腔乡语向南来 ｜ 普通话：一腔乡音，正向南而来。",
      wiki: {
        background: "常见于抒怀场景，先景后情，层层推进。",
        dialectFeature: "粤语入声和短促节拍让唱段更具铿锵感。",
        source: "粤剧板式变换段（教学示例）。",
        history: "粤剧融合南北声腔，形成岭南特色舞台语言。",
        glossary: "“寄酒杯”借酒言志；“乡语”即乡音。"
      },
      segments: [
        {
          id: "yue-1",
          order: 1,
          text: "江风吹进衣袖，明月照上高台。",
          audioText: "江风入袖月临台"
        },
        {
          id: "yue-2",
          order: 2,
          text: "旧曲新唱，都寄在酒杯里。",
          audioText: "旧曲新翻寄酒杯"
        },
        {
          id: "yue-3",
          order: 3,
          text: "谁说我没有归去的地方。",
          audioText: "谁道此身无归处"
        },
        {
          id: "yue-4",
          order: 4,
          text: "一腔乡音正向南而来。",
          audioText: "一腔乡语向南来"
        }
      ]
    }
  ];

  let dzCurrentLevelIndex = 0;
  let dzSourceSegments = [];
  let dzTrackSegments = [];

  function shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function speakLine(line) {
    audioContext.resume().catch(() => {});
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = "zh-CN";
    utterance.rate = 0.82;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  }

  function renderDzInfo(level) {
    if (!dzInfo || !dzReference) return;
    dzInfo.innerHTML = `
      <h2>${level.name}</h2>
      <p><strong>所属方言：</strong>${level.dialect} ｜ <strong>剧种：</strong>${level.genre}</p>
      <small>${level.intro}</small>
    `;
    dzReference.innerHTML = `
      <h3>原文参考区（普通话对照）</h3>
      <p>${level.fullReference}</p>
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
    dzWiki.innerHTML = `
      <h4>戏曲文化百科介绍</h4>
      <ul>
        <li><strong>剧目背景：</strong>${level.wiki.background}</li>
        <li><strong>方言特色：</strong>${level.wiki.dialectFeature}</li>
        <li><strong>唱段出处：</strong>${level.wiki.source}</li>
        <li><strong>历史科普：</strong>${level.wiki.history}</li>
        <li><strong>词句释义：</strong>${level.wiki.glossary}</li>
      </ul>
    `;
    dzMedia.innerHTML = `
      <h4>完整原声播放区</h4>
      <audio controls preload="none" class="dz2-audio">
        <source src="" type="audio/mpeg" />
      </audio>
      <button type="button" class="dz2-play-full" id="btn-dz-play-full">播放完整唱段（语音示意）</button>
      <div class="dz2-video">
        <iframe src="${level.fullVideoUrl}" title="${level.name}完整片段视频" loading="lazy" allowfullscreen></iframe>
      </div>
      <pre class="dz2-subtitle">${level.subtitle}</pre>
    `;
    dzResult.hidden = false;
    dzResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("btn-dz-play-full")?.addEventListener("click", () => {
      speakLine(level.fullAudioText);
    });
  }

  function resetDuanzhangGame() {
    const level = dzLibrary[dzCurrentLevelIndex];
    if (!level) return;
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

  function playDzTrack() {
    if (dzTrackSegments.length === 0) {
      showToast("轨道为空，请先拖拽片段。");
      return;
    }
    dzTrackSegments.forEach((seg, idx) => {
      window.setTimeout(() => {
        speakLine(seg.audioText);
      }, idx * 1600);
    });
  }

  function submitDzTrack() {
    const level = dzLibrary[dzCurrentLevelIndex];
    if (!level || dzTrackSegments.length === 0) {
      showToast("请先完成片段拼接。");
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
      speakLine(seg.audioText);
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
      speakLine(seg.audioText);
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
