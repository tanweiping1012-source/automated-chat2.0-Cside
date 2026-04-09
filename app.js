const msgList = document.getElementById("msgList");
const quickWrap = document.getElementById("quickWrap");
const textInput = document.getElementById("textInput");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const FLOW = {
  start: {
    bot: ["購買ニーズをよりよく満たすために、普段どのような服装スタイルをしていますか？"],
    options: [
      { id: "cotton", text: "私はゆったりとした綿を着るのが好きです" },
      { id: "noSport", text: "私はスポーツウェアやスウェットパンツをほとんど買わない" },
    ],
    next: () => "askType",
  },
  askType: {
    bot: ["分かりました！では、普段どんなタイプの服が好きですか？"],
    options: [
      { id: "sport", text: "スポーツウェア" },
      { id: "leisure", text: "レジャーウェア" },
      { id: "elegant", text: "エレガントなスタイル" },
    ],
    next: (choiceId) => `end:${choiceId}`,
  },
};

const state = {
  nodeId: "start",
  answers: {},
  busy: false,
};

function createMsg({ role, type, text }) {
  const li = document.createElement("li");
  li.className = `msg msg--${role}`;
  if (role === "bot") {
    const avatar = document.createElement("span");
    avatar.className = "msg__avatar";
    const mark = document.createElement("span");
    mark.className = "avatar__mark";
    avatar.appendChild(mark);
    li.appendChild(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${role}`;
  if (type === "typing") {
    const dots = document.createElement("div");
    dots.className = "typingDots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    bubble.appendChild(dots);
  } else {
    bubble.textContent = text ?? "";
  }
  li.appendChild(bubble);
  return { li, bubble };
}

function scrollToBottom() {
  const body = document.querySelector(".chatBody");
  body.scrollTop = body.scrollHeight;
}

function addMessage(role, text) {
  const { li } = createMsg({ role, type: "text", text });
  msgList.appendChild(li);
  requestAnimationFrame(scrollToBottom);
}

function addTyping() {
  const { li } = createMsg({ role: "bot", type: "typing" });
  li.dataset.typing = "1";
  msgList.appendChild(li);
  requestAnimationFrame(scrollToBottom);
  return li;
}

function clearQuickReplies() {
  delete quickWrap.dataset.count;
  quickWrap.replaceChildren();
}

function setQuickReplies(options) {
  clearQuickReplies();
  quickWrap.dataset.count = String(options.length);
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = opt.text;
    btn.dataset.choiceId = opt.id;
    quickWrap.appendChild(btn);
  });
}

function normalizeText(t) {
  return (t ?? "").trim().replace(/\s+/g, " ");
}

function findChoiceByText(text) {
  const node = FLOW[state.nodeId];
  if (!node?.options?.length) return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const exact = node.options.find((o) => normalizeText(o.text) === normalized);
  if (exact) return exact;
  const partial = node.options.find((o) => normalizeText(o.text).includes(normalized) || normalized.includes(normalizeText(o.text)));
  return partial ?? null;
}

async function playBotLines(lines) {
  for (const line of lines) {
    const typing = addTyping();
    await wait(650);
    typing.remove();
    addMessage("bot", line);
    await wait(120);
  }
}

function buildEndMessage(choiceId) {
  const map = {
    sport: "スポーツウェア",
    leisure: "レジャーウェア",
    elegant: "エレガントなスタイル",
  };
  const picked = map[choiceId] ?? "そのスタイル";
  return `「${picked}」が好きなのですね。ありがとうございます。あなたの好みに合うおすすめを用意します。`;
}

async function advance(choice) {
  if (state.busy) return;
  state.busy = true;
  try {
    const node = FLOW[state.nodeId];
    if (!node) return;
    if (choice) {
      addMessage("user", choice.text);
      state.answers[state.nodeId] = choice.id;
      clearQuickReplies();
      await wait(220);
    }

    let nextId = node.next ? node.next(choice?.id) : null;
    if (!nextId) return;

    if (nextId.startsWith("end:")) {
      const endChoice = nextId.split(":")[1];
      await playBotLines([buildEndMessage(endChoice)]);
      clearQuickReplies();
      state.nodeId = nextId;
      return;
    }

    state.nodeId = nextId;
    const nextNode = FLOW[nextId];
    if (!nextNode) return;
    await playBotLines(nextNode.bot);
    setQuickReplies(nextNode.options ?? []);
  } finally {
    state.busy = false;
  }
}

function wireEvents() {
  quickWrap.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest("button.chip");
    if (!(btn instanceof HTMLButtonElement)) return;
    const node = FLOW[state.nodeId];
    if (!node?.options?.length) return;
    const choice = node.options.find((o) => o.id === btn.dataset.choiceId);
    if (!choice) return;
    await advance(choice);
  });

  textInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const value = normalizeText(textInput.value);
    if (!value) return;
    textInput.value = "";

    const node = FLOW[state.nodeId];
    const mapped = findChoiceByText(value);
    if (mapped) {
      await advance(mapped);
      return;
    }

    if (state.busy) return;
    state.busy = true;
    try {
      addMessage("user", value);
      clearQuickReplies();
      const typing = addTyping();
      await wait(700);
      typing.remove();
      addMessage("bot", "このデモでは、下の候補（クイック返信）をタップして進められます。");
      setQuickReplies(node?.options ?? []);
    } finally {
      state.busy = false;
    }
  });
}

async function boot() {
  wireEvents();
  await playBotLines(FLOW.start.bot);
  setQuickReplies(FLOW.start.options);
}

boot();
