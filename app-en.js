const msgList = document.getElementById("msgList");
const quickWrap = document.getElementById("quickWrap");
const textInput = document.getElementById("textInput");
const inputBar = document.querySelector(".inputBar");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const FLOW = {
  start: {
    bot: ["To better understand your shopping needs, what kind of clothing style do you usually wear?"],
    options: [
      { id: "cotton", text: "I like loose and comfortable cotton outfits" },
      { id: "noSport", text: "I rarely buy sportswear or sweatpants" },
    ],
    next: () => "askType",
  },
  askType: {
    bot: ["Got it! What kind of clothing do you usually prefer?"],
    options: [
      { id: "sport", text: "Sportswear" },
      { id: "leisure", text: "Leisurewear" },
      { id: "elegant", text: "Elegant style" },
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
  quickWrap.classList.remove("quickWrap--busy");
  quickWrap.replaceChildren();
}

function setQuickReplies(options) {
  clearQuickReplies();
  quickWrap.dataset.count = String(options.length);
  options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = opt.text;
    btn.dataset.choiceId = opt.id;
    btn.style.setProperty("--chip-delay", `${index * 85}ms`);
    quickWrap.appendChild(btn);
  });
}

function normalizeText(t) {
  return (t ?? "").trim().replace(/\s+/g, " ");
}

function findChoiceByText(text) {
  const node = FLOW[state.nodeId];
  if (!node?.options?.length) return null;
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return null;
  const exact = node.options.find((o) => normalizeText(o.text).toLowerCase() === normalized);
  if (exact) return exact;
  const partial = node.options.find((o) => {
    const optionText = normalizeText(o.text).toLowerCase();
    return optionText.includes(normalized) || normalized.includes(optionText);
  });
  return partial ?? null;
}

async function playBotLines(lines) {
  for (const line of lines) {
    const typing = addTyping();
    const typingDelay = Math.min(1100, Math.max(520, line.length * 18));
    await wait(typingDelay);
    typing.remove();
    addMessage("bot", line);
    await wait(180);
  }
}

function buildEndMessage(choiceId) {
  const map = {
    sport: "sportswear",
    leisure: "leisurewear",
    elegant: "an elegant style",
  };
  const picked = map[choiceId] ?? "that style";
  return `Great — you prefer ${picked}. Thanks! We’ll prepare recommendations that match your taste.`;
}

function setBusy(value) {
  state.busy = value;
  quickWrap.classList.toggle("quickWrap--busy", value);
  inputBar?.classList.toggle("inputBar--busy", value);
}

function lockQuickReplies(selectedId) {
  const chips = [...quickWrap.querySelectorAll(".chip")];
  chips.forEach((chip) => {
    chip.disabled = true;
    if (chip.dataset.choiceId === selectedId) {
      chip.classList.add("chip--selected");
      chip.classList.remove("chip--hold", "chip--dismissed");
    } else {
      chip.classList.add("chip--dismissed");
      chip.classList.remove("chip--selected");
    }
  });
}

async function advance(choice) {
  if (state.busy) return;
  setBusy(true);
  try {
    const node = FLOW[state.nodeId];
    if (!node) return;
    if (choice) {
      lockQuickReplies(choice.id);
      await wait(240);
      addMessage("user", choice.text);
      state.answers[state.nodeId] = choice.id;
      await wait(140);
      clearQuickReplies();
      await wait(140);
    }

    const nextId = node.next ? node.next(choice?.id) : null;
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
    await wait(180);
    setQuickReplies(nextNode.options ?? []);
  } finally {
    setBusy(false);
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
    setBusy(true);
    try {
      addMessage("user", value);
      const chips = [...quickWrap.querySelectorAll(".chip")];
      chips.forEach((chip) => {
        chip.disabled = true;
        chip.classList.add("chip--hold");
      });
      await wait(120);
      clearQuickReplies();
      const typing = addTyping();
      await wait(760);
      typing.remove();
      addMessage("bot", "In this demo, tap one of the quick replies below to continue.");
      await wait(160);
      setQuickReplies(node?.options ?? []);
    } finally {
      setBusy(false);
    }
  });
}

async function boot() {
  wireEvents();
  await playBotLines(FLOW.start.bot);
  await wait(180);
  setQuickReplies(FLOW.start.options);
}

boot();
